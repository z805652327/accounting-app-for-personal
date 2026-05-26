export interface IDatabase {
  init(): Promise<void>
  close(): Promise<void>

  // Generic queries
  execute(sql: string, params?: any[]): Promise<void>
  query<T>(sql: string, params?: any[]): Promise<T[]>
  queryOne<T>(sql: string, params?: any[]): Promise<T | null>
  insert(sql: string, params?: any[]): Promise<number> // returns lastInsertRowid
  transaction<T>(fn: () => Promise<T>): Promise<T>
}
