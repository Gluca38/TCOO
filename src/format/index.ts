/** Formatierung und Eingabeparsing für de-DE. */

const currencyFmt = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

const currencyPreciseFmt = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Währung ohne Nachkommastellen — die Standardanzeige in Tabellen. */
export function eur(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return currencyFmt.format(value)
}

/** Währung mit Nachkommastellen — für die Aufschlüsselung. */
export function eurPrecise(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return currencyPreciseFmt.format(value)
}

/** Währung mit ausdrücklichem Vorzeichen, damit die Aussage nicht an der Farbe hängt. */
export function eurSigned(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${currencyFmt.format(Math.abs(value))}`
}

export function num(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: digits }).format(value)
}

export function percent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '—'
  return `${numberFmtWithDigits(digits).format(value * 100)} %`
}

export function percentSigned(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '—'
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${numberFmtWithDigits(digits).format(Math.abs(value) * 100)} %`
}

function numberFmtWithDigits(digits: number) {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

/**
 * Tolerantes Parsen von Betragseingaben.
 *
 * Akzeptiert „1.500,50", „1500,5", „1500.5" und „1 500". Rückgabe null, wenn
 * sich keine Zahl erkennen lässt — dann bleibt der bisherige Wert stehen.
 */
export function parseAmount(input: string): number | null {
  const raw = input.trim().replace(/[€\s\u00a0\u202f]/g, '')
  if (raw === '') return 0

  const hasComma = raw.includes(',')
  const hasDot = raw.includes('.')

  let normalized: string
  if (hasComma && hasDot) {
    // Das letzte Trennzeichen ist das Dezimaltrennzeichen.
    normalized =
      raw.lastIndexOf(',') > raw.lastIndexOf('.')
        ? raw.replace(/\./g, '').replace(',', '.')
        : raw.replace(/,/g, '')
  } else if (hasComma) {
    normalized = raw.replace(',', '.')
  } else if (hasDot) {
    // Ein Punkt mit genau drei Folgeziffern ist ein Tausenderpunkt.
    normalized = /^\d{1,3}(\.\d{3})+$/.test(raw) ? raw.replace(/\./g, '') : raw
  } else {
    normalized = raw
  }

  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

/** Parsen von Prozenteingaben („3,5" oder „3,5 %") zu einer Dezimalzahl. */
export function parsePercent(input: string): number | null {
  const value = parseAmount(input.replace('%', ''))
  return value === null ? null : value / 100
}

/**
 * Beschriftung eines Break-even-Werts.
 * 0 bedeutet „von Beginn an günstiger", null „im Zeitraum nicht erreicht".
 */
export function breakEvenLabel(value: number | null, startYear: number): string {
  if (value === null) return 'im Zeitraum nicht erreicht'
  if (value <= 0) return 'von Beginn an günstiger'
  const yearIndex = value + 1
  const calendar = startYear + Math.floor(value)
  return `Jahr ${num(yearIndex, 1)} (${calendar})`
}
