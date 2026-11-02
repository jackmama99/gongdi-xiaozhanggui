// 列出指定页面 WXML 里的所有事件绑定及 data-field / form-type
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const pages = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['pages/aftersale/list', 'pages/customer/edit', 'pages/quote/edit'];

pages.forEach((p) => {
  const wxml = fs.readFileSync(path.join(ROOT, p + '.wxml'), 'utf8');
  console.log('\n=== ' + p + ' ===');

  const tagRe = /<([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
  let m;
  let count = 0;
  while ((m = tagRe.exec(wxml))) {
    const tag = m[1];
    const attrs = m[2] || '';
    const dict = {};
    const aRe = /([a-zA-Z][\w:-]*)\s*=\s*"([^"]*)"/g;
    let am;
    while ((am = aRe.exec(attrs))) dict[am[1]] = am[2];

    Object.keys(dict).forEach((k) => {
      const ev = k.match(/^(?:bind|catch):?([a-z]+)$/);
      if (!ev) return;
      count++;
      const parts = ['<' + tag + '>', ev[1] + '→' + dict[k]];
      if (dict['data-field']) parts.push('field=' + dict['data-field']);
      if (dict['data-index']) parts.push('index=' + dict['data-index']);
      if (dict['form-type']) parts.push('form-type=' + dict['form-type']);
      if (dict['data-id']) parts.push('id=' + dict['data-id']);
      console.log('  ' + parts.join('   '));
    });
  }
  if (!count) console.log('  (无事件)');
});
