const { QqLoginClient, hash33 } = require('./qq-login-client');
const { cookieDb } = require('../db');

let currentSession = null;

const qqClient = new QqLoginClient();

async function startLogin() {
  currentSession = null;

  const jar = await qqClient.initSession();
  const { qrImage, qrsig } = await qqClient.getQrCode(jar);

  currentSession = {
    jar,
    qrsig,
    ptqrtoken: hash33(qrsig),
    status: 'waiting',
    nickname: null,
    startTime: Date.now(),
  };

  return { qrCode: qrImage };
}

async function checkLoginSession() {
  if (!currentSession) return null;

  if (Date.now() - currentSession.startTime > 300000) {
    currentSession = null;
    return { status: 'expired' };
  }

  if (currentSession.status === 'success') {
    return { status: 'success', nickname: currentSession.nickname };
  }

  try {
    const result = await qqClient.checkStatus(currentSession.jar, currentSession.ptqrtoken);

    if (result.code === 66) return { status: 'waiting' };
    if (result.code === 67) {
      currentSession.status = 'scanned';
      return { status: 'scanned' };
    }
    if (result.code === 65) {
      currentSession = null;
      return { status: 'expired' };
    }
    if (result.code === 0 && result.callbackUrl) {
      const loginResult = await qqClient.completeLogin(
        result.callbackUrl,
        currentSession.jar,
        result.nickname,
      );

      cookieDb.set(loginResult.cookieString);
      currentSession.nickname = loginResult.nickname;
      currentSession.status = 'success';

      return { status: 'success', nickname: loginResult.nickname };
    }

    return { status: 'waiting' };
  } catch (e) {
    console.error('登录状态轮询失败:', e.message);
    return { status: 'waiting' };
  }
}

function clearSession() {
  currentSession = null;
}

module.exports = {
  startLogin,
  checkLoginSession,
  clearSession,
};
