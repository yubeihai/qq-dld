const { ActionBase } = require('../core/action-base');

class AltarAction extends ActionBase {
  constructor() {
    super({
      id: 'altar',
      name: '帮派祭坛',
      description: '掠夺/偷取物资、转动祭坛轮盘',
      category: '帮派',
    });
  }

  getActionType(html) {
    if (html.includes('掠夺|选择帮派')) return 'rob';
    if (html.includes('偷取|选择帮派')) return 'steal';
    return null;
  }

  isSelectionPage(html) {
    return html.includes('掠夺|选择帮派') || html.includes('偷取|选择帮派') || html.includes('【随机分配】');
  }

  isRouteSelectionPage(html) {
    return html.includes('选择路线') || html.includes('猜猜祭祀物资');
  }

  parseRouteOptions(html) {
    const routes = [];
    const routeRegex = /<a[^>]*cmd=altar&amp;op=(dorob|dosteal)&amp;id=(\d+)">([^<]+)<\/a>/g;
    let match;
    while ((match = routeRegex.exec(html)) !== null) {
      routes.push({
        op: match[1],
        id: match[2],
        direction: match[3].trim(),
      });
    }
    return routes;
  }

  async selectRoute(routeOp, routeId) {
    const html = await this.request('altar', { op: routeOp, id: routeId });
    return { html, result: this.parseActionResult(html, routeOp === 'dorob' ? 'rob' : 'steal') };
  }

  parseFactionList(html, actionType) {
    const factions = [];
    const op = actionType || this.getActionType(html) || 'rob';

    const randomMatch = html.match(/【随机分配】<br \/>([^<]+)<a[^>]*cmd=altar&amp;op=(rob|steal)&amp;id=(\d+)/);
    if (randomMatch) {
      factions.push({
        type: 'random',
        op: randomMatch[2],
        name: randomMatch[1].trim(),
        id: randomMatch[3],
      });
    }

    const warRegex = /【宣战帮派】<br \/>(.*?)<br \/><br \/>【复仇列表】/s;
    const warSection = warRegex.exec(html);
    if (warSection) {
      const warHtml = warSection[1];
      const lines = warHtml.split(/<br \/>/);
      for (const line of lines) {
        const match = line.match(/(.+?)\s*剩余(\d+)次<a[^>]*cmd=altar&amp;op=(rob|steal)&amp;id=(\d+)/);
        if (match) {
          factions.push({
            type: 'war',
            op: match[3],
            name: match[1].trim(),
            remain: parseInt(match[2]),
            id: match[4],
          });
        }
      }
    }

    const revengeRegex = /【复仇列表】<br \/>(.*?)<\/p>/s;
    const revengeSection = revengeRegex.exec(html);
    if (revengeSection) {
      const revengeHtml = revengeSection[1];
      const lines = revengeHtml.split(/<br \/>/);
      for (const line of lines) {
        const match = line.match(/(.+?)\s*(抢|抢+偷)[^<]*<a[^>]*cmd=altar&amp;op=(rob|steal)&amp;id=(\d+)/);
        if (match) {
          factions.push({
            type: 'revenge',
            op: match[3],
            name: match[1].trim(),
            id: match[4],
          });
        }
      }
    }

    return factions;
  }

  parseAltarInfo(html) {
    const info = {
      spinCount: 0,
      level: '',
      material: '',
      shield: '',
      alarm: '',
    };

    const spinMatch = html.match(/剩余次数[：:]\s*(\d+)/);
    if (spinMatch) {
      info.spinCount = parseInt(spinMatch[1]);
    }

    const levelMatch = html.match(/当前等级[：:]\s*([^\n<]+)/);
    if (levelMatch) {
      info.level = levelMatch[1].trim();
    }

    const materialMatch = html.match(/祭祀物资[：:]\s*(\d+\/\d+)/);
    if (materialMatch) {
      info.material = materialMatch[1];
    }

    const shieldMatch = html.match(/剩余[^<]*护盾[：:]\s*(\d+\/\d+)/);
    if (shieldMatch) {
      info.shield = shieldMatch[1];
    }

    const alarmMatch = html.match(/剩余[^<]*警报[：:]\s*(\d+\/\d+)/);
    if (alarmMatch) {
      info.alarm = alarmMatch[1];
    }

    return info;
  }

  parseActionResult(html, actionType) {
    const text = this.extractText(html);

    if (actionType === 'rob') {
      if (text.includes('战胜了') && text.includes('成功掠夺')) {
        const winsMatch = text.match(/战胜了(\d+)人/);
        const materialMatch = text.match(/物资\*(\d+)/);
        const pointsMatch = text.match(/积分\*(\d+)/);
        return {
          success: true,
          wins: winsMatch ? winsMatch[1] : '0',
          material: materialMatch ? materialMatch[1] : '0',
          points: pointsMatch ? pointsMatch[1] : '0',
          message: `战胜${winsMatch ? winsMatch[1] : 0}人，掠夺物资*${materialMatch ? materialMatch[1] : 0}, 积分*${pointsMatch ? pointsMatch[1] : 0}`,
        };
      }
      if (text.includes('失败') || text.includes('战败')) {
        return { success: false, message: '掠夺失败' };
      }
      return { success: true, message: '掠夺完成' };
    }

    if (actionType === 'steal') {
      if (text.includes('战胜了') || text.includes('成功')) {
        const materialMatch = text.match(/物资\*(\d+)/);
        const pointsMatch = text.match(/积分\*(\d+)/);
        return {
          success: true,
          material: materialMatch ? materialMatch[1] : '0',
          points: pointsMatch ? pointsMatch[1] : '0',
          message: `偷取物资*${materialMatch ? materialMatch[1] : 0}, 积分*${pointsMatch ? pointsMatch[1] : 0}`,
        };
      }
      if (text.includes('失败') || text.includes('战败')) {
        return { success: false, message: '偷取失败' };
      }
      return { success: true, message: '偷取完成' };
    }

    return { success: true, message: '操作完成' };
  }

  parseSpinResult(html) {
    const text = this.extractText(html);

    if (text.includes('当前动作尚未完成') || text.includes('不能转动')) {
      return { success: false, needAction: true, message: '需要先完成操作' };
    }

    if (text.includes('次数不足') || text.includes('没有次数')) {
      return { success: false, message: '轮盘次数不足' };
    }

    const rewardMatch = html.match(/找到了[^<]*/);
    if (rewardMatch) {
      return { success: true, message: rewardMatch[0].trim() };
    }

    const gainMatch = html.match(/获得[^<\n]*/);
    if (gainMatch) {
      return { success: true, message: gainMatch[0].trim() };
    }

    if (text.includes('成功') || text.includes('转动')) {
      return { success: true, message: '转动成功' };
    }

    return { success: true, message: '已转动' };
  }

  async doAction(actionType, factionId) {
    let html = await this.request('altar', { op: actionType, id: factionId });
    
    if (this.isRouteSelectionPage(html)) {
      const routes = this.parseRouteOptions(html);
      if (routes.length > 0) {
        const route = routes[0];
        await this.delay(300);
        html = await this.request('altar', { op: route.op, id: route.id });
      }
    }
    
    return { html, result: this.parseActionResult(html, actionType) };
  }

  async spinWheel() {
    const html = await this.request('altar', { op: 'spinwheel' });
    return { html, result: this.parseSpinResult(html) };
  }

  async trySelectFaction(factions, factionType, logDetails) {
    const warFactions = factions.filter(f => f.type === 'war');
    
    if (factionType === 'war' && warFactions.length > 0) {
      for (const faction of warFactions) {
        const opName = faction.op === 'rob' ? '掠夺' : '偷取';
        logDetails.push(`尝试帮派: ${faction.name} (剩余${faction.remain || 0}次)`);
        
        await this.delay(500);
        const actionData = await this.doAction(faction.op, faction.id);
        
        if (actionData.result.success) {
          logDetails.push(`${opName}: ${actionData.result.message}`);
          return { html: actionData.html, success: true, faction };
        } else {
          logDetails.push(`${opName}失败: ${actionData.result.message}，尝试下一个`);
        }
      }
      logDetails.push('所有宣战帮派均失败，尝试随机分配');
    }
    
    const randomFaction = factions.find(f => f.type === 'random');
    if (randomFaction) {
      const opName = randomFaction.op === 'rob' ? '掠夺' : '偷取';
      logDetails.push(`选择帮派: ${randomFaction.name} (${opName})`);
      
      await this.delay(500);
      const actionData = await this.doAction(randomFaction.op, randomFaction.id);
      
      if (actionData.result.success) {
        logDetails.push(`${opName}: ${actionData.result.message}`);
        return { html: actionData.html, success: true, faction: randomFaction };
      } else {
        logDetails.push(`${opName}失败: ${actionData.result.message}`);
        return { html: actionData.html, success: false };
      }
    }
    
    if (factions.length > 0) {
      const faction = factions[0];
      const opName = faction.op === 'rob' ? '掠夺' : '偷取';
      logDetails.push(`选择帮派: ${faction.name} (${opName})`);
      
      await this.delay(500);
      const actionData = await this.doAction(faction.op, faction.id);
      
      return { html: actionData.html, success: actionData.result.success, faction };
    }
    
    logDetails.push('未找到可选帮派');
    return { success: false };
  }

  async run(params = {}) {
    const { action = 'all', factionType = 'war' } = params;
    const logDetails = [];
    const actionStats = { rob: 0, steal: 0, spin: 0 };

    try {
      let html = await this.request('altar');

      if (this.isSelectionPage(html)) {
        const actionType = this.getActionType(html);
        logDetails.push(`【${actionType === 'rob' ? '掠夺' : '偷取'}选择页面】需要先选择帮派`);

        const factions = this.parseFactionList(html, actionType);
        logDetails.push(`发现${factions.length}个可选帮派`);

        const selectResult = await this.trySelectFaction(factions, factionType, logDetails);
        if (selectResult.success && selectResult.html) {
          html = selectResult.html;
          actionStats[selectResult.faction.op]++;
        }
      }

      const info = this.parseAltarInfo(html);

      logDetails.push('【祭坛状况】');
      logDetails.push(`等级: ${info.level || '未知'}`);
      logDetails.push(`物资: ${info.material || '未知'}`);
      logDetails.push(`护盾: ${info.shield || '未知'}`);
      logDetails.push(`警报: ${info.alarm || '未知'}`);
      logDetails.push(`轮盘次数: ${info.spinCount}`);

      if (action === 'info') {
        this.log(logDetails.join('\n'), 'success');
        return this.success({ info, message: '查询成功' });
      }

      if (action === 'rob' || action === 'steal') {
        this.log(logDetails.join('\n'), 'success');
        return this.success({ info, actionStats, message: logDetails.filter(l => l.includes('掠夺') || l.includes('偷取')).join('\n') || '操作完成' });
      }

      if (action === 'spin' || action === 'all') {
        if (info.spinCount <= 0) {
          logDetails.push('轮盘次数不足，无法转动');
          this.log(logDetails.join('\n'), 'info');
          return this.success({ info, spun: 0, message: '轮盘次数不足' });
        }

        logDetails.push(`开始转动轮盘，剩余次数: ${info.spinCount}`);

        let rewards = [];

        for (let i = 0; i < 50; i++) {
          try {
            await this.delay(800);
            const spinData = await this.spinWheel();

            if (spinData.result.needAction) {
              logDetails.push(`第${actionStats.spin + 1}次: 需要先操作`);

              await this.delay(500);
              let actionHtml = await this.request('altar');
              
              if (this.isRouteSelectionPage(actionHtml)) {
                const routes = this.parseRouteOptions(actionHtml);
                if (routes.length > 0) {
                  const route = routes[0];
                  logDetails.push(`  选择路线: ${route.direction}`);
                  await this.delay(300);
                  actionHtml = await this.request('altar', { op: route.op, id: route.id });
                  actionStats[route.op === 'dorob' ? 'rob' : 'steal']++;
                  logDetails.push(`  路线完成`);
                }
              } else if (this.isSelectionPage(actionHtml)) {
                const actionType = this.getActionType(actionHtml);
                const factions = this.parseFactionList(actionHtml, actionType);
                
                const warFactions = factions.filter(f => f.type === 'war');
                let selectSuccess = false;
                
                for (const faction of warFactions) {
                  const opName = faction.op === 'rob' ? '掠夺' : '偷取';
                  logDetails.push(`  尝试帮派: ${faction.name} (剩余${faction.remain || 0}次)`);
                  
                  await this.delay(500);
                  const actionData = await this.doAction(faction.op, faction.id);
                  
                  if (actionData.result.success) {
                    actionStats[faction.op]++;
                    logDetails.push(`  ${opName}: ${actionData.result.message}`);
                    selectSuccess = true;
                    break;
                  } else {
                    logDetails.push(`  ${opName}失败: ${actionData.result.message}`);
                  }
                }
                
                if (!selectSuccess) {
                  const randomFaction = factions.find(f => f.type === 'random') || factions[0];
                  if (randomFaction) {
                    const opName = randomFaction.op === 'rob' ? '掠夺' : '偷取';
                    logDetails.push(`  选择帮派: ${randomFaction.name} (${opName})`);
                    
                    await this.delay(500);
                    const actionData = await this.doAction(randomFaction.op, randomFaction.id);
                    
                    if (actionData.result.success) {
                      actionStats[randomFaction.op]++;
                      logDetails.push(`  ${opName}: ${actionData.result.message}`);
                      selectSuccess = true;
                    } else {
                      logDetails.push(`  ${opName}失败: ${actionData.result.message}`);
                    }
                  }
                }
                
                if (!selectSuccess) {
                  logDetails.push('  所有帮派均失败，停止');
                  break;
                }
              } else {
                logDetails.push('  无法识别页面状态');
                break;
              }
              continue;
            }

            if (!spinData.result.success) {
              logDetails.push(`第${actionStats.spin + 1}次: ${spinData.result.message}`);
              break;
            }

            actionStats.spin++;
            rewards.push(spinData.result.message);
            logDetails.push(`第${actionStats.spin}次: ${spinData.result.message}`);

            const newInfo = this.parseAltarInfo(spinData.html);
            if (newInfo.spinCount <= 0) {
              break;
            }
          } catch (error) {
            logDetails.push(`第${i + 1}次转动异常: ${error.message}`);
            break;
          }
        }

        const summary = `祭坛: 掠夺${actionStats.rob}次, 偷取${actionStats.steal}次, 转动${actionStats.spin}次`;
        logDetails.unshift(summary);
        this.log(logDetails.join('\n'), actionStats.spin > 0 ? 'success' : 'info');

        return this.success({
          info,
          actionStats,
          rewards,
          message: summary,
        });
      }

      this.log(logDetails.join('\n'), 'success');
      return this.success({ info, message: '查询成功' });
    } catch (error) {
      logDetails.push(`执行异常: ${error.message}`);
      this.log(logDetails.join('\n'), 'error');
      return this.fail(error.message);
    }
  }
}

module.exports = {
  AltarAction,
  action: new AltarAction(),
};