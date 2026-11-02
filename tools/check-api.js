/**
 * API 一致性检查
 * 扫描所有页面 js 中的 store.xxx(...) / F.xxx(...) / C.XXX 引用，
 * 校验目标在对应模块中确实存在。
 * 这类问题只在用户点击按钮时才暴露，静态扫描可以提前发现。
 *
 * 用法：node tools/check-api.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const mem = new Map();
global.wx = {
  getStorageSync: (k) => (mem.has(k) ? JSON.parse(mem.get(k)) : ''),
  setStorageSync: (k, v) => mem.set(k, JSON.stringify(v)),
  removeStorageSync: (k) => mem.delete(k)
};

const store = require(path.join(ROOT, 'data', 'store.js'));
const F = require(path.join(ROOT, 'utils', 'format.js'));
const C = require(path.join(ROOT, 'utils', 'constants.js'));

const storeKeys = new Set(Object.keys(store));
const formatKeys = new Set(Object.keys(F));
const constKeys = new Set(Object.keys(C));

let errors = 0;
const files = [];

(function walk(dir) {
  fs.readdirSync(dir).forEach((name) => {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full);
    else if (name.endsWith('.js')) files.push(full);
  });
})(path.join(ROOT, 'pages'));

files.forEach((file) => {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const code = fs.readFileSync(file, 'utf8');

  const check = (objName, keys, set, kind) => {
    const re = new RegExp(objName + '\\.([A-Za-z_$][\\w$]*)', 'g');
    let m;
    const seen = new Set();
    while ((m = re.exec(code))) {
      const prop = m[1];
      if (seen.has(prop)) continue;
      seen.add(prop);
      if (!set.has(prop)) {
        console.log(`  ✗ ${rel}: ${objName}.${prop} 不存在于 ${kind}`);
        errors++;
      }
    }
  };

  // 只检查本文件确实 import 了对应模块的
  const hasStore = /require\([^)]*data\/store[^)]*\)/.test(code);
  const hasFormat = /require\([^)]*utils\/format[^)]*\)/.test(code);
  const hasConst = /require\([^)]*utils\/constants[^)]*\)/.test(code);

  if (hasStore) check('store', storeKeys, storeKeys, 'store 模块');
  if (hasFormat) check('F', formatKeys, formatKeys, 'format 模块');
  if (hasConst) check('C', constKeys, constKeys, 'constants 模块');
});

console.log('\n' + '='.repeat(56));
if (errors) {
  console.log(`❌ 发现 ${errors} 处 API 引用错误`);
  process.exit(1);
}
console.log('✅ API 引用一致性检查通过');
