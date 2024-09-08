from services.db import get_db
import uuid

# 创建网络结构，支持多个站点
def create_network(network_name, site_names):
    db = get_db()
    networks_collection = db.get_collection('networks')

    # 为每个站点生成唯一的 key 并创建站点结构
    sites = []
    for site_name in site_names:
        site = {
            "title": site_name,
            "key": str(uuid.uuid4()),  # 为站点生成唯一的 key
            "children": []  # 初始化站点的空网络元素（NE）列表
        }
        sites.append(site)

    # 创建网络结构
    network = {
        "title": network_name,  # 使用 title 作为网络名称
        "key": str(uuid.uuid4()),  # 为网络生成唯一的 key
        "children": sites  # 包含多个站点
    }
    
    return networks_collection.insert_one(network).inserted_id

# 添加站点到网络
def add_site_to_network(network_name, site_name):
    db = get_db()
    networks_collection = db.get_collection('networks')

    # 查找网络
    network = networks_collection.find_one({"title": network_name})
    if not network:
        return None

    # 为站点生成一个唯一的 key 并添加到网络的 children 列表
    new_site = {
        "title": site_name,
        "key": str(uuid.uuid4()),
        "children": []  # 初始化站点的空网络元素（NE）列表
    }
    network['children'].append(new_site)

    return networks_collection.update_one({"title": network_name}, {"$set": network}).modified_count > 0

# 查找所有网络
def get_all_networks():
    db = get_db()
    networks_collection = db.get_collection('networks')

    return list(networks_collection.find())

# 查找特定网络
def get_network_by_name(network_name):
    db = get_db()
    networks_collection = db.get_collection('networks')

    return networks_collection.find_one({"title": network_name})

# 更新网络名称
def update_network_name(old_name, new_name):
    db = get_db()
    networks_collection = db.get_collection('networks')

    result = networks_collection.update_one(
        {"title": old_name},
        {"$set": {"title": new_name}}
    )
    return result.modified_count > 0

# 更新站点名称
def update_site_name(network_name, old_site_name, new_site_name):
    db = get_db()
    networks_collection = db.get_collection('networks')

    # 查找指定的网络
    network = networks_collection.find_one({"title": network_name})
    if not network:
        return False

    # 查找站点并更新名称
    for site in network['children']:
        if site['title'] == old_site_name:
            site['title'] = new_site_name
            break
    else:
        return False  # 未找到站点

    # 更新站点名称
    return networks_collection.update_one({"title": network_name}, {"$set": network}).modified_count > 0

# 删除某个站点
def delete_site_from_network(network_name, site_name):
    db = get_db()
    networks_collection = db.get_collection('networks')

    # 查找指定的网络
    network = networks_collection.find_one({"title": network_name})
    if not network:
        return False

    # 查找并删除站点
    network['children'] = [site for site in network['children'] if site['title'] != site_name]

    return networks_collection.update_one({"title": network_name}, {"$set": network}).modified_count > 0

# 更新网络元素（NE）状态
def update_ne_status(network_name, site_name, ne_name, status):
    db = get_db()
    networks_collection = db.get_collection('networks')

    # 查找指定的网络
    network = networks_collection.find_one({"title": network_name})
    if not network:
        return None

    for site in network['children']:
        if site['title'] == site_name:
            for ne in site['children']:
                if ne['title'] == ne_name:
                    ne['status'] = status  # 更新网络元素（NE）状态

    return networks_collection.update_one({"title": network_name}, {"$set": network})

# 删除网络
def delete_network(network_name):
    db = get_db()
    networks_collection = db.get_collection('networks')

    return networks_collection.delete_one({"title": network_name})