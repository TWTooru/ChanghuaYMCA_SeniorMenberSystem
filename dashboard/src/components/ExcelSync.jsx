import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabaseClient';
import { Upload } from 'lucide-react';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { cleanCourseName, cleanDate, cleanInt, cleanScore, cleanStr, extractSeasonNum, validateWorkbookForImport } from '../domain/excelImport';

const MySwal = withReactContent(Swal);

const STUDENT_KEYS = [
  'student_id', 'original_id', 'name', 'gender', 'birth_date', 'age', 
  'is_60_plus', 'address', 'home_phone', 'mobile_phone', 'emergency_contact', 
  'relationship', 'emergency_contact_phone', 'education', 'occupation'
];

export default function ExcelSync({ onSyncComplete }) {
  const fileInputRef = useRef(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsSyncing(true);
    const errors = [];
    
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (!session || sessionError) {
        throw new Error("權限不足：請先登入後再執行同步操作 (Authentication failed).");
      }

      validateWorkbookForImport({
        fileSize: file.size,
        workbook: { SheetNames: [], Sheets: {} }
      });
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      validateWorkbookForImport({
        fileSize: file.size,
        workbook,
        getRows: sheet => XLSX.utils.sheet_to_json(sheet, { defval: null })
      });
      const sheets = workbook.SheetNames;
      
      const seasonSheets = sheets.filter(s => (s.includes('季') || s.includes('期')) && !s.includes('退費'));
      
      for (const sheetName of seasonSheets) {
        const df = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null });
        if (df.length === 0) continue;
        
        const cols = Object.keys(df[0]);
        const preTestCol = cols.find(c => c.includes("前測"));
        const postTestCol = cols.find(c => c.includes("後測"));
        const regTypeCol = cols.find(c => c.includes("新/續") || c.includes("新、續"));
        const courseCols = cols.filter(c => c.includes("課程"));
        const idCol = cols.find(c => c === "學員編號" || c === "Unnamed: 0");
        const nameCol = cols.find(c => c === "姓名");

        const studentsMap = new Map();
        const enrollmentsMap = new Map(); // sid -> enrollment details
        const coursesMap = new Map(); // sid -> array of course names

        for (const row of df) {
          const name = nameCol ? cleanStr(row[nameCol]) : null;
          if (!name || name === "None" || name === "") continue;

          if (!idCol || row[idCol] === null || row[idCol] === undefined) continue;
          const rawId = parseInt(row[idCol], 10);
          if (isNaN(rawId)) continue;
          const sid = String(rawId);

          const studentData = {
            student_id: sid,
            original_id: cleanStr(row["原始編號"]),
            name: name,
            gender: cleanStr(row["性別"]),
            birth_date: cleanDate(row["出生日期"]),
            age: cleanInt(row["目前年齡"]),
            is_60_plus: cleanStr(row["是否60歲"]),
            address: cleanStr(row["地址"]),
            home_phone: cleanStr(row["家裡電話"]),
            mobile_phone: cleanStr(row["手機電話"]),
            emergency_contact: cleanStr(row["主要聯絡人"]),
            relationship: cleanStr(row["關係"]),
            emergency_contact_phone: cleanStr(row["聯絡人電話"]),
            education: cleanStr(row["教育程度"]),
            occupation: cleanStr(row["職業"])
          };

          studentsMap.set(sid, studentData);

          const regType = regTypeCol ? cleanStr(row[regTypeCol]) : null;
          const preTest = preTestCol ? cleanScore(row[preTestCol]) : null;
          const postTest = postTestCol ? cleanScore(row[postTestCol]) : null;

          enrollmentsMap.set(sid, { regType, preTest, postTest });

          const courseInserts = [];
          for (const cCol of courseCols) {
             const cName = cleanCourseName(row[cCol]);
             if (cName) {
                courseInserts.push(cName);
             }
          }
          coursesMap.set(sid, courseInserts);
        }

        const sids = Array.from(studentsMap.keys());
        if (sids.length === 0) continue;

        // 1. Bulk Upsert Students
        // To avoid overwriting existing data with nulls, first fetch existing students
        const existingStudentsMap = new Map();
        for (let i = 0; i < sids.length; i += 500) {
          const chunk = sids.slice(i, i + 500);
          const { data: exStudents, error: exErr } = await supabase.from('students').select('*').in('student_id', chunk);
          if (exErr) {
            errors.push(`[${sheetName}] Error fetching existing students: ${exErr.message}`);
          } else if (exStudents) {
            exStudents.forEach(s => existingStudentsMap.set(s.student_id, s));
          }
        }

        const mergedStudents = sids.map(sid => {
          const sData = studentsMap.get(sid);
          const exData = existingStudentsMap.get(sid) || {};
          const finalObj = {};
          for (const key of STUDENT_KEYS) {
            if (sData[key] !== null && sData[key] !== undefined) {
              finalObj[key] = sData[key];
            } else if (exData[key] !== undefined) {
              finalObj[key] = exData[key];
            } else {
              finalObj[key] = null;
            }
          }
          return finalObj;
        });

        const failedStudentIds = new Set();
        for (let i = 0; i < mergedStudents.length; i += 500) {
          const chunk = mergedStudents.slice(i, i + 500);
          const { error: studentErr } = await supabase.from('students').upsert(chunk, { onConflict: 'student_id' });
          if (studentErr) {
            errors.push(`[${sheetName}] Students Upsert Error: ${studentErr.message}`);
            chunk.forEach(s => failedStudentIds.add(s.student_id));
          }
        }

        // 2. Bulk Upsert Enrollments
        const { data: existingEnrollments, error: fetchErr } = await supabase
          .from('enrollments')
          .select('enrollment_id, student_id')
          .eq('season', sheetName);

        if (fetchErr) {
          errors.push(`[${sheetName}] Enrollments Fetch Error: ${fetchErr.message}`);
          continue;
        }

        const existingEnrollmentMap = new Map();
        if (existingEnrollments) {
          for (const e of existingEnrollments) {
            existingEnrollmentMap.set(String(e.student_id), e.enrollment_id);
          }
        }

        const enrollmentsToUpdate = [];
        const enrollmentsToInsert = [];

        for (const [sid, eData] of enrollmentsMap.entries()) {
          if (failedStudentIds.has(sid)) continue;
          
          if (existingEnrollmentMap.has(sid)) {
            const eid = existingEnrollmentMap.get(sid);
            const updateData = { enrollment_id: eid };
            if (eData.regType !== null) updateData.reg_type = eData.regType;
            if (eData.preTest !== null) updateData.pre_test = eData.preTest;
            if (eData.postTest !== null) updateData.post_test = eData.postTest;
            
            // Only update if there's actually new data to apply (excluding enrollment_id)
            if (Object.keys(updateData).length > 1) {
              enrollmentsToUpdate.push(updateData);
            }
          } else {
            enrollmentsToInsert.push({
              student_id: sid,
              season: sheetName,
              reg_type: eData.regType,
              pre_test: eData.preTest,
              post_test: eData.postTest,
              refunded: 0
            });
          }
        }

        if (enrollmentsToUpdate.length > 0) {
          for (let i = 0; i < enrollmentsToUpdate.length; i += 500) {
            const chunk = enrollmentsToUpdate.slice(i, i + 500);
            const { error: updateErr } = await supabase.from('enrollments').upsert(chunk);
            if (updateErr) errors.push(`[${sheetName}] Enrollments Update Error: ${updateErr.message}`);
          }
        }

        let newEnrollments = [];
        if (enrollmentsToInsert.length > 0) {
          for (let i = 0; i < enrollmentsToInsert.length; i += 500) {
            const chunk = enrollmentsToInsert.slice(i, i + 500);
            const { data: inserted, error: insertErr } = await supabase
              .from('enrollments')
              .insert(chunk)
              .select('enrollment_id, student_id');
            if (insertErr) {
              errors.push(`[${sheetName}] Enrollments Insert Error: ${insertErr.message}`);
            } else if (inserted) {
              newEnrollments = newEnrollments.concat(inserted);
            }
          }
        }

        for (const e of newEnrollments) {
          existingEnrollmentMap.set(String(e.student_id), e.enrollment_id);
        }

        // 3. Bulk Upsert Courses
        const allCoursesToInsert = [];
        const allEnrollmentIds = [];

        for (const [sid, courseNames] of coursesMap.entries()) {
          const eid = existingEnrollmentMap.get(sid);
          if (eid) {
            allEnrollmentIds.push(eid);
            for (const cName of courseNames) {
              allCoursesToInsert.push({ enrollment_id: eid, course_name: cName });
            }
          }
        }

        if (allEnrollmentIds.length > 0) {
          for (let i = 0; i < allEnrollmentIds.length; i += 200) {
            const chunk = allEnrollmentIds.slice(i, i + 200);
            const { error: delErr } = await supabase.from('courses').delete().in('enrollment_id', chunk);
            if (delErr) errors.push(`[${sheetName}] Courses Delete Error: ${delErr.message}`);
          }
        }

        if (allCoursesToInsert.length > 0) {
          for (let i = 0; i < allCoursesToInsert.length; i += 500) {
            const chunk = allCoursesToInsert.slice(i, i + 500);
            const { error: cInsErr } = await supabase.from('courses').insert(chunk);
            if (cInsErr) errors.push(`[${sheetName}] Courses Insert Error: ${cInsErr.message}`);
          }
        }
      }

      // Process refunds
      const refundSheets = sheets.filter(s => s.includes('退費'));
      for (const rSheet of refundSheets) {
        const rNum = extractSeasonNum(rSheet);
        let targetSeason = null;
        for (const season of seasonSheets) {
           if (rNum !== -1 && extractSeasonNum(season) === rNum) {
             targetSeason = season;
             break;
           }
        }
        
        if (!targetSeason) continue;

        const df = XLSX.utils.sheet_to_json(workbook.Sheets[rSheet], { defval: null });
        const namesToSearch = [];
        const validSids = [];

        for (const row of df) {
           const name = row["姓名"] ? cleanStr(row["姓名"]) : null;
           if (!name || name === "None" || name === "") continue;

           let sid = null;
           const idCol = row["學員編號"] !== undefined ? "學員編號" : (row["Unnamed: 0"] !== undefined ? "Unnamed: 0" : null);
           if (idCol && row[idCol] !== null && row[idCol] !== undefined) {
             const rawId = parseInt(row[idCol], 10);
             if (!isNaN(rawId)) sid = String(rawId);
           }

           if (sid) {
             validSids.push(sid);
           } else {
             namesToSearch.push(name);
           }
        }

        const nameToSidMap = new Map();
        if (namesToSearch.length > 0) {
          for (let i = 0; i < namesToSearch.length; i += 100) {
            const chunk = namesToSearch.slice(i, i + 100);
            const { data: students, error: nameErr } = await supabase.from('students').select('student_id, name').in('name', chunk);
            if (nameErr) {
              errors.push(`[${rSheet}] Refund Student Fetch Error: ${nameErr.message}`);
            } else if (students) {
              for (const s of students) {
                if (!nameToSidMap.has(s.name)) nameToSidMap.set(s.name, s.student_id);
              }
            }
          }
        }

        const sidsToRefund = [...validSids];
        for (const name of namesToSearch) {
          if (nameToSidMap.has(name)) {
            sidsToRefund.push(nameToSidMap.get(name));
          }
        }

        if (sidsToRefund.length > 0) {
          for (let i = 0; i < sidsToRefund.length; i += 200) {
            const chunk = sidsToRefund.slice(i, i + 200);
            const { error: refErr } = await supabase
              .from('enrollments')
              .update({ refunded: 1 })
              .eq('season', targetSeason)
              .in('student_id', chunk);
            if (refErr) errors.push(`[${rSheet}] Refund Update Error: ${refErr.message}`);
          }
        }
      }

      if (errors.length > 0) {
        MySwal.fire({
          icon: 'warning',
          title: '同步完成，但發生部分錯誤',
          html: (
            <div className="text-left mt-2">
              <h4 className="font-bold text-red-600 mb-2">同步錯誤紀錄 ({errors.length})：</h4>
              <ul className="list-disc pl-5 text-sm space-y-1 text-gray-700 max-h-[200px] overflow-y-auto border p-2 rounded">
                {errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          ),
          confirmButtonText: '關閉'
        });
      } else {
        MySwal.fire({
          icon: 'success',
          title: '同步成功！',
          text: 'Excel 智慧同步完成！所有資料已成功更新。',
          confirmButtonText: '確定'
        });
      }

      if (onSyncComplete) onSyncComplete();

    } catch (err) {
      console.error(err);
      MySwal.fire({
        icon: 'error',
        title: '同步過程發生例外錯誤！',
        text: err.message,
        confirmButtonText: '關閉'
      });
    } finally {
      setIsSyncing(false);
      if (fileInputRef.current) fileInputRef.current.value = null;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <input 
        type="file" 
        accept=".xlsx, .xls" 
        style={{ display: 'none' }} 
        ref={fileInputRef}
        onChange={handleFileChange}
      />
      <button 
        type="button"
        className="btn-secondary w-max" 
        style={{ display: 'flex', gap: '6px', alignItems: 'center' }}
        onClick={() => fileInputRef.current?.click()}
        disabled={isSyncing}
      >
        <Upload size={14} className={isSyncing ? 'spin' : ''} />
        <span>{isSyncing ? '同步中...' : '上傳 Excel 同步'}</span>
      </button>
    </div>
  );
}
