<template>
  <div class="accounts-page">
    <van-list>
      <van-cell v-for="acc in accounts" :key="acc.id" :title="acc.nickname || acc.uin">
        <template #extra>
          <van-button size="small" type="danger" @click="remove(acc.id)">删除</van-button>
        </template>
      </van-cell>
    </van-list>
    <van-empty v-if="!accounts.length" description="暂无账号" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import http from '../api/http';

const accounts = ref<any[]>([]);

onMounted(async () => {
  const res = await http.get('/api/accounts');
  accounts.value = res.data.accounts || [];
});

async function remove(id: number) {
  await http.delete(`/api/accounts/${id}`);
  accounts.value = accounts.value.filter((a) => a.id !== id);
}
</script>
