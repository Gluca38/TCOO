import type { Project } from '../domain/types'
import { parseProject, type ParseResult } from '../domain/schema'

/** Dateiname aus dem Projekttitel, auf dateisystemtaugliche Zeichen reduziert. */
export function suggestedFileName(project: Project, extension: string): string {
  const base = project.meta.title
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .slice(0, 60)
  const date = new Date().toISOString().slice(0, 10)
  return `${base || 'tco-vergleich'}-${date}.${extension}`
}

export function serializeProject(project: Project): string {
  return JSON.stringify(project, null, 2)
}

export function deserializeProject(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, errors: ['Die Datei ist kein gültiges JSON.'] }
  }
  return parseProject(raw)
}

/** Löst den Download einer Textdatei aus. */
export function downloadText(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
