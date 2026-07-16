import * as XLSX from 'xlsx';

export function exportToExcel(studentsData, enrollmentsData, courseData, filename = 'export.xlsx', options = {}) {
  // Option parameter robustness (swapping filename and options if needed)
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

  // 1. Statistics Sheet
  if (includeStats) {
    const statisticsData = [
      { '指標名稱': '學員總人數', '數值': studentsData ? studentsData.length : 0 },
      { '指標名稱': '報名總人次', '數值': enrollmentsData ? enrollmentsData.length : 0 },
      { '指標名稱': '開課總門數', '數值': courseData ? courseData.length : 0 }
    ];
    const statsSheet = XLSX.utils.json_to_sheet(statisticsData);
    XLSX.utils.book_append_sheet(workbook, statsSheet, '統計摘要');
  }

  // 2. Students Sheet
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

  // 3. Enrollments Sheet
  if (includeEnrollments) {
    const formattedEnrollments = (enrollmentsData || []).map(e => {
      const item = {
        '學員編號': e.enrollment_id, // enrollment_id 改成學員編號
        '姓名': e.student_name || '未知', // 原本學員編號換成姓名
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

  // 4. Course Data Sheet
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

  // Guard against empty workbook crash
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    console.warn('Workbook is empty. Export aborted.');
    return;
  }

  // Trigger download
  XLSX.writeFile(workbook, filename);
}

