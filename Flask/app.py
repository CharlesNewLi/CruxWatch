from flask import Flask
from flask_cors import CORS
from config import config
from services.routes import register_blueprints

app = Flask(__name__) 
app.config.from_object(config['development'])  # Ensure correct config object is used
CORS(app)

register_blueprints(app)

print(app.url_map)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8888)