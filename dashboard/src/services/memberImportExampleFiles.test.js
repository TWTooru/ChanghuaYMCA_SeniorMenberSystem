import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { prepareImport } from './dataImportService'

const exampleNames = [
  '彰化YMCA_社教課程報名表單 (回覆).csv',
  '彰化YMCA_社教課程報名表單 (回覆).xlsx',
]

const client = {
  from: () => ({
    select: () => ({
      order: () => Promise.resolve({ data: [], error: null }),
    }),
  }),
}

async function loadExampleFile(name) {
  const bytes = await readFile(resolve(process.cwd(), '..', 'import example', name))
  const contents = new Uint8Array(bytes.byteLength)
  contents.set(bytes)
  return {
    name,
    size: bytes.byteLength,
    arrayBuffer: () => Promise.resolve(contents.buffer),
  }
}

describe.each(exampleNames)('member import example: %s', name => {
  it('previews the supplied Google Form export without blocking errors', async () => {
    const file = await loadExampleFile(name)
    const preview = await prepareImport(file, client)

    expect(preview).toMatchObject({
      summary: { fileRows: 1, newStudents: 1, currentStudents: 0 },
      errors: [],
      hasBlockingErrors: false,
      payload: {
        rows: [{
          source_row: 2,
          student: {
            email: 'test@test.com',
            name: '黃彥志',
            gender: '男',
            phone: '09099996939',
            birth_date: '1999-01-01',
            address: '彰化市永芳路467巷70弄10號',
            organization: null,
            education: '專科/大學',
          },
        }],
      },
    })
  })
})
