import { createApp } from 'vue';
import { createPinia } from 'pinia';
import Antd from 'ant-design-vue';
import router from './router';
import App from './App.vue';
import 'ant-design-vue/dist/reset.css';
import './theme/neon-vars.css';
// dayjs 中文语言包
import 'dayjs/locale/zh-cn';
import dayjs from 'dayjs';
dayjs.locale('zh-cn');

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(Antd);
app.mount('#app');