import type { Project } from '../domain/types'
import { parseProject } from '../domain/schema'

/**
 * Naht zur Speicherung.
 *
 * Version 1 kennt genau eine Implementierung: den Browser-Speicher. Kommen
 * später Login und serverseitige Ablage hinzu, wird hier eine
 * `HttpProjectRepository` ergänzt — Berechnungslogik und Oberfläche bleiben
 * unverändert, weil beide nur dieses Interface kennen.
 */
export interface ProjectSummary {
  id: string
  title: string
  updatedAt: string
}

export interface ProjectRepository {
  load(id?: string): Promise<Project | null>
  save(project: Project, id?: string): Promise<void>
  list(): Promise<ProjectSummary[]>
  clear(id?: string): Promise<void>
}

const STORAGE_KEY = 'tco-rechner.project'
const DEFAULT_ID = 'current'

export class LocalStorageProjectRepository implements ProjectRepository {
  private key(id: string): string {
    return `${STORAGE_KEY}.${id}`
  }

  async load(id: string = DEFAULT_ID): Promise<Project | null> {
    try {
      const raw = localStorage.getItem(this.key(id))
      if (!raw) return null
      const result = parseProject(JSON.parse(raw))
      // Ein beschädigter Speicherstand darf den Start nicht blockieren.
      return result.ok ? result.project : null
    } catch {
      return null
    }
  }

  async save(project: Project, id: string = DEFAULT_ID): Promise<void> {
    try {
      localStorage.setItem(this.key(id), JSON.stringify(project))
    } catch {
      // Speicher voll oder gesperrt (privates Fenster): die App bleibt nutzbar,
      // der Export übernimmt dann die Sicherung.
    }
  }

  async list(): Promise<ProjectSummary[]> {
    const project = await this.load()
    return project
      ? [{ id: DEFAULT_ID, title: project.meta.title, updatedAt: project.meta.updatedAt }]
      : []
  }

  async clear(id: string = DEFAULT_ID): Promise<void> {
    try {
      localStorage.removeItem(this.key(id))
    } catch {
      /* siehe save() */
    }
  }
}

export const repository: ProjectRepository = new LocalStorageProjectRepository()
