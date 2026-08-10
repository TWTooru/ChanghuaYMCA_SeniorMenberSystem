import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SeasonSummaryCard from './SeasonSummaryCard'

describe('SeasonSummaryCard', () => {
  it('renders the current-season Chinese labels', () => {
    render(<SeasonSummaryCard currentSeason="第十六季" currentSeasonStats={{ enrollments: 12, refundRate: 4, uniqueStudents: 10, newStudents: 3, returningStudents: 7, avgCoursesPerStudent: 1.2 }} />)

    for (const label of ['本季學員數', '新生人數', '續報率', '本季報名人次', '退費率', '平均每人報課數']) {
      expect(screen.getByText(label)).toBeTruthy()
    }
  })
})
