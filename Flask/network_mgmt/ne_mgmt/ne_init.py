from network_mgmt.global_data import devices, ne_connections
import logging
import socket
from pysnmp.hlapi import *
from cachetools import cached, TTLCache

# Cache configuration: max size of 100, TTL (time-to-live) of 300 seconds (5 minutes)
cache = TTLCache(maxsize=100, ttl=300)

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
    priv_protocol_input = snmp_params.get('priv_protocol')
    
    if priv_protocol_input == 'AES128':
        priv_protocol = usmAesCfb128Protocol
    elif priv_protocol_input == 'DES56' or priv_protocol_input == 'DES':
        priv_protocol = usmDESPrivProtocol
    else:
        raise ValueError(f"Unsupported privacy protocol: {priv_protocol_input}")
    
    ne_node = {}

    # Fetch basic device information (sysName, sysDescr)
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
            ne_node[label] = str(errorIndication)
        elif errorStatus:
            ne_node[label] = f'{errorStatus.prettyPrint()} at {errorIndex and varBinds[int(errorIndex)-1][0] or "?"}'
        else:
            ne_node[label] = str(varBinds[0][1])

    fetch_oid('1.3.6.1.2.1.1.5.0', 'Device Name')  # sysName
    fetch_oid('1.3.6.1.2.1.1.1.0', 'Device Version')  # sysDescr
    
    # 获取设备接口信息
    ne_node['Interfaces'] = []
    interface_indexes = {}

    # 获取接口索引、描述和状态
    iterator = nextCmd(
        SnmpEngine(),
        UsmUserData(snmp_params['username'], snmp_params['auth_password'], snmp_params['priv_password'],
                    authProtocol=auth_protocol,
                    privProtocol=priv_protocol),
        UdpTransportTarget((snmp_params['ip'], 161), timeout=10.0, retries=5),
        ContextData(),
        ObjectType(ObjectIdentity('1.3.6.1.2.1.2.2.1.1')),  # ifIndex 接口索引
        ObjectType(ObjectIdentity('1.3.6.1.2.1.2.2.1.2')),  # ifDescr 接口描述
        ObjectType(ObjectIdentity('1.3.6.1.2.1.2.2.1.8')),  # ifOperStatus 接口状态
        lexicographicMode=False
    )

    # 先获取接口索引、描述和状态
    for errorIndication, errorStatus, errorIndex, varBinds in iterator:
        if errorIndication:
            logging.error(f"Error indication: {errorIndication}")
            break
        elif errorStatus:
            logging.error(f"Error status: {errorStatus.prettyPrint()}")
            break

        if_index = str(varBinds[0][1])  # 接口索引
        interface_info = {
            'Index': if_index,  # 接口索引
            'Description': str(varBinds[1][1]),  # 接口名称
            'Status': str(varBinds[2][1]),  # 接口状态
            'IP Address': None  # 占位符，稍后获取IP地址
        }
        ne_node['Interfaces'].append(interface_info)
        interface_indexes[if_index] = interface_info  # 存储接口索引以便后续查找

    # 获取每个接口的IP地址
    ip_iterator = nextCmd(
        SnmpEngine(),
        UsmUserData(snmp_params['username'], snmp_params['auth_password'], snmp_params['priv_password'],
                    authProtocol=auth_protocol,
                    privProtocol=priv_protocol),
        UdpTransportTarget((snmp_params['ip'], 161), timeout=10.0, retries=5),
        ContextData(),
        ObjectType(ObjectIdentity('1.3.6.1.2.1.4.20.1.2')),  # ipAdEntIfIndex 表示哪个接口有此IP
        ObjectType(ObjectIdentity('1.3.6.1.2.1.4.20.1.1')),  # ipAdEntAddr 对应的IP地址
        lexicographicMode=False
    )

    # 遍历IP地址表，将IP地址与接口索引匹配
    for errorIndication, errorStatus, errorIndex, varBinds in ip_iterator:
        if errorIndication:
            logging.error(f"Error indication: {errorIndication}")
            break
        elif errorStatus:
            logging.error(f"Error status: {errorStatus.prettyPrint()}")
            break

        ip_if_index = str(varBinds[0][1])  # 与接口匹配的索引
        raw_ip_address = varBinds[1][1]  # IP地址 (raw bytes)
        try:
            ip_address = socket.inet_ntoa(raw_ip_address.asOctets())  # 将原始字节转换为标准IP
        except Exception as e:
            logging.error(f"Failed to convert IP address: {e}")
            ip_address = None

        # 找到对应接口并设置IP地址
        if ip_if_index in interface_indexes:
            interface_indexes[ip_if_index]['IP Address'] = ip_address

    return ne_node

# Discover neighboring devices via SNMP
def discover_neighbors(device):
    """
    Discover neighbors using either LLDP or CDP depending on the device type.
    LLDP is used for non-Cisco devices, and CDP is used for Cisco devices.
    """
    snmp_params = filter_snmp_params(device)
    auth_protocol = usmHMACSHAAuthProtocol if snmp_params.get('auth_protocol') == 'SHA' else usmHMACMD5AuthProtocol
    priv_protocol_input = snmp_params.get('priv_protocol')
    
    if priv_protocol_input == 'AES128':
        priv_protocol = usmAesCfb128Protocol
    elif priv_protocol_input == 'DES56' or priv_protocol_input == 'DES':
        priv_protocol = usmDESPrivProtocol
    else:
        raise ValueError(f"Unsupported privacy protocol: {priv_protocol_input}")
    
    neighbors = []

    if device['device_type'] == 'cisco_ios':
        # 使用CDP发现邻居
        logging.debug(f"Using CDP to discover neighbors for Cisco device {device['device_name']}")
        iterator = nextCmd(
            SnmpEngine(),
            UsmUserData(snmp_params['username'], snmp_params['auth_password'], snmp_params['priv_password'],
                        authProtocol=auth_protocol,
                        privProtocol=priv_protocol),
            UdpTransportTarget((snmp_params['ip'], 161), timeout=10.0, retries=5),
            ContextData(),
            ObjectType(ObjectIdentity('1.3.6.1.4.1.9.9.23.1.2.1.1.6')),  # cdpCacheDeviceId
            ObjectType(ObjectIdentity('1.3.6.1.4.1.9.9.23.1.2.1.1.4')),  # cdpCacheAddress
            lexicographicMode=False
        )
    else:
        # 使用LLDP发现邻居
        logging.debug(f"Using LLDP to discover neighbors for non-Cisco device {device['device_name']}")
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
        
        # 处理不同协议返回的邻居信息
        if device['device_type'] == 'cisco_ios':
            # CDP 邻居发现
            ne_name = str(varBinds[0][1])  # Neighbor device's system name from CDP
            ne_ip = '.'.join(map(str, varBinds[1][1].asNumbers()))  # CDP uses cdpCacheAddress
            logging.debug(f"Discovered CDP neighbor: {ne_name}, IP: {ne_ip}")
        else:
            # LLDP 邻居发现
            ne_name = str(varBinds[0][1])  # Neighbor device's system name
            addr_oid = varBinds[1][0].prettyPrint()
            oid_parts = addr_oid.split('.')
            try:
                ne_ip = '.'.join(oid_parts[-4:])  # Last four parts of OID as IP address
            except Exception as e:
                logging.error(f"Failed to extract IP from OID: {e}")
                ne_ip = None


        if ne_ip is None or not is_valid_ip(ne_ip):
            logging.error(f"Invalid or missing IP address discovered: {ne_ip}")
            continue

        # Generate neighbor device key dynamically
        ne_device_key = ne_name
        ne_device = {
            'device_type': device['device_type'],
            'ne_type': device['ne_type'],
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

            # Add the connection (link) between the current device and the neighbor
            ne_connections.append((device['device_name'], ne_device['device_name']))    
    
    return neighbors, ne_connections
