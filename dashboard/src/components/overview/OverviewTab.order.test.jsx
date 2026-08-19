import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import OverviewTab from './OverviewTab'

describe('OverviewTab layout', () => {
  it('places current-period summary before KPI and distributions', () => {
    render(<OverviewTab stats={{ currentPeriod: '第16期', educationCounts: [], genderCounts: [] }} />)
    const content = document.body.textContent
    expect(content.indexOf('當期概況：第16期')).toBeLessThan(content.indexOf('整體 KPI'))
    expect(content.indexOf('整體 KPI')).toBeLessThan(content.indexOf('歷期報名趨勢'))
    expect(content.indexOf('歷期報名趨勢')).toBeLessThan(content.indexOf('會員教育程度'))
  })
})
