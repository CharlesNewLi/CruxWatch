from flask import Flask, jsonify
from bson import ObjectId  # 导入 ObjectId 类型
from config import Config  # 导入 Config 类
from services.db import get_db

app = Flask(__name__)
app.config.from_object(Config)  # 从 Config 类加载配置

# 自定义的 JSON 转换器，用来将 ObjectId 转换为字符串
def convert_objectid_to_str(doc):
    if isinstance(doc, list):
        return [convert_objectid_to_str(item) for item in doc]
    elif isinstance(doc, dict):
        return {key: (str(value) if isinstance(value, ObjectId) else convert_objectid_to_str(value)) for key, value in doc.items()}
    else:
        return doc

@app.route('/db_get', methods=['GET'])
def db_get():
    try:
        print("Attempting to connect to MongoDB...")
        db = get_db()
        print("Connected to MongoDB...")

        # 获取当前数据库中的所有集合名称
        collections = db.db.list_collection_names()
        print("Collections in the database:", collections)
        
        all_data = {}
        # 遍历每个集合并打印所有文档
        for collection_name in collections:
            collection = db.get_collection(collection_name)
            documents = list(collection.find())  # 查询所有文档
            documents = convert_objectid_to_str(documents)  # 将 ObjectId 转换为字符串
            all_data[collection_name] = documents  # 将每个集合的文档存入字典

            print(f"\nDocuments in collection '{collection_name}':")
            for doc in documents:
                print(doc)
        
        return jsonify({"status": "success", "data": all_data}), 200
    except Exception as e:
        print("Error occurred:", e)  # 打印错误详细信息到终端
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)