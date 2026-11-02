/**
 * 表单"正常填写"路径测试
 *
 * 上一轮交互审计里，表单页因空字段被校验拦截，写入为 0，
 * 说明"填写 → 提交 → 落库"这条主路径还没被验证。本脚本补上。
 *
 * 做法：解析 WXML 真实绑定（data-field / data-index / form-type），
 *      按字段语义填入合理值，再调用真正的提交入口，检查集合是否新增。
 *
 * 用法：node tools/test-forms.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const mem = new Map();
let toasts = [];

const wxMock = {
  getStorageSync: (k) => (mem.has(k) ? JSON.parse(mem.get(k)) : ''),
  setStorageSync: (k, v) => mem.set(k, JSON.stringify(v)),
  removeStorageSync: (k) => mem.delete(k),
  getSystemInfoSync: () => ({ windowWidth: 375, windowHeight: 812, statusBarHeight: 44 }),
  getMenuButtonBoundingClientRect: () => ({ top: 48, height: 32, bottom: 80 }),
  showToast: (o) => toasts.push((o && o.title) || ''),
  hideToast: () => {},
  showLoading: () => {},
  hideLoading: () => {},
  showModal: (o) => {
    if (o && o.success) o.success({ confirm: true, cancel: false });
  },
  showActionSheet: (o) => {
    if (o && o.success) o.success({ tapIndex: 0 });
  },
  navigateTo: () => {},
  redirectTo: () => {},
  switchTab: () => {},
  reLaunch: () => {},
  navigateBack: () => {},
  stopPullDownRefresh: () => {},
  setNavigationBarTitle: () => {},
  makePhoneCall: (o) => o && o.fail && o.fail({}),
  setClipboardData: (o) => o && o.success && o.success({}),
  nextTick: (f) => f && f()
};

const appMock = { globalData: { user: null, theme: {}, cache: {} }, requireLogin: () => true };

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

function instance(cfg) {
  const inst = { data: clone(cfg.data || {}) };
  inst.setData = (patch, cb) => {
    Object.keys(patch || {}).forEach((k) => setByPath(inst.data, k, patch[k]));
    if (typeof cb === 'function') cb();
  };
  Object.keys(cfg).forEach((k) => {
    if (typeof cfg[k] === 'function') inst[k] = cfg[k].bind(inst);
  });
  return inst;
}

// ---------------- 解析 WXML 绑定 ----------------
function parseBindings(wxml) {
  const out = [];
  const tagRe = /<([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
  let m;
  while ((m = tagRe.exec(wxml))) {
    const tag = m[1];
    const attrs = {};
    const aRe = /([a-zA-Z][\w:-]*)\s*=\s*"([^"]*)"/g;
    let am;
    while ((am = aRe.exec(m[2] || ''))) attrs[am[1]] = am[2];

    Object.keys(attrs).forEach((k) => {
      const ev = k.match(/^(?:bind|catch):?([a-z]+)$/);
      if (!ev) return;
      const h = attrs[k];
      if (!/^[A-Za-z_$][\w$]*$/.test(h)) return;
      out.push({
        tag,
        event: ev[1],
        handler: h,
        field: attrs['data-field'] || '',
        index: attrs['data-index'] || '',
        formType: attrs['form-type'] || ''
      });
    });
  }
  return out;
}

// ---------------- 按字段语义给值 ----------------
const BY_FIELD = {
  name: '自动化测试',
  title: '自动化测试报价单',
  phone: '13800001234',
  house: '测试小区 1-101',
  address: '测试小区 1-101',
  area: '120',
  budget: '300000',
  manageRate: '0.08',
  designFee: '8000',
  discount: '2000',
  spec: '750×1500',
  qty: '10',
  price: '1200',
  unit: '㎡',
  supplier: '测试供应商',
  remark: '自动化测试备注',
  desc: '自动化测试工单描述',
  intention: '希望现代简约风格，预算 30 万以内',
  customerName: '自动化测试客户'
};

function valueFor(field, handler) {
  if (field && BY_FIELD[field] !== undefined) return BY_FIELD[field];
  const h = String(handler).toLowerCase();

  // 先按数字类字段判断（避免被 name 之类的规则抢先）
  if (h.indexOf('amount') > -1 || h.indexOf('price') > -1) return '1200';
  if (h.indexOf('qty') > -1 || h.indexOf('quantity') > -1) return '10';
  if (h.indexOf('rate') > -1) return '0.08';
  if (h.indexOf('area') > -1) return '120';
  if (h.indexOf('budget') > -1) return '300000';
  if (h.indexOf('discount') > -1) return '2000';
  if (h.indexOf('fee') > -1) return '8000';

  if (h.indexOf('phone') > -1) return '13800001234';
  if (h.indexOf('spec') > -1) return '750×1500';
  if (h.indexOf('unit') > -1) return '㎡';
  if (h.indexOf('supplier') > -1) return '测试供应商';
  if (h.indexOf('name') > -1 || h.indexOf('title') > -1) return '自动化测试';
  if (h.indexOf('desc') > -1 || h.indexOf('remark') > -1 || h.indexOf('note') > -1) return '自动化测试备注';
  if (h.indexOf('address') > -1 || h.indexOf('house') > -1) return '测试小区 1-101';
  return '自动化测试';
}

// ---------------- 填表 + 提交 ----------------
function driveForm(inst, pagePath, cfg, prep) {
  const wxml = fs.readFileSync(path.join(ROOT, pagePath + '.wxml'), 'utf8');
  const bindings = parseBindings(wxml);
  const names = Object.keys(cfg).filter((k) => typeof cfg[k] === 'function');

  const tap = (h, dataset) => {
    if (typeof inst[h] !== 'function') return;
    try {
      inst[h]({ type: 'tap', currentTarget: { dataset: dataset || {} }, target: { dataset: dataset || {} }, detail: {} });
    } catch (e) {
      /* 单步失败不影响后续 */
    }
  };
  const type = (h, value, dataset) => {
    if (typeof inst[h] !== 'function') return;
    try {
      inst[h]({
        type: 'input',
        currentTarget: { dataset: dataset || {} },
        target: { dataset: dataset || {} },
        detail: { value }
      });
    } catch (e) {
      /* 忽略 */
    }
  };

  // 1. 打开表单
  names.filter((n) => /^(open|show|add|create)/i.test(n) && !/^(addItem|insertItem)$/.test(n)).forEach((n) => tap(n));

  // 2. 明细行：先点 addItem / insertItem
  ['addItem', 'insertItem'].forEach((n) => {
    if (typeof inst[n] === 'function') tap(n, { index: 0 });
  });

  // 3. 逐个输入 / 选择
  bindings.forEach((b) => {
    if (b.event !== 'input' && b.event !== 'change') return;
    const dataset = {};
    if (b.field) dataset.field = b.field;
    if (b.index !== '') dataset.index = 0;
    const value = b.event === 'change' ? '1' : valueFor(b.field, b.handler);
    type(b.handler, value, dataset);
  });

  // 3.5 用例准备（提交前，如巡检需逐项确认）
  if (typeof prep === 'function') {
    try { prep(inst); } catch (e) { /* 忽略 */ }
  }

  // 4. 提交
  const submitCandidates = [
    'onSubmit', 'submitForm', 'doCreate', 'doSubmit', 'saveForm', 'onSave', 'submit', 'save'
  ];
  let submitName = submitCandidates.find((n) => typeof inst[n] === 'function');
  if (!submitName) {
    // 兜底：名字里带 submit/save/create 的
    submitName = names.find((n) => /submi|save|^doCreate$/i.test(n));
  }
  if (!submitName) return { error: '找不到提交方法' };

  try {
    inst[submitName]({ currentTarget: { dataset: {} }, target: { dataset: {} }, detail: {} });
  } catch (e) {
    return { submitName, error: e.message };
  }
  return { submitName };
}

// ---------------- 用例 ----------------
global.wx = wxMock;
const config = require(path.join(ROOT, 'config.js'));
config.demoMode = true;
config.useCloud = false;
const store = require(path.join(ROOT, 'data', 'store.js'));
store.login('admin', '123456');

let pass = 0;
let fail = 0;

function ok(name, cond, extra) {
  if (cond) {
    pass++;
    console.log('  ✓ ' + name);
  } else {
    fail++;
    console.log('  ✗ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : ''));
  }
}

function runCase(title, pagePath, collection, opts) {
  console.log('\n▶ ' + title);
  const cfg = loadPage(pagePath);
  const inst = instance(cfg);

  const before = store.list(collection).length;
  // 注意：create 模式不能传 id，否则页面会走编辑分支
  const o = Object.assign({ projectId: store.list('projects')[0].id }, opts || {});

  try {
    if (inst.onLoad) inst.onLoad(o);
    if (inst.onShow) inst.onShow();
  } catch (e) {
    ok('页面加载', false, e.message);
    return;
  }

  toasts = [];
  const res = driveForm(inst, pagePath, cfg, opts && opts.prepare);
  const after = store.list(collection).length;

  ok('提交方法可执行（' + (res.submitName || '?') + '）', !res.error, res.error);
  ok(`集合新增记录（${collection}：${before}→${after}）`, after > before);
  ok('有成功类提示', toasts.some((t) => /成功|已提交|已保存|已登记|已创建|已记录|已新增/.test(t)), toasts);
}

console.log('='.repeat(64));
console.log('表单正常路径测试');
console.log('='.repeat(64));

runCase('新增客户', 'pages/customer/edit', 'customers');
runCase('新增报价', 'pages/quote/edit', 'quotes');
runCase('新增材料', 'pages/material/list', 'materials');
runCase('新增售后工单', 'pages/aftersale/list', 'aftersales');
runCase('新增巡检', 'pages/project/inspect', 'inspections', {
  prepare(inst) {
    inst.setData({ 'form.result': '合格' });
    inst.setData({ 'form.items': inst.data.form.items.map((x) => ({ ...x, pass: true })) });
  }
});
runCase('新增支出', 'pages/finance/expense', 'expenses');

console.log('\n' + '='.repeat(64));
console.log(`表单测试：通过 ${pass} 项，失败 ${fail} 项`);
process.exit(fail ? 1 : 0);
