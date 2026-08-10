import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import OverviewTab from './OverviewTab'

describe('OverviewTab', () => {
  it('groups education, seniors, and gender content in one collapsible card', () => {
    const { container } = render(<OverviewTab students={[]} stats={{ totalStudents: 1, males: 1, females: 0, eduCounts: {} }} />)

    const card = container.querySelector('.education-insights-card')
    expect(card).not.toBeNull()
    expect(card.textContent).toContain('教育程度分佈')
    expect(card.textContent).toContain('樂齡學員佔比 (60歲以上)')
    expect(card.textContent).toContain('性別分布')
    expect(screen.getByRole('button', { name: '收合教育程度分佈' }).getAttribute('aria-expanded')).toBe('true')
  })
})
