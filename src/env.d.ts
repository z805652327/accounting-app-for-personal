/// <reference types="vite/client" />
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface ElectronDB {
  execute(sql: string, params?: any[]): Promise<void>
  query<T>(sql: string, params?: any[]): Promise<T[]>
  queryOne<T>(sql: string, params?: any[]): Promise<T | null>
  insert(sql: string, params?: any[]): Promise<number>
  getDbPath(): Promise<string>
  selectDbPath(): Promise<string>
}

interface Window {
  electronDB?: ElectronDB
}
