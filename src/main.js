import { createApp } from "vue";
// main.js
import "./styles/main.scss";
import App from "./App.vue";
import { pinia } from "./stores";
import VueShortkey from "vue3-shortkey";

const app = createApp(App);

app.use(pinia);
app.use(VueShortkey);

app.mount("#app");
