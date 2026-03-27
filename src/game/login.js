const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const { cookieDb } = require('../db');

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

const QQ_LOGIN_URL = 'https://graph.qq.com/oauth2.0/show?which=Login&display=pc&response_type=code&client_id=102067279&redirect_uri=https%3A%2F%2Fdld.qzapp.z.qq.com%2Findex.php&scope=all';

function findChrome() {
  for (const loc of CHROME_PATHS) {
    if (fs.existsSync(loc)) return loc;
  }
  return null;
}

function isLoginSuccess(url) {
  return url.includes('phonepk') && url.includes('cmd=index');
}

async function login() {
  const executablePath = findChrome();
  if (!executablePath) {
    throw new Error('未找到 Chrome/Edge 浏览器，请安装后重试');
  }

  console.log('正在启动浏览器...');
  console.log('浏览器路径:', executablePath);
  
  let browser = null;
  
  try {
    browser = await puppeteer.launch({
      headless: false,
      executablePath,
      defaultViewport: { width: 500, height: 700 },
      args: ['--no-sandbox', '--disable-web-security'],
    });

    console.log('浏览器启动成功');
    
    const page = await browser.newPage();
    console.log('新页面创建成功');
    
    console.log('正在打开登录页面...');
    
    try {
      await page.goto(QQ_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
      console.log('登录页面加载成功');
    } catch (e) {
      console.log('页面加载超时，继续等待用户操作...', e.message);
    }
    
    console.log('请在浏览器窗口中扫码登录...');
    console.log('登录成功后窗口会自动关闭，最长等待 5 分钟');
    
    let loggedIn = false;
    let attempts = 0;
    const maxAttempts = 300;
    
    while (!loggedIn && attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 1000));
      attempts++;
      
      try {
        const url = page.url();
        
        if (attempts <= 5 || attempts % 10 === 0) {
          console.log(`[${attempts}s] 当前URL: ${url}`);
        }
        
        if (isLoginSuccess(url)) {
          loggedIn = true;
          console.log('检测到登录成功，正在保存 Cookie...');
          break;
        }
        
        if (attempts % 30 === 0) {
          console.log(`等待扫码登录中... (${attempts}秒)`);
        }
      } catch (e) {
        console.log('检测页面状态出错:', e.message);
      }
    }
    
    if (!loggedIn) {
      console.log('登录超时，用户未扫码或未完成授权');
      if (browser) await browser.close();
      throw new Error('登录超时，请重新尝试');
    }
    
    const cookies = await page.cookies();
    console.log(`获取到 ${cookies.length} 个 Cookie`);
    
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    
    cookieDb.set(cookieString);
    
    console.log('登录成功！Cookie 已保存');
    
    await browser.close();
    
    return true;
  } catch (error) {
    console.error('登录过程出错:', error.message);
    console.error('错误堆栈:', error.stack);
    if (browser) {
      console.log('浏览器将在 10 秒后关闭，请查看错误...');
      await new Promise(r => setTimeout(r, 10000));
      try {
        await browser.close();
      } catch (e) {}
    }
    throw error;
  }
}

function checkLogin() {
  return cookieDb.exists();
}

module.exports = {
  login,
  checkLogin,
  findChrome,
};
