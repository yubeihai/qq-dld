class HtmlParser {
  extractLinks(html) {
    if (!html || typeof html !== 'string') return [];

    const links = [];
    const regex = /<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi;
    let match;

    while ((match = regex.exec(html)) !== null) {
      let url = match[1].replace(/&amp;/g, '&');
      let text = match[2].replace(/<[^>]+>/g, '').trim();

      if (!url || url.startsWith('javascript:') || url === '#') continue;
      if (url.startsWith('//')) url = 'https:' + url;
      if (url.startsWith('/')) url = 'https://dld.qzapp.z.qq.com' + url;

      links.push({ url, text });
    }

    const uniqueMap = new Map();
    links.forEach(l => uniqueMap.set(l.url, l.text || uniqueMap.get(l.url) || ''));
    return [...uniqueMap].map(([url, text]) => ({ url, text }));
  }

  extractText(html) {
    if (!html || typeof html !== 'string') return '';
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  matchPattern(html, patterns) {
    if (!html || !patterns) return null;
    const patternList = Array.isArray(patterns) ? patterns : [patterns];
    for (const pattern of patternList) {
      const match = typeof pattern === 'string'
        ? html.includes(pattern) ? pattern : null
        : html.match(pattern);
      if (match) return match[0] || match;
    }
    return null;
  }

  isSystemBusy(html) {
    if (!html || typeof html !== 'string') return false;
    const patterns = ['系统繁忙', '请稍后再试', '请求过于频繁'];
    return patterns.some(p => html.includes(p));
  }

  isLoginExpired(html) {
    if (!html || typeof html !== 'string') return false;
    return html.includes('location.replace') ||
           html.includes('ptlogin2.qq.com') ||
           html.includes('请先登录') ||
           html.includes('未登录');
  }
}

module.exports = { HtmlParser };
