<template>
  <div class="page-add">
    <div class="page-header">
      <span class="page-title">{{ formName }}</span>
      <span v-if="isEdit" class="page-subtitle">编辑交易 #{{ editId }}</span>
    </div>

    <div class="form-card">
    <el-form label-width="160">
      <el-form-item label="日期">
        <el-input v-model="form.txDate" type="text" placeholder="YYYY-MM-DD" />
      </el-form-item>

      <!-- Type-specific fields -->
      <!-- Income fields -->
      <template v-if="type === 'income'">
        <el-form-item label="收入分类">
          <el-input v-model="form.subjectName" readonly placeholder="选择收入科目" @focus="pickSubject('income')" />
        </el-form-item>
        <el-form-item label="到账账户">
          <el-input v-model="form.accountName" readonly placeholder="选择账户" @focus="pickAccount()" />
        </el-form-item>
        <el-form-item label="金额">
          <el-input v-model="form.amount" type="number" placeholder="请输入金额" />
        </el-form-item>
      </template>

      <!-- Expense fields -->
      <template v-if="type === 'expense'">
        <el-form-item label="付款账户">
          <el-input v-model="form.accountName" readonly placeholder="选择账户" @focus="pickAccount()" />
        </el-form-item>
        <el-form-item label="分拆">
          <el-switch v-model="splitMode" active-color="#007AFF" />
        </el-form-item>

        <!-- Single mode -->
        <template v-if="!splitMode">
          <el-form-item label="支出分类">
            <el-input v-model="form.subjectName" readonly placeholder="选择支出科目" @focus="pickSubject('expense')" />
          </el-form-item>
          <el-form-item label="金额">
            <el-input v-model="form.amount" type="number" placeholder="请输入金额" />
          </el-form-item>
        </template>

        <!-- Split mode -->
        <template v-else>
          <div v-for="(s, i) in form.splits" :key="i" class="split-row">
            <el-form-item :label="'分类 ' + (i + 1)">
              <el-input v-model="s.subjectName" readonly :placeholder="'选择科目'" @focus="pickSplitSubject(i)" />
            </el-form-item>
            <el-form-item label="金额">
              <el-input v-model="s.amount" type="number" placeholder="金额" />
            </el-form-item>
            <span v-if="form.splits.length > 2" class="split-del" @click="removeSplit(i)">✕</span>
          </div>
          <div v-if="form.splits.length < 10" class="split-add-row">
            <span class="split-add" @click="addSplit">+ 添加分项</span>
          </div>
        </template>
      </template>

      <!-- Transfer -->
      <template v-if="type === 'transfer'">
        <el-form-item label="转出账户">
          <el-input v-model="form.accountName" readonly placeholder="选择转出账户" @focus="pickAccount()" />
        </el-form-item>
        <el-form-item label="转入账户">
          <el-input v-model="form.toAccountName" readonly placeholder="选择转入账户" @focus="pickToAccount()" />
        </el-form-item>
        <el-form-item label="金额">
          <el-input v-model="form.amount" type="number" placeholder="请输入金额" />
        </el-form-item>
      </template>

      <!-- Salary -->
      <template v-if="type === 'salary'">
        <el-form-item label="工资分类">
          <el-input v-model="form.subjectName" readonly placeholder="工资薪金" @focus="pickSubject('income')" />
        </el-form-item>
        <el-form-item label="到账账户">
          <el-input v-model="form.accountName" readonly placeholder="选择账户" @focus="pickAccount()" />
        </el-form-item>
        <el-form-item label="税前总额">
          <el-input v-model="form.grossAmount" type="number" placeholder="税前工资总额" />
        </el-form-item>
        <el-form-item label="个税">
          <el-input v-model="form.taxAmount" type="number" placeholder="代扣个税" />
        </el-form-item>
        <el-form-item label="社保公积金">
          <el-input v-model="form.socialAmount" type="number" placeholder="社保+公积金" />
        </el-form-item>
      </template>

      <!-- Investment Buy -->
      <template v-if="type === 'investment_buy'">
        <el-form-item label="投资品">
          <el-input v-model="form.l3SubjectName" readonly placeholder="选择或输入名称" @focus="pickL3Subject('investment')" />
        </el-form-item>
        <el-form-item label="付款账户">
          <el-input v-model="form.accountName" readonly placeholder="选择账户" @focus="pickAccount()" />
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="form.l3SubjectName" placeholder="投资品名称，代码可写后面" />
        </el-form-item>
        <el-form-item label="单价">
          <el-input v-model="form.unitPrice" type="number" placeholder="单价" />
        </el-form-item>
        <el-form-item label="总金额">
          <el-input v-model="form.amount" type="number" placeholder="买入总金额" />
        </el-form-item>
      </template>

      <!-- Investment Sell -->
      <template v-if="type === 'investment_sell'">
        <el-form-item label="投资品">
          <el-input v-model="form.l3SubjectName" readonly placeholder="选择投资品" @focus="pickL3Subject('investment')" />
        </el-form-item>
        <el-form-item label="到账账户">
          <el-input v-model="form.accountName" readonly placeholder="选择账户" @focus="pickAccount()" />
        </el-form-item>
        <el-form-item label="卖出金额">
          <el-input v-model="form.amount" type="number" placeholder="卖出总金额" />
        </el-form-item>
        <el-form-item label="卖出数量">
          <el-input v-model="form.quantity" type="number" placeholder="卖出数量(留空=全部)" />
        </el-form-item>
        <el-form-item label="卖出单价">
          <el-input v-model="form.unitPrice" type="number" placeholder="卖出单价" />
        </el-form-item>
      </template>

      <!-- Loan Repay -->
      <template v-if="type === 'loan_repay'">
        <el-form-item label="还款账户">
          <el-input v-model="form.accountName" readonly placeholder="选择付款账户" @focus="pickAccount()" />
        </el-form-item>
        <el-form-item label="还款总额">
          <el-input v-model="form.amount" type="number" placeholder="还款总额" />
        </el-form-item>
        <el-form-item label="其中利息">
          <el-input v-model="form.interestAmount" type="number" placeholder="利息部分" />
        </el-form-item>
        <el-form-item label="其中本金">
          <el-input v-model="form.principalAmount" type="number" placeholder="本金部分" />
        </el-form-item>
      </template>

      <!-- Prepaid Amortize -->
      <template v-if="type === 'prepaid_amortize'">
        <el-form-item label="费用科目">
          <el-input v-model="form.subjectName" readonly placeholder="选择费用科目" @focus="pickSubject('expense')" />
        </el-form-item>
        <el-form-item label="付款账户">
          <el-input v-model="form.accountName" readonly placeholder="选择账户" @focus="pickAccount()" />
        </el-form-item>
        <el-form-item label="付款总额">
          <el-input v-model="form.amount" type="number" placeholder="支付总额" />
        </el-form-item>
        <el-form-item label="押金(可退)">
          <el-input v-model="form.depositAmount" type="number" placeholder="押金金额" />
        </el-form-item>
        <el-form-item label="预付金额">
          <el-input v-model="form.prepaidAmount" type="number" placeholder="待摊金额" />
        </el-form-item>
      </template>

      <!-- Asset Purchase -->
      <template v-if="type === 'asset_purchase'">
        <el-form-item label="资产分类">
          <el-input v-model="form.subjectName" readonly placeholder="选择资产分类" @focus="pickSubject('asset')" />
        </el-form-item>
        <el-form-item label="资产名称">
          <el-input v-model="form.l3SubjectName" placeholder="如：联想笔记本" />
        </el-form-item>
        <el-form-item label="付款账户">
          <el-input v-model="form.accountName" readonly placeholder="选择账户" @focus="pickAccount()" />
        </el-form-item>
        <el-form-item label="购买金额">
          <el-input v-model="form.amount" type="number" placeholder="购买金额" />
        </el-form-item>
        <el-form-item label="折旧年限">
          <el-input v-model="form.depreciationMonths" type="number" placeholder="使用月数" />
        </el-form-item>
        <el-form-item label="残值">
          <el-input v-model="form.residualValue" type="number" placeholder="预计残值" />
        </el-form-item>
      </template>

      <!-- Credit Card Spend -->
      <template v-if="type === 'credit_card_spend'">
        <el-form-item label="支出分类">
          <el-input v-model="form.subjectName" readonly placeholder="选择支出科目" @focus="pickSubject('expense')" />
        </el-form-item>
        <el-form-item label="信用卡">
          <el-input v-model="form.accountName" readonly placeholder="选择信用卡" @focus="pickAccount('credit_card')" />
        </el-form-item>
        <el-form-item label="金额">
          <el-input v-model="form.amount" type="number" placeholder="消费金额" />
        </el-form-item>
      </template>

      <!-- Credit Card Repay -->
      <template v-if="type === 'credit_card_repay'">
        <el-form-item label="信用卡">
          <el-input v-model="form.accountName" readonly placeholder="选择信用卡" @focus="pickAccount('credit_card')" />
        </el-form-item>
        <el-form-item label="还款账户">
          <el-input v-model="form.toAccountName" readonly placeholder="选择付款账户" @focus="pickAccount()" />
        </el-form-item>
        <el-form-item label="还款金额">
          <el-input v-model="form.amount" type="number" placeholder="还款金额" />
        </el-form-item>
      </template>

      <!-- Valuation Adjust -->
      <template v-if="type === 'valuation_adjust'">
        <el-form-item label="投资品">
          <el-input v-model="form.l3SubjectName" readonly placeholder="选择投资品" @focus="pickL3Subject('investment')" />
        </el-form-item>
        <el-form-item label="原值(成本)">
          <el-input v-model="form.originalCost" type="number" placeholder="买入成本" />
        </el-form-item>
        <el-form-item label="最新市值">
          <el-input v-model="form.marketValue" type="number" placeholder="当前市值" />
        </el-form-item>
      </template>

      <!-- Loan Receive -->
      <template v-if="type === 'loan_receive'">
        <el-form-item label="借款分类">
          <el-input v-model="form.subjectName" readonly placeholder="选择负债科目" @focus="pickSubject('liability')" />
        </el-form-item>
        <el-form-item label="到账账户">
          <el-input v-model="form.accountName" readonly placeholder="选择收款账户" @focus="pickAccount()" />
        </el-form-item>
        <el-form-item label="借款金额">
          <el-input v-model="form.amount" type="number" placeholder="借款金额" />
        </el-form-item>
      </template>

      <!-- Asset Dispose -->
      <template v-if="type === 'asset_dispose'">
        <el-form-item label="资产">
          <el-input v-model="form.l3SubjectName" readonly placeholder="选择资产" @focus="pickL3Subject('fixed_asset')" />
        </el-form-item>
        <el-form-item label="收款账户">
          <el-input v-model="form.accountName" readonly placeholder="选择收款账户" @focus="pickAccount()" />
        </el-form-item>
        <el-form-item label="处置收入">
          <el-input v-model="form.disposalProceeds" type="number" placeholder="卖出/回收金额" />
        </el-form-item>
        <el-form-item label="资产原值">
          <el-input v-model="form.amount" type="number" placeholder="资产原值" />
        </el-form-item>
        <el-form-item label="处置原因">
          <el-input v-model="form.disposalReason" placeholder="出售/报废/其他" />
        </el-form-item>
      </template>

      <!-- Notes (common) -->
      <el-form-item label="备注">
        <el-input v-model="form.note" type="text" placeholder="选填" />
      </el-form-item>

      <!-- Tags -->
      <el-form-item label="标签">
        <div class="tag-area">
          <div v-for="tagId in form.tagIds" :key="tagId" class="tag-chip" @click="removeTag(tagId)">
            <span>{{ getTagName(tagId) }} ✕</span>
          </div>
          <span class="tag-add" @click="pickTag">+ 添加标签</span>
        </div>
      </el-form-item>
    </el-form>
    </div>

    <div class="btn-bar">
      <el-button type="primary" @click="save" :loading="saving" block>保存</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {  onLoad  } from '@/uni-shim'
import { useSubjectStore } from '@/stores/subjects'
import { useAccountStore } from '@/stores/accounts'
import { useTransactionStore } from '@/stores/transactions'
import { getDatabase } from '@/database/factory'
import { TransactionRepository } from '@/repositories/transaction-repo'
import type { AccountingSubject } from '@/types'

const subjectStore = useSubjectStore()
const accountStore = useAccountStore()
const txStore = useTransactionStore()

// Tags — loaded directly
const tags = ref<{ id: number; name: string; color: string }[]>([])
async function loadTags() {
  const db = await getDatabase()
  tags.value = await db.query<{ id: number; name: string; color: string }>('SELECT id, name, color FROM tags')
}

const saving = ref(false)
const type = ref('expense')
const editId = ref(0)
const splitMode = ref(false)
const isEdit = computed(() => editId.value > 0)

const txTypeNames: Record<string, string> = {
  income: '收入', expense: '支出', transfer: '转账',
  salary: '发工资', investment_buy: '投资买入', investment_sell: '投资卖出',
  valuation_adjust: '估值调整', loan_receive: '借款', loan_repay: '还款',
  prepaid_amortize: '预付摊提', asset_purchase: '购置固定资产',
  asset_dispose: '资产处置', credit_card_spend: '信用卡消费',
  credit_card_repay: '信用卡还款',
}

const formName = computed(() => txTypeNames[type.value] || type.value)

const form = ref({
  txDate: new Date().toISOString().slice(0, 10),
  amount: '',
  subjectId: 0 as number,
  subjectName: '',
  l3SubjectId: null as number | null,
  l3SubjectName: '',
  accountId: null as number | null,
  accountName: '',
  toAccountId: null as number | null,
  toAccountName: '',
  note: '',
  // Type-specific
  grossAmount: '',
  taxAmount: '',
  socialAmount: '',
  quantity: '',
  unitPrice: '',
  interestAmount: '',
  principalAmount: '',
  originalCost: '',
  marketValue: '',
  depreciationMonths: '',
  residualValue: '',
  depositAmount: '',
  prepaidAmount: '',
  disposalProceeds: '',
  disposalReason: '',
  tagIds: [] as number[],
  splits: [] as { subjectId: number; subjectName: string; amount: string }[],
})

onLoad(async (opt) => {
  try {
    await Promise.all([subjectStore.load(), accountStore.load()])
  } catch (e) {
    console.error('加载科目/账户失败:', e)
  }
  console.log('Accounts loaded:', accountStore.accounts.length)
  loadTags()
  if (opt?.type) type.value = opt.type
  if (opt?.id) {
    editId.value = Number(opt.id)
    const db = await getDatabase()
    const repo = new TransactionRepository(db)
    const tx = await repo.findById(editId.value)
    if (tx) {
      form.value.txDate = tx.txDate
      form.value.amount = String(tx.amount)
      form.value.subjectId = tx.subjectId
      form.value.l3SubjectId = tx.l3SubjectId
      form.value.accountId = tx.accountId
      form.value.toAccountId = tx.toAccountId
      form.value.note = tx.note || ''
      const sub = subjectStore.getById(tx.subjectId)
      form.value.subjectName = sub ? `${sub.code} ${sub.name}` : ''
      const acc = accountStore.getById(tx.accountId || 0)
      form.value.accountName = acc ? `${acc.name}` : ''
      const toAcc = accountStore.getById(tx.toAccountId || 0)
      form.value.toAccountName = toAcc ? `${toAcc.name}` : ''
    }
  }
})

function pickSubject(filter?: string) {
  // Step 1: pick L1 subject
  const l1Items = subjectStore.subjects
    .filter(s => s.level === 1 && (!filter || s.subjectType === filter))
    .map(s => ({ label: `${s.code} ${s.name}`, value: s.id }))

  if (l1Items.length === 0) {
    uni.showToast({ title: '暂无科目，请先初始化数据' })
    return
  }

  uni.showActionSheet({
    itemList: l1Items.map(i => i.label),
    title: '选择一级科目',
    success: (res1) => {
      if (res1.tapIndex < 0) return
      const l1Choice = l1Items[res1.tapIndex]

      // Step 2: pick L2 under selected L1
      const l2Items = subjectStore.subjects
        .filter(s => s.level === 2 && s.parentId === l1Choice.value)
        .map(s => ({ label: `${s.code} ${s.name}`, value: s.id }))

      if (l2Items.length === 0) {
        uni.showToast({ title: '该一级科目下无二级科目' })
        return
      }

      uni.showActionSheet({
        itemList: l2Items.map(i => i.label),
        title: l1Choice.label + ' → 选择二级科目',
        success: (res2) => {
          if (res2.tapIndex < 0) return
          const l2Choice = l2Items[res2.tapIndex]

          // Step 3: check for L3 children (subjects + accounts)
          const l3Subjects = subjectStore.subjects
            .filter(s => s.level === 3 && s.parentId === l2Choice.value && s.code && s.name && s.isActive)
            .map(s => ({ label: `${s.code} ${s.name}`, value: s.id }))
          // Also include container-type L3 accounts under this L2
          const l3Accounts = accountStore.accounts
            .filter(a => a.subjectId === l2Choice.value)
            .map(a => ({ label: `账户: ${a.name}`, value: -a.id })) // negative ID = account
          const l3Items = [...l3Subjects, ...l3Accounts]

          if (l3Items.length === 0) {
            form.value.subjectId = l2Choice.value
            form.value.subjectName = l2Choice.label
            return
          }

          uni.showActionSheet({
            itemList: l3Items.map(i => i.label),
            title: l2Choice.label + ' → 选择三级',
            success: (res3) => {
              if (res3.tapIndex >= 0) {
                const choice = l3Items[res3.tapIndex]
                if (choice.value < 0) {
                  // Account type L3: set l3SubjectId, and resolve subject from account
                  const acc = accountStore.accounts.find(a => a.id === -choice.value)
                  form.value.l3SubjectId = acc?.id ?? null
                  form.value.subjectId = l2Choice.value
                  form.value.subjectName = choice.label.replace('账户: ', '')
                } else {
                  form.value.subjectId = choice.value
                  form.value.subjectName = choice.label
                }
              }
            }
          })
        }
      })
    }
  })
}

function pickL3Subject(filter?: string) {
  const items = accountStore.accounts
    .filter(a => !filter || a.accountType === filter)
    .map(a => ({ label: `${a.name}`, value: a.id }))

  uni.showActionSheet({
    itemList: items.map(i => i.label),
    success: (res) => {
      if (res.tapIndex >= 0) {
        const item = items[res.tapIndex]
        form.value.l3SubjectId = item.value
        form.value.l3SubjectName = item.label
      }
    }
  })
}

function pickAccount(typeFilter?: string) {
  console.log('pickAccount called, accounts:', accountStore.accounts.length, 'filter:', typeFilter)
  const items = accountStore.accounts
    .filter(a => !typeFilter || a.accountType === typeFilter)
    .map(a => ({ label: a.name + '  ¥' + Math.abs(a.balance).toFixed(0), value: a.id }))

  console.log('pickAccount items:', items.length)
  if (items.length === 0) {
    uni.showToast({ title: '暂无账户（已加载' + accountStore.accounts.length + '个），请在账户页面添加' })
    return
  }

  uni.showActionSheet({
    itemList: items.map(i => i.label),
    success: (res) => {
      if (res.tapIndex >= 0) {
        const item = items[res.tapIndex]
        form.value.accountId = item.value
        form.value.accountName = item.label
      }
    }
  })
}

function getTagName(id: number): string {
  return tags.value.find(t => t.id === id)?.name || `#${id}`
}

function pickTag() {
  if (tags.value.length === 0) {
    uni.showToast({ title: '请先在设置中创建标签', icon: 'none' })
    return
  }
  const available = tags.value.filter(t => !form.value.tagIds.includes(t.id))
  if (available.length === 0) return
  uni.showActionSheet({
    itemList: available.map(t => t.name),
    success: (res) => {
      if (res.tapIndex >= 0) {
        form.value.tagIds.push(available[res.tapIndex].id)
      }
    }
  })
}

function removeTag(tagId: number) {
  form.value.tagIds = form.value.tagIds.filter((id: number) => id !== tagId)
}

function addSplit() {
  if (form.value.splits.length >= 10) return
  form.value.splits.push({ subjectId: 0, subjectName: '', amount: '' })
}

function removeSplit(idx: number) {
  form.value.splits.splice(idx, 1)
}

function pickSplitSubject(idx: number) {
  const items = subjectStore.subjects
    .filter(s => s.level === 2 && s.subjectType === 'expense')
    .map(s => ({ label: `${s.code} ${s.name}`, value: s.id }))
  uni.showActionSheet({
    itemList: items.map(i => i.label),
    success: (res) => {
      if (res.tapIndex >= 0) {
        const item = items[res.tapIndex]
        form.value.splits[idx].subjectId = item.value
        form.value.splits[idx].subjectName = item.label
      }
    }
  })
}

function pickToAccount() {
  const items = accountStore.accounts
    .filter(a => a.id !== form.value.accountId)
    .map(a => ({ label: `${a.name}`, value: a.id }))

  uni.showActionSheet({
    itemList: items.map(i => i.label),
    success: (res) => {
      if (res.tapIndex >= 0) {
        const item = items[res.tapIndex]
        form.value.toAccountId = item.value
        form.value.toAccountName = item.label
      }
    }
  })
}

// Type-specific numeric fields — parsed from form strings
const numericFields: Record<string, 'float' | 'int'> = {
  grossAmount: 'float', taxAmount: 'float', socialAmount: 'float',
  quantity: 'float', unitPrice: 'float',
  interestAmount: 'float', principalAmount: 'float',
  depositAmount: 'float', prepaidAmount: 'float',
  depreciationMonths: 'int', residualValue: 'float',
  disposalProceeds: 'float', originalCost: 'float', marketValue: 'float',
}

function buildPayload(): any {
  const p: any = {
    txType: type.value,
    txDate: form.value.txDate,
    amount: parseFloat(form.value.amount) || 0,
    subjectId: form.value.subjectId || subjectStore.subjects.find(s => s.subjectType === 'expense' && s.level === 2)?.id || 0,
    l3SubjectId: form.value.l3SubjectId,
    accountId: form.value.accountId,
    toAccountId: form.value.toAccountId,
    note: form.value.note || null,
    tagIds: form.value.tagIds.length > 0 ? form.value.tagIds : undefined,
    splits: splitMode.value ? form.value.splits.map(s => ({ subjectId: s.subjectId, amount: parseFloat(s.amount) || 0 })) : undefined,
  }
  for (const [key, kind] of Object.entries(numericFields)) {
    const raw = (form.value as any)[key]
    if (raw !== '' && raw !== undefined) {
      p[key] = kind === 'int' ? parseInt(raw) : parseFloat(raw)
    }
  }
  if (form.value.disposalReason) p.disposalReason = form.value.disposalReason
  return p
}

async function save() {
  saving.value = true
  try {
    const payload = buildPayload()
    if (isEdit.value) {
      await txStore.updateTx(editId.value, payload)
    } else {
      await txStore.create(payload)
    }
    uni.showToast({ title: isEdit.value ? '修改成功' : '保存成功', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 1000)
  } catch (e: any) {
    uni.showToast({ title: '保存失败: ' + (e.message || e), icon: 'none' })
  } finally {
    saving.value = false
  }
}
</script>

<style lang="scss" scoped>
.page-add { padding: 18px; padding-bottom: 60px; }
.page-header { margin-bottom: 18px; }
.page-title { font-family: 'Noto Serif SC', serif; font-size: 22px; font-weight: 700; color: #1C1915; display: block; }
.page-subtitle { font-size: 13px; color: #9E9790; margin-top: 2px; display: block; }
.form-card { background: #FDFCF9; border-radius: 12px; padding: 20px; border: 1px solid #EDE8E0; box-shadow: 0 1px 4px rgba(28,25,21,0.04); }
.btn-bar { margin-top: 24px; padding-bottom: 40px; }
.tag-area { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
.tag-chip {
  background: #EDF6F5; color: #2D7D7A; font-size: 11px;
  padding: 3px 8px; border-radius: 10px; cursor: pointer;
}
.tag-add { font-size: 11px; color: #C44536; cursor: pointer; }
.split-row { position: relative; }
.split-del { position: absolute; right: 5px; top: 5px; font-size: 12px; color: #C44536; cursor: pointer; }
.split-add-row { text-align: center; padding: 5px 0; }
.split-add { font-size: 12px; color: #2D7D7A; cursor: pointer; }
</style>
