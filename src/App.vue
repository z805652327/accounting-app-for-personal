<template>
  <div style="height:100%;display:flex;flex-direction:column;">
    <div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding-bottom:60px;">
      <router-view />
    </div>
    <div class="tabbar">
      <div
        v-for="(tab, i) in tabs"
        :key="i"
        :class="['tabbar-item', { active: activeTab === i }]"
        @click="switchTab(i)"
      >
        <span class="tabbar-icon">{{ tab.icon }}</span>
        <span class="tabbar-label">{{ tab.label }}</span>
      </div>
    </div>
    <ActionSheet />
    <ModalDialog />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useSubjectStore } from '@/stores/subjects'
import { useAccountStore } from '@/stores/accounts'
import ActionSheet from '@/components/ActionSheet.vue'
import ModalDialog from '@/components/ModalDialog.vue'

const router = useRouter()
const route = useRoute()

const tabs = [
  { icon: '◉', label: '首页', path: '/pages/index/index' },
  { icon: '◎', label: '账户', path: '/pages/accounts/index' },
  { icon: '◒', label: '报表', path: '/pages/reports/index' },
  { icon: '⊙', label: '设置', path: '/pages/settings/index' },
]

const activeTab = computed(() => {
  const metaTab = route.meta?.tab as number | undefined
  return metaTab ?? tabs.findIndex(t => route.path.startsWith(t.path.split('/').slice(0, -1).join('/')))
})

function switchTab(i: number) {
  router.push(tabs[i].path)
}

onMounted(async () => {
  try {
    const subjectStore = useSubjectStore()
    const accountStore = useAccountStore()
    await subjectStore.load()
    await accountStore.load()

    const { getDatabase } = await import('@/database/factory')
    const db = await getDatabase()
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 60)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    await db.execute(
      'UPDATE transactions SET archived = 1 WHERE tx_date < ? AND archived = 0',
      [cutoffStr]
    )

    const { TransactionRepository } = await import('@/repositories/transaction-repo')
    const txRepo = new TransactionRepository(db)
    await txRepo.purgeExpired()

    try {
      const { PendingService } = await import('@/services/pending.service')
      const pendingSvc = new PendingService(db)
      await pendingSvc.generateAll()
    } catch { /* best-effort */ }

    const pinRow = await db.queryOne<{value: string}>("SELECT value FROM app_settings WHERE key = 'app_pin'")
    if (pinRow?.value) {
      const pin = prompt('请输入应用密码')
      if (pin !== pinRow.value) {
        document.body.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:100vh;font-size:14px;color:#666;font-family:serif;">密码错误，请重启应用</div>'
      }
    }
  } catch (e) {
    console.error('Init error:', e)
  }
  // Remove splash screen
  ;(window as any).__hideSplash?.()
})
</script>

<style lang="scss">
/* All base styles moved to app-theme.css */
</style>
