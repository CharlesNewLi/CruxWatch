from flask import Blueprint, render_template, jsonify, request
from .hw_disc import (
    get_snmpv3_data, discover_neighbors, query_device_via_gateway, is_valid_ip, 
    filter_ssh_params, devices
)
from netmiko import ConnectHandler
from services.db import get_db
from services.utils import convert_objectid_to_str
from models.network import convert_device_to_db_format, ne_exists_in_network
from bson import ObjectId

# 自定义的 JSON 转换器，用来将 ObjectId 转换为字符串
def convert_objectid_in_dict(doc):
    """
    递归地将文档中的 ObjectId 转换为字符串格式。
    适用于 dict 和 list 类型的文档。
    """
    if isinstance(doc, list):
        return [convert_objectid_in_dict(item) for item in doc]
    elif isinstance(doc, dict):
        return {key: (str(value) if isinstance(value, ObjectId) else convert_objectid_in_dict(value)) for key, value in doc.items()}
    else:
        return doc

ne_mgmt_bp = Blueprint('ne_mgmt_bp', __name__)

# 获取当前网络中的所有网元信息
@ne_mgmt_bp.route('/<network_name>/elements')
def nes_page(network_name):
    return render_template('elements.html', network_name=network_name, elements=devices)

ne_mgmt_bp = Blueprint('ne_mgmt_bp', __name__)

# 添加网元到特定网络或站点
@ne_mgmt_bp.route('/<network_name>/elements/add', methods=['POST'])
def add_device(network_name):
    data = request.json
    site_name = data.get('site_name', None)  # 获取 site_name (可选)
    print("Received data from frontend:", data)  # 打印接收到的前端数据

    ne_name = data['ne_name']

    # 准备设备信息
    gne_device = {
        'device_type': data['ne_make'],
        'device_name': ne_name,
        'ssh_ip': data['ssh_ip'],
        'ssh_username': data['ssh_username'],
        'ssh_password': data['ssh_password'],
        'ssh_secret': data.get('ssh_secret', ''),
        'session_log': f'session_log_{ne_name}.txt',
        'verbose': True,
        'global_delay_factor': 2,
        'gne': data['ssh_ip']
    }

    # SSH 连接到网元
    connection = ConnectHandler(**filter_ssh_params(gne_device))
    connection.disconnect()

    # 将设备信息转换为数据库格式
    element = convert_device_to_db_format(gne_device)
    print(f"Prepared element for database insertion: {element}")  # 插入之前打印设备信息

    devices[ne_name] = element
    print("Updated local elements:", devices)  # 更新本地存储的设备数据

    # 获取数据库连接
    db = get_db()
    network_collection = db.get_collection('networks')
    network = network_collection.find_one({'network_name': network_name})

     # 检查设备是否已经存在
    if ne_exists_in_network(network_name, ne_name):
        return jsonify({'status': 'failure', 'message': f'Device {ne_name} already exists in network {network_name}.'}), 400

    # 如果 network 没有 'children' 字段，创建它
    if 'children' not in network:
        network['children'] = []

    # 如果指定了 site_name，确保该站点下的 'children' 字段存在
    if site_name:
        site = next((site for site in network['children'] if site['site_name'] == site_name), None)
        if not site:
            return jsonify({'status': 'failure', 'message': f'Site {site_name} not found in network {network_name}.'}), 404

        if 'children' not in site:
            site['children'] = []

        # 将新设备插入站点
        site['children'].append(gne_device)
    else:
        # 如果没有指定 site_name，将设备插入网络的根 children
        network['children'].append(gne_device)

    # 更新数据库中的网络信息
    network_collection.update_one({'_id': network['_id']}, {'$set': {'children': network['children']}})
    print(f"Updated network {network_name} with device {ne_name}")

    # 返回成功响应
    updated_network = network_collection.find_one({'network_name': network_name})
    converted_elements = {key: convert_objectid_in_dict(value) for key, value in devices.items()}

    # 返回整个网络的设备信息给前端
    return jsonify({
        'status': 'success', 
        'message': f'Device {ne_name} added successfully to network {network_name}.', 
        'network': convert_objectid_in_dict(updated_network),  # 确保将最新网络数据返回
        'devices': list(converted_elements.values())  # 本地存储的网元数据
    }), 201


# 更新网元的 site 归属
@ne_mgmt_bp.route('/<network_name>/elements/update_site', methods=['POST'])
def update_device_site(network_name):
    data = request.json
    ne_name = data['ne_name']
    new_site_name = data['new_site_name']  # 要移动到的新站点名称
    print(f"Updating site for {ne_name} in network {network_name} to {new_site_name}")

    db = get_db()
    network_collection = db.get_collection('networks')
    network = network_collection.find_one({'network_name': network_name})
    if not network:
        return jsonify({'status': 'failure', 'error': f'Network {network_name} not found.'}), 404

    # 查找设备是否在网络的 children 中
    device_in_children = next((device for device in network.get('children', []) if device['device_name'] == ne_name), None)
    if device_in_children:
        # 移动设备到新站点
        site = next((site for site in network.get('sites', []) if site['site_name'] == new_site_name), None)
        if not site:
            return jsonify({'status': 'failure', 'error': f'Site {new_site_name} not found in network {network_name}.'}), 404

        site.setdefault('elements', []).append(device_in_children)
        network['children'] = [device for device in network['children'] if device['device_name'] != ne_name]  # 从 children 中删除设备
        network_collection.update_one({'_id': ObjectId(network['_id'])}, {'$set': {'sites': network['sites'], 'children': network.get('children', [])}})

        print(f"Moved device {ne_name} to site {new_site_name}")
        return jsonify({'status': 'success', 'message': f'Device {ne_name} moved to site {new_site_name}.'}), 200
    else:
        return jsonify({'status': 'failure', 'error': f'Device {ne_name} not found in network {network_name} children.'}), 404

# 设置 SNMP 配置
@ne_mgmt_bp.route('/<network_name>/<ne_name>/set_snmp', methods=['POST'])
def set_snmp(network_name):
    data = request.json
    ne_name = data.get('ne_name')
    device = devices.get(ne_name)
    if device:
        device.update({
            'snmp_ip': data['snmp_ip'],
            'snmp_username': data['snmp_username'],
            'snmp_auth_protocol': data['snmp_auth_protocol'],
            'snmp_auth_password': data['snmp_auth_password'],
            'snmp_priv_protocol': data['snmp_priv_protocol'],
            'snmp_priv_password': data['snmp_priv_password'],
        })

        try:
            snmp_data = get_snmpv3_data(device)
            
            # 更新数据库中的设备信息
            db = get_db()
            elements_collection = db.get_collection('elements')
            elements_collection.update_one(
                {'_id': ObjectId(device['_id'])},
                {'$set': device}  # 更新数据库中的数据
            )

            return jsonify({'status': 'success', 'message': 'SNMP setup successful.', 'snmp_data': snmp_data, 'devices': list(devices.values())}), 200
        except Exception as e:
            return jsonify({'status': 'failure', 'error': f'SNMP setup failed: {str(e)}'}), 500
    else:
        return jsonify({'status': 'failure', 'error': 'NE not found.'}), 404

# 发现网元的邻居
@ne_mgmt_bp.route('/<network_name>/elements/discover', methods=['POST'])
def discover_neighbors_route(network_name):
    ne_name = request.json.get('ne_name')
    device = devices.get(ne_name)
    if device:
        neighbors = discover_neighbors(device)
        
        # 更新数据库中的邻居信息
        db = get_db()
        elements_collection = db.get_collection('elements')
        elements_collection.update_one(
            {'_id': ObjectId(device['_id'])},
            {'$set': {'neighbors': neighbors}}  # 存储邻居信息
        )

        return jsonify({'status': 'success', 'neighbors': neighbors, 'devices': list(devices.values())}), 200
    else:
        return jsonify({'status': 'failure', 'error': f'NE {ne_name} not found'}), 404

# 获取网元的配置
@ne_mgmt_bp.route('/<network_name>/<ne_name>/Config', methods=['GET'])
def get_config(network_name, ne_name):
    device = devices.get(ne_name)
    if not device:
        return jsonify({'error': f'NE {ne_name} not found'}), 404

    command = 'display current-configuration'
    gne_device = device if device['ssh_ip'] == device.get('gne') else devices.get(device.get('gne'))

    if not gne_device:
        return jsonify({'error': 'GNE device not found for the NE'}), 404

    result = query_device_via_gateway(gne_device, device, command)

    if result['status'] == 'success':
        # 更新数据库中的配置信息
        db = get_db()
        elements_collection = db.get_collection('elements')
        elements_collection.update_one(
            {'_id': ObjectId(device['_id'])},
            {'$set': {'configuration': result['output']}}  # 存储配置
        )
        return render_template('configure.html', ne_name=ne_name, result=result['output'])
    else:
        return render_template('configure.html', ne_name=ne_name, result=result['error'])

# 获取网元的 SNMP 信息
@ne_mgmt_bp.route('/<network_name>/<ne_name>/Info', methods=['GET'])
def get_info(network_name, ne_name):
    device = devices.get(ne_name)

    if not device:
        return jsonify({'error': f'NE {ne_name} not found'}), 404

    if 'snmp_ip' in device:
        try:
            # 获取 SNMP 信息
            data = get_snmpv3_data(device)
            
            # 更新数据库中的 SNMP 信息
            db = get_db()
            elements_collection = db.get_collection('elements')
            elements_collection.update_one(
                {'_id': ObjectId(device['_id'])},
                {'$set': {'snmp_data': data}}  # 存储 SNMP 信息
            )
            print(f"SNMP data for {ne_name} updated in the database.")  # 打印日志信息

            # 渲染前端页面并返回 SNMP 数据
            return render_template('info.html', ne_name=ne_name, data=data)
        except Exception as e:
            return render_template('info.html', ne_name=ne_name, error=str(e))
    else:
        return render_template('info.html', ne_name=ne_name, error=f'SNMP not configured for NE {ne_name}')