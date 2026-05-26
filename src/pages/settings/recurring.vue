<template>
  <div class="page-list">
    <div v-for="rule in rules" :key="rule.id" :class="['card', { 'card-paused': !rule.isActive }]">
      <div class="card-header">
        <div class="card-title-row">
          <span class="card-title">{{ rule.name }}</span>
          <span v-if="!rule.isActive" class="paused-badge">已暂停</span>
        </div>
        <div class="card-actions">
          <span class="action-toggle" @click="doToggle(rule)">
            {{ rule.isActive ? '暂停' : '启用' }}
          </span>
          <span name="close" color="#C44536" size="14px" @click="doRemove(rule.id)"></span>
        </div>
      </div>
      <div class="card-body">
        <span class="body-item">类型: {{ txTypeNames[rule.txType] || rule.txType }}</span>
        <span class="body-item">金额: ¥{{ rule.amount.toFixed(2) }}</span>
        <span class="body-item">频率: {{ freqLabels[rule.frequency] }}</span>
        <span class="body-item">科目: {{ getSubjectName(rule.subjectId) }}</span>
        <span v-if="rule.accountId" class="body-item">账户: {{ getAccountName(rule.accountId) }}</span>
      </div>
      <div class="card-footer">
        <span class="footer-date">起: {{ rule.startDate }}</span>
        <span v-if="rule.endDate" class="footer-date">止: {{ rule.endDate }}</span>
        <span v-if="rule.lastGenerated" class="footer-date">上次: {{ rule.lastGenerated }}</span>
      </div>
    </div>
    <div v-if="rules.length === 0" class="empty">暂无定期记账规则</div>
    <el-button type="primary" class="fab" @click="showAdd = true">+ 新增规则</el-button>

    <el-dialog v-model="showAdd" @close="showAdd = false">
      <div class="popup-form">
        <div class="pf-title">新增定期记账</div>
        <el-input v-model="form.name" placeholder="描述（如：每月房租）" />
        <el-input v-model="form.amount" type="number" placeholder="金额" />

        <picker :value="txTypeIndex" :range="txTypeOptions" @change="onTxTypeChange">
          <div class="picker">类型：{{ txTypeOptions[txTypeIndex] }}</div>
        </picker>
        <picker :value="freqIndex" :range="freqOptions" @change="onFreqChange">
          <div class="picker">频率：{{ freqOptions[freqIndex] }}</div>
        </picker>

        <el-input v-model="subjectName" readonly placeholder="选择科目" @focus="pickSubject()" />
        <el-input v-model="accountName" readonly placeholder="选择账户" @focus="pickAccount()" />
        <el-input v-model="toAccountName" readonly placeholder="目标账户(转账时填)" @focus="pickToAccount()" />
        <el-input v-model="form.note" placeholder="备注(选填)" />
        <el-input v-model="form.startDate" placeholder="生效日期 YYYY-MM-DD" />
        <el-input v-model="form.endDate" placeholder="结束日期(选填) YYYY-MM-DD" />

        <el-button type="primary" @click="doAdd" :loading="saving">保存</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {  onShow  } from '@/uni-shim'
import { getDatabase } from '@/database/factory'
import { RecurringService, type RecurringRule } from '@/services/recurring.service'
import { useSubjectStore } from '@/stores/subjects'
import { useAccountStore } from '@/stores/accounts'

const subjectStore = useSubjectStore()
const accountStore = useAccountStore()

const rules = ref<RecurringRule[]>([])
const showAdd = ref(false)
const saving = ref(false)

const txTypes = ['income', 'expense', 'transfer', 'loan_receive', 'loan_repay']
const txTypeNames: Record<string, string> = {
  income: '收入', expense: '支出', transfer: '转账',
  loan_receive: '借款', loan_repay: '还款',
}
const txTypeIndex = ref(1)
const txTypeOptions = txTypes.map(t => txTypeNames[t])

const freqLabels: Record<string, string> = { monthly: '每月', quarterly: '每季', yearly: '每年' }
const freqOptions = ['每月', '每季', '每年']
const freqValues = ['monthly', 'quarterly', 'yearly']
const freqIndex = ref(0)

const form = ref<Record<string, string>>({})
const subjectName = ref('')
const accountName = ref('')
const toAccountName = ref('')

function pickSubject() {
  const items = subjectStore.subjects
    .filter(s => s.level === 2)
    .map(s => ({ label: `${s.code} ${s.name}`, value: s.id }))
  uni.showActionSheet({
    itemList: items.map(i => i.label),
    success: (res) => {
      if (res.tapIndex >= 0) {
        const item = items[res.tapIndex]
        form.value.subjectId = String(item.value)
        subjectName.value = item.label
      }
    }
  })
}

function pickAccount(filter?: string) {
  const items = accountStore.accounts
    .filter(a => !filter || a.accountType === filter)
    .map(a => ({ label: `${a.name}`, value: a.id }))
  uni.showActionSheet({
    itemList: items.map(i => i.label),
    success: (res) => {
      if (res.tapIndex >= 0) {
        const item = items[res.tapIndex]
        if (!form.value.accountId) {
          form.value.accountId = String(item.value)
          accountName.value = item.label
        } else {
          form.value.toAccountId = String(item.value)
          toAccountName.value = item.label
        }
      }
    }
  })
}

function pickToAccount() {
  const items = accountStore.accounts
    .filter(a => a.id !== Number(form.value.accountId || 0))
    .map(a => ({ label: `${a.name}`, value: a.id }))
  uni.showActionSheet({
    itemList: items.map(i => i.label),
    success: (res) => {
      if (res.tapIndex >= 0) {
        const item = items[res.tapIndex]
        form.value.toAccountId = String(item.value)
        toAccountName.value = item.label
      }
    }
  })
}

async function load() {
  const db = await getDatabase()
  const svc = new RecurringService(db)
  rules.value = await svc.findAll()
  await subjectStore.load()
  await accountStore.load()
}

function getSubjectName(id: number): string {
  const sub = subjectStore.subjects.find(s => s.id === id)
  return sub ? sub.name : `#${id}`
}

function getAccountName(id: number): string {
  const acc = accountStore.accounts.find(a => a.id === id)
  return acc ? acc.name : `#${id}`
}

function onTxTypeChange(e: any) { txTypeIndex.value = e.detail.value }
function onFreqChange(e: any) { freqIndex.value = e.detail.value }

async function doAdd() {
  saving.value = true
  try {
    const db = await getDatabase()
    const svc = new RecurringService(db)
    await svc.create({
      name: form.value.name || '未命名规则',
      txType: txTypes[txTypeIndex.value],
      amount: Number(form.value.amount) || 0,
      subjectId: Number(form.value.subjectId) || 0,
      l3SubjectId: form.value.l3SubjectId ? Number(form.value.l3SubjectId) : null,
      accountId: form.value.accountId ? Number(form.value.accountId) : null,
      toAccountId: form.value.toAccountId ? Number(form.value.toAccountId) : null,
      note: form.value.note || null,
      frequency: freqValues[freqIndex.value],
      startDate: form.value.startDate || new Date().toISOString().slice(0, 10),
      endDate: form.value.endDate || null,
    })
    uni.showToast({ title: '已添加', icon: 'success' })
    showAdd.value = false
    form.value = {}
    await load()
  } catch (e: any) {
    uni.showToast({ title: e.message || '保存失败', icon: 'none' })
  } finally {
    saving.value = false
  }
}

async function doToggle(rule: RecurringRule) {
  const db = await getDatabase()
  const svc = new RecurringService(db)
  await svc.toggleActive(rule.id, !rule.isActive)
  uni.showToast({ title: rule.isActive ? '已暂停' : '已启用', icon: 'success' })
  await load()
}

async function doRemove(id: number) {
  const res = await uni.showModal({
    title: '确认删除', content: '确定要删除此定期记账规则吗？',
  })
  if (!res.confirm) return
  const db = await getDatabase()
  const svc = new RecurringService(db)
  await svc.delete(id)
  uni.showToast({ title: '已删除', icon: 'success' })
  await load()
}

onShow(() => load())
</script>

<style lang="scss" scoped>
.page-list { padding: 10px; padding-bottom: 60px; }
.card { background: #FDFCF9; border-radius: 6px; padding: 10px; margin-bottom: 6px; }
.card-paused { opacity: 0.6; }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }
.card-title-row { display: flex; align-items: center; gap: 6px; }
.card-title { font-size: 14px; font-weight: bold; }
.paused-badge { font-size: 10px; color: #FF9500; background: #FFF3E0; padding: 1px 6px; border-radius: 10px; }
.card-actions { display: flex; align-items: center; gap: 8px; }
.action-toggle { font-size: 12px; color: #C44536; }
.card-body { display: flex; flex-wrap: wrap; gap: 5px; font-size: 12px; color: #6B6560; }
.body-item { background: #F2EFE9; padding: 2px 7px; border-radius: 4px; }
.card-footer { display: flex; gap: 8px; margin-top: 5px; }
.footer-date { font-size: 11px; color: #9E9790; }
.empty { text-align: center; color: #9E9790; padding: 30px; font-size: 14px; }
.fab { position: fixed; bottom: 70px; left: 15px; right: 15px; width: auto; }
.popup-form { padding: 15px; width: 300px; }
.pf-title { font-size: 16px; font-weight: bold; margin-bottom: 10px; text-align: center; }
.popup-form :deep(.u-input) { margin-bottom: 8px; }
.picker { font-size: 14px; padding: 10px 0; color: #1C1915; }
</style>
