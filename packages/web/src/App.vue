<script setup lang="ts">
import { ref, type Ref } from 'vue';
import type { Account } from '@qq-dld/shared';
import { Button } from 'vant';

const account: Ref<Account> = ref({
  id: 1,
  nickname: 'web-sample',
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});
</script>

<template>
  <div class="root">
    <h1>qq-dld web</h1>
    <Button>{{ account.nickname }}</Button>
  </div>
</template>

<style scoped>
.root {
  font-family: sans-serif;
  padding: 1rem;
}
</style>
