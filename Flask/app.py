from flask import Flask
from network_mgmt import *
# from conf_mgmt import conf_mgmt_bp
# from perf_mont import perf_mont_bp
# from fault_mgmt import fault_mgmt_bp
# from sec_mgmt import sec_mgmt_bp

app = Flask(__name__)

app.register_blueprint(network_mgmt_bp, url_prefix='/network')

'''
app.register_blueprint(conf_mgmt_bp, url_prefix='/configuration')
app.register_blueprint(perf_mont_bp, url_prefix='/performance')
app.register_blueprint(fault_mgmt_bp, url_prefix='/fault')
app.register_blueprint(sec_mgmt_bp, url_prefix='/security')
'''

@app.route('/')
def hello_world():
    return 'Hello, 123!'

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8888)