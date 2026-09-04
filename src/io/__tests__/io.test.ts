import { describe, expect, it } from 'vitest'
import { deserializeProject, serializeProject, suggestedFileName } from '../json'
import { projectToCsv, CSV_BOM } from '../csv'
import { createExampleProject } from '../../domain/example'
import { compare } from '../../domain/compare'

describe('JSON-Export und -Import', () => {
  it('lädt einen Export verlustfrei zurück', () => {
    const original = createExampleProject()
    const result = deserializeProject(serializeProject(original))
    expect(result.ok).toBe(true)
    if (!result.ok) return

    // Die Ergebnisse müssen identisch sein, nicht nur die Struktur.
    const before = compare(original, 'cashflow')
    const after = compare(result.project, 'cashflow')
    expect(after.delta).toBe(before.delta)
    expect(after.onprem.totalByYear).toEqual(before.onprem.totalByYear)
    expect(after.cloud.totalByYear).toEqual(before.cloud.totalByYear)
  })

  it('meldet ungültiges JSON im Klartext', () => {
    const result = deserializeProject('{ kein json')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]).toContain('kein gültiges JSON')
  })

  it('bildet einen dateisystemtauglichen Namen', () => {
    const p = createExampleProject()
    p.meta.title = 'Vergleich: RZ/Cloud «2026»'
    expect(suggestedFileName(p, 'json')).toMatch(/^Vergleich-RZCloud-2026-\d{4}-\d{2}-\d{2}\.json$/)
  })
})

describe('CSV-Export', () => {
  const csv = projectToCsv(createExampleProject(), 'cashflow')

  it('beginnt mit dem BOM, damit Excel Umlaute korrekt liest', () => {
    expect(csv.startsWith(CSV_BOM)).toBe(true)
    expect(csv).toContain('Einmalaufwände')
  })

  it('nutzt Semikolon als Trenner und Komma als Dezimalzeichen', () => {
    const line = csv.split('\r\n').find((l) => l.startsWith('Betrachtungszeitraum'))
    expect(line).toContain(';')
    expect(csv).toMatch(/;\d+,\d{2}(;|$)/m)
  })

  it('enthält Annahmen, Jahreswerte, Kennzahlen und Rohdaten', () => {
    expect(csv).toContain('Diskontierungssatz')
    expect(csv).toContain('Jahreswerte je Block')
    expect(csv).toContain('Barwerte (Basis: Cashflow)')
    expect(csv).toContain('Kennzahlen')
    expect(csv).toContain('Eingabewerte (Rohdaten)')
  })

  it('führt jede aktive Eingabezeile als Rohdatum auf', () => {
    const rawSection = csv.slice(csv.indexOf('Eingabewerte (Rohdaten)'))
    // Beispiel: die On-Prem-Investition in Compute und die Cloud-OpEx.
    expect(rawSection).toContain('CapEx')
    expect(rawSection).toContain('pro Monat')
    expect(rawSection).toContain('(global)')
  })
})
