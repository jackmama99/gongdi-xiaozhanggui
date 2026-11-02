// 从工具的 localstorage 中提取控制台日志/错误
const fs = require('fs');
const path = require('path');

const file = path.join(
  process.env.LOCALAPPDATA,
  '微信开发者工具',
  'User Data',
  '2ca4252ffa87560ea1fd48b913e45179',
  'WeappLocalData',
  'localstorage_d606bdfa1243cc7d132b12d791e2174d.json'
);

const text = fs.readFileSync(file, 'utf8');
console.log('文件大小:', text.length, '字符\n');

// 直接对文本做模式搜索
const patterns = [
  /TypeError[^\n"]{0,300}/g,
  /ReferenceError[^\n"]{0,300}/g,
  /SyntaxError[^\n"]{0,300}/g,
  /is not a function[^\n"]{0,200}/g,
  /Cannot read[^\n"]{0,200}/g,
  /app\.js[^\n"]{0,200}/g,
  /Error[^\n"]{0,250}/g
];

const seen = new Set();
patterns.forEach((re) => {
  let m;
  while ((m = re.exec(text))) {
    const s = m[0].replace(/\\n/g, ' ').replace(/\\"/g, '"');
    if (seen.has(s)) continue;
    seen.add(s);
    if (seen.size <= 40) console.log('▸', s.slice(0, 320));
  }
});

if (!seen.size) {
  console.log('未匹配到错误关键字，输出文件前 1500 字符：');
  console.log(text.slice(0, 1500));
}
