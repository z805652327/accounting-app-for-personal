<template>
  <div class="page-subjects">
    <div v-for="l1 in subjectStore.tree" :key="l1.id" class="l1-group">
      <div class="l1-title">{{ l1.code }} {{ l1.name }}</div>
      <div v-for="l2 in l1.children" :key="l2.id" class="l2-item">
        <div class="l2-row">
          <span class="l2-title">{{ l2.code }} {{ l2.name }}</span>
          <span class="l2-add" @click="startAddL3(l2)">+ 添加三级</span>
        </div>
        <div v-for="l3 in l2.children" :key="l3.id" class="l3-item">
          <span class="l3-code">{{ l3.code }}</span>
          <span :class="['l3-name', { 'l3-inactive': !l3.isActive }]">{{ l3.name }}</span>
          <span v-if="l3.id < 0" class="l3-badge l3-badge-account">账户</span>
          <span v-if="!l3.isActive && l3.id > 0" class="l3-badge">已停用</span>
          <div class="l3-actions" v-if="l3.id > 0 && !l3.isSystem">
            <span
              :class="['l3-toggle', l3.isActive ? 'toggle-off' : 'toggle-on']"
              @click="toggleL3(l3)"
            >{{ l3.isActive ? '停用' : '启用' }}</span>
          </div>
        </div>
        <div v-if="l2.children.length === 0" class="l3-empty">暂无三级明细</div>

        <!-- Inline add L3 form -->
        <div v-if="addingFor === l2.id" class="add-form">
          <el-input v-model="newL3Name" placeholder="输入三级明细名称" border="surround" />
          <div class="add-form-actions">
            <el-button size="small" @click="cancelAdd">取消</el-button>
            <el-button type="primary" size="small" :loading="addLoading" @click="doAddL3">确认</el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {  onShow  } from '@/uni-shim'
import { useSubjectStore, type SubjectTreeNode } from '@/stores/subjects'
import { getDatabase } from '@/database/factory'
import { SubjectRepository } from '@/repositories/subject-repo'
import type { AccountingSubject } from '@/types'

const subjectStore = useSubjectStore()

const addingFor = ref(0)
const newL3Name = ref('')
const addLoading = ref(false)

onShow(() => subjectStore.loadWithAccounts())

function startAddL3(l2: SubjectTreeNode) {
  addingFor.value = l2.id
  newL3Name.value = ''
}

function cancelAdd() {
  addingFor.value = 0
  newL3Name.value = ''
}

async function doAddL3() {
  if (!newL3Name.value.trim()) {
    uni.showToast({ title: '请输入名称', icon: 'none' })
    return
  }
  addLoading.value = true
  try {
    const parent = subjectStore.getById(addingFor.value)
    if (!parent) throw new Error('父科目不存在')

    const db = await getDatabase()
    const repo = new SubjectRepository(db)
    const code = await repo.getNextL3Code(parent.code)
    await repo.createL3({
      code,
      name: newL3Name.value.trim(),
      parentId: parent.id,
      subjectType: parent.subjectType,
      expenseType: parent.expenseType ?? undefined,
      cashFlowCategory: parent.cashFlowCategory ?? undefined,
    })
    uni.showToast({ title: `已添加 ${code}`, icon: 'success' })
    cancelAdd()
    await subjectStore.loadWithAccounts()
  } catch (e: any) {
    uni.showToast({ title: e.message || '添加失败', icon: 'none' })
  } finally {
    addLoading.value = false
  }
}

async function toggleL3(l3: AccountingSubject) {
  const newState = !l3.isActive
  const action = newState ? '启用' : '停用'
  const res = await uni.showModal({
    title: `确认${action}`,
    content: newState
      ? `启用后 "${l3.name}" 可在新交易中选择。`
      : `停用后 "${l3.name}" 将不再出现在科目选择器中，已有交易不受影响。`,
  })
  if (!res.confirm) return

  const db = await getDatabase()
  const repo = new SubjectRepository(db)
  await repo.toggleActive(l3.id, newState)
  // Directly update the subject in the store for immediate UI feedback
  const sub = subjectStore.subjects.find(s => s.id === l3.id)
  if (sub) sub.isActive = newState
  uni.showToast({ title: `已${action}`, icon: 'success' })
  await subjectStore.loadWithAccounts()
}
</script>

<style lang="scss" scoped>
.page-subjects { padding: 10px; }
.l1-group { margin-bottom: 15px; }
.l1-title {
  font-size: 16px; font-weight: bold; padding: 8px;
  background: #E8E4DC; border-radius: 4px; margin-bottom: 5px;
}
.l2-item { padding-left: 10px; margin-bottom: 8px; }
.l2-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; }
.l2-title {
  font-size: 14px; font-weight: bold; color: #C44536;
  border-bottom: 1px solid #EDE8E0; margin-bottom: 4px; flex: 1;
}
.l2-add { font-size: 12px; color: #C44536; }
.l3-item {
  display: flex; padding: 4px 0; padding-left: 10px;
  font-size: 13px; align-items: center; gap: 4px;
}
.l3-code { color: #9E9790; width: 65px; flex-shrink: 0; }
.l3-name { flex: 1; }
.l3-inactive { color: #9E9790; text-decoration: line-through; }
.l3-badge { font-size: 10px; color: #E08900; background: #FFF5EB; padding: 1px 6px; border-radius: 10px; flex-shrink: 0; }
.l3-badge-account { color: #2D7D7A; background: #EDF6F5; }
.l3-actions { flex-shrink: 0; }
.l3-toggle { font-size: 11px; padding: 2px 8px; border-radius: 10px; }
.toggle-off { color: #FF9500; background: #FFF3E0; }
.toggle-on { color: #2D7D7A; background: #EDF6F5; }
.l3-empty { padding-left: 10px; color: #9E9790; font-size: 12px; }
.add-form { padding: 8px 0 0 10px; }
.add-form-actions { display: flex; gap: 6px; margin-top: 6px; justify-content: flex-end; }
</style>
