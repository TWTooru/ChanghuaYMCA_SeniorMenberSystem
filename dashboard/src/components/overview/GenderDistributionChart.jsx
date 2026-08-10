export default function GenderDistributionChart({ males = 0, females = 0, genderUnknown = 0, embedded = false }) {
  const total = males + females + genderUnknown
  const shellClass = embedded ? 'insight-section gender-insight-section' : 'panel-card'
  if (!total) return <div className={shellClass}><h4>性別分布</h4><div className="gender-dist-empty">暫無性別資料</div></div>
  const data = [['男性', males, 'male'], ['女性', females, 'female'], ...(genderUnknown ? [['未填', genderUnknown, 'unknown']] : [])]
  return <div className={shellClass}><h4>性別分布</h4><div className="gender-dist-chart-container"><div className="gender-dist-bar">{data.map(([, count, key]) => <div className={`gender-dist-segment ${key}`} key={key} style={{ width: `${count / total * 100}%` }} />)}</div><div className="gender-dist-legend">{data.map(([label, count, key]) => <div className="gender-dist-legend-item" key={key}><div className={`gender-dist-dot ${key}`} /><span className="gender-dist-label">{label}</span><span className="gender-dist-value">{count} 人 ({(count / total * 100).toFixed(1)}%)</span></div>)}</div><div className="gender-dist-total">總計：{total} 人</div></div></div>
}
