from flask import Blueprint, jsonify, request
from network_mgmt.global_data import devices, devices_snmp, topo_data
from .ne_init import (
    get_snmpv3_data, discover_neighbors, is_valid_ip, 
    filter_ssh_params,query_device_via_gateway
)
from .topo_init import update_topo_data
from netmiko import ConnectHandler
from services.db import get_db
from models.network import convert_device_to_db_format, move_ne_to_site, add_ne_to_network_root, remove_ne_from_site, save_topology_to_db
import logging

ne_mgmt_bp = Blueprint('ne_mgmt_bp', __name__)

def clean_input(value):
    """Helper function to clean input by stripping leading/trailing whitespace."""
    if isinstance(value, str):
        return value.strip()
    return value  # 如果不是字符串，直接返回原值

# 获取当前网络中的所有网元信息
@ne_mgmt_bp.route('/<network_name>/elements', methods=['GET'])
def get_elements(network_name):
    return jsonify({'status': 'success', 'elements': devices})

# 添加网元到特定网络或站点
@ne_mgmt_bp.route('/<network_name>/elements/add', methods=['POST'])
def add_device(network_name):
    data = request.json
    print("Received data from frontend:", data)  # 打印接收到的前端数据

    ne_name = data['ne_name']

    # 检查 ne_make 字段是否为 'cisco'
    # device_type = data['ne_make']
    # if device_type.lower() == 'cisco':
    #     device_type = 'cisco_ios'  # 如果是 cisco，则将 device_type 设置为 cisco_ios

    # 准备用于SSH连接的设备信息，使用前端传递的 gne 字段
    gne_device = {
        'device_type': data['ne_make'],
        'ne_type': data['ne_type'],
        'device_name': ne_name,
        'ip': data['ne_ip'],
        'ssh_username': data['ssh_username'],
        'ssh_password': data['ssh_password'],
        'ssh_secret': data.get('ssh_secret', ''),
        'session_log': f'session_log_{ne_name}.txt',
        'verbose': True,
        'global_delay_factor': 2,
        'gne': data['ne_ip'],  # gne 设备的 ssh_ip
        'network_name': network_name
    }

    if is_valid_ip(gne_device['ip']):
        try:
            connection = ConnectHandler(**filter_ssh_params(gne_device))
            # 将设备信息直接存入 devices 字典中，无需子字典
            devices[ne_name] = gne_device
            print(f"Device data in devices: {devices}")
            logging.debug(f"SSH session established for device {ne_name}. Current devices: {list(devices.keys())}")           

            # 更新全局拓扑数据
            update_topo_data(network_name)

            return jsonify({'status': 'success', 'message': f'Device {ne_name} added successfully.', 'device': gne_device, 'topology': topo_data }), 201
        except Exception as e:    
            return jsonify({'status': 'failure', 'error': f'SSH connection failed: {str(e)}'}), 500
    else:
        return jsonify({'status': 'failure', 'error': 'Invalid IP address.'}), 400
    
# 设置 SNMP 配置
@ne_mgmt_bp.route('/<network_name>/<ne_name>/set_snmp', methods=['POST'])
def set_snmp(network_name, ne_name):
    data = request.json
    print(f"Received data: {data}")  
    ne_name = data.get('ne_name')
    ne_name = clean_input(ne_name) 
    device = devices.get(ne_name)
        
    if device:
        device.update({
            'ip': data['ne_ip'],
            'snmp_username': data['snmp_username'],
            'snmp_auth_protocol': data['snmp_auth_protocol'],
            'snmp_auth_password': data['snmp_auth_password'],
            'snmp_priv_protocol': data['snmp_priv_protocol'],
            'snmp_priv_password': data['snmp_priv_password'],
        })

        print(f"Updated device data: {device}")  # 打印更新后的 device 数据

        try:
            device_snmp = get_snmpv3_data(device)
            logging.debug(f"SNMP setup successful, retrieved data: {device_snmp}")
            print(f"device_snmp:'{device_snmp}")

            # 将 SNMP 数据存储到全局的 snmp_data_store 中
            devices_snmp[ne_name] = device_snmp

            # 更新全局拓扑数据
            update_topo_data(network_name)

            # 只选择部分 SNMP 数据传递给前端
            device_snmp_basic = {
                'device_name': data['ne_name'],
                'status': 'Configured',
                'snmp_username': data['snmp_username'],
                'snmp_auth_protocol': data['snmp_auth_protocol'],
                'snmp_auth_password': data['snmp_auth_password'],
                'snmp_priv_protocol': data['snmp_priv_protocol'],
                'snmp_priv_password': data['snmp_priv_password'],
                'network_name': network_name  # 添加 network_name
            }

            device['snmp_setup_success'] = True  # Mark SNMP setup success
            
            return jsonify({'status': 'success', 'message': 'SNMP setup successful.', 'device_snmp': device_snmp_basic}), 200
        except Exception as e:
            logging.error(f"SNMP setup failed: {str(e)}")
            return jsonify({'status': 'failure', 'error': f'SNMP setup failed: {str(e)}'}), 500
    else:
        logging.error("Device not found.")
        return jsonify({'status': 'failure', 'error': 'Device not found.'}), 404


 # 发现网元的邻居
@ne_mgmt_bp.route('/<network_name>/<ne_name>/discover', methods=['POST'])
def discover_neighbors_route(network_name, ne_name):
    # 从请求体中获取设备信息
    device = request.json

    if not device.get('ne_name') or not device.get('network_name'):
        return jsonify({'status': 'failure', 'error': 'Missing required device or network information'}), 400

    # 提取并清理 ne_name
    ne_name = clean_input(device['ne_name'])

    # 检查设备是否已经存在于字典中
    existing_device = devices.get(ne_name)

    if existing_device:
        # 更新设备字典中的设备信息
        existing_device.update({
            'ip': device.get('ne_ip', existing_device.get('ip')),
            'device_type': device.get('ne_make', existing_device.get('device_type')),
            'snmp_username': device.get('snmp_username', existing_device.get('snmp_username')),
            'snmp_auth_protocol': device.get('snmp_auth_protocol', existing_device.get('snmp_auth_protocol')),
            'snmp_auth_password': device.get('snmp_auth_password', existing_device.get('snmp_auth_password')),
            'snmp_priv_protocol': device.get('snmp_priv_protocol', existing_device.get('snmp_priv_protocol')),
            'snmp_priv_password': device.get('snmp_priv_password', existing_device.get('snmp_priv_password')),
            'ssh_username': device.get('ssh_username', existing_device.get('ssh_username')),
            'ssh_password': device.get('ssh_password', existing_device.get('ssh_password')),
            'ssh_secret': device.get('ssh_secret', existing_device.get('ssh_secret'))
        })

        print(f"Updated device data: {existing_device}")  # 打印更新后的 device 数据

        # 调用 discover_neighbors 进行邻居发现
        discovered_devices, neighbors, ne_connections = discover_neighbors(existing_device)

        logging.debug(f"Neighbor connections: {ne_connections}") 
        print(f"Neighbor connections: {ne_connections}") 

        # 更新全局拓扑数据
        update_topo_data(network_name)

        # 返回邻居信息和拓扑数据，并将发现的邻居设备作为 devices 字段返回
        return jsonify({
            'status': 'success', 
            'message': 'Neighbor discovery successful!',
            'devices': discovered_devices,  # 返回当前发现的邻居设备
            'topology': topo_data
        }), 200
    else:
        # 如果设备不存在，返回错误
        return jsonify({'status': 'failure', 'message': f'NE {ne_name} not found'}), 404

#初使化网元配置
@ne_mgmt_bp.route('/<network_name>/<ne_name>/query_config', methods=['POST'])
def get_config(network_name, ne_name):
    data = request.json
    ne_name = clean_input(ne_name)

    # 从前端接收的参数
    ne_type = data.get('ne_type')
    device_type = data.get('ne_make')
    ip = data.get('ne_ip')  # 从前端传入的设备IP
    gne_ip = data.get('gne')  # 从前端传入的GNE IP
    ssh_username = data.get('ssh_username')
    ssh_password = data.get('ssh_password')
    ssh_secret = data.get('ssh_secret', '')

    logging.info(f"Received request to query config for {ne_name} on {network_name} with IP {ip}. Device type: {device_type}")

    # 检查是否提供了 SSH 凭据
    if not ssh_username or not ssh_password or not ip:
        logging.error("SSH credentials or IP address missing.")
        return jsonify({
            'status': 'failure',
            'error': 'SSH credentials and IP address are required',
            'message': '请提供有效的 SSH 凭据和 IP 地址以连接设备。'
        }), 400

    # 根据设备类型选择正确的默认命令
    if device_type == 'huawei':
        command = 'display current-configuration'
    elif device_type == 'cisco_ios':
        command = 'show running-config'  # 修复命令为Cisco设备的正确命令
    else:
        logging.error(f"Unsupported device type: {device_type}")
        return jsonify({
            'status': 'failure',
            'error': f'Unsupported device type: {device_type}',
            'message': '不支持的设备类型。'
        }), 400

    logging.info(f"Running command '{command}' on device type '{device_type}'.")

    # 传递命令和设备类型到 query_device_via_gateway
    result = query_device_via_gateway(gne_ip, ip, command, device_type, ssh_username, ssh_password, ssh_secret)

    # 打印返回结果
    logging.info(f"Query result for {ne_name}: {result}")

    # 根据结果返回 JSON 响应
    if result['status'] == 'success':
        return jsonify({
            'status': 'success',
            'output': result['output'],  # 当前配置
            'device_name': ne_name,
            'ne_type': ne_type,  # 增加 ne_type，前端可以用来更新图标
            'message': f'设备 {ne_name} 的配置已成功获取。请编辑并提交您的配置。'
        }), 200
    else:
        return jsonify({
            'status': 'failure',
            'error': result['error'],
            'message': f'无法获取设备 {ne_name} 的配置，请检查设备连接或 GNE 设置。'
        }), 500
    
# Push Configuration
@ne_mgmt_bp.route('/<network_name>/<ne_name>/apply_config', methods=['POST'])
def apply_config(network_name, ne_name):
    data = request.json
    ne_name = clean_input(ne_name)
    
    # 获取新的配置
    new_config = data.get('new_config')
    device_type = data.get('ne_make')
    ip = data.get('ne_ip')  # 从前端传入的设备IP
    gne_ip = data.get('gne')  # 从前端传入的GNE IP
    ssh_username = data.get('ssh_username')
    ssh_password = data.get('ssh_password')
    ssh_secret = data.get('ssh_secret', '')

    if not ssh_username or not ssh_password or not new_config or not ip:
        return jsonify({'status': 'failure', 'error': 'SSH credentials, new configuration, and IP are required'}), 400

    # 使用 GNE 跳转到目标设备下发配置
    result = query_device_via_gateway(gne_ip, ip, new_config, device_type, ssh_username, ssh_password, ssh_secret)
    
    if result['status'] == 'success':
        return jsonify({'status': 'success', 'message': '新配置已成功下发到设备'}), 200
    else:
        return jsonify({'status': 'failure', 'error': result['error']}), 500

# 保存初始化完成后的设备到 MongoDB 数据库
@ne_mgmt_bp.route('/<network_name>/elements/save', methods=['POST'])
def save_devices_to_db(network_name):
    try:
        db = get_db()
        network_collection = db.get_collection('networks')

        # 简化处理：假设网络已存在，直接更新网络信息
        elements = []
        for device in devices.values():
            element = convert_device_to_db_format(device)
            elements.append(element)

        # 更新网络中的元素列表（覆盖或插入新的设备数据）
        network_collection.update_one(
            {'network_name': network_name},
            {'$set': {'elements': elements}},
            upsert=True  # 如果网络不存在，则插入一个新文档
        )
        
        # 保存拓扑数据
        save_result = save_topology_to_db(network_name, topo_data)

        logging.info(f"Saved devices for network {network_name} to MongoDB.")
        return jsonify({'status': 'success', 'message': f'Devices for network {network_name} saved successfully.'}), 200
    except Exception as e:
        logging.error(f"Failed to save devices to MongoDB: {str(e)}")
        return jsonify({'status': 'failure', 'error': f'Failed to save devices to database: {str(e)}'}), 500

# 更新或初次分配设备所属的站点
@ne_mgmt_bp.route('/<network_name>/elements/update_site', methods=['POST'])
def update_ne_site(network_name):
    try:
        # 从前端获取设备名称、目标站点名称以及操作类型
        data = request.json
        ne_name = data['ne_name']
        new_site_name = data['new_site_name']
        action_type = data['action_type']  # Join Site 或 Change Site

        # 打印接收到的数据
        print(f"Received request to move NE '{ne_name}' to site '{new_site_name}' in network '{network_name}' with action '{action_type}'")

        # 调用 move_ne_to_site 来处理网元的迁移
        result = move_ne_to_site(network_name, ne_name, new_site_name, action_type)

        if result['status'] == 'success':
            print(f"Device '{ne_name}' successfully moved to site '{new_site_name}'.")
            return jsonify({'status': 'success', 'message': result['message']}), 200
        else:
            print(f"Failed to move device '{ne_name}' to site '{new_site_name}': {result['message']}")
            return jsonify({'status': 'failure', 'message': result['message']}), 500

    except Exception as e:
        print(f"Failed to update device site: {str(e)}")
        return jsonify({'status': 'failure', 'message': f'Failed to update device site: {str(e)}'}), 500

@ne_mgmt_bp.route('/<network_name>/elements/remove_ne', methods=['POST'])
def remove_ne_from_site_route(network_name):
    try:
        # 从前端获取网元名称
        data = request.json
        ne_name = data['ne_name']

        # 调用 network.py 中的 remove_ne_from_site 函数来移除网元
        result = remove_ne_from_site(network_name, ne_name)
        if result['status'] == 'failure':
            return jsonify(result), 404

        # 将设备添加到网络的根层次，保持完整字段信息
        element_to_move = result['element']  # 从 remove_ne_from_site 返回完整的 element 对象
        root_result = add_ne_to_network_root(network_name, element_to_move)
        
        if root_result['status'] == 'success':
            return jsonify({'status': 'success', 'message': f'NE {ne_name} moved to network root successfully.'}), 200
        else:
            return jsonify({'status': 'failure', 'message': f'Failed to add NE {ne_name} to network root.'}), 500

    except Exception as e:
        return jsonify({'status': 'failure', 'message': f'Failed to remove NE from site: {str(e)}'}), 500

@ne_mgmt_bp.route('/network_elements', methods=['GET'])
def get_all_ne_elements():
    try:
        # 从数据库中获取所有网元信息
        db = get_db()
        networks = db.get_collection('networks').find()

        elements = []
        for network in networks:
            elements.extend(network.get('elements', []))  # 提取每个网络中的网元

        return jsonify(elements), 200
    except Exception as e:
        return jsonify({'status': 'failure', 'message': str(e)}), 500