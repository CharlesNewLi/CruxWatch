from services.db import get_db
from bson import ObjectId
import logging

# 将设备数据转换为数据库格式
def convert_device_to_db_format(device):
    key_mapping = {
        'device_name': 'ne_name',
        'device_type': 'ne_make',
        'ip': 'ne_ip',
        'gne': 'gne',
        'ssh_username': 'ssh_username',
        'ssh_password': 'ssh_password',
        'snmp_username': 'snmp_username',
        'snmp_auth_password': 'snmp_auth_password',
        'snmp_auth_protocol': 'snmp_auth_protocol',
        'snmp_priv_password': 'snmp_priv_password',
        'snmp_priv_protocol': 'snmp_priv_protocol',
    }
    
    # 转换设备信息
    element = {'ne_id': str(ObjectId())}
    for device_key, ne_key in key_mapping.items():
        if device_key in device:
            element[ne_key] = device[device_key]

    return element

# 创建网络结构，支持多个站点，默认空的ne_names和site_location
def create_network(network_name, site_names, ne_names=None, site_locations=None):
    db = get_db()
    networks_collection = db.get_collection('networks')

    # 如果 ne_names 为 None，默认设为空列表
    if ne_names is None:
        ne_names = []

    # 如果 site_locations 为 None，默认设为空列表
    if site_locations is None:
        site_locations = [''] * len(site_names)

    # 为每个站点生成唯一的 key 并创建站点结构
    sites = []
    for site_name, site_location in zip(site_names, site_locations):
        site = {
            "site_id": str(ObjectId()),  # 为站点生成唯一的ID
            "site_name": site_name,
            "site_location": site_location,  # 初始化站点的地理位置字段
            "elements": []  # 初始化站点的空网络元素（NE）列表
        }

        # 仅当 ne_names 不为空时，才为站点添加 elements
        for ne_name in ne_names:
            if ne_name:  # 确保 ne_name 有效
                element = {
                    "ne_id": str(ObjectId()), # 为每个元素生成唯一的ID
                    "ne_name": ne_name,
                }
                site['elements'].append(element)

        sites.append(site)

    # 创建网络结构
    network = {
        "network_id": str(ObjectId()),  # 为网络生成唯一的 key
        "network_name": network_name,  # 使用 network_name 作为网络名称
        "sites": sites,  # 包含多个站点
        "elements": [],  # 初始化网络根的空网络元素（NE）列表
        "topo_data": {
            "nodes": [],  # 初始化节点列表
            "edges": []   # 初始化连接列表
        }
    }

    # 为网络根层次添加 elements
    for ne_name in ne_names:
        if ne_name:  # 确保 ne_name 有效
            element = {
                "ne_id": str(ObjectId()),  # 为每个元素生成唯一的 key
                "ne_name": ne_name,
            }
            network['elements'].append(element)

    return networks_collection.insert_one(network).inserted_id

# 添加站点到网络
def add_site_to_network(network_name, site_name, site_location=""):
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
        "site_location": site_location,  # 初始化站点的地理位置字段
        "elements": []  # 初始化站点的空网络元素（NE）列表
    }

    network['sites'].append(new_site)

    # 更新网络信息
    result = networks_collection.update_one({"network_name": network_name}, {"$set": network})

    if result.modified_count > 0:
        return {'status': 'success', 'message': f'Site {site_name} added successfully to network {network_name}.'}

# 添加或移动网元到指定站点
def move_ne_to_site(network_name, ne_name, new_site_name, action_type):
    db = get_db()
    networks_collection = db.get_collection('networks')

    # 查找网络
    network = networks_collection.find_one({"network_name": network_name})
    
    # 变量用于存储要移动的网元以及它的当前站点
    element_to_move = None
    current_site = None

    # 如果是 Join Site 操作，从网络根的 elements 列表中查找网元
    if action_type == 'Join Site':
        for element in network['elements']:
            if element.get('ne_name') == ne_name:
                element_to_move = element
                break

        if not element_to_move:
            return {'status': 'failure', 'message': f'NE {ne_name} not found in network-level elements.'}
    
    # 如果是 Change Site 操作，从各个站点中查找网元
    elif action_type == 'Change Site':
        for site in network['sites']:
            for element in site['elements']:
                if element.get('ne_name') == ne_name:
                    current_site = site
                    element_to_move = element
                    break
            if current_site:
                break

        if not current_site or not element_to_move:
            return {'status': 'failure', 'message': f'NE {ne_name} not found in any site of network {network_name}.'}
    
    # 查找目标站点
    target_site = next((site for site in network['sites'] if site['site_name'] == new_site_name), None)
    if not target_site:
        return {'status': 'failure', 'message': f'Site {new_site_name} not found in network {network_name}.'}

    # 检查目标站点中是否已经存在该网元
    for element in target_site['elements']:
        if element.get('ne_name') == ne_name:
            return {'status': 'failure', 'message': f'NE {ne_name} already exists in site {new_site_name}.'}

    # 如果是 Change Site 操作，从当前站点中移除网元
    if action_type == 'Change Site':
        current_site['elements'] = [el for el in current_site['elements'] if el.get('ne_name') != ne_name]
    
    # 如果是 Join Site 操作，从网络根的 elements 列表中移除网元
    elif action_type == 'Join Site':
        network['elements'] = [el for el in network['elements'] if el.get('ne_name') != ne_name]

    # 将网元添加到目标站点
    target_site['elements'].append(element_to_move)

    # 更新网络信息
    result = networks_collection.update_one(
        {"network_name": network_name},
        {"$set": {"sites": network['sites'], "elements": network['elements']}}
    )

    if result.modified_count > 0:
        return {'status': 'success', 'message': f'NE {ne_name} successfully moved to site {new_site_name}.'}
    else:
        return {'status': 'failure', 'message': f'Failed to move NE {ne_name} to site {new_site_name}.'}

# 移除网元从站点并返回完整的 element 对象
def remove_ne_from_site(network_name, ne_name):
    db = get_db()
    networks_collection = db.get_collection('networks')

    # 查找网络
    network = networks_collection.find_one({"network_name": network_name})
    if not network:
        return {'status': 'failure', 'message': f'Network {network_name} not found.'}

    # 遍历站点，找到并移除网元
    for site in network['sites']:
        print(f"Checking site: {site['site_name']}, current elements: {site['elements']}")
        original_count = len(site['elements'])

        # 查找网元
        for element in site['elements']:
            if element.get('ne_name') == ne_name:
                element_to_remove = element
                break
        else:
            continue  # 如果没有找到，跳到下一个站点

        # 移除网元
        site['elements'] = [el for el in site['elements'] if el.get('ne_name') != ne_name]

        # 如果网元确实存在并被移除，则更新数据库
        if original_count != len(site['elements']):
            print(f"NE {ne_name} removed from site {site['site_name']}.")
            result = networks_collection.update_one({"_id": network['_id']}, {"$set": {'sites': network['sites']}})
            if result.modified_count > 0:
                return {'status': 'success', 'element': element_to_remove, 'message': f'NE {ne_name} removed from site {site["site_name"]}.'}
            else:
                print(f"Error: Failed to update site {site['site_name']} after removing NE {ne_name}.")
                return {'status': 'failure', 'message': 'Failed to remove NE from the site.'}

    return {'status': 'failure', 'message': f'NE {ne_name} not found in any site.'}

def add_ne_to_network_root(network_name, element):
    db = get_db()
    networks_collection = db.get_collection('networks')

    # 查找网络
    network = networks_collection.find_one({"network_name": network_name})
    if not network:
        return {'status': 'failure', 'message': f'Network {network_name} not found.'}

    # 确保网元不在根目录
    for el in network['elements']:
        if el.get('ne_name') == element.get('ne_name'):
            return {'status': 'failure', 'message': f'NE {element["ne_name"]} already exists in network root.'}

    # 将网元添加到网络根目录
    network['elements'].append(element)

    # 更新网络信息
    result = networks_collection.update_one(
        {"_id": network['_id']},
        {"$set": {"elements": network['elements']}}
    )

    if result.modified_count > 0:
        return {'status': 'success', 'message': f'NE {element["ne_name"]} added to network root.'}
    else:
        return {'status': 'failure', 'message': f'Failed to add NE {element["ne_name"]} to network root.'}

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

# 将更新后的拓扑数据存储到数据库中的对应网络
def save_topology_to_db(network_name, topo_data):
    try:
        db = get_db()
        network_collection = db.get_collection('networks')

        # 更新网络的 topo_data 字段
        result = network_collection.update_one(
            {"network_name": network_name},  # 查找条件
            {"$set": {"topo_data": topo_data}}  # 更新拓扑数据
        )

        if result.matched_count > 0:
            logging.info(f"Successfully updated topology data for network: {network_name}")
            return {'status': 'success', 'message': f'Topology data updated successfully for network {network_name}'}
        else:
            logging.warning(f"Network {network_name} not found.")
            return {'status': 'failure', 'message': f'Network {network_name} not found.'}

    except Exception as e:
        logging.error(f"Failed to update topology data for network {network_name}: {str(e)}")
        return {'status': 'failure', 'message': f'Failed to update topology data: {str(e)}'}

# 删除网络
def delete_network(network_name):
    db = get_db()
    networks_collection = db.get_collection('networks')

    return networks_collection.delete_one({"network_name": network_name})
