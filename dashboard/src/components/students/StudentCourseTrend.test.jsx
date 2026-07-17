import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import StudentCourseTrend from './StudentCourseTrend'

describe('StudentCourseTrend', () => {
  afterEach(cleanup)

  it('renders ranked bars, counts, and season badges', () => {
    const { container } = render(
      <StudentCourseTrend
        timeline={[
          { enrollment_id: 1, season: '第十五季', courses: ['電腦課', '手機課'] },
          { enrollment_id: 2, season: '第十六季', courses: ['電腦課'] },
        ]}
      />
    )

    expect(screen.getByRole('heading', { name: '學生選課趨勢圖' })).not.toBeNull()
    expect(screen.getByText('電腦課')).not.toBeNull()
    expect(screen.getByText('2 次')).not.toBeNull()
    expect(screen.getAllByText(/第十[五六]季/)).toHaveLength(3)
    expect(container.querySelector('.student-course-trend-fill').style.width).toBe('100%')
  })

  it('renders the empty state when no valid courses remain', () => {
    render(
      <StudentCourseTrend
        timeline={[{ enrollment_id: 1, season: '第十五季', refunded: true, courses: ['電腦課'] }]}
      />
    )

    expect(screen.getByText('尚無選課趨勢資料')).not.toBeNull()
  })
})
