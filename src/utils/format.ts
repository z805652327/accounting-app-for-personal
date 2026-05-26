export function formatMoney(n: number): string {
  return '¥' + Math.abs(n).toFixed(2)
}

export function formatDate(d: string | Date): string {
  if (typeof d === 'string') d = new Date(d)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function getPeriodStart(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`
}

export function getPeriodEnd(year: number, month: number): string {
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 }
  return `${next.y}-${String(next.m).padStart(2, '0')}-01`
}

export function todayStr(): string {
  return formatDate(new Date())
}

/** Months between two date strings (YYYY-MM or YYYY-MM-DD) */
export function monthsBetween(start: string, end: string): number {
  const [sy, sm] = start.split('-').map(Number)
  const [ey, em] = end.split('-').map(Number)
  return (ey - sy) * 12 + (em - sm)
}

/** Add months to a date string (YYYY-MM) */
export function addMonths(date: string, months: number): string {
  const [y, m] = date.split('-').map(Number)
  const total = y * 12 + (m - 1) + months
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}
