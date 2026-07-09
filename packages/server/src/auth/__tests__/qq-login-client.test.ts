import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hash33, parsePtuiCB } from '../qq-login-client';

test('hash33 returns a stable 31-bit non-negative value', () => {
  const value = hash33('test-qrsig-value');
  assert.ok(value >= 0, 'hash33 must be non-negative');
  assert.ok(value <= 0x7fffffff, 'hash33 must fit in 31 bits');
  assert.strictEqual(hash33('test-qrsig-value'), value, 'hash33 must be deterministic');
});

test('parsePtuiCB extracts success code, callback URL, and nickname', () => {
  const body =
    `ptuiCB('0',0,'https://graph.qq.com/oauth2.0/login_jump?code=ABC123&state=x',0,'登录成功','Tester');`;
  const result = parsePtuiCB(body);
  assert.strictEqual(result.code, 0);
  assert.strictEqual(
    result.callbackUrl,
    'https://graph.qq.com/oauth2.0/login_jump?code=ABC123&state=x',
  );
  assert.strictEqual(result.nickname, 'Tester');
});

test('parsePtuiCB returns only the code for non-success statuses', () => {
  const body = `ptuiCB('66',0,'',0,'二维码未失效','');`;
  const result = parsePtuiCB(body);
  assert.strictEqual(result.code, 66);
  assert.strictEqual(result.callbackUrl, undefined);
  assert.strictEqual(result.nickname, undefined);
});
