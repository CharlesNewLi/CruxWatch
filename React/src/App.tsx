import React, { useEffect, useState } from "react";
import { useAppDispatch } from "./redux/hooks"; 
import { getNetworks, syncNetworkStats } from "./redux/networks/slice"; 
import styles from "./App.module.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HomePage, NetworkPage, ConfMgmt, PerfMont, FaultMgmt, SecMgmt } from "./pages";
import io, { Socket } from 'socket.io-client';
import { notification } from 'antd';

function App() {
   
  const dispatch = useAppDispatch();
  const [trapData, setTrapData] = useState<any[]>([]); // 全局存储 SNMP Trap 数据
  const [socket, setSocket] = useState<Socket | null>(null); // WebSocket 连接

   // 在组件挂载时发起网络请求，并同步 networkDetails
  useEffect(() => {
    const fetchAndSyncNetworks = async () => {
      // 1. 获取 networks 数据
      await dispatch(getNetworks());

      // 2. 进行增量同步
      await dispatch(syncNetworkStats());
    };

    fetchAndSyncNetworks();
  }, [dispatch]);

  // 初始化 WebSocket 连接以接收告警数据
  useEffect(() => {
    // 创建 WebSocket 连接
    const socketInstance = io('http://127.0.0.1:8888'); // 替换为后端 WebSocket 地址
    setSocket(socketInstance);

    // 监听 SNMP Trap 数据
    socketInstance.on('new_snmp_trap', (data) => {
      console.log('Received new SNMP Trap:', data); // 打印接收到的 Trap 数据
      setTrapData((prevData) => [...prevData, data]); // 更新状态

      notification.info({
        message: 'New SNMP Trap',
        description: `Trap data: ${JSON.stringify(data)}`,
        placement: 'bottomRight',
      });
    });

    // 监听 SNMP 错误
    socketInstance.on('snmp_error', (error) => {
      console.log('Received SNMP Error:', error); // 打印接收到的错误信息
      notification.error({
        message: 'SNMP Trap Error',
        description: `Error: ${error.error}`,
        placement: 'bottomRight',
      });
    });

    return () => {
      // 清除 WebSocket 连接
      socketInstance.disconnect();
    };
  }, []);

  return (
    <div className={styles.App}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/networks" element={<NetworkPage />} />
          <Route path="/configuration" element={<ConfMgmt />} />
          <Route path="/performance" element={<PerfMont />} />
          {/* 传递 trapData 给 FaultMgmt */}
          <Route path="/fault" element={<FaultMgmt trapData={trapData} />} />
          <Route path="/security" element={<SecMgmt />} />
          <Route path="*" element = {<h1>404 not found Welcome to Mars</h1>} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
