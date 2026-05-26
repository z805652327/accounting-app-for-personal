import { reactive } from 'vue'

export interface ActionSheetOptions {
  itemList: string[]
  title?: string
}

export interface ActionSheetState {
  visible: boolean
  title: string
  items: string[]
  resolve: ((value: number) => void) | null
}

export const actionSheetState = reactive<ActionSheetState>({
  visible: false,
  title: '',
  items: [],
  resolve: null,
})

export function showActionSheet(options: ActionSheetOptions): Promise<number> {
  return new Promise((resolve) => {
    actionSheetState.title = options.title || '请选择'
    actionSheetState.items = options.itemList
    actionSheetState.resolve = resolve
    actionSheetState.visible = true
  })
}

export interface ModalOptions {
  title: string
  content: string
  confirmText?: string
  cancelText?: string
}

export interface ModalState {
  visible: boolean
  title: string
  content: string
  confirmText: string
  cancelText: string
  resolve: ((value: boolean) => void) | null
}

export const modalState = reactive<ModalState>({
  visible: false,
  title: '',
  content: '',
  confirmText: '确定',
  cancelText: '取消',
  resolve: null,
})

export function showModal(options: ModalOptions): Promise<boolean> {
  return new Promise((resolve) => {
    modalState.title = options.title
    modalState.content = options.content
    modalState.confirmText = options.confirmText || '确定'
    modalState.cancelText = options.cancelText || '取消'
    modalState.resolve = resolve
    modalState.visible = true
  })
}
