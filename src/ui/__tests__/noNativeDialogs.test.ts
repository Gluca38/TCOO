import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Native Browserdialoge sind in dieser Anwendung verboten.
 *
 * Die App läuft auch eingebettet in einem abgeschotteten Rahmen — etwa als
 * geteilte Vorschau. Dort sind `confirm`, `prompt` und `alert` blockiert und
 * liefern **ohne Fehlermeldung** `false` beziehungsweise `null`. Ein Knopf,
 * der daran hängt, wirkt dann schlicht kaputt: Er tut nichts, und niemand
 * sieht warum.
 *
 * Genau das ist einmal passiert (der Knopf „Neu" ließ sich im eingebetteten
 * Betrieb nicht mehr auslösen). Dieser Test verhindert die Rückkehr.
 */

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : []
  })
}

describe('Keine nativen Browserdialoge', () => {
  it('verwendet nirgends confirm, prompt oder alert', () => {
    const treffer: string[] = []

    for (const file of sourceFiles('src')) {
      const inhalt = readFileSync(file, 'utf8')
      inhalt.split('\n').forEach((zeile, i) => {
        // Kommentare dürfen die Regel erklären, ohne sie zu verletzen.
        const code = zeile.trim()
        if (code.startsWith('*') || code.startsWith('//') || code.startsWith('/*')) return
        // Nur echte Aufrufe, keine Vorkommen in Wörtern wie "bestätigen".
        if (/(?<![\w.])(window\.)?(confirm|prompt|alert)\s*\(/.test(zeile)) {
          treffer.push(`${file}:${i + 1}: ${code}`)
        }
      })
    }

    expect(treffer, `Native Dialoge gefunden:\n${treffer.join('\n')}`).toEqual([])
  })
})
