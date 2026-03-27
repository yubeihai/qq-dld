const { ActionBase } = require('../core/action-base');

class WorldTreeAction extends ActionBase {
  constructor() {
    super({
      id: 'worldtree',
      name: '世界树',
      description: '世界树功能：福宝一键领取经验奖励、源宝树免费温养',
      category: '每日任务',
    });
  }

  extractWeaponId(html) {
    if (!html) return null;
    
    const match = html.match(/weapon_id=(\d+)/);
    return match ? match[1] : null;
  }

  extractProgress(html) {
    if (!html) return null;
    
    const match = html.match(/当前进度:(\d+)\/(\d+)/);
    return match ? { current: parseInt(match[1]), total: parseInt(match[2]) } : null;
  }

  async run(params = {}) {
    const results = [];
    let successCount = 0;
    let failCount = 0;

    try {
      const indexHtml = await this.request('index', {});
      if (!indexHtml || indexHtml.includes('ptlogin2.qq.com')) {
        return this.fail('登录已过期，请重新扫码登录');
      }
    } catch (error) {
      return this.fail(error.message);
    }

    try {
      const fubaoHtml = await this.request('worldtree', { op: 'tree', type: 3 });
      
      if (fubaoHtml.includes('ptlogin2.qq.com')) {
        return this.fail('登录已过期，请重新扫码登录');
      }
      
      results.push({
        name: '福宝世界树',
        success: true,
        message: '访问成功',
      });
      successCount++;
      
      await this.delay(500);
    } catch (error) {
      results.push({
        name: '福宝世界树',
        success: false,
        message: error.message,
      });
      failCount++;
    }

    try {
      const autoGetHtml = await this.request('worldtree', { op: 'autoget', id: 1 });
      
      let autoGetMessage = '执行完成';
      if (autoGetHtml) {
        const text = this.extractText(autoGetHtml);
        if (text.includes('领取成功') || text.includes('获得')) {
          autoGetMessage = '一键领取经验奖励成功';
        } else if (text.includes('已领取') || text.includes('没有可领取')) {
          autoGetMessage = '暂无可领取的经验奖励';
        }
      }
      
      results.push({
        name: '一键领取经验奖励',
        success: true,
        message: autoGetMessage,
      });
      successCount++;
      
      await this.delay(500);
    } catch (error) {
      results.push({
        name: '一键领取经验奖励',
        success: false,
        message: error.message,
      });
      failCount++;
    }

    try {
      const yuanbaoHtml = await this.request('worldtree', { op: 'viewexpandindex' });
      
      if (yuanbaoHtml.includes('ptlogin2.qq.com')) {
        results.push({
          name: '源宝树',
          success: false,
          message: '登录已过期',
        });
        failCount++;
      } else {
        const weaponId = this.extractWeaponId(yuanbaoHtml);
        const progress = this.extractProgress(yuanbaoHtml);
        
        if (!weaponId) {
          results.push({
            name: '源宝树',
            success: false,
            message: '未找到武器ID',
          });
          failCount++;
        } else {
          results.push({
            name: '源宝树',
            success: true,
            message: `进入成功，当前进度: ${progress ? progress.current + '/' + progress.total : '未知'}`,
          });
          successCount++;
          
          await this.delay(500);
          
          const strengthenHtml = await this.request('worldtree', { 
            op: 'dostrengh', 
            times: 1, 
            weapon_id: weaponId 
          });
          
          let strengthenMessage = '免费温养完成';
          if (strengthenHtml) {
            const text = this.extractText(strengthenHtml);
            if (text.includes('成功') || text.includes('温养')) {
              strengthenMessage = '免费温养成功';
            } else if (text.includes('已使用') || text.includes('次数')) {
              strengthenMessage = '今日免费温养次数已用完';
            }
          }
          
          results.push({
            name: '免费温养',
            success: true,
            message: strengthenMessage,
          });
          successCount++;
        }
      }
    } catch (error) {
      results.push({
        name: '源宝树/免费温养',
        success: false,
        message: error.message,
      });
      failCount++;
    }

    const summary = `世界树：成功${successCount}个，失败${failCount}个`;
    const details = results.map(r => `${r.name}: ${r.message}`).join('\n');
    
    this.log(`${summary}\n${details}`, failCount === 0 ? 'success' : 'error');

    return this.success({
      result: summary,
      operations: results,
      successCount,
      failCount,
    });
  }
}

module.exports = {
  WorldTreeAction,
  action: new WorldTreeAction(),
};