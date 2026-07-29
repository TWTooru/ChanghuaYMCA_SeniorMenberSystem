import { Users, BookOpen, DollarSign } from 'lucide-react'

/** 顯示 dashboard 的學生、報名與退費 KPI 摘要。 */
export default function KpiCards({ stats }) {
  return (
    <div className="kpi-grid">
      <div className="kpi-card">
        <div className="kpi-icon-wrapper purple"><Users size={24} /></div>
        <div>
          <div className="kpi-label">累計服務學員</div>
          <div className="kpi-value-area">
            <span className="kpi-value">{stats?.totalStudents ?? 0}</span>
            <span className="kpi-unit">人</span>
          </div>
        </div>
      </div>
      <div className="kpi-card">
        <div className="kpi-icon-wrapper emerald"><BookOpen size={24} /></div>
        <div>
          <div className="kpi-label">累計選課總人次</div>
          <div className="kpi-value-area">
            <span className="kpi-value">{stats?.totalRegistrations ?? 0}</span>
            <span className="kpi-unit">人次</span>
          </div>
        </div>
      </div>
      <div className="kpi-card">
        <div className="kpi-icon-wrapper amber"><DollarSign size={24} /></div>
        <div>
          <div className="kpi-label">累計退費記錄</div>
          <div className="kpi-value-area">
            <span className="kpi-value">{stats?.totalRefunds ?? 0}</span>
            <span className="kpi-unit">人次</span>
          </div>
        </div>
      </div>
    </div>
  )
}
