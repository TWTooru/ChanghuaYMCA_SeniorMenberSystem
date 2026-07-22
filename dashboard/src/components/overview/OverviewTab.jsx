import './OverviewTab.css'
import KpiCards from './KpiCards'
import AgeDistributionChart from './AgeDistributionChart'
import CoursePopularityChart from './CoursePopularityChart'
import EducationDistributionChart from './EducationDistributionChart'
import SeniorsMetricCard from './SeniorsMetricCard'

export default function OverviewTab({ students, stats = {} }) {
  return (
    <div>
      <KpiCards stats={stats} />
      <div className="overview-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <AgeDistributionChart ageGroups={stats?.ageGroups} />
          <CoursePopularityChart popularCourses={stats?.popularCourses} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <EducationDistributionChart eduCounts={stats?.eduCounts} totalStudents={stats?.totalStudents} />
          <SeniorsMetricCard students={students} />
        </div>
      </div>
    </div>
  )
}
