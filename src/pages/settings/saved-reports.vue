<template>
  <div class="page-rpt">
    <div v-for="rpt in reports" :key="rpt.id" class="card">
      <div class="card-hd">
        <div class="hd-left">
          <span v-if="rpt.isPinned" class="pin-badge">置顶</span>
          <span class="card-name">{{ rpt.name }}</span>
        </div>
        <div class="hd-actions">
          <span class="act" @click="doTogglePin(rpt)">{{ rpt.isPinned ? '取消置顶' : '置顶' }}</span>
          <span name="close" color="#C44536" size="14px" @click="doDelete(rpt.id)" />
        </div>
      </div>
      <div class="card-meta">
        <span class="meta-item">排序: {{ rpt.sortField }}</span>
        <span class="meta-item">字段: {{ fmtFields(rpt) }}</span>
      </div>
      <div class="card-filters">{{ fmtFilters(rpt) }}</div>
    </div>
    <div v-if="reports.length === 0" class="empty">暂无自定义报表</div>

    <el-button type="primary" class="fab" @click="showAdd = true">+ 保存当前筛选为报表</el-button>

    <el-dialog v-model="showAdd" title="保存自定义报表" width="420px" :close-on-click-modal="false">
      <el-form label-width="70px" size="default">
        <el-form-item label="名称">
          <el-input v-model="form.name" placeholder="如：本月旅游开销" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="form.txType" style="width:100%">
            <el-option label="支出" value="expense" />
            <el-option label="收入" value="income" />
            <el-option label="全部" value="" />
          </el-select>
        </el-form-item>
        <el-form-item label="科目">
          <div class="tag-picker">
            <span v-for="(code, idx) in form.subjectCodes" :key="idx" class="tag-chip" @click="removeSubject(idx)">
              {{ getSubjectLabel(code) }} ✕
            </span>
            <el-button size="small" @click="pickSubjects">+ 选择科目</el-button>
          </div>
        </el-form-item>
        <el-form-item label="排序">
          <el-select v-model="form.sortField" style="width:100%">
            <el-option label="日期降序" value="tx_date DESC" />
            <el-option label="日期升序" value="tx_date ASC" />
            <el-option label="金额降序" value="amount DESC" />
            <el-option label="金额升序" value="amount ASC" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAdd = false">取消</el-button>
        <el-button type="primary" @click="doAdd" :loading="saving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {  onShow  } from '@/uni-shim'
import { getDatabase } from '@/database/factory'
import { SavedReportService } from '@/services/saved-report.service'
import { useSubjectStore } from '@/stores/subjects'
import type { SavedReport } from '@/types'

const subjectStore = useSubjectStore()
const reports = ref<SavedReport[]>([])
const showAdd = ref(false)
const saving = ref(false)
const form = ref({ name: '', subjectCodes: [] as string[], txType: 'expense', sortField: 'tx_date DESC' })

function getSubjectLabel(code: string): string {
  const sub = subjectStore.subjects.find(s => s.code === code)
  return sub ? `${sub.code} ${sub.name}` : code
}

function pickSubjects() {
  const items = subjectStore.subjects
    .filter(s => s.level === 2)
    .map(s => ({ label: `${s.code} ${s.name}`, value: s.code }))
  uni.showActionSheet({
    itemList: items.map(i => i.label),
    title: '选择科目（可多次添加）',
    success: (res) => {
      if (res.tapIndex >= 0) {
        const code = items[res.tapIndex].value
        if (!form.value.subjectCodes.includes(code)) {
          form.value.subjectCodes.push(code)
        }
      }
    }
  })
}

function removeSubject(idx: number) {
  form.value.subjectCodes.splice(idx, 1)
}

async function load() {
  const db = await getDatabase()
  const svc = new SavedReportService(db)
  reports.value = await svc.findAll()
}

async function doAdd() {
  if (!form.value.name) { uni.showToast({ title: '请输入报表名称' }); return }
  saving.value = true
  try {
    const db = await getDatabase()
    const svc = new SavedReportService(db)
    await svc.create({
      name: form.value.name,
      filters: {
        subjects: form.value.subjectCodes,
        dateRange: 'thisMonth',
        type: form.value.txType || '',
      },
      sortField: form.value.sortField || 'tx_date DESC',
    })
    uni.showToast({ title: '已保存', icon: 'success' })
    showAdd.value = false
    form.value = { name: '', subjectCodes: [], txType: 'expense', sortField: 'tx_date DESC' }
    await load()
  } finally { saving.value = false }
}

async function doDelete(id: number) {
  const db = await getDatabase()
  const svc = new SavedReportService(db)
  await svc.delete(id)
  await load()
}

async function doTogglePin(rpt: SavedReport) {
  const db = await getDatabase()
  const svc = new SavedReportService(db)
  await svc.togglePin(rpt.id)
  await load()
}

function fmtFields(rpt: SavedReport): string {
  try { return (JSON.parse(rpt.displayFields) as string[]).join(', ') } catch { return '—' }
}

function fmtFilters(rpt: SavedReport): string {
  try {
    const f = JSON.parse(rpt.filters)
    const parts: string[] = []
    if (f.subjects?.length) parts.push('科目: ' + f.subjects.join(','))
    if (f.type) parts.push('类型: ' + f.type)
    if (f.dateRange) parts.push('日期: ' + f.dateRange)
    return parts.join(' · ') || '无筛选条件'
  } catch { return '格式错误' }
}

onShow(() => { subjectStore.load(); load() })
</script>

<style lang="scss" scoped>
.page-rpt { padding: 10px; padding-bottom: 60px; }
.card { background: #FDFCF9; border-radius: 6px; padding: 12px; margin-bottom: 6px; }
.card-hd { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.hd-left { display: flex; align-items: center; gap: 5px; }
.pin-badge { font-size: 10px; background: #FFF3E0; color: #FF9500; padding: 1px 6px; border-radius: 10px; }
.card-name { font-size: 14px; font-weight: bold; }
.hd-actions { display: flex; align-items: center; gap: 10px; }
.act { font-size: 12px; color: #C44536; }
.card-meta { display: flex; gap: 10px; font-size: 11px; color: #9E9790; margin-bottom: 2px; }
.meta-item { font-family: monospace; }
.card-filters { font-size: 12px; color: #6B6560; margin-top: 3px; }
.empty { text-align: center; color: #9E9790; padding: 30px; }
.fab { margin-top: 10px; width: 100%; }
.tag-picker { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.tag-chip { display: inline-block; background: #EDF6F5; color: #2D7D7A; font-size: 12px; padding: 4px 10px; border-radius: 14px; cursor: pointer; }
.tag-chip:hover { background: #d0e8e6; }
</style>
