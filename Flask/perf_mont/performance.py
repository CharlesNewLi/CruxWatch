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

# 获取 SNMP v3 数据
@cached(cache, key=lambda device: device['ip'])
def get_snmpv3_data(device):
    snmp_params = device
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
    fetch_oid('1.3.6.1.2.1.25.3.3.1.2.1', 'CPU Metrics')  # hrProcessorLoad
    fetch_oid('1.3.6.1.2.1.25.2.3.1.6.1', 'Storage Metrics')  # hrStorageUsed
  
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
        ObjectType(ObjectIdentity('1.3.6.1.2.1.2.2.1.10')),  # ifInOctets 接收到的字节数
        ObjectType(ObjectIdentity('1.3.6.1.2.1.2.2.1.16')),  # ifOutOctets 发送的字节数
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
            'IP Address': None,  # 占位符，稍后获取IP地址
            'InOctets': str(varBinds[3][1]),  # 接收到的字节数
            'OutOctets': str(varBinds[4][1]),  # 发送的字节数
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