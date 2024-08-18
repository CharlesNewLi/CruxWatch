from flask import Flask, render_template, jsonify
from netmiko import ConnectHandler
import logging
import socket
from pysnmp.hlapi import *
from cachetools import cached, TTLCache

app = Flask(__name__)

# Enable debug logging
logging.basicConfig(level=logging.DEBUG)

# Cache configuration: max size of 100, TTL (time-to-live) of 300 seconds (5 minutes)
cache = TTLCache(maxsize=100, ttl=300)

# Device credentials, combining SSH and SNMP credentials
hr1_device = {
    'device_type': 'huawei',
    'name': 'HR1',
    'ssh_ip': '192.168.31.144',
    'snmp_ip': '20.0.0.1',  # Replace with the actual IP of HR1 for SNMP
    'ssh_username': 'config',
    'ssh_password': 'Admin@123',
    'ssh_secret': 'your_enable_secret',
    'snmp_username': 'monitor',
    'snmp_auth_protocol': 'SHA',
    'snmp_auth_password': 'Admin@123',
    'snmp_priv_protocol': 'AES128',
    'snmp_priv_password': 'Admin@123',
    'verbose': True,
    'global_delay_factor': 2,
    'session_log': 'session_log.txt',
}

# Store discovered devices, including HR1 and its neighbors
devices = [hr1_device]

# Validate IP addresses
def is_valid_ip(ip):
    try:
        socket.inet_aton(ip)
        return True
    except socket.error:
        return False

# Filter out SSH-related parameters from the device info
def filter_ssh_params(device_info):
    allowed_keys = ['device_type', 'ip', 'username', 'password', 'secret', 'verbose', 'global_delay_factor', 'session_log']
    ssh_params = {}
    
    for key in allowed_keys:
        if key in device_info:
            ssh_params[key] = device_info[key]
        ssh_key = f'ssh_{key}'
        if ssh_key in device_info:
            ssh_params[key] = device_info[ssh_key]
    
    return ssh_params

# Filter out SNMP-related parameters from the device info
def filter_snmp_params(device_info):
    allowed_keys = ['ip', 'username', 'auth_protocol', 'auth_password', 'priv_protocol', 'priv_password']
    return {key.replace('snmp_', ''): value for key, value in device_info.items() if key.startswith('snmp_') and key.replace('snmp_', '') in allowed_keys}

# Fetch SNMP data
@cached(cache, key=lambda device: device['snmp_ip'])
def get_snmpv3_data(device):
    snmp_params = filter_snmp_params(device)
    auth_protocol = usmHMACSHAAuthProtocol if snmp_params.get('auth_protocol') == 'SHA' else usmHMACMD5AuthProtocol
    priv_protocol = usmAesCfb128Protocol if snmp_params.get('priv_protocol') == 'AES128' else usmDESPrivProtocol
    
    data = {}

    def fetch_oid(oid, label):
        logging.debug(f"Fetching OID {oid} for device {device['name']}")
        iterator = getCmd(
            SnmpEngine(),
            UsmUserData(snmp_params['username'], snmp_params['auth_password'], snmp_params['priv_password'],
                        authProtocol=auth_protocol,
                        privProtocol=priv_protocol),
            UdpTransportTarget((snmp_params['ip'], 161), timeout=10.0, retries=5),
            ContextData(),
            ObjectType(ObjectIdentity(oid))
        )
        errorIndication, errorStatus, errorIndex, varBinds = next(iterator)
        if errorIndication:
            logging.error(f"Error indication: {errorIndication}")
            data[label] = str(errorIndication)
        elif errorStatus:
            logging.error(f"Error status: {errorStatus.prettyPrint()}")
            data[label] = f'{errorStatus.prettyPrint()} at {errorIndex and varBinds[int(errorIndex)-1][0] or "?"}'
        else:
            data[label] = str(varBinds[0][1])

    fetch_oid('1.3.6.1.2.1.1.5.0', 'Device Name')  # sysName
    fetch_oid('1.3.6.1.2.1.1.1.0', 'Device Version')  # sysDescr
    fetch_oid('1.3.6.1.2.1.25.3.3.1.2.1', 'CPU Metrics')  # hrProcessorLoad
    fetch_oid('1.3.6.1.2.1.25.2.3.1.6.1', 'Storage Metrics')  # hrStorageUsed
    fetch_oid('1.3.6.1.2.1.2.1.0', 'Number of Interfaces')  # ifNumber

    return data

# Discover neighboring devices via SNMP
def discover_neighbors(device):
    snmp_params = filter_snmp_params(device)
    auth_protocol = usmHMACSHAAuthProtocol if snmp_params.get('auth_protocol') == 'SHA' else usmHMACMD5AuthProtocol
    priv_protocol = usmAesCfb128Protocol if snmp_params.get('priv_protocol') == 'AES128' else usmDESPrivProtocol
    
    neighbors = []
    logging.debug(f"Discovering neighbors for device {device['name']}")
    iterator = nextCmd(
        SnmpEngine(),
        UsmUserData(snmp_params['username'], snmp_params['auth_password'], snmp_params['priv_password'],
                    authProtocol=auth_protocol,
                    privProtocol=priv_protocol),
        UdpTransportTarget((snmp_params['ip'], 161), timeout=10.0, retries=5),
        ContextData(),
        ObjectType(ObjectIdentity('1.0.8802.1.1.2.1.4.1.1.9')),  # lldpRemSysName
        ObjectType(ObjectIdentity('1.0.8802.1.1.2.1.4.2.1.4')),  # lldpRemManAddr
        lexicographicMode=False
    )

    for errorIndication, errorStatus, errorIndex, varBinds in iterator:
        if errorIndication:
            logging.error(f"Error indication: {errorIndication}")
            continue
        elif errorStatus:
            logging.error(f"Error status: {errorStatus.prettyPrint()}")
            continue
        
        neighbor_name = str(varBinds[0][1])  # Neighbor device's system name
        addr_oid = varBinds[1][0].prettyPrint()
        oid_parts = addr_oid.split('.')
        try:
            neighbor_ip = '.'.join(oid_parts[-4:])  # Last four parts of OID as IP address
        except Exception as e:
            logging.error(f"Failed to extract IP from OID: {e}")
            neighbor_ip = None

        logging.debug(f"Neighbor Name: {neighbor_name}, Address OID: {addr_oid}, Parsed IP: {neighbor_ip}")

        if neighbor_ip is None or not is_valid_ip(neighbor_ip):
            logging.error(f"Invalid or missing IP address discovered: {neighbor_ip}")
            continue

        neighbor_device = {
            'device_type': 'huawei',
            'name': neighbor_name,
            'ssh_ip': neighbor_ip,
            'username': hr1_device['ssh_username'],  # Use SSH credentials similar to HR1
            'password': hr1_device['ssh_password'],
            'secret': hr1_device['ssh_secret'],
            'verbose': hr1_device['verbose'],
            'global_delay_factor': hr1_device['global_delay_factor'],
            'session_log': f'session_log_{neighbor_name}.txt',
        }

        if not any(d['ssh_ip'] == neighbor_ip for d in devices):
            neighbors.append(neighbor_device)
            devices.append(neighbor_device)
    
    return neighbors

# Log connection attempts
def log_connection_attempt(device):
    logging.debug(f"Connecting to device: {device['ssh_ip']} with params: {device}")

# Log command execution
def log_command_execution(command, device):
    logging.debug(f"Executing command: {command} on device: {device['ssh_ip']}")

# Query device via HR1 as a gateway
def query_device_via_gateway(gateway_device, target_device, command):
    try:
        log_connection_attempt(gateway_device)
        gateway_params = filter_ssh_params(gateway_device)
        target_params = filter_ssh_params(target_device)

        if gateway_device['ssh_ip'] == target_device['ssh_ip']:
            connection = ConnectHandler(**gateway_params)
        else:
            connection = ConnectHandler(**gateway_params)
            if 'secret' in gateway_device:
                connection.enable()

            connection.send_command('ssh client first-time enable')
            connection.send_command('commit')

            stelnet_command = f"stelnet {target_device['ssh_ip']}"
            command_output = connection.send_command_timing(stelnet_command)

            if 'The server is not authenticated' in command_output:
                command_output += connection.send_command_timing('Y')
                command_output += connection.send_command_timing('Y')

            command_output += connection.send_command_timing(target_device['username'])
            command_output += connection.send_command_timing(target_device['password'])

            if 'Change now? [Y/N]' in command_output:
                command_output += connection.send_command_timing('N')

            connection.send_command('screen-length 0 temporary')

            log_command_execution(command, target_device)
            command_output += connection.send_command(command, expect_string=r'<HR2>', read_timeout=20)

            connection.send_command_timing('quit')
            connection.disconnect()

            return {'status': 'success', 'output': command_output}

        log_command_execution(command, target_device)
        result = connection.send_command(command)
        connection.disconnect()
        return {'status': 'success', 'output': result}

    except Exception as e:
        logging.error(f"Error during SSH connection: {str(e)}")
        return {'status': 'failure', 'error': str(e)}

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/devices')
def devices_page():
    return render_template('devices.html', devices=devices)

@app.route('/devices/discover', methods=['POST'])
def discover():
    neighbors = discover_neighbors(hr1_device)
    return jsonify({'status': 'success', 'neighbors': [n['name'] for n in neighbors]}), 200

@app.route('/device/<device_name>/Info', methods=['GET'])
def get_info(device_name):
    device = next((d for d in devices if d['name'] == device_name), None)
    
    if not device:
        return jsonify({'error': f'Device {device_name} not found'}), 404
    
    if 'snmp_ip' in device:
        try:
            data = get_snmpv3_data(device)
            return jsonify({'status': 'success', 'data': data}), 200
        except Exception as e:
            return jsonify({'status': 'failure', 'error': str(e)}), 500
    else:
        return jsonify({'error': f'SNMP not configured for device {device_name}'}), 404

@app.route('/device/<device_name>/Config', methods=['GET'])
def get_config(device_name):
    device = next((d for d in devices if d['name'] == device_name), None)
    
    if not device:
        return jsonify({'error': f'Device {device_name} not found'}), 404

    command = 'display current-configuration'
    result = query_device_via_gateway(hr1_device, device, command)
    
    if result['status'] == 'success':
        return render_template('configure.html', device_name=device_name, result=result['output'])
    else:
        return render_template('configure.html', device_name=device_name, result=result['error'])

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8888)