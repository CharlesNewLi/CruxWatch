import nmap
import logging

# Nmap 端口扫描函数
def perform_port_scan(ip, port_range='1-1024'):
    try:
        logging.info(f"Initializing Nmap scan for IP: {ip} on ports: {port_range}")
        nm = nmap.PortScanner()
        
        # 开始执行扫描，并打印扫描参数
        logging.info(f"Running Nmap scan on {ip} with arguments '-p {port_range}'")
        scan_data = nm.scan(ip, arguments=f'-p {port_range}')  # 传递端口范围

        logging.info(f"Nmap raw scan data: {scan_data}")  # 打印原始 Nmap 扫描结果
        scan_results = []

        if 'scan' in scan_data and ip in scan_data['scan']:
            for port in scan_data['scan'][ip].get('tcp', {}):
                port_data = scan_data['scan'][ip]['tcp'][port]
                scan_results.append({
                    'port': port,
                    'protocol': 'tcp',
                    'service': port_data.get('name', 'Unknown'),
                    'state': port_data.get('state', 'Unknown'),
                })

        logging.info(f"Formatted scan results for {ip}: {scan_results}")
        return scan_results

    except Exception as e:
        logging.error(f"Exception occurred during Nmap scan for {ip}: {e}")
        raise