<template>
  <div class="page-list">
    <div v-for="s in list" :key="s.id" class="card">
      <div class="card-header">
        <span class="card-title">摊销计划 #{{ s.id }}</span>
        <span class="card-badge" v-if="!s.isActive">已完成</span>
      </div>
      <div class="card-body">
        <span>总额: ¥{{ s.totalAmount.toFixed(2) }}</span>
        <span>每期: ¥{{ s.amountPerPeriod.toFixed(2) }}</span>
        <span>剩余: {{ s.remainingPeriods }}/{{ s.periods }}期</span>
        <span>开始: {{ s.startDate }}</span>
      </div>
    </div>
    <div v-if="list.length === 0" class="empty">暂无摊销计划</div>
    <el-button type="primary" class="fab" @click="showAdd">+ 新增摊销</el-button>

    <el-dialog v-model="showAddPopup" title="新增摊销计划" width="400px" :close-on-click-modal="false">
      <el-form label-width="80px" size="default">
        <el-form-item label="关联交易">
          <el-input v-model="form.transactionId" type="number" placeholder="关联的交易ID（选填）" />
        </el-form-item>
        <el-form-item label="科目">
          <el-input v-model="form.subjectName" readonly placeholder="点击选择科目" @focus="pickSubject" />
        </el-form-item>
        <el-form-item label="总金额">
          <el-input v-model="form.totalAmount" type="number" placeholder="摊销总金额" />
        </el-form-item>
        <el-form-item label="期数">
          <el-input v-model="form.periods" type="number" placeholder="摊销期数" />
        </el-form-item>
        <el-form-item label="每期金额">
          <el-input v-model="form.amountPerPeriod" type="number" placeholder="自动计算=总额÷期数" />
        </el-form-item>
        <el-form-item label="开始日期">
          <el-input v-model="form.startDate" placeholder="YYYY-MM" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddPopup = false">取消</el-button>
        <el-button type="primary" @click="doAdd">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {  onShow  } from '@/uni-shim'
import { getDatabase } from '@/database/factory'
import { AmortizationService } from '@/services/amortization.service'
import { useSubjectStore } from '@/stores/subjects'
import type { AmortizationSchedule } from '@/types'

const subjectStore = useSubjectStore()
const list = ref<AmortizationSchedule[]>([])
const showAddPopup = ref(false)
const form = ref<any>({})

async function load() {
  const db = await getDatabase()
  const svc = new AmortizationService(db)
  list.value = await svc.findAll()
}

function pickSubject() {
  const items = subjectStore.subjects
    .filter(s => s.level === 2)
    .map(s => ({ label: `${s.code} ${s.name}`, value: s.id }))
  uni.showActionSheet({
    itemList: items.map(i => i.label),
    success: (res) => {
      if (res.tapIndex >= 0) {
        const item = items[res.tapIndex]
        form.value.l3SubjectId = item.value
        form.value.subjectName = item.label
      }
    }
  })
}

function showAdd() {
  form.value = { transactionId: '', l3SubjectId: 0, subjectName: '', totalAmount: '', periods: '', amountPerPeriod: '', startDate: '' }
  showAddPopup.value = true
}

async function doAdd() {
  if (!form.value.totalAmount || !form.value.periods) {
    uni.showToast({ title: '请填写总金额和期数' }); return
  }
  const db = await getDatabase()
  const svc = new AmortizationService(db)
  const periods = Number(form.value.periods)
  const total = Number(form.value.totalAmount)
  await svc.create({
    transactionId: form.value.transactionId ? Number(form.value.transactionId) : undefined,
    l3SubjectId: form.value.l3SubjectId || 0,
    totalAmount: total,
    periods,
    amountPerPeriod: Number(form.value.amountPerPeriod) || Math.round(total / periods * 100) / 100,
    startDate: form.value.startDate || new Date().toISOString().slice(0, 7),
  })
  showAddPopup.value = false
  await load()
  uni.showToast({ title: '创建成功' })
}

onShow(() => { subjectStore.load(); load() })
</script>

<style lang="scss" scoped>
.page-list { padding: 10px; padding-bottom: 60px; }
.card { background: #FDFCF9; border-radius: 6px; padding: 12px; margin-bottom: 8px; }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.card-title { font-size: 15px; font-weight: bold; }
.card-badge { font-size: 11px; color: #9E9790; background: #E8E4DC; padding: 1px 8px; border-radius: 10px; }
.card-body { display: flex; flex-wrap: wrap; gap: 8px; font-size: 12px; color: #6B6560; }
.empty { text-align: center; color: #9E9790; padding: 30px; font-size: 14px; }
.fab { position: fixed; bottom: 70px; left: 15px; right: 15px; width: auto; }
</style>
