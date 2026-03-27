const { ActionBase } = require('../core/action-base');

class ScrollDungeonAction extends ActionBase {
  constructor() {
    super({
      id: 'scrolldungeon',
      name: '画卷迷踪',
      description: '挑战画卷迷踪关卡，自动战斗到最高层',
      category: '活动',
    });
    
    this.defaultInterval = 1500;
  }

  parsePageInfo(html) {
    if (!html) return null;
    
    const freeMatch = html.match(/本日免费剩余次数[：:]\s*(\d+)/);
    const paidMatch = html.match(/本日付费剩余次数[：:]\s*(\d+)/);
    const scrollMatch = html.match(/征战书数量[：:]\s*(\d+)/);
    const maxRecordMatch = html.match(/我的最高记录[：:]\s*(\d+)/);
    const currentMatch = html.match(/当前所在关卡[：:]\s*(\d+)/);
    
    return {
      freeCount: freeMatch ? parseInt(freeMatch[1]) : 0,
      paidCount: paidMatch ? parseInt(paidMatch[1]) : 0,
      scrollCount: scrollMatch ? parseInt(scrollMatch[1]) : 0,
      maxRecord: maxRecordMatch ? parseInt(maxRecordMatch[1]) : 0,
      currentLevel: currentMatch ? parseInt(currentMatch[1]) : 0,
    };
  }

  async selectBuff(buffId) {
    await this.request('scroll_dungeon', { buff: String(buffId) });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async run(params = {}) {
    const { maxLevel = 80, interval = this.defaultInterval, autoBuff = true, maxBattles = 100 } = params;
    
    const results = [];
    let winCount = 0;
    let failCount = 0;
    let lastLevel = 0;
    let noChangeCount = 0;
    const maxNoChange = 3;
    
    try {
      const initHtml = await this.request('scroll_dungeon');
      const pageInfo = this.parsePageInfo(initHtml);
      
      if (!pageInfo || pageInfo.currentLevel === 0) {
        return this.fail('获取画卷迷踪信息失败');
      }
      
      lastLevel = pageInfo.currentLevel;
      this.log(`开始: 第${lastLevel}关，记录${pageInfo.maxRecord}关，免费${pageInfo.freeCount}次，付费${pageInfo.paidCount}次，征战书${pageInfo.scrollCount}个`);
      
      if (autoBuff) {
        await this.selectBuff(1);
        await this.sleep(500);
      }
      
      for (let battle = 0; battle < maxBattles; battle++) {
        const beforeLevel = lastLevel;
        
        await this.request('scroll_dungeon', { op: 'fight', buff: '0' });
        
        await this.sleep(interval);
        
        const afterHtml = await this.request('scroll_dungeon');
        const afterInfo = this.parsePageInfo(afterHtml);
        
        if (!afterInfo) {
          this.log('获取状态失败', 'error');
          break;
        }
        
        const afterLevel = afterInfo.currentLevel;
        
        if (afterLevel > beforeLevel) {
          winCount++;
          noChangeCount = 0;
          this.log(`第${beforeLevel}关胜 → 第${afterLevel}关`, 'success');
          results.push({ level: beforeLevel, success: true });
        } else if (afterLevel < beforeLevel) {
          failCount++;
          noChangeCount = 0;
          this.log(`第${beforeLevel}关败 → 第${afterLevel}关`, 'error');
          results.push({ level: beforeLevel, success: false });
        } else {
          noChangeCount++;
          this.log(`第${beforeLevel}关无变化(${noChangeCount}/${maxNoChange})`, 'info');
          
          if (noChangeCount >= maxNoChange) {
            this.log('关卡连续无变化，可能次数已用完', 'info');
            break;
          }
        }
        
        lastLevel = afterLevel;
        
        if (afterLevel >= maxLevel) {
          this.log(`到达目标关卡${maxLevel}`, 'success');
          break;
        }
      }
      
      const summary = `完成: ${winCount}胜${failCount}败，当前第${lastLevel}关`;
      this.log(summary, 'success');
      
      return this.success({
        result: summary,
        currentLevel: lastLevel,
        winCount,
        failCount,
        details: results.slice(-20),
      });
      
    } catch (error) {
      this.log(`失败: ${error.message}`, 'error');
      return this.fail(error.message);
    }
  }
}

module.exports = {
  ScrollDungeonAction,
  action: new ScrollDungeonAction(),
};