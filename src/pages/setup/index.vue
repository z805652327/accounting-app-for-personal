<template>
  <div class="page-setup">
    <div class="header">
      <span class="title">首次资产初始化</span>
      <span class="subtitle">添加你所有的资产和负债账户，填好余额即可，系统自动生成期初分录</span>
    </div>

    <div class="section">
      <div class="section-title">
        <span>资产账户</span>
        <span class="section-hint">存款、现金、投资等</span>
      </div>
      <div v-for="(a, i) in form.accounts" :key="i" class="item-card">
        <div class="item-row">
          <el-input v-model="a.name" placeholder="账户名称，如：招商银行8281" class="input-name" />
          <el-input v-model="a.balance" type="number" placeholder="余额" class="input-balance" />
        </div>
        <div class="item-row">
          <picker :value="a.typeIndex" :range="typeOptions" @change="(e) => onAssetTypeChange(i, e)">
            <div class="picker-text">{{ typeOptions[a.typeIndex] || '选择类型' }}</div>
          </picker>
          <span name="close" color="#C44536" size="18px" @click="form.accounts.splice(i, 1)"></span>
        </div>
        <div v-if="isBankType(a.accountType)" class="item-row-extra">
          <el-input v-model="a.bankName" placeholder="银行名称" class="input-half" />
          <el-input v-model="a.cardLastFour" placeholder="卡号后4位" class="input-half" maxlength="4" />
        </div>
      </div>
      <div class="add-row" @click="addAsset">
        <span name="plus" color="#C44536" size="14px"></span>
        <span class="add-text">添加资产账户</span>
      </div>
    </div>

    <div class="section">
      <div class="section-title">
        <span>负债账户</span>
        <span class="section-hint">信用卡、借款等</span>
      </div>
      <div v-for="(l, i) in form.liabilities" :key="i" class="item-card">
        <div class="item-row">
          <el-input v-model="l.name" placeholder="账户名称" class="input-name" />
          <el-input v-model="l.balance" type="number" placeholder="欠款金额" class="input-balance" />
        </div>
        <div class="item-row">
          <picker :value="l.typeIndex" :range="liabilityTypeOptions" @change="(e) => onLiabTypeChange(i, e)">
            <div class="picker-text">{{ liabilityTypeOptions[l.typeIndex] || '选择类型' }}</div>
          </picker>
          <span name="close" color="#C44536" size="18px" @click="form.liabilities.splice(i, 1)"></span>
        </div>
        <div v-if="l.accountType === 'credit_card'" class="item-row-extra">
          <el-input v-model="l.bankName" placeholder="发卡银行" class="input-half" />
          <el-input v-model="l.cardLastFour" placeholder="卡号后4位" class="input-half" maxlength="4" />
        </div>
      </div>
      <div class="add-row" @click="addLiability">
        <span name="plus" color="#C44536" size="14px"></span>
        <span class="add-text">添加负债账户</span>
      </div>
    </div>

    <div class="summary">
      <span class="summary-text">
        资产：¥{{ formatAmt(totalAssets) }}　负债：¥{{ formatAmt(totalLiabilities) }}　净资产：¥{{ formatAmt(netEquity) }}
      </span>
    </div>

    <el-button type="primary" size="large" class="submit-btn" @click="doSetup" :loading="loading">
      完成初始化
    </el-button>
    <el-button type="default" size="large" class="skip-btn" @click="doSkip">
      跳过引导，先进入 App
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { uni } from '@/uni-shim'
import { ref, reactive, computed, onMounted } from 'vue'
import { getDatabase } from '@/database/factory'
import { SetupService } from '@/services/setup.service'
import { SubjectRepository } from '@/repositories/subject-repo'
import type { AccountType } from '@/types'

const loading = ref(false)

// Account types split for cleaner pickers
const assetTypes: AccountType[] = ['cash', 'checking', 'fixed_deposit', 'money_market',
  'receivable', 'investment', 'fixed_asset', 'prepaid', 'deposit']
const liabilityTypes: AccountType[] = ['credit_card', 'payable', 'loan']

const typeLabels: Record<string, string> = {
  cash: '现金', checking: '活期存款', fixed_deposit: '定期存款',
  money_market: '货币基金', receivable: '应收款', investment: '投资资产',
  fixed_asset: '固定资产', prepaid: '待摊费用', deposit: '押金/保证金',
  credit_card: '信用卡', payable: '应付款', loan: '借款'
}

// Map account type -> L2 subject code
const typeSubjectCode: Record<string, string> = {
  cash: '10100',
  checking: '10201',
  fixed_deposit: '10202',
  money_market: '10300',
  receivable: '11100',
  investment: '12100',
  fixed_asset: '13100',
  prepaid: '14100',
  deposit: '14200',
  credit_card: '20100',
  payable: '20200',
  loan: '21100',
}

function isBankType(t: AccountType) {
  return ['checking', 'fixed_deposit', 'credit_card'].includes(t)
}

interface SetupItem {
  name: string
  accountType: AccountType
  typeIndex: number
  balance: number
  bankName: string
  cardLastFour: string
  subjectId: number
}

function makeAssetItem(typeIdx: number): SetupItem {
  return {
    name: '',
    accountType: assetTypes[typeIdx],
    typeIndex: typeIdx,
    balance: 0,
    bankName: '',
    cardLastFour: '',
    subjectId: 0,
  }
}

function makeLiabItem(typeIdx: number): SetupItem {
  return {
    name: '',
    accountType: liabilityTypes[typeIdx],
    typeIndex: typeIdx,
    balance: 0,
    bankName: '',
    cardLastFour: '',
    subjectId: 0,
  }
}

const typeOptions = computed(() => assetTypes.map(t => typeLabels[t]))
const liabilityTypeOptions = computed(() => liabilityTypes.map(t => typeLabels[t]))

const form = reactive({
  accounts: [makeAssetItem(1)],  // default to 活期存款
  liabilities: [makeLiabItem(0)], // default to 信用卡
})

// Subject code -> id lookup, populated on mount
const subjectCodeMap = ref<Record<string, number>>({})

const totalAssets = computed(() =>
  form.accounts.reduce((s, a) => s + (Number(a.balance) || 0), 0)
)
const totalLiabilities = computed(() =>
  form.liabilities.reduce((s, l) => s + (Number(l.balance) || 0), 0)
)
const netEquity = computed(() => totalAssets.value - totalLiabilities.value)

function formatAmt(n: number) { return n.toFixed(2) }

function resolveSubjectId(item: SetupItem) {
  const code = typeSubjectCode[item.accountType]
  item.subjectId = subjectCodeMap.value[code] || 0
}

function onAssetTypeChange(i: number, e: any) {
  const item = form.accounts[i]
  item.typeIndex = Number(e.detail.value)
  item.accountType = assetTypes[item.typeIndex]
  resolveSubjectId(item)
}

function onLiabTypeChange(i: number, e: any) {
  const item = form.liabilities[i]
  item.typeIndex = Number(e.detail.value)
  item.accountType = liabilityTypes[item.typeIndex]
  resolveSubjectId(item)
}

function addAsset() {
  form.accounts.push(makeAssetItem(1))
}
function addLiability() {
  form.liabilities.push(makeLiabItem(0))
}

function doSkip() {
  uni.switchTab({ url: '/pages/index/index' })
}

async function doSetup() {
  loading.value = true
  try {
    const db = await getDatabase()
    const svc = new SetupService(db)
    await svc.execute({
      accounts: form.accounts.map(a => ({
        name: a.name,
        accountType: a.accountType,
        subjectId: a.subjectId,
        balance: Number(a.balance) || 0,
        bankName: a.bankName || undefined,
        cardLastFour: a.cardLastFour || undefined,
      })),
      liabilities: form.liabilities.map(l => ({
        name: l.name,
        accountType: l.accountType,
        subjectId: l.subjectId,
        balance: Number(l.balance) || 0,
        bankName: l.bankName || undefined,
        cardLastFour: l.cardLastFour || undefined,
      })),
    })
    uni.showToast({ title: '初始化完成', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 1500)
  } catch (e: any) {
    uni.showToast({ title: '初始化失败: ' + (e.message || '未知错误'), icon: 'none' })
  } finally {
    loading.value = false
  }
}

// Load subjects and build code->id map
onMounted(async () => {
  const db = await getDatabase()
  const repo = new SubjectRepository(db)
  const subjects = await repo.findAll()
  for (const s of subjects) {
    subjectCodeMap.value[s.code] = s.id
  }
  // Resolve default items
  for (const a of form.accounts) resolveSubjectId(a)
  for (const l of form.liabilities) resolveSubjectId(l)
})
</script>

<style lang="scss" scoped>
.page-setup { padding: 15px; }
.header { margin-bottom: 15px; }
.title { font-size: 19px; font-weight: bold; display: block; margin-bottom: 6px; }
.subtitle { font-size: 13px; color: #9E9790; line-height: 1.6; }

.section { margin-bottom: 20px; }
.section-title {
  display: flex; align-items: baseline; gap: 8px;
  font-size: 15px; font-weight: bold; margin-bottom: 8px;
  .section-hint { font-size: 11px; color: #bbb; font-weight: normal; }
}

.item-card {
  background: #FDFCF9; border-radius: 7px; padding: 10px;
  margin-bottom: 6px; box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}
.item-row {
  display: flex; gap: 6px; align-items: center; margin-bottom: 5px;
  &:last-child { margin-bottom: 0; }
}
.item-row-extra {
  display: flex; gap: 6px; align-items: center; margin-top: 5px;
  padding-top: 5px; border-top: 1px solid #f5f5f5;
}
.input-name { flex: 3; }
.input-balance { flex: 2; }
.input-half { flex: 1; }

.picker-text {
  font-size: 14px; color: #C44536; padding: 5px 10px;
  background: #FDF4F2; border-radius: 4px; min-width: 80px;
  text-align: center;
}

.add-row {
  display: flex; align-items: center; gap: 4px; padding: 10px 0;
  justify-content: center;
}
.add-text { font-size: 14px; color: #C44536; }

.summary {
  background: #FDFCF9; border-radius: 6px; padding: 10px; margin-bottom: 10px;
}
.summary-text { font-size: 12px; color: #6B6560; }

.submit-btn { margin-top: 5px; }
.skip-btn { margin-top: 10px; }
</style>
