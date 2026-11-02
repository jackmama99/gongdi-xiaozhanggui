/**
 * 主题残留扫描
 *
 * v1.3.0 换肤时只改了全局令牌，页面 JSON / JS / 图标里的硬编码旧色没扫干净。
 * 这个脚本把上一版的主题色列为禁用值，任何一处重新出现都直接失败。
 *
 * 用法：node tools/check-theme.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// 旧主题（v1.2 及以前）的硬编码颜色，禁止再出现
const BANNED = [
  '1F8A63', '3B6EF6', '22B07D', 'FF9A2E', 'F2544B', 'D4553F', 'C47B16',
  '34B98A', 'DFA24F', 'E0806C', 'FFB75E', 'FF7B74', '0E9A6B', '12A5A0',
  'F4F6FA', 'EEF1F7', 'F2F4F8', 'FAFBFD',
  'E8F5EE', 'EEF2EF', 'FDF3E2', 'FDEDE9',
  'E6F7F1', 'E7F4EE', 'E6F4F2', 'FFF3E5', 'FEECEB'
];

// 只扫会进入小程序包的源码
const SCAN_DIRS = ['pages', 'components'];
const SCAN_FILES = ['app.js', 'app.json', 'app.wxss'];
const EXTS = ['.js', '.json', '.wxml', '.wxss'];

function walk(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((ent) => {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (EXTS.indexOf(path.extname(ent.name)) > -1) out.push(full);
  });
}

const files = [];
SCAN_DIRS.forEach((d) => {
  const full = path.join(ROOT, d);
  if (fs.existsSync(full)) walk(full, files);
});
SCAN_FILES.forEach((f) => {
  const full = path.join(ROOT, f);
  if (fs.existsSync(full)) files.push(full);
});

const hits = [];
files.forEach((file) => {
  const text = fs.readFileSync(file, 'utf8');
  BANNED.forEach((hex) => {
    const re = new RegExp('#' + hex, 'gi');
    let m;
    while ((m = re.exec(text))) {
      const line = text.slice(0, m.index).split(/\r?\n/).length;
      hits.push({ file: path.relative(ROOT, file), line, hex: m[0] });
    }
  });
});

console.log('='.repeat(60));
if (hits.length) {
  hits.forEach((h) => console.log(`❌ ${h.file}:${h.line}  旧主题色 ${h.hex}`));
  console.log(`\n共 ${hits.length} 处旧主题色残留`);
  process.exit(1);
}
console.log(`✅ 主题残留检查通过（扫描 ${files.length} 个文件，0 处旧色）`);
