from bson import ObjectId

# Helper function to convert ObjectId to string in MongoDB documents
def convert_objectid_to_str(documents):
    if isinstance(documents, list):
        for document in documents:
            document = _convert_doc_objectid_to_str(document)
    elif isinstance(documents, dict):
        documents = _convert_doc_objectid_to_str(documents)
    return documents

# Internal function to handle single document conversion
def _convert_doc_objectid_to_str(document):
    if '_id' in document and isinstance(document['_id'], ObjectId):
        document['_id'] = str(document['_id'])
    # Recursively handle nested fields, such as "children"
    for key, value in document.items():
        if isinstance(value, list):
            for item in value:
                if isinstance(item, dict):
                    _convert_doc_objectid_to_str(item)
        elif isinstance(value, dict):
            _convert_doc_objectid_to_str(value)
    return document