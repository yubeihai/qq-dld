import { createApp } from 'vue';
import App from './App.vue';
import router from './router/index';
import 'vant/lib/index.css';
import { Tabbar, TabbarItem, Button, Cell, CellGroup, List, Empty, Image as VanImage, NoticeBar, Dialog } from 'vant';

const app = createApp(App);
app.use(router);
app.use(Tabbar);
app.use(TabbarItem);
app.use(Button);
app.use(Cell);
app.use(CellGroup);
app.use(List);
app.use(Empty);
app.use(VanImage);
app.use(NoticeBar);
app.use(Dialog);
app.mount('#app');
