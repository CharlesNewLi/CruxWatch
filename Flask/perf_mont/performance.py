import logging
import socket
from pysnmp.hlapi import *
from cachetools import cached, TTLCache

# 设置缓存，大小为100，缓存时间300秒
cache = TTLCache(maxsize=100, ttl=300)

# 验证IP地址格式
def is_valid_ip(ip):
    try:
        socket.inet_aton(ip)
        return True
    except socket.error:
        return False

# 过滤出 SNMP 相关的参数
def filter_snmp_params(device_info):
    allowed_keys = ['ip', 'username', 'auth_protocol', 'auth_password', 'priv_protocol', 'priv_password']
    snmp_params = {}
    
    for key in allowed_keys:
        if key in device_info:
            snmp_params[key] = device_info[key]
        snmp_key = f'snmp_{key}'
        if snmp_key in device_info:
            snmp_params[key] = device_info[snmp_key]
    
    return snmp_params

# 获取 SNMP v3 数据
@cached(cache, key=lambda device: device['ip'])
def get_snmpv3_data(device):
    snmp_params = filter_snmp_params(device)
    auth_protocol = usmHMACSHAAuthProtocol if snmp_params.get('auth_protocol') == 'SHA' else usmHMACMD5AuthProtocol
    priv_protocol_input = snmp_params.get('priv_protocol')
    
    if priv_protocol_input == 'AES128':
        priv_protocol = usmAesCfb128Protocol
    elif priv_protocol_input in ['DES56', 'DES']:
        priv_protocol = usmDESPrivProtocol
    else:
        raise ValueError(f"Unsupported privacy protocol: {priv_protocol_input}")
    
    ne_node = {}

    # 定义针对不同设备类型的处理函数
    device_type = device.get('device_type', 'cisco_ios')  # 默认值为 cisco_ios
    if device_type == 'huawei':
        fetch_oid = lambda oid, label: fetch_oid_huawei(snmp_params, oid, label, ne_node)
    elif device_type == 'cisco_ios':
        fetch_oid = lambda oid, label: fetch_oid_cisco(snmp_params, oid, label, ne_node)

    # 获取基本设备信息 (sysName, sysDescr)
    fetch_oid('1.3.6.1.2.1.1.5.0', 'Device Name')  # sysName
    fetch_oid('1.3.6.1.2.1.1.1.0', 'Device Version')  # sysDescr
    
    # 获取设备接口信息
    ne_node['Interfaces'] = []
    interface_indexes = {}

    # 获取接口索引、描述和状态
    iterator = nextCmd(
        SnmpEngine(),
        UsmUserData(snmp_params['username'], snmp_params['auth_password'], snmp_params['priv_password'],
                    authProtocol=auth_protocol, privProtocol=priv_protocol),
        UdpTransportTarget((snmp_params['ip'], 161), timeout=15.0, retries=10),  # 增加超时时间和重试次数
        ContextData(),
        ObjectType(ObjectIdentity('1.3.6.1.2.1.2.2.1.1')),  # ifIndex 接口索引
        ObjectType(ObjectIdentity('1.3.6.1.2.1.2.2.1.2')),  # ifDescr 接口描述
        ObjectType(ObjectIdentity('1.3.6.1.2.1.2.2.1.8')),  # ifOperStatus 接口状态
        lexicographicMode=False
    )

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
                    authProtocol=auth_protocol, privProtocol=priv_protocol),
        UdpTransportTarget((snmp_params['ip'], 161), timeout=15.0, retries=10),  # 增加超时时间和重试次数
        ContextData(),
        ObjectType(ObjectIdentity('1.3.6.1.2.1.4.20.1.2')),  # ipAdEntIfIndex 表示哪个接口有此IP
        ObjectType(ObjectIdentity('1.3.6.1.2.1.4.20.1.1')),  # ipAdEntAddr 对应的IP地址
        lexicographicMode=False
    )

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

        if ip_if_index in interface_indexes:
            interface_indexes[ip_if_index]['IP Address'] = ip_address

    return ne_node

# Huawei设备的OID获取函数，增加超时和重试
# Huawei设备的OID获取函数，增加超时和重试
def fetch_oid_huawei(snmp_params, oid, label, ne_node):
    """ Huawei设备专用的fetch_oid逻辑 """
    try:
        iterator = getCmd(
            SnmpEngine(),
            UsmUserData(snmp_params['username'], snmp_params['auth_password'], snmp_params['priv_password'],
                        authProtocol=usmHMACSHAAuthProtocol, privProtocol=usmAesCfb128Protocol),
            UdpTransportTarget((snmp_params['ip'], 161), timeout=15.0, retries=10),  # 增加超时时间和重试次数
            ContextData(),
            ObjectType(ObjectIdentity(oid))
        )
        errorIndication, errorStatus, errorIndex, varBinds = next(iterator)
        if errorIndication:
            logging.error(f"SNMP error for OID {oid}: {errorIndication}")
            ne_node[label] = str(errorIndication)
        elif errorStatus:
            logging.error(f"SNMP error status for OID {oid}: {errorStatus.prettyPrint()}")
            ne_node[label] = f"{errorStatus.prettyPrint()} at {errorIndex and varBinds[int(errorIndex)-1][0] or '?'}"
        else:
            ne_node[label] = str(varBinds[0][1])
    except Exception as e:
        logging.error(f"Exception while fetching OID {oid}: {e}")
        ne_node[label] = f"Exception: {e}"

# Cisco设备的OID获取函数
def fetch_oid_cisco(snmp_params, oid, label, ne_node):
    """ Cisco设备专用的fetch_oid逻辑 """
    iterator = getCmd(
        SnmpEngine(),
        UsmUserData(snmp_params['username'], snmp_params['auth_password'], snmp_params['priv_password'],
                    authProtocol=usmHMACMD5AuthProtocol, privProtocol=usmDESPrivProtocol),
        UdpTransportTarget((snmp_params['ip'], 161), timeout=10.0, retries=5),
        ContextData(),
        ObjectType(ObjectIdentity(oid))
    )
    errorIndication, errorStatus, errorIndex, varBinds = next(iterator)
    if errorIndication:
        logging.error(f"SNMP error for OID {oid}: {errorIndication}")
        ne_node[label] = str(errorIndication)
    elif errorStatus:
        logging.error(f"SNMP error status for OID {oid}: {errorStatus.prettyPrint()}")
        ne_node[label] = f"{errorStatus.prettyPrint()} at {errorIndex and varBinds[int(errorIndex)-1][0] or '?'}"
    else:
        ne_node[label] = str(varBinds[0][1])

# Cisco设备的OID获取函数
def fetch_oid_cisco(snmp_params, oid, label, ne_node):
    """ Cisco设备专用的fetch_oid逻辑 """
    iterator = getCmd(
        SnmpEngine(),
        UsmUserData(snmp_params['username'], snmp_params['auth_password'], snmp_params['priv_password'],
                    authProtocol=usmHMACMD5AuthProtocol, privProtocol=usmDESPrivProtocol),
        UdpTransportTarget((snmp_params['ip'], 161), timeout=10.0, retries=5),
        ContextData(),
        ObjectType(ObjectIdentity(oid))
    )
    errorIndication, errorStatus, errorIndex, varBinds = next(iterator)
    if errorIndication:
        logging.error(f"SNMP error for OID {oid}: {errorIndication}")
        ne_node[label] = str(errorIndication)
    elif errorStatus:
        logging.error(f"SNMP error status for OID {oid}: {errorStatus.prettyPrint()}")
        ne_node[label] = f"{errorStatus.prettyPrint()} at {errorIndex and varBinds[int(errorIndex)-1][0] or '?'}"
    else:
        ne_node[label] = str(varBinds[0][1])