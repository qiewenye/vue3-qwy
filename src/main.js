import { createApp } from 'vue'
// main.js
import './styles/main.scss';
import App from './App.vue'
import { pinia } from './stores'

const app = createApp(App)

app.use(pinia)

app.mount('#app')
