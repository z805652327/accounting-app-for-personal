import type { IDatabase } from '@/database'
import { TransactionRepository } from '@/repositories/transaction-repo'
import { SubjectRepository } from '@/repositories/subject-repo'
import { AccountRepository } from '@/repositories/account-repo'
import { SubjectResolver } from './subject-resolver'
import { SplitTransactionService } from './split-transaction.service'
import type { Transaction, JournalEntry } from '@/types'

interface JournalInput {
  txType: Transaction['txType']
  txDate: string
  amount: number
  subjectId: number
  l3SubjectId?: number | null
  accountId?: number | null
  toAccountId?: number | null
  toSubjectId?: number | null
  note?: string | null
  splits?: { subjectId: number; l3SubjectId?: number; amount: number; note?: string }[]
  grossAmount?: number
  taxAmount?: number
  socialAmount?: number
  quantity?: number
  unitPrice?: number
  interestAmount?: number
  principalAmount?: number
  originalCost?: number
  marketValue?: number
  depreciationMonths?: number
  residualValue?: number
  depositAmount?: number
  prepaidAmount?: number
  disposalProceeds?: number
  disposalReason?: string
}

interface BuiltEntry {
  direction: 'debit' | 'credit'
  subjectId: number
  accountId: number | null | undefined
  l3SubjectId: number | null | undefined
  amount: number
}

// ---- Entry factory helpers (pure functions, no DB) ----

const dr = (subjectId: number, amount: number, accountId?: number | null, l3SubjectId?: number | null): BuiltEntry =>
  ({ direction: 'debit', subjectId, accountId: accountId ?? null, l3SubjectId: l3SubjectId ?? null, amount })

const cr = (subjectId: number, amount: number, accountId?: number | null, l3SubjectId?: number | null): BuiltEntry =>
  ({ direction: 'credit', subjectId, accountId: accountId ?? null, l3SubjectId: l3SubjectId ?? null, amount })

export class JournalEntryBuilder {
  private txRepo: TransactionRepository
  private subjectRepo: SubjectRepository
  private accountRepo: AccountRepository
  private resolve: SubjectResolver

  constructor(private db: IDatabase) {
    this.txRepo = new TransactionRepository(db)
    this.subjectRepo = new SubjectRepository(db)
    this.accountRepo = new AccountRepository(db)
    this.resolve = new SubjectResolver(db)
  }

  // ---- Public API ----

  async process(input: JournalInput): Promise<{ transactionId: number; entries: BuiltEntry[] }> {
    await this.resolve.preload()
    input.accountId = input.accountId ?? null
    input.l3SubjectId = input.l3SubjectId ?? null
    input.toAccountId = input.toAccountId ?? null
    input.toSubjectId = input.toSubjectId ?? null

    const entries = await this.buildEntries(input)
    const txId = await this.saveTransaction(input)
    await this.persistEntries(txId, entries, input.txDate)

    if (input.splits && input.splits.length > 0) {
      await new SplitTransactionService(this.db).saveSplits(txId, input.splits)
    }
    return { transactionId: txId, entries }
  }

  async update(txId: number, input: JournalInput, changeReason = 'user_edit'): Promise<void> {
    await this.resolve.preload()
    input.accountId = input.accountId ?? null
    input.l3SubjectId = input.l3SubjectId ?? null
    input.toAccountId = input.toAccountId ?? null
    input.toSubjectId = input.toSubjectId ?? null

    const old = await this.txRepo.findById(txId)
    if (!old) throw new Error('交易不存在')

    for (const je of await this.txRepo.getJournalEntries(txId)) {
      await this.db.execute('DELETE FROM journal_entries WHERE id = ?', [je.id])
    }

    const entries = await this.buildEntries(input)
    await this.persistEntries(txId, entries, input.txDate)

    await this.txRepo.update(txId, {
      txType: input.txType,
      txDate: input.txDate,
      amount: input.amount,
      subjectId: await this.resolveSubjectId(input.subjectId, input.accountId),
      l3SubjectId: input.l3SubjectId,
      accountId: input.accountId,
      toAccountId: input.toAccountId,
      toSubjectId: input.toSubjectId,
      note: input.note ?? null,
    })

    if (input.splits) {
      await new SplitTransactionService(this.db).saveSplits(txId, input.splits)
    }

    const changes: Record<string, {old: any, new: any}> = {}
    if (old.txDate !== input.txDate) changes.txDate = {old: old.txDate, new: input.txDate}
    if (old.amount !== input.amount) changes.amount = {old: old.amount, new: input.amount}
    if (old.subjectId !== input.subjectId) changes.subjectId = {old: old.subjectId, new: input.subjectId}
    if ((old.note ?? '') !== (input.note ?? '')) changes.note = {old: old.note, new: input.note}
    if (Object.keys(changes).length > 0) {
      await this.txRepo.recordEditHistory(txId, changeReason, changes)
    }
  }

  // ---- Persistence helpers ----

  private async saveTransaction(input: JournalInput): Promise<number> {
    return this.txRepo.create({
      txType: input.txType, txDate: input.txDate, amount: input.amount,
      subjectId: await this.resolveSubjectId(input.subjectId, input.accountId),
      l3SubjectId: input.l3SubjectId, accountId: input.accountId,
      toAccountId: input.toAccountId, toSubjectId: input.toSubjectId,
      note: input.note ?? null,
    })
  }

  private async persistEntries(txId: number, entries: BuiltEntry[], entryDate: string): Promise<void> {
    for (const e of entries) {
      await this.txRepo.insertJournalEntry({
        transactionId: txId, accountId: e.accountId, subjectId: e.subjectId,
        l3SubjectId: e.l3SubjectId, direction: e.direction, amount: e.amount,
        entryDate,
      })
    }
  }

  /** Fallback subjectId = 0 → resolve from account's L2 subject */
  private async resolveSubjectId(subjectId: number, accountId: number | null | undefined): Promise<number> {
    if (!subjectId && accountId) {
      try { return await this.getAccountSubjectId(accountId) }
      catch { /* ignore */ }
    }
    return subjectId
  }

  // ---- Routing ----

  private async buildEntries(input: JournalInput): Promise<BuiltEntry[]> {
    switch (input.txType) {
      case 'income':            return this.buildIncome(input)
      case 'expense':           return this.buildExpense(input)
      case 'transfer':          return this.buildTransfer(input)
      case 'salary':            return this.buildSalary(input)
      case 'investment_buy':    return this.buildInvestmentBuy(input)
      case 'investment_sell':   return this.buildInvestmentSell(input)
      case 'valuation_adjust':  return this.buildValuationAdjust(input)
      case 'loan_receive':      return this.buildLoanReceive(input)
      case 'loan_repay':        return this.buildLoanRepay(input)
      case 'prepaid_amortize':  return this.buildPrepaidAmortize(input)
      case 'asset_purchase':    return this.buildAssetPurchase(input)
      case 'asset_dispose':     return this.buildAssetDispose(input)
      case 'credit_card_spend': return this.buildCreditCardSpend(input)
      case 'credit_card_repay': return this.buildCreditCardRepay(input)
      default: throw new Error(`Unknown txType: ${input.txType}`)
    }
  }

  // ---- Transaction templates ----

  // 收入: Dr 现金/存款 → Cr 收入科目
  private async buildIncome(input: JournalInput): Promise<BuiltEntry[]> {
    const accSub = await this.getAccountSubjectId(input.accountId!)
    return [
      dr(accSub, input.amount, input.accountId),
      cr(input.subjectId, input.amount, null, input.l3SubjectId),
    ]
  }

  // 支出 (支持分拆): Dr 费用科目(s) → Cr 现金/存款
  private async buildExpense(input: JournalInput): Promise<BuiltEntry[]> {
    const accSub = await this.getAccountSubjectId(input.accountId!)

    if (input.splits && input.splits.length > 0) {
      const entries: BuiltEntry[] = input.splits.map(s =>
        dr(s.subjectId, s.amount, null, s.l3SubjectId ?? null)
      )
      const total = Math.round(input.splits.reduce((s, x) => s + x.amount, 0) * 100) / 100
      entries.push(cr(accSub, total, input.accountId))
      return entries
    }

    return [
      dr(input.subjectId, input.amount, null, input.l3SubjectId),
      cr(accSub, input.amount, input.accountId),
    ]
  }

  // 转账: Dr 目标账户 → Cr 来源账户
  private async buildTransfer(input: JournalInput): Promise<BuiltEntry[]> {
    const fromSub = await this.getAccountSubjectId(input.accountId!)
    const toSub = await this.getAccountSubjectId(input.toAccountId!)
    return [
      dr(toSub, input.amount, input.toAccountId),
      cr(fromSub, input.amount, input.accountId),
    ]
  }

  // 发工资: Dr 现金(实发) + 税费 + 社保 → Cr 工资收入(税前)
  private async buildSalary(input: JournalInput): Promise<BuiltEntry[]> {
    const gross = input.grossAmount ?? input.amount
    const tax = input.taxAmount ?? 0
    const social = input.socialAmount ?? 0
    const accSub = await this.getAccountSubjectId(input.accountId!)

    const entries: BuiltEntry[] = [
      dr(accSub, gross - tax - social, input.accountId),
      cr(input.subjectId, gross, null, input.l3SubjectId),
    ]
    if (tax > 0) entries.push(dr(await this.resolve.id(50803), tax))
    if (social > 0) entries.push(dr(await this.resolve.id(50804), social))
    return entries
  }

  // 投资买入: Dr 投资资产 → Cr 现金/存款
  private async buildInvestmentBuy(input: JournalInput): Promise<BuiltEntry[]> {
    const accSub = await this.getAccountSubjectId(input.accountId!)
    const entries = [
      dr(input.subjectId, input.amount, null, input.l3SubjectId),
      cr(accSub, input.amount, input.accountId),
    ]
    if (input.l3SubjectId) {
      const qty = input.quantity ?? 1
      const unitCost = input.unitPrice ?? input.amount
      await this.db.execute(
        `INSERT INTO investment_lots (l3_subject_id, buy_date, quantity, unit_cost, remaining_qty, remaining_cost)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [input.l3SubjectId, input.txDate, qty, unitCost, qty, input.amount]
      )
    }
    return entries
  }

  // 投资卖出: Dr 现金 + 转回估值储备 → Cr 投资资产 + 收益
  private async buildInvestmentSell(input: JournalInput): Promise<BuiltEntry[]> {
    const entries: BuiltEntry[] = []
    const accSub = await this.getAccountSubjectId(input.accountId!)

    const { totalCost, totalQty } = await this.getLotSummary(input.l3SubjectId!)
    const sellQty = input.quantity ?? totalQty
    const sellRatio = totalQty > 0 ? sellQty / totalQty : 1
    const sellCost = Math.round(totalCost * sellRatio * 100) / 100
    const gain = Math.round((input.amount - sellCost) * 100) / 100

    // Reverse valuation reserve
    const reserveBalance = await this.getValuationReserve(input.l3SubjectId!)
    const revAmt = Math.round(Math.abs(reserveBalance) * sellRatio * 100) / 100
    const reserveId = await this.resolve.id(30300)
    if (reserveBalance > 0 && revAmt > 0) entries.push(dr(reserveId, revAmt))
    else if (reserveBalance < 0 && revAmt > 0) entries.push(cr(reserveId, revAmt))

    // Cash in + asset out
    entries.push(dr(accSub, input.amount, input.accountId))
    entries.push(cr(input.subjectId, sellCost, null, input.l3SubjectId))

    // Gain / loss
    const gainSub = await this.resolve.id(40201)
    if (gain > 0) entries.push(cr(gainSub, gain, null, input.l3SubjectId))
    else if (gain < 0) entries.push(dr(gainSub, -gain, null, input.l3SubjectId))

    await this.reduceLots(input.l3SubjectId!, sellRatio)
    return entries
  }

  // 估值调整: Dr/Cr 投资资产 ↔ Cr/Dr 公允价值变动储备
  private async buildValuationAdjust(input: JournalInput): Promise<BuiltEntry[]> {
    const { totalCost } = await this.getLotSummary(input.l3SubjectId!)
    const diff = Math.round(((input.marketValue ?? input.amount) - totalCost) * 100) / 100
    if (diff === 0) return []

    const reserveId = await this.resolve.id(30300)
    return diff > 0
      ? [dr(input.subjectId, diff, null, input.l3SubjectId), cr(reserveId, diff, null, input.l3SubjectId)]
      : [dr(reserveId, -diff, null, input.l3SubjectId), cr(input.subjectId, -diff, null, input.l3SubjectId)]
  }

  // 借款: Dr 现金/存款 → Cr 负债科目
  private async buildLoanReceive(input: JournalInput): Promise<BuiltEntry[]> {
    const accSub = await this.getAccountSubjectId(input.accountId!)
    return [
      dr(accSub, input.amount, input.accountId),
      cr(input.subjectId, input.amount, null, input.l3SubjectId),
    ]
  }

  // 还贷: Dr 利息支出 + 负债减少 → Cr 现金/存款
  private async buildLoanRepay(input: JournalInput): Promise<BuiltEntry[]> {
    const interest = input.interestAmount ?? 0
    const principal = input.principalAmount ?? input.amount
    const accSub = await this.getAccountSubjectId(input.accountId!)
    return [
      dr(await this.resolve.id(50801), interest),
      dr(input.subjectId, principal, null, input.l3SubjectId),
      cr(accSub, interest + principal, input.accountId),
    ]
  }

  // 预付摊提: Dr 当月费用 + 待摊费用 + 押金 → Cr 现金
  private async buildPrepaidAmortize(input: JournalInput): Promise<BuiltEntry[]> {
    const deposit = input.depositAmount ?? 0
    const prepaid = input.prepaidAmount ?? 0
    const curExp = Math.round((input.amount - deposit - prepaid) * 100) / 100
    const accSub = await this.getAccountSubjectId(input.accountId!)

    // Create amortization schedule for future periods
    if (prepaid > 0 && input.l3SubjectId) {
      const months = await this.estimatePrepaidMonths(input)
      if (months > 0) {
        await this.db.insert(
          `INSERT INTO amortization_schedules (transaction_id, l3_subject_id, total_amount, periods, amount_per_period, remaining_periods, start_date)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [0, input.l3SubjectId, prepaid, months, Math.round(prepaid / months * 100) / 100, months, input.txDate.slice(0, 7)]
        )
      }
    }

    return [
      dr(input.subjectId, curExp, null, input.l3SubjectId),
      dr(await this.resolve.id(14100), prepaid),
      dr(await this.resolve.id(14200), deposit),
      cr(accSub, input.amount, input.accountId),
    ]
  }

  // 购置固定资产: Dr 固定资产 → Cr 现金/存款
  private async buildAssetPurchase(input: JournalInput): Promise<BuiltEntry[]> {
    const accSub = await this.getAccountSubjectId(input.accountId!)
    const entries = [
      dr(input.subjectId, input.amount, null, input.l3SubjectId),
      cr(accSub, input.amount, input.accountId),
    ]

    // Auto-create fixed-asset account + depreciation config
    if (input.depreciationMonths && input.depreciationMonths > 0) {
      let assetAccountId = input.l3SubjectId

      // If no existing account, create one for the fixed asset
      if (!assetAccountId) {
        const assetName = input.note || '固定资产'
        const subjectCode = await this.accountRepo.getNextSubjectCode(input.subjectId)
        assetAccountId = await this.accountRepo.create({
          name: assetName,
          subjectCode,
          accountType: 'fixed_asset',
          subjectId: input.subjectId,
        })
      }

      const subject = await this.subjectRepo.findById(input.subjectId)
      if (subject) {
        const depCodeMap: Record<string, string> = {
          '13101': '15101', '13102': '15102', '13103': '15103', '13104': '15104'
        }
        const depCode = depCodeMap[subject.code]
        if (depCode) {
          const depSubjId = await this.resolve.id(depCode)
          const assetName = input.note || '固定资产'
          await this.db.insert(
            `INSERT INTO depreciation_configs (account_id, asset_name, original_value, residual_value, useful_months, method, depreciation_subject_id, start_date)
             VALUES (?, ?, ?, ?, ?, 'straight_line', ?, ?)`,
            [assetAccountId, assetName, input.amount, input.residualValue ?? 0,
             input.depreciationMonths, depSubjId, input.txDate.slice(0, 7)]
          )
        }
      }
    }
    return entries
  }

  // 资产处置: Dr 现金 + 累计折旧 ± 损益 → Cr 固定资产原值
  private async buildAssetDispose(input: JournalInput): Promise<BuiltEntry[]> {
    const proceeds = input.disposalProceeds ?? 0
    const assetValue = input.amount
    const depSubjId = await this.getDepreciationSubjectId(input.l3SubjectId!)
    const depBalance = depSubjId ? await this.getSubjectBalance(depSubjId) : 0
    const netBookValue = assetValue - depBalance
    const loss = Math.round((netBookValue - proceeds) * 100) / 100

    const accSub = input.accountId ? await this.getAccountSubjectId(input.accountId) : input.subjectId
    const entries: BuiltEntry[] = []

    if (proceeds > 0 && input.accountId) entries.push(dr(accSub, proceeds, input.accountId))
    if (depBalance > 0 && depSubjId) entries.push(dr(depSubjId, depBalance, null, input.l3SubjectId))
    if (loss > 0) entries.push(dr(await this.resolve.id(50703), loss))

    entries.push(cr(input.subjectId, assetValue, null, input.l3SubjectId))

    if (loss < 0) entries.push(cr(await this.resolve.id(50703), -loss))

    if (input.l3SubjectId) {
      await this.db.execute(
        'UPDATE depreciation_configs SET is_active = 0 WHERE account_id = ?', [input.l3SubjectId]
      )
    }
    return entries
  }

  // 信用卡消费: Dr 费用 → Cr 信用卡负债
  private async buildCreditCardSpend(input: JournalInput): Promise<BuiltEntry[]> {
    const creditSub = await this.resolve.id(20100)
    return [
      dr(input.subjectId, input.amount, null, input.l3SubjectId),
      cr(creditSub, input.amount, input.accountId),
    ]
  }

  // 信用卡还款: Dr 信用卡负债 → Cr 现金/存款
  private async buildCreditCardRepay(input: JournalInput): Promise<BuiltEntry[]> {
    const creditSub = await this.resolve.id(20100)
    const accSub = await this.getAccountSubjectId(input.toAccountId!)
    return [
      dr(creditSub, input.amount, input.accountId),
      cr(accSub, input.amount, input.toAccountId),
    ]
  }

  // ---- Helpers ----

  private async getAccountSubjectId(accountId: number): Promise<number> {
    const account = await this.accountRepo.findById(accountId)
    if (!account) throw new Error(`账户 ${accountId} 不存在`)
    return account.subjectId
  }

  private async getValuationReserve(l3SubjectId: number): Promise<number> {
    const reserveId = await this.resolve.id(30300)
    const result = await this.db.queryOne<{bal: number | null}>(
      `SELECT SUM(CASE WHEN je.direction = 'credit' THEN je.amount ELSE -je.amount END) as bal
       FROM journal_entries je WHERE je.subject_id = ? AND je.l3_subject_id = ?`,
      [reserveId, l3SubjectId]
    )
    return result?.bal ?? 0
  }

  private async getDepreciationSubjectId(l3SubjectId: number): Promise<number | null> {
    const account = await this.accountRepo.findById(l3SubjectId)
    if (!account) return null
    const subject = await this.subjectRepo.findById(account.subjectId)
    if (!subject) return null
    const depCodeMap: Record<string, string> = {
      '13101': '15101', '13102': '15102', '13103': '15103', '13104': '15104'
    }
    const depCode = depCodeMap[subject.code]
    return depCode ? this.resolve.id(depCode) : null
  }

  private async getSubjectBalance(subjectId: number): Promise<number> {
    const result = await this.db.queryOne<{bal: number | null}>(
      `SELECT SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END) as bal
       FROM journal_entries WHERE subject_id = ?`, [subjectId]
    )
    return Math.abs(result?.bal ?? 0)
  }

  private async getLotSummary(l3SubjectId: number): Promise<{ totalCost: number; totalQty: number }> {
    const result = await this.db.queryOne<{ cost: number | null; qty: number | null }>(
      `SELECT SUM(remaining_cost) as cost, SUM(remaining_qty) as qty
       FROM investment_lots WHERE l3_subject_id = ? AND remaining_qty > 0`,
      [l3SubjectId]
    )
    return { totalCost: result?.cost ?? 0, totalQty: result?.qty ?? 0 }
  }

  private async reduceLots(l3SubjectId: number, ratio: number): Promise<void> {
    if (ratio >= 1) {
      await this.db.execute(
        'UPDATE investment_lots SET remaining_qty = 0, remaining_cost = 0 WHERE l3_subject_id = ?',
        [l3SubjectId]
      )
    } else {
      await this.db.execute(
        `UPDATE investment_lots SET remaining_qty = ROUND(remaining_qty * (1 - ?), 4),
         remaining_cost = ROUND(remaining_cost * (1 - ?), 2) WHERE l3_subject_id = ?`,
        [ratio, ratio, l3SubjectId]
      )
    }
  }

  /** Estimate prepaid months from adjacent form fields (heuristic) */
  private async estimatePrepaidMonths(input: JournalInput): Promise<number> {
    const prepaid = input.prepaidAmount ?? 0
    const curExp = input.amount - (input.depositAmount ?? 0) - prepaid
    if (curExp <= 0 || prepaid <= 0) return 0
    // Each period ≈ current month's expense
    const months = Math.round(prepaid / curExp)
    return Math.max(1, Math.min(months, 24)) // cap at 24 months
  }
}
