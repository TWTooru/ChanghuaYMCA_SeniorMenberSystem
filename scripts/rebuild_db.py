import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "students.db")

def rebuild():
    conn = sqlite3.connect(DB_PATH)
    # 關閉外鍵約束
    conn.execute("PRAGMA foreign_keys = OFF;")
    cursor = conn.cursor()

    cursor.execute("DELETE FROM courses;")
    cursor.execute("DELETE FROM enrollments;")
    cursor.execute("DELETE FROM students;")
    cursor.execute("DELETE FROM sync_metadata;")
    
    conn.commit()
    conn.close()
    print("Database tables cleared. Ready for full sync.")

if __name__ == "__main__":
    rebuild()
