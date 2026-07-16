const CHINESE_DIGITS = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9
}

function parseChineseNumber(value) {
  if (!/^[一二三四五六七八九十]+$/.test(value)) return -1

  if (!value.includes('十')) return CHINESE_DIGITS[value] || -1

  const [tens, ones] = value.split('十')
  if (value.split('十').length !== 2 || (tens && !CHINESE_DIGITS[tens]) || (ones && !CHINESE_DIGITS[ones])) {
    return -1
  }

  return (tens ? CHINESE_DIGITS[tens] : 1) * 10 + (ones ? CHINESE_DIGITS[ones] : 0)
}

export function seasonNumber(value) {
  const match = String(value ?? '').match(/第(\d+|[一二三四五六七八九十]+)[季期]/)
  if (!match) return -1

  const number = /^\d+$/.test(match[1]) ? Number(match[1]) : parseChineseNumber(match[1])
  return Number.isInteger(number) && number >= 1 && number <= 99 ? number : -1
}

export function formatSeason(number) {
  if (!Number.isInteger(number) || number < 1 || number > 99) return null

  const ones = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九']
  const tens = Math.floor(number / 10)
  const remainder = number % 10
  const chineseNumber = tens === 0
    ? ones[remainder]
    : `${tens === 1 ? '' : ones[tens]}十${remainder ? ones[remainder] : ''}`

  return `第${chineseNumber}季`
}

export function normalizeSeason(value) {
  return formatSeason(seasonNumber(value))
}

export function compareSeasons(a, b) {
  return seasonNumber(a) - seasonNumber(b)
}

export function latestSeason(values) {
  const seasons = Array.from(values || [])
    .map(seasonNumber)
    .filter((number) => number !== -1)

  return seasons.length ? formatSeason(Math.max(...seasons)) : null
}
