export default function GenderDistributionChart({ genderCounts = [], embedded = false }) {
  const counts = Object.fromEntries(genderCounts.map(({ label, value }) => [label, value]))
  const total = (counts.男 ?? 0) + (counts.女 ?? 0)
  const className = embedded ? 'insight-section gender-insight-section' : 'panel-card'
  return <div className={className}><h4>性別分布</h4>{total ? <ul>{['男', '女'].map(label => <li key={label}>{label}：{counts[label] ?? 0}</li>)}</ul> : <p>尚無性別資料</p>}</div>
}
