import type { IDatabase } from './index'

interface SubjectSeed {
  code: string
  name: string
  level: 1 | 2 | 3
  parentCode: string | null
  subjectType: 'asset' | 'liability' | 'equity' | 'income' | 'expense'
  expenseType?: 'fixed' | 'variable'
  cashFlowCategory?: 'operating' | 'investing' | 'financing'
  sortOrder: number
}

export const PRESET_SUBJECTS: SubjectSeed[] = [
  // === 资产类 1xxx ===
  { code: '10100', name: '现金', level: 1, parentCode: null, subjectType: 'asset', sortOrder: 1 },
  { code: '10200', name: '银行存款', level: 1, parentCode: null, subjectType: 'asset', sortOrder: 2 },
  { code: '10201', name: '活期账户', level: 2, parentCode: '10200', subjectType: 'asset', sortOrder: 3 },
  { code: '10202', name: '定期存款', level: 2, parentCode: '10200', subjectType: 'asset', sortOrder: 4 },
  { code: '10300', name: '货币基金', level: 1, parentCode: null, subjectType: 'asset', sortOrder: 5 },
  { code: '11100', name: '应收款', level: 1, parentCode: null, subjectType: 'asset', sortOrder: 6 },
  { code: '12100', name: '投资资产', level: 1, parentCode: null, subjectType: 'asset', sortOrder: 7 },
  { code: '12101', name: '股票', level: 2, parentCode: '12100', subjectType: 'asset', sortOrder: 8 },
  { code: '12102', name: '基金', level: 2, parentCode: '12100', subjectType: 'asset', sortOrder: 9 },
  { code: '12103', name: '债券/定期理财', level: 2, parentCode: '12100', subjectType: 'asset', sortOrder: 10 },
  { code: '13100', name: '固定资产', level: 1, parentCode: null, subjectType: 'asset', sortOrder: 11 },
  { code: '13101', name: '房产', level: 2, parentCode: '13100', subjectType: 'asset', sortOrder: 12 },
  { code: '13102', name: '车辆', level: 2, parentCode: '13100', subjectType: 'asset', sortOrder: 13 },
  { code: '13103', name: '电子设备', level: 2, parentCode: '13100', subjectType: 'asset', sortOrder: 14 },
  { code: '13104', name: '其他固定资产', level: 2, parentCode: '13100', subjectType: 'asset', sortOrder: 15 },
  { code: '14100', name: '待摊费用', level: 1, parentCode: null, subjectType: 'asset', sortOrder: 16 },
  { code: '14200', name: '押金/保证金', level: 1, parentCode: null, subjectType: 'asset', sortOrder: 17 },
  { code: '15100', name: '累计折旧', level: 1, parentCode: null, subjectType: 'asset', sortOrder: 18 },
  { code: '15101', name: '房屋累计折旧', level: 2, parentCode: '15100', subjectType: 'asset', sortOrder: 19 },
  { code: '15102', name: '车辆累计折旧', level: 2, parentCode: '15100', subjectType: 'asset', sortOrder: 20 },
  { code: '15103', name: '设备累计折旧', level: 2, parentCode: '15100', subjectType: 'asset', sortOrder: 21 },
  { code: '15104', name: '其他累计折旧', level: 2, parentCode: '15100', subjectType: 'asset', sortOrder: 22 },

  // === 负债类 2xxx ===
  { code: '20100', name: '信用卡欠款', level: 1, parentCode: null, subjectType: 'liability', sortOrder: 23 },
  { code: '20200', name: '应付款', level: 1, parentCode: null, subjectType: 'liability', sortOrder: 24 },
  { code: '21100', name: '短期借款', level: 1, parentCode: null, subjectType: 'liability', sortOrder: 25 },
  { code: '22100', name: '长期借款', level: 1, parentCode: null, subjectType: 'liability', sortOrder: 26 },
  { code: '22101', name: '房贷', level: 2, parentCode: '22100', subjectType: 'liability', sortOrder: 27 },
  { code: '22102', name: '车贷', level: 2, parentCode: '22100', subjectType: 'liability', sortOrder: 28 },

  // === 净资产类 3xxx ===
  { code: '30100', name: '期初净资产', level: 1, parentCode: null, subjectType: 'equity', sortOrder: 29 },
  { code: '30200', name: '本期结余', level: 1, parentCode: null, subjectType: 'equity', sortOrder: 30 },
  { code: '30300', name: '公允价值变动储备', level: 1, parentCode: null, subjectType: 'equity', sortOrder: 31 },

  // === 收入类 4xxx ===
  { code: '40100', name: '劳动收入', level: 1, parentCode: null, subjectType: 'income', cashFlowCategory: 'operating', sortOrder: 32 },
  { code: '40101', name: '工资薪金', level: 2, parentCode: '40100', subjectType: 'income', cashFlowCategory: 'operating', sortOrder: 33 },
  { code: '40102', name: '奖金/津贴', level: 2, parentCode: '40100', subjectType: 'income', cashFlowCategory: 'operating', sortOrder: 34 },
  { code: '40103', name: '兼职/副业', level: 2, parentCode: '40100', subjectType: 'income', cashFlowCategory: 'operating', sortOrder: 35 },
  { code: '40200', name: '投资收入', level: 1, parentCode: null, subjectType: 'income', sortOrder: 36 },
  { code: '40201', name: '已实现投资收益', level: 2, parentCode: '40200', subjectType: 'income', cashFlowCategory: 'investing', sortOrder: 37 },
  { code: '40202', name: '利息收入', level: 2, parentCode: '40200', subjectType: 'income', cashFlowCategory: 'operating', sortOrder: 38 },
  { code: '40203', name: '分红收入', level: 2, parentCode: '40200', subjectType: 'income', cashFlowCategory: 'investing', sortOrder: 39 },
  { code: '40300', name: '其他收入', level: 1, parentCode: null, subjectType: 'income', sortOrder: 40 },
  { code: '40301', name: '红包/礼金', level: 2, parentCode: '40300', subjectType: 'income', cashFlowCategory: 'operating', sortOrder: 41 },
  { code: '40302', name: '二手售卖', level: 2, parentCode: '40300', subjectType: 'income', cashFlowCategory: 'investing', sortOrder: 42 },
  { code: '40303', name: '租赁收入', level: 2, parentCode: '40300', subjectType: 'income', cashFlowCategory: 'operating', sortOrder: 43 },
  { code: '40399', name: '其他', level: 2, parentCode: '40300', subjectType: 'income', cashFlowCategory: 'operating', sortOrder: 44 },

  // === 费用类 5xxx ===
  { code: '50100', name: '固定居住支出', level: 1, parentCode: null, subjectType: 'expense', expenseType: 'fixed', cashFlowCategory: 'operating', sortOrder: 45 },
  { code: '50101', name: '房租', level: 2, parentCode: '50100', subjectType: 'expense', expenseType: 'fixed', cashFlowCategory: 'operating', sortOrder: 46 },
  { code: '50102', name: '维修/物业', level: 2, parentCode: '50100', subjectType: 'expense', expenseType: 'fixed', cashFlowCategory: 'operating', sortOrder: 47 },
  { code: '50103', name: '装修摊销', level: 2, parentCode: '50100', subjectType: 'expense', expenseType: 'fixed', cashFlowCategory: 'operating', sortOrder: 48 },
  { code: '50200', name: '生活基础支出', level: 1, parentCode: null, subjectType: 'expense', expenseType: 'fixed', cashFlowCategory: 'operating', sortOrder: 49 },
  { code: '50201', name: '餐饮', level: 2, parentCode: '50200', subjectType: 'expense', expenseType: 'fixed', cashFlowCategory: 'operating', sortOrder: 50 },
  { code: '50202', name: '交通出行', level: 2, parentCode: '50200', subjectType: 'expense', expenseType: 'fixed', cashFlowCategory: 'operating', sortOrder: 51 },
  { code: '50203', name: '水电煤网', level: 2, parentCode: '50200', subjectType: 'expense', expenseType: 'fixed', cashFlowCategory: 'operating', sortOrder: 52 },
  { code: '50204', name: '通讯费', level: 2, parentCode: '50200', subjectType: 'expense', expenseType: 'fixed', cashFlowCategory: 'operating', sortOrder: 53 },
  { code: '50205', name: '日用品/居家消耗', level: 2, parentCode: '50200', subjectType: 'expense', expenseType: 'fixed', cashFlowCategory: 'operating', sortOrder: 54 },
  { code: '50206', name: '车辆使用费', level: 2, parentCode: '50200', subjectType: 'expense', expenseType: 'fixed', cashFlowCategory: 'operating', sortOrder: 55 },
  { code: '50300', name: '消费购物支出', level: 1, parentCode: null, subjectType: 'expense', expenseType: 'variable', cashFlowCategory: 'operating', sortOrder: 56 },
  { code: '50301', name: '日常购物', level: 2, parentCode: '50300', subjectType: 'expense', expenseType: 'variable', cashFlowCategory: 'operating', sortOrder: 57 },
  { code: '50302', name: '服饰美容', level: 2, parentCode: '50300', subjectType: 'expense', expenseType: 'variable', cashFlowCategory: 'operating', sortOrder: 58 },
  { code: '50303', name: '数码产品', level: 2, parentCode: '50300', subjectType: 'expense', expenseType: 'variable', cashFlowCategory: 'operating', sortOrder: 59 },
  { code: '50304', name: '家居用品', level: 2, parentCode: '50300', subjectType: 'expense', expenseType: 'variable', cashFlowCategory: 'operating', sortOrder: 60 },
  { code: '50400', name: '娱乐社交支出', level: 1, parentCode: null, subjectType: 'expense', expenseType: 'variable', cashFlowCategory: 'operating', sortOrder: 61 },
  { code: '50401', name: '娱乐休闲', level: 2, parentCode: '50400', subjectType: 'expense', expenseType: 'variable', cashFlowCategory: 'operating', sortOrder: 62 },
  { code: '50402', name: '社交聚会', level: 2, parentCode: '50400', subjectType: 'expense', expenseType: 'variable', cashFlowCategory: 'operating', sortOrder: 63 },
  { code: '50403', name: '人情往来', level: 2, parentCode: '50400', subjectType: 'expense', expenseType: 'variable', cashFlowCategory: 'operating', sortOrder: 64 },
  { code: '50404', name: '旅游交通', level: 2, parentCode: '50400', subjectType: 'expense', expenseType: 'variable', cashFlowCategory: 'operating', sortOrder: 65 },
  { code: '50405', name: '旅游餐饮', level: 2, parentCode: '50400', subjectType: 'expense', expenseType: 'variable', cashFlowCategory: 'operating', sortOrder: 66 },
  { code: '50406', name: '旅游住宿', level: 2, parentCode: '50400', subjectType: 'expense', expenseType: 'variable', cashFlowCategory: 'operating', sortOrder: 67 },
  { code: '50407', name: '旅游门票/活动', level: 2, parentCode: '50400', subjectType: 'expense', expenseType: 'variable', cashFlowCategory: 'operating', sortOrder: 68 },
  { code: '50408', name: '其他旅游支出', level: 2, parentCode: '50400', subjectType: 'expense', expenseType: 'variable', cashFlowCategory: 'operating', sortOrder: 69 },
  { code: '50500', name: '健康保障支出', level: 1, parentCode: null, subjectType: 'expense', expenseType: 'variable', cashFlowCategory: 'operating', sortOrder: 70 },
  { code: '50501', name: '医疗医药', level: 2, parentCode: '50500', subjectType: 'expense', expenseType: 'variable', cashFlowCategory: 'operating', sortOrder: 71 },
  { code: '50502', name: '保险费用', level: 2, parentCode: '50500', subjectType: 'expense', expenseType: 'fixed', cashFlowCategory: 'operating', sortOrder: 72 },
  { code: '50503', name: '健身运动', level: 2, parentCode: '50500', subjectType: 'expense', expenseType: 'variable', cashFlowCategory: 'operating', sortOrder: 73 },
  { code: '50600', name: '个人发展支出', level: 1, parentCode: null, subjectType: 'expense', expenseType: 'variable', cashFlowCategory: 'operating', sortOrder: 74 },
  { code: '50601', name: '教育学习', level: 2, parentCode: '50600', subjectType: 'expense', expenseType: 'variable', cashFlowCategory: 'operating', sortOrder: 75 },
  { code: '50602', name: '书籍报刊', level: 2, parentCode: '50600', subjectType: 'expense', expenseType: 'variable', cashFlowCategory: 'operating', sortOrder: 76 },
  { code: '50603', name: '技能培训', level: 2, parentCode: '50600', subjectType: 'expense', expenseType: 'variable', cashFlowCategory: 'operating', sortOrder: 77 },
  { code: '50604', name: '赡养支出', level: 2, parentCode: '50600', subjectType: 'expense', expenseType: 'variable', cashFlowCategory: 'operating', sortOrder: 78 },
  { code: '50700', name: '折旧与摊销', level: 1, parentCode: null, subjectType: 'expense', expenseType: 'fixed', sortOrder: 79 },
  { code: '50701', name: '资产折旧', level: 2, parentCode: '50700', subjectType: 'expense', expenseType: 'fixed', sortOrder: 80 },
  { code: '50702', name: '费用摊销', level: 2, parentCode: '50700', subjectType: 'expense', expenseType: 'fixed', sortOrder: 81 },
  { code: '50703', name: '资产处置损益', level: 2, parentCode: '50700', subjectType: 'expense', expenseType: 'fixed', cashFlowCategory: 'investing', sortOrder: 82 },
  { code: '50800', name: '金融社保支出', level: 1, parentCode: null, subjectType: 'expense', expenseType: 'fixed', cashFlowCategory: 'operating', sortOrder: 83 },
  { code: '50801', name: '利息支出', level: 2, parentCode: '50800', subjectType: 'expense', expenseType: 'fixed', cashFlowCategory: 'operating', sortOrder: 84 },
  { code: '50802', name: '金融服务费', level: 2, parentCode: '50800', subjectType: 'expense', expenseType: 'fixed', cashFlowCategory: 'operating', sortOrder: 85 },
  { code: '50803', name: '个人税费', level: 2, parentCode: '50800', subjectType: 'expense', expenseType: 'fixed', cashFlowCategory: 'operating', sortOrder: 86 },
  { code: '50804', name: '社保及公积金', level: 2, parentCode: '50800', subjectType: 'expense', expenseType: 'fixed', cashFlowCategory: 'operating', sortOrder: 87 },
  { code: '50900', name: '家庭育儿支出', level: 1, parentCode: null, subjectType: 'expense', expenseType: 'variable', cashFlowCategory: 'operating', sortOrder: 88 },
  { code: '50901', name: '子女教育', level: 2, parentCode: '50900', subjectType: 'expense', expenseType: 'fixed', cashFlowCategory: 'operating', sortOrder: 89 },
  { code: '50902', name: '生活用品', level: 2, parentCode: '50900', subjectType: 'expense', expenseType: 'variable', cashFlowCategory: 'operating', sortOrder: 90 },
  { code: '50903', name: '医疗保健', level: 2, parentCode: '50900', subjectType: 'expense', expenseType: 'variable', cashFlowCategory: 'operating', sortOrder: 91 },
  { code: '50904', name: '娱乐活动', level: 2, parentCode: '50900', subjectType: 'expense', expenseType: 'variable', cashFlowCategory: 'operating', sortOrder: 92 },
  { code: '50999', name: '其他育儿支出', level: 2, parentCode: '50900', subjectType: 'expense', expenseType: 'variable', cashFlowCategory: 'operating', sortOrder: 93 },
  { code: '59900', name: '其他支出', level: 1, parentCode: null, subjectType: 'expense', expenseType: 'variable', cashFlowCategory: 'operating', sortOrder: 94 },
  { code: '59901', name: '其他', level: 2, parentCode: '59900', subjectType: 'expense', expenseType: 'variable', cashFlowCategory: 'operating', sortOrder: 95 },
]

export async function seedDatabase(db: IDatabase): Promise<void> {
  const count = await db.queryOne<{cnt: number}>('SELECT COUNT(*) as cnt FROM accounting_subjects')
  if (count && count.cnt > 0) return // already seeded

  let prevId = 0
  const codeToId = new Map<string, number>()

  for (const s of PRESET_SUBJECTS) {
    const id = await db.insert(
      `INSERT INTO accounting_subjects (code, name, level, parent_id, subject_type, expense_type, cash_flow_category, is_system, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [s.code, s.name, s.level, s.parentCode ? codeToId.get(s.parentCode) ?? null : null,
       s.subjectType, s.expenseType ?? null, s.cashFlowCategory ?? null, s.sortOrder]
    )
    codeToId.set(s.code, id)
    prevId = id
  }

  await seedIndicators(db)
}

/** Pre-seed built-in financial indicators (Section 5 of spec) */
export async function seedIndicators(db: IDatabase): Promise<void> {
  const count = await db.queryOne<{cnt: number}>('SELECT COUNT(*) as cnt FROM user_indicators')
  if (count && count.cnt > 0) return

  const indicators = [
    { name: '资产负债率',       formula: 'SUM(2) / SUM(1)',              decimals: 1 },
    { name: '流动比率',         formula: '(SUM(101) + SUM(102) + SUM(103) + SUM(111)) / (SUM(201) + SUM(202) + SUM(211))', decimals: 2 },
    { name: '月结余率',         formula: '(TOTAL_INCOME - TOTAL_EXPENSE) / TOTAL_INCOME', decimals: 1 },
    { name: '恩格尔系数',       formula: 'SUM(50201) / TOTAL_EXPENSE',   decimals: 1 },
    { name: '固定支出占比',     formula: '(SUM(501) + SUM(502) + SUM(507) + SUM(508)) / TOTAL_EXPENSE', decimals: 1 },
    { name: '弹性支出占比',     formula: '(SUM(503) + SUM(504) + SUM(506) + SUM(599)) / TOTAL_EXPENSE', decimals: 1 },
    { name: '投资回报率',       formula: 'SUM(40201) / SUM(121)',        decimals: 2 },
    { name: '财务自由度',       formula: 'SUM(402) / TOTAL_EXPENSE',     decimals: 2 },
    { name: '净资产增长率',     formula: 'NET_ASSET / (NET_ASSET + 1)',  decimals: 2 },
    { name: '总资产增长率',     formula: 'SUM(1) / (SUM(1) + 1)',        decimals: 2 },
  ]

  for (const ind of indicators) {
    await db.insert(
      `INSERT INTO user_indicators (name, formula, decimal_places, is_active)
       VALUES (?, ?, ?, 1)`,
      [ind.name, ind.formula, ind.decimals]
    )
  }
}
