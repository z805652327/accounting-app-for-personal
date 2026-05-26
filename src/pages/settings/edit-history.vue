<template>
  <div class="page-history">
    <div v-for="h in list" :key="h.id" class="card" @click="showChanges(h)">
      <div class="card-row">
        <span class="h-reason">{{ h.changeReason === 'user_edit' ? '用户编辑' : h.changeReason === 'user_delete' ? '用户删除' : h.changeReason }}</span>
        <span class="h-time">{{ h.createdAt }}</span>
      </div>
      <span class="h-txid">交易 #{{ h.transactionId }}</span>
    </div>
    <div v-if="list.length === 0" class="empty">暂无编辑历史</div>

    <el-dialog v-model="showPopup" @close="showPopup = false">
      <div class="popup-box">
        <div class="popup-title">变更详情</div>
        <div v-for="(v, k) in selectedChanges" :key="k" class="change-item">
          <span class="change-field">{{ k }}</span>
          <span class="change-old">旧: {{ v.old }}</span>
          <span class="change-new">新: {{ v.new }}</span>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {  onShow  } from '@/uni-shim'
import { getDatabase } from '@/database/factory'
import type { EditHistory } from '@/types'

const list = ref<EditHistory[]>([])
const showPopup = ref(false)
const selectedChanges = ref<Record<string, any>>({})

onShow(async () => {
  const db = await getDatabase()
  list.value = await db.query<EditHistory>(
    'SELECT * FROM edit_history ORDER BY created_at DESC LIMIT 100'
  )
})

function showChanges(h: EditHistory) {
  selectedChanges.value = JSON.parse(h.changes)
  showPopup.value = true
}
</script>

<style lang="scss" scoped>
.page-history { padding: 10px; }
.card { background: #FDFCF9; border-radius: 6px; padding: 10px; margin-bottom: 5px; }
.card-row { display: flex; justify-content: space-between; align-items: center; }
.h-reason { font-size: 14px; }
.h-time { font-size: 11px; color: #9E9790; }
.h-txid { font-size: 11px; color: #C44536; margin-top: 3px; display: block; }
.empty { text-align: center; color: #9E9790; padding: 30px; font-size: 14px; }
.popup-box { padding: 15px; width: 275px; }
.popup-title { font-size: 15px; font-weight: bold; margin-bottom: 8px; text-align: center; }
.change-item { display: flex; flex-direction: column; padding: 4px 0; border-bottom: 1px solid #EDE8E0; }
.change-field { font-size: 13px; font-weight: bold; color: #C44536; }
.change-old { font-size: 12px; color: #C44536; }
.change-new { font-size: 12px; color: #2D7D7A; }
</style>
