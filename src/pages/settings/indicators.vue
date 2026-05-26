<template>
  <div class="page-ind">
    <!-- Evaluate preview -->
    <div class="eval-card" v-if="evaluated.length > 0">
      <div class="eval-title">本月指标（{{ ym }}）</div>
      <div v-for="r in evaluated" :key="r.indicator.id" class="eval-row">
        <span class="eval-name">{{ r.indicator.name }}</span>
        <span class="eval-value">{{ r.value.toFixed(r.indicator.decimalPlaces) }}</span>
      </div>
    </div>

    <!-- Indicator list -->
    <div v-for="ind in indicators" :key="ind.id" class="card">
      <div class="card-hd">
        <span class="card-name">{{ ind.name }}</span>
        <span name="close" color="#C44536" size="14px" @click="doDelete(ind.id)" />
      </div>
      <span class="card-formula">{{ ind.formula }}</span>
      <span class="card-dp">小数位: {{ ind.decimalPlaces }}</span>
    </div>
    <div v-if="indicators.length === 0" class="empty">暂无自定义指标</div>

    <el-button type="primary" class="fab" @click="showAdd = true">+ 添加指标</el-button>

    <!-- Add popup -->
    <el-dialog v-model="showAdd" title="添加自定义指标" width="420px" :close-on-click-modal="false">
      <el-form label-width="60px" size="default">
        <el-form-item label="名称">
          <el-input v-model="form.name" placeholder="如：宠物支出占比" />
        </el-form-item>
        <el-form-item label="分子">
          <el-radio-group v-model="form.leftType" style="margin-bottom:4px">
            <el-radio value="sum">科目汇总</el-radio>
            <el-radio value="totalIncome">总收入</el-radio>
          </el-radio-group>
          <el-input v-if="form.leftType === 'sum'" v-model="form.leftSubjectName" readonly placeholder="点击选择科目" @focus="pickSubject('left')" style="margin-top:4px" />
        </el-form-item>
        <el-form-item label="运算符">
          <el-radio-group v-model="form.operator">
            <el-radio value="/">÷ 除以</el-radio>
            <el-radio value="+">+ 加</el-radio>
            <el-radio value="-">− 减</el-radio>
            <el-radio value="none">无（仅分子）</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="form.operator !== 'none'" label="分母">
          <el-radio-group v-model="form.rightType" style="margin-bottom:4px">
            <el-radio value="sum">科目汇总</el-radio>
            <el-radio value="totalIncome">总收入</el-radio>
            <el-radio value="totalExpense">总支出</el-radio>
            <el-radio value="netAsset">净资产</el-radio>
          </el-radio-group>
          <el-input v-if="form.rightType === 'sum'" v-model="form.rightSubjectName" readonly placeholder="点击选择科目" @focus="pickSubject('right')" style="margin-top:4px" />
        </el-form-item>
        <el-form-item label="小数位">
          <el-input-number v-model="form.decimalPlaces" :min="0" :max="4" style="width:100%" />
        </el-form-item>
      </el-form>
      <div style="background:#F2EFE9;border-radius:6px;padding:8px 12px;margin-bottom:8px;font-family:monospace;font-size:12px;color:#6B6560">
        预览: {{ formulaPreview }}
      </div>
      <template #footer>
        <el-button @click="showAdd = false">取消</el-button>
        <el-button type="primary" @click="doAdd" :loading="saving">保存</el-button>
      </template>
    </el-dialog>

    <div class="btn-row">
      <el-button @click="doRefresh" :loading="evalLoading">刷新指标值</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {  onShow  } from '@/uni-shim'
import { getDatabase } from '@/database/factory'
import { IndicatorService, type IndicatorResult } from '@/services/indicator.service'
import { useSubjectStore } from '@/stores/subjects'
import type { UserIndicator } from '@/types'

const subjectStore = useSubjectStore()
const indicators = ref<UserIndicator[]>([])
const evaluated = ref<IndicatorResult[]>([])
const showAdd = ref(false)
const saving = ref(false)
const evalLoading = ref(false)

const now = new Date()
const ym = computed(() => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)

const form = ref({
  name: '',
  leftType: 'sum' as string,
  leftSubjectId: 0 as number,
  leftSubjectName: '',
  operator: '/' as string,
  rightType: 'totalExpense' as string,
  rightSubjectId: 0 as number,
  rightSubjectName: '',
  decimalPlaces: 2,
})

const formulaPreview = computed(() => {
  let left = ''
  if (form.value.leftType === 'sum' && form.value.leftSubjectId) {
    left = 'SUM(' + (subjectStore.subjects.find(s => s.id === form.value.leftSubjectId)?.code || '?') + ')'
  } else if (form.value.leftType === 'totalIncome') {
    left = 'TOTAL_INCOME'
  } else {
    left = '?'
  }

  if (form.value.operator === 'none') return left

  let right = ''
  if (form.value.rightType === 'sum' && form.value.rightSubjectId) {
    right = 'SUM(' + (subjectStore.subjects.find(s => s.id === form.value.rightSubjectId)?.code || '?') + ')'
  } else if (form.value.rightType === 'totalIncome') {
    right = 'TOTAL_INCOME'
  } else if (form.value.rightType === 'totalExpense') {
    right = 'TOTAL_EXPENSE'
  } else if (form.value.rightType === 'netAsset') {
    right = 'NET_ASSET'
  } else {
    right = '?'
  }

  return left + ' ' + form.value.operator + ' ' + right
})

function pickSubject(side: string) {
  const items = subjectStore.subjects
    .filter(s => s.level === 2)
    .map(s => ({ label: `${s.code} ${s.name}`, value: s.id }))
  uni.showActionSheet({
    itemList: items.map(i => i.label),
    success: (res) => {
      if (res.tapIndex >= 0) {
        const item = items[res.tapIndex]
        if (side === 'left') {
          form.value.leftSubjectId = item.value
          form.value.leftSubjectName = item.label
        } else {
          form.value.rightSubjectId = item.value
          form.value.rightSubjectName = item.label
        }
      }
    }
  })
}

async function load() {
  const db = await getDatabase()
  const svc = new IndicatorService(db)
  indicators.value = await svc.findAll()
}

async function doAdd() {
  if (!form.value.name) { uni.showToast({ title: '请填写指标名称' }); return }
  saving.value = true
  try {
    const db = await getDatabase()
    const svc = new IndicatorService(db)
    await svc.create({
      name: form.value.name,
      formula: formulaPreview.value,
      decimalPlaces: form.value.decimalPlaces,
    })
    uni.showToast({ title: '已添加', icon: 'success' })
    showAdd.value = false
    form.value = { name: '', leftType: 'sum', leftSubjectId: 0, leftSubjectName: '', operator: '/', rightType: 'totalExpense', rightSubjectId: 0, rightSubjectName: '', decimalPlaces: 2 }
    await load()
    await doRefresh()
  } finally {
    saving.value = false
  }
}

async function doDelete(id: number) {
  const db = await getDatabase()
  const svc = new IndicatorService(db)
  await svc.delete(id)
  await load()
}

async function doRefresh() {
  evalLoading.value = true
  try {
    const db = await getDatabase()
    const svc = new IndicatorService(db)
    evaluated.value = await svc.evaluate(now.getFullYear(), now.getMonth() + 1)
  } finally {
    evalLoading.value = false
  }
}

onShow(() => { subjectStore.load(); load(); doRefresh() })
</script>

<style lang="scss" scoped>
.page-ind { padding: 10px; padding-bottom: 60px; }
.eval-card { background: #1C1915; border-radius: 8px; padding: 14px; margin-bottom: 10px; }
.eval-title { color: rgba(255,255,255,0.6); font-size: 12px; margin-bottom: 8px; }
.eval-row { display: flex; justify-content: space-between; padding: 4px 0; }
.eval-name { color: rgba(255,255,255,0.9); font-size: 13px; }
.eval-value { color: #D4A853; font-size: 13px; font-weight: 500; }
.card { background: #FDFCF9; border-radius: 6px; padding: 12px; margin-bottom: 6px; }
.card-hd { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.card-name { font-size: 14px; font-weight: bold; }
.card-formula { font-size: 12px; color: #6B6560; font-family: monospace; }
.card-dp { font-size: 11px; color: #9E9790; margin-top: 2px; }
.empty { text-align: center; color: #9E9790; padding: 30px; }
.fab { margin-top: 10px; width: 100%; }
.btn-row { margin-top: 10px; }
</style>
