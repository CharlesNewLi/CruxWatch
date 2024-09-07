from flask import Flask, jsonify
from config import Config  # 导入 Config 类
from services.db import get_db

app = Flask(__name__)
app.config.from_object(Config)  # 从 Config 类加载配置

@app.route('/test_db', methods=['GET'])
def test_db():
    try:
        print("Attempting to connect to MongoDB...")
        db = get_db()
        print("Connected to MongoDB...")
        test_collection = db.get_collection('test_collection')
        
        # 在集合中插入一条文档
        print("Inserting document into collection...")
        test_collection.insert_one({"message": "MongoDB connection successful!"})
        
        # 查询刚插入的文档
        print("Querying inserted document...")
        result = test_collection.find_one({"message": "MongoDB connection successful!"})
        
        print("Document found:", result)
        return jsonify({"message": result['message']}), 200
    except Exception as e:
        print("Error occurred:", e)  # 打印错误详细信息到终端
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)