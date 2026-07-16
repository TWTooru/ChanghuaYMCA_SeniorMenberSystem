import * as XLSX from 'xlsx';

function formatExportData(data) {
  if (!data || !Array.isArray(data)) return [];
  
  const keyMap = {
    // 學生個人資料
    student_id: '學員編號',
    original_id: '原始編號',
    name: '姓名',
    gender: '性別',
    birth_date: '出生日期',
    age: '目前年齡',
    is_60_plus: '是否60歲以上',
    address: '地址',
    home_phone: '家裡電話',
    mobile_phone: '手機電話',
    emergency_contact: '主要聯絡人',
    relationship: '關係',
    emergency_contact_phone: '聯絡人電話',
    education: '教育程度',
    occupation: '職業',

    // 報名紀錄
    season: '報名季度',
    reg_type: '新續狀況',
    pre_test: '前測時間',
    post_test: '後測時間',
    courses: '報名課程',
    refunded: '是否退費',
    student_name: '姓名',

    // 課程統計
    Course: '課程名稱',
    Count: '選修人數'
  };

  return data.map(item => {
    const formattedItem = {};
    for (const key in item) {
      if (key === 'memo' || key === 'created_at') continue;
      
      const newKey = keyMap[key] || key;
      let newValue = item[key];
      
      if (key === 'refunded') {
        newValue = (newValue === 1 || newValue === true || newValue === '1' || String(newValue).toLowerCase() === 'true') ? '是' : '否';
      } else if (key === 'courses' && Array.isArray(newValue)) {
        newValue = newValue.join(', ');
      }
      
      formattedItem[newKey] = newValue;
    }
    return formattedItem;
  });
}

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
    const formattedStudents = formatExportData(studentsData);
    const studentsSheet = XLSX.utils.json_to_sheet(formattedStudents);
    XLSX.utils.book_append_sheet(workbook, studentsSheet, '學員個人資料');
  }

  // 3. Enrollments Sheet
  if (includeEnrollments) {
    const formattedEnrollments = formatExportData(enrollmentsData);
    const enrollmentsSheet = XLSX.utils.json_to_sheet(formattedEnrollments);
    XLSX.utils.book_append_sheet(workbook, enrollmentsSheet, '報名明細紀錄');
  }

  // 4. Course Data Sheet
  if (includeCourses) {
    const formattedCourses = formatExportData(courseData);
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

