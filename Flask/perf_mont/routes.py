
# 获取网元的 SNMP 信息
@ne_mgmt_bp.route('/<network_name>/<ne_name>/Info', methods=['GET'])
def get_info(network_name, ne_name):
    ne_name = clean_input(ne_name) 
    device = devices.get(ne_name)

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
