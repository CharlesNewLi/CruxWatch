import os

class Config:
    """Base configuration."""
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'supersecretkey'
    SESSION_COOKIE_NAME = 'cruxwatch_session'
    DEBUG = False
    TESTING = False

    # MongoDB 配置（使用 'MongoDB' 作为数据库名称）
    MONGO_URI = os.environ.get('MONGO_URI') or 'mongodb://localhost:27017/MongoDB'
    MONGO_DBNAME = 'MongoDB'

    SECURITY_PASSWORD_SALT = os.environ.get('SECURITY_PASSWORD_SALT') or 'supersecretsalt'
    SECURITY_REGISTERABLE = True
    SECURITY_CONFIRMABLE = False
    SECURITY_RECOVERABLE = True

    CORS_HEADERS = 'Content-Type'

class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True
    MONGO_URI = 'mongodb://localhost:27017/MongoDB_dev'  # 开发环境的数据库可以使用类似的名称
    ENV = 'development'

class ProductionConfig(Config):
    """Production configuration."""
    DEBUG = False
    MONGO_URI = os.environ.get('MONGO_URI') or 'mongodb://localhost:27017/MongoDB'  # 生产环境数据库名称保持为MongoDB
    ENV = 'production'
    SECRET_KEY = os.environ.get('SECRET_KEY')

class TestingConfig(Config):
    """Testing configuration."""
    TESTING = True
    DEBUG = True
    MONGO_URI = 'mongodb://localhost:27017/MongoDB_test'  # 测试环境的数据库名称
    ENV = 'testing'


# 使用一个字典来映射不同的环境
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
}