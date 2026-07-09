<template>
  <div class="login-page">
    <van-image :src="qrCode" v-if="qrCode" />
    <van-button type="primary" @click="login">扫码登录</van-button>
    <van-notice-bar v-if="qrCode" text="请使用 QQ 扫码" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import http from '../api/http';
import { useRouter } from 'vue-router';

const router = useRouter();
const qrCode = ref('');

async function login() {
  try {
    const res = await http.post('/api/auth/login', { uin: Date.now().toString() });
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('account', JSON.stringify(res.data.account));
    router.push('/modules');
  } catch {
    qrCode.value = 'https://qr.api.cli.im/qr?data=placeholder';
  }
}
</script>
