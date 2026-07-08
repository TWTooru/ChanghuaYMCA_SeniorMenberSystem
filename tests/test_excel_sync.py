import unittest
import os
import sqlite3
import pandas as pd
from backend.excel_sync import clean_score, clean_course_name, sync_excel_data


def test_clean_score():
    # 正常數字
    assert clean_score(85) == "85"
    assert clean_score(72.0) == "72"
    assert clean_score("60") == "60"
    
    # 髒資料（日期、字串、空值）
    assert clean_score("2021-11-04 00:00:00") is None
    assert clean_score("缺考") is None
    assert clean_score(pd.NaT) is None
    assert clean_score(float('nan')) is None

def test_clean_course_name():
    # 正常課程
    assert clean_course_name("索朗舞") == "索朗舞"
    assert clean_course_name(" 老化與健康 ") == "老化與健康"
    
    # 髒資料（時間戳、Unnamed）
    assert clean_course_name("2026-06-29 22:03:23.328000") is None
    assert clean_course_name("00:00:00") is None
    assert clean_course_name("Unnamed: 20") is None
    assert clean_course_name(pd.NaT) is None
    assert clean_course_name(float('nan')) is None

def test_sync_excel_data_real_structure():
    db_path = "test_real_sync.db"
    excel_path = "test_real_sync.xlsx"
    
    if os.path.exists(db_path):
        os.remove(db_path)
    
    # 建立模擬真實結構的 Excel，包含「總表」、「第一季」與「第二季」
    with pd.ExcelWriter(excel_path) as writer:
        df_master = pd.DataFrame({"學員編號": [1]})
        df_master.to_excel(writer, sheet_name="總表", index=False)
        
        df_s1 = pd.DataFrame({
            "學員編號": [1],
            "姓名": ["測試員"],
            "性別": ["男"],
            "第一季前測": ["2021-11-04 00:00:00"], # 髒資料
            "第一季後測": ["80"],
            "新/續": ["新"],
            "課程1": ["索朗舞"],
            "課程2": ["Unnamed: 20"], # 髒資料
            "2026-06-29 22:03:23.328000": ["奇怪資料"] # 不應解析這欄
        })
        df_s1.to_excel(writer, sheet_name="第一季", index=False)
        
        df_s2 = pd.DataFrame({
            "學員編號": [1],
            "姓名": ["測試員改名"], # 應覆蓋前一季的名字
            "性別": ["男"],
            "第二季前測": ["70"],
            "第二季後測": ["85"],
            "新/續": ["續"],
            "課程1": ["進階舞蹈"]
        })
        df_s2.to_excel(writer, sheet_name="第二季", index=False)

        # (在 df_s2.to_excel 之後新增退費分頁)
        df_refund = pd.DataFrame({
            "學員編號": [1],
            "姓名": ["測試員改名"]
        })
        df_refund.to_excel(writer, sheet_name="第二季退費", index=False)
    
    # 準備乾淨的資料庫表結構
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute("CREATE TABLE students (student_id INTEGER PRIMARY KEY, original_id TEXT, name TEXT, gender TEXT, birth_date TEXT, age INTEGER, is_60_plus TEXT, address TEXT, home_phone TEXT, mobile_phone TEXT, emergency_contact TEXT, relationship TEXT, emergency_contact_phone TEXT, education TEXT, occupation TEXT)")
    c.execute("CREATE TABLE enrollments (enrollment_id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER, season TEXT, reg_type TEXT, pre_test TEXT, post_test TEXT, refunded INTEGER DEFAULT 0, refund_info TEXT)")
    c.execute("CREATE TABLE courses (course_id INTEGER PRIMARY KEY AUTOINCREMENT, enrollment_id INTEGER, course_name TEXT)")
    conn.commit()
    conn.close()

    # 執行同步
    success = sync_excel_data(db_path, excel_path)
    assert success is True
    
    # 驗證
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    
    # 學員資料應被第二季覆蓋
    c.execute("SELECT name FROM students WHERE student_id = 1")
    row = c.fetchone()
    assert row[0] == "測試員改名"
    
    # 驗證第一季選課：前測髒資料被清空，後測正常
    c.execute("SELECT pre_test, post_test FROM enrollments WHERE season = '第一季' AND student_id = 1")
    e1 = c.fetchone()
    assert e1[0] is None
    assert e1[1] == "80"
    
    # 驗證第一季課程：只應有一門
    c.execute("SELECT course_name FROM courses WHERE enrollment_id = (SELECT enrollment_id FROM enrollments WHERE season = '第一季')")
    c1_list = [r[0] for r in c.fetchall()]
    assert len(c1_list) == 1
    assert "索朗舞" in c1_list

    c.execute("SELECT refunded FROM enrollments WHERE season = '第二季' AND student_id = 1")
    assert c.fetchone()[0] == 1
    
    conn.close()
    os.remove(db_path)
    os.remove(excel_path)

def test_smart_merge_preserves_web_data():
    db_path = "test_merge.db"
    excel_path = "test_merge.xlsx"
    
    if os.path.exists(db_path):
        os.remove(db_path)
        
    # 建立一個測試用的 Excel
    with pd.ExcelWriter(excel_path) as writer:
        df_s1 = pd.DataFrame({
            "學員編號": [1],
            "姓名": ["測試員"]
        })
        df_s1.to_excel(writer, sheet_name="第一季", index=False)
        
    # 建立資料庫與手動插入的資料
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute("CREATE TABLE students (student_id INTEGER PRIMARY KEY, original_id TEXT, name TEXT, gender TEXT, birth_date TEXT, age INTEGER, is_60_plus TEXT, address TEXT, home_phone TEXT, mobile_phone TEXT, emergency_contact TEXT, relationship TEXT, emergency_contact_phone TEXT, education TEXT, occupation TEXT)")
    c.execute("CREATE TABLE enrollments (enrollment_id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER, season TEXT, reg_type TEXT, pre_test TEXT, post_test TEXT, refunded INTEGER DEFAULT 0, refund_info TEXT)")
    c.execute("CREATE TABLE courses (course_id INTEGER PRIMARY KEY AUTOINCREMENT, enrollment_id INTEGER, course_name TEXT)")
    c.execute("INSERT INTO students (student_id, name) VALUES (999, '網頁測試生')")
    conn.commit()
    conn.close()
    
    # 執行同步
    sync_excel_data(db_path, excel_path)
    
    # 驗證
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    
    c.execute("SELECT name FROM students WHERE student_id = 999")
    row = c.fetchone()
    assert row is not None
    assert row[0] == "網頁測試生"
    
    c.execute("SELECT name FROM students WHERE student_id = 1")
    row = c.fetchone()
    assert row is not None
    assert row[0] == "測試員"
    
    conn.close()
    os.remove(db_path)
    os.remove(excel_path)

