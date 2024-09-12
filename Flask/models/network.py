from services.db import get_db
from bson import ObjectId

# Helper function to convert device data into database format (db_element)
def convert_device_to_db_format(device):
    """
    Convert the network device data to match the database's naming conventions.
    Only necessary fields are kept and renamed according to the provided mapping.
    """
    # 定义需要转换的字段及其目标字段名称
    key_mapping = {
        'device_name': 'ne_name',  # 将 'device_name' 转换为 'ne_name'
        'device_type': 'ne_make',  # 将 'device_type' 转换为 'ne_make'
        'ip': 'ne_ip',             # 将 'ip' 转换为 'ne_ip'
        'gne': 'gne',              # 保留 GNE 信息
        'ssh_username': 'ssh_username',  # 保留 ssh_username
        'ssh_password': 'ssh_password',  # 保留 ssh_password
        'ssh_secret': '',
        'snmp_username': 'snmp_username',
        'snmp_auth_password': 'snmp_auth_password',
        'snmp_auth_protocol': 'snmp_auth_protocol',
        'snmp_priv_password': 'snmp_priv_password',
        'snmp_priv_protocol': 'snmp_priv_protocol',       
    }
    
    # 过滤并转换字段
    element = {
        'ne_id': str(ObjectId())
    }
    for device_key, ne_key in key_mapping.items():
        if device_key in device:
            element[ne_key] = device[device_key]

    return element

# 创建网络结构，支持多个站点，默认空的ne_names
def create_network(network_name, site_names, ne_names=None):
    db = get_db()
    networks_collection = db.get_collection('networks')

    # 如果 ne_names 为 None，默认设为空列表
    if ne_names is None:
        ne_names = []    
    
    # 为每个站点生成唯一的 key 并创建站点结构
    sites = []
    for site_name in site_names:
        site = {
            "site_id": str(ObjectId()),  # 为站点生成唯一的ID
            "site_name": site_name,
            "elements": []  # 初始化站点的空网络元素（NE）列表
        }

        # 为每个站点添加 elements
        for ne_name in ne_names:
            element = {
                "ne_id": str(ObjectId()), # 为每个元素生成唯一的 
                "ne_name": ne_name,
            }
            site['elements'].append(element)

        sites.append(site)

    # 创建网络结构
    network = {
        "network_id": str(ObjectId()),  # 为网络生成唯一的 key
        "network_name": network_name,  # 使用 network_name 作为网络名称
        "sites": sites,  # 包含多个站点
        "elements": []  # 初始化网络根的空网络元素（NE）列表
    }

    # 为网络根层次添加 elements
    for ne_name in ne_names:
        element = {
            "ne_id": str(ObjectId()),  # 为每个元素生成唯一的 key
            "ne_name": ne_name,
        }
        network['elements'].append(element)

    return networks_collection.insert_one(network).inserted_id

# 添加站点到网络
def add_site_to_network(network_name, site_name):
    db = get_db()
    networks_collection = db.get_collection('networks')

    # 查找网络
    network = networks_collection.find_one({"network_name": network_name})
    if not network:
        return {'status': 'failure', 'message': f'Network {network_name} not found.'}

    # 检查站点名称是否已存在
    for site in network['sites']:
        if site['site_name'] == site_name:
            return {'status': 'failure', 'message': f'Site {site_name} already exists in network {network_name}.'}

    # 为站点生成一个唯一的 key 并添加到网络的 sites 列表
    new_site = {
        "site_id": str(ObjectId()),
        "site_name": site_name,
        "elements": []  # 初始化站点的空网络元素（NE）列表
    }
    network['sites'].append(new_site)

    # 更新网络信息
    result = networks_collection.update_one({"network_name": network_name}, {"$set": network})

    if result.modified_count > 0:
        return {'status': 'success', 'message': f'Site {site_name} added successfully to network {network_name}.'}

# 添加网元到站点
def add_ne_to_site(network_name, site_name, device):
    db = get_db()
    networks_collection = db.get_collection('networks')

    # 查找网络
    network = networks_collection.find_one({"network_name": network_name})
    if not network:
        return {'status': 'failure', 'message': f'Network {network_name} not found.'}

    # 将设备数据转换为数据库格式
    element = convert_device_to_db_format(device)

    # 查找站点并添加设备到站点的 elements 列表
    for site in network['sites']:
        if site['site_name'] == site_name:
            site['elements'].append(element)
            break
    else:
        return {'status': 'failure', 'message': f'Site {site_name} not found in network {network_name}.'}

    # 更新网络信息
    result = networks_collection.update_one({"network_name": network_name}, {"$set": network})
    if result.modified_count > 0:
        return {'status': 'success', 'message': f'NE {element["ne_name"]} added to site {site_name} in network {network_name}.'}
    else:
        return {'status': 'failure', 'message': f'Failed to add NE to site {site_name} in network {network_name}.'}

# 添加网元到网络的根层次
def add_ne_to_network_root(network_name, device):
    db = get_db()
    networks_collection = db.get_collection('networks')

    # 查找网络
    network = networks_collection.find_one({"network_name": network_name})
    if not network:
        return {'status': 'failure', 'message': f'Network {network_name} not found.'}

    # 将设备数据转换为数据库格式
    element = convert_device_to_db_format(device)

    # 添加设备到网络的根 elements 列表
    network['elements'].append(element)

    # 更新网络信息
    result = networks_collection.update_one({"network_name": network_name}, {"$set": network})
    if result.modified_count > 0:
        return {'status': 'success', 'message': f'NE {element["ne_name"]} added to the root level of network {network_name}.'}
    else:
        return {'status': 'failure', 'message': f'Failed to add NE to the root level of network {network_name}.'}

# 查找所有网络
def get_all_networks():
    db = get_db()
    networks_collection = db.get_collection('networks')
    return list(networks_collection.find())

# 查找特定网络
def get_network_by_name(network_name):
    db = get_db()
    networks_collection = db.get_collection('networks')
    return networks_collection.find_one({"network_name": network_name})

# 更新网络名称
def update_network_name(old_name, new_name):
    db = get_db()
    networks_collection = db.get_collection('networks')

    result = networks_collection.update_one(
        {"network_name": old_name},
        {"$set": {"network_name": new_name}}
    )
    return result.modified_count > 0

# 更新站点名称
def update_site_name(network_name, old_site_name, new_site_name):
    db = get_db()
    networks_collection = db.get_collection('networks')

    # 查找指定的网络
    network = networks_collection.find_one({"network_name": network_name})
    if not network:
        return False

    # 查找站点并更新名称
    for site in network['sites']:
        if site['site_name'] == old_site_name:
            site['site_name'] = new_site_name
            break
    else:
        return False  # 未找到站点

    return networks_collection.update_one({"network_name": network_name}, {"$set": network}).modified_count > 0

# 删除某个站点
def delete_site_from_network(network_name, site_name):
    db = get_db()
    networks_collection = db.get_collection('networks')

    # 查找指定的网络
    network = networks_collection.find_one({"network_name": network_name})
    if not network:
        return False

    # 查找并删除站点
    network['sites'] = [site for site in network['sites'] if site['site_name'] != site_name]

    return networks_collection.update_one({"network_name": network_name}, {"$set": network}).modified_count > 0

# 检查特定站点或网络中是否已有相同的设备（通过ne_name）
def ne_exists_in_network(network_name, ne_name):
    db = get_db()
    networks_collection = db.get_collection('networks')

    # 查找网络
    network = networks_collection.find_one({"network_name": network_name})
    if not network:
        return False  # 如果网络不存在，直接返回 False

    # 遍历站点中的设备
    for site in network.get('sites', []):
        for element in site.get('elements', []):
            if 'ne_name' in element and element['ne_name'] == ne_name:
                return True

    # 检查网络根层次的 elements 中是否有相同的 ne_name
    for element in network.get('elements', []):
        if 'ne_name' in element and element['ne_name'] == ne_name:
            return True

    return False  # 如果没有找到相同的设备，返回 False

# 更新网络元素（NE）状态
def update_ne_status(network_name, site_name, ne_name, status):
    db = get_db()
    networks_collection = db.get_collection('networks')

    # 查找指定的网络
    network = networks_collection.find_one({"network_name": network_name})
    if not network:
        return None

    # 更新站点中的设备状态
    for site in network['sites']:
        if site['site_name'] == site_name:
            for ne in site['elements']:
                if ne['ne_name'] == ne_name:
                    ne['status'] = status  # 更新网络元素（NE）状态

    return networks_collection.update_one({"network_name": network_name}, {"$set": network})

# 删除网络
def delete_network(network_name):
    db = get_db()
    networks_collection = db.get_collection('networks')

    return networks_collection.delete_one({"network_name": network_name})