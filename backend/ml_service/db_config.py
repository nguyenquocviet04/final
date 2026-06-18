# ml_service/db_config.py
# Cấu hình kết nối MySQL - đọc từ biến môi trường trên Render hoặc dùng mặc định ở local

import os
import mysql.connector

def get_connection():
    """Tạo kết nối mới đến MySQL"""
    return mysql.connector.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        port=int(os.environ.get("DB_PORT", 3306)),
        user=os.environ.get("DB_USER", "root"),
        password=os.environ.get("DB_PASSWORD", "123456"),
        database=os.environ.get("DB_NAME", "expense_management"),
        charset="utf8mb4",
        
        # Bắt buộc cho Aiven Database
        ssl_disabled=False,
        ssl_verify_cert=False  # Tương đương rejectUnauthorized: false bên Node.js
    )