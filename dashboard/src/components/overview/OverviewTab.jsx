import './OverviewTab.css'
import KpiCards from './KpiCards'
import AgeDistributionChart from './AgeDistributionChart'
import CoursePopularityChart from './CoursePopularityChart'

export default function OverviewTab({ students, stats = {} }) {
  return (
    <div>
      <KpiCards stats={stats} />
      <div className="overview-grid">
        <AgeDistributionChart ageGroups={stats?.ageGroups} />
        <CoursePopularityChart
          popularCourses={stats?.popularCourses}
          eduCounts={stats?.eduCounts}
          totalStudents={stats?.totalStudents}
          students={students}
        />
      </div>
    </div>
  )
}
