export function cleanStr(value) {
  if (value === undefined || value === null) return null
  const cleaned = String(value).trim()
  return cleaned || null
}

export function cleanInt(value) {
  if (value === undefined || value === null || value === '') return null
  const num = parseInt(value, 10)
  return Number.isNaN(num) ? null : num
}

export function cleanDate(value) {
  if (!value) return null

  if (typeof value === 'number' && value > 1000) {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000))
    const yyyy = date.getUTCFullYear()
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(date.getUTCDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  const cleaned = String(value).trim().replace(' 00:00:00', '')
  if (cleaned.length >= 10 && cleaned[4] === '-' && cleaned[7] === '-') {
    return cleaned.substring(0, 10)
  }
  if (cleaned.length >= 8 && cleaned.includes('/')) {
    return cleaned.replace(/\//g, '-')
  }
  return cleaned || null
}

export function cleanScore(value) {
  if (value === undefined || value === null || value === '') return null

  const cleaned = String(value).trim().replace(' 00:00:00', '')
  if (!cleaned) return null

  if (/^\d+(\.\d+)?$/.test(cleaned)) {
    return String(parseInt(cleaned, 10))
  }

  if (cleaned.length >= 10 && cleaned[4] === '-' && cleaned[7] === '-') {
    return cleaned.substring(0, 10).replace(/-/g, '/')
  }

  return cleaned
}

export function cleanCourseName(value) {
  if (!value) return null
  const cleaned = String(value).trim()
  if (!cleaned || cleaned.includes('Unnamed')) return null
  if (cleaned.includes('00:00:00') || /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}/.test(cleaned)) {
    return null
  }
  return cleaned
}

const CHINESE_SEASON_NUMBERS = [
  ['二十', 20],
  ['十九', 19],
  ['十八', 18],
  ['十七', 17],
  ['十六', 16],
  ['十五', 15],
  ['十四', 14],
  ['十三', 13],
  ['十二', 12],
  ['十一', 11],
  ['十', 10],
  ['九', 9],
  ['八', 8],
  ['七', 7],
  ['六', 6],
  ['五', 5],
  ['四', 4],
  ['三', 3],
  ['二', 2],
  ['一', 1]
]

export function extractSeasonNum(value) {
  const season = String(value || '')
  const digitMatch = season.match(/\d+/)
  if (digitMatch) return parseInt(digitMatch[0], 10)

  const matched = CHINESE_SEASON_NUMBERS.find(([label]) => season.includes(label))
  return matched ? matched[1] : -1
}
