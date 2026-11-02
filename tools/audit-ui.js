/**
 * 全站交互审计
 *
 * 做法：
 * 1. 解析每个页面 WXML 中所有 bind / catch 事件，连同 data-* 参数与 wx:for 作用域；
 * 2. 在模拟的小程序运行环境里真实调用每个事件处理函数；
 * 3. 记录：是否抛错、是否跳转、是否弹提示、是否写入数据。
 *
 * 用法：node tools/audit-ui.js [--write]
 *   --write  wx.showModal / showActionSheet 自动确认，用于走通"确认后写入"的分支
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');

// ---------------- 运行环境 ----------------
const mem = new Map();
const log = { nav: [], toast: [], modal: [], storage: 0 };

function resetLog() {
  log.nav = [];
  log.toast = [];
  log.modal = [];
}

const wxMock = {
  getStorageSync: (k) => (mem.has(k) ? JSON.parse(mem.get(k)) : ''),
  setStorageSync: (k, v) => {
    log.storage++;
    mem.set(k, JSON.stringify(v));
  },
  removeStorageSync: (k) => mem.delete(k),
  getSystemInfoSync: () => ({
    windowWidth: 375,
    windowHeight: 812,
    statusBarHeight: 44,
    platform: 'devtools'
  }),
  getMenuButtonBoundingClientRect: () => ({ top: 48, height: 32, bottom: 80 }),
  showToast: (o) => log.toast.push((o && o.title) || ''),
  hideToast: () => {},
  showLoading: () => {},
  hideLoading: () => {},
  showModal: (o) => {
    log.modal.push('modal:' + ((o && o.title) || ''));
    if (WRITE && o && typeof o.success === 'function') {
      o.success({ confirm: true, cancel: false });
    }
  },
  showActionSheet: (o) => {
    log.modal.push('sheet:' + (((o && o.itemList) || []).join('/')));
    if (WRITE && o && typeof o.success === 'function') {
      o.success({ tapIndex: 0 });
    }
  },
  navigateTo: (o) => log.nav.push(o && o.url),
  redirectTo: (o) => log.nav.push(o && o.url),
  switchTab: (o) => log.nav.push(o && o.url),
  reLaunch: (o) => log.nav.push(o && o.url),
  navigateBack: () => log.nav.push('BACK'),
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
    selectAll: () => ({ boundingClientRect: () => ({ exec: () => {} }) })
  }),
  nextTick: (f) => f && f(),
  onWindowResize: () => {},
  offWindowResize: () => {}
};

const appMock = {
  globalData: { user: null, theme: {}, cache: {} },
  requireLogin: () => true
};

// ---------------- WXML 事件解析 ----------------
const VOID = new Set([
  'image', 'input', 'icon', 'progress', 'switch', 'slider', 'audio', 'video',
  'canvas', 'checkbox', 'radio', 'import', 'include', 'wxs'
]);

function parseEvents(wxml) {
  const events = [];
  const stack = [];
  const tagRe = /<\/?([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
  let m;

  while ((m = tagRe.exec(wxml))) {
    const full = m[0];
    const name = m[1];
    const attrText = m[2] || '';
    const selfClose = m[3] === '/';

    if (full.startsWith('</')) {
      if (stack.length) stack.pop();
      continue;
    }

    const attrs = {};
    const attrRe = /([a-zA-Z][\w:-]*)\s*=\s*"([^"]*)"/g;
    let am;
    while ((am = attrRe.exec(attrText))) attrs[am[1]] = am[2];

    const parent = stack.length ? stack[stack.length - 1] : null;
    let forList = parent ? parent.forList : null;
    let forItem = parent ? parent.forItem : 'item';
    let forIndex = parent ? parent.forIndex : 'index';

    if (attrs['wx:for']) {
      const fm = attrs['wx:for'].match(/\{\{\s*([A-Za-z_$][\w$.]*)/);
      if (fm) forList = fm[1];
      forItem = attrs['wx:for-item'] || 'item';
      forIndex = attrs['wx:for-index'] || 'index';
    }

    Object.keys(attrs).forEach((key) => {
      const ev = key.match(/^(?:bind|catch):?([a-z]+)$/);
      if (!ev) return;
      const handler = attrs[key];
      if (!/^[A-Za-z_$][\w$]*$/.test(handler)) return;

      const dataset = {};
      Object.keys(attrs).forEach((k) => {
        if (k.indexOf('data-') === 0) dataset[k.slice(5)] = attrs[k];
      });

      events.push({
        tag: name,
        event: ev[1],
        handler,
        dataset,
        forList,
        forItem,
        forIndex,
        order: m.index
      });
    });

    if (!selfClose && !VOID.has(name)) {
      stack.push({ name, forList, forItem, forIndex });
    }
  }
  return events;
}

// ---------------- 表达式求值（简化） ----------------
function resolveExpr(expr, data, forList, forItem, forIndex) {
  const e = String(expr).trim();
  if (/^-?\d+(\.\d+)?$/.test(e)) return Number(e);
  if (e === 'true') return true;
  if (e === 'false') return false;

  const parts = e.split('.');
  const head = parts[0];

  // wx:for 的索引
  if (forList && head === forIndex) return 0;

  // wx:for 的条目
  if (forList && head === forItem) {
    const list = data[forList];
    if (!Array.isArray(list) || !list.length) return undefined;
    let cur = list[0];
    for (let i = 1; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  let cur = data;
  for (let i = 0; i < parts.length; i++) {
    if (cur == null) return undefined;
    cur = cur[parts[i]];
  }
  return cur;
}

function resolveDataset(dataset, data, forList, forItem, forIndex) {
  const out = {};
  Object.keys(dataset).forEach((k) => {
    const raw = dataset[k];
    const mm = String(raw).match(/^\{\{([\s\S]*)\}\}$/);
    if (!mm) {
      out[k] = raw;
      return;
    }
    const v = resolveExpr(mm[1], data, forList, forItem, forIndex);
    out[k] = v === undefined ? raw : v;
  });
  return out;
}

// ---------------- 页面加载 ----------------
function loadPage(pagePath) {
  const file = path.join(ROOT, pagePath + '.js');
  const code = fs.readFileSync(file, 'utf8');
  let cfg = null;

  const sandbox = {
    console,
    setTimeout: (f) => f && f(),
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    wx: wxMock,
    getApp: () => appMock,
    getCurrentPages: () => [],
    Page: (c) => {
      cfg = c;
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
      const r = path.resolve(path.dirname(file), p);
      return require(r.endsWith('.js') ? r : r + '.js');
    }
  };
  sandbox.global = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: file });
  if (!cfg) throw new Error('未调用 Page()');
  return cfg;
}

function clone(o) {
  try {
    return JSON.parse(JSON.stringify(o));
  } catch (e) {
    return o;
  }
}

function setByPath(obj, keyPath, value) {
  const keys = String(keyPath).replace(/\[(\d+)\]/g, '.$1').split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (cur[keys[i]] == null) cur[keys[i]] = /^\d+$/.test(keys[i + 1]) ? [] : {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

function buildInstance(cfg) {
  const inst = { data: clone(cfg.data || {}), __setData: 0 };
  inst.setData = (patch) => {
    inst.__setData++;
    Object.keys(patch || {}).forEach((k) => setByPath(inst.data, k, patch[k]));
  };
  Object.keys(cfg).forEach((k) => {
    if (typeof cfg[k] === 'function') inst[k] = cfg[k].bind(inst);
  });
  return inst;
}

// ---------------- 主流程 ----------------
const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
const pages = appJson.pages || [];

global.wx = wxMock;
const config = require(path.join(ROOT, 'config.js'));
config.demoMode = true;
config.useCloud = false;
const store = require(path.join(ROOT, 'data', 'store.js'));
store.reset();
store.login('admin', '123456');

const ids = {
  projectId: store.list('projects')[0].id,
  customerId: store.list('customers')[0].id,
  contractId: store.list('contracts')[0].id,
  quoteId: store.list('quotes')[0].id,
  aftersaleId: store.list('aftersales')[0].id,
  materialId: store.list('materials')[0].id
};

const report = [];
let totalCalls = 0;
let totalErrors = 0;
const silent = [];

pages.forEach((pagePath) => {
  // 每个页面用干净的种子状态 + 演示团队，避免上一页的写入（如创建团队）污染上下文
  store.reset();
  store.login('admin', '123456');

  const wxml = fs.readFileSync(path.join(ROOT, pagePath + '.wxml'), 'utf8');
  const events = parseEvents(wxml);
  const entry = {
    page: pagePath,
    handlers: events.length,
    uniq: new Set(events.map((e) => e.handler)).size,
    errors: [],
    nav: [],
    toast: [],
    modal: [],
    writes: 0
  };

  let cfg;
  try {
    cfg = loadPage(pagePath);
  } catch (e) {
    entry.errors.push({ handler: '(页面加载)', msg: e.message });
    report.push(entry);
    totalErrors++;
    return;
  }

  const opts = { id: ids.projectId, projectId: ids.projectId };
  if (pagePath.indexOf('contract/') > -1) opts.id = ids.contractId;
  if (pagePath.indexOf('customer/') > -1) opts.id = ids.customerId;
  if (pagePath.indexOf('quote/') > -1) opts.id = ids.quoteId;
  if (pagePath.indexOf('aftersale/') > -1) opts.id = ids.aftersaleId;
  if (pagePath.indexOf('material/') > -1) opts.id = ids.materialId;

  const inst = buildInstance(cfg);
  try {
    if (inst.onLoad) inst.onLoad(opts);
    if (inst.onShow) inst.onShow();
  } catch (e) {
    entry.errors.push({ handler: 'onLoad/onShow', msg: e.message });
  }

  if (process.env.AUDIT_DEBUG) {
    console.log('   [dbg] ' + pagePath + ' team=' + store.currentTeamId() + ' user=' + (store.getCurrentUser() || {}).name);
  }

  const seen = new Set();
  events.forEach((ev) => {
    const key = ev.handler + '|' + JSON.stringify(ev.dataset);
    if (seen.has(key)) return;
    seen.add(key);

    const fn = inst[ev.handler];
    if (typeof fn !== 'function') {
      entry.errors.push({ handler: ev.handler, msg: '处理函数未定义' });
      return;
    }

    const dataset = resolveDataset(ev.dataset, inst.data, ev.forList, ev.forItem, ev.forIndex);
    const snapshot = clone(inst.data);
    const beforeStore = log.storage;
    const beforeSetData = inst.__setData;
    resetLog();

    try {
      fn({
        type: ev.event,
        currentTarget: { dataset },
        target: { dataset },
        detail: { value: '0', currentTarget: { dataset } }
      });
    } catch (e) {
      entry.errors.push({
        handler: ev.handler,
        msg: e.message,
        dataset: JSON.stringify(dataset).slice(0, 120)
      });
      totalErrors++;
      inst.data = snapshot;
    }

    const wrote = log.storage - beforeStore;
    entry.writes += wrote;
    log.nav.forEach((u) => entry.nav.push(u));
    log.toast.forEach((t) => t && entry.toast.push(t));
    log.modal.forEach((t) => entry.modal.push(t));

    if (!log.nav.length && !log.toast.length && !log.modal.length && wrote === 0 && inst.__setData === beforeSetData) {
      silent.push(pagePath.replace('pages/', '') + ' · ' + ev.handler);
    }

    totalCalls++;
  });

  report.push(entry);
});

// ---------------- 输出 ----------------
let okPages = 0;
report.forEach((r) => {
  const bad = r.errors.length > 0;
  if (!bad) okPages++;
  console.log(
    (bad ? '✗ ' : '✓ ') +
      r.page.replace('pages/', '').padEnd(20) +
      `交互 ${String(r.handlers).padStart(2)} 个 | 方法 ${String(r.uniq).padStart(2)} 个 | 写入 ${String(r.writes).padStart(2)} | 跳转 ${String(r.nav.length).padStart(2)} | 提示 ${String(r.toast.length).padStart(2)} | 弹窗 ${String(r.modal.length).padStart(2)}`
  );
  r.errors.forEach((e) => console.log('     ✗ ' + e.handler + ': ' + e.msg + (e.dataset ? '  dataset=' + e.dataset : '')));
});

console.log('\n' + '='.repeat(78));
console.log(`页面 ${report.length} 个 | 无异常 ${okPages} 个 | 异常 ${report.length - okPages} 个`);
console.log(`调用交互 ${totalCalls} 次 | 抛错 ${totalErrors} 次`);

if (silent.length) {
  console.log(`\n⚠ 调用后无任何可见反馈的交互（${silent.length} 个，可能是无效按钮）：`);
  silent.slice(0, 30).forEach((s) => console.log('   ' + s));
  if (silent.length > 30) console.log(`   ... 另有 ${silent.length - 30} 个`);
}

process.exit(totalErrors ? 1 : 0);
