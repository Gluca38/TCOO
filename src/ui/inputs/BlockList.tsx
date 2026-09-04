import { useState } from 'react'
import { useStore } from '../../state/store'
import { useComparison, useWarnings } from '../useComparison'
import { ScenarioEntry } from './ScenarioEntry'
import { eur, eurSigned } from '../../format'
import type { BlockId } from '../../domain/types'

/** Eingabeabschnitt: Blockliste mit Gegenüberstellung beider Szenarien. */
export function BlockList() {
  const blocks = useStore((s) => s.project.blocks)
  const addBlock = useStore((s) => s.addBlock)
  const [open, setOpen] = useState<Set<BlockId>>(new Set())

  function toggle(id: BlockId) {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <section id="eingabe" className="mx-auto max-w-[1600px] px-4 py-6">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Eingabe</h2>
          <p className="text-sm text-slate-500">
            Je Block ein kumulierter Betrag pro Szenario — keine Einzelpositionen, keine Preisliste.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOpen(new Set(blocks.map((b) => b.id)))}
            className="text-sm text-slate-500 hover:text-accent-700"
          >
            alle öffnen
          </button>
          <span className="text-slate-300">·</span>
          <button
            type="button"
            onClick={() => setOpen(new Set())}
            className="text-sm text-slate-500 hover:text-accent-700"
          >
            alle schließen
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>Kostenblock</span>
          <span className="w-32 text-right">On-Premises</span>
          <span className="w-32 text-right">Cloud</span>
          <span className="w-32 text-right">Differenz</span>
          <span className="w-20" />
        </div>

        {blocks.map((block) => (
          <BlockRow
            key={block.id}
            blockId={block.id}
            expanded={open.has(block.id)}
            onToggle={() => toggle(block.id)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => {
          const name = prompt('Name des neuen Kostenblocks')
          if (name?.trim()) addBlock(name.trim())
        }}
        className="mt-3 rounded-md border border-dashed border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:border-accent-400 hover:text-accent-700"
      >
        + Kostenblock hinzufügen
      </button>
    </section>
  )
}

function BlockRow({
  blockId,
  expanded,
  onToggle,
}: {
  blockId: BlockId
  expanded: boolean
  onToggle: () => void
}) {
  const block = useStore((s) => s.project.blocks.find((b) => b.id === blockId))!
  const updateBlock = useStore((s) => s.updateBlock)
  const removeBlock = useStore((s) => s.removeBlock)
  const result = useComparison()
  const warnings = useWarnings().filter((w) => w.blockId === blockId)
  const [renaming, setRenaming] = useState(false)

  const onpremTotal = sum(result.onprem.byBlock[blockId])
  const cloudTotal = sum(result.cloud.byBlock[blockId])
  const delta = onpremTotal - cloudTotal
  const empty = onpremTotal === 0 && cloudTotal === 0

  return (
    <div className={`border-b border-slate-150 last:border-b-0 ${block.enabled ? '' : 'bg-slate-50'}`}>
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onToggle}
            className="w-4 shrink-0 text-slate-400 transition hover:text-slate-700"
            aria-label={expanded ? 'Block schließen' : 'Block öffnen'}
          >
            {expanded ? '▾' : '▸'}
          </button>
          <input
            type="checkbox"
            checked={block.enabled}
            onChange={(e) => updateBlock(blockId, { enabled: e.target.checked })}
            className="h-4 w-4 shrink-0 rounded border-slate-300 text-accent-600 focus:ring-accent-400"
            title={block.enabled ? 'Block aktiv' : 'Block deaktiviert — fließt nirgends ein'}
          />
          {renaming ? (
            <input
              autoFocus
              className="min-w-0 flex-1 rounded border border-accent-400 px-1.5 py-0.5 text-sm focus:outline-none"
              defaultValue={block.name}
              onBlur={(e) => {
                if (e.target.value.trim()) updateBlock(blockId, { name: e.target.value.trim() })
                setRenaming(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
                if (e.key === 'Escape') setRenaming(false)
              }}
            />
          ) : (
            <button
              type="button"
              onClick={onToggle}
              className={`truncate text-left text-sm font-medium ${
                block.enabled ? 'text-slate-800' : 'text-slate-400 line-through'
              }`}
            >
              {block.name}
            </button>
          )}
          {block.hint === 'onprem-typical' && (
            <span
              className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500"
              title="Dieser Block ist typischerweise nur im On-Prem-Szenario relevant — befüllbar ist er trotzdem."
            >
              meist nur On-Prem
            </span>
          )}
          {warnings.length > 0 && (
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                warnings.some((w) => w.level === 'warn')
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-sky-100 text-sky-800'
              }`}
              title={warnings.map((w) => w.message).join('\n')}
            >
              {warnings.length} Hinweis{warnings.length > 1 ? 'e' : ''}
            </span>
          )}
        </div>

        <span className={`w-32 text-right text-sm tabular ${empty ? 'text-slate-300' : 'text-slate-700'}`}>
          {block.enabled ? eur(onpremTotal) : '—'}
        </span>
        <span className={`w-32 text-right text-sm tabular ${empty ? 'text-slate-300' : 'text-slate-700'}`}>
          {block.enabled ? eur(cloudTotal) : '—'}
        </span>
        <span
          className={`w-32 text-right text-sm font-medium tabular ${
            !block.enabled || delta === 0
              ? 'text-slate-300'
              : delta > 0
                ? 'text-emerald-700'
                : 'text-red-700'
          }`}
          title={delta > 0 ? 'Cloud ist in diesem Block günstiger' : delta < 0 ? 'On-Prem ist in diesem Block günstiger' : ''}
        >
          {block.enabled && delta !== 0 ? eurSigned(delta) : '—'}
        </span>

        <div className="flex w-20 justify-end gap-1 text-xs text-slate-400">
          <button type="button" onClick={() => setRenaming(true)} className="hover:text-slate-700" title="Umbenennen">
            ✎
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm(`Block „${block.name}" mit allen Eingaben entfernen?`)) removeBlock(blockId)
            }}
            className="hover:text-red-600"
            title="Block entfernen"
          >
            ✕
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-150 bg-slate-50/50 px-4 py-3">
          {warnings.length > 0 && (
            <ul className="mb-3 space-y-1">
              {warnings.map((w, i) => (
                <li
                  key={i}
                  className={`rounded px-2.5 py-1.5 text-xs ${
                    w.level === 'warn' ? 'bg-amber-50 text-amber-900' : 'bg-sky-50 text-sky-900'
                  }`}
                >
                  {w.message}
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-3 lg:grid-cols-2">
            <ScenarioEntry scenario="onprem" blockId={blockId} />
            <ScenarioEntry scenario="cloud" blockId={blockId} />
          </div>
        </div>
      )}
    </div>
  )
}

function sum(values: number[] | undefined): number {
  return (values ?? []).reduce((a, b) => a + b, 0)
}
