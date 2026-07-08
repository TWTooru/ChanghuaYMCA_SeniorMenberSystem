# tests/test_enrollments.py
import json
from backend.db import get_db_connection


def _insert_student(student_id: int, name: str) -> None:
    conn = get_db_connection()
    conn.execute("INSERT OR REPLACE INTO students (student_id, name) VALUES (?, ?)", (student_id, name))
    conn.commit()
    conn.close()


def test_add_enrollment(client):
    _insert_student(2, "選課測試員")
    payload = {
        "student_id": 2, "season": "112-1", "reg_type": "新",
        "pre_test": "80", "post_test": "90", "refunded": False,
        "refund_info": "", "courses": "課程A, 課程B"
    }
    resp = client.post("/api/enrollments", data=json.dumps(payload), content_type="application/json")
    assert resp.status_code == 200

    conn = get_db_connection()
    row = conn.execute("SELECT enrollment_id FROM enrollments WHERE student_id = 2 AND season = '112-1'").fetchone()
    assert row is not None
    courses = [r["course_name"] for r in conn.execute("SELECT course_name FROM courses WHERE enrollment_id = ?", (row["enrollment_id"],)).fetchall()]
    assert "課程A" in courses
    assert "課程B" in courses
    conn.close()


def test_add_enrollment_invalid_season_type(client):
    _insert_student(2, "選課測試員")
    payload = {"student_id": 2, "season": 112, "courses": "課程A"}
    resp = client.post("/api/enrollments", data=json.dumps(payload), content_type="application/json")
    assert resp.status_code == 400


def test_add_enrollment_null_courses_allowed(client):
    _insert_student(2, "選課測試員")
    payload = {"student_id": 2, "season": "112-1", "courses": None}
    resp = client.post("/api/enrollments", data=json.dumps(payload), content_type="application/json")
    assert resp.status_code == 200


def test_add_enrollment_invalid_courses_type(client):
    _insert_student(2, "選課測試員")
    payload = {"student_id": 2, "season": "112-1", "courses": 123}
    resp = client.post("/api/enrollments", data=json.dumps(payload), content_type="application/json")
    assert resp.status_code == 400


def test_add_enrollment_student_not_found(client):
    payload = {"student_id": 9999, "season": "112-1", "courses": "課程A"}
    resp = client.post("/api/enrollments", data=json.dumps(payload), content_type="application/json")
    assert resp.status_code == 400
    assert "不存在" in json.loads(resp.data)["error"]


def test_update_enrollment(client):
    _insert_student(5, "選課更新測試")
    conn = get_db_connection()
    conn.execute("INSERT INTO enrollments (student_id, season, reg_type) VALUES (5, '第一季', '新')")
    eid = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.execute("INSERT INTO courses (enrollment_id, course_name) VALUES (?, '舊課程')", (eid,))
    conn.commit()
    conn.close()

    payload = {"season": "第二季", "reg_type": "續", "pre_test": "85", "post_test": "90",
               "refunded": False, "refund_info": "", "courses": "新課程A, 新課程B"}
    resp = client.put(f"/api/enrollments/{eid}", data=json.dumps(payload), content_type="application/json")
    assert resp.status_code == 200

    conn = get_db_connection()
    row = conn.execute("SELECT season, reg_type FROM enrollments WHERE enrollment_id = ?", (eid,)).fetchone()
    assert row["season"] == "第二季"
    assert row["reg_type"] == "續"
    courses = [r["course_name"] for r in conn.execute("SELECT course_name FROM courses WHERE enrollment_id = ?", (eid,)).fetchall()]
    assert "新課程A" in courses
    assert "新課程B" in courses
    assert "舊課程" not in courses
    conn.close()


def test_update_enrollment_not_found(client):
    payload = {"season": "第一季"}
    resp = client.put("/api/enrollments/99999", data=json.dumps(payload), content_type="application/json")
    assert resp.status_code == 404


def test_delete_enrollment_cascade(client):
    _insert_student(6, "選課刪除測試")
    conn = get_db_connection()
    conn.execute("INSERT INTO enrollments (student_id, season) VALUES (6, '第一季')")
    eid = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.execute("INSERT INTO courses (enrollment_id, course_name) VALUES (?, '待刪課程')", (eid,))
    conn.commit()
    conn.close()

    resp = client.delete(f"/api/enrollments/{eid}")
    assert resp.status_code == 200

    conn = get_db_connection()
    assert conn.execute("SELECT COUNT(*) FROM enrollments WHERE enrollment_id = ?", (eid,)).fetchone()[0] == 0
    assert conn.execute("SELECT COUNT(*) FROM courses WHERE enrollment_id = ?", (eid,)).fetchone()[0] == 0
    conn.close()


def test_delete_enrollment_not_found(client):
    resp = client.delete("/api/enrollments/99999")
    assert resp.status_code == 404
