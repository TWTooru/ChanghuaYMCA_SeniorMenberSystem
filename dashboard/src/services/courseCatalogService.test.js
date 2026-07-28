import { describe, expect, it, vi } from 'vitest'
import {
  deactivateCourseCatalogEntry,
  fetchCourseCatalog,
  saveCourseCatalogEntry,
} from './courseCatalogService'

describe('fetchCourseCatalog', () => {
  it('loads ordered catalog rows and normalizes their fields', async () => {
    const calls = []
    const client = {
      from(table) {
        calls.push({ table })
        return {
          select(columns) {
            calls.push({ columns })
            return {
              order: async column => {
                calls.push({ column })
                return {
                  data: [
                    { course_catalog_id: 2, course_name: '北歐健走', active: 0 },
                    { course_catalog_id: 1, course_name: '肌力訓練', active: 1 },
                  ],
                  error: null,
                }
              },
            }
          },
        }
      },
    }

    await expect(fetchCourseCatalog(client)).resolves.toEqual([
      { courseCatalogId: 2, courseName: '北歐健走', active: false },
      { courseCatalogId: 1, courseName: '肌力訓練', active: true },
    ])
    expect(calls).toEqual([
      { table: 'course_catalog' },
      { columns: 'course_catalog_id, course_name, active' },
      { column: 'course_name' },
    ])
  })

  it('throws the Supabase error when catalog loading fails', async () => {
    const error = new Error('catalog read denied')
    const client = {
      from() {
        return {
          select() {
            return { order: async () => ({ data: null, error }) }
          },
        }
      },
    }

    await expect(fetchCourseCatalog(client)).rejects.toBe(error)
  })
})

describe('saveCourseCatalogEntry', () => {
  it('adds or reactivates a trimmed course through the catalog RPC', async () => {
    const calls = []
    const client = {
      rpc: async (name, payload) => {
        calls.push({ name, payload })
        return {
          data: { course_catalog_id: 4, course_name: '肌力訓練', active: true },
          error: null,
        }
      },
    }

    await expect(saveCourseCatalogEntry(client, '  肌力訓練  ')).resolves.toEqual({
      courseCatalogId: 4,
      courseName: '肌力訓練',
      active: true,
    })
    expect(calls).toEqual([
      { name: 'upsert_course_catalog', payload: { p_course_name: '肌力訓練' } },
    ])
  })

  it('rejects a blank course name before calling Supabase', async () => {
    const client = { rpc: vi.fn() }

    await expect(saveCourseCatalogEntry(client, '   ')).rejects.toThrow('課程名稱為必填')
    expect(client.rpc).not.toHaveBeenCalled()
  })

  it('throws the Supabase error when saving a catalog entry fails', async () => {
    const error = new Error('catalog write denied')
    const client = { rpc: async () => ({ data: null, error }) }

    await expect(saveCourseCatalogEntry(client, '肌力訓練')).rejects.toBe(error)
  })
})

describe('deactivateCourseCatalogEntry', () => {
  it('updates only the active flag for the selected catalog entry', async () => {
    const calls = []
    const client = {
      from(table) {
        calls.push({ table })
        return {
          update(payload) {
            calls.push({ payload })
            return {
              eq: async (column, value) => {
                calls.push({ column, value })
                return { error: null }
              },
            }
          },
        }
      },
    }

    await expect(deactivateCourseCatalogEntry(client, 7)).resolves.toBeUndefined()
    expect(calls).toEqual([
      { table: 'course_catalog' },
      { payload: { active: false } },
      { column: 'course_catalog_id', value: 7 },
    ])
  })

  it('throws the Supabase error when deactivation fails', async () => {
    const error = new Error('catalog update denied')
    const client = {
      from() {
        return {
          update() {
            return { eq: async () => ({ error }) }
          },
        }
      },
    }

    await expect(deactivateCourseCatalogEntry(client, 7)).rejects.toBe(error)
  })
})
