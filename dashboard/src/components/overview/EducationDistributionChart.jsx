const order = ['研究所', '專科/大學', '高中','國中以下']

export default function EducationDistributionChart({ eduCounts = {}, totalStudents = 0, embedded = false }) {
  return <div className={embedded ? 'insight-section education-insight-section' : 'panel-card'}><h4>教育程度分佈</h4><div className="distribution-list">{Object.entries(eduCounts).sort(([a], [b]) => (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b))).map(([education, count]) => <div className="dist-item" key={education}><span className="dist-label">{education}</span><div className="dist-value-group"><span className="dist-percentage-pill">{(totalStudents ? count / totalStudents * 100 : 0).toFixed(1)}%</span><span className="dist-value">{count} 人</span></div></div>)}</div></div>
}
