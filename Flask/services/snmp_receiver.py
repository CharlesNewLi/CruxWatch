import threading
import logging
from pysnmp.hlapi.asyncore import *
from pysnmp.carrier.asyncore.dispatch import AsyncoreDispatcher
from pysnmp.carrier.asyncore.dgram import udp
from pysnmp.entity.rfc3413 import ntfrcv

snmp_traps = []

def snmp_trap_receiver(socketio):
    def callback_fun(snmpEngine, stateReference, contextEngineId, contextName, varBinds, cbCtx):
        trap_data = {str(name): str(val) for name, val in varBinds}
        
        # 打印收到的 Trap 数据
        logging.info(f'SNMP Trap received: {trap_data}')
        print(f"SNMP Trap received: {trap_data}")
        
        snmp_traps.append(trap_data)
        socketio.emit('new_snmp_trap', trap_data)  # 将 SNMP Trap 发送到前端

    snmpEngine = SnmpEngine()

    # 监听 UDP 端口 162，用于接收 SNMP Trap
    transportDispatcher = AsyncoreDispatcher()
    try:
        # 打印消息确认端口绑定情况
        logging.info("Starting SNMP Trap receiver on port 162...")
        print("Starting SNMP Trap receiver on port 162...")
        
        transportDispatcher.registerTransport(
            udp.domainName, udp.UdpTransport().openServerMode(('0.0.0.0', 162))
        )

        ntfrcv.NotificationReceiver(snmpEngine, callback_fun)

        transportDispatcher.jobStarted(1)  # 开始接收Trap

        # 打印运行状态
        logging.info("SNMP Trap receiver is running...")
        print("SNMP Trap receiver is running...")

        transportDispatcher.runDispatcher()

    except Exception as e:
        transportDispatcher.closeDispatcher()
        logging.error(f"Error in SNMP Trap receiver: {e}")
        print(f"Error in SNMP Trap receiver: {e}")
        socketio.emit('snmp_error', {'error': str(e)})  # 将错误发送到前端

# 启动接收器线程
def start_snmp_receiver(socketio):
    logging.info("Starting SNMP Trap receiver thread...")
    print("Starting SNMP Trap receiver thread...")
    
    threading.Thread(target=snmp_trap_receiver, args=(socketio,)).start()