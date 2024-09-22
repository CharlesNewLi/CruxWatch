from network_mgmt.global_data import devices, ne_connections, devices_snmp, topo_data
import networkx as nx
import logging
from ipaddress import ip_network, ip_address

def update_topo_data(network_name):
    """
    更新全局拓扑数据。每次设备状态更新或新增设备时，重新生成拓扑。
    """
    # 调用 generate_topology 函数重新生成拓扑数据
    new_topology = generate_topology(network_name)
    
    if new_topology:
        # 更新全局的 topo_data
        topo_data["nodes"] = new_topology["nodes"]
        topo_data["edges"] = new_topology["edges"]

         # 打印更新后的拓扑数据
        print(f"Updated topo_data: {topo_data}")
        
        logging.info(f"Topology updated successfully for network {network_name}: {topo_data}")
    else:
        logging.warning(f"Failed to update topology for network {network_name}")
        

def generate_topology(network_name):
    try:
        G = nx.Graph()

        # 过滤对应 network_name 的设备
        filtered_devices = {name: dev for name, dev in devices.items() if dev.get('network_name') == network_name}
        filtered_connections = [conn for conn in ne_connections if conn[0] in filtered_devices and conn[1] in filtered_devices]

        if not filtered_devices:
            logging.error(f"No devices found for network {network_name}")
            return None

        # 添加设备节点
        for device_name, device_data in filtered_devices.items():
            G.add_node(device_name, label=device_data.get('device_name'), ip=device_data.get('ip'))

        # 添加显式的设备连接（已经存在的邻居关系）
        for connection in filtered_connections:
            G.add_edge(connection[0], connection[1])

        # 遍历 snmp_data_store，基于接口的 IP 来推导邻居关系
        for device_name, device_snmp in devices_snmp.items():
            if device_name in filtered_devices:
                interfaces = device_snmp.get('Interfaces', [])
                for interface in interfaces:
                    ip_addr = interface.get('IP Address')
                    if ip_addr:
                        # 遍历其他设备，寻找匹配的子网
                        for other_device_name, other_device_data in filtered_devices.items():
                            if other_device_name != device_name:
                                other_interfaces = devices_snmp.get(other_device_name, {}).get('Interfaces', [])
                                for other_interface in other_interfaces:
                                    other_ip_addr = other_interface.get('IP Address')
                                    if other_ip_addr and are_ips_in_same_subnet(ip_addr, other_ip_addr):
                                        G.add_edge(device_name, other_device_name)
                                        logging.info(f"Added edge between {device_name} and {other_device_name} based on subnet match")

        # 获取节点和边的数据
        nodes = list(G.nodes(data=True))
        edges = list(G.edges(data=True))

        logging.info(f"Generated topology for network {network_name}: Nodes: {nodes}, Edges: {edges}")
        return {'nodes': nodes, 'edges': edges}

    except Exception as e:
        logging.error(f"Error generating topology: {str(e)}")
        return None

def are_ips_in_same_subnet(ip1, ip2):
    """
    判断两个 IP 是否在同一个子网中。
    假设你通过 SNMP 已经知道每个设备的子网掩码。
    """
    # 假设子网掩码为 /24，可以根据实际情况修改
    subnet1 = ip_network(f"{ip1}/30", strict=False)
    subnet2 = ip_network(f"{ip2}/30", strict=False)
    return ip_address(ip1) in subnet1 and ip_address(ip2) in subnet2

