import "/src/pages-json-js";
import { plugin as __plugin } from "/node_modules/@dcloudio/uni-h5/dist/uni-h5.es.js";
import { createVueApp as createSSRApp } from "/node_modules/@dcloudio/uni-h5-vue/dist/vue.runtime.esm.js";
import { createPinia } from "/node_modules/pinia/dist/pinia.mjs?v=7cc7398c";
import uviewPlus from "/node_modules/.vite/deps/uview-plus.js?v=7cc7398c";
import App from "/src/App.vue";
export function createApp() {
	const app = createSSRApp(App);
	app.use(createPinia());
	app.use(uviewPlus);
	return { app };
}
;
createApp().app.use(__plugin).mount("#app");

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6IkFBQUEsT0FBTztBQUFpQixTQUFTO0FBQUE7QUFDakMsU0FBUyxtQkFBbUI7QUFDNUIsT0FBTyxlQUFlO0FBQ3RCLE9BQU8sU0FBUztBQUVoQixPQUFPLFNBQVMsWUFBWTtDQUMxQixNQUFNLE1BQU0sYUFBYSxHQUFHO0NBQzVCLElBQUksSUFBSSxZQUFZLENBQUM7Q0FDckIsSUFBSSxJQUFJLFNBQVM7Q0FDakIsT0FBTyxFQUFFLElBQUk7QUFDZiIsIm5hbWVzIjpbXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZXMiOlsibWFpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBjcmVhdGVTU1JBcHAgfSBmcm9tICd2dWUnXG5pbXBvcnQgeyBjcmVhdGVQaW5pYSB9IGZyb20gJ3BpbmlhJ1xuaW1wb3J0IHV2aWV3UGx1cyBmcm9tICd1dmlldy1wbHVzJ1xuaW1wb3J0IEFwcCBmcm9tICcuL0FwcC52dWUnXG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVBcHAoKSB7XG4gIGNvbnN0IGFwcCA9IGNyZWF0ZVNTUkFwcChBcHApXG4gIGFwcC51c2UoY3JlYXRlUGluaWEoKSlcbiAgYXBwLnVzZSh1dmlld1BsdXMpXG4gIHJldHVybiB7IGFwcCB9XG59XG4iXSwiZmlsZSI6IkQ6L2FjY291bnRpbmcgYXBwL3NyYy9tYWluLnRzIn0=