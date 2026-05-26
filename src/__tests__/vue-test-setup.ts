// Mock uni-app globals before any component imports
import { vi } from 'vitest'

// Mock @dcloudio/uni-app runtime
vi.mock('@dcloudio/uni-app', () => ({
  onLaunch: vi.fn(),
  onLoad: vi.fn(),
  onShow: vi.fn(),
  onHide: vi.fn(),
  onReady: vi.fn(),
  onMounted: vi.fn(),
}))

// Mock uni API
;(globalThis as any).uni = {
  navigateTo: vi.fn(),
  navigateBack: vi.fn(),
  showToast: vi.fn(),
  showModal: vi.fn().mockResolvedValue({ confirm: true }),
  showActionSheet: vi.fn(),
  chooseImage: vi.fn(),
}

// Mock uview-plus (just pass through slots/attrs)
vi.mock('uview-plus', () => ({
  default: {
    install: () => {},
  },
}))

// Mock uview components — register as stubs
vi.mock('uview-plus/components/u-input/u-input.vue', () => ({
  default: { name: 'UInput', template: '<input />' },
}))
vi.mock('uview-plus/components/u-button/u-button.vue', () => ({
  default: { name: 'UButton', template: '<button />' },
}))
