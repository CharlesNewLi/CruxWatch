from flask import Blueprint, render_template
from network_mgmt.routes import network_mgmt_bp
from network_mgmt.ne_mgmt.routes import ne_mgmt_bp

# Define a base blueprint for the homepage
base_bp = Blueprint('base_bp', __name__)

@base_bp.route('/')
def homepage():
    return render_template('homepage.html')

# Centralized function to register blueprints
def register_blueprints(app):
    app.register_blueprint(base_bp)  # Homepage blueprint
    app.register_blueprint(network_mgmt_bp, url_prefix='/networks')  # Network management blueprint
    app.register_blueprint(ne_mgmt_bp, url_prefix='/')  # Static prefix for network management, dynamic part in route