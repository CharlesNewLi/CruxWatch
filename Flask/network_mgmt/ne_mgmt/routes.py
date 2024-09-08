from flask import Blueprint, render_template, jsonify, request
from .hw_disc import (
    get_snmpv3_data, discover_neighbors, query_device_via_gateway, is_valid_ip, 
    filter_ssh_params, devices as elements
)
from netmiko import ConnectHandler
from services.db import get_db

ne_mgmt_bp = Blueprint('ne_mgmt_bp', __name__)

# 获取当前网络中的所有网元信息
@ne_mgmt_bp.route('/<network_name>/elements')
def nes_page(network_name):
    return render_template('elements.html', network_name=network_name, elements=elements)

# 添加网元到特定网络
@ne_mgmt_bp.route('/<network_name>/elements/add', methods=['POST'])
def add_device(network_name):
    data = request.json

    # Generate NE name and details
    ne_name = data['ne_name']
    gne_device = {
        'device_type': data['ne_make'],
        'name': ne_name,
        'ssh_ip': data['ssh_ip'],
        'ssh_username': data['ssh_username'],
        'ssh_password': data['ssh_password'],
        'ssh_secret': data.get('ssh_secret', ''),
        'session_log': f'session_log_{ne_name}.txt',
        'verbose': True,
        'global_delay_factor': 2,
        'gne': data['ssh_ip']  # For GNE devices, gne points to its own ssh_ip
    }

    if is_valid_ip(gne_device['ssh_ip']):
        try:
            # SSH 连接到网元
            connection = ConnectHandler(**filter_ssh_params(gne_device))
            connection.disconnect()
            
            # 保存网元到数据库
            db = get_db()
            elements_collection = db.get_collection('elements')
            elements_collection.insert_one(gne_device)  # 插入数据库
            
            elements[ne_name] = gne_device
            return jsonify({'status': 'success', 'message': f'NE {ne_name} added successfully.', 'devices': list(elements.values())}), 201
        except Exception as e:
            return jsonify({'status': 'failure', 'error': f'SSH connection failed: {str(e)}'}), 500
    else:
        return jsonify({'status': 'failure', 'error': 'Invalid IP address.'}), 400

# 设置 SNMP 配置
@ne_mgmt_bp.route('/<network_name>/<ne_name>/set_snmp', methods=['POST'])
def set_snmp(network_name):
    data = request.json
    ne_name = data.get('ne_name')
    device = elements.get(ne_name)
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
            return jsonify({'status': 'success', 'message': 'SNMP setup successful.', 'snmp_data': snmp_data, 'devices': list(elements.values())}), 200
        except Exception as e:
            return jsonify({'status': 'failure', 'error': f'SNMP setup failed: {str(e)}'}), 500
    else:
        return jsonify({'status': 'failure', 'error': 'NE not found.'}), 404

# 发现网元的邻居
@ne_mgmt_bp.route('/<network_name>/elements/discover', methods=['POST'])
def discover_neighbors_route(network_name):
    ne_name = request.json.get('ne_name')
    device = elements.get(ne_name)
    if device:
        neighbors = discover_neighbors(device)
        return jsonify({'status': 'success', 'neighbors': neighbors, 'devices': list(elements.values())}), 200
    else:
        return jsonify({'status': 'failure', 'error': f'NE {ne_name} not found'}), 404

# 获取网元的配置
@ne_mgmt_bp.route('/<network_name>/<ne_name>/Config', methods=['GET'])
def get_config(network_name, ne_name):
    device = elements.get(ne_name)

    if not device:
        return jsonify({'error': f'NE {ne_name} not found'}), 404

    command = 'display current-configuration'

    if device['ssh_ip'] == device.get('gne'):
        gne_device = device
    else:
        gne_ip = device.get('gne')
        gne_device_name = next((name for name, dev in elements.items() if dev['ssh_ip'] == gne_ip), None)

        if not gne_device_name:
            return jsonify({'error': 'GNE device not found for the NE'}), 404
        else:
            gne_device = elements[gne_device_name]

    result = query_device_via_gateway(gne_device, device, command)

    if result['status'] == 'success':
        return render_template('configure.html', ne_name=ne_name, result=result['output'])  # 前端使用 ne_name
    else:
        return render_template('configure.html', ne_name=ne_name, result=result['error'])

# 获取网元的 SNMP 信息
@ne_mgmt_bp.route('/<network_name>/<ne_name>/Info', methods=['GET'])
def get_info(network_name, ne_name):
    device = elements.get(ne_name)

    if not device:
        return jsonify({'error': f'NE {ne_name} not found'}), 404

    if 'snmp_ip' in device:
        try:
            data = get_snmpv3_data(device)
            return render_template('info.html', ne_name=ne_name, data=data)
        except Exception as e:
            return render_template('info.html', ne_name=ne_name, error=str(e))
    else:
        return render_template('info.html', ne_name=ne_name, error=f'SNMP not configured for NE {ne_name}')