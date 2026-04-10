const { ActionBase } = require('../core/action-base');
const { knightMissionTypes, knightMissionConfigs } = require('../db');

class KnightIslandAction extends ActionBase {
  constructor() {
    super({
      id: 'knightisland',
      name: '侠客岛',
      description: '侠客岛：群侠名册、侠客行任务、风月宝鉴配饰',
      category: '每日任务',
    });
    this.defaultInterval = 500;
  }

  extractText(html) {
    if (!html) return '';
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  parseMainPage(html) {
    if (!html) return { success: false, message: '无响应' };
    
    if (html.includes('ptlogin2.qq.com') || html.includes('location.replace')) {
      return { success: false, message: '登录已过期' };
    }
    
    const links = this.extractLinks(html);
    const menus = [];
    
    if (links.some(l => l.href && l.href.includes('op=viewformationindex'))) {
      menus.push({ id: 'formation', name: '群侠名册' });
    }
    if (links.some(l => l.href && l.href.includes('op=viewmissionindex'))) {
      menus.push({ id: 'mission', name: '侠客行' });
    }
    if (links.some(l => l.href && l.href.includes('op=viewaccessoryindex'))) {
      menus.push({ id: 'accessory', name: '风月宝鉴' });
    }
    
    return { success: true, menus };
  }

  parseFormationIndex(html) {
    if (!html) return { success: false, message: '无响应', formations: [] };
    
    const text = this.extractText(html);
    const formations = [];
    
    const linkRegex = /cmd=knight_island[^"]*op=viewformation[^"]*id=(\d+)[^"]*"[^>]*>([^<]+)<\/a>/gi;
    let match;
    
    while ((match = linkRegex.exec(html)) !== null) {
      formations.push({
        id: match[1],
        name: match[2].trim(),
      });
    }
    
    const levelMatch = text.match(/等级[：:]\s*(\d+)/);
    const expMatch = text.match(/经验[：:]\s*(\d+)\s*\/\s*(\d+)/);
    
    return {
      success: true,
      formations,
      level: levelMatch ? parseInt(levelMatch[1]) : null,
      exp: expMatch ? { current: parseInt(expMatch[1]), max: parseInt(expMatch[2]) } : null,
      text,
    };
  }

  parseMissionIndex(html) {
    if (!html) return { success: false, message: '无响应', missions: [] };
    
    const text = this.extractText(html);
    const missions = [];
    
    const acceptedMatch = text.match(/今日可接受任务[：:]\s*(\d+)\s*\/\s*(\d+)/);
    const accepted = acceptedMatch ? { current: parseInt(acceptedMatch[1]), max: parseInt(acceptedMatch[2]) } : { current: 0, max: 3 };
    
    const refreshMatch = text.match(/今日免费刷新剩余[：:]\s*(\d+)次/);
    const refreshCount = refreshMatch ? { current: parseInt(refreshMatch[1]), max: 4 } : null;
    
    const missionBlocks = html.split(/<br\s*\/?>/i);
    let currentMission = null;
    
    for (const block of missionBlocks) {
      const cleanBlock = block.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim();
      
      const acceptLinkMatch = block.match(/op=viewmissiondetail[^"]*pos=(\d+)/);
      const refreshLinkMatch = block.match(/op=refreshmission[^"]*pos=(\d+)/);
      const claimLinkMatch = block.match(/op=claimmissionreward[^"]*pos=(\d+)/);
      const inProgressMatch = cleanBlock.includes('执行中') || cleanBlock.match(/剩余\d+小时\d+分/);
      
      const nameMatch = cleanBlock.match(/^([^（(（]+?)（需要[^）)]+）/);
      if (nameMatch) {
        const fullName = nameMatch[0];
        const name = nameMatch[1].trim();
        const requireMatch = fullName.match(/需要([^）)]+)/);
        const require = requireMatch ? requireMatch[1].trim() : '';
        
        const posMatch = block.match(/pos=(\d+)/);
        const pos = posMatch ? parseInt(posMatch[1]) : missions.length;
        
        let status = 'available';
        if (inProgressMatch) {
          status = 'in_progress';
        } else if (claimLinkMatch) {
          status = 'can_claim';
        }
        
        currentMission = {
          pos,
          name,
          require,
          status,
          canAccept: status === 'available' && !!acceptLinkMatch,
          canRefresh: !!refreshLinkMatch,
          canClaim: !!claimLinkMatch,
        };
        missions.push(currentMission);
        continue;
      }
      
      if (currentMission) {
        const remainingMatch = cleanBlock.match(/剩余(\d+)小时(\d+)分/);
        if (remainingMatch) {
          currentMission.remainingHours = parseInt(remainingMatch[1]);
          currentMission.remainingMinutes = parseInt(remainingMatch[2]);
          currentMission.status = 'in_progress';
        }
        
        const durationMatch = cleanBlock.match(/任务时长[：:]\s*(\d+)\s*小时/);
        if (durationMatch) {
          currentMission.duration = parseInt(durationMatch[1]);
        }
        
        const rewardMatch = cleanBlock.match(/任务奖励[：:]\s*([^<\n]+)/);
        if (rewardMatch) {
          currentMission.reward = rewardMatch[1].trim();
        }
      }
    }
    
    return {
      success: true,
      missions,
      accepted,
      refreshCount,
      text,
    };
  }

  parseAccessoryIndex(html) {
    if (!html) return { success: false, message: '无响应', accessories: [] };
    
    const text = this.extractText(html);
    const accessories = [];
    
    const linkRegex = /cmd=knight_island[^"]*op=viewaccessory[^"]*id=(\d+)[^"]*"[^>]*>([^<]+)<\/a>/gi;
    let match;
    
    while ((match = linkRegex.exec(html)) !== null) {
      accessories.push({
        id: match[1],
        name: match[2].trim(),
      });
    }
    
    return {
      success: true,
      accessories,
      text,
    };
  }

  parseActionResult(html) {
    if (!html) return { success: false, message: '无响应' };
    
    if (html.includes('ptlogin2.qq.com') || html.includes('location.replace')) {
      return { success: false, message: '登录已过期' };
    }
    
    const text = this.extractText(html);
    
    if (text.includes('成功') || text.includes('完成')) {
      const match = text.match(/([^。\n]{0,30}(成功|完成)[^。\n]{0,30})/);
      return { success: true, message: match ? match[1] : '操作成功', text };
    }
    
    if (text.includes('失败') || text.includes('不足') || text.includes('无法')) {
      const match = text.match(/([^。\n]{0,30}(失败|不足|无法)[^。\n]{0,30})/);
      return { success: false, message: match ? match[1] : '操作失败', text };
    }
    
    if (text.includes('已领取') || text.includes('已接取')) {
      return { success: true, message: '已完成', text };
    }
    
    return { success: true, message: '已执行', text };
  }

  async getMainPage() {
    const html = await this.request('knight_island', {});
    return this.parseMainPage(html);
  }

  async getFormationIndex() {
    const html = await this.request('knight_island', { op: 'viewformationindex' });
    return this.parseFormationIndex(html);
  }

  async getFormation(id) {
    const html = await this.request('knight_island', { op: 'viewformation', id: String(id) });
    return this.parseActionResult(html);
  }

  async activateFormation(id) {
    const html = await this.request('knight_island', { op: 'activateformation', id: String(id) });
    return this.parseActionResult(html);
  }

  async getMissionIndex() {
    const html = await this.request('knight_island', { op: 'viewmissionindex' });
    return this.parseMissionIndex(html);
  }

  async acceptMission(pos = 0) {
    const detailHtml = await this.request('knight_island', { op: 'viewmissiondetail', pos: String(pos) });
    
    if (detailHtml.includes('快速委派')) {
      const assignHtml = await this.request('knight_island', { op: 'autoassign', pos: String(pos) });
      await this.delay(this.defaultInterval);
      
      const beginHtml = await this.request('knight_island', { op: 'begin', pos: String(pos) });
      return this.parseActionResult(beginHtml);
    }
    
    if (detailHtml.includes('开始任务')) {
      const beginHtml = await this.request('knight_island', { op: 'begin', pos: String(pos) });
      return this.parseActionResult(beginHtml);
    }
    
    return this.parseActionResult(detailHtml);
  }

  async refreshMission(pos = 0) {
    const html = await this.request('knight_island', { op: 'refreshmission', pos: String(pos) });
    return this.parseActionResult(html);
  }

  async claimMissionReward(pos = 0) {
    const html = await this.request('knight_island', { op: 'claimmissionreward', pos: String(pos) });
    return this.parseActionResult(html);
  }

  async getAccessoryIndex() {
    const html = await this.request('knight_island', { op: 'viewaccessoryindex' });
    return this.parseAccessoryIndex(html);
  }

  async getAccessory(id) {
    const html = await this.request('knight_island', { op: 'viewaccessory', id: String(id) });
    return this.parseActionResult(html);
  }

  async enhanceAccessory(id, guaranteed = false) {
    const params = { op: 'enhanceaccessory', id: String(id) };
    if (guaranteed) {
      params.guaranteed = '1';
    }
    const html = await this.request('knight_island', params);
    return this.parseActionResult(html);
  }

  isMissionInDb(name) {
    return knightMissionTypes.getByName(name) !== null;
  }

  isMissionEnabled(name) {
    const config = knightMissionConfigs.getByName(name);
    if (!config) return false;
    return config.enabled === 1;
  }

  saveNewMission(mission) {
    knightMissionTypes.upsert(mission.name, mission.reward || '', mission.duration || 0);
  }

  saveNewMissions(missions) {
    for (const m of missions) {
      if (!this.isMissionInDb(m.name)) {
        this.saveNewMission(m);
      }
    }
  }

  saveMissionTypes(missions) {
    if (missions && missions.length > 0) {
      this.saveNewMissions(missions);
    }
  }

  async runAutoMission() {
    const results = [];
    
    const missionIndex = await this.getMissionIndex();
    if (!missionIndex.success) {
      return { success: false, message: missionIndex.message, results };
    }
    
    const newMissions = missionIndex.missions.filter(m => !this.isMissionInDb(m.name));
    if (newMissions.length > 0) {
      this.saveNewMissions(newMissions);
      results.push({ 
        action: '发现新任务', 
        success: true, 
        message: `新增 ${newMissions.length} 个任务到任务库` 
      });
    }
    
    const canClaimMissions = missionIndex.missions.filter(m => m.canClaim);
    if (canClaimMissions.length > 0) {
      for (const mission of canClaimMissions) {
        const claimResult = await this.claimMissionReward(mission.pos);
        results.push({ 
          action: '领取奖励', 
          ...claimResult, 
          mission: mission.name,
          reward: mission.reward 
        });
        
        if (claimResult.success) {
          await this.delay(this.defaultInterval);
        }
      }
    }
    
    const inProgressMissions = missionIndex.missions.filter(m => m.status === 'in_progress');
    if (inProgressMissions.length > 0) {
      results.push({ 
        action: '执行中任务', 
        success: true, 
        message: inProgressMissions.map(m => `${m.name}(剩余${m.remainingHours || 0}时${m.remainingMinutes || 0}分)`).join('、') 
      });
    }
    
    results.push({ 
      action: '查看侠客行', 
      success: true, 
      message: `可接${missionIndex.accepted.current}/${missionIndex.accepted.max}` 
    });
    
    if (missionIndex.accepted.current >= missionIndex.accepted.max) {
      return { success: true, message: '今日任务已满', results };
    }
    
    let refreshRemaining = missionIndex.refreshCount ? missionIndex.refreshCount.current : 4;
    const maxRefreshPerPos = 3;
    const refreshUsed = { 0: 0, 1: 0, 2: 0 };
    
    let acceptedCount = 0;
    const targetCount = missionIndex.accepted.max - missionIndex.accepted.current;
    
    let currentIndex = missionIndex;
    
    while (acceptedCount < targetCount) {
      for (const mission of currentIndex.missions) {
        if (acceptedCount >= targetCount) break;
        
        if (mission.canClaim) {
          const claimResult = await this.claimMissionReward(mission.pos);
          results.push({ 
            action: '领取奖励', 
            ...claimResult, 
            mission: mission.name,
            reward: mission.reward 
          });
          await this.delay(this.defaultInterval);
          continue;
        }
        
        const enabled = this.isMissionEnabled(mission.name);
        
        if (enabled && mission.canAccept) {
          const acceptResult = await this.acceptMission(mission.pos);
          results.push({ 
            action: '接受任务', 
            ...acceptResult, 
            mission: mission.name,
            reward: mission.reward 
          });
          
          if (acceptResult.success) {
            acceptedCount++;
            await this.delay(this.defaultInterval);
          }
        }
      }
      
      if (acceptedCount >= targetCount) break;
      
      let refreshed = false;
      for (const mission of currentIndex.missions) {
        if (acceptedCount >= targetCount) break;
        if (refreshRemaining <= 0) break;
        
        const enabled = this.isMissionEnabled(mission.name);
        
        // 修复：刷新任何「不能接受」的任务，而不仅仅是「未启用」的任务
        if (!mission.canAccept && mission.canRefresh && refreshUsed[mission.pos] < maxRefreshPerPos) {
          const refreshResult = await this.refreshMission(mission.pos);
          results.push({ 
            action: '刷新任务', 
            ...refreshResult,
            mission: mission.name 
          });
          
          if (refreshResult.success) {
            refreshUsed[mission.pos]++;
            refreshRemaining--;
            refreshed = true;
            await this.delay(this.defaultInterval);
            
            const newIndex = await this.getMissionIndex();
            if (newIndex.success) {
              const newInLoop = newIndex.missions.filter(m => !this.isMissionInDb(m.name));
              if (newInLoop.length > 0) {
                this.saveNewMissions(newInLoop);
                results.push({ 
                  action: '发现新任务', 
                  success: true, 
                  message: `新增 ${newInLoop.length} 个任务` 
                });
              }
              
              const refreshedMission = newIndex.missions[mission.pos];
              if (refreshedMission) {
                if (refreshedMission.canClaim) {
                  const claimResult = await this.claimMissionReward(refreshedMission.pos);
                  results.push({ 
                    action: '领取奖励', 
                    ...claimResult, 
                    mission: refreshedMission.name,
                    reward: refreshedMission.reward 
                  });
                  await this.delay(this.defaultInterval);
                } else {
                  const newEnabled = this.isMissionEnabled(refreshedMission.name);
                  
                  if (newEnabled && refreshedMission.canAccept) {
                    const acceptResult = await this.acceptMission(refreshedMission.pos);
                    results.push({ 
                      action: '接受任务', 
                      ...acceptResult, 
                      mission: refreshedMission.name,
                      reward: refreshedMission.reward 
                    });
                    
                    if (acceptResult.success) {
                      acceptedCount++;
                      await this.delay(this.defaultInterval);
                    }
                  }
                }
              }
              
              currentIndex = newIndex;
            }
          }
          
          break;
        }
      }
      
      if (!refreshed || refreshRemaining <= 0) break;
    }
    
    if (acceptedCount < targetCount && refreshRemaining <= 0) {
      results.push({ 
        action: '刷新次数用尽', 
        success: true, 
        message: '尝试接受所有可用任务' 
      });
      
      const finalIndex = await this.getMissionIndex();
      if (finalIndex.success) {
        const newInFinal = finalIndex.missions.filter(m => !this.isMissionInDb(m.name));
        if (newInFinal.length > 0) {
          this.saveNewMissions(newInFinal);
        }
        
        for (const mission of finalIndex.missions) {
          if (acceptedCount >= targetCount) break;
          
          if (mission.canAccept) {
            const acceptResult = await this.acceptMission(mission.pos);
            results.push({ 
              action: '强制接受', 
              ...acceptResult, 
              mission: mission.name,
              reward: mission.reward 
            });
            
            if (acceptResult.success) {
              acceptedCount++;
              await this.delay(this.defaultInterval);
            }
          }
        }
      }
    }
    
    return { 
      success: true, 
      results,
      acceptedCount,
      refreshUsed: Object.values(refreshUsed).reduce((a, b) => a + b, 0),
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async run(params = {}) {
    const { op = 'all', id, pos = 0, guaranteed } = params;

    switch (op) {
      case 'view':
      case 'main': {
        const result = await this.getMainPage();
        this.log(`查看侠客岛主页: ${result.message || '成功'}`, result.success ? 'success' : 'error');
        return result.success ? this.success(result) : this.fail(result.message);
      }
      
      case 'viewformationindex':
      case 'formation': {
        const result = await this.getFormationIndex();
        this.log(`查看群侠名册: ${result.message || '成功'}`, result.success ? 'success' : 'error');
        return result.success ? this.success(result) : this.fail(result.message);
      }
      
      case 'viewformation': {
        if (!id) return this.fail('缺少名册ID');
        const result = await this.getFormation(id);
        this.log(`查看名册${id}: ${result.message}`, result.success ? 'success' : 'error');
        return result.success ? this.success(result) : this.fail(result.message);
      }
      
      case 'activateformation': {
        if (!id) return this.fail('缺少名册ID');
        const result = await this.activateFormation(id);
        this.log(`激活名册${id}: ${result.message}`, result.success ? 'success' : 'error');
        return result.success ? this.success(result) : this.fail(result.message);
      }
      
      case 'viewmissionindex':
      case 'mission': {
        const result = await this.getMissionIndex();
        this.saveNewMissions(result.missions || []);
        this.log(`查看侠客行: ${result.message || '成功'}`, result.success ? 'success' : 'error');
        return result.success ? this.success(result) : this.fail(result.message);
      }
      
      case 'acceptmission':
      case 'viewmissiondetail': {
        const result = await this.acceptMission(pos);
        this.log(`接受任务[pos=${pos}]: ${result.message}`, result.success ? 'success' : 'error');
        return result.success ? this.success(result) : this.fail(result.message);
      }
      
      case 'refreshmission': {
        const result = await this.refreshMission(pos);
        this.log(`刷新任务[pos=${pos}]: ${result.message}`, result.success ? 'success' : 'error');
        return result.success ? this.success(result) : this.fail(result.message);
      }
      
      case 'claimreward': {
        const result = await this.claimMissionReward(pos);
        this.log(`领取奖励[pos=${pos}]: ${result.message}`, result.success ? 'success' : 'error');
        return result.success ? this.success(result) : this.fail(result.message);
      }
      
      case 'automission': {
        const result = await this.runAutoMission();
        const summary = result.results.map(r => `${r.action}: ${r.message}${r.mission ? ` (${r.mission})` : ''}`).join('\n');
        this.log(`自动侠客行:\n${summary}`, result.success ? 'success' : 'error');
        return result.success ? this.success({ result: summary, results: result.results, acceptedCount: result.acceptedCount }) : this.fail(result.message);
      }
      
      case 'viewaccessoryindex':
      case 'accessory': {
        const result = await this.getAccessoryIndex();
        this.log(`查看风月宝鉴: ${result.message || '成功'}`, result.success ? 'success' : 'error');
        return result.success ? this.success(result) : this.fail(result.message);
      }
      
      case 'viewaccessory': {
        if (!id) return this.fail('缺少配饰ID');
        const result = await this.getAccessory(id);
        this.log(`查看配饰${id}: ${result.message}`, result.success ? 'success' : 'error');
        return result.success ? this.success(result) : this.fail(result.message);
      }
      
      case 'enhanceaccessory': {
        if (!id) return this.fail('缺少配饰ID');
        const result = await this.enhanceAccessory(id, guaranteed);
        this.log(`强化配饰${id}: ${result.message}`, result.success ? 'success' : 'error');
        return result.success ? this.success(result) : this.fail(result.message);
      }
      
      case 'all':
      default: {
        const result = await this.runAutoMission();
        const summary = result.results.map(r => `${r.action}: ${r.message}${r.mission ? ` (${r.mission})` : ''}`).join('\n');
        this.log(`侠客岛自动执行:\n${summary}`, result.success ? 'success' : 'error');
        return result.success ? this.success({ result: summary, results: result.results, acceptedCount: result.acceptedCount }) : this.fail(result.message);
      }
    }
  }
}

module.exports = {
  KnightIslandAction,
  action: new KnightIslandAction(),
};