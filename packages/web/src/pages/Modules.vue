<template>
  <div class="modules-page">
    <van-cell-group>
      <van-cell v-for="mod in modules" :key="mod.id" :title="mod.name" :label="mod.description">
        <template #extra>
          <van-button size="small" type="primary" :loading="loading === mod.id" @click="run(mod.id)">运行</van-button>
        </template>
      </van-cell>
    </van-cell-group>
    <van-empty v-if="!modules.length" description="暂无模块" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import http from '../api/http';

const modules = ref<any[]>([]);
const loading = ref<string | null>(null);

onMounted(async () => {
  const res = await http.get('/api/modules');
  modules.value = res.data.modules || [];
});

async function run(id: string) {
  loading.value = id;
  try {
    const res = await http.post(`/api/run/${id}`);
    console.log('Result:', res.data);
  } finally {
    loading.value = null;
  }
}
</script>
