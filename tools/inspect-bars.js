// 查看详情页底部操作栏结构
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const pages = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['pages/customer/detail', 'pages/contract/detail', 'pages/quote/detail'];

pages.forEach((p) => {
  const w = fs.readFileSync(path.join(ROOT, p + '.wxml'), 'utf8');
  console.log('\n=== ' + p + ' ===');
  console.log('有 bottom-bar:', /bottom-bar/.test(w));
  const idx = w.indexOf('bottom-bar');
  if (idx > -1) {
    console.log(w.slice(Math.max(0, idx - 200), idx + 900));
  }
  const handlers = [...w.matchAll(/bindtap="([A-Za-z_$][\w$]*)"/g)].map((m) => m[1]);
  console.log('事件:', [...new Set(handlers)].join(', '));
});
