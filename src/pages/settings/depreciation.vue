<template>
  <div class="page-list">
    <div v-for="cfg in list" :key="cfg.id" class="card" @click="showActions(cfg)">
      <div class="card-header">
        <span class="card-title">{{ cfg.assetName }}</span>
        <span class="card-badge" v-if="!cfg.isActive">已终止</span>
      </div>
      <div class="card-body">
        <span>原值: ¥{{ cfg.originalValue.toFixed(2) }}</span>
        <span>残值: ¥{{ cfg.residualValue.toFixed(2) }}</span>
        <span>期限: {{ cfg.usefulMonths }}月</span>
        <span>开始: {{ cfg.startDate }}</span>
      </div>
    </div>
    <div v-if="list.length === 0" class="empty">暂无折旧配置</div>
    <el-button type="primary" class="fab" @click="showAdd">+ 新增折旧</el-button>

    <el-dialog v-model="showAddPopup" title="新增折旧配置" width="420px" :close-on-click-modal="false">
      <el-form label-width="80px" size="default">
        <el-form-item label="资产账户">
          <el-input v-model="form.assetAccountName" readonly placeholder="点击选择固定资产账户" @focus="pickAssetAccount" />
        </el-form-item>
        <el-form-item label="资产名称">
          <el-input v-model="form.assetName" placeholder="如：联想笔记本" />
        </el-form-item>
        <el-form-item label="原值">
          <el-input v-model="form.originalValue" type="number" placeholder="购买价格" />
        </el-form-item>
        <el-form-item label="残值">
          <el-input v-model="form.residualValue" type="number" placeholder="预计残值" />
        </el-form-item>
        <el-form-item label="使用月数">
          <el-input v-model="form.usefulMonths" type="number" placeholder="如：36" />
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

    <el-dialog v-model="showEditPopup" title="修改折旧配置" width="380px" :close-on-click-modal="false">
      <div style="font-size:12px;color:#9E9790;margin-bottom:10px">修改仅影响剩余期间，不追溯已提折旧</div>
      <el-form label-width="80px" size="default">
        <el-form-item label="新残值">
          <el-input v-model="editForm.residualValue" type="number" placeholder="新残值" />
        </el-form-item>
        <el-form-item label="新月数">
          <el-input v-model="editForm.usefulMonths" type="number" placeholder="新使用月数" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditPopup = false">取消</el-button>
        <el-button type="primary" @click="doEdit" :loading="editing">保存修改</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { uni } from '@/uni-shim'
import { ref, onMounted } from 'vue'
import { getDatabase } from '@/database/factory'
import { DepreciationService } from '@/services/depreciation.service'
import { useAccountStore } from '@/stores/accounts'
import { useSubjectStore } from '@/stores/subjects'
import type { DepreciationConfig } from '@/types'

const accountStore = useAccountStore()
const subjectStore = useSubjectStore()
const list = ref<DepreciationConfig[]>([])
const showAddPopup = ref(false)
const showEditPopup = ref(false)
const editing = ref(false)
const form = ref<any>({})
const editForm = ref<any>({})
const editingCfgId = ref(0)

async function load() {
  try {
    const db = await getDatabase()
    const svc = new DepreciationService(db)
    list.value = await svc.findAll()
    console.log('Depreciation configs loaded:', list.value.length)
  } catch (e) {
    console.error('Depreciation load error:', e)
  }
}

async function showActions(cfg: DepreciationConfig) {
  const actions = ['修改', '终止']
  if (!cfg.isActive) return
  uni.showActionSheet({ itemList: actions, success: async (res) => {
    if (res.tapIndex === 0) {
      editingCfgId.value = cfg.id
      editForm.value = {
        residualValue: String(cfg.residualValue),
        usefulMonths: String(cfg.usefulMonths),
      }
      showEditPopup.value = true
    } else if (res.tapIndex === 1) {
      uni.showModal({ title: '确认', content: `终止 ${cfg.assetName} 的折旧？`, success: async (r) => {
        if (r.confirm) {
          const db = await getDatabase()
          const svc = new DepreciationService(db)
          await svc.terminate(cfg.id)
          await load()
          uni.showToast({ title: '已终止' })
        }
      }})
    }
  }})
}

function pickAssetAccount() {
  const items = accountStore.accounts
    .filter(a => a.accountType === 'fixed_asset')
    .map(a => ({ label: `${a.name}`, value: a.id }))
  if (items.length === 0) {
    uni.showToast({ title: '暂无固定资产账户，请先在账户页面添加' })
    return
  }
  uni.showActionSheet({
    itemList: items.map(i => i.label),
    success: (res) => {
      if (res.tapIndex >= 0) {
        const acc = items[res.tapIndex]
        form.value.accountId = acc.value
        form.value.assetAccountName = acc.label
        form.value.assetName = acc.label
      }
    }
  })
}

function showAdd() {
  form.value = { accountId: 0, assetAccountName: '', assetName: '', originalValue: '0', residualValue: '0', usefulMonths: '36', startDate: '', depreciationSubjectId: 0 }
  showAddPopup.value = true
}

async function doAdd() {
  if (!form.value.accountId) { uni.showToast({ title: '请先选择资产账户' }); return }
  const db = await getDatabase()
  const svc = new DepreciationService(db)
  // Auto-resolve depreciation subject: find the matching 累计折旧 subject under 151xx
  const acc = accountStore.accounts.find(a => a.id === form.value.accountId)
  let depSubId = 0
  if (acc) {
    // Map account type subject code → depreciation subject code
    // 131 (fixed_asset) → 151 (累计折旧)
    const depCodeMap: Record<string, string> = { '131': '151', '13101': '15101', '13102': '15102', '13103': '15103', '13104': '15104' }
    const sub = subjectStore.subjects.find(s => s.id === acc.subjectId)
    if (sub) {
      const prefix = sub.code.substring(0, 3)
      const depPrefix = depCodeMap[prefix] || '151'
      const depSub = subjectStore.subjects.find(s => s.code.startsWith(depPrefix) && s.level === 2)
      if (depSub) depSubId = depSub.id
    }
  }
  await svc.create({
    accountId: Number(form.value.accountId),
    assetName: form.value.assetName || form.value.assetAccountName,
    originalValue: Number(form.value.originalValue) || 0,
    residualValue: Number(form.value.residualValue) || 0,
    usefulMonths: Number(form.value.usefulMonths) || 36,
    depreciationSubjectId: depSubId,
    startDate: form.value.startDate || new Date().toISOString().slice(0, 7),
  })
  showAddPopup.value = false
  await load()
  uni.showToast({ title: '创建成功' })
}

async function doEdit() {
  const res = await uni.showModal({
    title: '确认修改',
    content: `修改后剩余期间月折旧额将重新计算。确认修改？`,
  })
  if (!res.confirm) return
  editing.value = true
  try {
    const db = await getDatabase()
    const svc = new DepreciationService(db)
    await svc.update(editingCfgId.value, {
      residualValue: editForm.value.residualValue ? Number(editForm.value.residualValue) : undefined,
      usefulMonths: editForm.value.usefulMonths ? parseInt(editForm.value.usefulMonths) : undefined,
    })
    showEditPopup.value = false
    await load()
    uni.showToast({ title: '修改成功', icon: 'success' })
  } catch (e: any) {
    uni.showToast({ title: e.message || '修改失败', icon: 'none' })
  } finally {
    editing.value = false
  }
}


import {  onShow  } from '@/uni-shim'
onShow(() => { accountStore.load(); subjectStore.load(); load() })
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
.pf-hint { font-size: 11px; color: #9E9790; display: block; margin-bottom: 8px; }
.popup-form :deep(.u-input) { margin-bottom: 8px; }
</style>
