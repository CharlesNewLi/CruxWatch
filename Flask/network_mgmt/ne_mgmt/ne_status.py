from pysnmp.hlapi import *
from network_mgmt.global_data import devices

# 过滤出SNMP相关的参数
def filter_snmp_params(device_info):
    allowed_keys = ['ip', 'auth_protocol', 'auth_password', 'priv_protocol', 'priv_password', 'username']
    snmp_params = {}
    
    for key in allowed_keys:
        if key in device_info:
            snmp_params[key] = device_info[key]
        snmp_key = f'snmp_{key}'
        if snmp_key in device_info:
            snmp_params[key] = device_info[snmp_key]

    return snmp_params

# 简单通过SNMP检测设备是否在线
def device_status_snmp(device):
    snmp_params = filter_snmp_params(device)
    auth_protocol = usmHMACSHAAuthProtocol if snmp_params.get('auth_protocol') == 'SHA' else usmHMACMD5AuthProtocol
    priv_protocol_input = snmp_params.get('priv_protocol')
    
    if priv_protocol_input == 'AES128':
        priv_protocol = usmAesCfb128Protocol
    elif priv_protocol_input == 'DES56' or priv_protocol_input == 'DES':
        priv_protocol = usmDESPrivProtocol
    else:
        raise ValueError(f"Unsupported privacy protocol: {priv_protocol_input}")

    iterator = getCmd(
        SnmpEngine(),
        UsmUserData(snmp_params['username'], snmp_params['auth_password'], snmp_params['priv_password'],
                    authProtocol=auth_protocol, privProtocol=priv_protocol),
        UdpTransportTarget((snmp_params['ip'], 161), timeout=2.0, retries=2),
        ContextData(),
        ObjectType(ObjectIdentity('1.3.6.1.2.1.1.5.0'))  # sysName OID
    )

    errorIndication, errorStatus, errorIndex, varBinds = next(iterator)

    # 如果能成功返回则设备在线
    if errorIndication or errorStatus:
        return False  # 设备不在线
    return True  # 设备在线

# 使用SNMP检查设备的在线状态
def check_all_devices():
    for ne_name, device in devices.items():
        try:
            # 通过SNMP检查设备是否在线
            if device_status_snmp(device):
                device['status'] = 'online'
            else:
                device['status'] = 'offline'
        except Exception as e:
            device['status'] = 'offline'

        # 打印每个设备的状态
        print(f"Device {ne_name} status: {device['status']}")