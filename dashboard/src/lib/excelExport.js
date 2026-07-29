import * as XLSX from 'xlsx';

/**
 * 依 `options` 決定儀表板資料要輸出的工作表，並將學生、報名與課程資料整理為適合匯出格式。
 * 支援省略 `filename` 而直接提供 `options` 的呼叫方式；未選取任何工作表時提前結束，
 * 避免將空白活頁簿交由 `SheetJS` 輸出。
 */
export function exportToExcel(studentsData, enrollmentsData, courseData, filename = 'export.xlsx', options = {}) {
  // 允許呼叫端將 `options` 放在 `filename` 位置。
  if (typeof filename === 'object' && filename !== null) {
    options = filename;
    filename = 'export.xlsx';
  }

  const {
    includeStats = true,
    includeStudents = true,
    includeEnrollments = true,
    includeCourses = true
  } = options;

  const workbook = XLSX.utils.book_new();

  // 1. 依選項建立統計工作表。
  if (includeStats) {
    const statisticsData = [
      { '指標名稱': '學員總人數', '數值': studentsData ? studentsData.length : 0 },
      { '指標名稱': '報名總人次', '數值': enrollmentsData ? enrollmentsData.length : 0 },
      { '指標名稱': '開課總門數', '數值': courseData ? courseData.length : 0 }
    ];
    const statsSheet = XLSX.utils.json_to_sheet(statisticsData);
    XLSX.utils.book_append_sheet(workbook, statsSheet, '統計摘要');
  }

  // 2. 將學生資料轉換為工作表欄位。
  if (includeStudents) {
    const formattedStudents = (studentsData || []).map(s => {
      const item = {
        '學員編號': s.student_id,
        '姓名': s.name,
        '性別': s.gender,
        '出生日期': s.birth_date,
        '目前年齡': s.age,
        '是否60歲以上': s.is_60_plus,
        '地址': s.address,
        '家裡電話': s.home_phone,
        '手機電話': s.mobile_phone,
        '主要聯絡人': s.emergency_contact,
        '關係': s.relationship,
        '聯絡人電話': s.emergency_contact_phone,
        '教育程度': s.education,
        '職業': s.occupation
      };
      Object.keys(item).forEach(key => {
        if (item[key] === undefined) delete item[key];
      });
      return item;
    });
    const studentsSheet = XLSX.utils.json_to_sheet(formattedStudents);
    XLSX.utils.book_append_sheet(workbook, studentsSheet, '學員個人資料');
  }

  // 3. 將報名資料轉換為工作表欄位。
  if (includeEnrollments) {
    const formattedEnrollments = (enrollmentsData || []).map(e => {
      const item = {
        '學員編號': e.enrollment_id, // 保留 `enrollment_id` 以便追溯報名紀錄。
        '姓名': e.student_name || '未知', // 學生姓名缺漏時顯示預設文字。
        '報名季度': e.season,
        '新續狀況': e.reg_type,
        '前測時間': e.pre_test,
        '後測時間': e.post_test,
        '報名課程': Array.isArray(e.courses) ? e.courses.join(', ') : e.courses,
        '是否退費': (e.refunded === 1 || e.refunded === true || e.refunded === '1' || String(e.refunded).toLowerCase() === 'true') ? '是' : '否'
      };
      Object.keys(item).forEach(key => {
        if (item[key] === undefined) delete item[key];
      });
      return item;
    });
    const enrollmentsSheet = XLSX.utils.json_to_sheet(formattedEnrollments);
    XLSX.utils.book_append_sheet(workbook, enrollmentsSheet, '報名明細紀錄');
  }

  // 4. 將課程彙總資料轉換為工作表欄位。
  if (includeCourses) {
    const formattedCourses = (courseData || []).map(c => {
      return {
        '課程名稱': c.Course,
        '選修人數': c.Count
      };
    });
    const courseSheet = XLSX.utils.json_to_sheet(formattedCourses);
    XLSX.utils.book_append_sheet(workbook, courseSheet, '課程選修統計');
  }

  // 未建立任何工作表時，不輸出空白 `workbook`。
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    console.warn('Workbook is empty. Export aborted.');
    return;
  }

  // 將 `workbook` 寫入指定檔名以觸發下載。
  XLSX.writeFile(workbook, filename);
}

