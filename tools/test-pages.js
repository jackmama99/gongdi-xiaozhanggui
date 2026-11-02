/**
 * 小程序页面运行时冒烟测试
 *
 * 原理：用 vm 沙箱模拟小程序环境（Page / Component / wx / getApp），
 * 真实执行每个页面的 onLoad + onShow，捕获运行时异常，
 * 并校验 setData 后的数据形态是否合理。
 *
 * 用法：node tools/test-pages.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const mem = new Map();
let toastCalls = [];
let modalCalls = [];
let navCalls = [];

// ---------------- wx 模拟 ----------------
const wxMock = {
  getStorageSync: (k) => (mem.has(k) ? JSON.parse(mem.get(k)) : ''),
  setStorageSync: (k, v) => mem.set(k, JSON.stringify(v)),
  removeStorageSync: (k) => mem.delete(k),
  clearStorageSync: () => mem.clear(),
  getSystemInfoSync: () => ({
    windowWidth: 375,
    windowHeight: 812,
    statusBarHeight: 44,
    platform: 'devtools',
    system: 'iOS 16'
  }),
  showToast: (o) => {
    toastCalls.push(o);
  },
  hideToast: () => {},
  showLoading: () => {},
  hideLoading: () => {},
  showModal: (o) => {
    modalCalls.push(o);
    // 默认不自动确认，避免触发级联副作用
  },
  navigateTo: (o) => navCalls.push(o),
  redirectTo: (o) => navCalls.push(o),
  switchTab: (o) => navCalls.push(o),
  reLaunch: (o) => navCalls.push(o),
  navigateBack: () => navCalls.push({ back: true }),
  stopPullDownRefresh: () => {},
  startPullDownRefresh: () => {},
  setNavigationBarTitle: () => {},
  makePhoneCall: (o) => {
    if (o && o.fail) o.fail({});
  },
  setClipboardData: (o) => {
    if (o && o.success) o.success({});
  },
  createSelectorQuery: () => ({
    select: () => ({ boundingClientRect: () => ({ exec: () => {} }) }),
    selectAll: () => ({ boundingClientRect: () => ({ exec: () => {} }) }),
    in: () => ({ select: () => ({ boundingClientRect: () => ({ exec: () => {} }) }) })
  }),
  nextTick: (fn) => fn && fn(),
  getMenuButtonBoundingClientRect: () => ({ top: 48, height: 32, bottom: 80 }),
  onWindowResize: () => {},
  offWindowResize: () => {}
};

const appMock = {
  globalData: { user: null, theme: {}, cache: {} },
  requireLogin: () => true
};

// ---------------- 页面路径解析 ----------------
const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
const pages = appJson.pages || [];

// ---------------- setData 路径赋值 ----------------
function setByPath(obj, keyPath, value) {
  const keys = String(keyPath).replace(/\[(\d+)\]/g, '.$1').split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (cur[k] === undefined || cur[k] === null) {
      cur[k] = /^\d+$/.test(keys[i + 1]) ? [] : {};
    }
    cur = cur[k];
  }
  cur[keys[keys.length - 1]] = value;
}

function deepClone(o) {
  if (o === null || typeof o !== 'object') return o;
  try {
    return JSON.parse(JSON.stringify(o));
  } catch (e) {
    return o;
  }
}

// ---------------- 执行页面 ----------------
function loadPage(pagePath) {
  const file = path.join(ROOT, pagePath + '.js');
  const code = fs.readFileSync(file, 'utf8');

  let pageConfig = null;
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    wx: wxMock,
    getApp: () => appMock,
    getCurrentPages: () => [],
    Page: (cfg) => {
      pageConfig = cfg;
    },
    Component: () => {},
    App: () => {},
    Behavior: () => {},
    module: { exports: {} },
    exports: {},
    __filename: file,
    __dirname: path.dirname(file),
    require: (p) => {
      if (!p.startsWith('.')) return require(p);
      const resolved = path.resolve(path.dirname(file), p);
      return require(resolved.endsWith('.js') ? resolved : resolved + '.js');
    }
  };
  sandbox.global = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: file });

  if (!pageConfig) {
    throw new Error('未调用 Page()');
  }
  return pageConfig;
}

function buildInstance(cfg) {
  const inst = Object.create(null);
  inst.data = deepClone(cfg.data || {});
  inst.__setDataCount = 0;
  inst.setData = function (patch, cb) {
    inst.__setDataCount++;
    Object.keys(patch || {}).forEach((k) => {
      setByPath(inst.data, k, patch[k]);
    });
    if (typeof cb === 'function') cb();
  };

  // 挂载方法
  Object.keys(cfg).forEach((k) => {
    if (typeof cfg[k] === 'function') {
      inst[k] = cfg[k].bind(inst);
    }
  });
  return inst;
}

// ---------------- 造一个最小可用的 options ----------------
function buildOptions(pagePath, sampleIds) {
  const opts = {};
  if (pagePath.indexOf('project/') > -1 || pagePath.indexOf('aftersale/') > -1 || pagePath.indexOf('material/') > -1) {
    opts.id = sampleIds.projectId;
  }
  if (pagePath.indexOf('contract/') > -1) opts.id = sampleIds.contractId;
  if (pagePath.indexOf('customer/') > -1) opts.id = sampleIds.customerId;
  if (pagePath.indexOf('quote/') > -1) opts.id = sampleIds.quoteId;
  if (pagePath.indexOf('aftersale/') > -1) opts.id = sampleIds.aftersaleId;
  if (pagePath.indexOf('material/') > -1) opts.id = sampleIds.materialId;
  if (pagePath.indexOf('project/') > -1) opts.projectId = sampleIds.projectId;
  return opts;
}

// ---------------- 主流程 ----------------
async function main() {
  // 先用 store 取样本 id
  global.wx = wxMock;
  const config = require(path.join(ROOT, 'config.js'));
  config.demoMode = true;
  config.useCloud = false;
  const store = require(path.join(ROOT, 'data', 'store.js'));
  store.reset();
  store.login('admin', '123456');

  const sampleIds = {
    projectId: store.list('projects')[0].id,
    customerId: store.list('customers')[0].id,
    contractId: store.list('contracts')[0].id,
    quoteId: store.list('quotes')[0].id,
    aftersaleId: store.list('aftersales')[0].id,
    materialId: store.list('materials')[0].id,
    expenseId: store.list('expenses')[0].id,
    nodeId: store.list('projects')[0].nodes[0].id
  };

  let pass = 0;
  let fail = 0;
  const failures = [];

  for (const pagePath of pages) {
    const label = pagePath.replace(/^pages\//, '');
    try {
      const cfg = loadPage(pagePath);
      const inst = buildInstance(cfg);

      // onLoad
      if (typeof inst.onLoad === 'function') {
        inst.onLoad(buildOptions(pagePath, sampleIds));
      }
      // onShow
      if (typeof inst.onShow === 'function') {
        inst.onShow();
      }
      // onReady
      if (typeof inst.onReady === 'function') {
        inst.onReady();
      }

      // 基本断言：data 存在且为对象
      if (!inst.data || typeof inst.data !== 'object') {
        throw new Error('data 不是对象');
      }

      // 检查 data 里是否有 undefined 值（渲染会出现空白/报错）
      const undefKeys = [];
      (function walk(obj, prefix) {
        if (obj === null || typeof obj !== 'object') return;
        Object.keys(obj).forEach((k) => {
          const v = obj[k];
          const p = prefix ? prefix + '.' + k : k;
          if (v === undefined) undefKeys.push(p);
          else if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, p);
        });
      })(inst.data, '');

      if (undefKeys.length) {
        throw new Error('data 中存在 undefined: ' + undefKeys.slice(0, 5).join(', '));
      }

      // 检查模板中引用的顶层变量是否在 data 中（粗筛，只查简单的 {{a.b}} 首段）
      const wxml = fs.readFileSync(path.join(ROOT, pagePath + '.wxml'), 'utf8');
      const topVars = new Set();
      const varRe = /\{\{\s*([A-Za-z_$][\w$]*)/g;
      let vm2;
      while ((vm2 = varRe.exec(wxml))) {
        const v = vm2[1];
        // 排除 wx:for 局部变量
        if (['true', 'false', 'null', 'undefined'].indexOf(v) > -1) continue;
        topVars.add(v);
      }
      const locals = new Set();
      const itemRe = /wx:for-item\s*=\s*"([^"]+)"/g;
      while ((vm2 = itemRe.exec(wxml))) locals.add(vm2[1]);
      const idxName = /wx:for-index\s*=\s*"([^"]+)"/g;
      while ((vm2 = idxName.exec(wxml))) locals.add(vm2[1]);

      const missing = [];
      topVars.forEach((v) => {
        if (locals.has(v)) return;
        if (v === 'item' || v === 'index') return;
        if (!(v in inst.data)) missing.push(v);
      });
      if (missing.length) {
        throw new Error('WXML 引用了 data 中不存在的变量: ' + missing.join(', '));
      }

      pass++;
      process.stdout.write(`  ✓ ${label}${inst.__setDataCount ? ' (' + inst.__setDataCount + ' 次 setData)' : ''}\n`);
    } catch (e) {
      fail++;
      failures.push({ page: pagePath, error: e.message });
      process.stdout.write(`  ✗ ${label}\n      ${e.message}\n`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`页面运行时测试：通过 ${pass} / ${pages.length}，失败 ${fail}`);
  if (fail) {
    console.log('\n失败详情：');
    failures.forEach((f) => console.log(`  ${f.page}: ${f.error}`));
    process.exit(1);
  }
  console.log('✅ 全部页面运行时无异常');
}

main().catch((e) => {
  console.error('测试脚本自身异常：', e);
  process.exit(2);
});
