from services.db import get_db
import uuid

# Helper function to convert device data into database format (db_element)
def convert_device_to_db_format(device):
    """
    Convert the network device data to match the database's naming conventions.
    """
    element = {
        'ne_make': device['device_type'],  # 将 device_type 转换为 ne_make
        'ne_name': device['device_name'],         # 将 device_name 转换为 ne_name
        'ssh_ip': device['ssh_ip'],        # ssh_ip 不变
        'ssh_username': device['ssh_username'],
        'ssh_password': device['ssh_password'],
        'ssh_secret': device['ssh_secret'],
        'session_log': device['session_log'],
        'verbose': device['verbose'],
        'global_delay_factor': device['global_delay_factor'],
        'gne': device['gne']  # 假设 gne 不需要转换
    }
    return element

# 创建网络结构，支持多个站点
def create_network(network_name, site_names):
    db = get_db()
    networks_collection = db.get_collection('networks')

    # 为每个站点生成唯一的 key 并创建站点结构
    sites = []
    for site_name in site_names:
        site = {
            "site_name": site_name,
            "key": str(uuid.uuid4()),  # 为站点生成唯一的 key
            "children": []  # 初始化站点的空网络元素（NE）列表
        }
        sites.append(site)

    # 创建网络结构
    network = {
        "network_name": network_name,  # 使用 network_name 作为网络名称
        "key": str(uuid.uuid4()),  # 为网络生成唯一的 key
        "children": sites  # 包含多个站点
    }
    
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
    for site in network['children']:
        if site['site_name'] == site_name:
            return {'status': 'failure', 'message': f'Site {site_name} already exists in network {network_name}.'}

    # 为站点生成一个唯一的 key 并添加到网络的 children 列表
    new_site = {
        "site_name": site_name,
        "key": str(uuid.uuid4()),
        "children": []  # 初始化站点的空网络元素（NE）列表
    }
    network['children'].append(new_site)

    # 更新网络信息
    result = networks_collection.update_one({"network_name": network_name}, {"$set": network})

    if result.modified_count > 0:
        return {'status': 'success', 'message': f'Site {site_name} added successfully to network {network_name}.'}
    else:
        return {'status': 'failure', 'message': f'Failed to add site {site_name} to network {network_name}.'}

# 添加网元到特定站点
def add_ne_to_site(network_name, site_name, device):
    db = get_db()
    networks_collection = db.get_collection('networks')

    # 查找网络
    network = networks_collection.find_one({"network_name": network_name})
    if not network:
        return None

    # 将设备数据转换为数据库格式
    element = convert_device_to_db_format(device)

    # 查找站点并添加设备到站点的 children 列表
    for site in network['children']:
        if site['site_name'] == site_name:
            site['children'].append(element)
            break

    return networks_collection.update_one({"network_name": network_name}, {"$set": network}).modified_count > 0

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
    for site in network['children']:
        if site['site_name'] == old_site_name:
            site['site_name'] = new_site_name
            break
    else:
        return False  # 未找到站点

    # 更新站点名称
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
    network['children'] = [site for site in network['children'] if site['site_name'] != site_name]

    return networks_collection.update_one({"network_name": network_name}, {"$set": network}).modified_count > 0

# 检查特定站点或网络中是否已有相同的设备（通过ne_name）
def ne_exists_in_network(network_name, ne_name):
    db = get_db()
    networks_collection = db.get_collection('networks')

    # 查找网络
    network = networks_collection.find_one({"network_name": network_name})
    if not network:
        return False  # 如果网络不存在，直接返回 False

    # 确保 network['children'] 字段存在
    if 'children' not in network:
        return False  # 如果没有 children 字段，说明没有设备

    # 遍历网络中的所有站点
    for site in network['children']:
        # 如果站点没有 'children' 字段，跳过
        if 'children' not in site:
            continue

        # 遍历每个站点下的设备，检查 ne_name
        for element in site['children']:
            if 'ne_name' in element and element['ne_name'] == ne_name:
                return True

    # 检查网络的根 children 中是否有相同的 ne_name
    for element in network.get('children', []):
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

    for site in network['children']:
        if site['site_name'] == site_name:
            for ne in site['children']:
                if ne['ne_name'] == ne_name:
                    ne['status'] = status  # 更新网络元素（NE）状态

    return networks_collection.update_one({"network_name": network_name}, {"$set": network})

# 删除网络
def delete_network(network_name):
    db = get_db()
    networks_collection = db.get_collection('networks')

    return networks_collection.delete_one({"network_name": network_name})