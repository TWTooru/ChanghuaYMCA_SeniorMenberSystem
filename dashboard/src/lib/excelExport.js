import * as XLSX from 'xlsx';

function formatExportData(data) {
  if (!data || !Array.isArray(data)) return [];
  
  const keyMap = {
    student_id: '學生ID',
    name: '姓名',
    phone: '電話',
    email: 'Email',
    courses: '報名課程',
    season: '報名季別',
    year: '報名年度',
    refunded: '是否退費'
  };

  return data.map(item => {
    const formattedItem = {};
    for (const key in item) {
      const newKey = keyMap[key] || key;
      let newValue = item[key];
      
      if (key === 'refunded') {
        newValue = (newValue === 1 || newValue === true || newValue === '1' || String(newValue).toLowerCase() === 'true') ? '已退費' : '否';
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
      { Metric: 'Total Students', Value: studentsData ? studentsData.length : 0 },
      { Metric: 'Total Enrollments', Value: enrollmentsData ? enrollmentsData.length : 0 },
      { Metric: 'Total Courses', Value: courseData ? courseData.length : 0 }
    ];
    const statsSheet = XLSX.utils.json_to_sheet(statisticsData);
    XLSX.utils.book_append_sheet(workbook, statsSheet, 'Statistics');
  }

  // 2. Students Sheet
  if (includeStudents) {
    const formattedStudents = formatExportData(studentsData);
    const studentsSheet = XLSX.utils.json_to_sheet(formattedStudents);
    XLSX.utils.book_append_sheet(workbook, studentsSheet, 'Students');
  }

  // 3. Enrollments Sheet
  if (includeEnrollments) {
    const formattedEnrollments = formatExportData(enrollmentsData);
    const enrollmentsSheet = XLSX.utils.json_to_sheet(formattedEnrollments);
    XLSX.utils.book_append_sheet(workbook, enrollmentsSheet, 'Enrollments');
  }

  // 4. Course Data Sheet
  if (includeCourses) {
    const formattedCourses = formatExportData(courseData);
    const courseSheet = XLSX.utils.json_to_sheet(formattedCourses);
    XLSX.utils.book_append_sheet(workbook, courseSheet, 'Course Data');
  }

  // Guard against empty workbook crash
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    console.warn('Workbook is empty. Export aborted.');
    return;
  }

  // Trigger download
  XLSX.writeFile(workbook, filename);
}

