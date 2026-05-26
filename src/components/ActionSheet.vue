<template>
  <teleport to="body">
    <div v-if="visible" class="as-overlay" @click="dismiss">
      <div class="as-sheet animate-up" @click.stop>
        <div class="as-header">
          <span class="as-title">{{ title }}</span>
        </div>
        <div class="as-list">
          <div
            v-for="(item, idx) in items"
            :key="idx"
            class="as-item"
            @click="select(idx)"
          >
            <span class="as-item-text">{{ item }}</span>
          </div>
        </div>
        <div class="as-footer">
          <div class="as-cancel" @click="dismiss">取消</div>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { actionSheetState } from '@/stores/dialogs'

const visible = computed(() => actionSheetState.visible)
const title = computed(() => actionSheetState.title)
const items = computed(() => actionSheetState.items)

function select(idx: number) {
  actionSheetState.visible = false
  if (actionSheetState.resolve) {
    actionSheetState.resolve(idx)
    actionSheetState.resolve = null
  }
}

function dismiss() {
  actionSheetState.visible = false
  if (actionSheetState.resolve) {
    actionSheetState.resolve(-1)
    actionSheetState.resolve = null
  }
}
</script>

<style scoped>
.as-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.45);
  z-index: 10000; display: flex; align-items: flex-end; justify-content: center;
}
.as-sheet {
  width: 100%; max-width: 500px; background: #FDFCF9;
  border-radius: 16px 16px 0 0; padding-bottom: env(safe-area-inset-bottom, 8px);
  max-height: 70vh; overflow-y: auto;
}
.as-header {
  padding: 16px 20px 12px; text-align: center;
  border-bottom: 1px solid #EDE8E0;
}
.as-title {
  font-size: 14px; color: #9E9790; font-weight: 500;
}
.as-list {
  padding: 4px 0;
}
.as-item {
  padding: 14px 20px; cursor: pointer; transition: background 0.15s;
  border-bottom: 1px solid #f5f2ec;
}
.as-item:active { background: #F2EFE9; }
.as-item-text {
  font-size: 15px; color: #1C1915;
}
.as-footer {
  padding: 8px 16px;
}
.as-cancel {
  text-align: center; padding: 12px; background: #F2EFE9;
  border-radius: 8px; font-size: 15px; color: #6B6560;
  cursor: pointer; font-weight: 500;
}
.as-cancel:active { background: #E8E4DC; }

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.animate-up { animation: slideUp 0.25s cubic-bezier(0.22, 1, 0.36, 1); }
</style>
