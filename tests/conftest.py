# tests/conftest.py（使用暫時檔案，讓所有連線共享同一 DB）
import os
import sqlite3
import tempfile
import pytest

# 建立暫時 DB 檔案，設定環境變數（必須在 import backend 之前）
_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_tmp.close()
os.environ["DB_PATH"] = _tmp.name

from backend.app import app as flask_app
from backend.db import get_db_connection


def _create_all_tables(conn: sqlite3.Connection) -> None:
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS students (
            student_id INTEGER PRIMARY KEY,
            original_id TEXT,
            name TEXT NOT NULL,
            gender TEXT,
            birth_date TEXT,
            age INTEGER,
            is_60_plus TEXT,
            address TEXT,
            home_phone TEXT,
            mobile_phone TEXT,
            emergency_contact TEXT,
            relationship TEXT,
            emergency_contact_phone TEXT,
            education TEXT,
            occupation TEXT
        );
        CREATE TABLE IF NOT EXISTS enrollments (
            enrollment_id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER,
            season TEXT NOT NULL,
            reg_type TEXT,
            pre_test TEXT,
            post_test TEXT,
            refunded INTEGER DEFAULT 0,
            refund_info TEXT
        );
        CREATE TABLE IF NOT EXISTS courses (
            course_id INTEGER PRIMARY KEY AUTOINCREMENT,
            enrollment_id INTEGER,
            course_name TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sync_metadata (
            key TEXT PRIMARY KEY,
            value TEXT
        );
    """)
    conn.commit()


@pytest.fixture(autouse=False)
def client():
    """每個測試使用乾淨的資料庫狀態。"""
    flask_app.config["TESTING"] = True
    # 清空並重建資料表
    conn = get_db_connection()
    conn.executescript("""
        DROP TABLE IF EXISTS courses;
        DROP TABLE IF EXISTS enrollments;
        DROP TABLE IF EXISTS students;
        DROP TABLE IF EXISTS sync_metadata;
    """)
    _create_all_tables(conn)
    conn.close()
    with flask_app.test_client() as c:
        yield c
