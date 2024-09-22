from flask import current_app
from pymongo import MongoClient

class MongoDBClient:
    def __init__(self):
        # 从 Flask 的配置中获取 MongoDB 相关的配置值
        mongo_uri = current_app.config['MONGO_URI']
        self.client = MongoClient(mongo_uri)
        self.db = self.client[current_app.config['MONGO_DBNAME']]

    def get_collection(self, collection_name):
        return self.db[collection_name]

# 获取数据库连接实例
def get_db():
    return MongoDBClient()
