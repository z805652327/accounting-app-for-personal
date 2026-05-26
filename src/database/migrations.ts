import type { IDatabase } from './index'
import { SCHEMA_SQL } from './schema'
import { seedDatabase } from './seed'

const DB_VERSION = 1

export async function runMigrations(db: IDatabase): Promise<void> {
  // Create tables (v1)
  await db.execute(SCHEMA_SQL)

  // Seed preset subjects
  await seedDatabase(db)

  // Set version
  const row = await db.queryOne<{value: string}>(
    "SELECT value FROM app_settings WHERE key = 'db_version'"
  )
  const currentVersion = row ? parseInt(row.value, 10) : 0

  if (currentVersion < DB_VERSION) {
    // Future migrations go here:
    // if (currentVersion < 2) { await db.execute(...) }
    // if (currentVersion < 3) { await db.execute(...) }

    await db.execute(
      "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('db_version', ?)",
      [String(DB_VERSION)]
    )
  }
}
