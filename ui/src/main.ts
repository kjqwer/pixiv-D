import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

// 导入全局组件
import ErrorMessage from '@/components/common/ErrorMessage.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'

const app = createApp(App)

// 注册全局组件
app.component('ErrorMessage', ErrorMessage)
app.component('LoadingSpinner', LoadingSpinner)

app.use(createPinia())
app.use(router)

app.mount('#app')
