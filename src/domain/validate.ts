import type { Project, ScenarioKey } from './types'
import { computeScenario } from './calc'

export type WarningLevel = 'info' | 'warn'

export interface ValidationWarning {
  level: WarningLevel
  scenario?: ScenarioKey
  blockId?: string
  message: string
}

/**
 * Plausibilitätsprüfung.
 *
 * Bewusst nur Hinweise, keine Sperren: das Tool blockiert keine Eingabe,
 * macht aber sichtbar, was rechnerisch ins Leere läuft oder unplausibel wirkt.
 */
export function validateProject(project: Project): ValidationWarning[] {
  const out: ValidationWarning[] = []
  const H = project.settings.horizonYears

  for (const scenarioKey of ['onprem', 'cloud'] as ScenarioKey[]) {
    const scenario = project.scenarios[scenarioKey]

    for (const block of project.blocks) {
      if (!block.enabled) continue
      const entry = scenario.entries[block.id]
      if (!entry) continue

      const { capex, opex } = entry

      if (capex?.active) {
        if (capex.year > H) {
          out.push({
            level: 'warn',
            scenario: scenarioKey,
            blockId: block.id,
            message: `Anfalljahr der Investition liegt hinter dem Betrachtungszeitraum — der Betrag fließt nirgends ein.`,
          })
        }
        if (capex.usefulLifeYears < 1) {
          out.push({
            level: 'warn',
            scenario: scenarioKey,
            blockId: block.id,
            message: 'Nutzungsdauer muss mindestens 1 Jahr betragen.',
          })
        }
        if (capex.refreshEveryYears !== null && capex.refreshEveryYears < 1) {
          out.push({
            level: 'warn',
            scenario: scenarioKey,
            blockId: block.id,
            message: 'Wiederholungsintervall muss mindestens 1 Jahr betragen.',
          })
        }
        if (
          capex.refreshEveryYears !== null &&
          capex.refreshEveryYears < capex.usefulLifeYears
        ) {
          out.push({
            level: 'info',
            scenario: scenarioKey,
            blockId: block.id,
            message: `Reinvestition (alle ${capex.refreshEveryYears} Jahre) erfolgt vor Ablauf der Nutzungsdauer (${capex.usefulLifeYears} Jahre) — die Abschreibungen überlagern sich.`,
          })
        }
      }

      if (opex?.active) {
        if (opex.endYear !== null && opex.endYear < opex.startYear) {
          out.push({
            level: 'warn',
            scenario: scenarioKey,
            blockId: block.id,
            message: 'Endjahr liegt vor dem Startjahr — es fallen keine Kosten an.',
          })
        }
        if (opex.startYear > H) {
          out.push({
            level: 'warn',
            scenario: scenarioKey,
            blockId: block.id,
            message: 'Startjahr liegt hinter dem Betrachtungszeitraum — der Betrag fließt nirgends ein.',
          })
        }
      }

      if (block.hint === 'onprem-typical' && scenarioKey === 'cloud') {
        const hasValue =
          (capex?.active && capex.amount !== 0) || (opex?.active && opex.amount !== 0)
        if (hasValue) {
          out.push({
            level: 'info',
            scenario: scenarioKey,
            blockId: block.id,
            message: `„${block.name}" ist im Cloud-Szenario befüllt — bitte prüfen, ob das beabsichtigt ist.`,
          })
        }
      }
    }

    const total = computeScenario(project, scenarioKey, 'cashflow').total
    if (total === 0) {
      out.push({
        level: 'warn',
        scenario: scenarioKey,
        message: `Das Szenario „${scenario.name}" enthält keine Kosten — der Vergleich ist noch nicht aussagekräftig.`,
      })
    }
  }

  return out
}
