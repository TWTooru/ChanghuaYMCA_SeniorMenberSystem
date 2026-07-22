import { Award } from 'lucide-react'

const EDUCATION_ORDER = [
  '研究所',
  '大專/大學',
  '高中/職',
  '國中',
  '國小',
  '未受正規教育但識字',
  '不識字',
  '未填寫',
  '未知'
]

export default function EducationDistributionChart({ eduCounts = {}, totalStudents = 0 }) {
  return (
    <div className="panel-card" style={{ flex: 1 }}>
      <h3 className="panel-title">
        <Award size={18} className="header-icon" />
        教育程度分佈
      </h3>
      <div className="distribution-list">
        {Object.entries(eduCounts || {})
          .sort((a, b) => {
            const idxA = EDUCATION_ORDER.indexOf(a[0])
            const idxB = EDUCATION_ORDER.indexOf(b[0])
            const orderA = idxA === -1 ? 999 : idxA
            const orderB = idxB === -1 ? 999 : idxB
            return orderA - orderB
          })
          .map(([edu, count]) => {
            const pct = (totalStudents || 0) > 0 ? (count / totalStudents) * 100 : 0
            return (
              <div className="dist-item" key={edu}>
                <span className="dist-label">{edu}</span>
                <div className="dist-value-group">
                  <span className="dist-percentage-pill">{pct.toFixed(1)}%</span>
                  <span className="dist-value">{count}人</span>
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}
