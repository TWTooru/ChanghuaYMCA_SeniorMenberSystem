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
        ID: s.student_id,
        '電子郵件地址': s.email,
        '姓名': s.name,
        '性別': s.gender,
        '電話': s.phone,
        '出生年月日': s.birth_date,
        '通訊處': s.address,
        '服務機關 / 學校': s.organization,
        '教育程度': s.education,
      };
      Object.keys(item).forEach(key => {
        if (item[key] === undefined) delete item[key];
      });
      return item;
    });
    const studentsSheet = XLSX.utils.json_to_sheet(formattedStudents);
    XLSX.utils.book_append_sheet(workbook, studentsSheet, '學員個人資料');
  }

  // 3. 將報名資料轉換為工作表欄位（以報名表為單元匯出）。
  if (includeEnrollments) {
    const formattedEnrollments = (enrollmentsData || []).flatMap(e => {
      const forms = e.forms && e.forms.length > 0 ? e.forms : null;

      if (forms) {
        return forms.map(form => {
          const item = {
            ID: e.enrollment_id,
            '會員ID': e.student_id,
            '姓名': e.student_name || '未知',
            '期別': e.period,
            '報名表序號': form.form_sequence,
            '新續狀況': form.reg_type || e.reg_type,
            '報名課程': Array.isArray(form.courses) ? form.courses.join(', ') : form.courses,
            '是否退費': form.refunded ? '是' : '否',
            '退費原因': form.refund_info || undefined,
            '預繳金額': form.prepaid_amount,
            '預繳收據號碼': form.prepaid_receipt_number,
            '學費': form.tuition_fee,
            '材料費': form.materials_fee,
            '會費': form.membership_fee,
            '費用收據號碼': form.fee_receipt_number,
            '經辦人': form.handled_by_name || e.handled_by_name,
            '報到日期': form.reported_on || form.handled_on || e.reported_on || e.handled_on,
            '備註': form.notes || e.notes,
          };
          Object.keys(item).forEach(key => {
            if (item[key] === undefined) delete item[key];
          });
          return item;
        });
      }

      const item = {
        ID: e.enrollment_id,
        '會員ID': e.student_id,
        '姓名': e.student_name || '未知',
        '期別': e.period,
        '報名表序號': 1,
        '新續狀況': e.reg_type,
        '報名課程': Array.isArray(e.courses) ? e.courses.join(', ') : e.courses,
        '是否退費': (e.refunded === 1 || e.refunded === true || e.refunded === '1' || String(e.refunded).toLowerCase() === 'true') ? '是' : '否',
        '退費原因': e.refund_info || undefined,
        '預繳金額': e.prepaid_amount,
        '預繳收據號碼': e.prepaid_receipt_number,
        '學費': e.tuition_fee,
        '材料費': e.materials_fee,
        '會費': e.membership_fee,
        '費用收據號碼': e.fee_receipt_number,
        '經辦人': e.handled_by_name,
        '報到日期': e.reported_on || e.handled_on,
        '備註': e.notes,
        '金額（舊版）': e.amount,
        '發票編號（舊版）': e.invoice_number,
      };
      Object.keys(item).forEach(key => {
        if (item[key] === undefined) delete item[key];
      });
      return [item];
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
