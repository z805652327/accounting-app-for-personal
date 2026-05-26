import type { IDatabase } from '@/database'
import { TransactionRepository } from '@/repositories/transaction-repo'
import { ReportGenerator } from './report-generator'
import { IndicatorService } from './indicator.service'

export interface ExportOptions {
  format: 'csv' | 'xlsx'
  startDate?: string
  endDate?: string
  subjectId?: number
  accountId?: number
  txType?: string
}

/**
 * Export service supporting CSV (up to 10k rows) and Excel (up to 65k rows).
 * Excel uses the Office Open XML format built without external dependencies.
 */
export class ExcelExportService {
  constructor(private db: IDatabase) {}

  /** Export transactions as CSV (UTF-8 BOM) */
  async exportTransactionsCSV(opts: ExportOptions): Promise<string> {
    const repo = new TransactionRepository(this.db)
    const rows = await repo.findDetails({
      startDate: opts.startDate, endDate: opts.endDate,
      subjectId: opts.subjectId, accountId: opts.accountId,
      txType: opts.txType, limit: 10000,
    })

    const txTypeNames: Record<string, string> = {
      income:'收入', expense:'支出', transfer:'转账', salary:'发工资',
      investment_buy:'投资买入', investment_sell:'投资卖出', valuation_adjust:'估值调整',
      loan_receive:'借款', loan_repay:'还款', prepaid_amortize:'预付摊提',
      asset_purchase:'购置固定资产', asset_dispose:'资产处置',
      credit_card_spend:'信用卡消费', credit_card_repay:'信用卡还款',
    }
    const headers = ['日期', '交易方式', '二级科目', '金额', '账户', '对方账户', '备注']
    const csvRows = [headers.join(',')]

    for (const tx of rows) {
      csvRows.push([
        tx.txDate,
        this.escapeCsv(txTypeNames[tx.txType] || tx.txType),
        this.escapeCsv(tx.subjectName),
        tx.amount.toFixed(2),
        this.escapeCsv(tx.accountName || ''),
        this.escapeCsv(tx.toAccountName || ''),
        this.escapeCsv(tx.note || ''),
      ].join(','))
    }

    // UTF-8 BOM for Excel compatibility
    return '﻿' + csvRows.join('\n')
  }

  /** Export transactions as a minimal XLSX (inline XML) */
  async exportTransactionsXLSX(opts: ExportOptions): Promise<Uint8Array> {
    const repo = new TransactionRepository(this.db)
    const rows = await repo.findDetails({
      startDate: opts.startDate, endDate: opts.endDate,
      subjectId: opts.subjectId, accountId: opts.accountId,
      txType: opts.txType, limit: 65000,
    })

    const headers = ['日期', '类型', '科目', '金额', '账户', '备注']
    return this.buildXlsx('交易明细', headers, rows.map(tx => [
      tx.txDate, tx.txType, tx.subjectName,
      tx.amount, tx.accountName || '', tx.note || '',
    ]))
  }

  /** Export income statement as XLSX */
  async exportIncomeStatement(year: number, month: number): Promise<Uint8Array> {
    const gen = new ReportGenerator(this.db)
    const stmt = await gen.generateIncomeStatement(year, month)

    const rows: any[][] = [
      ['利润表', '', ''],
      ['期间', stmt.period, ''],
      ['', '', ''],
      ['收入项目', '金额', ''],
      ...stmt.incomes.map(i => [i.name, i.amount, '']),
      ['收入合计', stmt.totalIncome, ''],
      ['', '', ''],
      ['支出项目', '金额', '类别'],
      ...stmt.expenses.map(e => [e.name, e.amount, e.category]),
      ['支出合计', stmt.totalExpense, ''],
      ['', '', ''],
      ['本月结余', stmt.netSurplus, ''],
      ['固定支出', stmt.fixedExpense, ''],
      ['弹性支出', stmt.variableExpense, ''],
    ]

    return this.buildXlsx('利润表', ['A', 'B', 'C'], rows)
  }

  /** Export balance sheet as XLSX */
  async exportBalanceSheet(year: number, month: number): Promise<Uint8Array> {
    const gen = new ReportGenerator(this.db)
    const bs = await gen.generateBalanceSheet(year, month)

    const rows: any[][] = [
      ['资产负债表', '', ''],
      ['日期', bs.date, ''],
      ['', '', ''],
      ['资产', '金额', ''],
      ...bs.assets.map(a => [a.name, a.amount, '']),
      ['资产合计', bs.totalAssets, ''],
      ['', '', ''],
      ['负债', '金额', ''],
      ...bs.liabilities.map(l => [l.name, l.amount, '']),
      ['负债合计', bs.totalLiabilities, ''],
      ['', '', ''],
      ['净资产', '金额', ''],
      ...bs.equity.map(e => [e.name, e.amount, '']),
      ['净资产合计', bs.totalEquity, ''],
      ['', '', ''],
      ['平衡校验', bs.isBalanced ? '✓ 平衡' : '✗ 不平', ''],
    ]

    return this.buildXlsx('资产负债表', ['A', 'B', 'C'], rows)
  }

  /** Export indicators as XLSX */
  async exportIndicators(year: number, month: number): Promise<Uint8Array> {
    const svc = new IndicatorService(this.db)
    const results = await svc.evaluate(year, month)

    const rows: any[][] = [
      ['指标名称', '结果值', '公式', '期间'],
      ...results.map(r => [
        r.indicator.name,
        r.value.toFixed(r.indicator.decimalPlaces),
        r.indicator.formula,
        `${year}-${String(month).padStart(2, '0')}`,
      ]),
    ]

    return this.buildXlsx('财务指标', ['指标名称', '结果值', '公式', '期间'], rows)
  }

  // --- Minimal XLSX builder (XML Spreadsheet 2003 format) ---
  private buildXlsx(sheetName: string, headers: string[], rows: any[][]): Uint8Array {
    let tableRows = ''

    // Header row
    tableRows += '<Row>' + headers.map(h =>
      `<Cell><Data ss:Type="String">${this.xmlEscape(h)}</Data></Cell>`
    ).join('') + '</Row>'

    // Data rows
    for (const row of rows) {
      tableRows += '<Row>'
      for (const cell of row) {
        const val = cell === null || cell === undefined ? '' : String(cell)
        tableRows += `<Cell><Data ss:Type="String">${this.xmlEscape(val)}</Data></Cell>`
      }
      tableRows += '</Row>'
    }

    const fullXml = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="${this.xmlEscape(sheetName)}">
<Table>
${tableRows}
</Table>
</Worksheet>
</Workbook>`

    return new TextEncoder().encode(fullXml)
  }

  private xmlEscape(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  private escapeCsv(s: string): string {
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }
}
