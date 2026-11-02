/**
 * 文本完整性检查
 * 1. 所有源文件必须是合法 UTF-8（无 BOM、无替换字符）
 * 2. 检测 GBK 乱码特征（UTF-8 被按 GBK 解码后的典型汉字）
 * 3. 中文页面文件必须包含中文
 * 4. 空文件检测
 *
 * 用法：node tools/check-text.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// 常见 mojibake 特征字（UTF-8 → GBK 误解码后的高频字）
const MOJIBAKE = [
  '锟斤拷', '鍚', '鐨', '涓', '鏄', '銆', '锛', '鍜', '绋', '澹',
  '缁', '鏋', '寮', '鍚堟牸', '寰呮暣鏀', '涓嶅悎鏍', '璁', '鍔', '绠'
];

const exts = ['.js', '.json', '.wxml', '.wxss', '.md', '.py'];
const files = [];

function walk(dir) {
  fs.readdirSync(dir).forEach((name) => {
    if (name === 'node_modules' || name === '.git') return;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full);
    else if (exts.includes(path.extname(name))) files.push(full);
  });
}
walk(ROOT);

let errors = 0;
let warnings = 0;

files.forEach((file) => {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  // 跳过本检查器自身（含特征字表，会自我误报）
  if (rel === 'tools/check-text.js') return;
  const buf = fs.readFileSync(file);

  // 空文件
  if (buf.length === 0) {
    console.log(`  ✗ 空文件: ${rel}`);
    errors++;
    return;
  }

  // BOM
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    console.log(`  ⚠ 含 UTF-8 BOM: ${rel}`);
    warnings++;
  }

  const text = buf.toString('utf8');

  // 替换字符 = 非法 UTF-8
  if (text.includes('\uFFFD')) {
    console.log(`  ✗ 非法 UTF-8 字节: ${rel}`);
    errors++;
    return;
  }

  // mojibake
  const hits = MOJIBAKE.filter((m) => text.includes(m));
  if (hits.length) {
    console.log(`  ✗ 疑似编码损坏: ${rel}  命中: ${hits.join(' ')}`);
    errors++;
    return;
  }

  // 页面文件应含中文（login 等也一样），纯 ASCII 的 wxml/wxss 可能是残留
  if (rel.startsWith('pages/') && (rel.endsWith('.wxml') || rel.endsWith('.js'))) {
    const cn = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    if (cn === 0) {
      console.log(`  ⚠ 无中文内容（可能异常）: ${rel}`);
      warnings++;
    }
  }
});

console.log('\n' + '='.repeat(56));
console.log(`检查 ${files.length} 个文件：错误 ${errors} 条，警告 ${warnings} 条`);
if (errors) {
  console.log('❌ 存在错误');
  process.exit(1);
}
console.log('✅ 文本完整性检查通过');
