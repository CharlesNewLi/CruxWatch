import logging
from netmiko import ConnectHandler

# 创建一个全局字典来保存SSH连接，以支持保持会话
ssh_connections = {}

def open_ssh_connection(client_id, device_params):
    """为每个客户端打开并保存一个SSH连接"""
    try:
        connection = ConnectHandler(**device_params)
        ssh_connections[client_id] = connection
        logging.info(f"SSH connection established for client {client_id}")
        return connection
    except Exception as e:
        logging.error(f"Error opening SSH connection for client {client_id}: {str(e)}")
        return None

def close_ssh_connection(client_id):
    """关闭特定客户端的SSH连接"""
    if client_id in ssh_connections:
        connection = ssh_connections.pop(client_id, None)
        if connection:
            connection.disconnect()
            logging.info(f"SSH connection closed for client {client_id}")

def ssh_cli(client_id, data):
    """在一个已有的SSH会话中执行命令"""
    try:
        # 检查是否已有SSH连接
        connection = ssh_connections.get(client_id)
        if not connection:
            # 获取连接参数
            device_type = data.get('neMake')  # 设备类型，例如 'huawei', 'cisco_ios'
            ip = data.get('neIp')  # 设备 IP 地址
            gne_ip = data.get('gneIp')  # GNE IP 地址（仅用于华为）
            ssh_username = data.get('sshUsername')
            ssh_password = data.get('sshPassword')
            ssh_secret = data.get('sshSecret', '')

            # 构造 SSH 连接的基本参数字典
            device_params = {
                'device_type': device_type,
                'ip': ip,
                'username': ssh_username,
                'password': ssh_password,
                'secret': ssh_secret,
                'session_log': f'session_log_{ip}.txt',
                'global_delay_factor': 2
            }

            # 处理华为设备的连接逻辑（可能通过GNE）
            if device_type == 'huawei':
                if gne_ip and gne_ip != ip:
                    logging.info(f"Connecting to GNE device {gne_ip} to reach target device {ip}")
                    gne_params = device_params.copy()
                    gne_params['ip'] = gne_ip
                    connection = open_ssh_connection(client_id, gne_params)

                    if connection:
                        stelnet_command = f"stelnet {ip}"
                        logging.info(f"Executing stelnet command: {stelnet_command}")
                        command_output = connection.send_command_timing(stelnet_command)

                        if "The server is not authenticated" in command_output:
                            logging.info("Server authentication prompt detected, sending 'Y'")
                            command_output += connection.send_command_timing('Y')

                        if "Save the server's public key?" in command_output:
                            logging.info("Public key prompt detected, sending 'N'")
                            command_output += connection.send_command_timing('N')

                        command_output += connection.send_command_timing(ssh_username)
                        command_output += connection.send_command_timing(ssh_password)

                        if "Change now?" in command_output:
                            logging.info("Password change prompt detected, sending 'N'")
                            command_output += connection.send_command_timing('N')

                        prompt_after_stelnet = connection.find_prompt()
                        logging.info(f"Prompt after stelnet: {prompt_after_stelnet}")
                        
                        if "Press CTRL + K to abort" in command_output:
                            logging.info("Connection established to target device.")
                        elif "closed by the remote host" in command_output:
                            logging.error("Connection was closed by the remote host.")
                            return "Error: Connection was closed by the remote host."
                        else:
                            logging.error(f"Unexpected output after stelnet: {command_output}")
                            return "Error: Failed to connect to target device."

                        ssh_connections[client_id] = connection
                else:
                    # 直接连接到华为设备
                    connection = open_ssh_connection(client_id, device_params)

            # 处理 Cisco 设备的逻辑（直接连接）
            elif device_type == 'cisco_ios':
                logging.info(f"Connecting directly to Cisco device {ip}")
                connection = open_ssh_connection(client_id, device_params)

        if not connection:
            return f"Error: Unable to establish SSH connection for client {client_id}"

        # 动态识别设备提示符
        prompt = connection.find_prompt()
        logging.info(f"Detected prompt: {prompt}")

        command = data.get('command', '')

        # 处理进入配置模式的命令
        if command == "system-view" and "<" in prompt:
            logging.info("Switching to configuration mode...")
            command_output = connection.send_command('system-view', expect_string=r'\[.*\]')
            prompt = connection.find_prompt()
            logging.info(f"New prompt after entering configuration mode: {prompt}")
        elif command == "return" and "[" in prompt:
            logging.info("Exiting configuration mode...")
            command_output = connection.send_command('return', expect_string=r'<.*>')
            prompt = connection.find_prompt()
            logging.info(f"New prompt after exiting configuration mode: {prompt}")
        else:
            # 执行其他命令，并捕获提示符
            logging.info(f"Executing command: {command}")
            command_output = connection.send_command(command, expect_string=r'[\[\]<#>]')
            prompt = connection.find_prompt()
            logging.info(f"New prompt after command: {prompt}")

        if command_output.strip():
            logging.info(f"Command output received: {command_output}")
        else:
            logging.warning("Command output is empty or contains only whitespace")

        if '^' in command_output:
            logging.error("Command execution error detected.")
            command_output += "\nError: Command execution failed, please check syntax or device mode."

        full_output = f"{command_output.rstrip()}\n{prompt}"
        return full_output

    except Exception as e:
        logging.error(f"Error during SSH command execution for client {client_id}: {str(e)}")
        return f"Error: {str(e)}"