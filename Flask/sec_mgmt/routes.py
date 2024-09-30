from flask import Blueprint, jsonify, request
from .security import perform_port_scan
import logging

sec_mgmt_bp = Blueprint('sec_mgmt_bp', __name__)

# 执行端口扫描
@sec_mgmt_bp.route('/<ne_name>/Scan', methods=['POST'])
def scan_ports(ne_name):
    data = request.json
    ne_ip = data.get('ne_ip')
    port_range = data.get('port_range', '1-1024')  # 默认端口范围

    # 打印接收到的 IP 地址和端口范围
    logging.info(f"Received request to scan IP: {ne_ip} with port range: {port_range}")

    if not ne_ip:
        logging.error("NE IP is missing from the request")
        return jsonify({'status': 'failure', 'error': 'NE IP is required'}), 400

    try:
        logging.info(f"Starting port scan on {ne_ip}")
        scan_results = perform_port_scan(ne_ip, port_range)  # 传递端口范围
        logging.info(f"Scan results for {ne_ip}: {scan_results}")
        return jsonify({'status': 'success', 'scan_results': scan_results}), 200
    except Exception as e:
        logging.error(f"Error during port scan: {e}")
        return jsonify({'status': 'failure', 'error': str(e)}), 500
