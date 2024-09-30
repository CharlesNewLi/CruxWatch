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
def get_networks():
    db = get_db()
    networks_collection = db.get_collection('networks')

    # 查询数据库中的所有网络
    networks = list(networks_collection.find())

    # 初始化统计信息
    total_networks = len(networks)  # 网络总数
    total_sites = 0  # 总站点数
    total_nes = 0  # 总网元数
    networks_data = []

    # 构建每个网络的详细信息
    for network in networks:
        network_name = network.get('network_name', '')
        network_id = network.get('network_id', '')  # 获取 network_id
        isLocked = network.get('isLocked', True)
        sites = network.get('sites', [])  # 获取网络中的站点
        elements = network.get('elements', {})  # 获取网络中的网元信息

        # 计算站点数和网元数
        site_count = len(sites)  # 每个网络的站点数
        ne_count = len(elements)  # 每个网络的网元数

        # 更新总站点数和网元数的统计
        total_sites += site_count
        total_nes += ne_count

        # 构建每个网络的简要信息
        networks_data.append({
            'network_id': network_id,
            'network_name': network_name,
            'isLocked': isLocked,
            'site_count': site_count,  # 返回每个网络的站点数
            'ne_count': ne_count,  # 返回每个网络的网元数
        })

    # 构建最终的返回数据
    result = {
        'total_networks': total_networks,  # 返回总的网络数
        'total_sites': total_sites,  # 返回总的站点数
        'total_nes': total_nes,  # 返回总的网元数
        'networks': networks_data  # 每个网络的信息（ID、名称、站点数、网元数）
    }

    # 返回 JSON 响应给前端
    return jsonify(result)

# 获取指定网络管理页面
@network_mgmt_bp.route('/<network_id>', methods=['GET'])
def get_network_by_id(network_id):
    db = get_db()
    networks_collection = db.get_collection('networks')

    # 从数据库中加载指定网络的数据
    network_data = networks_collection.find_one({'network_id': network_id})

    if network_data:
        network_name = network_data.get('network_name')

        # 直接返回数据库中的设备数据和拓扑信息
        return jsonify({
            'status': 'success',
            'network_id': network_id,
            'network_name': network_name,
            'isLocked': network_data.get('isLocked', True),
            'elements': network_data.get('elements', {}),  # 直接返回数据库中的设备信息
            'topology': network_data.get('topology', {}),  # 直接返回拓扑数据
            'sites': network_data.get('sites', [])  # 返回站点数据
        })
    else:
        return jsonify({'status': 'failure', 'message': f'Network {network_id} not found'}), 404

# 保存前端创建好的网络到 MongoDB 数据库
@network_mgmt_bp.route('/<network_id>', methods=['POST'])
def save_network_to_db(network_id):
    try:
        db = get_db()
        network_collection = db.get_collection('networks')

        # 获取前端传递的请求数据
        request_data = request.json
        if not request_data:
            raise ValueError("No data provided")

        # 打印收到的数据
        print(f"Received data for network {network_id}: {request_data}")

        # 从 request_data 中提取 networkDetails
        network_details = request_data.get('networkDetails', {})

        # 从 networkDetails 中提取相关字段
        network_name = network_details.get('network_name', '')
        ne_count = network_details.get('ne_count', 0)
        online_ne_count = network_details.get('online_ne_count', 0)
        site_count = network_details.get('site_count', 0)
        isLocked = network_details.get('isLocked', True)
        sites = network_details.get('sites', [])
        topology = network_details.get('topology', {})
        elements = network_details.get('elements', {})

        # 使用 print 打印解析后的字段
        print(f"Parsed network_name: {network_name}")
        print(f"Parsed ne_count: {ne_count}, online_ne_count: {online_ne_count}, site_count: {site_count}")
        print(f"Parsed sites: {sites}")
        print(f"Parsed topology: {topology}")
        print(f"Parsed elements: {elements}")

        # 确保网络名称存在
        if not network_name:
            raise ValueError("Network name is required")

        # 更新网络文档，直接将数据写入到根层级
        network_collection.update_one(
            {'network_id': network_id},
            {
                '$set': {
                    'network_name': network_name,
                    'ne_count': ne_count,
                    'online_ne_count': online_ne_count,
                    'site_count': site_count,
                    'isLocked': isLocked,
                    'sites': sites,
                    'topology': topology,
                    'elements': elements  # 更新 elements 字段
                }
            },
            upsert=True  # 如果网络不存在，则插入一个新文档
        )

        print(f"Saved network {network_id} details and elements to MongoDB.")
        return jsonify({'status': 'success', 'message': f'Network {network_id} saved successfully.'}), 200

    except ValueError as ve:
        print(f"Validation error: {str(ve)}")
        return jsonify({'status': 'failure', 'error': str(ve)}), 400

    except Exception as e:
        print(f"Failed to save network {network_id} to MongoDB: {str(e)}")
        return jsonify({'status': 'failure', 'error': f'Failed to save network {network_id} to database: {str(e)}'}), 500

# 删除 MongoDB 数据库中相应的网络
@network_mgmt_bp.route('/<network_id>', methods=['DELETE'])
def delete_network_from_db(network_id):
    try:
        db = get_db()
        network_collection = db.get_collection('networks')

        # 查找并删除指定的网络
        result = network_collection.delete_one({'network_id': network_id})

        if result.deleted_count == 0:
            return jsonify({'status': 'failure', 'message': f'Network {network_id} not found'}), 404

        print(f"Deleted network {network_id} from MongoDB.")
        return jsonify({'status': 'success', 'message': f'Network {network_id} deleted successfully.'}), 200

    except Exception as e:
        print(f"Failed to delete network {network_id} from MongoDB: {str(e)}")
        return jsonify({'status': 'failure', 'error': f'Failed to delete network {network_id} from database: {str(e)}'}), 500

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
