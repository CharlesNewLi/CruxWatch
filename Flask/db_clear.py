from flask import Flask
from config import Config  # 导入 Config 类
from services.db import get_db

# 创建 Flask 应用实例
app = Flask(__name__)
app.config.from_object(Config)  # 从 Config 类加载配置

def db_clear():
    try:
        print("Attempting to connect to MongoDB...")
        
        # 使用应用上下文来支持数据库连接
        with app.app_context():
            db = get_db()
            print("Connected to MongoDB...")

            # 获取当前数据库中的所有集合名称
            collections = db.db.list_collection_names()
            print("Collections in the database:", collections)
            
            # 遍历每个集合并删除所有文档
            for collection_name in collections:
                collection = db.get_collection(collection_name)
                delete_result = collection.delete_many({})  # 删除集合中的所有文档
                print(f"Cleared {delete_result.deleted_count} documents from collection '{collection_name}'")
            
            print("All collections cleared successfully!")
    except Exception as e:
        print("Error occurred:", e)  # 打印错误详细信息到终端

if __name__ == '__main__':
    db_clear()  # 调用函数直接执行清空数据库操作