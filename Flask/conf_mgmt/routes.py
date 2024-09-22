# 获取网元的配置
@ne_mgmt_bp.route('/<network_name>/<ne_name>/Config', methods=['GET'])
def get_config(network_name, ne_name):
    ne_name = clean_input(ne_name) 
    device = devices.get(ne_name)
    
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