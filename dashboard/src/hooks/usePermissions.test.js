// src/hooks/usePermissions.test.js
import { describe, it, expect } from 'vitest'
import { getPermissions } from './usePermissions'

describe('getPermissions', () => {
  it('viewer can only view and export', () => {
    const p = getPermissions('viewer')
    expect(p.canViewData).toBe(true)
    expect(p.canExportExcel).toBe(true)
    expect(p.canAddStudent).toBe(false)
    expect(p.canEditStudent).toBe(false)
    expect(p.canDeleteStudent).toBe(false)
    expect(p.canAddEnrollment).toBe(false)
    expect(p.canEditEnrollment).toBe(false)
    expect(p.canDeleteEnrollment).toBe(false)
    expect(p.canSyncExcel).toBe(false)
    expect(p.canRefreshSync).toBe(false)
  })

  it('editor can add and edit but not delete', () => {
    const p = getPermissions('editor')
    expect(p.canViewData).toBe(true)
    expect(p.canExportExcel).toBe(true)
    expect(p.canAddStudent).toBe(true)
    expect(p.canEditStudent).toBe(true)
    expect(p.canDeleteStudent).toBe(false)
    expect(p.canAddEnrollment).toBe(true)
    expect(p.canEditEnrollment).toBe(true)
    expect(p.canDeleteEnrollment).toBe(false)
    expect(p.canSyncExcel).toBe(true)
    expect(p.canRefreshSync).toBe(true)
  })

  it('admin has all permissions', () => {
    const p = getPermissions('admin')
    expect(p.canViewData).toBe(true)
    expect(p.canExportExcel).toBe(true)
    expect(p.canAddStudent).toBe(true)
    expect(p.canEditStudent).toBe(true)
    expect(p.canDeleteStudent).toBe(true)
    expect(p.canAddEnrollment).toBe(true)
    expect(p.canEditEnrollment).toBe(true)
    expect(p.canDeleteEnrollment).toBe(true)
    expect(p.canSyncExcel).toBe(true)
    expect(p.canRefreshSync).toBe(true)
  })

  it('unknown role defaults to viewer permissions', () => {
    const p = getPermissions('unknown_role')
    expect(p.canAddStudent).toBe(false)
    expect(p.canDeleteStudent).toBe(false)
    expect(p.canViewData).toBe(true)
  })

  it('undefined role defaults to viewer permissions', () => {
    const p = getPermissions(undefined)
    expect(p.canAddStudent).toBe(false)
    expect(p.canViewData).toBe(true)
  })
})
