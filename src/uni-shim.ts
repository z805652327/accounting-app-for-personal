// Shim for @dcloudio/uni-app — provides browser-compatible API
import { onMounted, onUnmounted } from 'vue'
import router from '@/router'

// Lifecycle hooks: map uni-app names to Vue equivalents
export const onLaunch = (fn: () => void) => onMounted(() => fn())
export const onShow = (fn: () => void) => onMounted(() => fn())
export const onHide = (fn: () => void) => onUnmounted(() => fn())
export const onLoad = (fn: (opt?: any) => void) => onMounted(() => {
  const q: Record<string, string> = {}
  const search = window.location.hash.split('?')[1] || ''
  search.split('&').forEach(p => {
    const [k, v] = p.split('=')
    if (k) q[decodeURIComponent(k)] = decodeURIComponent(v || '')
  })
  fn(q)
})
export const onReady = (fn: () => void) => onMounted(() => fn())

// Uni API
const uni = {
  navigateTo({ url }: { url: string }) {
    router.push(url)
  },
  navigateBack() {
    router.back()
  },
  switchTab({ url }: { url: string }) {
    router.push(url)
  },
  showToast({ title, icon = 'none' as string, duration = 2000 }: { title: string; icon?: string; duration?: number }) {
    const el = document.createElement('div')
    el.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(28,25,21,0.88);color:#FCFAF7;padding:12px 24px;border-radius:8px;font-size:14px;z-index:99999;pointer-events:none;font-family:system-ui,sans-serif;white-space:nowrap'
    el.textContent = title
    document.body.appendChild(el)
    setTimeout(() => el.remove(), duration)
  },
  async showModal({ title, content, success, confirmText, cancelText }: {
    title: string; content: string
    success?: (res: { confirm: boolean; cancel: boolean }) => void
    confirmText?: string; cancelText?: string
  }): Promise<{ confirm: boolean; cancel: boolean }> {
    const { showModal } = await import('@/stores/dialogs')
    const result = await showModal({ title, content, confirmText, cancelText })
    if (success) success({ confirm: result, cancel: !result })
    return { confirm: result, cancel: !result }
  },
  async showActionSheet({ itemList, success, title }: {
    itemList: string[]
    title?: string
    success?: (res: { tapIndex: number }) => void
  }) {
    const { showActionSheet } = await import('@/stores/dialogs')
    const idx = await showActionSheet({ itemList, title })
    if (success) success({ tapIndex: idx })
  },
  showLoading({ title = '加载中...' }: { title?: string } = {}) {
    const el = document.createElement('div')
    el.className = 'uni-loading-overlay'
    el.innerHTML = `<div style="background:rgba(28,25,21,0.88);color:#FCFAF7;padding:14px 24px;border-radius:8px;font-size:14px;display:flex;align-items:center;gap:8px"><span class="uni-loading-spin">◌</span>${title}</div>`
    el.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:99998;pointer-events:all'
    document.body.appendChild(el)
  },
  hideLoading() {
    const el = document.querySelector('.uni-loading-overlay')
    if (el) el.remove()
  },
  chooseImage({ count, success }: {
    count?: number
    success?: (res: { tempFilePaths: string[] }) => void
  }) {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => {
      const file = input.files?.[0]
      if (file && success) {
        success({ tempFilePaths: [URL.createObjectURL(file)] })
      }
    }
    input.click()
  },
  // Polyfills needed by uview-plus components
  upx2px(value: number): number {
    // rpx → px: on H5, 1rpx ≈ 0.5px at 750rpx design width
    return value / 2
  },
  rpx2px(value: number): number {
    return value / 2
  },
  hideKeyboard() {
    // No-op on web — blur active element
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  },
  getSystemInfoSync() {
    return {
      platform: 'web',
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      pixelRatio: window.devicePixelRatio || 1,
    }
  },
  // uview-plus $u namespace
  $u: {
    sleep(ms: number): Promise<void> {
      return new Promise(resolve => setTimeout(resolve, ms))
    },
    color: {
      mainColor: '#1C1915',
      contentColor: '#6B6560',
      tipsColor: '#9E9790',
      lightColor: '#c0bab2',
      borderColor: '#E0DBD3',
      bgColor: '#F2EFE9',
      primary: '#1C1915',
      success: '#2D7D7A',
      warning: '#E08900',
      error: '#C44536',
      info: '#6B6560',
    },
    config: {
      v: '1.0.0',
      version: '1.0.0',
    },
  },
}

export default uni
export { uni }
