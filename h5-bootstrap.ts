import { createApp, h } from 'vue'
import { createPinia } from 'pinia'
import './src/global.css'

// uni-app component aliases: <view>→<div>, <text>→<span>
const passthru = (tag: string) => ({ render() { return h(tag, this.$attrs, this.$slots.default?.()) } })

const app = createApp({
  setup() {
    return () => h('div', { style: { maxWidth: '750rpx', margin: '0 auto', padding: '0 12px 40px' } }, [
      h(Dashboard),
    ])
  }
})
app.use(createPinia())
app.component('view', passthru('div'))
app.component('text', passthru('span'))
app.mount('#app')

import Dashboard from './src/pages/index/index.vue'
