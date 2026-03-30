const { ActionBase } = require('../core/action-base');

class AscendHeavenAction extends ActionBase {
  constructor() {
    super({
      id: 'ascendheaven',
      name: '飞升大作战',
      description: '自动报名飞升大作战（单排需材料/匹配无限制/双排需邀请好友）+单排激活备战天赋',
      category: '每日任务',
    });
  }

  getModeInfo(type) {
    const modes = {
      1: { name: '单排模式', requires: '材料', hasSkill: true },
      2: { name: '匹配模式', requires: '无限制', hasSkill: false },
      3: { name: '双排模式', requires: '邀请好友', hasSkill: false },
    };
    return modes[type] || { name: '未知模式', requires: '未知', hasSkill: false };
  }

  getSkillInfo(id) {
    const skills = {
      1: { name: '燃魂决（基础）', rate: '70%', cost: '黄金卷轴*1', next: 2 },
      2: { name: '燃魂决（上层）', rate: '50%', cost: '黄金卷轴*2', next: 3 },
      3: { name: '燃魂决（顶级）', rate: '10%', cost: '黄金卷轴*3', next: null },
    };
    return skills[id] || { name: '未知天赋', rate: '未知', cost: '未知', next: null };
  }

  isConfirmSignupPage(html) {
    if (!html) return false;
    return html.includes('是否确认报名') || html.includes('确认报名');
  }

  extractSignupResult(html) {
    if (!html) return { success: false, message: '无响应', alreadySigned: false };

    if (html.includes('ptlogin2.qq.com')) {
      return { success: false, message: '登录已过期', alreadySigned: false };
    }

    if (html.includes('【已报名】') || html.includes('报名成功') || html.includes('已成功报名')) {
      return { success: true, message: '报名成功', alreadySigned: true };
    }

    if (html.includes('已报名') || html.includes('已参加') || html.includes('已经报名')) {
      return { success: true, message: '已报名', alreadySigned: true };
    }

    if (html.includes('材料不足') || html.includes('缺少材料') || html.includes('玄铁令不足')) {
      return { success: false, message: '材料不足', alreadySigned: false };
    }

    if (html.includes('需要邀请') || html.includes('邀请好友') || html.includes('等待队友')) {
      return { success: false, message: '需要邀请好友', alreadySigned: false };
    }

    if (html.includes('不能参加') || html.includes('无法报名') || html.includes('等级不够')) {
      return { success: false, message: '无法报名', alreadySigned: false };
    }

    if (html.includes('系统繁忙')) {
      return { success: false, message: '系统繁忙', alreadySigned: false };
    }

    return { success: false, message: '未知结果', alreadySigned: false };
  }

  parseSkillPage(html) {
    if (!html) return { currentSkill: 0, canActivate: [] };

    const canActivate = [];
    let currentSkill = 0;

    const basicSection = html.split('燃魂决（基础）')[1] || '';
    const upperSection = html.split('燃魂决（上层）')[1] || '';
    const topSection = html.split('燃魂决（顶级）')[1] || '';

    if (basicSection.includes('已激活')) {
      currentSkill = 1;
    } else if (basicSection.includes('id=1')) {
      canActivate.push(1);
    }

    if (upperSection.includes('已激活')) {
      currentSkill = 2;
    } else if (upperSection.includes('id=2') && currentSkill >= 1) {
      canActivate.push(2);
    }

    if (topSection.includes('已激活')) {
      currentSkill = 3;
    } else if (topSection.includes('id=3') && currentSkill >= 2) {
      canActivate.push(3);
    }

    return { currentSkill, canActivate };
  }

  extractSkillResult(html) {
    if (!html) return { success: false, message: '无响应', activated: false };

    if (html.includes('ptlogin2.qq.com')) {
      return { success: false, message: '登录已过期', activated: false };
    }

    if (html.includes('激活心法成功')) {
      return { success: true, message: '激活心法成功', activated: true };
    }

    if (html.includes('激活成功') || html.includes('天赋激活成功')) {
      return { success: true, message: '激活成功', activated: true };
    }

    if (html.includes('激活失败')) {
      return { success: false, message: '激活失败', activated: false };
    }

    if (html.includes('黄金卷轴不足') || html.includes('卷轴不足')) {
      return { success: false, message: '黄金卷轴不足', activated: false };
    }

    if (html.includes('备战天赋')) {
      return { success: true, message: '返回天赋页面', activated: false };
    }

    return { success: false, message: '未知结果', activated: false };
  }

  async signupMode(type) {
    const modeInfo = this.getModeInfo(type);
    try {
      const viewHtml = await this.request('ascendheaven', { op: 'viewsignup', type });

      if (!viewHtml || viewHtml.includes('ptlogin2.qq.com')) {
        return { ...modeInfo, success: false, message: '登录已过期' };
      }

      const viewResult = this.extractSignupResult(viewHtml);
      if (viewResult.alreadySigned) {
        return { ...modeInfo, ...viewResult };
      }

      if (this.isConfirmSignupPage(viewHtml)) {
        const costMatch = viewHtml.match(/消耗[^\n<]*\*\d+/);
        this.log(`飞升大作战[${modeInfo.name}]：确认报名${costMatch ? `(${costMatch[0]})` : ''}`, 'info');

        const confirmHtml = await this.request('ascendheaven', { op: 'signup', type });
        const confirmResult = this.extractSignupResult(confirmHtml);
        return { ...modeInfo, ...confirmResult };
      }

      return { ...modeInfo, ...viewResult };
    } catch (error) {
      return { ...modeInfo, success: false, message: error.message };
    }
  }

  async activateSkills(count) {
    if (count <= 0) return { success: true, message: '无需激活', activated: 0 };

    this.log(`飞升大作战：开始激活备战天赋，最多尝试${count}次`, 'info');

    try {
      let totalActivated = 0;
      let lastActivatedSkill = 0;

      for (let attempt = 0; attempt < count; attempt++) {
        this.log(`飞升大作战：第${attempt + 1}次尝试，获取天赋页面...`, 'info');
        
        const skillHtml = await this.request('ascendheaven', { op: 'viewprepare' });
        if (!skillHtml || skillHtml.includes('ptlogin2.qq.com')) {
          this.log(`飞升大作战：获取天赋页面失败`, 'error');
          return { success: false, message: '无法获取天赋页面', activated: totalActivated };
        }

        const { currentSkill, canActivate } = this.parseSkillPage(skillHtml);
        this.log(`飞升大作战：当前已激活${currentSkill}级，可激活[${canActivate.join(',')}]`, 'info');

        if (canActivate.length === 0) {
          const currentInfo = this.getSkillInfo(currentSkill);
          const msg = currentSkill > 0 ? `已全部激活，当前${currentInfo.name}` : '无可激活天赋';
          this.log(`飞升大作战：${msg}`, 'success');
          return {
            success: true,
            message: msg,
            activated: currentSkill,
          };
        }

        const skillId = canActivate[0];
        const skillInfo = this.getSkillInfo(skillId);
        this.log(`飞升大作战：准备激活${skillInfo.name}，调用activeskill&id=${skillId}`, 'info');

        const resultHtml = await this.request('ascendheaven', { op: 'activeskill', id: skillId });
        this.log(`飞升大作战：激活请求返回，解析结果...`, 'info');
        
        const result = this.extractSkillResult(resultHtml);
        this.log(`飞升大作战：解析结果=${JSON.stringify(result)}`, 'info');

        if (result.activated) {
          totalActivated++;
          lastActivatedSkill = skillId;
          this.log(`飞升大作战：${skillInfo.name}激活成功！`, 'success');
          await this.delay(1000);
        } else if (result.success) {
          this.log(`飞升大作战：${skillInfo.name}尝试完成(未激活成功)，继续检查...`, 'info');
          await this.delay(500);
        } else {
          this.log(`飞升大作战：${skillInfo.name}激活失败(${result.message})，停止尝试`, 'error');
          break;
        }
      }

      const finalMsg = totalActivated > 0 ? `激活成功${totalActivated}次，最高${this.getSkillInfo(lastActivatedSkill).name}` : '激活失败';
      this.log(`飞升大作战：激活流程结束，${finalMsg}`, totalActivated > 0 ? 'success' : 'error');
      
      return {
        success: totalActivated > 0,
        message: finalMsg,
        activated: lastActivatedSkill,
        totalActivated,
      };
    } catch (error) {
      this.log(`飞升大作战：激活异常 - ${error.message}`, 'error');
      return { success: false, message: error.message, activated: 0 };
    }
  }

  async run(params = {}) {
    const { mode, skillCount = 0 } = params;
    const selectedMode = mode && [1, 2, 3].includes(mode) ? mode : 2;
    const skillAttempts = parseInt(skillCount, 10) || 0;

    let result = await this.signupMode(selectedMode);

    const logStatus = result.success ? 'success' : 'error';
    this.log(`飞升大作战[${result.name}]：${result.message}`, logStatus);

    if (!result.success && selectedMode === 1 && result.message.includes('材料不足')) {
      this.log(`飞升大作战：单排材料不足，切换匹配模式`, 'info');
      result = await this.signupMode(2);
      this.log(`飞升大作战[${result.name}]：${result.message}`, result.success ? 'success' : 'error');
    }

    let skillResult = null;
    if (result.success && selectedMode === 1 && skillAttempts > 0 && this.getModeInfo(selectedMode).hasSkill) {
      this.log(`飞升大作战：开始激活备战天赋`, 'info');
      skillResult = await this.activateSkills(skillAttempts);
    }

    const parts = [`${result.name}: ${result.success ? '报名成功' : result.message}`];
    if (skillResult) {
      parts.push(`备战天赋: ${skillResult.message}`);
    }

    const summary = parts.join('; ');

    return this.success({
      result: summary,
      signup: result,
      skill: skillResult,
      success: result.success,
    });
  }
}

module.exports = {
  AscendHeavenAction,
  action: new AscendHeavenAction(),
};