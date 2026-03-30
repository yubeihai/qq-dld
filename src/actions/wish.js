const { ActionBase } = require('../core/action-base');

class WishAction extends ActionBase {
  constructor() {
    super({
      id: 'wish',
      name: '每日许愿',
      description: '每日首胜后许愿，连续许愿 3 天可领取魂珠碎片宝箱',
      category: '每日任务',
    });
  }

  parseWishPage(html) {
    if (!html) {
      return { error: '无响应' };
    }

    if (html.includes('ptlogin2.qq.com') || html.includes('location.replace')) {
      return { error: '登录已过期' };
    }

    const info = {
      continuousDays: 0,
      continuousDaysMax: 3,
      canClaimContinuous: false,
      wishCardFragments: 0,
      wishCardFragmentsMax: 10,
      canWish: false,
      wishOptions: [],
      raw: html,
    };

    const continuousMatch = html.match(/连续许愿\d+天（(\d+)\/(\d+)）/);
    if (continuousMatch) {
      info.continuousDays = parseInt(continuousMatch[1]);
      info.continuousDaysMax = parseInt(continuousMatch[2]);
      info.canClaimContinuous = html.includes('cmd=wish') && html.includes('sub=6');
    }

    const fragmentMatch = html.match(/许愿卡碎片（(\d+)\/(\d+)）/);
    if (fragmentMatch) {
      info.wishCardFragments = parseInt(fragmentMatch[1]);
      info.wishCardFragmentsMax = parseInt(fragmentMatch[2]);
    }

    const wishEntryLink = this.extractLinks(html).find(link => 
      link.url && link.url.includes('cmd=wish') && link.url.includes('sub=4')
    );
    if (wishEntryLink) {
      info.wishEntryUrl = wishEntryLink.url;
    }

    const wishLinks = this.extractLinks(html).filter(link => 
      link.url && link.url.includes('cmd=wish') && link.url.includes('sub=1')
    );
    info.wishOptions = wishLinks;
    info.canWish = wishLinks.length > 0 || wishEntryLink;

    return info;
  }

  async run(params = {}) {
    const results = [];
    let successCount = 0;
    let failCount = 0;

    let html;
    try {
      html = await this.fetchUrl('https://dld.qzapp.z.qq.com/qpet/cgi-bin/phonepk?zapp_uin=&B_UID=0&sid=&channel=0&g_ut=1&cmd=wish');
      if (!html || html.includes('ptlogin2.qq.com')) {
        return this.fail('登录已过期，请重新扫码登录');
      }
    } catch (error) {
      return this.fail(error.message);
    }

    let pageInfo = this.parseWishPage(html);
    
    if (pageInfo.error) {
      return this.fail(pageInfo.error);
    }

    const summary = `许愿状态：连续${pageInfo.continuousDays}/${pageInfo.continuousDaysMax}天，许愿卡碎片${pageInfo.wishCardFragments}/${pageInfo.wishCardFragmentsMax}`;
    
    if (pageInfo.canClaimContinuous) {
      try {
        const claimHtml = await this.fetchUrl('https://dld.qzapp.z.qq.com/qpet/cgi-bin/phonepk?zapp_uin=&sid=&channel=0&g_ut=1&cmd=wish&sub=6');
        const claimResult = this.extractResult(claimHtml, '连续许愿奖励');
        
        results.push({
          name: '连续许愿奖励',
          success: claimResult.success,
          message: claimResult.message,
        });
        
        if (claimResult.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        results.push({
          name: '连续许愿奖励',
          success: false,
          message: error.message,
        });
        failCount++;
      }
    }

    if (pageInfo.wishEntryUrl && pageInfo.wishOptions.length === 0) {
      try {
        const entryHtml = await this.fetchUrl(pageInfo.wishEntryUrl);
        pageInfo.wishOptions = this.extractLinks(entryHtml).filter(link => 
          link.url && link.url.includes('cmd=wish') && link.url.includes('sub=1')
        );
      } catch (error) {
        results.push({
          name: '进入许愿页面',
          success: false,
          message: error.message,
        });
        failCount++;
      }
    }

    if (pageInfo.wishOptions.length > 0) {
      const randomIndex = Math.floor(Math.random() * pageInfo.wishOptions.length);
      const wishOption = pageInfo.wishOptions[randomIndex];
      const wishUrl = wishOption.url;
      const wishName = wishOption.text ? wishOption.text.replace('向', '').replace('上香许愿', '') + '许愿' : '许愿';
      
      try {
        const wishHtml = await this.fetchUrl(wishUrl);
        const wishResult = this.extractResult(wishHtml, wishName);
        
        results.push({
          name: wishName,
          success: wishResult.success,
          message: wishResult.message,
        });
        
        if (wishResult.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        results.push({
          name: wishName,
          success: false,
          message: error.message,
        });
        failCount++;
      }
    }

    const details = results.map(r => `${r.name}: ${r.message}`).join('\n');
    const logMessage = details ? `${summary}\n${details}` : summary;
    
    this.log(logMessage, failCount === 0 ? 'success' : 'error');

    return this.success({
      result: summary,
      details: results,
      continuousDays: pageInfo.continuousDays,
      wishCardFragments: pageInfo.wishCardFragments,
      successCount,
      failCount,
    });
  }

  extractResult(html, actionName) {
    if (!html) return { success: false, message: '无响应' };
    
    if (html.includes('ptlogin2.qq.com') || html.includes('location.replace')) {
      return { success: false, message: '登录已过期' };
    }
    
    if (html.includes('已领取') || html.includes('已经领取') || html.includes('领过了')) {
      return { success: true, message: '已领取' };
    }
    
    if (html.includes('领取成功') || html.includes('恭喜') || html.includes('获得')) {
      const match = html.match(/获得[^<\n]*/);
      return { success: true, message: match ? match[0] : '成功' };
    }
    
    if (html.includes('系统繁忙')) {
      return { success: false, message: '系统繁忙' };
    }
    
    if (html.includes('奖励次日') || html.includes('次日早 6 点')) {
      return { success: true, message: '许愿成功，奖励次日发放' };
    }
    
    return { success: true, message: '操作完成' };
  }
}

module.exports = {
  WishAction,
  action: new WishAction(),
};
