import { app, module as me } from 'electron'

console.log('app:', typeof app)
console.log('module type:', typeof me)
console.log('module value:', me)
if (me?.exports) {
  console.log('module.exports keys:', Object.keys(me.exports).slice(0, 30))
}
app.quit()
