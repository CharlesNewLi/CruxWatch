from flask import Blueprint, render_template, jsonify, request, after_this_request
from .hw_disc import (
    get_snmpv3_data, discover_neighbors, query_device_via_gateway, is_valid_ip, 
    filter_ssh_params, devices
)
from netmiko import ConnectHandler
from services.db import get_db
from models.network import convert_device_to_db_format, ne_exists_in_network
from bson import ObjectId
import logging

ne_mgmt_bp = Blueprint('ne_mgmt_bp', __name__)

# 获取当前网络中的所有网元信息
@ne_mgmt_bp.route('/<network_name>/elements', methods=['GET'])
def get_elements(network_name):
    return jsonify({'status': 'success', 'elements': devices})

# 添加网元到特定网络或站点
@ne_mgmt_bp.route('/<network_name>/elements/add', methods=['POST'])
def add_device(network_name):
    data = request.json
    site_name = data.get('site_name', None)  # 获取 site_name (可选)
    print("Received data from frontend:", data)  # 打印接收到的前端数据

    ne_name = data['ne_name']

    # 准备用于SSH连接的设备信息，使用前端传递的 gne 字段
    gne_device = {
        'device_type': data['ne_make'],
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
    
            return jsonify({'status': 'success', 'message': f'Device {ne_name} added successfully.', 'devices': list(devices.values())}), 201
        except Exception as e:    
            return jsonify({'status': 'failure', 'error': f'SSH connection failed: {str(e)}'}), 500
    else:
        return jsonify({'status': 'failure', 'error': 'Invalid IP address.'}), 400

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

    # 查找设备是否在网络的 sites 中
    device_in_sites = next((device for device in network.get('sites', []) if device['device_name'] == ne_name), None)
    if device_in_sites:
        # 移动设备到新站点
        site = next((site for site in network.get('sites', []) if site['site_name'] == new_site_name), None)
        if not site:
            return jsonify({'status': 'failure', 'error': f'Site {new_site_name} not found in network {network_name}.'}), 404

        site.setdefault('elements', []).append(device_in_sites)
        network['sites'] = [device for device in network['sites'] if device['device_name'] != ne_name]  # 从 sites 中删除设备
        network_collection.update_one({'_id': ObjectId(network['_id'])}, {'$set': {'sites': network['sites'], 'sites': network.get('sites', [])}})

        print(f"Moved device {ne_name} to site {new_site_name}")
        return jsonify({'status': 'success', 'message': f'Device {ne_name} moved to site {new_site_name}.'}), 200
    else:
        return jsonify({'status': 'failure', 'error': f'Device {ne_name} not found in network {network_name} sites.'}), 404

# 设置 SNMP 配置
@ne_mgmt_bp.route('/<network_name>/<ne_name>/set_snmp', methods=['POST'])
def set_snmp(network_name, ne_name):
    data = request.json
    ne_name = data.get('ne_name').strip()
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

        try:
            snmp_data = get_snmpv3_data(device)
            logging.debug(f"SNMP setup successful, retrieved data: {snmp_data}")
            
            device['snmp_setup_success'] = True  # Mark SNMP setup success
            
            return jsonify({'status': 'success', 'message': 'SNMP setup successful.', 'snmp_data': snmp_data, 'devices': list(devices.values())}), 200
        except Exception as e:
            logging.error(f"SNMP setup failed: {str(e)}")
            return jsonify({'status': 'failure', 'error': f'SNMP setup failed: {str(e)}'}), 500
    else:
        logging.error("Device not found.")
        return jsonify({'status': 'failure', 'error': 'Device not found.'}), 404

# 发现网元的邻居
@ne_mgmt_bp.route('/<network_name>/<ne_name>/discover', methods=['POST'])
def discover_neighbors_route(network_name, ne_name):
    device = devices.get(ne_name)
    if device:
        neighbors = discover_neighbors(device)
        logging.debug(f"Current devices in dictionary after discovering neighbors in /discover: {list(devices.keys())}")
       
        return jsonify({'status': 'success', 'neighbors': neighbors, 'devices': list(devices.values())}), 200
    else:
        return jsonify({'status': 'failure', 'error': f'NE {ne_name} not found'}), 404

# 获取网元的配置
@ne_mgmt_bp.route('/<network_name>/<ne_name>/Config', methods=['GET'])
def get_config(network_name, ne_name):
    device = devices.get(ne_name.strip())
    
    if not device:
        return jsonify({'error': f'NE {ne_name} not found'}), 404
    
    logging.debug(f"Devices dictionary content: {devices}")
    
    command = 'display current-configuration'
    
    if device['ip'] == device.get('gne'):
        gne_device = device
    else:
        gne_ip = device.get('gne')
        logging.debug(f"Attempting to find GNE device with IP: {gne_ip}")

        gne_device_name = None
        for name, dev in devices.items():
            if dev['ip'] == gne_ip:
                gne_device_name = name
                break

        if not gne_device_name:
            logging.error(f"GNE device not found in devices dictionary for IP: {gne_ip}")
            return jsonify({'error': 'GNE device not found for the target device'}), 404
        else:
            gne_device = devices[gne_device_name]
    
    result = query_device_via_gateway(gne_device, device, command)
    
    if result['status'] == 'success':
        return render_template('configure.html', device_name=ne_name, result=result['output'])
    else:
        return render_template('configure.html', device_name=ne_name, result=result['error'])

# 获取网元的 SNMP 信息
@ne_mgmt_bp.route('/<network_name>/<ne_name>/Info', methods=['GET'])
def get_info(network_name, ne_name):
    device = devices.get(ne_name.strip())

    if not device:
        return jsonify({'error': f'Device {ne_name} not found'}), 404

    if 'ip' in device:
        try:
            data = get_snmpv3_data(device)
            return render_template('info.html', device_name=ne_name, data=data)
        except Exception as e:
            return render_template('info.html', device_name=ne_name, error=str(e))
    else:
        return render_template('info.html', device_name=ne_name, error=f'SNMP not configured for device {ne_name}')
