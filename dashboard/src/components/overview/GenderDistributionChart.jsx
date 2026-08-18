export default function GenderDistributionChart({ genderCounts = [], embedded = false }) {
  const counts = Object.fromEntries((genderCounts || []).map(({ label, value }) => [label, value]))
  const male = counts['男'] ?? 0
  const female = counts['女'] ?? 0
  const total = male + female

  const malePct = total > 0 ? (male / total) * 100 : 0
  const femalePct = total > 0 ? (female / total) * 100 : 0

  const className = embedded ? 'insight-section gender-insight-section' : 'panel-card'

  return (
    <div className={className}>
      <h4>性別分布</h4>
      {total > 0 ? (
        <div className="gender-dist-chart-container">
          <div className="gender-dist-bar-wrapper">
            <div className="gender-dist-bar" role="progressbar" aria-label="性別比例條" aria-valuenow={malePct} aria-valuemin="0" aria-valuemax="100">
              {male > 0 && (
                <div
                  className="gender-dist-segment male"
                  style={{ width: `${malePct}%` }}
                  title={`男: ${male} 人 (${malePct.toFixed(1)}%)`}
                />
              )}
              {female > 0 && (
                <div
                  className="gender-dist-segment female"
                  style={{ width: `${femalePct}%` }}
                  title={`女: ${female} 人 (${femalePct.toFixed(1)}%)`}
                />
              )}
            </div>
          </div>

          <div className="distribution-list">
            <div className="dist-item gender-item male">
              <div className="dist-label-group">
                <span className="gender-dist-dot male" />
                <span className="dist-label">男</span>
              </div>
              <div className="dist-value-group">
                <span className="dist-percentage-pill male">{malePct.toFixed(1)}%</span>
                <span className="dist-value">{male} 人</span>
              </div>
            </div>

            <div className="dist-item gender-item female">
              <div className="dist-label-group">
                <span className="gender-dist-dot female" />
                <span className="dist-label">女</span>
              </div>
              <div className="dist-value-group">
                <span className="dist-percentage-pill female">{femalePct.toFixed(1)}%</span>
                <span className="dist-value">{female} 人</span>
              </div>
            </div>
          </div>

          <div className="gender-dist-total">
            <span>總計：<strong>{total}</strong> 人</span>
          </div>
        </div>
      ) : (
        <p className="gender-dist-empty">尚無性別資料</p>
      )}
    </div>
  )
}
