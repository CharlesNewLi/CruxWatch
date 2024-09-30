from flask import Flask, request
from flask_cors import CORS
from config import config
from services.routes import register_blueprints
from flask_socketio import SocketIO, emit
from services.ssh_cli import ssh_cli, close_ssh_connection # 正确导入 ssh_cli 函数
from services.snmp_receiver import start_snmp_receiver
import logging

# 配置日志记录
logging.basicConfig(level=logging.INFO)

app = Flask(__name__)
app.config.from_object(config['development'])  # 确保正确的配置对象
CORS(app, resources={r"/*": {"origins": "*"}})

# 设置 Flask-SocketIO
socketio = SocketIO(app, cors_allowed_origins="*", logger=True, engineio_logger=True)

# 启动 SNMP Trap 接收器
start_snmp_receiver(socketio)

# 注册蓝图
register_blueprints(app)

@app.before_request
def before_request():
    logging.info(f"Requested path: {request.path}, method: {request.method}")

logging.info(app.url_map)

# 定义 WebSocket 事件处理程序
@socketio.on('connect')
def handle_connect():
    logging.info('Client connected')
    emit('response', {'message': 'Connected to WebSocket!'})

@socketio.on('disconnect')
def handle_disconnect():
    client_id = request.sid  # 获取WebSocket客户端的唯一ID
    close_ssh_connection(client_id)
    logging.info('Client disconnected')

# 将 initialize_ssh 事件绑定到独立的服务函数
@socketio.on('initialize_ssh')
def on_initialize_ssh(data):
    logging.info(f"Received initialize_ssh event with data: {data}")
    client_id = request.sid  # 获取WebSocket客户端的唯一ID
    try:
        result = ssh_cli(client_id, data)  # 传递 client_id 和 data
        emit('command_output', {'output': result})  # 将结果发送给前端
    except Exception as e:
        logging.error(f"Error in SSH CLI execution: {str(e)}")
        emit('command_output', {'output': f"Error: {str(e)}"})

@socketio.on('execute_command')
def on_execute_command(data):
    logging.info(f"Received execute_command event with data: {data}")
    client_id = request.sid  # 获取WebSocket客户端的唯一ID
    try:
        result = ssh_cli(client_id, data)  # 传递 client_id 和 data
        emit('command_output', {'output': result})  # 将结果发送给前端
    except Exception as e:
        logging.error(f"Error in SSH command execution: {str(e)}")
        emit('command_output', {'output': f"Error: {str(e)}"})

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=8888)