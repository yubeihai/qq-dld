const { ActionBase } = require('../core/action-base');

class CalendarAction extends ActionBase {
  constructor() {
    super({
      id: 'calendar',
      name: '乐斗黄历',
      description: '查看今日黄历、运势占卜、领取龟甲奖励',
      category: '每日任务',
    });
  }

  parseCalendarInfo(html) {
    if (!html) return null;
    
    // 提取日期信息
    const yearMatch = html.match(/乐斗(\d+)年/);
    const dateMatch = html.match(/(\d+)月(\d+)日/);
    
    // 提取今日增益
    const bonusMatch = html.match(/今日增益：([^<\n]+)/);
    
    // 提取趣味文本（天气描述）
    const weatherMatch = html.match(/近期乐斗[^<\n]+/);
    
    // 提取今日任务
    const taskMatch = html.match(/今日任务：([^<\n]+)/);
    
    // 提取龟甲完成度
    const turtleMatch = html.match(/今日龟甲完成度：(\d+)\/(\d+)/);
    
    // 检查是否有领取链接（op=2）
    const hasRewardLink = html.includes('cmd=calender') && html.includes('op=2');
    
    return {
      year: yearMatch ? yearMatch[1] : '',
      month: dateMatch ? dateMatch[1] : '',
      day: dateMatch ? dateMatch[2] : '',
      bonus: bonusMatch ? bonusMatch[1].trim() : '',
      weather: weatherMatch ? weatherMatch[0].trim() : '',
      task: taskMatch ? taskMatch[1].trim() : '',
      turtleCurrent: turtleMatch ? parseInt(turtleMatch[1]) : 0,
      turtleTotal: turtleMatch ? parseInt(turtleMatch[2]) : 1,
      hasRewardLink,
    };
  }

  extractRewardLink(html) {
    // 提取领取奖励的链接（op=2）
    const linkMatch = html.match(/href="([^"]*cmd=calender[^"]*op=2[^"]*)"/);
    if (linkMatch) {
      // 将相对链接转换为完整URL，并解码 HTML 实体
      let url = linkMatch[1];
      if (url.startsWith('//')) {
        url = 'https:' + url;
      }
      // 解码 HTML 实体 (&amp; -> &)
      url = url.replace(/&amp;/g, '&');
      return url;
    }
    return null;
  }

  async run(params = {}) {
    try {
      // 获取黄历信息
      const html = await this.request('calender', { op: 0 });
      
      if (!html || html.includes('ptlogin2.qq.com')) {
        return this.fail('登录已过期，请重新扫码登录');
      }

      // 解析黄历信息
      const info = this.parseCalendarInfo(html);
      
      if (!info) {
        return this.fail('无法解析黄历信息');
      }

      let message = `【乐斗黄历】\n`;
      message += `乐斗${info.year}年 ${info.month}月${info.day}日\n`;
      message += `今日增益：${info.bonus}\n`;
      if (info.weather) {
        message += `${info.weather}\n`;
      }
      message += `今日任务：${info.task}\n`;
      message += `龟甲完成度：${info.turtleCurrent}/${info.turtleTotal}`;

      let rewardClaimed = false;
      let rewardMessage = '';

      // 如果龟甲完成度达标且可领取，则领取奖励
      if (info.turtleCurrent >= info.turtleTotal && info.hasRewardLink) {
        const rewardUrl = this.extractRewardLink(html);
        
        if (rewardUrl) {
          await this.delay(1000);
          
          try {
            const rewardHtml = await this.fetchUrl(rewardUrl);
            
            if (rewardHtml) {
              if (rewardHtml.includes('领取成功') || rewardHtml.includes('恭喜') || rewardHtml.includes('获得')) {
                const match = rewardHtml.match(/获得[^<\n]*/);
                rewardMessage = match ? match[0] : '龟甲奖励领取成功';
                rewardClaimed = true;
                message += `\n奖励：${rewardMessage}`;
              } else if (rewardHtml.includes('已领取') || rewardHtml.includes('领过了')) {
                rewardMessage = '龟甲奖励已领取';
                rewardClaimed = true;
                message += `\n奖励：${rewardMessage}`;
              } else {
                rewardMessage = '龟甲奖励领取失败，请手动领取';
                message += `\n奖励：${rewardMessage}`;
              }
            }
          } catch (error) {
            rewardMessage = `领取失败：${error.message}`;
            message += `\n奖励：${rewardMessage}`;
          }
        }
      } else if (info.turtleCurrent < info.turtleTotal) {
        message += `\n提示：龟甲完成度未达标，无法领取`;
      }

      // 运势占卜
      await this.delay(1000);
      const fortuneHtml = await this.request('calender', { op: 3 });
      
      let fortuneMessage = '';
      let fortuneClaimed = false;
      
      if (fortuneHtml && !fortuneHtml.includes('ptlogin2.qq.com')) {
        // 检查是否有占卜按钮
        if (fortuneHtml.includes('占卜</a>') || fortuneHtml.includes('>占卜<')) {
          // 进行占卜领取奖励
          await this.delay(1000);
          const divinationHtml = await this.request('calender', { op: 4 });
          
          if (divinationHtml && !divinationHtml.includes('ptlogin2.qq.com')) {
            // 解析占卜结果
            if (divinationHtml.includes('获得') || divinationHtml.includes('恭喜') || divinationHtml.includes('领取成功')) {
              const match = divinationHtml.match(/获得[^<\n]*/);
              fortuneMessage = match ? match[0] : '占卜奖励领取成功';
              fortuneClaimed = true;
              message += `\n占卜：${fortuneMessage}`;
            } else if (divinationHtml.includes('已占卜') || divinationHtml.includes('已领取')) {
              fortuneMessage = '今日已占卜';
              fortuneClaimed = true;
              message += `\n占卜：${fortuneMessage}`;
            } else {
              // 提取占卜结果的文本内容
              const text = this.extractText(divinationHtml);
              const lines = text.split('\n').filter(l => l.trim());
              if (lines.length > 2) {
                fortuneMessage = lines.slice(2, 6).join(' ').trim();
                message += `\n占卜：${fortuneMessage || '占卜完成'}`;
              } else {
                fortuneMessage = '占卜完成';
                message += `\n占卜：${fortuneMessage}`;
              }
            }
          }
        } else {
          // 已经占卜过，提取结果
          const text = this.extractText(fortuneHtml);
          const lines = text.split('\n').filter(l => l.trim());
          if (lines.length > 2) {
            fortuneMessage = lines.slice(2, 6).join(' ').trim();
            if (fortuneMessage) {
              message += `\n占卜：${fortuneMessage}`;
            }
          }
        }
      }

      this.log(message, rewardClaimed || fortuneClaimed ? 'success' : 'info');

      return this.success({
        result: message,
        info,
        rewardClaimed,
        rewardMessage,
        fortuneMessage,
        fortuneClaimed,
      });

    } catch (error) {
      return this.fail(error.message);
    }
  }
}

module.exports = {
  CalendarAction,
  action: new CalendarAction(),
};