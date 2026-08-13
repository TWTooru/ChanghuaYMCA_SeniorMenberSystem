import { User } from 'lucide-react'

const fields = [['電子郵件', 'email'], ['電話', 'phone'], ['出生年月日', 'birth_date'], ['通訊處', 'address'], ['服務機關 / 學校', 'organization'], ['教育程度', 'education']]

export default function StudentInfoView({ student, onEdit }) {
  return <div><h3 className="panel-title" style={{ marginBottom: '12px' }}><User size={16} />會員資料</h3><div className="detail-grid" onDoubleClick={onEdit} style={onEdit ? { cursor: 'pointer' } : undefined}>
    <div className="detail-item"><span className="detail-label">ID</span><span className="detail-value">{student.student_id}</span></div>
    <div className="detail-item"><span className="detail-label">姓名</span><span className="detail-value">{student.name}</span></div>
    <div className="detail-item"><span className="detail-label">性別</span><span className="detail-value">{student.gender}</span></div>
    {fields.map(([label, key]) => <div className="detail-item" key={key}><span className="detail-label">{label}</span><span className="detail-value">{student[key] || '未記錄'}</span></div>)}
  </div></div>
}
