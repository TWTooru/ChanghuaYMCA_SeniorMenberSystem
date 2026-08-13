const PERIOD_PATTERN = /^第([1-9][0-9]*)期$/

export function periodNumber(value) {
  const match = String(value ?? '').trim().match(PERIOD_PATTERN)
  return match ? Number(match[1]) : -1
}

export function formatPeriod(number) {
  return Number.isSafeInteger(number) && number > 0 ? `第${number}期` : null
}

export function normalizePeriod(value) {
  return formatPeriod(periodNumber(value))
}

export function comparePeriods(a, b) {
  return periodNumber(a) - periodNumber(b)
}

export function latestPeriod(values) {
  const numbers = Array.from(values ?? []).map(periodNumber).filter(number => number > 0)
  return numbers.length ? formatPeriod(Math.max(...numbers)) : null
}
