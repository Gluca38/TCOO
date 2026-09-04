import { useEffect, useId, useState } from 'react'
import { num, parseAmount, parsePercent } from '../../format'

const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm tabular ' +
  'focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-100 ' +
  'disabled:bg-slate-100 disabled:text-slate-400'

const labelClass = 'block text-xs font-medium text-slate-600'

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className={labelClass}>
        {label}
        {hint && <span className="ml-1 font-normal text-slate-400">{hint}</span>}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

/**
 * Betragsfeld.
 *
 * Nimmt „1.500,50", „1500,5" und „1500.5" entgegen und formatiert beim
 * Verlassen des Feldes. Während der Eingabe wird nichts umgeschrieben —
 * sonst springt der Cursor.
 */
export function AmountInput({
  value,
  onChange,
  disabled,
  suffix = '€',
}: {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
  suffix?: string
}) {
  const [text, setText] = useState(() => (value === 0 ? '' : num(value)))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setText(value === 0 ? '' : num(value))
  }, [value, focused])

  return (
    <div className="relative">
      <input
        className={`${inputClass} pr-7 text-right`}
        inputMode="decimal"
        value={text}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onChange={(e) => {
          setText(e.target.value)
          const parsed = parseAmount(e.target.value)
          if (parsed !== null) onChange(parsed)
        }}
        onBlur={() => {
          setFocused(false)
          const parsed = parseAmount(text)
          // Unlesbare Eingabe verwirft das Feld und zeigt wieder den Bestand.
          setText(parsed === null || parsed === 0 ? (value === 0 ? '' : num(value)) : num(parsed))
        }}
      />
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
        {suffix}
      </span>
    </div>
  )
}

/** Prozentfeld. Ein leeres Feld bedeutet „globalem Wert folgen". */
export function PercentInput({
  value,
  onChange,
  placeholder,
  allowEmpty = false,
}: {
  value: number | null
  onChange: (value: number | null) => void
  placeholder?: string
  allowEmpty?: boolean
}) {
  const [text, setText] = useState(() => (value === null ? '' : num(value * 100)))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setText(value === null ? '' : num(value * 100))
  }, [value, focused])

  return (
    <div className="relative">
      <input
        className={`${inputClass} pr-7 text-right`}
        inputMode="decimal"
        value={text}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onChange={(e) => {
          setText(e.target.value)
          if (e.target.value.trim() === '') {
            if (allowEmpty) onChange(null)
            return
          }
          const parsed = parsePercent(e.target.value)
          if (parsed !== null) onChange(parsed)
        }}
        onBlur={() => {
          setFocused(false)
          if (text.trim() === '' && allowEmpty) {
            onChange(null)
            return
          }
          const parsed = parsePercent(text)
          setText(parsed === null ? (value === null ? '' : num(value * 100)) : num(parsed * 100))
        }}
      />
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
        %
      </span>
    </div>
  )
}

/**
 * Jahresauswahl mit Kalenderjahren.
 *
 * Intern wird mit Jahresindizes 1..H gerechnet; angezeigt werden echte
 * Kalenderjahre, damit bei der Eingabe keine Kopfrechnung nötig ist.
 */
export function YearSelect({
  value,
  onChange,
  startYear,
  horizonYears,
  emptyLabel,
  min = 1,
}: {
  value: number | null
  onChange: (value: number | null) => void
  startYear: number
  horizonYears: number
  emptyLabel?: string
  min?: number
}) {
  const options = Array.from({ length: horizonYears }, (_, i) => i + 1).filter((t) => t >= min)
  return (
    <select
      className={inputClass}
      value={value === null ? '' : String(value)}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
    >
      {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
      {options.map((t) => (
        <option key={t} value={t}>
          {startYear + t - 1}
        </option>
      ))}
    </select>
  )
}

export function IntegerInput({
  value,
  onChange,
  min = 1,
  max = 99,
  placeholder,
  allowEmpty = false,
  suffix,
}: {
  value: number | null
  onChange: (value: number | null) => void
  min?: number
  max?: number
  placeholder?: string
  allowEmpty?: boolean
  suffix?: string
}) {
  return (
    <div className="relative">
      <input
        type="number"
        className={`${inputClass} ${suffix ? 'pr-12' : ''} text-right`}
        value={value === null ? '' : value}
        min={min}
        max={max}
        placeholder={placeholder}
        onChange={(e) => {
          if (e.target.value === '') {
            if (allowEmpty) onChange(null)
            return
          }
          const parsed = Number(e.target.value)
          if (Number.isFinite(parsed)) onChange(Math.max(min, Math.min(max, Math.round(parsed))))
        }}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
          {suffix}
        </span>
      )}
    </div>
  )
}

export function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <input
      className={inputClass}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: React.ReactNode
}) {
  const id = useId()
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-accent-600 focus:ring-accent-400"
      />
      <label htmlFor={id} className="cursor-pointer text-sm font-medium text-slate-700">
        {label}
      </label>
    </div>
  )
}

export { inputClass }
