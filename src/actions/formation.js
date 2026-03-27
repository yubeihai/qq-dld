const { ActionBase } = require('../core/action-base');

const FORMATION_TYPES = [
  { id: 1, name: '无字天书' },
  { id: 2, name: '河图洛书' },
  { id: 3, name: '易经八卦' },
  { id: 4, name: '黄帝内经' },
];

const DEFAULT_FORMATIONS = {
  1: [
    { id: '1', name: '毒光剑影' },
    { id: '2', name: '正邪两立' },
    { id: '3', name: '纵剑天下' },
    { id: '9', name: '致命一击' },
    { id: '4', name: '老谋深算' },
    { id: '5', name: '智勇双全' },
    { id: '6', name: '以柔克刚' },
    { id: '7', name: '雕心鹰爪' },
    { id: '8', name: '根骨奇特' },
  ],
  2: [
    { id: '10', name: '左旋之理' },
    { id: '11', name: '象形之理' },
    { id: '12', name: '五行之理' },
    { id: '13', name: '阴阳之理' },
    { id: '14', name: '先天之理' },
    { id: '15', name: '九宫之理' },
    { id: '16', name: '幻方之理' },
    { id: '17', name: '逆克之理' },
    { id: '18', name: '河洛之理' },
  ],
  3: [
    { id: '19', name: '乾为首' },
    { id: '20', name: '坤为腹' },
    { id: '21', name: '震为足' },
    { id: '22', name: '巽为股' },
    { id: '23', name: '坎为耳' },
    { id: '24', name: '离为目' },
    { id: '25', name: '艮为手' },
    { id: '26', name: '兑为口' },
    { id: '27', name: '大道之源' },
  ],
  4: [
    { id: '28', name: '忧患无言' },
    { id: '29', name: '阴阳应象' },
    { id: '30', name: '四时刺逆' },
    { id: '31', name: '阴阳离合' },
    { id: '32', name: '刺节真邪' },
    { id: '33', name: '五音五味' },
    { id: '34', name: '平人绝谷' },
    { id: '35', name: '宝命全形' },
    { id: '36', name: '玉机真藏' },
  ],
};

class FormationAction extends ActionBase {
  constructor() {
    super({
      id: 'formation',
      name: '佣兵助阵',
      description: '提升佣兵助阵属性，完成每日助阵任务',
      category: '佣兵',
    });
  }

  getFormationTypes() {
    return FORMATION_TYPES;
  }

  getDefaultFormations() {
    return DEFAULT_FORMATIONS;
  }

  async scanAllFormations() {
    const allFormations = {};
    
    for (const type of FORMATION_TYPES) {
      try {
        const html = await this.request('formation', { type: 0, formationtype: type.id });
        allFormations[type.id] = this.parseFormationList(html);
        await this.delay(300);
      } catch (error) {
        allFormations[type.id] = DEFAULT_FORMATIONS[type.id] || [];
      }
    }
    
    return allFormations;
  }

  async getFormationList(formationType = 1) {
    const html = await this.request('formation', { type: 0, formationtype: formationType });
    return this.parseFormationList(html);
  }

  parseFormationList(html) {
    if (!html) return [];
    
    const formations = [];
    const decodedHtml = html.replace(/&amp;/g, '&');
    
    const regex = /formationid=(\d+)[^>]*>([^<]+)<\/a>/g;
    let match;
    
    while ((match = regex.exec(decodedHtml)) !== null) {
      formations.push({
        id: match[1],
        name: match[2].trim(),
      });
    }
    
    return formations;
  }

  parseFormationDetail(html) {
    if (!html) return { success: false, message: '无响应' };
    
    const text = this.extractText(html);
    const decodedHtml = html.replace(/&amp;/g, '&');
    
    const nameMatch = text.match(/【([^】]+)】/);
    const name = nameMatch ? nameMatch[1] : '未知助阵';
    
    const powerMatch = text.match(/战斗力[：:]\s*([\d.]+)/);
    const power = powerMatch ? powerMatch[1] : '0';
    
    const upgradeLinks = [];
    const linkRegex = /type=4&formationid=(\d+)&attrindex=(\d+)&times=(\d+)/g;
    let linkMatch;
    
    while ((linkMatch = linkRegex.exec(decodedHtml)) !== null) {
      upgradeLinks.push({
        formationId: linkMatch[1],
        attrIndex: linkMatch[2],
        times: linkMatch[3],
      });
    }
    
    console.log(`[FormationDetail] ${name}: 找到 ${upgradeLinks.length} 个提升链接`);
    
    const attrLines = [];
    const lines = decodedHtml.split(/<br\s*\/?>/i);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('attrindex')) {
        const isMaxLevel = line.includes('已达顶级') || lines[i-1]?.includes('已达顶级');
        
        let attrName = '';
        if (i > 0) {
          const prevLine = lines[i-1];
          const nameMatch = prevLine.match(/([^\n<>]+?)\s*\+[\d.]+%?/);
          if (nameMatch) {
            attrName = nameMatch[1].trim();
          }
        }
        
        const indexMatch = line.match(/attrindex=(\d+)/);
        const attrIndex = indexMatch ? indexMatch[1] : '0';
        
        attrLines.push({
          name: attrName,
          attrIndex,
          isMaxLevel,
        });
        
        console.log(`[FormationDetail] 属性: ${attrName}, index=${attrIndex}, 已满级=${isMaxLevel}`);
      }
    }
    
    const availableLinks = upgradeLinks.filter(link => {
      if (link.times !== '1') return false;
      const attr = attrLines.find(a => a.attrIndex === link.attrIndex);
      const available = !attr || !attr.isMaxLevel;
      console.log(`[FormationDetail] 链接 attrIndex=${link.attrIndex}, times=${link.times}, 可用=${available}`);
      return available;
    });
    
    console.log(`[FormationDetail] ${name}: ${availableLinks.length} 个可用提升链接`);
    
    if (availableLinks.length === 0) {
      if (attrLines.length > 0 && attrLines.every(a => a.isMaxLevel)) {
        return { 
          success: false, 
          message: '所有属性已达顶级',
          name,
          power,
        };
      }
      return { 
        success: false, 
        message: '没有可提升的属性',
        name,
        power,
      };
    }
    
    return {
      success: true,
      name,
      power,
      upgradeLinks: availableLinks,
      allAttrs: attrLines,
    };
  }

  parseUpgradeResult(html) {
    if (!html) return { success: false, message: '无响应' };
    
    const text = this.extractText(html);
    
    if (text.includes('提升成功') || text.includes('经验增加')) {
      return { success: true, message: '提升成功' };
    }
    
    if (text.includes('战斗力') && text.includes('等级')) {
      return { success: true, message: '提升成功' };
    }
    
    if (text.includes('已达顶级') || text.includes('已满级')) {
      return { success: false, message: '已达顶级' };
    }
    
    if (text.includes('不足') || text.includes('没有')) {
      const itemMatch = text.match(/([^，。！\n]+)不足/);
      const item = itemMatch ? itemMatch[1].trim() : '材料';
      return { success: false, message: `${item}不足` };
    }
    
    return { success: true, message: '已执行' };
  }

  async run(params = {}) {
    const { formations = [], action = 'run', upgradeTimes = 3 } = params;
    
    if (action === 'scan') {
      const allFormations = await this.scanAllFormations();
      return this.success({
        types: FORMATION_TYPES,
        formations: allFormations,
      });
    }
    
    if (formations.length === 0) {
      const msg = '请先选择要提升的助阵';
      this.log(msg, 'error');
      return this.fail(msg);
    }
    
    const results = [];
    let successCount = 0;
    let failCount = 0;
    
    for (const config of formations) {
      const formationType = config.type || 1;
      const formationIds = config.ids || [];
      
      if (formationIds.length === 0) continue;
      
      const typeInfo = FORMATION_TYPES.find(t => t.id === formationType) || { name: '未知' };
      
      for (const formationId of formationIds) {
        try {
          const detailHtml = await this.request('formation', { 
            type: 1, 
            formationid: formationId 
          });
          
          console.log(`[Formation] 详情页响应长度: ${detailHtml?.length || 0}`);
          
          const detail = this.parseFormationDetail(detailHtml);
          const formationName = detail.name || DEFAULT_FORMATIONS[formationType]?.find(f => f.id === formationId)?.name || `ID:${formationId}`;
          
          console.log(`[Formation] ${formationName}: success=${detail.success}, upgradeLinks=${detail.upgradeLinks?.length || 0}, attrs=${detail.allAttrs?.length || 0}`);
          
          if (!detail.success) {
            results.push({
              type: formationType,
              typeName: typeInfo.name,
              formationId,
              formationName,
              success: false,
              message: detail.message || '无法获取助阵详情',
            });
            failCount++;
            continue;
          }
          
          if (detail.upgradeLinks.length === 0) {
            results.push({
              type: formationType,
              typeName: typeInfo.name,
              formationId,
              formationName,
              success: false,
              message: '没有可提升的属性',
            });
            failCount++;
            continue;
          }
          
          const link = detail.upgradeLinks.find(l => l.times === '1');
          if (!link) {
            console.log(`[Formation] ${formationName}: 没有找到 times=1 的链接`);
            results.push({
              type: formationType,
              typeName: typeInfo.name,
              formationId,
              formationName,
              success: false,
              message: '没有可提升的属性',
            });
            failCount++;
            continue;
          }
          
          console.log(`[Formation] ${formationName}: 找到提升链接, attrIndex=${link.attrIndex}`);
          
          const attrInfo = detail.allAttrs?.find(a => a.attrIndex === link.attrIndex);
          const attrName = attrInfo?.name || '属性';
          
          let upgradeSuccess = 0;
          let lastMessage = '';
          
          for (let i = 0; i < upgradeTimes; i++) {
            const html = await this.request('formation', { 
              type: 4, 
              formationid: link.formationId, 
              attrindex: link.attrIndex, 
              times: 1 
            });
            
            console.log(`[Formation] 提升请求响应长度: ${html?.length || 0}`);
            
            const result = this.parseUpgradeResult(html);
            lastMessage = result.message;
            
            console.log(`[Formation] 第${i+1}次提升: success=${result.success}, message=${result.message}`);
            
            if (result.success) {
              upgradeSuccess++;
            } else {
              break;
            }
            
            await this.delay(300);
          }
          
          if (upgradeSuccess > 0) {
            results.push({
              type: formationType,
              typeName: typeInfo.name,
              formationId,
              formationName,
              success: true,
              message: `${attrName}提升${upgradeSuccess}次成功`,
            });
            successCount++;
          } else {
            results.push({
              type: formationType,
              typeName: typeInfo.name,
              formationId,
              formationName,
              success: false,
              message: lastMessage || '提升失败',
            });
            failCount++;
          }
          
          await this.delay(500);
        } catch (error) {
          const formationInfo = DEFAULT_FORMATIONS[formationType]?.find(f => f.id === formationId);
          const formationName = formationInfo ? formationInfo.name : `ID:${formationId}`;
          
          results.push({
            type: formationType,
            typeName: typeInfo.name,
            formationId,
            formationName,
            success: false,
            message: error.message,
          });
          failCount++;
        }
      }
    }
    
    if (results.length === 0) {
      const msg = '请先选择要提升的助阵';
      this.log(msg, 'error');
      return this.fail(msg);
    }
    
    const summary = `佣兵助阵提升：${successCount}成功，${failCount}失败`;
    this.log(summary, failCount === 0 ? 'success' : 'error');
    
    return this.success({
      result: summary,
      details: results,
      successCount,
      failCount,
    });
  }
}

module.exports = {
  FormationAction,
  action: new FormationAction(),
  FORMATION_TYPES,
  DEFAULT_FORMATIONS,
};