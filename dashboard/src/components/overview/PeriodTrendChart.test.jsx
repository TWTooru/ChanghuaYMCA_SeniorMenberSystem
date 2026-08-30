import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import PeriodTrendChart from './PeriodTrendChart'

describe('PeriodTrendChart', () => {
  it('exposes each period as a labelled progress value relative to the busiest period', () => {
    render(<PeriodTrendChart periodStats={[
      { period: '第15期', enrollments: 40 },
      { period: '第16期', enrollments: 80 },
    ]} />)

    const previousPeriod = screen.getByRole('progressbar', { name: '第15期報名趨勢' })
    const currentPeriod = screen.getByRole('progressbar', { name: '第16期報名趨勢' })

    expect(previousPeriod.getAttribute('aria-valuenow')).toBe('50')
    expect(currentPeriod.getAttribute('aria-valuenow')).toBe('100')
    expect(previousPeriod.getAttribute('data-slot')).toBe('progress')
  })
})
