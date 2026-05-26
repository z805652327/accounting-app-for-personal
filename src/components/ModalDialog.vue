<template>
  <teleport to="body">
    <div v-if="visible" class="modal-overlay">
      <div class="modal-card animate-scale">
        <div class="modal-header">
          <span class="modal-title">{{ title }}</span>
        </div>
        <div class="modal-body">
          <span class="modal-content">{{ content }}</span>
        </div>
        <div class="modal-actions">
          <div class="modal-btn modal-btn-cancel" @click="cancel">
            {{ cancelText }}
          </div>
          <div class="modal-btn modal-btn-confirm" @click="confirm">
            {{ confirmText }}
          </div>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { modalState } from '@/stores/dialogs'

const visible = computed(() => modalState.visible)
const title = computed(() => modalState.title)
const content = computed(() => modalState.content)
const confirmText = computed(() => modalState.confirmText)
const cancelText = computed(() => modalState.cancelText)

function confirm() {
  modalState.visible = false
  if (modalState.resolve) {
    modalState.resolve(true)
    modalState.resolve = null
  }
}

function cancel() {
  modalState.visible = false
  if (modalState.resolve) {
    modalState.resolve(false)
    modalState.resolve = null
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.45);
  z-index: 10001; display: flex; align-items: center; justify-content: center;
  padding: 24px;
}
.modal-card {
  width: 100%; max-width: 320px; background: #FDFCF9;
  border-radius: 16px; overflow: hidden;
}
.modal-header {
  padding: 24px 20px 8px; text-align: center;
}
.modal-title {
  font-family: 'Noto Serif SC', serif;
  font-size: 17px; font-weight: 700; color: #1C1915;
}
.modal-body {
  padding: 12px 20px 24px; text-align: center;
}
.modal-content {
  font-size: 14px; color: #6B6560; line-height: 1.6;
}
.modal-actions {
  display: flex; gap: 0;
}
.modal-btn {
  flex: 1; text-align: center; padding: 14px;
  font-size: 15px; font-weight: 500; cursor: pointer;
  transition: opacity 0.15s;
}
.modal-btn:active { opacity: 0.7; }
.modal-btn-cancel {
  background: #F2EFE9; color: #6B6560;
  border-top: 1px solid #EDE8E0;
}
.modal-btn-confirm {
  background: #C44536; color: #fff;
  border-top: 1px solid #EDE8E0;
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}
.animate-scale { animation: scaleIn 0.2s cubic-bezier(0.22, 1, 0.36, 1); }
</style>
