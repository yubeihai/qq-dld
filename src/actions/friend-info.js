const { ActionBase } = require('../core/action-base');
const { friends } = require('../db');

class FriendInfoAction extends ActionBase {
  constructor() {
    super({
      id: 'friendinfo',
      name: '好友资料',
      description: '查看好友/帮友/侠侣详细资料',
      category: '好友',
    });
  }

  parseFriendInfo(html, uid = null) {
    if (!html) {
      return null;
    }

    const info = {};

    const uidMatch = html.match(/B_UID=(\d+)/);
    info.uid = uid || (uidMatch ? uidMatch[1] : null);

    const nameMatch = html.match(/cmd=totalinfo[^>]*>([^<]+)</);
    if (nameMatch) {
      info.name = nameMatch[1].replace(/&nbsp;/g, ' ').trim();
    }

    const levelMatch = html.match(/(\d+)级\s+([^<a-z]+)/i);
    if (levelMatch) {
      info.level = parseInt(levelMatch[1], 10);
      info.sect = levelMatch[2].trim();
    }

    const vipMatch = html.match(/<img src="[^"]*vip\.gif"[^>]*alt="VIP"/);
    info.isVip = !!vipMatch;

    const titleMatch = html.match(/(\d+级\s+[^<]+)<br \/>神拳/);
    if (titleMatch) {
      info.title = '神拳';
    }

    const stats = {};
    const statMatches = html.match(/(力量|敏捷|速度|体质|等级|战斗力)：(\d+)/g);
    if (statMatches) {
      statMatches.forEach(match => {
        const [, name, value] = match.match(/(力量 | 敏捷 | 速度 | 体质 | 等级 | 战斗力)：(\d+)/);
        stats[name] = parseInt(value, 10);
      });
      info.stats = stats;
    }

    const weapons = [];
    const weaponRegex = /<img src="[^"]*item[^"]*"[^>]*alt="([^"]+)"/g;
    let weaponMatch;
    while ((weaponMatch = weaponRegex.exec(html)) !== null) {
      weapons.push(weaponMatch[1]);
    }
    if (weapons.length > 0) {
      info.weapons = weapons;
    }

    const skills = [];
    const skillRegex = /<img src="[^"]*skill[^"]*"[^>]*alt="([^"]+)"/g;
    let skillMatch;
    while ((skillMatch = skillRegex.exec(html)) !== null) {
      skills.push(skillMatch[1]);
    }
    if (skills.length > 0) {
      info.skills = skills;
    }

    return info;
  }

  async run(params = {}) {
    const { uid, name, limit = 5 } = params;

    let targetUids = [];

    if (uid) {
      targetUids = [uid];
    } else if (name) {
      const allFriends = friends.getAll();
      const friend = allFriends.find(f => f.name.includes(name));
      if (!friend) {
        return this.fail(`未找到好友：${name}`);
      }
      targetUids = [friend.uid];
    } else {
      const allFriends = friends.getAll();
      if (allFriends.length === 0) {
        return this.fail('好友列表为空，请先扫描好友');
      }
      const selected = allFriends.slice(0, limit);
      targetUids = selected.map(f => f.uid);
    }

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < targetUids.length; i++) {
      const uid = targetUids[i];

      try {
        const html = await this.request('totalinfo', {
          B_UID: uid,
          page: '1',
          type: '1',
        });
        const info = this.parseFriendInfo(html, uid);

        if (!info) {
          results.push({ uid, success: false, error: '无法解析资料' });
          failCount++;
          continue;
        }

        let result = `【${info.name || '未知'}】\n`;
        result += `UID: ${info.uid}\n`;

        if (info.level) {
          result += `等级：${info.level}级`;
          if (info.sect) {
            result += ` (${info.sect})`;
          }
          result += '\n';
        }

        if (info.isVip) {
          result += 'VIP: 是\n';
        }

        if (info.title) {
          result += `称号：${info.title}\n`;
        }

        if (info.stats) {
          result += '属性:\n';
          if (info.stats.力量) result += `  力量：${info.stats.力量}\n`;
          if (info.stats.敏捷) result += `  敏捷：${info.stats.敏捷}\n`;
          if (info.stats.速度) result += `  速度：${info.stats.速度}\n`;
          if (info.stats.体质) result += `  体质：${info.stats.体质}\n`;
          if (info.stats.战斗力) result += `  战斗力：${info.stats.战斗力}\n`;
        }

        if (info.weapons && info.weapons.length > 0) {
          result += `武器：${info.weapons.join('、')}\n`;
        }

        if (info.skills && info.skills.length > 0) {
          result += `技能：${info.skills.join('、')}\n`;
        }

        results.push({ ...info, success: true });
        successCount++;
        this.log(result, 'success');

        if (i < targetUids.length - 1) {
          await this.delay(500);
        }
      } catch (error) {
        results.push({ uid, success: false, error: error.message });
        failCount++;
        this.log(`获取好友 ${uid} 资料失败：${error.message}`, 'error');
      }
    }

    const summary = `查看资料：${successCount}成功，${failCount}失败`;
    this.log(summary, successCount > 0 ? 'success' : 'error');

    return this.success({
      result: summary,
      friends: results,
      successCount,
      failCount,
    });
  }
}

module.exports = {
  FriendInfoAction,
  action: new FriendInfoAction(),
};
