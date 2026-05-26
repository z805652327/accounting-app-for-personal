import { createApp, h } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import router from './router'
import { uni } from './uni-shim'
import PickerWrapper from './components/PickerWrapper.vue'
import './uni.scss'
import './app-theme.css'

;(window as any).uni = uni

const passthru = (tag: string) => ({
  render(this: any) { return h(tag, this.$attrs, this.$slots?.default?.()) },
})

const app = createApp(App)
app.component('view', passthru('div'))
app.component('text', passthru('span'))
app.component('scroll-view', passthru('div'))
app.component('picker', PickerWrapper)
app.component('image', { props: ['src', 'mode'], render(this: any) { return h('img', { src: this.src }) } })
app.use(createPinia())
app.use(router)
app.use(ElementPlus)
app.mount('#app')
