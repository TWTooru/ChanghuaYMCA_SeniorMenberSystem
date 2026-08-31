import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AppHeader from './AppHeader'

describe('AppHeader', () => {
  it('shows the senior-learning dashboard name', () => {
    render(
      <AppHeader
        dbStatus="connected"
        permissions={{ canRefreshSync: false }}
        user={{ email: 'admin@admin.com' }}
        role="owner"
        onRefresh={vi.fn()}
        onShowExportModal={vi.fn()}
        onSignOut={vi.fn()}
        onToggleTheme={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { name: 'YMCA樂齡學員資料聯絡簿' })).toBeTruthy()
  })
})
