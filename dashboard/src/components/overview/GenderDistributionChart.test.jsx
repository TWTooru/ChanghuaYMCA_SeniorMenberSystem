import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import GenderDistributionChart from './GenderDistributionChart'

describe('GenderDistributionChart', () => {
  it('renders only male and female counts with percentages and progress bar', () => {
    render(<GenderDistributionChart genderCounts={[{ label: '男', value: 2 }, { label: '女', value: 3 }]} />)
    expect(screen.getByText('男')).not.toBeNull()
    expect(screen.getByText('2 人')).not.toBeNull()
    expect(screen.getByText('40.0%')).not.toBeNull()
    expect(screen.getByText('女')).not.toBeNull()
    expect(screen.getByText('3 人')).not.toBeNull()
    expect(screen.getByText('60.0%')).not.toBeNull()
    expect(screen.getByText('5')).not.toBeNull()
    expect(screen.queryByText(/未知/)).toBeNull()
  })

  it('renders empty message when no gender data is available', () => {
    render(<GenderDistributionChart genderCounts={[]} />)
    expect(screen.getByText('尚無性別資料')).not.toBeNull()
  })
})
