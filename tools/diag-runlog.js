// 在开发者工具用户数据中查找最近的运行时错误 / 控制台输出
const fs = require('fs');
const path = require('path');

const base = path.join(
  process.env.LOCALAPPDATA,
  '微信开发者工具',
  'User Data',
  '2ca4252ffa87560ea1fd48b913e45179'
);

const SINCE = Date.now() - 30 * 60 * 1000; // 最近 30 分钟
const PAT = /TypeError|ReferenceError|SyntaxError|is not a function|Cannot read|Cannot find|app\.js|data\/store|login\/index|WAService|AppService|page.*error/i;

const hits = [];

function walk(dir, depth) {
  if (depth > 8) return;
  let ents;
  try {
    ents = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return;
  }
  for (const e of ents) {
    const full = path.join(dir, e.name);
    let st;
    try {
      st = fs.statSync(full);
    } catch (e2) {
      continue;
    }
    if (e.isDirectory()) {
      walk(full, depth + 1);
      continue;
    }
    if (st.mtimeMs < SINCE) continue;
    if (st.size > 20 * 1024 * 1024) continue;
    const ext = path.extname(e.name).toLowerCase();
    if (!['.log', '.json', '.txt', '.js', ''].includes(ext)) continue;
    let text;
    try {
      text = fs.readFileSync(full, 'utf8');
    } catch (e3) {
      continue;
    }
    if (!PAT.test(text)) continue;
    hits.push({ file: full, size: st.size, mtime: st.mtimeMs });
  }
}

walk(base, 0);
console.log('最近修改且命中错误特征的文件:', hits.length);
hits.forEach((h) => console.log(' -', h.file.replace(base, '…'), h.size));
