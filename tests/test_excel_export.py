# tests/test_excel_export.py


def test_download_excel_empty_db(client):
    """空資料庫也能正常匯出，不炸裂。"""
    resp = client.get("/api/download-excel")
    assert resp.status_code == 200
    assert resp.mimetype == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert len(resp.data) > 0


def test_download_excel_with_data(client):
    """有資料時回傳正確格式且檔案非空。"""
    from backend.db import get_db_connection
    conn = get_db_connection()
    conn.execute("INSERT INTO students (student_id, name) VALUES (1, '測試學員')")
    conn.execute("INSERT INTO enrollments (student_id, season, refunded) VALUES (1, '第一季', 0)")
    eid = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.execute("INSERT INTO courses (enrollment_id, course_name) VALUES (?, '舞蹈')", (eid,))
    conn.commit()
    conn.close()

    resp = client.get("/api/download-excel")
    assert resp.status_code == 200
    assert resp.mimetype == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert len(resp.data) > 5000  # Excel 檔案不應該是空的
