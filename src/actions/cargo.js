const { ActionBase } = require('../core/action-base');

class CargoAction extends ActionBase {
  constructor() {
    super({
      id: 'cargo',
      name: '镖行天下',
      description: '自动拦截镖车、智能护送押镖',
      category: '每日任务',
    });
  }

  ESCORT_PRIORITY = ['温良恭', '吕青橙', '蔡八斗'];

  ESCORT_TIME = {
    '温良恭': 360,
    '吕青橙': 360,
    '蔡八斗': 360,
  };

  extractCargoInfo(html) {
    if (!html) {
      return { success: false, message: '无响应' };
    }

    if (html.includes('location.replace') || html.includes('ptlogin2.qq.com')) {
      return { success: false, message: '登录已过期，请重新扫码登录' };
    }

    const escortCountMatch = html.match(/剩余护送次数：(\d+)/);
    const interceptCountMatch = html.match(/剩余拦截次数：(\d+)/);

    const cargoList = [];
    const cargoRegex = /(\d+)\.([\u4e00-\u9fa5]+)\s*([^<\n]+?)\s*(\d+)\s*<br\s*\/?>\s*<a[^>]*href="[^"]*op=14[^"]*passerby_uin=(\d+)"/g;
    let match;
    while ((match = cargoRegex.exec(html)) !== null) {
      cargoList.push({
        rank: parseInt(match[1]),
        escortName: match[2].trim(),
        escortTitle: match[3].trim(),
        level: parseInt(match[4]),
        uin: match[5],
      });
    }

    return {
      success: true,
      escortCount: escortCountMatch ? parseInt(escortCountMatch[1]) : 0,
      interceptCount: interceptCountMatch ? parseInt(interceptCountMatch[1]) : 0,
      cargoList,
    };
  }

  extractEscortInfo(html) {
    if (!html) {
      return { success: false, message: '无响应' };
    }

    if (html.includes('location.replace') || html.includes('ptlogin2.qq.com')) {
      return { success: false, message: '登录已过期，请重新扫码登录' };
    }

    const escortNameMatch = html.match(/当前镖师：([\u4e00-\u9fa5]+)/);
    const escortLevelMatch = html.match(/镖师级别：([^\n<]+)/);
    const escortTimeMatch = html.match(/护送时间：([^<\n]+)/);
    const escortRewardMatch = html.match(/护送奖励：([^\n<]+)/);
    const freeRefreshMatch = html.match(/免费刷新次数：(\d+)/);

    return {
      success: true,
      escortName: escortNameMatch ? escortNameMatch[1] : '',
      escortLevel: escortLevelMatch ? escortLevelMatch[1].trim() : '',
      escortTime: escortTimeMatch ? escortTimeMatch[1].trim() : '',
      escortReward: escortRewardMatch ? escortRewardMatch[1].trim() : '',
      freeRefreshCount: freeRefreshMatch ? parseInt(freeRefreshMatch[1]) : 0,
    };
  }

  getEscortPriority(name) {
    const index = this.ESCORT_PRIORITY.indexOf(name);
    return index === -1 ? 999 : index;
  }

  async getCargoInfo() {
    const html = await this.request('cargo', {});
    return this.extractCargoInfo(html);
  }

  async refreshCargo() {
    const html = await this.request('cargo', { op: 3 });
    return this.extractCargoInfo(html);
  }

  async enterEscort() {
    const html = await this.request('cargo', { op: 7 });
    return this.extractEscortInfo(html);
  }

  async refreshEscort() {
    const html = await this.request('cargo', { op: 8 });
    return this.extractEscortInfo(html);
  }

  async startEscort() {
    const html = await this.request('cargo', { op: 6 });
    
    if (!html) {
      return { success: false, message: '无响应' };
    }

    if (html.includes('location.replace') || html.includes('ptlogin2.qq.com')) {
      return { success: false, message: '登录已过期' };
    }

    if (html.includes('护送成功') || html.includes('获得')) {
      const match = html.match(/获得[^<\n]*/);
      return { success: true, message: match ? match[0] : '护送成功' };
    }

    if (html.includes('次数不足') || html.includes('没有次数')) {
      return { success: false, message: '护送次数不足' };
    }

    const text = this.extractText(html).substring(0, 100);
    return { success: false, message: `未知结果：${text}` };
  }

  async checkEscortComplete() {
    const html = await this.request('cargo', {});
    
    if (!html) {
      return { success: false, message: '无响应', hasComplete: false, hasReward: false, html: '' };
    }

    if (html.includes('location.replace') || html.includes('ptlogin2.qq.com')) {
      return { success: false, message: '登录已过期', hasComplete: false, hasReward: false, html: '' };
    }

    // 检测是否有"护送完成"链接 (op=15)
    const hasEscortCompleteLink = html.includes('op=15') && html.includes('护送完成');
    
    // 检测剩余时间是否为 0
    const remainingTimeMatch = html.match(/剩余时间：(\d+) 分 (\d+) 秒/);
    const isTimeZero = remainingTimeMatch && 
                       parseInt(remainingTimeMatch[1]) === 0 && 
                       parseInt(remainingTimeMatch[2]) === 0;
    
    // 综合判断：有护送完成按钮 或 时间为 0
    const hasComplete = hasEscortCompleteLink || isTimeZero;
    
    return { 
      success: true, 
      hasComplete, 
      hasReward: hasComplete, 
      html: hasComplete ? html : '',
      rawHtml: hasComplete ? html : '',
    };
  }

  async collectEscortReward() {
    const html = await this.request('cargo', { op: 15 });
    
    if (!html) {
      return { success: false, message: '无响应', reward: '', needCollect: false };
    }

    if (html.includes('location.replace') || html.includes('ptlogin2.qq.com')) {
      return { success: false, message: '登录已过期', reward: '', needCollect: false };
    }

    // 情况 1：返回镖车列表页面（说明 op=15 已直接完成领取）
    // 特征：同时有"镖车列表"和"剩余拦截次数"
    if (html.includes('镖车列表') && html.includes('剩余拦截次数')) {
      const rewardMatch = html.match(/获得[^<\n]*?奖励：[^<\n]+/) || 
                          html.match(/获得[^<\n]+威望[^<\n]+/) ||
                          html.match(/获得[^<\n]+经验[^<\n]+/);
      return { 
        success: true, 
        message: rewardMatch ? rewardMatch[0] : '奖励已领取成功',
        reward: rewardMatch ? rewardMatch[0] : '',
        needCollect: false,
        hasNextRound: !html.includes('剩余护送次数：0') && !html.includes('没有护送次数'),
      };
    }

    // 情况 2：选择镖师页面（奖励已领取，进入下一轮）
    // 注意：要排除领取界面的"当前镖师"
    if ((html.includes('选择镖师') || html.includes('当前镖师')) && !html.includes('op=16') && !html.includes('领取奖励')) {
      const rewardMatch = html.match(/护送奖励：([^<\n]+)/);
      const hasStartButton = html.includes('op=6');
      const noCount = html.includes('没有护送次数') || html.includes('剩余护送次数：0');
      return { 
        success: true, 
        message: rewardMatch ? `奖励已领取：${rewardMatch[1]}` : '护送完成，可以开始下一轮',
        reward: rewardMatch ? rewardMatch[1] : '',
        needCollect: false,
        hasNextRound: hasStartButton && !noCount,
      };
    }

    // 情况 3：奖励领取界面（需要点击 op=16 确认领取）
    // 特征：有 op=16 按钮或"领取奖励"文字
    if (html.includes('op=16') || html.includes('领取奖励')) {
      return { 
        success: true, 
        message: '进入奖励领取界面，待确认',
        reward: '',
        needCollect: true,
      };
    }

    // 情况 4：已领取成功提示
    if (html.includes('领取成功') || html.includes('恭喜获得')) {
      const rewardMatch = html.match(/获得[^<\n]+/);
      return { 
        success: true, 
        message: rewardMatch ? rewardMatch[0] : '领取成功',
        reward: rewardMatch ? rewardMatch[0] : '',
        needCollect: false,
      };
    }

    // 情况 5：未知页面，保守处理，尝试发送 op=16
    // 这样可以确保不会错过奖励
    return { success: true, message: '护送完成，待领取', reward: '', needCollect: true };
  }

  async confirmCollectReward() {
    const html = await this.request('cargo', { op: 16 });
    
    if (!html) {
      return { success: false, message: '无响应', reward: '' };
    }

    if (html.includes('location.replace') || html.includes('ptlogin2.qq.com')) {
      return { success: false, message: '登录已过期', reward: '' };
    }

    // 提取奖励信息
    const rewardMatch = html.match(/获得奖励：[^<\n！]+/) || html.match(/获得[^<\n]*/);
    
    if (rewardMatch) {
      return { success: true, message: rewardMatch[0], reward: rewardMatch[0] };
    }
    
    if (html.includes('领取成功') || html.includes('恭喜')) {
      return { success: true, message: '领取成功', reward: '' };
    }
    
    if (html.includes('返回') || html.includes('cargo')) {
      return { success: true, message: '领取完成', reward: '' };
    }

    const text = this.extractText(html).substring(0, 100);
    return { success: true, message: `已领取：${text}`, reward: '' };
  }

  async intercept(uin, escortName) {
    const html = await this.request('cargo', { op: 14, passerby_uin: uin });
    
    if (!html) {
      return { success: false, message: '无响应' };
    }

    if (html.includes('location.replace') || html.includes('ptlogin2.qq.com')) {
      return { success: false, message: '登录已过期' };
    }

    if (html.includes('拦截成功') || html.includes('挑战成功')) {
      return { success: true, message: `拦截${escortName}成功` };
    }

    if (html.includes('拦截失败') || html.includes('挑战失败')) {
      return { success: false, message: `拦截${escortName}失败` };
    }

    if (html.includes('次数不足') || html.includes('没有次数')) {
      return { success: false, message: '拦截次数不足' };
    }

    if (html.includes('已拦截') || html.includes('已经拦截')) {
      return { success: true, message: `${escortName}已被拦截` };
    }

    const text = this.extractText(html).substring(0, 100);
    return { success: false, message: `未知结果：${text}` };
  }

  async smartIntercept(maxInterceptCount = 3) {
    const results = [];
    let interceptCount = 0;

    let cargoInfo = await this.getCargoInfo();
    
    if (!cargoInfo.success) {
      return { success: false, message: cargoInfo.message, details: [] };
    }

    results.push({
      action: '查询镖车列表',
      success: true,
      message: `剩余护送${cargoInfo.escortCount}次，剩余拦截${cargoInfo.interceptCount}次`,
    });

    const maxRefresh = 5;
    let refreshCount = 0;

    while (interceptCount < maxInterceptCount && cargoInfo.interceptCount > 0) {
      const targetName = this.ESCORT_PRIORITY[0];
      let targetCargo = null;

      for (let i = 0; i < this.ESCORT_PRIORITY.length; i++) {
        const priorityName = this.ESCORT_PRIORITY[i];
        const cargo = cargoInfo.cargoList.find(c => c.escortName === priorityName && c.uin);
        if (cargo) {
          targetCargo = cargo;
          break;
        }
      }

      if (!targetCargo) {
        if (refreshCount < maxRefresh) {
          refreshCount++;
          cargoInfo = await this.refreshCargo();
          results.push({
            action: `第${refreshCount}次刷新镖车`,
            success: true,
            message: `刷新后镖车数量：${cargoInfo.cargoList.length}`,
          });
          await this.delay(1000);
          continue;
        } else {
          results.push({
            action: '镖车筛选',
            success: true,
            message: `刷新${refreshCount}次未找到目标镖师，结束拦截`,
          });
          break;
        }
      }

      const result = await this.intercept(targetCargo.uin, targetCargo.escortName);
      results.push({
        action: `拦截${targetCargo.escortName}(${targetCargo.level}级)`,
        ...result,
      });

      if (result.success) {
        interceptCount++;
        cargoInfo.interceptCount--;
      }

      await this.delay(1000);

      if (interceptCount < maxInterceptCount && cargoInfo.interceptCount > 0) {
        cargoInfo = await this.getCargoInfo();
      }
    }

    if (cargoInfo.interceptCount <= 0) {
      results.push({
        action: '拦截次数',
        success: true,
        message: '今日拦截次数已用完',
      });
    }

    return {
      success: true,
      interceptCount,
      message: `成功拦截${interceptCount}次`,
      details: results,
    };
  }

  async smartEscort() {
    const results = [];
    
    let escortInfo = await this.enterEscort();
    
    if (!escortInfo.success) {
      return { success: false, message: escortInfo.message, details: [] };
    }

    results.push({
      action: '进入护送页面',
      success: true,
      message: `当前镖师：${escortInfo.escortName}(${escortInfo.escortLevel})，刷新次数：${escortInfo.freeRefreshCount}`,
    });

    let currentName = escortInfo.escortName;
    let refreshCount = 0;
    const maxRefresh = escortInfo.freeRefreshCount;

    while (refreshCount < maxRefresh) {
      const priority = this.getEscortPriority(currentName);
      
      if (priority === 0) {
        results.push({
          action: '镖师选择',
          success: true,
          message: `获得最佳镖师${currentName}，开始护送`,
        });
        break;
      }

      let hasBetter = false;
      for (let i = priority - 1; i >= 0; i--) {
        if (this.ESCORT_PRIORITY[i]) {
          hasBetter = true;
          break;
        }
      }

      if (!hasBetter) {
        results.push({
          action: '镖师选择',
          success: true,
          message: `当前镖师${currentName}已是最佳可选，开始护送`,
        });
        break;
      }

      refreshCount++;
      escortInfo = await this.refreshEscort();
      currentName = escortInfo.escortName;
      
      results.push({
        action: `第${refreshCount}次刷新`,
        success: true,
        message: `刷新后镖师：${currentName}(${escortInfo.escortLevel})`,
      });

      await this.delay(1000);
    }

    if (refreshCount >= maxRefresh && this.getEscortPriority(currentName) !== 0) {
      results.push({
        action: '镖师选择',
        success: true,
        message: `刷新次数用尽，当前镖师${currentName}，开始护送`,
      });
    }

    const escortResult = await this.startEscort();
    results.push({
      action: '启程护送',
      ...escortResult,
    });

    if (escortResult.success) {
      const waitTime = this.ESCORT_TIME[currentName] || 90;
      results.push({
        action: '等待护送',
        success: true,
        message: `等待${waitTime}秒 (${currentName})`,
      });
      
      await this.delay(waitTime * 1000);
      
      // 多次检测直到找到护送完成（延长检测时间）
      let checkResult = await this.checkEscortComplete();
      let retryCount = 0;
      const maxRetry = 15;  // 增加重试次数
      const retryInterval = 5 * 1000;  // 缩短间隔为 5 秒
      
      while (!checkResult.hasComplete && !checkResult.hasReward && retryCount < maxRetry) {
        retryCount++;
        results.push({
          action: '检测奖励',
          success: false,
          message: `第${retryCount}次检测，未找到护送完成按钮`,
        });
        await this.delay(retryInterval);
        checkResult = await this.checkEscortComplete();
        
        // 如果检测到有奖励可领取，立即退出循环
        if (checkResult.hasReward) {
          results.push({
            action: '检测奖励',
            success: true,
            message: '发现可领取的奖励',
          });
          break;
        }
      }
      
      if (checkResult.hasComplete || checkResult.hasReward) {
        const collectResult = await this.collectEscortReward();
        results.push({
          action: '护送完成',
          success: collectResult.success,
          message: collectResult.message || '点击护送完成',
          reward: collectResult.reward || '',
        });
        
        if (collectResult.needCollect) {
          await this.delay(1000);
          const confirmResult = await this.confirmCollectReward();
          results.push({
            action: '领取奖励',
            success: confirmResult.success,
            message: confirmResult.message || confirmResult.error || '领取完成',
          });
        }
      } else {
        results.push({
          action: '检查奖励',
          success: false,
          message: '多次检测未找到护送完成按钮，尝试领取',
        });
        const collectResult = await this.collectEscortReward();
        if (collectResult.success || collectResult.needCollect) {
          results.push({
            action: '尝试领取',
            success: collectResult.success,
            message: collectResult.message || '点击护送完成',
            reward: collectResult.reward || '',
          });
          if (collectResult.needCollect) {
            await this.delay(1000);
            const confirmResult = await this.confirmCollectReward();
            results.push({
              action: '领取奖励',
              success: confirmResult.success,
              message: confirmResult.message || '领取完成',
            });
          }
        }
      }
    }

    return {
      success: escortResult.success,
      escortName: currentName,
      escortLevel: escortInfo.escortLevel,
      escortTime: escortInfo.escortTime,
      refreshCount,
      message: escortResult.message,
      details: results,
    };
  }

  async run(params = {}) {
    const { 
      maxIntercept = 3,
      escort = true,
    } = params;

    const results = [];

    try {
      // 先检查是否有待领取的奖励
      const checkResult = await this.checkEscortComplete();
      if (checkResult.hasComplete) {
        results.push({
          action: '检测待领取奖励',
          success: true,
          message: '发现待领取的护送奖励',
        });
        
        const collectResult = await this.collectEscortReward();
        results.push({
          action: '护送完成',
          success: collectResult.success,
          message: collectResult.message || '点击护送完成',
          reward: collectResult.reward || '',
        });
        
        if (collectResult.needCollect) {
          await this.delay(1000);
          const confirmResult = await this.confirmCollectReward();
          results.push({
            action: '领取奖励',
            success: confirmResult.success,
            message: confirmResult.message || confirmResult.error || '领取完成',
          });
        }
        
        // 领取完成后，继续执行拦截和护送
        results.push({
          action: '继续执行',
          success: true,
          message: '开始执行拦截和护送任务',
        });
      }

      const interceptResult = await this.smartIntercept(maxIntercept);
      results.push(...interceptResult.details);

      let escortResult = null;
      if (escort) {
        escortResult = await this.smartEscort();
        results.push({
          action: '智能护送',
          success: escortResult.success,
          message: `镖师：${escortResult.escortName}, ${escortResult.message}`,
          details: escortResult.details,
        });
      }

      const summary = `拦截${interceptResult.interceptCount}次，护送${escort ? escortResult?.escortName : '未执行'}`;
      const details = results.map(r => `${r.action}: ${r.message}`).join('\n');
      
      this.log(`${summary}\n${details}`, 'success');

      return this.success({
        result: summary,
        interceptCount: interceptResult.interceptCount,
        escort: escortResult,
        details: results,
      });
    } catch (error) {
      return this.fail(error.message);
    }
  }
}

module.exports = {
  CargoAction,
  action: new CargoAction(),
};
