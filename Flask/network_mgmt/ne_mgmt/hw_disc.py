import logging
import socket
from netmiko import ConnectHandler
from pysnmp.hlapi import *
from cachetools import cached, TTLCache

# Cache configuration: max size of 100, TTL (time-to-live) of 300 seconds (5 minutes)
cache = TTLCache(maxsize=100, ttl=300)

# Store discovered devices, including GNE and its neighbors
devices = {}

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
    snmp_params = {}

    # 检查 allowed_keys 中的键，确保 IP 地址等关键参数不会被过滤掉
    for key in allowed_keys:
        if key in device_info:
            snmp_params[key] = device_info[key]
        snmp_key = f'snmp_{key}'
        if snmp_key in device_info:
            snmp_params[key] = device_info[snmp_key]

    return snmp_params

# Fetch SNMP data
@cached(cache, key=lambda device: device['ip'])
def get_snmpv3_data(device):
    snmp_params = filter_snmp_params(device)
    auth_protocol = usmHMACSHAAuthProtocol if snmp_params.get('auth_protocol') == 'SHA' else usmHMACMD5AuthProtocol
    priv_protocol = usmAesCfb128Protocol if snmp_params.get('priv_protocol') == 'AES128' else usmDESPrivProtocol
    
    data = {}

    def fetch_oid(oid, label):
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
            data[label] = str(errorIndication)
        elif errorStatus:
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
    logging.debug(f"Discovering neighbors for device {device['device_name']}")
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
        
        ne_name = str(varBinds[0][1])  # Neighbor device's system name
        addr_oid = varBinds[1][0].prettyPrint()
        oid_parts = addr_oid.split('.')
        try:
            ne_ip = '.'.join(oid_parts[-4:])  # Last four parts of OID as IP address
        except Exception as e:
            logging.error(f"Failed to extract IP from OID: {e}")
            ne_ip = None

        logging.debug(f"Neighbor Name: {ne_name}, Address OID: {addr_oid}, Parsed IP: {ne_ip}")

        if ne_ip is None or not is_valid_ip(ne_ip):
            logging.error(f"Invalid or missing IP address discovered: {ne_ip}")
            continue

        # Generate neighbor device key dynamically
        ne_device_key = ne_name
        ne_device = {
            'device_type': 'huawei',
            'device_name': ne_name,
            'ip': ne_ip,
            'ssh_username': device['ssh_username'],  # Use SSH credentials from the main device
            'ssh_password': device['ssh_password'],
            'ssh_secret': device['ssh_secret'],
            'verbose': device['verbose'],
            'global_delay_factor': device['global_delay_factor'],
            'session_log': f'session_log_{ne_name}.txt',
            'gne': device['ip'],  # Set GNE to the device that discovered it
            'network_name': device['network_name']
        }

        # Add new neighbor device to the devices dictionary
        if not any(d['ip'] == ne_ip for d in devices.values()):
            devices[ne_device_key] = ne_device
            neighbors.append(ne_device_key)
    
    logging.debug(f"Devices dictionary after neighbor discovery: {devices}")
    
    return neighbors

# Log connection attempts
def log_connection_attempt(device):
    logging.debug(f"Connecting to device {device['device_name']} at IP: {device['ip']}")

# Log command execution
def log_command_execution(command, device):
    logging.debug(f"Executing command: {command} on device {device['device_name']} at IP: {device['ip']}")

# Query device via GNE as a gateway
def query_device_via_gateway(gne_device, target_device, command):
    try:
        # Print the GNE value for the target device
        logging.debug(f"Target device {target_device['device_name']} GNE value: {target_device.get('gne')}")

        # Check if the GNE device exists
        gne_ip = target_device.get('gne')
        gne_device_name = None
        for device_name, device in devices.items():
            if device['ip'] == gne_ip:
                gne_device_name = device_name
                break

        if not gne_device_name:
            logging.error(f"GNE device not found in devices dictionary for IP: {gne_ip}")
            return {'status': 'failure', 'error': f'GNE device not found for IP: {gne_ip}'}
        else:
            logging.debug(f"Found GNE device: {gne_device_name} for IP: {gne_ip}")
            gne_device = devices[gne_device_name]  # Retrieve GNE device by name

        log_connection_attempt(gne_device)
        gne_params = filter_ssh_params(gne_device)
        target_params = filter_ssh_params(target_device)

        if gne_device['ip'] != target_device['ip']:
            connection = ConnectHandler(**gne_params)
            if 'secret' in gne_device:
                connection.enable()

            # Connect to the neighbor device via GNE
            stelnet_command = f"stelnet {target_device['ip']}"
            command_output = connection.send_command_timing(stelnet_command)

            if 'The server is not authenticated' in command_output:
                command_output += connection.send_command_timing('Y')
                command_output += connection.send_command_timing('Y')

            command_output += connection.send_command_timing(target_device['ssh_username'])
            command_output += connection.send_command_timing(target_device['ssh_password'])

            if 'Change now? [Y/N]' in command_output:
                command_output += connection.send_command_timing('N')

            connection.send_command('screen-length 0 temporary')
        else:
            connection = ConnectHandler(**target_params)
            command_output = ""

        # Use a general prompt regex pattern to match all device prompts
        log_command_execution(command, target_device)
        command_output += connection.send_command(command, expect_string=r'[>#]', read_timeout=20)

        connection.send_command_timing('quit')
        connection.disconnect()

        return {'status': 'success', 'output': command_output}

    except Exception as e:
        logging.error(f"Error during SSH connection: {str(e)}")
        return {'status': 'failure', 'error': str(e)}

# Log connection attempts
def log_connection_attempt(device):
    logging.debug(f"Connecting to device {device['device_name']} at IP: {device['ip']}")

# Log command execution
def log_command_execution(command, device):
    logging.debug(f"Executing command: {command} on device {device['device_name']} at IP: {device['ip']}")