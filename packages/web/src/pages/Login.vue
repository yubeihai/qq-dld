<template>
  <div class="login-page">
    <van-image v-if="qrImage" :src="qrImage" width="220" height="220" />
    <van-notice-bar v-if="status === 'waiting'" text="请使用 QQ 扫描上方二维码" />
    <van-notice-bar v-else-if="status === 'scanned'" text="请在手机上确认登录" />
    <van-notice-bar v-else-if="status === 'expired'" text="二维码已过期，请刷新" />
    <van-button
      v-if="status === 'expired'"
      type="primary"
      @click="startQrLogin"
    >刷新二维码</van-button>
    <van-empty v-if="error" :description="error" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import http from '../api/http';

type QrStatus = 'waiting' | 'scanned' | 'success' | 'expired';

const router = useRouter();
const qrImage = ref('');
const status = ref<QrStatus>('waiting');
const error = ref('');
let pollTimer: ReturnType<typeof setInterval> | null = null;
let sessionId = '';

async function startQrLogin(): Promise<void> {
  stopPolling();
  qrImage.value = '';
  status.value = 'waiting';
  error.value = '';
  try {
    const res = await http.post('/api/auth/qr/start');
    sessionId = res.data.sessionId;
    qrImage.value = res.data.qrImage;
    startPolling();
  } catch {
    error.value = '获取二维码失败，请重试';
  }
}

function startPolling(): void {
  pollTimer = setInterval(pollStatus, 2000);
}

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function pollStatus(): Promise<void> {
  try {
    const res = await http.get('/api/auth/qr/status', { params: { id: sessionId } });
    const data = res.data as { status: QrStatus; token?: string; account?: unknown };
    status.value = data.status;
    if (data.status === 'success' && data.token) {
      stopPolling();
      localStorage.setItem('token', data.token);
      localStorage.setItem('account', JSON.stringify(data.account));
      router.push('/modules');
    } else if (data.status === 'expired') {
      stopPolling();
    }
  } catch {
    // keep polling on transient network errors
  }
}

onMounted(startQrLogin);
onUnmounted(stopPolling);
</script>
