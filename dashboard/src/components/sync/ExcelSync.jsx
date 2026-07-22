import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import Swal from 'sweetalert2'
import withReactContent from 'sweetalert2-react-content'
import { commitImport, prepareImport } from '../../services/dataImportService'
import ImportPreviewDialog from './ImportPreviewDialog'
import './sync.css'

const MySwal = withReactContent(Swal)

export default function ExcelSync({ onSyncComplete }) {
  const fileInputRef = useRef(null)
  const [isReading, setIsReading] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [preview, setPreview] = useState(null)
  const [assignedIds, setAssignedIds] = useState([])
  const assignedIdText = assignedIds.map(({ source_row, student_id }) => `來源第 ${source_row} 列：${student_id}`).join('\n')

  const copyAssignedIds = async () => {
    await navigator.clipboard.writeText(assignedIdText)
    await MySwal.fire({ icon: 'success', title: '已複製新學員編號' })
  }

  const handleFileChange = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    setAssignedIds([])
    setIsReading(true)
    try {
      setPreview(await prepareImport(file))
    } catch (error) {
      await MySwal.fire({ icon: 'error', title: '讀取失敗', text: error.message })
    } finally {
      setIsReading(false)
      if (fileInputRef.current) fileInputRef.current.value = null
    }
  }

  const handleConfirm = async () => {
    setIsImporting(true)
    try {
      const result = await commitImport(preview)
      await MySwal.fire({ icon: 'success', title: '匯入成功', text: `新增 ${result.students_inserted} 位學生，更新 ${result.enrollments_updated} 筆報名。` })
      setAssignedIds(Array.isArray(result.assigned_ids) ? result.assigned_ids : [])
      setPreview(null)
      onSyncComplete?.()
    } catch (error) {
      await MySwal.fire({ icon: 'error', title: '匯入失敗', text: error.message })
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <input type="file" accept=".csv" style={{ display: 'none' }} ref={fileInputRef} onChange={handleFileChange} />
      <button type="button" className="btn-secondary w-max" style={{ display: 'flex', gap: '6px', alignItems: 'center' }} onClick={() => fileInputRef.current?.click()} disabled={isReading || isImporting}>
        <Upload size={14} className={isReading || isImporting ? 'spin' : ''} />
        <span>{isReading ? '讀取中...' : isImporting ? '匯入中...' : '匯入季度 CSV'}</span>
      </button>
      {preview && <ImportPreviewDialog preview={preview} isImporting={isImporting} onConfirm={handleConfirm} onCancel={() => setPreview(null)} />}
      {assignedIds.length > 0 && (
        <section className="form-group" aria-label="本次指派的學員編號">
          <h3>本次指派的學員編號</h3>
          <ul>
            {assignedIds.map(({ source_row, student_id }) => <li key={`${source_row}-${student_id}`}>來源第 {source_row} 列：{student_id}</li>)}
          </ul>
          <button type="button" className="btn-secondary" onClick={copyAssignedIds} disabled={isImporting}>複製新學員編號</button>
        </section>
      )}
    </div>
  )
}
