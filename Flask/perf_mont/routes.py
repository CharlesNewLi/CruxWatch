from flask import Blueprint, jsonify, request
from .performance import get_snmpv3_data
import logging

perf_mont_bp = Blueprint('perf_mont_bp', __name__)

def clean_input(value):
    """Helper function to clean input by stripping leading/trailing whitespace."""
    if isinstance(value, str):
        return value.strip()
    return value  # 如果不是字符串，直接返回原值

# 获取网元的 SNMP 信息
@perf_mont_bp.route('/<ne_name>/Info', methods=['POST'])
def get_info(ne_name):
    # 清理并验证网元名称
    ne_name = clean_input(ne_name)

    # 从前端请求体中获取 SNMP 参数
    data = request.json

    # 验证传入的数据
    required_keys = ['ne_ip', 'snmp_username', 'snmp_auth_protocol', 'snmp_auth_password', 'snmp_priv_protocol', 'snmp_priv_password']
    for key in required_keys:
        if key not in data:
            logging.error(f"Missing {key} in the request body for {ne_name}")
            return jsonify({'status': 'failure', 'error': f'Missing {key} in the request body'}), 400

    # 规范化设备的 SNMP 配置信息，兼容前端传入的参数
    device = {
        'ip': data['ne_ip'],  # 将前端的 ne_ip 映射为后端期望的 ip
        'username': data['snmp_username'],
        'auth_protocol': data['snmp_auth_protocol'],
        'auth_password': data['snmp_auth_password'],
        'priv_protocol': data['snmp_priv_protocol'],
        'priv_password': data['snmp_priv_password']
    }

    try:
        # 调用 SNMP 数据查询函数
        snmp_data = get_snmpv3_data(device)

        # 返回设备的基本性能数据
        device_perf_info = {
            'device_name': snmp_data.get('Device Name', 'Unknown'),
            'device_version': snmp_data.get('Device Version', 'Unknown'),
            'cpu_metrics': snmp_data.get('CPU Metrics', 'N/A'),
            'storage_metrics': snmp_data.get('Storage Metrics', 'N/A'),
            'number_of_interfaces': snmp_data.get('Number of Interfaces', 'N/A'),
            'interfaces': snmp_data.get('Interfaces', [])
        }

        logging.info(f"SNMP data retrieved for device {ne_name}: {device_perf_info}")
        return jsonify({'status': 'success', 'device_perf_info': device_perf_info}), 200
    except Exception as e:
        logging.error(f"SNMP query failed for {ne_name}: {str(e)}")
        return jsonify({'status': 'failure', 'error': f'SNMP query failed: {str(e)}'}), 500