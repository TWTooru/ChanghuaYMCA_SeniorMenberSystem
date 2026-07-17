import { User } from 'lucide-react'

export default function StudentInfoView({ student, onEdit }) {
  return (
    <div>
      <h3 className="panel-title" style={{ marginBottom: '12px' }}>
        <User size={16} />
        基本聯絡資料
      </h3>
      <div 
        className="detail-grid" 
        onDoubleClick={onEdit} 
        title={onEdit ? "按兩下任意欄位快速編輯" : undefined}
        style={onEdit ? { cursor: 'pointer' } : undefined}
      >
        <div className="detail-item">
          <span className="detail-label">出生日期 / 年齡</span>
          <span className="detail-value">{student.birth_date || '未記錄'} {student.age ? `(${student.age} 歲)` : ''}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">是否達60歲</span>
          <span className="detail-value">{student.is_60_plus || '未判定'}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">教育程度</span>
          <span className="detail-value">{student.education || '未記錄'}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">職業</span>
          <span className="detail-value">{student.occupation || '未記錄'}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">手機電話</span>
          <span className="detail-value">{student.mobile_phone || '未記錄'}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">市話號碼</span>
          <span className="detail-value">{student.home_phone || '未記錄'}</span>
        </div>
        <div className="detail-item" style={{ gridColumn: 'span 2' }}>
          <span className="detail-label">通訊地址</span>
          <span className="detail-value">{student.address || '未記錄'}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">緊急聯絡人 (關係)</span>
          <span className="detail-value">{student.emergency_contact || '未記錄'} {student.relationship ? `(${student.relationship})` : ''}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">緊急聯絡人電話</span>
          <span className="detail-value">{student.emergency_contact_phone || '未記錄'}</span>
        </div>
      </div>
    </div>
  )
}
