import type { IDatabase } from './index'
import { H5Database } from './sqlite-h5'
import { AppDatabase } from './sqlite-app'
import { ElectronDatabase } from './sqlite-electron'
import { CapacitorDatabase } from './sqlite-capacitor'
import { runMigrations } from './migrations'

let dbInstance: IDatabase | null = null

function detectPlatform(): 'electron' | 'capacitor' | 'app' | 'h5' {
  if (typeof window !== 'undefined' && (window as any).electronDB) return 'electron'
  // Detect Capacitor runtime (native bridge available)
  if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()) return 'capacitor'
  // @ts-ignore
  if (typeof plus !== 'undefined' && plus.sqlite) return 'app'
  return 'h5'
}

export async function getDatabase(): Promise<IDatabase> {
  if (dbInstance) return dbInstance

  const platform = detectPlatform()

  if (platform === 'electron') {
    dbInstance = new ElectronDatabase()
  } else if (platform === 'capacitor') {
    dbInstance = new CapacitorDatabase()
  } else if (platform === 'app') {
    dbInstance = new AppDatabase()
  } else {
    dbInstance = new H5Database()
  }

  await dbInstance.init()
  await runMigrations(dbInstance)
  return dbInstance
}

export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close()
    dbInstance = null
  }
}
