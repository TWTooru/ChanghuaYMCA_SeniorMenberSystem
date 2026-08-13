import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Upload } from 'lucide-react'
import Swal from 'sweetalert2'
import withReactContent from 'sweetalert2-react-content'
import { commitImport, prepareImport } from '../../services/dataImportService'
import ImportPreviewDialog from './ImportPreviewDialog'
import './sync.css'

const MySwal = withReactContent(Swal)

/**
 * 會員 Excel／CSV 匯入協調元件：選檔後只建立 preview，使用者確認後才提交 RPC。
 * 成功回傳的 `assigned_ids` 另以 portal 顯示，避免刷新資料時遺失新 ID 對照。
 */
export default function ExcelSync({ onSyncComplete }) {
  const fileInputRef = useRef(null)
  const [isReading, setIsReading] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [preview, setPreview] = useState(null)
  const [assignedIds, setAssignedIds] = useState([])
  const assignedIdText = assignedIds.map(({ sourceRow, studentId }) => `來源第 ${sourceRow} 列：${studentId}`).join('\n')

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
      // preview 成功不代表已寫入；只有 `handleConfirm` 會呼叫 mutation RPC。
      setPreview(await prepareImport(file))
    } catch (error) {
      await MySwal.fire({ icon: 'error', title: '讀取失敗', text: error.message })
    } finally {
      setIsReading(false)
      // 重設原生 input，讓使用者選取同一檔案時仍會觸發下一次 `change`。
      if (fileInputRef.current) fileInputRef.current.value = null
    }
  }

  const handleConfirm = async () => {
    setIsImporting(true)
    try {
      const result = await commitImport(preview)
      await MySwal.fire({ icon: 'success', title: '匯入成功', text: `新增 ${result.studentsInserted} 位、更新 ${result.studentsUpdated} 位會員。` })
      setAssignedIds(Array.isArray(result.assignedIds) ? result.assignedIds : [])
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
      <input type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} ref={fileInputRef} onChange={handleFileChange} />
      <button type="button" className="btn-secondary w-max" style={{ display: 'flex', gap: '6px', alignItems: 'center' }} onClick={() => fileInputRef.current?.click()} disabled={isReading || isImporting}>
        <Upload size={14} className={isReading || isImporting ? 'spin' : ''} />
        <span>{isReading ? '讀取中...' : isImporting ? '匯入中...' : '匯入會員 Excel／CSV'}</span>
      </button>
      {preview && <ImportPreviewDialog preview={preview} isImporting={isImporting} onConfirm={handleConfirm} onCancel={() => setPreview(null)} />}
      {/* 指派 ID 必須在資料刷新後仍可抄錄，因此使用獨立於 preview 的結果狀態。 */}
      {assignedIds.length > 0 && createPortal(
        <div
          className="modal-overlay-center"
          style={{ zIndex: 1200 }}
          onClick={() => setAssignedIds([])}
        >
          <section
            className="form-modal-content"
            role="dialog"
            aria-modal="true"
            aria-label="本次指派的學員編號"
            style={{ width: 'min(560px, calc(100vw - 32px))', maxHeight: 'min(70vh, 620px)', display: 'flex', flexDirection: 'column' }}
            onClick={event => event.stopPropagation()}
          >
            <div className="modal-header-centered">
              <h3>本次指派的學員編號</h3>
              <button type="button" className="btn-close" aria-label="關閉指派編號結果" onClick={() => setAssignedIds([])}>×</button>
            </div>
            <p style={{ margin: '0 0 12px' }}>共 {assignedIds.length} 位新學員，可複製後保存。</p>
            <ul style={{ overflowY: 'auto', margin: '0', padding: '0 8px 0 24px', flex: 1 }}>
              {assignedIds.map(({ sourceRow, studentId }) => <li key={`${sourceRow}-${studentId}`}>來源第 {sourceRow} 列：{studentId}</li>)}
            </ul>
            <div className="form-footer" style={{ marginTop: '16px' }}>
              <button type="button" className="btn-secondary" onClick={() => setAssignedIds([])}>關閉</button>
              <button type="button" className="btn-primary" onClick={copyAssignedIds} disabled={isImporting}>複製新學員編號</button>
            </div>
          </section>
        </div>,
        document.body
      )}
    </div>
  )
}
