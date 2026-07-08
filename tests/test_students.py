# tests/test_students.py
import json
from backend.db import get_db_connection


def _insert_student(student_id: int, name: str) -> None:
    conn = get_db_connection()
    conn.execute("INSERT OR REPLACE INTO students (student_id, name) VALUES (?, ?)", (student_id, name))
    conn.commit()
    conn.close()


def test_add_student(client):
    payload = {"student_id": 1, "name": "API測試員", "gender": "女", "age": 60, "address": "測試地址"}
    resp = client.post("/api/students", data=json.dumps(payload), content_type="application/json")
    assert resp.status_code == 200

    conn = get_db_connection()
    row = conn.execute("SELECT name FROM students WHERE student_id = 1").fetchone()
    conn.close()
    assert row is not None
    assert row["name"] == "API測試員"


def test_add_student_duplicate_id(client):
    _insert_student(1, "原始學員")
    payload = {"student_id": 1, "name": "重複學員"}
    resp = client.post("/api/students", data=json.dumps(payload), content_type="application/json")
    assert resp.status_code == 400
    assert "已存在" in json.loads(resp.data)["error"]


def test_add_student_invalid_id_type(client):
    payload = {"student_id": "12345abc", "name": "API測試員"}
    resp = client.post("/api/students", data=json.dumps(payload), content_type="application/json")
    assert resp.status_code == 400


def test_add_student_null_name(client):
    payload = {"student_id": 1, "name": None}
    resp = client.post("/api/students", data=json.dumps(payload), content_type="application/json")
    assert resp.status_code == 400


def test_update_student(client):
    _insert_student(3, "原始姓名")
    payload = {"name": "更新姓名", "gender": "女", "mobile_phone": "0912345678"}
    resp = client.put("/api/students/3", data=json.dumps(payload), content_type="application/json")
    assert resp.status_code == 200

    conn = get_db_connection()
    row = conn.execute("SELECT name, gender, mobile_phone FROM students WHERE student_id = 3").fetchone()
    conn.close()
    assert row["name"] == "更新姓名"
    assert row["gender"] == "女"
    assert row["mobile_phone"] == "0912345678"


def test_update_student_not_found(client):
    payload = {"name": "不存在"}
    resp = client.put("/api/students/9999", data=json.dumps(payload), content_type="application/json")
    assert resp.status_code == 404


def test_delete_student_cascade(client):
    _insert_student(4, "待刪學員")
    conn = get_db_connection()
    conn.execute("INSERT INTO enrollments (student_id, season) VALUES (4, '第一季')")
    eid = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.execute("INSERT INTO courses (enrollment_id, course_name) VALUES (?, '測試課程')", (eid,))
    conn.commit()
    conn.close()

    resp = client.delete("/api/students/4")
    assert resp.status_code == 200

    conn = get_db_connection()
    assert conn.execute("SELECT COUNT(*) FROM students WHERE student_id = 4").fetchone()[0] == 0
    assert conn.execute("SELECT COUNT(*) FROM enrollments WHERE student_id = 4").fetchone()[0] == 0
    assert conn.execute("SELECT COUNT(*) FROM courses WHERE enrollment_id = ?", (eid,)).fetchone()[0] == 0
    conn.close()


def test_delete_student_not_found(client):
    resp = client.delete("/api/students/9999")
    assert resp.status_code == 404
