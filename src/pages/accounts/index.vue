<template>
  <div class="page-accounts">
    <div class="page-header">
      <span class="page-title">账户</span>
    </div>
    <div class="group">
      <div class="group-title">资产账户</div>
      <div v-for="acc in assetAccounts" :key="acc.id" class="acc-item" @click="viewDetail(acc)">
        <div class="acc-left">
          <span class="acc-name">{{ acc.name }}</span>
          <span class="acc-type">{{ typeName(acc.accountType) }}</span>
        </div>
        <span :class="['acc-balance', acc.balance >= 0 ? 'positive' : 'negative']">
          ¥{{ formatAmount(acc.balance) }}
        </span>
      </div>
      <div v-if="assetAccounts.length === 0" class="empty">暂无资产账户</div>
    </div>

    <div class="group">
      <div class="group-title">负债账户</div>
      <div v-for="acc in liabilityAccounts" :key="acc.id" class="acc-item" @click="viewDetail(acc)">
        <div class="acc-left">
          <span class="acc-name">{{ acc.name }}</span>
          <span class="acc-type">{{ typeName(acc.accountType) }}</span>
        </div>
        <span class="acc-balance negative">¥{{ formatAmount(acc.balance) }}</span>
      </div>
      <div v-if="liabilityAccounts.length === 0" class="empty">暂无负债账户</div>
    </div>

    <div class="add-btn">
      <el-button type="primary" @click="openAddPopup">添加账户</el-button>
    </div>

    <!-- Add Account Dialog -->
    <el-dialog v-model="showAdd" title="添加账户" width="400px" :close-on-click-modal="false">
      <el-form label-width="80px" size="default">
        <el-form-item label="名称">
          <el-input v-model="newAcc.name" placeholder="账户名称" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="typeIndex" style="width:100%" @change="onTypeChange">
            <el-option v-for="(label, idx) in typeLabelsOptions" :key="idx" :label="label" :value="idx" />
          </el-select>
        </el-form-item>
        <el-form-item label="所属科目">
          <span v-if="subjectOptions.length <= 1">{{ subjectOptions[subjectIndex] || subjectDisplay }}</span>
          <el-select v-else v-model="subjectIndex" style="width:100%" @change="onSubjectChange">
            <el-option v-for="(label, idx) in subjectOptions" :key="idx" :label="label" :value="idx" />
          </el-select>
        </el-form-item>
        <el-form-item label="初始余额">
          <el-input v-model="newAcc.initialBalance" type="number" placeholder="留空则为0" />
        </el-form-item>
        <el-form-item label="银行名称" v-if="isBankType">
          <el-input v-model="newAcc.bankName" placeholder="银行名称" />
        </el-form-item>
        <el-form-item label="卡号后4位" v-if="isBankType">
          <el-input v-model="newAcc.cardLastFour" placeholder="卡号后4位" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="newAcc.notes" placeholder="投资品名称/代码等" />
        </el-form-item>
        <template v-if="newAcc.accountType === 'fixed_asset'">
          <el-divider>折旧配置（可选）</el-divider>
          <el-form-item label="原值">
            <el-input v-model="newAcc.originalValue" type="number" placeholder="购买价格" />
          </el-form-item>
          <el-form-item label="残值">
            <el-input v-model="newAcc.residualValue" type="number" placeholder="预计残值" />
          </el-form-item>
          <el-form-item label="使用月数">
            <el-input v-model="newAcc.usefulMonths" type="number" placeholder="如：36" />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="showAdd = false">取消</el-button>
        <el-button type="primary" @click="addAccount">确认添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {  onShow  } from '@/uni-shim'
import { getDatabase } from '@/database/factory'
import { useAccountStore } from '@/stores/accounts'
import { useSubjectStore } from '@/stores/subjects'
import type { AccountType } from '@/types'

const accountStore = useAccountStore()
const subjectStore = useSubjectStore()

const showAdd = ref(false)
const typeIndex = ref(0)
const subjectIndex = ref(0)

function openAddPopup() {
  autoSelectSubject()
  showAdd.value = true
}

const accountTypes = ['cash', 'checking', 'fixed_deposit', 'money_market', 'receivable',
  'investment', 'fixed_asset', 'prepaid', 'deposit',
  'credit_card', 'payable', 'loan']

const typeLabels: Record<string, string> = {
  cash: '现金', checking: '活期账户', fixed_deposit: '定期存款',
  money_market: '货币基金', receivable: '应收款', investment: '投资资产',
  fixed_asset: '固定资产', prepaid: '待摊费用', deposit: '押金/保证金',
  credit_card: '信用卡', payable: '应付款', loan: '借款'
}

const typeSubjectCode: Record<string, string> = {
  cash: '10100', checking: '10201', fixed_deposit: '10202',
  money_market: '10300', receivable: '11100', investment: '12100',
  fixed_asset: '13100', prepaid: '14100', deposit: '14200',
  credit_card: '20100', payable: '20200', loan: '21100',
}

const newAcc = ref({
  name: '',
  accountType: 'checking' as AccountType,
  subjectId: 0,
  bankName: '',
  cardLastFour: '',
  notes: '',
  initialBalance: '' as string | number,
  originalValue: '',
  residualValue: '',
  usefulMonths: '',
})

const isBankType = computed(() => ['checking', 'fixed_deposit', 'credit_card'].includes(newAcc.value.accountType))

const assetAccounts = computed(() => accountStore.accounts.filter(a =>
  ['cash','checking','fixed_deposit','money_market','receivable','investment','fixed_asset','prepaid','deposit'].includes(a.accountType)))
const liabilityAccounts = computed(() => accountStore.accounts.filter(a =>
  ['credit_card','payable','loan'].includes(a.accountType)))

const typeLabelsOptions = computed(() =>
  accountTypes.map(t => typeLabels[t] || t)
)

const subjectDisplay = computed(() => {
  const sub = subjectStore.subjects.find(s => s.id === newAcc.value.subjectId)
  return sub ? `${sub.code} ${sub.name}` : '自动匹配中...'
})

const subjectOptions = computed(() => {
  const code = typeSubjectCode[newAcc.value.accountType]
  if (!code) return [subjectDisplay.value]
  const base = subjectStore.subjects.find(s => s.code === code)
  if (!base) return [subjectDisplay.value]
  const children = subjectStore.subjects.filter(s => s.parentId === base.id)
  if (children.length === 0) return [`${base.code} ${base.name}`]
  return children.map(s => `${s.code} ${s.name}`)
})

function typeName(t: string) { return typeLabels[t] || t }
function formatAmount(n: number) { return Math.abs(n).toFixed(2) }

function onTypeChange(val: number) {
  newAcc.value.accountType = accountTypes[val] as AccountType
  autoSelectSubject()
}

function autoSelectSubject() {
  const code = typeSubjectCode[newAcc.value.accountType]
  if (!code) return
  const subject = subjectStore.subjects.find(s => s.code === code)
  if (!subject) return
  // Use children if available, otherwise use the base subject
  const children = subjectStore.subjects.filter(s => s.parentId === subject.id)
  const target = children.length > 0 ? children[0] : subject
  newAcc.value.subjectId = target.id
  subjectIndex.value = 0
}

function onSubjectChange(val: number) {
  if (typeof val !== 'number') return
  const opts = subjectOptions.value
  if (!opts.length) return
  const code = opts[val].split(' ')[0]
  const sub = subjectStore.subjects.find(s => s.code === code)
  if (sub) newAcc.value.subjectId = sub.id
}

async function addAccount() {
  try {
    const bal = newAcc.value.initialBalance
    const accountId = await accountStore.create({
      name: newAcc.value.name,
      accountType: newAcc.value.accountType,
      subjectId: newAcc.value.subjectId,
      bankName: newAcc.value.bankName,
      cardLastFour: newAcc.value.cardLastFour,
      notes: newAcc.value.notes,
      initialBalance: bal === '' || bal === undefined ? undefined : Number(bal),
    })
    // Auto-create depreciation config for fixed assets
    if (newAcc.value.accountType === 'fixed_asset' && newAcc.value.usefulMonths) {
      const db = await getDatabase()
      const { DepreciationService } = await import('@/services/depreciation.service')
      const svc = new DepreciationService(db)
      const ov = Number(newAcc.value.originalValue) || Number(bal) || 0
      const rv = Number(newAcc.value.residualValue) || 0
      const um = Number(newAcc.value.usefulMonths) || 36
      if (ov > 0 && um > 0) {
        // Find matching depreciation subject
        const sub = subjectStore.subjects.find(s => s.id === newAcc.value.subjectId)
        let depSubId = 0
        if (sub) {
          const depCodeMap: Record<string, string> = { '131': '151', '13101': '15101', '13102': '15102', '13103': '15103', '13104': '15104' }
          const prefix = sub.code.substring(0, 3)
          const depPrefix = depCodeMap[prefix] || '151'
          const depSub = subjectStore.subjects.find(s => s.code.startsWith(depPrefix) && s.level === 2)
          if (depSub) depSubId = depSub.id
        }
        await svc.create({
          accountId,
          assetName: newAcc.value.name,
          originalValue: ov,
          residualValue: rv,
          usefulMonths: um,
          depreciationSubjectId: depSubId,
          startDate: new Date().toISOString().slice(0, 7),
        })
      }
    }
    showAdd.value = false
    uni.showToast({ title: '添加成功', icon: 'success' })
  } catch (e: any) {
    console.error('添加账户失败:', e)
    uni.showToast({ title: '添加失败: ' + (e.message || '未知错误'), icon: 'none' })
  }
}

function viewDetail(acc: any) {
  uni.navigateTo({ url: `/pages/accounts/detail?id=${acc.id}` })
}

onShow(() => {
  accountStore.load()
})
</script>

<style lang="scss" scoped>
.page-accounts { padding: 18px; }
.page-header { margin-bottom: 18px; }
.page-title { font-family: 'Noto Serif SC', serif; font-size: 22px; font-weight: 700; color: #1C1915; display: block; }
.group { margin-bottom: 15px; }
.group-title {
  font-size: 12px; color: #9E9790; margin-bottom: 8px;
  padding-left: 5px; font-weight: 500; letter-spacing: 0.04em;
}
.acc-item {
  display: flex; justify-content: space-between; align-items: center;
  background: #FDFCF9; border-radius: 6px; padding: 12px;
  margin-bottom: 4px; border: 1px solid #EDE8E0;
  cursor: pointer; transition: background 0.15s;
}
.acc-item:active { background: #F7F4EE; }
.acc-left { display: flex; flex-direction: column; }
.acc-name { font-size: 14px; font-weight: 600; color: #1C1915; }
.acc-type { font-size: 10px; color: #9E9790; margin-top: 2px; }
.acc-balance { font-family: 'DM Mono', monospace; font-size: 14px; font-weight: 500; }
.positive { color: #2D7D7A; }
.negative { color: #C44536; }
.empty { text-align: center; color: #9E9790; padding: 15px; font-size: 13px; }
.add-btn { padding: 10px 0; }
</style>
