import { Heart } from 'lucide-react'

export default function SeniorsMetricCard({ students = [] }) {
  const seniorsCount = (students || []).filter(s => s.age >= 60 || s.is_60_plus === '是').length
  const seniorsPercentage = (students || []).length > 0 ? (seniorsCount / students.length) * 100 : 0

  return (
    <div className="panel-card" style={{ flex: 1 }}>
      <h3 className="panel-title">
        <Heart size={18} className="header-icon" style={{ color: 'var(--color-success)' }} />
        樂齡學員佔比 (60歲以上)
      </h3>
      
      <div className="seniors-metric-header" style={{ marginTop: '16px' }}>
        <div className="seniors-metric-value-group">
          <span className="seniors-metric-percentage" style={{ fontSize: '24px' }}>{seniorsPercentage.toFixed(1)}%</span>
          <span className="seniors-metric-count">({seniorsCount}人 / 全體{students ? students.length : 0}人)</span>
        </div>
      </div>
      <div className="seniors-progress-track" style={{ marginTop: '12px' }}>
        <div className="seniors-progress-fill" style={{ width: `${seniorsPercentage}%` }}></div>
      </div>
    </div>
  )
}
