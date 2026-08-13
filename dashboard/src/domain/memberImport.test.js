import { describe, expect, it } from 'vitest'
import { MEMBER_IMPORT_HEADERS, parseMemberRows } from './memberImport'

const validRow = {
  電子郵件地址: ' MEMBER@Example.COM ',
  姓名: ' 王小明 ',
  性別: '男',
  '電話 / 手機號碼': '0912-345-678',
  出生年月日: '民國69/7/1',
  通訊處: ' 台北市 ',
  '服務機關 / 學校': ' 市民大學 ',
  教育程度: '高中',
}

describe('member import parser', () => {
  it('uses the approved Google Form business headers', () => {
    expect(MEMBER_IMPORT_HEADERS).toEqual([
      '電子郵件地址', '姓名', '性別', '電話 / 手機號碼', '出生年月日',
      '通訊處', '服務機關 / 學校', '教育程度',
    ])
  })

  it('maps and normalizes a valid row into the final member profile payload', () => {
    expect(parseMemberRows([validRow], { headers: ['時間戳記', ...MEMBER_IMPORT_HEADERS] })).toMatchObject({
      errors: [],
      rows: [{
        source_row: 2,
        student: {
          email: 'member@example.com', name: '王小明', gender: '男', phone: '0912-345-678',
          birth_date: '1980-07-01', address: '台北市', organization: '市民大學', education: '高中',
        },
      }],
    })
  })

  it('accepts the exact Google Form export headers and gender labels', () => {
    const parsed = parseMemberRows([{
      電子郵件地址: 'test@test.com',
      姓名: '黃彥志',
      性別: '男性',
      '電話/手機號碼': '09099996939',
      出生年月日: '1999/1/1',
      通訊處: '彰化市永芳路467巷70弄10號',
      '服務機關/學校': null,
      教育程度: '專科/大學',
    }], {
      headers: [
        '時間戳記', '電子郵件地址', '姓名', '性別', '電話/手機號碼',
        '出生年月日', '通訊處', '服務機關/學校', '教育程度',
      ],
    })

    expect(parsed.errors).toEqual([])
    expect(parsed.rows[0].student).toMatchObject({
      email: 'test@test.com',
      name: '黃彥志',
      gender: '男',
      phone: '09099996939',
      birth_date: '1999-01-01',
      address: '彰化市永芳路467巷70弄10號',
      organization: null,
      education: '專科/大學',
    })
  })

  it('reports missing headers and row-level final-profile validation errors', () => {
    const parsed = parseMemberRows([{ ...validRow, 電子郵件地址: 'not-email', 性別: '其他', 教育程度: '博士', 出生年月日: 'bad-date' }], {
      headers: MEMBER_IMPORT_HEADERS.filter(header => header !== '通訊處'),
    })
    expect(parsed.errors).toEqual(expect.arrayContaining([
      { row: null, field: '表頭', message: '缺少必要欄位：通訊處' },
      expect.objectContaining({ row: 2, field: '電子郵件地址' }),
      expect.objectContaining({ row: 2, field: '性別' }),
      expect.objectContaining({ row: 2, field: '教育程度' }),
      expect.objectContaining({ row: 2, field: '出生年月日' }),
    ]))
  })
})
