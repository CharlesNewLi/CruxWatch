from flask import Blueprint, render_template, jsonify, request
from models.network import (
    create_network, get_network_by_name, delete_network, 
    add_site_to_network, update_network_name, update_site_name, delete_site_from_network
)
from .ne_mgmt.ne_init import discover_neighbors
from .ne_mgmt.routes import add_device
from services.db import get_db
from services.utils import convert_objectid_to_str
from .network_load import load_data_from_db
from .ne_mgmt.ne_status import check_all_devices
from .global_data import network, devices, topo_data
import logging

network_mgmt_bp = Blueprint('network_mgmt_bp', __name__)

# 创建网络，支持多个站点，并检查站点名称是否重复
@network_mgmt_bp.route('/create', methods=['POST'])
def create_network_route():
    try:
        data = request.json
        network_name = data['network_name']
        site_names = data['site_names']  # 接收多个站点名称

        # 检查是否已有相同名称的网络
        existing_network = get_network_by_name(network_name)
        if existing_network:
            return jsonify({'status': 'failure', 'message': 'Network with this name already exists.'}), 400

        # 检查是否有重复的站点名称
        if len(site_names) != len(set(site_names)):
            return jsonify({'status': 'failure', 'message': 'Duplicate site names are not allowed within the same network.'}), 400

        # 创建新的网络，传递多个站点名称
        network_id = create_network(network_name, site_names)
        
        # 返回 `network_name` 和 `network_id`
        return jsonify({
            'status': 'success', 
            'message': 'Network created successfully.', 
            'network_id': str(network_id),
            'network_name': network_name  # 返回网络名称
        }), 201
    except Exception as e:
        print(f"Error creating network: {e}")
        return jsonify({'status': 'failure', 'message': 'Error creating network.'}), 500

# 获取所有网络
@network_mgmt_bp.route('/', methods=['GET'])
def render_or_get_network_data():
    db = get_db()
    networks_collection = db.get_collection('networks')

    # 查询数据库中的所有网络
    networks = list(networks_collection.find())

    # 构建要返回的数据结构
    networks_data = []
    total_networks = len(networks)  # 网络总数
    total_sites = 0  # 总站点数
    total_nes = 0  # 总网元数
    total_online_sites = 0  # 在线站点数
    total_online_nes = 0  # 在线网元数

    for network in networks:
        network_name = network.get('network_name', '')
        network_id = network.get('network_id', '')  # 获取 network_id
        sites = network.get('sites', [])
        site_count = len(sites)  # 站点数量
        ne_count = sum(len(site.get('elements', [])) for site in sites)  # 每个网络中的网元数量

        # 计算在线的网元数量和在线站点数量
        online_ne_count = 0  # 在线网元数
        online_site_count = 0  # 在线站点数

        for site in sites:
            site_nes = site.get('elements', [])  # 获取每个站点中的网元

            # 计算站点中在线的网元数量
            for ne in site_nes:
                ne_name = ne.get('ne_name', '')
                device_info = devices.get(ne_name, {})

                # 判断该设备是否在线
                if device_info.get('status') == 'online':
                    online_ne_count += 1
                    total_online_nes += 1  # 增加总的在线网元数

            # 如果站点中至少有一个网元在线，则认为站点在线
            if online_ne_count > 0:
                online_site_count += 1
                total_online_sites += 1

        # 构建每个网络的简要信息
        networks_data.append({
            'network_id': network_id,  # 返回 network_id
            'network_name': network_name,  # 返回 network_name
            'site_count': site_count,  # 返回每个网络中的站点数
            'ne_count': ne_count,  # 返回每个网络中的网元数
        })

        total_sites += site_count
        total_nes += ne_count

    # 构建最终的返回数据
    result = {
        'total_networks': total_networks,  # 返回总的网络数
        'total_sites': total_sites,  # 返回总的站点数
        'total_online_sites': total_online_sites,  # 返回总的在线站点数
        'total_nes': total_nes,  # 返回总的网元数
        'total_online_nes': total_online_nes,  # 返回总的在线网元数
        'networks': networks_data  # 每个网络的信息（ID、名称、站点数、网元数）
    }

    # 根据请求的 Accept 头来返回不同的响应
    if request.accept_mimetypes['application/json']:
        # 如果请求的是 JSON 数据，返回 JSON 响应
        return jsonify(result)
    else:
        # 否则返回 HTML 页面
        return render_template('networks.html')

# 获取指定网络管理页面：
@network_mgmt_bp.route('/<network_id>', methods=['GET'])
def auto_boot(network_id):
    # 第一步：加载指定网络的数据到内存（全局变量）
    network_data = load_data_from_db(network_id)
        
    if network_data:
        network_name = network_data.get('network_name')
        
        # 第二步：检查设备状态，发起SNMP连接
        check_all_devices()

        # 构建返回数据
        sites_data = {}
        total_online_nes = 0  # 统计在线设备的数量
        total_sites = 0       # 统计总的站点数
        online_sites_count = 0 # 统计在线站点数

        # 遍历每个设备 - 从已经加载到内存中的全局变量 devices 获取数据
        for device_name, device_data in devices.items():
            site_id = device_data.get('site_id', 'Unknown')
            site_name = device_data.get('site_name', 'Unknown')
            device_status = device_data.get('status', 'offline')

            # 如果站点尚未被添加到 sites_data，则先初始化站点
            if site_id not in sites_data:
                sites_data[site_id] = {
                    'site_id': site_id,
                    'site_name': site_name,
                    'devices': [],
                    'online_nes': 0
                }

            # 添加设备信息到站点的设备列表
            sites_data[site_id]['devices'].append({
                'device_name': device_name,
                'ne_id': device_data.get('ne_id', ''),
                'ip': device_data.get('ip', ''),
                'device_type': device_data.get('device_type', ''),
                'status': device_status
            })

            # 更新在线设备和站点的统计信息
            if device_status == 'online':
                total_online_nes += 1
                sites_data[site_id]['online_nes'] += 1

        total_sites = len(sites_data)
        online_sites_count = sum(1 for site in sites_data.values() if site['online_nes'] > 0)

        # 返回设备数据和拓扑信息
        return jsonify({
            'status': 'success',
            'network_id': network_id,
            'network_name': network_name,
            'devices': devices,  # 直接返回内存中的设备信息
            'topology': topo_data,  # 拓扑数据
            'sites': list(sites_data.values()),  # 站点数据列表
            'total_online_nes': total_online_nes,  # 在线设备总数
            'total_sites': total_sites,  # 站点总数
            'online_sites_count': online_sites_count  # 在线站点数
        })
    else:
        return jsonify({'status': 'failure', 'message': f'Network {network_id} not found'}), 404

# 在特定网络中添加站点，确保站点名称唯一
@network_mgmt_bp.route('/<network_name>/add_site', methods=['POST'])
def add_site_to_network_route(network_name):
    print(f"Received network_name: {network_name}")
    data = request.json
    site_name = data['site_name']

    try:
        # 检查网络是否存在
        network = get_network_by_name(network_name)
        if not network:
            return jsonify({'status': 'failure', 'message': 'Network not found.'}), 404

        # 检查站点名称是否已存在于该网络
        for site in network['sites']:  # 假设 'sites' 是站点的列表
            if site['site_name'] == site_name:
                return jsonify({'status': 'failure', 'message': 'Site with this name already exists in the network.'}), 400

        # 添加站点到网络
        result = add_site_to_network(network_name, site_name)
        if result:
            return jsonify({'status': 'success', 'message': 'Site added successfully.', 'network_name': network_name}), 201
        else:
            return jsonify({'status': 'failure', 'message': 'Failed to add site to network.'}), 500
    except Exception as e:
        print(f"Error adding site to network {network_name}: {e}")
        return jsonify({'status': 'failure', 'message': 'Error adding site to network.'}), 500

# 删除特定网络中的站点
@network_mgmt_bp.route('/<network_name>/<site_name>/delete_site', methods=['POST'])
def delete_site_from_network_route(network_name, site_name):
    # 打印网络名称和站点名称以便调试
    print(f"Network name: {network_name}")
    print(f"Site name: {site_name}")

    # 检查网络是否存在
    network = get_network_by_name(network_name)
    if not network:
        print(f"Network '{network_name}' not found.")
        return jsonify({'status': 'failure', 'message': 'Network not found.'}), 404

    # 删除站点
    result = delete_site_from_network(network_name, site_name)
    if result:
        print(f"Site '{site_name}' in network '{network_name}' deleted successfully.")
        return jsonify({'status': 'success', 'message': 'Site deleted successfully.', 'network_name': network_name}), 200
    else:
        print(f"Failed to delete site '{site_name}' in network '{network_name}'.")
        return jsonify({'status': 'failure', 'message': 'Failed to delete site.'}), 500

# 更新网络名称，确保新名称唯一
@network_mgmt_bp.route('/<network_name>/update_name', methods=['POST'])
def update_network_name_route(network_name):
    data = request.json
    new_name = data['new_name']

    # 检查新名称是否已存在
    existing_network = get_network_by_name(new_name)
    if existing_network:
        return jsonify({'status': 'failure', 'message': 'Network with this name already exists.'}), 400

    # 更新网络名称
    result = update_network_name(network_name, new_name)
    if result:
        return jsonify({'status': 'success', 'message': 'Network name updated successfully.', 'network_name': new_name}), 200
    else:
        return jsonify({'status': 'failure', 'message': 'Failed to update network name.'}), 500

# 更新站点名称，确保新名称在同一网络中唯一
@network_mgmt_bp.route('/<network_name>/<site_name>/update_name', methods=['POST'])
def update_site_name_route(network_name, site_name):
    data = request.json
    new_name = data['new_name']

    # 检查网络是否存在
    network = get_network_by_name(network_name)
    if not network:
        return jsonify({'status': 'failure', 'message': 'Network not found.'}), 404

       # 检查新站点名称是否已存在于该网络
    for site in network['sites']:
        if site['site_name'] == new_name:
            return jsonify({'status': 'failure', 'message': 'Site with this name already exists in the network.'}), 400

    # 更新站点名称
    result = update_site_name(network_name, site_name, new_name)
    if result:
        return jsonify({'status': 'success', 'message': 'Site name updated successfully.', 'network_name': network_name}), 200
    else:
        return jsonify({'status': 'failure', 'message': 'Failed to update site name.'}), 500

# 发现设备并更新网络
@network_mgmt_bp.route('/<network_name>/NEs/discover', methods=['POST'])
def discover_nes(network_name):
    data = request.json
    site_name = data['site_name']

    # 检查网络是否存在
    network = get_network_by_name(network_name)
    if not network:
        return jsonify({'status': 'failure', 'error': 'Network not found.'}), 404

    # 假设 discover_neighbors 返回一个邻居设备列表
    neighbors = discover_neighbors(network)

    # 将发现的设备交由设备管理路由处理
    for neighbor in neighbors:
        add_device(neighbor)  # 调用网元管理中的函数，进行设备的具体管理操作

    # 将设备信息更新到网络结构中
    for site in network['sites']:
        if site['site_name'] == site_name:
            site['NEs'].extend(neighbors)
            break

    # 更新数据库中的网络结构
    update_result = update_site_name(network_name, site_name, site_name)  # 假设这也会更新设备
    if update_result:
        return jsonify({'status': 'success', 'NEs': neighbors, 'network_name': network_name}), 200
    else:
        return jsonify({'status': 'failure', 'error': 'Failed to update network with discovered devices.'}), 500

# 删除网络
@network_mgmt_bp.route('/delete', methods=['POST'])
def delete_network_route():
    data = request.json
    network_name = data['network_name']

    # 删除指定的网络
    delete_result = delete_network(network_name)
    if delete_result:
        return jsonify({'status': 'success', 'message': 'Network deleted successfully.', 'network_name': network_name}), 200
    else:
        return jsonify({'status': 'failure', 'message': 'Failed to delete network.'}), 500

# 显示网络中的网元元素页面
@network_mgmt_bp.route('/<network_name>/elements', methods=['GET'])
def network_elements_page(network_name):
    return render_template('elements.html', network_name=network_name)
