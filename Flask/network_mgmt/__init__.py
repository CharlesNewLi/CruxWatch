from flask import Blueprint

# 创建 network_mgmt 蓝图
network_mgmt_bp = Blueprint('network_mgmt', __name__)


from . import hw_disc, hw_init

__all__ = ['network_mgmt_bp'] 