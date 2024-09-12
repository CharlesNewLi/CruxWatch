import json
from bson import ObjectId

# Main function to serialize MongoDB documents and handle non-serializable fields
def serialize_documents(documents):
    if isinstance(documents, list):
        return [serialize_document(doc) for doc in documents]
    elif isinstance(documents, dict):
        return serialize_document(documents)
    return documents

# Internal function to handle a single document's serialization
def serialize_document(document):
    if isinstance(document, dict):
        if '_id' in document and isinstance(document['_id'], ObjectId):
            document['_id'] = str(document['_id'])
        # Recursively serialize nested lists and dicts
        for key, value in document.items():
            if isinstance(value, list):
                document[key] = [serialize_document(item) if isinstance(item, dict) else item for item in value]
            elif isinstance(value, dict):
                document[key] = serialize_document(value)
            else:
                document[key] = serialize_non_serializable(value)
    return document

# Function to handle non-serializable fields like custom objects (e.g., HuaweiSSH object)
def serialize_non_serializable(value):
    try:
        # Try to serialize using JSON
        json.dumps(value)
        return value
    except (TypeError, OverflowError):
        # For objects like Netmiko connections, return their string representation
        return str(value)

# Helper function to convert ObjectId to string if it's a single ObjectId
def serialize_objectid(value):
    if isinstance(value, ObjectId):
        return str(value)
    return value
