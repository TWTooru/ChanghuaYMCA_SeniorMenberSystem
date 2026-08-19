import './OverviewTab.css'
import KpiCards from './KpiCards'
import EducationDistributionChart from './EducationDistributionChart'
import GenderDistributionChart from './GenderDistributionChart'
import PeriodTrendChart from './PeriodTrendChart'
import CollapsiblePanel from './CollapsiblePanel'

export default function OverviewTab({ stats = {} }) {
  const educationCounts = Object.fromEntries((stats.educationCounts ?? []).map(({ label, value }) => [label, value]))
  return <div>
    <CollapsiblePanel title={`當期概況：${stats.currentPeriod || '尚無資料'}`} className="period-summary-card"><p>報名：{stats.currentPeriodStats?.enrollments ?? 0}，退款：{stats.currentPeriodStats?.refunds ?? 0}</p></CollapsiblePanel>
    <CollapsiblePanel title="整體 KPI" className="kpi-panel"><KpiCards stats={stats} currentSeasonStats={stats.currentPeriodStats} previousSeasonStats={stats.previousPeriodStats} /></CollapsiblePanel>
    <CollapsiblePanel title="歷期報名趨勢" className="trend-panel"><PeriodTrendChart periodStats={stats.periodStats} /></CollapsiblePanel>
    <div className="overview-grid"><CollapsiblePanel title="會員教育程度" className="education-insights-card"><EducationDistributionChart eduCounts={educationCounts} totalStudents={stats.totalStudents ?? 0} embedded /></CollapsiblePanel><CollapsiblePanel title="性別分布"><GenderDistributionChart genderCounts={stats.genderCounts} embedded /></CollapsiblePanel></div>
  </div>
}
