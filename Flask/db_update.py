import pymongo
from pymongo import MongoClient

def rename_network_fields():
    # 连接到 MongoDB
    client = MongoClient('mongodb://localhost:27017/')  # 替换为你的MongoDB连接信息
    db = client['your_database_name']  # 替换为你的数据库名称
    networks_collection = db['networks']  # 替换为你存储网络信息的集合名称

    # Step 1: 重命名网络名称字段 'title' -> 'network_name'
    print("Renaming 'title' to 'network_name' for all networks...")
    networks_collection.update_many(
        {},
        {"$rename": {"title": "network_name"}}
    )

    # Step 2: 重命名站点名称字段 'title' -> 'site_name' (对于嵌套的站点字段)
    print("Renaming 'title' to 'site_name' for all site entries...")
    networks_collection.update_many(
        {},
        {"$set": {
            "children": {
                "$map": {
                    "input": "$children",
                    "as": "site",
                    "in": {
                        "$mergeObjects": [
                            "$$site",
                            {"site_name": "$$site.title"}  # 新字段名
                        ]
                    }
                }
            }
        }}
    )

    # Step 3: 删除旧的 'title' 字段
    print("Removing old 'title' field from site entries...")
    networks_collection.update_many(
        {},
        {"$unset": {"children.$[].title": 1}}
    )

    print("Field renaming complete.")

if __name__ == "__main__":
    rename_network_fields()
