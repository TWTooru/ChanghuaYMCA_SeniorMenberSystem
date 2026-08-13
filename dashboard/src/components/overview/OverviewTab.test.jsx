import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import OverviewTab from './OverviewTab'

const stats = { totalStudents: 3, totalRegistrations: 2, totalRefunds: 0, currentPeriod: '第16期', currentPeriodStats: { enrollments: 2, refunds: 0 }, educationCounts: [{ label: '國中以下', value: 0 }, { label: '高中', value: 1 }, { label: '專科/大學', value: 2 }, { label: '研究所', value: 0 }], genderCounts: [{ label: '男', value: 1 }, { label: '女', value: 2 }] }

describe('OverviewTab', () => {
  it('renders current period, KPI, education, and binary gender only', () => {
    render(<OverviewTab stats={stats} />)
    for (const label of ['當期概況：第16期', '整體 KPI', '會員教育程度', '性別分布']) expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    expect(screen.queryByText(/年齡/)).toBeNull()
    expect(screen.queryByText(/樂齡/)).toBeNull()
    expect(screen.queryByText(/熱門課程/)).toBeNull()
  })
})
