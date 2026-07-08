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

export function exportToExcel(studentsData, enrollmentsData, courseData, filename = 'export.xlsx') {
  const workbook = XLSX.utils.book_new();

  // Create Statistics Data
  const statisticsData = [
    { Metric: 'Total Students', Value: studentsData ? studentsData.length : 0 },
    { Metric: 'Total Enrollments', Value: enrollmentsData ? enrollmentsData.length : 0 },
    { Metric: 'Total Courses', Value: courseData ? courseData.length : 0 }
  ];

  // 1. Statistics Sheet
  const statsSheet = XLSX.utils.json_to_sheet(statisticsData);
  XLSX.utils.book_append_sheet(workbook, statsSheet, 'Statistics');

  // Format Data
  const formattedStudents = formatExportData(studentsData);
  const formattedEnrollments = formatExportData(enrollmentsData);
  const formattedCourses = formatExportData(courseData);

  // 2. Students Sheet
  const studentsSheet = XLSX.utils.json_to_sheet(formattedStudents);
  XLSX.utils.book_append_sheet(workbook, studentsSheet, 'Students');

  // 3. Enrollments Sheet
  const enrollmentsSheet = XLSX.utils.json_to_sheet(formattedEnrollments);
  XLSX.utils.book_append_sheet(workbook, enrollmentsSheet, 'Enrollments');

  // 4. Course Data Sheet
  const courseSheet = XLSX.utils.json_to_sheet(formattedCourses);
  XLSX.utils.book_append_sheet(workbook, courseSheet, 'Course Data');

  // Trigger download
  XLSX.writeFile(workbook, filename);
}
