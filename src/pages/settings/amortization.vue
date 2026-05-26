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

    <el-dialog v-model="showAddPopup" @close="showAddPopup = false">
      <div class="popup-form">
        <div class="pf-title">新增摊销计划</div>
        <el-input v-model="form.transactionId" type="number" placeholder="关联交易ID" />
        <el-input v-model="form.l3SubjectId" type="number" placeholder="L3科目ID" />
        <el-input v-model="form.totalAmount" type="number" placeholder="总金额" />
        <el-input v-model="form.periods" type="number" placeholder="摊销期数" />
        <el-input v-model="form.amountPerPeriod" type="number" placeholder="每期金额" />
        <el-input v-model="form.startDate" placeholder="开始日期 YYYY-MM" />
        <el-button type="primary" @click="doAdd">保存</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {  onShow  } from '@/uni-shim'
import { getDatabase } from '@/database/factory'
import { AmortizationService } from '@/services/amortization.service'
import type { AmortizationSchedule } from '@/types'

const list = ref<AmortizationSchedule[]>([])
const showAddPopup = ref(false)
const form = ref<any>({})

async function load() {
  const db = await getDatabase()
  const svc = new AmortizationService(db)
  list.value = await svc.findAll()
}

function showAdd() {
  form.value = { transactionId: 0, l3SubjectId: 0, totalAmount: 0, periods: 0, amountPerPeriod: 0, startDate: '' }
  showAddPopup.value = true
}

async function doAdd() {
  const db = await getDatabase()
  const svc = new AmortizationService(db)
  await svc.create({
    transactionId: Number(form.value.transactionId),
    l3SubjectId: Number(form.value.l3SubjectId),
    totalAmount: Number(form.value.totalAmount),
    periods: Number(form.value.periods),
    amountPerPeriod: Number(form.value.amountPerPeriod),
    startDate: form.value.startDate,
  })
  showAddPopup.value = false
  await load()
  uni.showToast({ title: '创建成功' })
}

onShow(() => load())
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
.popup-form { padding: 15px; width: 300px; }
.pf-title { font-size: 16px; font-weight: bold; margin-bottom: 10px; text-align: center; }
.popup-form :deep(.u-input) { margin-bottom: 8px; }
</style>
