const { ActionBase } = require('../core/action-base');

class SectAction extends ActionBase {
  constructor() {
    super({
      id: 'sect',
      name: '门派',
      description: '查看门派信息、五花堂任务、金顶挑战、八叶堂训练、万年寺上香',
      category: '门派',
    });
  }

  parseSectInfo(html) {
    if (!html) return null;
    
    if (html.includes('ptlogin2.qq.com') || html.includes('location.replace')) {
      return { needLogin: true };
    }

    const info = {
      sectName: '',
      contribution: 0,
      position: '',
      features: [],
    };

    const sectMatch = html.match(/【(.+?)】/);
    if (sectMatch) {
      info.sectName = sectMatch[1];
    }

    const contribMatch = html.match(/我的门派贡献[：:]\s*(\d+)/);
    if (contribMatch) {
      info.contribution = parseInt(contribMatch[1], 10);
    }

    const posMatch = html.match(/我的门派职位[：:]\s*([^\s<]+)/);
    if (posMatch) {
      info.position = posMatch[1];
    }

    const linkPatterns = [
      { name: '华藏寺', cmd: 'sect_art', op: null },
      { name: '伏虎寺', cmd: 'sect_trump', op: null },
      { name: '金顶', cmd: 'sect', op: 'showcouncil' },
      { name: '五花堂', cmd: 'sect_task', op: null },
      { name: '八叶堂', cmd: 'sect', op: 'showtraining' },
      { name: '万年寺', cmd: 'sect', op: 'showfumigate' },
    ];

    for (const pattern of linkPatterns) {
      if (html.includes(`>${pattern.name}<`)) {
        info.features.push({
          name: pattern.name,
          cmd: pattern.cmd,
          op: pattern.op,
        });
      }
    }

    return info;
  }

  parseTaskList(html) {
    if (!html) return null;
    
    if (html.includes('ptlogin2.qq.com') || html.includes('location.replace')) {
      return { needLogin: true };
    }

    const tasks = [];
    const sections = html.split(/任务(\d+)<br\s*\/>/gi);
    
    for (let i = 1; i < sections.length; i += 2) {
      const taskNum = sections[i];
      const taskContent = sections[i + 1];
      
      if (!taskContent) continue;

      const descMatch = taskContent.match(/^([^<]+?)\s*&nbsp;&nbsp;奖励[：:]?\s*门贡(\d+)/);
      if (!descMatch) continue;

      const desc = descMatch[1].trim();
      const reward = parseInt(descMatch[2], 10);

      const task = {
        index: parseInt(taskNum, 10),
        description: desc,
        reward,
        taskId: null,
        canComplete: false,
        actionLink: null,
      };

      const completeMatch = taskContent.match(/subtype=2&amp;task_id=(\d+)/);
      if (completeMatch) {
        task.taskId = completeMatch[1];
        task.canComplete = true;
      }

      const actionMatch = taskContent.match(/cmd=([^"&\s&]+).*?>(去做任务|切磋|挑战)</);
      if (actionMatch && !task.canComplete) {
        task.actionLink = actionMatch[1];
      }

      tasks.push(task);
    }

    return tasks;
  }

  parseCouncilList(html) {
    if (!html) return null;
    
    if (html.includes('ptlogin2.qq.com') || html.includes('location.replace')) {
      return { needLogin: true };
    }

    const council = [];
    const regex = /(掌门|首座|堂主)[：:]\s*([^<]+?)\s*挑战/g;
    
    let match;
    while ((match = regex.exec(html)) !== null) {
      const rankMap = { '掌门': 1, '首座': 2, '堂主': 3 };
      const rank = rankMap[match[1]];
      const name = match[2].trim();

      const posMatch = html.substring(match.index, match.index + 500).match(/op=trainingwithcouncil&amp;rank=(\d+)&amp;pos=(\d+)/);
      if (posMatch) {
        council.push({
          title: match[1],
          name,
          rank: parseInt(posMatch[1], 10),
          pos: parseInt(posMatch[2], 10),
        });
      }
    }

    return council;
  }

  async run(params = {}) {
    const { action = 'doAll' } = params;

    switch (action) {
      case 'info':
        return this.getSectInfo();
      case 'tasks':
        return this.getTasks();
      case 'completeTask':
        return this.completeTask(params.taskId);
      case 'doAllTasks':
        return this.doAllTasks();
      case 'council':
        return this.getCouncil();
      case 'challengeCouncil':
        return this.challengeCouncil(params.rank, params.pos);
      case 'challengeAllCouncil':
        return this.challengeAllCouncil();
      case 'training':
        return this.getTraining();
      case 'trainingNpc':
        return this.trainingNpc();
      case 'trainingMember':
        return this.trainingMember();
      case 'doAllTraining':
        return this.doAllTraining();
      case 'fumigate':
        return this.getFumigate();
      case 'fumigateFree':
        return this.fumigateFree();
      case 'doAllFumigate':
        return this.doAllFumigate();
      case 'doAll':
        return this.doAll();
      case 'sectTournament':
        return this.sectTournament();
      case 'sectMelee':
        return this.sectMelee();
      default:
        return this.fail(`未知的操作: ${action}`);
    }
  }

  async getSectInfo() {
    try {
      const html = await this.request('sect', {});
      const info = this.parseSectInfo(html);

      if (info && info.needLogin) {
        return this.fail('登录已过期，请重新扫码登录');
      }

      if (!info || !info.sectName) {
        const text = this.extractText(html).substring(0, 300);
        return this.fail(`解析门派信息失败: ${text}`);
      }

      const result = `门派: ${info.sectName}, 贡献: ${info.contribution}, 职位: ${info.position}`;
      this.log(result, 'success');

      return this.success({
        result,
        info,
      });
    } catch (error) {
      return this.fail(error.message);
    }
  }

  async getTasks() {
    try {
      const html = await this.request('sect_task', {});
      const tasks = this.parseTaskList(html);

      if (tasks && tasks.needLogin) {
        return this.fail('登录已过期，请重新扫码登录');
      }

      if (!tasks || tasks.length === 0) {
        const text = this.extractText(html).substring(0, 300);
        return this.fail(`解析任务列表失败: ${text}`);
      }

      const summary = tasks.map(t => `任务${t.index}: ${t.description} (奖励${t.reward}门贡)`).join('\n');
      this.log(`获取到${tasks.length}个任务`, 'success');

      return this.success({
        result: summary,
        tasks,
      });
    } catch (error) {
      return this.fail(error.message);
    }
  }

  async completeTask(taskId) {
    if (!taskId) {
      return this.fail('缺少任务ID');
    }

    try {
      const html = await this.request('sect_task', { subtype: 2, task_id: taskId });
      const text = this.extractText(html);

      if (text.includes('完成') || text.includes('奖励') || text.includes('获得')) {
        this.log(`任务${taskId}完成`, 'success');
        return this.success({ result: '任务完成', taskId });
      }

      return this.success({ result: text.substring(0, 200), taskId });
    } catch (error) {
      return this.fail(error.message);
    }
  }

  async doAllTasks() {
    try {
      const html = await this.request('sect_task', {});
      const tasks = this.parseTaskList(html);

      if (!tasks || tasks.length === 0) {
        return this.fail('没有可执行的任务');
      }

      const results = [];
      let completedCount = 0;
      let totalReward = 0;

      for (const task of tasks) {
        await this.delay(500);
        
        if (task.canComplete && task.taskId) {
          const resultHtml = await this.request('sect_task', { subtype: '2', task_id: task.taskId });
          const text = this.extractText(resultHtml);

          const success = text.includes('完成') || text.includes('奖励') || text.includes('获得') || text.includes('门贡');
          results.push({
            index: task.index,
            description: task.description,
            reward: task.reward,
            taskId: task.taskId,
            success,
          });

          if (success) {
            completedCount++;
            totalReward += task.reward;
          }
        } else if (task.actionLink) {
          const actionHtml = await this.request(task.actionLink, {});
          results.push({
            index: task.index,
            description: task.description,
            reward: task.reward,
            needAction: true,
            success: false,
          });
        } else {
          results.push({
            index: task.index,
            description: task.description,
            reward: task.reward,
            success: false,
            error: '无法解析任务',
          });
        }
      }

      const summary = `完成${completedCount}/${tasks.length}个任务，获得${totalReward}门贡`;
      this.log(summary, completedCount > 0 ? 'success' : 'error');

      return this.success({
        result: summary,
        tasks: results,
        completedCount,
        totalReward,
      });
    } catch (error) {
      return this.fail(error.message);
    }
  }

  async getCouncil() {
    try {
      const html = await this.request('sect', { op: 'showcouncil' });
      const council = this.parseCouncilList(html);

      if (council && council.needLogin) {
        return this.fail('登录已过期，请重新扫码登录');
      }

      if (!council || council.length === 0) {
        const text = this.extractText(html).substring(0, 300);
        return this.fail(`解析金顶信息失败: ${text}`);
      }

      const summary = council.map(c => `${c.title}: ${c.name}`).join('\n');
      this.log(`获取到${council.length}个可挑战对象`, 'success');

      return this.success({
        result: summary,
        council,
      });
    } catch (error) {
      return this.fail(error.message);
    }
  }

  async challengeCouncil(rank, pos) {
    if (!rank || !pos) {
      return this.fail('缺少挑战参数');
    }

    try {
      const html = await this.request('sect', { op: 'trainingwithcouncil', rank, pos });
      const text = this.extractText(html);

      const result = text.includes('胜利') || text.includes('成功') || text.includes('挑战') 
        ? '挑战完成' : text.substring(0, 200);
      
      this.log(`挑战 rank=${rank} pos=${pos}: ${result}`, 'success');
      return this.success({ result, rank, pos });
    } catch (error) {
      return this.fail(error.message);
    }
  }

  async challengeAllCouncil() {
    try {
      const html = await this.request('sect', { op: 'showcouncil' });
      const council = this.parseCouncilList(html);

      if (!council || council.length === 0) {
        return this.fail('没有可挑战的对象');
      }

      const results = [];
      let successCount = 0;

      for (const member of council) {
        await this.delay(500);
        const resultHtml = await this.request('sect', { 
          op: 'trainingwithcouncil', 
          rank: member.rank, 
          pos: member.pos 
        });
        const text = this.extractText(resultHtml);
        const success = text.includes('胜利') || text.includes('成功') || text.includes('挑战');
        
        results.push({
          title: member.title,
          name: member.name,
          success,
        });

        if (success) successCount++;
      }

      const summary = `挑战${successCount}/${council.length}人`;
      this.log(summary, 'success');

      return this.success({
        result: summary,
        challenges: results,
        successCount,
      });
    } catch (error) {
      return this.fail(error.message);
    }
  }

  async getTraining() {
    try {
      const html = await this.request('sect', { op: 'showtraining' });
      const text = this.extractText(html);

      if (html.includes('ptlogin2.qq.com') || html.includes('location.replace')) {
        return this.fail('登录已过期，请重新扫码登录');
      }

      const features = [];
      if (html.includes('trainingwithnpc')) features.push('木桩训练');
      if (html.includes('trainingwithmember')) features.push('同门切磋');
      if (html.includes('secttournament')) features.push('门派邀请赛');
      if (html.includes('sectmelee')) features.push('六门会武');

      this.log(`八叶堂: ${features.join(', ')}`, 'success');
      return this.success({
        result: features.join('\n'),
        features,
      });
    } catch (error) {
      return this.fail(error.message);
    }
  }

  async trainingNpc() {
    try {
      const html = await this.request('sect', { op: 'trainingwithnpc' });
      const text = this.extractText(html);

      const result = text.includes('胜利') || text.includes('成功') || text.includes('训练') 
        ? '木桩训练完成' : text.substring(0, 200);
      
      this.log(result, 'success');
      return this.success({ result });
    } catch (error) {
      return this.fail(error.message);
    }
  }

  async trainingMember() {
    try {
      const html = await this.request('sect', { op: 'trainingwithmember' });
      const text = this.extractText(html);

      const result = text.includes('胜利') || text.includes('成功') || text.includes('切磋') 
        ? '同门切磋完成' : text.substring(0, 200);
      
      this.log(result, 'success');
      return this.success({ result });
    } catch (error) {
      return this.fail(error.message);
    }
  }

  async doAllTraining() {
    try {
      const results = [];
      
      const npcHtml = await this.request('sect', { op: 'trainingwithnpc' });
      const npcText = this.extractText(npcHtml);
      const npcResult = npcText.includes('胜利') || npcText.includes('成功') || npcText.includes('训练') 
        ? '木桩训练完成' : npcText.substring(0, 200);
      results.push({ name: '木桩训练', result: npcResult });

      await this.delay(500);

      const memberHtml = await this.request('sect', { op: 'trainingwithmember' });
      const memberText = this.extractText(memberHtml);
      const memberResult = memberText.includes('胜利') || memberText.includes('成功') || memberText.includes('切磋') 
        ? '同门切磋完成' : memberText.substring(0, 200);
      results.push({ name: '同门切磋', result: memberResult });

      const summary = results.map(r => `${r.name}: ${r.result}`).join('\n');
      this.log(summary, 'success');

      return this.success({ result: summary, results });
    } catch (error) {
      return this.fail(error.message);
    }
  }

  async getFumigate() {
    try {
      const html = await this.request('sect', { op: 'showfumigate' });
      const text = this.extractText(html);

      if (html.includes('ptlogin2.qq.com') || html.includes('location.replace')) {
        return this.fail('登录已过期，请重新扫码登录');
      }

      this.log('万年寺: 普通香炉(20门贡), 高香香炉(40门贡)', 'success');
      return this.success({ 
        result: '普通香炉(20门贡)\n高香香炉(40门贡)',
      });
    } catch (error) {
      return this.fail(error.message);
    }
  }

  async fumigateFree() {
    try {
      const html = await this.request('sect', { op: 'fumigatefreeincense' });
      const text = this.extractText(html);

      const result = text.includes('获得') || text.includes('成功') || text.includes('门贡') 
        ? '点燃普通香炉成功' : text.substring(0, 200);
      
      this.log(result, 'success');
      return this.success({ result });
    } catch (error) {
      return this.fail(error.message);
    }
  }

  async doAllFumigate() {
    try {
      const html = await this.request('sect', { op: 'fumigatefreeincense' });
      const text = this.extractText(html);

      const result = text.includes('获得') || text.includes('成功') || text.includes('门贡') 
        ? '点燃普通香炉成功，获得20门贡' : text.substring(0, 200);
      
      this.log(result, 'success');
      return this.success({ result });
    } catch (error) {
      return this.fail(error.message);
    }
  }

  async sectTournament() {
    try {
      const html = await this.request('secttournament', {});
      const text = this.extractText(html);

      this.log('进入门派邀请赛', 'success');
      return this.success({ result: text.substring(0, 200) });
    } catch (error) {
      return this.fail(error.message);
    }
  }

  async sectMelee() {
    try {
      const html = await this.request('sectmelee', {});
      const text = this.extractText(html);

      this.log('进入六门会武', 'success');
      return this.success({ result: text.substring(0, 200) });
    } catch (error) {
      return this.fail(error.message);
    }
  }

  async doAll() {
    const results = [];

    const trainingResult = await this.doAllTraining();
    results.push({ name: '八叶堂训练', success: trainingResult.success, result: trainingResult.success ? trainingResult.data?.result : trainingResult.error });
    await this.delay(500);

    const fumigateResult = await this.doAllFumigate();
    results.push({ name: '万年寺上香', success: fumigateResult.success, result: fumigateResult.success ? fumigateResult.data?.result : fumigateResult.error });
    await this.delay(500);

    const councilResult = await this.challengeAllCouncil();
    results.push({ name: '金顶挑战', success: councilResult.success, result: councilResult.success ? councilResult.data?.result : councilResult.error });
    await this.delay(500);

    const tasksResult = await this.doAllTasks();
    results.push({ name: '五花堂任务', success: tasksResult.success, result: tasksResult.success ? tasksResult.data?.result : tasksResult.error });
    await this.delay(500);

    const tasksResult2 = await this.doAllTasks();
    if (tasksResult2.success && tasksResult2.data?.completedCount > 0) {
      results.push({ name: '五花堂任务(补充)', success: true, result: tasksResult2.data?.result });
    }

    const successCount = results.filter(r => r.success).length;
    const summary = `完成${successCount}/${results.length}项`;

    this.log(summary, 'success');
    return this.success({ result: summary, results });
  }
}

module.exports = {
  SectAction,
  action: new SectAction(),
};