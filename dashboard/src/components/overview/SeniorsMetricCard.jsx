export default function SeniorsMetricCard({ students = [], embedded = false }) {
  const count = students.filter((student) => student.age >= 60 || student.is_60_plus === true || student.is_60_plus === '是').length
  const percentage = students.length ? count / students.length * 100 : 0
  return <div className={embedded ? 'insight-section seniors-insight-section' : 'panel-card'}><h4>樂齡學員佔比 (60歲以上)</h4><div className="seniors-metric-value-group"><span className="seniors-metric-percentage">{percentage.toFixed(1)}%</span><span className="seniors-metric-count">({count}人 / 全體{students.length}人)</span></div><div className="seniors-progress-track"><div className="seniors-progress-fill" style={{ width: `${percentage}%` }} /></div></div>
}
