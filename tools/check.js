/**
 * 小程序静态自检脚本
 * 覆盖：页面四件套完整性、app.json 路由、组件路径、WXML 标签配对、
 *       JS 语法（Node 编译）、事件处理函数是否存在、wx:for 是否有 wx:key、
 *       跳转 URL 目标页是否注册、require 路径是否存在。
 *
 * 用法：node tools/check.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const errors = [];
const warnings = [];

function rel(p) {
  return path.relative(ROOT, p).replace(/\\/g, '/');
}

function err(file, msg) {
  errors.push(`${rel(file)}: ${msg}`);
}

function warn(file, msg) {
  warnings.push(`${rel(file)}: ${msg}`);
}

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

function exists(p) {
  return fs.existsSync(p);
}

// ---------- 1. app.json ----------
const appJsonPath = path.join(ROOT, 'app.json');
if (!exists(appJsonPath)) {
  console.error('缺少 app.json');
  process.exit(1);
}
const appJson = JSON.parse(read(appJsonPath));
const pages = appJson.pages || [];

pages.forEach((p) => {
  const base = path.join(ROOT, p);
  ['js', 'wxml', 'wxss', 'json'].forEach((ext) => {
    if (!exists(`${base}.${ext}`)) {
      err(`${p}.${ext}`, `页面文件缺失（app.json 已注册）`);
    }
  });
});

// tabBar 图标
if (appJson.tabBar) {
  (appJson.tabBar.list || []).forEach((item) => {
    if (!pages.includes(item.pagePath)) {
      err('app.json', `tabBar 页面未在 pages 中注册: ${item.pagePath}`);
    }
    [item.iconPath, item.selectedIconPath].forEach((ic) => {
      if (ic && !exists(path.join(ROOT, ic))) {
        err('app.json', `tabBar 图标不存在: ${ic}`);
      }
    });
  });
}

// ---------- 2. 组件检查 ----------
function checkComponent(dir) {
  const jsonPath = path.join(dir, 'index.json');
  if (!exists(jsonPath)) return;
  let cfg;
  try {
    cfg = JSON.parse(read(jsonPath));
  } catch (e) {
    err(jsonPath, 'JSON 解析失败: ' + e.message);
    return;
  }
  if (cfg.component) {
    ['js', 'wxml'].forEach((ext) => {
      if (!exists(path.join(dir, `index.${ext}`))) {
        err(dir, `组件缺少 index.${ext}`);
      }
    });
  }
}

const compRoot = path.join(ROOT, 'components');
if (exists(compRoot)) {
  fs.readdirSync(compRoot).forEach((name) => {
    const dir = path.join(compRoot, name);
    if (fs.statSync(dir).isDirectory()) checkComponent(dir);
  });
}

// ---------- 3. 逐页面检查 ----------
const pageDirs = pages.map((p) => path.join(ROOT, p));

pageDirs.forEach((dir) => {
  const p = rel(dir);
  const jsonPath = path.join(dir, 'index.json');
  const wxmlPath = path.join(dir, 'index.wxml');
  const jsPath = path.join(dir, 'index.js');
  const wxssPath = path.join(dir, 'index.wxss');

  if (!exists(jsonPath) || !exists(wxmlPath) || !exists(jsPath)) return;

  // --- json ---
  let cfg = {};
  try {
    cfg = JSON.parse(read(jsonPath));
  } catch (e) {
    err(jsonPath, 'JSON 解析失败: ' + e.message);
  }

  if (!cfg.navigationBarTitleText) {
    warn(jsonPath, '未设置 navigationBarTitleText');
  }

  // 组件路径
  const using = cfg.usingComponents || {};
  Object.keys(using).forEach((tag) => {
    const cp = using[tag];
    if (cp.startsWith('/')) {
      const abs = path.join(ROOT, cp);
      if (!exists(`${abs}.js`)) err(jsonPath, `组件不存在: ${tag} -> ${cp}`);
    } else {
      const abs = path.resolve(dir, cp);
      if (!exists(`${abs}.js`)) err(jsonPath, `组件不存在: ${tag} -> ${cp}`);
    }
  });

  // --- js 语法 ---
  let jsCode = '';
  try {
    jsCode = read(jsPath);
    new vm.Script(jsCode, { filename: jsPath });
  } catch (e) {
    err(jsPath, 'JS 语法错误: ' + e.message);
    return;
  }

  // require 路径
  const reqRe = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = reqRe.exec(jsCode))) {
    const target = m[1];
    if (!target.startsWith('.')) continue;
    const abs = path.resolve(dir, target);
    if (!exists(abs) && !exists(abs + '.js') && !exists(path.join(abs, 'index.js'))) {
      err(jsPath, `require 路径不存在: ${target}`);
    }
  }

  // 页面构造
  if (/Page\(\s*\{/.test(jsCode) === false && /Component\(/.test(jsCode) === false) {
    err(jsPath, '未检测到 Page({}) 定义');
  }

  // 收集 JS 方法名
  const methods = new Set();
  const fnRe = /^\s{2}([A-Za-z_$][\w$]*)\s*\(/gm;
  while ((m = fnRe.exec(jsCode))) {
    methods.add(m[1]);
  }
  // 箭头函数属性：xxx: (e) => {}
  const arrowRe = /^\s{2}([A-Za-z_$][\w$]*)\s*:\s*(?:function|\()/gm;
  while ((m = arrowRe.exec(jsCode))) {
    methods.add(m[1]);
  }

  // --- wxml ---
  const wxml = read(wxmlPath);

  // 标签配对
  const voidTags = new Set(['image', 'input', 'icon', 'progress', 'switch', 'slider', 'audio', 'video', 'canvas', 'checkbox', 'radio', 'import', 'include', 'wxs']);
  const stack = [];
  const tagRe = /<\/?([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
  while ((m = tagRe.exec(wxml))) {
    const full = m[0];
    const name = m[1];
    const selfClose = m[3] === '/';
    const isClose = full.startsWith('</');
    if (voidTags.has(name) || selfClose) continue;
    if (isClose) {
      if (!stack.length) {
        err(wxmlPath, `多余的闭合标签 </${name}>`);
      } else if (stack[stack.length - 1] !== name) {
        err(wxmlPath, `标签不匹配：期望 </${stack[stack.length - 1]}>，实际 </${name}>`);
        // 尝试恢复
        const idx = stack.lastIndexOf(name);
        if (idx >= 0) stack.length = idx;
      } else {
        stack.pop();
      }
    } else {
      stack.push(name);
    }
  }
  if (stack.length) {
    err(wxmlPath, `标签未闭合: <${stack.join('>, <')}>`);
  }

  // 事件绑定 -> 方法是否存在
  const evtRe = /(?:bind|catch):?([a-z]+)\s*=\s*"\{?\{\{?\s*([A-Za-z_$][\w$]*)/g;
  while ((m = evtRe.exec(wxml))) {
    const fnName = m[2];
    if (!methods.has(fnName)) {
      err(wxmlPath, `事件处理函数未定义: ${fnName} (bind${m[1]})`);
    }
  }

  // wx:for 必须 wx:key
  const forRe = /<([a-zA-Z][\w-]*)([^>]*?)wx:for\s*=/g;
  while ((m = forRe.exec(wxml))) {
    const attrs = m[2] + wxml.slice(m.index, m.index + 800).split('>')[0];
    if (!/wx:key\s*=/.test(attrs)) {
      warn(wxmlPath, `wx:for 缺少 wx:key（标签 <${m[1]}>）`);
    }
  }

  // 跳转 URL 目标校验
  const urlRe = /['"](\/pages\/[\w\-\/]+)(\?[^'"]*)?['"]/g;
  while ((m = urlRe.exec(jsCode))) {
    const target = m[1].replace(/^\//, '');
    if (!pages.includes(target)) {
      err(jsPath, `跳转目标页面未注册: /${target}`);
    }
  }

  // tabBar 页面必须用 switchTab / reLaunch，不能用 navigateTo
  const tabPages = ((appJson.tabBar && appJson.tabBar.list) || []).map((x) => x.pagePath);
  const navToRe = /wx\.navigateTo\s*\(\s*\{[^}]*url\s*:\s*['"](\/pages\/[\w\-\/]+)/g;
  while ((m = navToRe.exec(jsCode))) {
    const target = m[1].replace(/^\//, '');
    if (tabPages.includes(target)) {
      err(jsPath, `tabBar 页面不能用 wx.navigateTo 跳转（应使用 switchTab）: /${target}`);
    }
  }

  // ---------------- WXSS 检查 ----------------
  if (exists(wxssPath)) {
    const wxss = read(wxssPath);
    let depth = 0;
    for (let i = 0; i < wxss.length; i++) {
      if (wxss[i] === '{') depth++;
      else if (wxss[i] === '}') {
        depth--;
        if (depth < 0) {
          err(wxssPath, 'WXSS 花括号不匹配（多余的 }）');
          break;
        }
      }
    }
    if (depth > 0) err(wxssPath, `WXSS 花括号未闭合（缺 ${depth} 个 }）`);
    if (/@import\s+["'][^"']*\.css["']/.test(wxss)) {
      warn(wxssPath, 'WXSS 引入了 .css 文件，建议同目录或使用 .wxss');
    }
  }

  // ---------------- 自定义组件使用检查 ----------------
  const KNOWN_TAGS = new Set([
    'view', 'text', 'image', 'scroll-view', 'swiper', 'swiper-item', 'block', 'button',
    'input', 'textarea', 'picker', 'picker-view', 'picker-view-column', 'switch', 'slider',
    'checkbox', 'checkbox-group', 'radio', 'radio-group', 'label', 'form', 'navigator',
    'icon', 'progress', 'rich-text', 'video', 'audio', 'canvas', 'map', 'cover-view',
    'cover-image', 'camera', 'live-player', 'live-pusher', 'web-view', 'open-data',
    'movable-area', 'movable-view', 'functional-page-navigator', 'official-account',
    'ad', 'slot', 'template', 'import', 'include', 'wxs', 'page-meta', 'navigation-bar',
    'root-portal', 'share-element', 'keyboard-accessory', 'match-media', 'page-container',
    'editor', 'grid-view', 'list-view', 'sticky-header', 'sticky-section', 'snapshot'
  ]);

  const usedTags = new Set();
  const tagOpenRe = /<([a-zA-Z][\w-]*)/g;
  while ((m = tagOpenRe.exec(wxml))) {
    usedTags.add(m[1]);
  }

  usedTags.forEach((tag) => {
    if (KNOWN_TAGS.has(tag)) return;
    if (using[tag]) return;
    // 允许页面 json 未声明但组件确实存在的情况（提示而非报错）
    err(wxmlPath, `使用了未在 json 注册的自定义组件 <${tag}>`);
  });

  // 注册了但没用到（仅提示）
  Object.keys(using).forEach((tag) => {
    if (!usedTags.has(tag)) {
      warn(jsonPath, `注册了组件 <${tag}> 但页面未使用`);
    }
  });

  // 校验组件属性是否在组件 properties 中定义
  Object.keys(using).forEach((tag) => {
    if (!usedTags.has(tag)) return;
    const cp = using[tag].startsWith('/')
      ? path.join(ROOT, using[tag])
      : path.resolve(dir, using[tag]);
    const cjs = cp + '.js';
    if (!exists(cjs)) return;
    const code = read(cjs);
    const props = new Set();
    const propBlock = code.match(/properties\s*:\s*\{([\s\S]*?)\n\s*\}/);
    if (propBlock) {
      const pRe = /^\s{4,6}([A-Za-z_$][\w$]*)\s*:/gm;
      let pm;
      while ((pm = pRe.exec(propBlock[1]))) props.add(pm[1]);
    }
    // 收集页面中对 <tag ...> 的属性
    const tagAttrRe = new RegExp('<' + tag + '\\b([^>]*)>', 'g');
    let tm;
    while ((tm = tagAttrRe.exec(wxml))) {
      const attrs = tm[1];
      const attrRe = /([a-zA-Z][\w:-]*)\s*=/g;
      let am;
      while ((am = attrRe.exec(attrs))) {
        const name = am[1];
        if (name.indexOf('bind') === 0 || name.indexOf('catch') === 0) continue;
        if (name === 'wx:if' || name === 'wx:for' || name === 'wx:key' || name === 'class' || name === 'style') continue;
        if (name.indexOf('data-') === 0) continue;
        if (!props.has(name)) {
          warn(wxmlPath, `<${tag}> 使用了未声明的属性 "${name}"`);
        }
      }
    }
  });

  // wxml 中不能调用函数（简单启发：{{ xxx.yyy( ... ) }}）
  const callRe = /\{\{[^}]*?[A-Za-z_$][\w$]*\.[A-Za-z_$][\w$]*\s*\([^}]*\}\}/g;
  while ((m = callRe.exec(wxml))) {
    warn(wxmlPath, `WXML 中疑似调用函数（小程序不支持）: ${m[0].slice(0, 60)}`);
  }

  // 检查 wxss 是否为空文件
  if (exists(wxssPath) && read(wxssPath).trim().length === 0) {
    warn(wxssPath, '样式文件为空');
  }
});

// ---------- 4. 输出 ----------
console.log('='.repeat(60));
if (warnings.length) {
  console.log(`\n⚠️  警告 ${warnings.length} 条：`);
  warnings.slice(0, 60).forEach((w) => console.log('  ' + w));
  if (warnings.length > 60) console.log(`  ... 还有 ${warnings.length - 60} 条`);
}

if (errors.length) {
  console.log(`\n❌ 错误 ${errors.length} 条：`);
  errors.forEach((e) => console.log('  ' + e));
  console.log('\n' + '='.repeat(60));
  process.exit(1);
}

console.log(`\n✅ 静态检查通过（页面 ${pages.length} 个，警告 ${warnings.length} 条）`);
