from services.db import get_db
from network_mgmt.global_data import devices, topo_data

def load_data_from_db(network_id):
    db = get_db()
    networks_collection = db.get_collection('networks')

    # 从数据库中找到指定的网络
    network = networks_collection.find_one({"network_id": network_id})

    if network:
        global devices, topo_data 

        network_name = network.get('network_name', 'Unknown')  # 获取 network_name

        print(f"Network found: {network}")

        # 清空内存中的数据
        devices.clear()
        topo_data.clear()

        # 加载设备和拓扑数据到内存
        for site in network.get('sites', []):
            site_id = site.get('site_id', 'Unknown')  # 获取站点 ID
            site_name = site.get('site_name', 'Unknown')  # 获取站点名称
            for element in site.get('elements', []):
                ne_name = element.get('ne_name', '')
                devices[ne_name] = {
                    "gne": element.get('gne'),
                    'ip': element.get('ne_ip'),
                    'ne_id': element.get('ne_id'),
                    'device_type': element.get('ne_make'),
                    'device_name': element.get('ne_name'),
                    'site_name': site_name,  # 关联站点名称到设备
                    'site_id': site_id,
                    'status': 'offline',  # 默认所有设备初始状态为 offline
                    'snmp_auth_password': element.get('snmp_auth_password'),
                    'snmp_auth_protocol': element.get('snmp_auth_protocol'),
                    'snmp_priv_password': element.get('snmp_priv_password'),
                    'snmp_priv_protocol': element.get('snmp_priv_protocol'),
                    'ssh_password': element.get('ssh_password'),
                    'ssh_username': element.get('ssh_username')
                }
        # 这里假设 network 包含拓扑数据，加载到内存
        topo_data.update(network.get('topo_data', {}))
        print(f"Topology data loaded into memory: {topo_data}")

        return {
            "network_name": network_name,
            "network_id": network_id
        }  # 返回网络名称和网络 ID
    else:
        print(f"Network {network_id} not found in the database")
        return False