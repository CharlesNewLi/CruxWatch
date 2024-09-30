import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client'; 
import { Terminal as Xterm } from 'xterm'; 
import 'xterm/css/xterm.css'; 
import { FitAddon } from 'xterm-addon-fit'; 

interface TerminalComponentProps {
  neMake: string;
  neIp: string;
  gneIp: string;
  sshUsername: string;
  sshPassword: string;
  sshSecret?: string;
}

const TerminalComponent: React.FC<TerminalComponentProps> = ({
  neMake,
  neIp,
  gneIp,
  sshUsername,
  sshPassword,
  sshSecret,
}) => {
  const socketRef = useRef<any>(null);
  const terminalRef = useRef<HTMLDivElement | null>(null); 
  const terminalInstance = useRef<Xterm | null>(null); 
  const fitAddon = useRef(new FitAddon()); 
  const inputBuffer = useRef<string>(''); // 缓存命令输入

  const [error, setError] = useState<string | null>(null); 

  useEffect(() => {
    localStorage.debug = 'socket.io-client:socket';
  
    socketRef.current = io('http://127.0.0.1:8888', {
      path: '/socket.io',
    });
  
    socketRef.current.on('connect', () => {
      console.log('Connected to WebSocket server');
      
      // 初始化终端
      initializeTerminal();
  
      // 发送 SSH 连接请求
      console.log('Sending SSH connection parameters:', {
        neMake,
        neIp,
        gneIp,
        sshUsername,
        sshPassword,
        sshSecret,
      });
  
      socketRef.current.emit('initialize_ssh', {
        neMake,
        neIp,
        gneIp,
        sshUsername,
        sshPassword,
        sshSecret,
      });
    });
  
    socketRef.current.on('ssh_error', (data: { error: string }) => {
      console.error('SSH connection failed:', data.error);
      setError(data.error);
    });
  
    // 监听服务器返回的命令执行结果
    socketRef.current.on('command_output', (data: { output: string }) => {
      console.log('Received command output:', data.output);  // 确保这里可以打印出数据
      if (terminalInstance.current) {
        const lines = data.output.split('\n');
        lines.forEach((line) => {
          terminalInstance.current?.writeln(line);  // 将每行内容逐行写入终端
        });
      } else {
        console.error('Terminal instance is null or undefined');
      }
    });
  
    socketRef.current.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
    });
  
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (terminalInstance.current) {
        terminalInstance.current.dispose();
      }
    };
  }, []); // useEffect 仅在组件挂载时执行一次

  const initializeTerminal = () => {
    if (terminalRef.current && !terminalInstance.current) {
      terminalInstance.current = new Xterm();
      terminalInstance.current.loadAddon(fitAddon.current);
      terminalInstance.current.open(terminalRef.current);
      
      // 添加 resize 处理
      const resizeTerminal = () => {
        fitAddon.current.fit();
      };
  
      setTimeout(() => {
        resizeTerminal();
      }, 100);
  
      window.addEventListener('resize', resizeTerminal);
  
      // 捕获用户输入
      terminalInstance.current.onData((input) => {
        if (input === '\r') {  // Enter 键
          const command = inputBuffer.current.trim();
          if (command) {
            sendCommand(command);  // 发送命令
            inputBuffer.current = '';
          }
        } else if (input === '\u007f') {  // 退格键
          if (inputBuffer.current.length > 0) {
            inputBuffer.current = inputBuffer.current.slice(0, -1);
            terminalInstance.current?.write('\b \b');
          }
        } else {
          inputBuffer.current += input;
          terminalInstance.current?.write(input);  // 显示用户输入
        }
      });
    }
  };

  const sendCommand = (command: string) => {
    if (socketRef.current) {
      const connectionData = {
        command,
        neMake,
        neIp,
        gneIp,
        sshUsername,
        sshPassword,
        sshSecret,
      };
      console.log(`Sending command with SSH details:`, connectionData);
      socketRef.current.emit('execute_command', connectionData); 
      terminalInstance.current?.writeln(`$ ${command}`);  // 将命令显示在终端界面
    } else {
      terminalInstance.current?.writeln('WebSocket connection not established.');
    }
  };

  return (
    <div>
      {error && <div style={{ color: 'red' }}>{`Error: ${error}`}</div>}
      <div ref={terminalRef} style={{ height: '300px', width: '100%', border: '1px solid #000' }} />
    </div>
  );
};

export default TerminalComponent;