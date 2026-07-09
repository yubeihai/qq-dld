<template>
  <div class="logs-page">
    <van-list>
      <van-cell v-for="log in logs" :key="log.id">
        <template #title>
          <span :class="log.status">{{ log.module_id }}</span>
        </template>
        <template #label>
          <div>{{ log.message }}</div>
          <div class="log-time">{{ log.started_at }}</div>
        </template>
      </van-cell>
    </van-list>
    <van-empty v-if="!logs.length" description="暂无日志" />
    <van-button v-if="logs.length" type="danger" block @click="clear">清空日志</van-button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import http from '../api/http';
import { showConfirmDialog } from 'vant';

const logs = ref<any[]>([]);

onMounted(async () => {
  const res = await http.get('/api/logs');
  logs.value = res.data.logs || [];
});

async function clear() {
  try {
    await showConfirmDialog({ message: '确认清空所有日志？' });
    await http.delete('/api/logs');
    logs.value = [];
  } catch {
    // cancelled
  }
}
</script>

<style scoped>
.log-time { color: #999; font-size: 12px; margin-top: 4px; }
.success { color: #07c160; }
.fail { color: #ee0a24; }
</style>
