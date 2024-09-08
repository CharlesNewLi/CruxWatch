from flask import Blueprint, render_template, jsonify, request
from models.network import (
    create_network, get_all_networks, get_network_by_name, delete_network, 
    add_site_to_network, update_network_name, update_site_name, delete_site_from_network
)
from .ne_mgmt.hw_disc import discover_neighbors
from .ne_mgmt.routes import add_device
from services.utils import convert_objectid_to_str

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
        return jsonify({'status': 'success', 'message': 'Network created successfully.', 'network_id': str(network_id)}), 201
    except Exception as e:
        print(f"Error creating network: {e}")
        return jsonify({'status': 'failure', 'message': 'Error creating network.'}), 500

# 获取所有网络
# 渲染页面
@network_mgmt_bp.route('/', methods=['GET'])
def render_networks_page():
    return render_template('networks.html')

# 获取所有网络的 JSON 数据
@network_mgmt_bp.route('/data', methods=['GET'])
def get_networks_data():
    networks = get_all_networks()
    networks = convert_objectid_to_str(networks)
    print(f"Retrieved networks from database: {networks}")
    return jsonify(networks), 200

# 在特定网络中添加站点，确保站点名称唯一
@network_mgmt_bp.route('/<network_name>/add_site', methods=['POST'])
def add_site_to_network_route(network_name):
    data = request.json
    site_name = data['site_name']

    # 检查网络是否存在
    network = get_network_by_name(network_name)
    if not network:
        return jsonify({'status': 'failure', 'message': 'Network not found.'}), 404

    # 检查站点名称是否已存在于该网络
    for site in network['children']:  # 假设 'children' 是站点的列表
        if site['title'] == site_name:
            return jsonify({'status': 'failure', 'message': 'Site with this name already exists in the network.'}), 400

    # 添加站点到网络
    result = add_site_to_network(network_name, site_name)
    return jsonify({'status': 'success', 'message': 'Site added successfully.'}), 201

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
        return jsonify({'status': 'success', 'message': 'Site deleted successfully.'}), 200
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
        return jsonify({'status': 'success', 'message': 'Network name updated successfully.'}), 200
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
    for site in network['children']:
        if site['title'] == new_name:
            return jsonify({'status': 'failure', 'message': 'Site with this name already exists in the network.'}), 400

    # 更新站点名称
    result = update_site_name(network_name, site_name, new_name)
    if result:
        return jsonify({'status': 'success', 'message': 'Site name updated successfully.'}), 200
    else:
        return jsonify({'status': 'failure', 'message': 'Failed to update site name.'}), 500

# 发现设备并更新网络
@network_mgmt_bp.route('/<network_name>/NEs/discover', methods=['POST'])
def discover_nes(network_name):
    data = request.json
    site_name = data['site_name']

    network = get_network_by_name(network_name)
    if not network:
        return jsonify({'status': 'failure', 'error': 'Network not found.'}), 404

    # 假设 discover_neighbors 返回一个邻居设备列表
    neighbors = discover_neighbors(network)

    # 将发现的设备交由设备管理路由处理
    for neighbor in neighbors:
        add_device(neighbor)  # 调用网元管理中的函数，进行设备的具体管理操作

    # 将设备信息更新到网络结构中
    network['children'][0]['NEs'].extend(neighbors)

    return jsonify({'status': 'success', 'NEs': neighbors}), 200

# 删除网络
@network_mgmt_bp.route('/delete', methods=['POST'])
def delete_network_route():
    data = request.json
    network_name = data['network_name']
    delete_network(network_name)
    return jsonify({'status': 'success', 'message': 'Network deleted successfully.'}), 200

@network_mgmt_bp.route('/<network_name>/elements', methods=['GET'])
def network_elements_page(network_name):
    return render_template('elements.html', network_name=network_name)