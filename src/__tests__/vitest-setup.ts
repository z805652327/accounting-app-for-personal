// Mock browser APIs for Node.js test environment (H5Database uses them)
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>()
  ;(globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value) },
    removeItem: (key: string) => { store.delete(key) },
    clear: () => { store.clear() },
    get length() { return store.size },
    key: (index: number) => [...store.keys()][index] ?? null,
  }
}

if (typeof globalThis.window === 'undefined') {
  ;(globalThis as any).window = {
    ...globalThis,
    addEventListener: () => {},
    removeEventListener: () => {},
  }
}

// Suppress unhandled WASM rejections from sql.js in Node environment
// sql.js may fire async WASM-load rejections that don't chain through initSqlJs()
process.on('unhandledRejection', (reason: any) => {
  if (reason?.message?.includes('sql-wasm') || reason?.message?.includes('WASM')) {
    // Silently ignore — WASM fail is expected in some test paths
    return
  }
  console.error('Unhandled rejection:', reason)
})
