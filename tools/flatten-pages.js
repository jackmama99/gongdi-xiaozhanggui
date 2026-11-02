/**
 * 页面目录结构修正：pages/X/Y/index.*  ->  pages/X/Y.*
 * 同时把相对引用 ../../ 修正为 ../
 *
 * 原因：app.json 注册的是扁平路径（pages/customer/list），
 * 而页面被写进了多一层目录（pages/customer/list/index.js）。
 *
 * 用法：node tools/flatten-pages.js [--dry]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PAGES = path.join(ROOT, 'pages');
const DRY = process.argv.includes('--dry');

const exts = ['.js', '.wxml', '.wxss', '.json'];
const moved = [];
const rewritten = [];

function walk(dir, depth) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach((name) => {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      walk(full, depth + 1);
    }
  });
}

// 找出所有 pages/<a>/<b>/index.js 形态
function findNested() {
  const results = [];
  if (!fs.existsSync(PAGES)) return results;
  fs.readdirSync(PAGES).forEach((lvl1) => {
    const d1 = path.join(PAGES, lvl1);
    if (!fs.statSync(d1).isDirectory()) return;
    fs.readdirSync(d1).forEach((lvl2) => {
      const d2 = path.join(d1, lvl2);
      if (!fs.statSync(d2).isDirectory()) return;
      // 该子目录里如果有 index.js，说明是嵌套写法
      if (fs.existsSync(path.join(d2, 'index.js'))) {
        results.push({ dir: d2, parent: d1, basename: lvl2 });
      }
    });
  });
  return results;
}

const nested = findNested();
console.log(`发现 ${nested.length} 个嵌套页面目录`);

nested.forEach(({ dir, parent, basename }) => {
  const rel = path.relative(ROOT, dir).replace(/\\/g, '/');
  console.log(`  迁移 ${rel}/index.* -> ${path.relative(ROOT, parent).replace(/\\/g, '/')}/${basename}.*`);

  exts.forEach((ext) => {
    const src = path.join(dir, `index${ext}`);
    const dst = path.join(parent, `${basename}${ext}`);
    if (!fs.existsSync(src)) return;
    if (fs.existsSync(dst)) {
      console.warn(`    跳过（目标已存在）: ${path.relative(ROOT, dst)}`);
      return;
    }
    let content = fs.readFileSync(src, 'utf8');

    // 修正相对引用：位于 pages/X/Y/index.js 时，../../data -> ../data
    if (ext === '.js' || ext === '.json' || ext === '.wxml') {
      const before = content;
      // require('../../xxx') / from '../../xxx'
      content = content.replace(/(['"])\.\.\/\.\.\//g, '$1../');
      // 组件绝对路径不需要改
      if (before !== content) {
        rewritten.push(path.relative(ROOT, dst).replace(/\\/g, '/'));
      }
    }

    if (!DRY) {
      fs.writeFileSync(dst, content, 'utf8');
      fs.unlinkSync(src);
    }
    moved.push(path.relative(ROOT, dst).replace(/\\/g, '/'));
  });

  // 删除空目录
  if (!DRY) {
    const rest = fs.readdirSync(dir);
    if (rest.length === 0) fs.rmdirSync(dir);
    else console.warn(`    目录非空，保留：${path.relative(ROOT, dir)} -> ${rest.join(', ')}`);
  }
});

console.log(`\n完成：迁移 ${moved.length} 个文件，修正 ${rewritten.length} 个文件路径`);
if (rewritten.length) {
  console.log('已修正相对引用的文件：');
  rewritten.forEach((f) => console.log('  ' + f));
}
