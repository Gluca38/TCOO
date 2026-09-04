import { useMemo } from 'react'
import { useStore } from '../state/store'
import { compare, type ComparisonResult } from '../domain/compare'
import { validateProject, type ValidationWarning } from '../domain/validate'

/**
 * Zentrale Ableitung: alle Ergebnisse folgen aus dem Projekt.
 *
 * Es gibt keinen Ergebniszustand im Store — jede Zahl wird bei Bedarf aus den
 * Eingaben neu berechnet. Damit kann Angezeigtes nie von den Eingaben
 * abweichen.
 */
export function useComparison(): ComparisonResult {
  const project = useStore((s) => s.project)
  return useMemo(() => compare(project, project.settings.view), [project])
}

export function useWarnings(): ValidationWarning[] {
  const project = useStore((s) => s.project)
  return useMemo(() => validateProject(project), [project])
}
