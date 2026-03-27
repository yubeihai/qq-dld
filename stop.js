const { exec } = require('child_process');

const PORT = process.env.PORT || 3000;

if (process.platform === 'win32') {
  exec(`netstat -ano | findstr :${PORT}`, (err, stdout) => {
    if (err || !stdout) {
      console.log('服务未运行');
      return;
    }
    
    const lines = stdout.split('\n');
    for (const line of lines) {
      const match = line.match(/LISTENING\s+(\d+)/);
      if (match) {
        const pid = match[1];
        exec(`taskkill /PID ${pid} /F`, (err) => {
          if (err) {
            console.log('停止失败:', err.message);
          } else {
            console.log(`服务已停止 (PID: ${pid})`);
          }
        });
        return;
      }
    }
    console.log('服务未运行');
  });
} else {
  exec(`lsof -ti:${PORT}`, (err, stdout) => {
    if (err || !stdout) {
      console.log('服务未运行');
      return;
    }
    
    const pid = stdout.trim();
    exec(`kill ${pid}`, (err) => {
      if (err) {
        console.log('停止失败:', err.message);
      } else {
        console.log(`服务已停止 (PID: ${pid})`);
      }
    });
  });
}