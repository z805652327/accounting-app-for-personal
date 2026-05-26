// Table creation SQL — all tables in one place for migration v1

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS accounting_subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code VARCHAR(8) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  level TINYINT NOT NULL CHECK(level IN (1,2,3)),
  parent_id INTEGER,
  subject_type VARCHAR(10) NOT NULL CHECK(subject_type IN ('asset','liability','equity','income','expense')),
  expense_type VARCHAR(8) CHECK(expense_type IN ('fixed','variable')),
  cash_flow_category VARCHAR(10) CHECK(cash_flow_category IN ('operating','investing','financing')),
  is_system INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (parent_id) REFERENCES accounting_subjects(id)
);

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  subject_code VARCHAR(8) NOT NULL UNIQUE,
  account_type VARCHAR(20) NOT NULL,
  subject_id INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CNY',
  bank_name TEXT,
  card_last_four TEXT,
  credit_limit REAL,
  maturity_date TEXT,
  notes TEXT,
  contract_no TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (subject_id) REFERENCES accounting_subjects(id)
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tx_type VARCHAR(20) NOT NULL,
  tx_date TEXT NOT NULL,
  amount REAL NOT NULL,
  subject_id INTEGER NOT NULL,
  l3_subject_id INTEGER,
  account_id INTEGER,
  to_account_id INTEGER,
  to_subject_id INTEGER,
  note TEXT,
  is_reconciled INTEGER NOT NULL DEFAULT 0,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (subject_id) REFERENCES accounting_subjects(id),
  FOREIGN KEY (account_id) REFERENCES accounts(id),
  FOREIGN KEY (to_account_id) REFERENCES accounts(id)
);
CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(tx_date);
CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_tx_subject ON transactions(subject_id);

CREATE TABLE IF NOT EXISTS journal_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL,
  account_id INTEGER,
  subject_id INTEGER NOT NULL,
  l3_subject_id INTEGER,
  direction TEXT NOT NULL CHECK(direction IN ('debit','credit')),
  amount REAL NOT NULL,
  entry_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (transaction_id) REFERENCES transactions(id),
  FOREIGN KEY (subject_id) REFERENCES accounting_subjects(id)
);
CREATE INDEX IF NOT EXISTS idx_je_transaction ON journal_entries(transaction_id);
CREATE INDEX IF NOT EXISTS idx_je_subject ON journal_entries(subject_id);
CREATE INDEX IF NOT EXISTS idx_je_date ON journal_entries(entry_date);

CREATE TABLE IF NOT EXISTS amortization_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL,
  l3_subject_id INTEGER NOT NULL,
  total_amount REAL NOT NULL,
  periods INTEGER NOT NULL,
  amount_per_period REAL NOT NULL,
  remaining_periods INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (transaction_id) REFERENCES transactions(id),
  FOREIGN KEY (l3_subject_id) REFERENCES accounting_subjects(id)
);

CREATE TABLE IF NOT EXISTS depreciation_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL UNIQUE,
  asset_name TEXT NOT NULL,
  original_value REAL NOT NULL,
  residual_value REAL NOT NULL,
  useful_months INTEGER NOT NULL,
  method TEXT NOT NULL DEFAULT 'straight_line',
  depreciation_subject_id INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (account_id) REFERENCES accounts(id),
  FOREIGN KEY (depreciation_subject_id) REFERENCES accounting_subjects(id)
);

CREATE TABLE IF NOT EXISTS investment_valuations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  l3_subject_id INTEGER NOT NULL,
  valuation_date TEXT NOT NULL,
  cost_amount REAL NOT NULL,
  market_value REAL NOT NULL,
  unrealized_pnl REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (l3_subject_id) REFERENCES accounts(id)
);

CREATE TABLE IF NOT EXISTS investment_lots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  l3_subject_id INTEGER NOT NULL,
  buy_date TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_cost REAL NOT NULL,
  remaining_qty REAL NOT NULL,
  remaining_cost REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (l3_subject_id) REFERENCES accounts(id)
);

CREATE TABLE IF NOT EXISTS budget_overall (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  monthly_cap REAL NOT NULL,
  active_month TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS budget_thresholds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (subject_id) REFERENCES accounting_subjects(id)
);

CREATE TABLE IF NOT EXISTS user_indicators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  formula TEXT NOT NULL,
  decimal_places INTEGER NOT NULL DEFAULT 2,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS saved_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  filters TEXT NOT NULL DEFAULT '{}',
  sort_field TEXT NOT NULL DEFAULT 'tx_date DESC',
  display_fields TEXT NOT NULL DEFAULT '[]',
  is_pinned INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS edit_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL,
  change_reason TEXT NOT NULL,
  changes TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (transaction_id) REFERENCES transactions(id)
);

CREATE TABLE IF NOT EXISTS pending_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_type TEXT NOT NULL CHECK(item_type IN ('depreciation','amortization','recurring')),
  reference_id INTEGER NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  due_date TEXT NOT NULL,
  is_done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#007AFF'
);

CREATE TABLE IF NOT EXISTS recurring_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  tx_type TEXT NOT NULL,
  amount REAL NOT NULL,
  subject_id INTEGER NOT NULL,
  l3_subject_id INTEGER,
  account_id INTEGER,
  to_account_id INTEGER,
  note TEXT,
  frequency TEXT NOT NULL CHECK(frequency IN ('monthly','quarterly','yearly')),
  start_date TEXT NOT NULL,
  end_date TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_generated TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (subject_id) REFERENCES accounting_subjects(id),
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE TABLE IF NOT EXISTS split_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL,
  subject_id INTEGER NOT NULL,
  l3_subject_id INTEGER,
  amount REAL NOT NULL,
  note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id),
  FOREIGN KEY (subject_id) REFERENCES accounting_subjects(id)
);

CREATE TABLE IF NOT EXISTS transaction_tags (
  transaction_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (transaction_id, tag_id),
  FOREIGN KEY (transaction_id) REFERENCES transactions(id),
  FOREIGN KEY (tag_id) REFERENCES tags(id)
);
`
