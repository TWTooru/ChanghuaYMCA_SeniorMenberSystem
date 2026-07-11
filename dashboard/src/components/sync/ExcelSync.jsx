import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import Swal from 'sweetalert2'
import withReactContent from 'sweetalert2-react-content'
import { runSync } from '../../services/excelSyncService'

const MySwal = withReactContent(Swal)

export default function ExcelSync({ onSyncComplete }) {
  const fileInputRef = useRef(null)
  const [isSyncing, setIsSyncing] = useState(false)

  const handleFileChange = async (event) => {
    const file = event.target.files[0]
    if (!file) return
    setIsSyncing(true)
    try {
      const { errors } = await runSync(file)
      if (errors.length > 0) {
        MySwal.fire({
          icon: 'warning', title: '同步完成，但發生部分錯誤',
          html: <div className="text-left mt-2"><h4 className="font-bold text-red-600 mb-2">同步錯誤紀錄 ({errors.length})：</h4><ul className="list-disc pl-5 text-sm space-y-1 text-gray-700 max-h-[200px] overflow-y-auto border p-2 rounded">{errors.map((error, index) => <li key={index}>{error}</li>)}</ul></div>,
          confirmButtonText: '關閉'
        })
      } else {
        MySwal.fire({ icon: 'success', title: '同步成功！', text: 'Excel 智慧同步完成！所有資料已成功更新。', confirmButtonText: '確定' })
      }
      if (onSyncComplete) onSyncComplete()
    } catch (error) {
      console.error(error)
      MySwal.fire({ icon: 'error', title: '同步過程發生例外錯誤！', text: error.message, confirmButtonText: '關閉' })
    } finally {
      setIsSyncing(false)
      if (fileInputRef.current) fileInputRef.current.value = null
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <input type="file" accept=".xlsx, .xls" style={{ display: 'none' }} ref={fileInputRef} onChange={handleFileChange} />
      <button type="button" className="btn-secondary w-max" style={{ display: 'flex', gap: '6px', alignItems: 'center' }} onClick={() => fileInputRef.current?.click()} disabled={isSyncing}>
        <Upload size={14} className={isSyncing ? 'spin' : ''} />
        <span>{isSyncing ? '同步中...' : '上傳 Excel 同步'}</span>
      </button>
    </div>
  )
}
