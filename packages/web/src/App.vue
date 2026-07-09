<template>
  <div id="app">
    <router-view />
    <van-tabbar v-if="showTabbar" route>
      <van-tabbar-item to="/modules" icon="apps-o">模块</van-tabbar-item>
      <van-tabbar-item to="/accounts" icon="contact">账号</van-tabbar-item>
      <van-tabbar-item to="/logs" icon="records">日志</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const showTabbar = computed(() => route.path !== '/login');
</script>
