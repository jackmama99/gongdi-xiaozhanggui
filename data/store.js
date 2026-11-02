/**
 * 全局数据仓库（演示版）
 *
 * 设计说明：
 * 1. 本小程序为「可直接运行的演示系统」，数据层采用本地存储模拟后端。
 * 2. 所有页面必须通过 store 读写数据，禁止直接 require('./seed') 后修改对象。
 * 3. 需要接真实后端时，只需把 store 里各方法内部改成 wx.request，页面无需改动。
 */
const seed = require('./seed');
const cloud = require('./cloud');
const config = require('../config');
const F = require('../utils/format');
const C = require('../utils/constants');

const STORAGE_KEY = 'zx_erp_db_v2';
const AUTH_KEY = 'zx_erp_auth_v2';
const CONSENT_KEY = 'zx_erp_consent_v1';

/** 用户是否已同意当前版本的协议（版本变更后需重新同意） */
function hasConsent() {
  try {
    const c = wx.getStorageSync(CONSENT_KEY);
    if (!c || !c.agreedAt) return false;
    const ver = (typeof config !== 'undefined' && config.legalVersion) || '1.0';
    return String(c.version) === String(ver);
  } catch (e) {
    return false;
  }
}

/** 记录用户同意协议的时间与版本 */
function setConsent() {
  try {
    wx.setStorageSync(CONSENT_KEY, {
      version: (typeof config !== 'undefined' && config.legalVersion) || '1.0',
      agreedAt: Date.now()
    });
  } catch (e) {}
}

// 演示团队（种子数据默认归属）
const DEMO_TEAM_ID = 't_1001';
const DEMO_INVITE_CODE = 'ZX8888';

// 团队隔离的业务集合（所有记录都带 teamId）
const BUSINESS_COLLECTIONS = [
  'customers',
  'follows',
  'quotes',
  'contracts',
  'projects',
  'inspections',
  'changes',
  'receipts',
  'expenses',
  'materials',
  'aftersales',
  'todos'
];

// 全部集合（含团队与成员）
const COLLECTIONS = ['teams', 'users'].concat(BUSINESS_COLLECTIONS);

let db = null;

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function buildFresh() {
  const demo = !config || config.demoMode !== false;
  const fresh = { schema: 2, company: clone(seed.company) };
  COLLECTIONS.forEach((k) => {
    fresh[k] = demo ? clone(seed[k] || []) : [];
  });

  // ---- 演示团队（仅演示模式） ----
  if (demo) {
    const owner = fresh.users[0] || {};
    fresh.teams = [
      {
        id: DEMO_TEAM_ID,
        name: seed.company && seed.company.name ? seed.company.name : '工地小掌柜装饰',
        ownerId: owner.id || '',
        inviteCode: DEMO_INVITE_CODE,
        industry: '家装 / 整装',
        city: seed.company && seed.company.city ? seed.company.city : '杭州',
        phone: (seed.company && seed.company.phone) || '',
        status: '正常',
        createTime: F.today()
      }
    ];

    // ---- 所有种子数据归属演示团队 ----
    COLLECTIONS.forEach((k) => {
      if (k === 'teams') return;
      fresh[k].forEach((r) => {
        if (!r.teamId) r.teamId = DEMO_TEAM_ID;
      });
    });
  } else {
    // 正式版：空库启动，用户自己创建团队
    fresh.teams = [];
  }

  return fresh;
}

function load() {
  if (db) return db;
  try {
    const cached = wx.getStorageSync(STORAGE_KEY);
    // 结构版本一致才复用缓存（空库也是有效状态，不能用"有没有数据"判断）
    if (cached && cached.schema === 2 && Array.isArray(cached.teams)) {
      db = cached;
      return db;
    }
  } catch (e) {
    // 读取失败则回落到种子数据
  }
  db = buildFresh();
  persist();
  return db;
}

function persist(silent) {
  try {
    wx.setStorageSync(STORAGE_KEY, db);
  } catch (e) {
    console.warn('[store] 持久化失败', e);
  }
  // 本地写成功后，后台推送到云端（未开启云同步时为空操作）
  if (!silent) scheduleSync();
}

function reset() {
  db = buildFresh();
  persist();
  return db;
}

// ---------------- 云同步（离线优先） ----------------

let syncTimer = null;
let syncing = false;

/** 防抖推送：连续操作只发一次请求 */
function scheduleSync() {
  if (!cloud.enabled()) return;
  if (!currentTeamId()) return;
  if (syncTimer) return;
  const delay = (typeof config !== 'undefined' && config.syncDebounceMs) || 800;
  syncTimer = setTimeout(() => {
    syncTimer = null;
    flushToCloud();
  }, delay);
}

/** 把当前团队的业务数据整体推到云端 */
async function flushToCloud() {
  const teamId = currentTeamId();
  if (!teamId || !cloud.enabled() || syncing) return false;
  syncing = true;
  try {
    // 先吸收云端较新的记录，再整体推送，避免旧设备把云端冲回旧值
    await syncFromCloud();
    const payload = {};
    BUSINESS_COLLECTIONS.forEach((name) => {
      payload[name] = listAll(name).filter((r) => (r.teamId || '') === teamId);
    });
    const pushed = await cloud.pushTeam(teamId, payload);
    if (pushed === false) console.warn('[sync] 本次推送未全部成功');
    return pushed !== false;
  } finally {
    syncing = false;
  }
}

/**
 * 从云端拉取并合并（登录后调用）
 * 合并策略：按 id 对齐，updateTime 较新的胜出；仅同步当前团队数据。
 */
async function syncFromCloud() {
  const teamId = currentTeamId();
  if (!teamId || !cloud.enabled()) return false;

  const remote = await cloud.pullTeam(teamId);
  if (!remote) return false;

  const d = load();
  let changed = false;

  // 业务集合 + 团队/成员表都按 updateTime 合并
  const SYNC_SETS = BUSINESS_COLLECTIONS.concat(['teams', 'users']);

  SYNC_SETS.forEach((name) => {
    const incoming = remote[name];
    if (!Array.isArray(incoming) || !incoming.length) return;
    const local = d[name] || [];
    const map = {};
    local.forEach((r) => {
      map[r.id] = r;
    });
    incoming.forEach((record) => {
      let r = record;
      if (!r || !r.id) return;
      // teams/users 没有 teamId 字段，业务集合按 teamId 过滤
      if (BUSINESS_COLLECTIONS.indexOf(name) > -1 && (r.teamId || '') !== teamId) return;
      const cur = map[r.id];
      // 时间戳相同时保留本地（避免云端旧值把本地刚改的名字覆盖回去）
      if (!cur || (r.updateTime || 0) > (cur.updateTime || 0)) {
        // 云端不再下发密码，合并时保留本机已有的密码，避免账号登录失效
        if (name === 'users' && cur && cur.password && !r.password) {
          r = Object.assign({}, r, { password: cur.password });
        }
        map[r.id] = r;
        changed = true;
      }
    });
    d[name] = Object.keys(map).map((k) => map[k]);
  });

  if (changed) persist(true); // 合并结果只落本地，不再回推，避免回环
  return changed;
}

/** 初始化云同步（app 启动时调用） */
function initCloud() {
  if (!cloud.enabled()) return false;
  cloud.init();
  return true;
}

/** 登录后调用：绑定 openid 并把本地数据对齐云端 */
async function syncNow() {
  if (!cloud.enabled()) return false;

  // 先把 openid 绑到账号上（加入团队时服务端要靠它校验身份）
  const openid = await cloud.ensureLogin();
  if (!openid) return false;
  const user = getCurrentUser();
  if (user && user.openid !== openid) update('users', user.id, { openid });

  // 还没加入团队：只完成身份绑定，不做数据同步
  if (!currentTeamId()) return false;

  await syncFromCloud();
  await flushToCloud();
  return true;
}

// ---------------- 基础访问（按当前团队隔离） ----------------

/** 读取登录态（不触发数据加载） */
function readAuth() {
  try {
    const a = wx.getStorageSync(AUTH_KEY);
    return a && a.userId ? a : null;
  } catch (e) {
    return null;
  }
}

/** 当前团队 id */
function currentTeamId() {
  const a = readAuth();
  return a ? a.teamId || '' : '';
}

/** 读取原始集合（不做团队过滤，仅用于登录页/团队管理） */
function listAll(name) {
  const d = load();
  return d[name] || [];
}

/** 是否属于当前团队 */
function inScope(record) {
  const tid = currentTeamId();
  if (!tid) return false;
  return (record.teamId || '') === tid;
}

/**
 * 取集合（自动按当前团队过滤，且过滤软删除记录）
 * 未登录时返回空数组，避免任何页面在登录前看到数据。
 */
function list(name) {
  const arr = listAll(name);
  const tid = currentTeamId();
  if (!tid) return [];
  return arr.filter((x) => (x.teamId || '') === tid && !x.deleted);
}

function find(name, id) {
  return list(name).find((x) => x.id === id) || null;
}

function filter(name, predicate) {
  return list(name).filter(predicate);
}

/** 新增记录，自动补 id / 团队标记 */
function insert(name, record, prefix) {
  const d = load();
  const arr = d[name];
  const id = record.id || name.slice(0, 2) + '_' + Date.now().toString(36);
  const next = Object.assign({}, record, { id });
  // 业务数据自动归属当前团队
  if (BUSINESS_COLLECTIONS.indexOf(name) > -1 && !next.teamId) {
    next.teamId = currentTeamId();
  }
  if (!next.createTime) next.createTime = F.dayOffset(0) + ' ' + new Date().toTimeString().slice(0, 5);
  next.updateTime = Date.now();
  arr.unshift(next);
  persist();
  return next;
}

/**
 * 生成业务编号：取当年已用最大序号 +1，含软删记录（避免删除后重号）
 */
function nextSerial(name, prefix) {
  const head = prefix + String(new Date().getFullYear());
  const rows = listAll(name) || [];
  let max = 0;
  rows.forEach((r) => {
    const no = String((r && r.no) || '');
    if (no.indexOf(head) !== 0) return;
    const n = parseInt(no.slice(head.length), 10);
    if (n > max) max = n;
  });
  return head + String(max + 1).padStart(3, '0');
}

/** 按 id 局部更新 */
function update(name, id, patch) {
  const d = load();
  const item = d[name].find((x) => x.id === id);
  if (!item) return null;
  Object.assign(item, patch);
  item.updateTime = Date.now();
  persist();
  return item;
}

/**
 * 删除记录（软删除）
 *
 * 为什么不物理删除：软删除记录会随云同步一起推到其他设备，
 * 各端 list() 都会过滤掉，多设备删除状态才一致；物理删除在多端会"复活"。
 */
function remove(name, id) {
  const d = load();
  const item = d[name].find((x) => x.id === id);
  if (!item) return false;
  item.deleted = true;
  item.deletedTime = F.today() + ' ' + new Date().toTimeString().slice(0, 5);
  item.updateTime = Date.now();
  persist();
  return true;
}

/** 撤销删除（回收站用，暂未开放入口） */
function restore(name, id) {
  const d = load();
  const item = d[name].find((x) => x.id === id);
  if (!item) return false;
  item.deleted = false;
  item.deletedTime = '';
  item.updateTime = Date.now();
  persist();
  return true;
}

// ---------------- 删除 / 作废 ----------------

// 各集合允许执行删除的角色
const DELETE_ACCESS = {
  customers: ['老板'],
  quotes: ['老板', '设计师', '销售'],
  contracts: ['老板', '财务'],
  materials: ['老板', '项目经理'],
  expenses: ['老板', '财务'],
  receipts: ['老板', '财务'],
  aftersales: ['老板', '设计师', '项目经理']
};

/** 当前用户角色（老板优先） */
function currentRole() {
  if (isOwner()) return '老板';
  const u = getCurrentUser();
  return (u && u.role) || '';
}

/** 是否有权删除某集合的记录 */
function canDelete(name) {
  const allow = DELETE_ACCESS[name];
  if (!allow) return false;
  return allow.indexOf(currentRole()) > -1;
}

/**
 * 删除记录（软删除 + 角色校验）
 * @returns {{ok:boolean, msg?:string}}
 */
function deleteRecord(name, id) {
  if (!DELETE_ACCESS[name]) return { ok: false, msg: '该类型不支持删除' };
  if (!canDelete(name)) return { ok: false, msg: '当前角色无权删除' };
  const item = find(name, id);
  if (!item) return { ok: false, msg: '记录不存在或已删除' };

  // 删除客户前检查是否还有未结清的合同/项目，避免产生能继续收款的孤儿单据
  if (name === 'customers') {
    const alive = (n) => (listAll(n) || []).filter((x) => !x.deleted);
    const busyContract = alive('contracts').some(
      (c) => c.customerId === id && c.status !== '已作废' && c.status !== '已完成'
    );
    const busyProject = alive('projects').some(
      (p) => p.customerId === id && p.status !== '已完工' && p.status !== '已结算'
    );
    if (busyContract || busyProject) {
      return { ok: false, msg: '该客户还有未完成的合同或项目，请先处理' };
    }
  }

  remove(name, id);
  logAction('删除', name + ' / ' + (item.name || item.no || id));
  return { ok: true };
}

/** 合同作废（保留记录，状态置为已作废） */
function voidContract(id) {
  const role = currentRole();
  if (role !== '老板' && role !== '财务') return { ok: false, msg: '当前角色无权作废合同' };
  const ct = find('contracts', id);
  if (!ct) return { ok: false, msg: '合同不存在' };
  if (ct.status === '已作废') return { ok: false, msg: '合同已作废' };
  update('contracts', id, { status: '已作废' });
  logAction('作废合同', ct.no || id);
  // 级联：未完工的项目一并归档，不再参与在建统计与毛利排行
  if (ct.projectId) {
    const p = find('projects', ct.projectId);
    if (p && p.status !== '已完工' && p.status !== '已结算') {
      update('projects', ct.projectId, { archived: true, archiveReason: '合同已作废' });
    }
  }
  return { ok: true };
}

// ---------------- 操作日志（本地保留最近 200 条） ----------------

const AUDIT_KEY = 'zx_erp_audit_v1';

/** 记录一次关键操作，便于事后追溯 */
function logAction(action, detail) {
  try {
    const rows = wx.getStorageSync(AUDIT_KEY) || [];
    const user = getCurrentUser();
    rows.unshift({
      action: String(action || ''),
      detail: String(detail || ''),
      operator: user ? user.name : '',
      time: F.today() + ' ' + new Date().toTimeString().slice(0, 5)
    });
    wx.setStorageSync(AUDIT_KEY, rows.slice(0, 200));
  } catch (e) {}
}

function auditLog(limit) {
  try {
    return (wx.getStorageSync(AUDIT_KEY) || []).slice(0, limit || 20);
  } catch (e) {
    return [];
  }
}

// ---------------- 业务关联查询 ----------------

function nodesOf(projectId) {
  const p = find('projects', projectId);
  return p ? p.nodes || [] : [];
}

function projectOf(customerId) {
  return list('projects').find((p) => p.customerId === customerId) || null;
}

function contractOfProject(projectId) {
  const p = find('projects', projectId);
  if (p && p.contractId) return find('contracts', p.contractId);
  return list('contracts').find((c) => c.projectId === projectId) || null;
}

function contractsOfCustomer(customerId) {
  return list('contracts').filter((c) => c.customerId === customerId);
}

function quotesOfCustomer(customerId) {
  return list('quotes').filter((q) => q.customerId === customerId);
}

function followsOfCustomer(customerId) {
  return list('follows')
    .filter((f) => f.customerId === customerId)
    .sort((a, b) => (a.time < b.time ? 1 : -1));
}

function receiptsOfProject(projectId) {
  return list('receipts').filter((r) => r.projectId === projectId);
}

function receiptsOfContract(contractId) {
  return list('receipts').filter((r) => r.contractId === contractId);
}

function expensesOfProject(projectId) {
  return list('expenses').filter((e) => e.projectId === projectId);
}

function materialsOfProject(projectId) {
  return list('materials').filter((m) => m.projectId === projectId);
}

function inspectionsOfProject(projectId) {
  return list('inspections')
    .filter((i) => i.projectId === projectId)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

function changesOfProject(projectId) {
  return list('changes')
    .filter((c) => c.projectId === projectId)
    .sort((a, b) => (a.createTime < b.createTime ? 1 : -1));
}

function aftersalesOfProject(projectId) {
  return list('aftersales').filter((a) => a.projectId === projectId);
}

function todosPending() {
  return list('todos').filter((t) => t.status === '待处理');
}

function customerOf(id) {
  return find('customers', id);
}

function userOf(id) {
  return find('users', id);
}

/** 项目 + 汇总信息，用于列表展示 */
function projectCard(project) {
  const s = seed.projectSummary(project);
  return Object.assign({}, project, s, {
    progress: s.progress,
    contractWan: F.wan(project.contractAmount),
    costRatio: F.percent(project.cost, project.contractAmount || 1)
  });
}

function projectCards(filterFn) {
  const alive = list('projects').filter((p) => !p.archived);
  const arr = filterFn ? alive.filter(filterFn) : alive.slice();
  return arr.map(projectCard);
}

// ---------------- 客户 ----------------

function saveCustomer(data) {
  if (data.id) {
    const old = find('customers', data.id);
    const patch = Object.assign({}, data);
    delete patch.id;
    return update('customers', data.id, patch);
  }
  return insert('customers', Object.assign({
    no: nextSerial('customers', 'KH'),
    status: '新线索',
    level: 'C',
    createTime: F.today() + ' ' + new Date().toTimeString().slice(0, 5),
    lastFollow: '',
    nextFollow: F.dayOffset(2),
    tags: []
  }, data));
}

// 客户状态只能单向推进，避免各页面各写一套规则
const CUSTOMER_FLOW = ['新线索', '跟进中', '已量房', '已报价', '已签约'];

/** 把客户推进到目标状态；已流失/已签约不再自动改，低阶段不回退 */
function advanceCustomer(customerId, target) {
  const c = find('customers', customerId);
  if (!c || !target) return null;
  if (c.status === '已流失' || c.status === '已签约') return c;
  const cur = CUSTOMER_FLOW.indexOf(c.status);
  const to = CUSTOMER_FLOW.indexOf(target);
  if (to < 0 || to <= cur) return c;
  return update('customers', customerId, { status: target });
}

function addFollow(customerId, record) {
  const user = getCurrentUser();
  const data = Object.assign({}, record);
  // nextFollow 是客户的“计划字段”，不写进跟进记录
  const nextFollow = data.nextFollow;
  delete data.nextFollow;

  const item = insert('follows', Object.assign({
    customerId,
    time: F.today() + ' ' + new Date().toTimeString().slice(0, 5),
    ownerId: user ? user.id : '',
    ownerName: user ? user.name : ''
  }, data));

  const patch = { lastFollow: item.time };
  if (nextFollow !== undefined) patch.nextFollow = nextFollow || '';
  update('customers', customerId, patch);
  return item;
}

// ---------------- 施工节点 ----------------

function updateNode(projectId, nodeId, patch) {
  const p = find('projects', projectId);
  if (!p || !p.nodes) return null;
  const node = p.nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  Object.assign(node, patch);

  // ---- 项目状态机自动流转 ----
  const allDone = p.nodes.every((n) => n.status === '已完成');
  const anyRunning = p.nodes.some((n) => n.status === '进行中');
  const anyDone = p.nodes.some((n) => n.status === '已完成');

  if (allDone) {
    // 全部节点完成 → 已完工（已结算的项目保持已结算）
    if (p.status !== '已完工' && p.status !== '已结算') {
      p.status = '已完工';
      if (!p.actualEndDate) p.actualEndDate = F.today();
    }
  } else if (p.status === '未开工' && (anyRunning || anyDone)) {
    // 首个节点开工 → 施工中
    p.status = '施工中';
  } else if (p.status === '已完工' && !allDone) {
    // 已完工项目被重新打开节点 → 回到施工中
    p.status = '施工中';
    p.actualEndDate = '';
  }

  p.updateTime = Date.now(); // 节点变更必须刷新项目时间戳，否则多端合并会被旧数据覆盖
  persist();
  return node;
}

function startNode(projectId, nodeId) {
  const p = find('projects', projectId);
  if (!p) return null;
  // 合同还处于「待签约」时不允许开工，避免未签约先施工
  if (p.contractId) {
    const ct = find('contracts', p.contractId);
    if (ct && ct.status === '待签约') return null;
  }
  p.nodes.forEach((n) => {
    if (n.status === '进行中') {
      n.status = '已完成';
      if (!n.actualEnd) n.actualEnd = F.today();
    }
  });
  return updateNode(projectId, nodeId, {
    status: '进行中',
    actualStart: F.today()
  });
}

function finishNode(projectId, nodeId) {
  const cur = findNode(projectId, nodeId);
  if (!cur || cur.status !== '进行中') return null;  // 未开工不能直接标记完成
  return updateNode(projectId, nodeId, {
    status: '已完成',
    actualEnd: F.today(),
    actualStart: findNode(projectId, nodeId).actualStart || F.today()
  });
}

function findNode(projectId, nodeId) {
  const p = find('projects', projectId);
  if (!p) return null;
  return (p.nodes || []).find((n) => n.id === nodeId) || null;
}

// ---------------- 巡检 ----------------

function addInspection(projectId, data) {
  const user = getCurrentUser();
  return insert('inspections', Object.assign({
    projectId,
    date: F.today(),
    inspector: user ? user.name : '',
    result: '合格',
    items: [],
    images: [],
    remark: ''
  }, data));
}

// ---------------- 收款 / 支出 ----------------

function addReceipt(data) {
  const user = getCurrentUser();
  const amount = Number((data && data.amount) || 0);
  if (!(amount > 0)) return null;

  // 分期上限校验：防止重复点击把同一期收超
  if (data.contractId && data.planId) {
    const ct0 = find('contracts', data.contractId);
    if (!ct0 || ct0.status === '已作废') return null;   // 作废合同不能再收款
    const plan0 = (ct0.payPlan || []).find((x) => x.id === data.planId);
    if (!plan0) return null;
    const remain = (plan0.amount || 0) - (plan0.paidAmount || 0);
    if (amount > remain + 0.01) return null;
  }

  const item = insert('receipts', Object.assign({
    no: nextSerial('receipts', 'SK'),
    date: F.today(),
    operator: user ? user.name : '',
    method: '银行转账'
  }, data));

  // 同步合同分期与项目已收款
  if (data.contractId && data.planId) {
    const ct = find('contracts', data.contractId);
    if (ct) {
      const plan = (ct.payPlan || []).find((x) => x.id === data.planId);
      if (plan) {
        plan.paidAmount = (plan.paidAmount || 0) + data.amount;
        plan.paidDate = item.date;
        plan.status = plan.paidAmount >= plan.amount ? '已收款' : '部分收款';
      }
      const totalPaid = (ct.payPlan || []).reduce((s, x) => s + (x.paidAmount || 0), 0);
      if (totalPaid >= ct.amount) ct.status = ct.status === '待签约' ? ct.status : '已完成';
      ct.updateTime = Date.now();   // 让云端合并认得出这次变更
      persist();
    }
    logAction('收款登记', '¥' + F.money(amount) + ' / ' + (data.planId || ''));
    if (data.projectId) {
      const p = find('projects', data.projectId);
      if (p) {
        p.received = (p.received || 0) + data.amount;
        p.updateTime = Date.now();
        persist();
      }
    }
  }
  return item;
}

function addExpense(data) {
  const user = getCurrentUser();
  const item = insert('expenses', Object.assign({
    no: nextSerial('expenses', 'ZC'),
    date: F.today(),
    status: '待审批',
    applicant: user ? user.name : '',
    approver: '',
    approveDate: '',
    payDate: ''
  }, data));
  // 生成审批待办，工作台「待我处理」才不会是空的
  addTodo({
    type: '费用审批',
    title: '支出待审批：' + (item.category || '支出') + ' ¥' + F.money(item.amount),
    desc: (item.supplier || '未填供应商') + ' · ' + (item.remark || ''),
    targetId: item.id,
    targetType: 'expense',
    level: '普通'
  });
  return item;
}

function approveExpense(id, pass, remark) {
  const user = getCurrentUser();
  const patch = {
    status: pass ? '已通过' : '已驳回',
    approver: user ? user.name : '审批人',
    approveDate: F.today(),
    approveRemark: remark || ''
  };
  if (pass) patch.payDate = F.today();
  const before = find('expenses', id);
  if (!before || before.status !== '待审批') return null;  // 幂等：只能从待审批流转
  const item = update('expenses', id, patch);
  // 关闭对应待办（历史数据用 refId，新数据用 targetId，两种都兼容）
  const todo = list('todos').find(
    (t) => (t.targetId === id || t.refId === id) && t.status === '待处理'
  );
  if (todo) update('todos', todo.id, { status: '已处理', dealTime: patch.approveDate });
  logAction(pass ? '审批通过' : '审批驳回', (item && item.no) || id);
  // 通过后计入项目成本
  if (pass && item && item.projectId) {
    const p = find('projects', item.projectId);
    if (p) {
      p.cost = (p.cost || 0) + item.amount;
      p.updateTime = Date.now();
      persist();
    }
  }
  return item;
}

// ---------------- 变更签证 ----------------

function addChange(projectId, data) {
  const user = getCurrentUser();
  return insert('changes', Object.assign({
    no: nextSerial('changes', 'BG'),
    projectId,
    status: '待确认',
    time: F.today(),
    applicant: user ? user.name : '',
    amount: 0,
    title: ''
  }, data));
}

function confirmChange(id, pass) {
  const c = find('changes', id);
  const item = update('changes', id, {
    status: pass ? '已确认' : '已驳回',
    confirmTime: F.today() + ' ' + new Date().toTimeString().slice(0, 5)
  });
  // 确认增项后计入项目预算（只加一次）
  if (pass && c && !c.applied && c.projectId && Number(c.amount) > 0) {
    const p = find('projects', c.projectId);
    if (p) {
      p.budget = (p.budget || 0) + Number(c.amount);
      p.updateTime = Date.now();
      persist();
    }
    update('changes', id, { applied: true });
  }
  return item;
}

// ---------------- 材料 ----------------

function addMaterial(data) {
  return insert('materials', Object.assign({
    no: nextSerial('materials', 'CL'),
    status: '待采购',
    orderDate: '',
    arriveDate: '',
    keeper: ''
  }, data));
}

function setMaterialStatus(id, status) {
  const m = find('materials', id);
  const patch = { status };
  if (status === '已下单') patch.orderDate = F.today();
  if (status === '已入库') {
    patch.arriveDate = F.today();
    // 入库即计入项目成本，costApplied 防止重复累加
    if (m && !m.costApplied && m.projectId && Number(m.amount) > 0) {
      const p = find('projects', m.projectId);
      if (p) {
        p.cost = (p.cost || 0) + Number(m.amount);
        p.updateTime = Date.now();
        persist();
      }
      patch.costApplied = true;
    }
  }
  return update('materials', id, patch);
}

// ---------------- 售后 ----------------

function addAftersale(data) {
  const user = getCurrentUser();
  const item = insert('aftersales', Object.assign({
    no: nextSerial('aftersales', 'SH'),
    status: '待受理',
    createTime: F.today() + ' ' + new Date().toTimeString().slice(0, 5),
    handler: '',
    resolveTime: '',
    records: []
  }, data));
  addAftersaleRecord(item.id, '创建工单', '客户报修已登记，等待受理。', user ? user.name : '系统');
  return item;
}

function addAftersaleRecord(id, action, content, operator) {
  const item = find('aftersales', id);
  if (!item) return null;
  item.records = item.records || [];
  item.records.push({
    id: 'ar_' + Date.now().toString(36),
    time: F.today() + ' ' + new Date().toTimeString().slice(0, 5),
    operator: operator || (getCurrentUser() || {}).name || '',
    action,
    content
  });
  persist();
  return item;
}

function setAftersaleStatus(id, status) {
  const patch = { status };
  if (status === '已完成') patch.resolveTime = F.today();
  if (status === '处理中') {
    const u = getCurrentUser();
    patch.handler = u ? u.name : '';
  }
  return update('aftersales', id, patch);
}

// ---------------- 报价 ----------------

function saveQuote(data) {
  if (data.id) {
    const patch = Object.assign({}, data);
    delete patch.id;
    return update('quotes', data.id, patch);
  }
  const quote = insert('quotes', Object.assign({
    no: nextSerial('quotes', 'BJ'),
    status: '草稿',
    createTime: F.today() + ' ' + new Date().toTimeString().slice(0, 5),
    creator: (getCurrentUser() || {}).name || ''
  }, data));
  advanceCustomer(quote.customerId, '已报价');
  return quote;
}

function setQuoteStatus(id, status) {
  return update('quotes', id, { status });
}

// ---------------- 合同签约后自动建项目 ----------------

/**
 * 根据合同生成施工项目（含标准工序节点）
 * 用途：报价 → 合同 → 自动开户，把「签约」和「施工」两条链路接起来。
 * @param {string} contractId
 * @returns {object|null} 项目对象
 */
function createProjectFromContract(contractId) {
  const ct = find('contracts', contractId);
  if (!ct) return null;

  // 已关联项目则直接返回，避免重复开户
  if (ct.projectId) {
    const existed = find('projects', ct.projectId);
    if (existed) return existed;
  }

  const cust = find('customers', ct.customerId) || {};
  const year = new Date().getFullYear();
  const startDate = ct.startDate || F.dayOffset(3);

  // 按标准工序模板生成节点，并顺推计划日期
  let cursor = new Date(String(startDate).replace(/-/g, '/'));
  const totalWeight = C.NODE_TEMPLATE.reduce((s, n) => s + n.weight, 0);
  const nodes = C.NODE_TEMPLATE.map((tpl, i) => {
    const planStart = F.date(cursor);
    cursor.setDate(cursor.getDate() + tpl.days);
    const planEnd = F.date(cursor);
    return {
      id: 'n_new_' + Date.now().toString(36) + '_' + (i + 1),
      projectId: '',
      seq: i + 1,
      name: tpl.name,
      category: tpl.category,
      weight: Math.round((tpl.weight / totalWeight) * 1000) / 10,
      status: '未开始',
      planStart,
      planEnd,
      actualStart: '',
      actualEnd: '',
      owner: '',
      remark: '',
      images: []
    };
  });

  const user = getCurrentUser();
  const manager = list('users').find((u) => u.role === '项目经理') || user || {};

  const project = insert('projects', {
    no: nextSerial('projects', 'XM'),
    name: (cust.name || '新客户') + ' · ' + (cust.house || '待定址') + ' 项目',
    customerId: ct.customerId,
    address: cust.house || '待补充',
    area: cust.area || 0,
    houseType: cust.houseType || '平层',
    projectType: '全包',
    style: cust.style || '现代简约',
    status: '未开工',
    startDate,
    planEndDate: ct.planEndDate || F.dayOffset(93),
    actualEndDate: '',
    managerId: manager.id || '',
    managerName: manager.name || '',
    designerId: '',
    designerName: '',
    supervisorName: '',
    contractId: ct.id,
    contractAmount: ct.amount || 0,
    budget: Math.round((ct.amount || 0) * 0.75),
    cost: 0,
    received: 0,
    nodes,
    tags: ['自动开户']
  });

  // 回写项目 id 到节点
  project.nodes.forEach((n) => {
    n.projectId = project.id;
  });

  // 双向绑定合同 ↔ 项目
  update('contracts', ct.id, { projectId: project.id });
  // 客户状态由「合同确认签约」时推进，此处只是生成待签约合同
  persist();
  return project;
}

/**
 * 合同确认签约：状态转为履行中，记录签约日期，并把客户推进到已签约
 */
function signContract(contractId) {
  const ct = find('contracts', contractId);
  if (!ct) return null;
  const patched = update('contracts', contractId, {
    status: '履行中',
    signDate: F.today()
  });
  if (patched && patched.projectId) {
    update('projects', patched.projectId, { contractId: patched.id, contractAmount: patched.amount });
  }
  advanceCustomer(ct.customerId, '已签约');
  logAction('合同签约', patched.no || contractId);
  return patched;
}

// ---------------- 待办 ----------------

function dealTodo(id, pass) {
  return update('todos', id, {
    status: pass ? '已处理' : '已驳回',
    dealTime: F.today() + ' ' + new Date().toTimeString().slice(0, 5)
  });
}

function addTodo(data) {
  return insert('todos', Object.assign({
    status: '待处理',
    level: '普通',
    createTime: F.today() + ' ' + new Date().toTimeString().slice(0, 5)
  }, data));
}

// ---------------- 团队 ----------------

const TEAM_ROLES = ['老板', '设计师', '项目经理', '财务', '销售'];

// 员工加入团队时可自选的角色；财务/老板必须由老板授予
const SELF_ROLES = ['设计师', '项目经理', '销售'];

/** 随机邀请码（去掉易混淆字符 0/O/1/I） */
function genInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function currentTeam() {
  const tid = currentTeamId();
  if (!tid) return null;
  return listAll('teams').find((t) => t.id === tid) || null;
}

/** 团队成员（含老板） */
function teamMembers() {
  const tid = currentTeamId();
  if (!tid) return [];
  const team = currentTeam();
  return listAll('users')
    .filter((u) => (u.teamId || '') === tid)
    .map((u) =>
      Object.assign({}, u, {
        isOwner: !!(team && team.ownerId === u.id),
        roleText: team && team.ownerId === u.id ? '老板' : u.role
      })
    );
}

/** 是否为团队老板 */
function isOwner() {
  const u = getCurrentUser();
  const team = currentTeam();
  return !!(u && team && team.ownerId === u.id);
}

/**
 * 把当前团队与成员表自举到云端（fire-and-forget）
 * 团队/成员的建立不走成员校验（那是自举死锁），服务端只做 openid 轻校验。
 */
async function bootstrapTeamToCloud() {
  if (!cloud.enabled()) return;
  const team = currentTeam();
  if (!team) return;
  const me = getCurrentUser();

  // 确保拿到 openid，否则服务端无法把成员和微信身份绑定
  const openid = await cloud.ensureLogin();
  if (me && openid && me.openid !== openid) {
    update('users', me.id, { openid });
  }

  // 密码只留在本机，上报前剔除（服务端也会再兜底删一次）
  const members = teamMembers().map((m) => {
    const safe = Object.assign({}, m, { openid: m.openid || '' });
    delete safe.password;
    return safe;
  });
  if (me) {
    const inList = members.find((m) => m.id === me.id);
    if (inList) inList.openid = openid || me.openid || '';
  }
  cloud.bootstrapTeam(team.id, team, members).catch(() => {});
}

/**
 * 创建团队（当前登录用户成为老板）
 * @returns {{ok:boolean, team?:object, msg?:string}}
 */
function createTeam(data) {
  const d = load();
  const name = String((data && data.name) || '').trim();
  if (!name) return { ok: false, msg: '请填写公司名称' };

  const user = getCurrentUser();
  if (!user) return { ok: false, msg: '请先登录' };

  const teamId = 't_' + Date.now().toString(36);
  const team = {
    id: teamId,
    name,
    ownerId: user.id,
    inviteCode: genInviteCode(),
    industry: (data && data.industry) || '家装 / 整装',
    city: (data && data.city) || '',
    phone: (data && data.phone) || '',
    status: '正常',
    createTime: F.today(),
    updateTime: Date.now()
  };
  d.teams.push(team);

  // 创建者成为老板
  const u = d.users.find((x) => x.id === user.id);
  if (u) {
    u.teamId = teamId;
    u.role = '老板';
  }
  persist();
  setAuth({ userId: user.id, teamId });
  bootstrapTeamToCloud();
  return { ok: true, team };
}

/**
 * 加入团队（通过邀请码）
 * 新用户会同时创建成员记录
 */
async function joinTeam(data) {
  const code = String((data && data.inviteCode) || '').trim().toUpperCase();
  if (!code) return { ok: false, msg: '请输入邀请码' };

  let user = getCurrentUser();
  const name = String((data && data.name) || '').trim();
  // 财务/老板不能自助选择，只能由老板后续调整
  const role = SELF_ROLES.indexOf(data && data.role) > -1 ? data.role : '设计师';
  const phone = (data && data.phone) || '';

  // 云端可用：邀请码在云端校验，跨设备都能正确加入
  if (cloud.enabled()) {
    const openid = await cloud.ensureLogin();
    const member = {
      id: user ? user.id : '',
      name: user ? user.name : name,
      phone: user ? user.phone || phone : phone,
      role: user ? (role === '设计师' && user.role ? user.role : role) : role,
      account: user ? user.account : 'u' + Date.now().toString(36),
      // 新成员不设默认弱密码；需要账号密码登录可在设置页自行设置
      password: '',
      openid
    };
    const res = await cloud.joinByCode(code, member);
    if (!res || !res.ok) return { ok: false, msg: (res && res.msg) || '加入失败' };

    const teamId = res.team.id;
    // 落本地团队与成员，保证离线也能用
    const d = load();
    if (!d.teams.find((t) => t.id === teamId)) d.teams.push(res.team);
    if (!user) {
      user = insert('users', Object.assign({}, member, { id: res.memberId, teamId }));
    } else {
      update('users', user.id, { teamId, openid });
    }
    persist();
    setAuth({ userId: user.id, teamId });
    return { ok: true, team: res.team, user: user };
  }

  // 离线 / 演示：本地按邀请码匹配
  const d = load();
  const team = d.teams.find((t) => String(t.inviteCode).toUpperCase() === code);
  if (!team) return { ok: false, msg: '邀请码无效，请向老板确认' };
  if (team.status === '已停用') return { ok: false, msg: '该团队已停用' };

  if (!user) {
    if (!name) return { ok: false, msg: '请填写姓名' };
    user = insert('users', {
      name,
      account: 'u' + Date.now().toString(36),
      password: '',
      role,
      phone,
      teamId: team.id
    });
  } else {
    update('users', user.id, { teamId: team.id, role: role || user.role || '设计师' });
  }

  setAuth({ userId: user.id, teamId: team.id });
  bootstrapTeamToCloud();
  return { ok: true, team: team, user: user };
}

function renameTeam(name) {
  const team = currentTeam();
  if (!team) return { ok: false, msg: '无团队' };
  update('teams', team.id, { name: String(name || '').trim() || team.name });
  bootstrapTeamToCloud();
  return { ok: true };
}

function regenerateInviteCode() {
  const team = currentTeam();
  if (!team) return { ok: false, msg: '无团队' };
  const code = genInviteCode();
  update('teams', team.id, { inviteCode: code });
  bootstrapTeamToCloud();
  return { ok: true, inviteCode: code };
}

function updateMemberRole(userId, role) {
  if (!isOwner()) return { ok: false, msg: '只有老板可以调整角色' };
  const team = currentTeam();
  if (team && team.ownerId === userId) return { ok: false, msg: '不能修改老板的角色' };
  update('users', userId, { role });
  bootstrapTeamToCloud();
  return { ok: true };
}

function removeMember(userId) {
  if (!isOwner()) return { ok: false, msg: '只有老板可以移除成员' };
  const team = currentTeam();
  if (team && team.ownerId === userId) return { ok: false, msg: '不能移除老板' };
  // 同时清掉 openid：否则云端仍能用旧记录把他认成团队成员
  update('users', userId, { teamId: '', role: '', openid: '' });
  // 服务端同步收回：清空云端 users 的 teamId/openid，避免旧记录继续放行
  if (cloud.enabled()) {
    cloud.call('sync', { action: 'removeMember', teamId: team.id, userId }).catch(() => {});
  }
  bootstrapTeamToCloud();
  return { ok: true };
}

// ---------------- 权限 ----------------

const MODULE_ACCESS = {
  老板: ['*'],
  设计师: ['customer', 'quote', 'contract', 'project', 'aftersale', 'todo'],
  销售: ['customer', 'quote', 'contract', 'project', 'aftersale', 'todo'],
  项目经理: ['project', 'material', 'aftersale', 'customer', 'todo'],
  财务: ['finance', 'report', 'contract', 'customer', 'project', 'todo']
};

/** 当前用户是否可访问某模块 */
function can(module) {
  const user = getCurrentUser();
  if (!user) return false;
  if (isOwner()) return true;
  // 未知角色不回落默认权限，避免角色被篡改后反而拿到设计师权限
  const list_ = MODULE_ACCESS[user.role] || [];
  return list_.indexOf('*') > -1 || list_.indexOf(module) > -1;
}

/**
 * 页面守卫：无权访问时提示并返回 false
 * 用法：if (!store.guard('finance')) return;
 */
function guard(module) {
  if (can(module)) return true;
  wx.showToast({ title: '当前角色无权访问该模块', icon: 'none' });
  setTimeout(() => wx.navigateBack({ fail() { wx.switchTab({ url: '/pages/workbench/index' }); } }), 600);
  return false;
}

// ---------------- 登录态 ----------------

function setAuth(auth) {
  try {
    wx.setStorageSync(AUTH_KEY, Object.assign({ loginTime: Date.now() }, auth));
  } catch (e) {}
}

/** 注册一个还没有团队的账号（等待加入或创建团队） */
function registerUser(data) {
  const name = String((data && data.name) || '').trim();
  if (!name) return { ok: false, msg: '请填写姓名' };
  const user = insert('users', {
    name,
    account: 'u' + Date.now().toString(36),
    password: '',
    role: SELF_ROLES.indexOf(data && data.role) > -1 ? data.role : '设计师',
    phone: (data && data.phone) || '',
    teamId: ''
  });
  setAuth({ userId: user.id, teamId: '' });
  return { ok: true, user };
}

/** 修改登录密码（账号密码登录的兜底通道用） */
function changePassword(userId, oldPwd, newPwd) {
  const u = find('users', userId);
  if (!u) return { ok: false, msg: '账号不存在' };
  if (String(u.password || '') !== String(oldPwd || '')) return { ok: false, msg: '原密码不正确' };
  const next = String(newPwd || '');
  if (next.length < 6) return { ok: false, msg: '新密码至少 6 位' };
  update('users', userId, { password: next });
  return { ok: true };
}

function login(account, password) {
  const user = listAll('users').find(
    (u) => (u.account === account || u.phone === account) && u.password === password
  );
  if (!user) return { ok: false, msg: '账号或密码错误' };
  // 账号已归属团队则直接带上团队
  setAuth({ userId: user.id, teamId: user.teamId || '' });
  return {
    ok: true,
    user: user,
    needTeam: !user.teamId,
    team: user.teamId ? listAll('teams').find((t) => t.id === user.teamId) || null : null
  };
}

/** 切换/绑定团队后重新进入 */
function enterTeam(teamId) {
  const user = getCurrentUser();
  if (!user) return { ok: false, msg: '请先登录' };
  setAuth({ userId: user.id, teamId: teamId });
  return { ok: true };
}

function logout() {
  try {
    wx.removeStorageSync(AUTH_KEY);
  } catch (e) {}
}

/**
 * 微信一键登录：用 openid 从云端取回成员与团队
 * 换设备 / 退出后重进都走这条路，不需要记账号密码
 * @returns {Promise<{ok:boolean, needTeam?:boolean, user?:object, team?:object, msg?:string}>}
 */
async function loginByWechat() {
  if (!cloud.enabled()) return { ok: false, msg: '未开启云开发' };

  const openid = await cloud.ensureLogin();
  if (!openid) return { ok: false, msg: '微信身份获取失败' };

  const res = await cloud.whoami();
  if (!res || !res.ok) {
    return {
      ok: false,
      needTeam: !!(res && res.found === false),
      msg: (res && res.msg) || '该微信还没有团队'
    };
  }

  const remoteUser = res.user || {};
  const remoteTeam = res.team || {};
  if (!remoteUser.id) return { ok: false, msg: '云端成员记录异常' };

  const d = load();

  // 成员：按 id 覆盖或新增（云端不回传密码，本地保留原密码）
  const localUser = (d.users || []).find((u) => u.id === remoteUser.id);
  if (localUser) {
    Object.assign(localUser, remoteUser);
  } else {
    d.users = (d.users || []).concat([Object.assign({ password: '' }, remoteUser)]);
  }

  // 团队
  if (remoteTeam.id) {
    const localTeam = (d.teams || []).find((t) => t.id === remoteTeam.id);
    if (localTeam) Object.assign(localTeam, remoteTeam);
    else d.teams = (d.teams || []).concat([remoteTeam]);
  }
  persist(true);

  const teamId = remoteTeam.id || remoteUser.teamId || '';
  setAuth({ userId: remoteUser.id, teamId });

  if (!teamId) return { ok: true, needTeam: true, user: remoteUser, team: null };

  await syncFromCloud();
  return { ok: true, needTeam: false, user: getCurrentUser() || remoteUser, team: remoteTeam };
}

function getCurrentUser() {
  const auth = readAuth();
  if (auth && auth.userId) {
    const user = listAll('users').find((u) => u.id === auth.userId) || null;
    // 登录态悬空（记录已被清掉）：自动登出，避免“假登录”导致按钮点了没反应
    if (!user) {
      logout();
      return null;
    }
    // 已被移出团队（本地成员记录的 teamId 不再匹配登录态）：立即失效
    if (auth.teamId && String(user.teamId || '') !== String(auth.teamId)) {
      logout();
      return null;
    }
    return user;
  }
  return null;
}

function isLoggedIn() {
  const auth = readAuth();
  if (!auth || !auth.userId || !auth.teamId) return false;
  const user = getCurrentUser();
  const team = listAll('teams').find((t) => t.id === auth.teamId);
  return !!(user && team);
}

// ---------------- 统计（工作台 / 报表） ----------------

function dashboardStats() {
  const projects = list('projects').filter((p) => !p.archived);
  const running = projects.filter((p) => p.status === '施工中');
  const contracts = list('contracts');
  const receipts = list('receipts');
  const expenses = list('expenses');
  const pendingTodos = todosPending();

  const monthPrefix = F.today().slice(0, 7);
  const monthReceipt = receipts
    .filter((r) => String(r.date).slice(0, 7) === monthPrefix)
    .reduce((s, r) => s + r.amount, 0);
  const monthExpense = expenses
    .filter((e) => String(e.date).slice(0, 7) === monthPrefix && e.status !== '已驳回')
    .reduce((s, e) => s + e.amount, 0);

  // 应收只算已签约且未作废的合同，待签约不计入
  const liveContracts = contracts.filter((ct) => ct.status !== '已作废' && ct.status !== '待签约');
  const receivable = liveContracts.reduce((sum, ct) => {
    return sum + (ct.payPlan || []).reduce((s, p) => s + Math.max(0, p.amount - (p.paidAmount || 0)), 0);
  }, 0);

  const overdueReceivable = liveContracts.reduce((sum, ct) => {
    return sum + (ct.payPlan || [])
      .filter((p) => p.status !== '已收款' && p.dueDate && F.daysFromToday(p.dueDate) < 0)
      .reduce((s, p) => s + Math.max(0, p.amount - (p.paidAmount || 0)), 0);
  }, 0);

  const overdueNodes = projects.reduce((sum, p) => {
    return sum + (p.nodes || []).filter((n) => n.status === '已逾期').length;
  }, 0);

  return {
    runningCount: running.length,
    totalCount: projects.length,
    monthReceipt,
    monthExpense,
    receivable,
    overdueReceivable,
    overdueNodes,
    todoCount: pendingTodos.length,
    avgProgress: running.length
      ? Math.round(running.reduce((s, p) => s + seed.projectSummary(p).progress, 0) / running.length)
      : 0
  };
}

function reportStats() {
  const projects = list('projects');
  const contracts = list('contracts');
  const receipts = list('receipts');
  const expenses = list('expenses');

  const totalContract = contracts
    .filter((c) => c.status !== '待签约' && c.status !== '已作废')
    .reduce((s, c) => s + c.amount, 0);
  const totalReceived = receipts.reduce((s, r) => s + r.amount, 0);
  const totalCost = expenses
    .filter((e) => e.status === '已支付' || e.status === '已通过')
    .reduce((s, e) => s + e.amount, 0);
  const totalBudget = projects.reduce((s, p) => s + (p.budget || 0), 0);

  // 近 6 个月收款趋势
  const monthly = [];
  for (let i = 5; i >= 0; i--) {
    const dt = new Date();
    dt.setDate(1);
    dt.setMonth(dt.getMonth() - i);
    const key = F.date(dt).slice(0, 7);
    const income = receipts.filter((r) => String(r.date).slice(0, 7) === key).reduce((s, r) => s + r.amount, 0);
    const cost = expenses
      .filter((e) => String(e.date).slice(0, 7) === key && e.status !== '已驳回')
      .reduce((s, e) => s + e.amount, 0);
    monthly.push({ month: key.slice(5) + '月', income, cost, profit: income - cost });
  }

  // 项目毛利排行
  const activeContractIds = {};
  contracts.forEach((c) => {
    if (c.status !== '待签约' && c.status !== '已作废') activeContractIds[c.id] = true;
  });
  const projectProfit = projects
    .filter((p) => p.contractAmount > 0)
    .filter((p) => !p.contractId || activeContractIds[p.contractId])
    .map((p) => ({
      id: p.id,
      name: p.name,
      contractAmount: p.contractAmount,
      cost: p.cost || 0,
      profit: (p.contractAmount || 0) - (p.cost || 0),
      rate: F.percent((p.contractAmount || 0) - (p.cost || 0), p.contractAmount)
    }))
    .sort((a, b) => b.profit - a.profit);

  // 项目经理维度
  const byManager = {};
  projects.forEach((p) => {
    const key = p.managerName || '未分配';
    if (!byManager[key]) byManager[key] = { name: key, count: 0, amount: 0, profit: 0 };
    byManager[key].count += 1;
    byManager[key].amount += p.contractAmount || 0;
    byManager[key].profit += (p.contractAmount || 0) - (p.cost || 0);
  });

  // 客户来源转化
  const bySource = {};
  list('customers').forEach((c) => {
    if (!bySource[c.source]) bySource[c.source] = { source: c.source, total: 0, signed: 0 };
    bySource[c.source].total += 1;
    if (c.status === '已签约') bySource[c.source].signed += 1;
  });

  return {
    totalContract,
    totalReceived,
    totalCost,
    totalBudget,
    grossProfit: totalContract - totalCost,
    grossRate: F.percent(totalReceived - totalCost, totalReceived || 1),
    monthly,
    projectProfit,
    byManager: Object.keys(byManager).map((k) => byManager[k]),
    bySource: Object.keys(bySource).map((k) => bySource[k])
  };
}

module.exports = {
  // 基础
  list,
  find,
  filter,
  insert,
  nextSerial,
  update,
  remove,
  restore,
  deleteRecord,
  canDelete,
  voidContract,
  currentRole,
  reset,
  refresh: load,
  // 关联查询
  nodesOf,
  findNode,
  projectOf,
  contractOfProject,
  contractsOfCustomer,
  quotesOfCustomer,
  followsOfCustomer,
  receiptsOfProject,
  receiptsOfContract,
  expensesOfProject,
  materialsOfProject,
  inspectionsOfProject,
  changesOfProject,
  addChange,
  aftersalesOfProject,
  todosPending,
  customerOf,
  userOf,
  projectCard,
  projectCards,
  // 写入
  saveCustomer,
  addFollow,
  updateNode,
  startNode,
  finishNode,
  addInspection,
  addReceipt,
  addExpense,
  approveExpense,
  confirmChange,
  addMaterial,
  setMaterialStatus,
  addAftersale,
  addAftersaleRecord,
  setAftersaleStatus,
  saveQuote,
  setQuoteStatus,
  createProjectFromContract,
  signContract,
  advanceCustomer,
  dealTodo,
  addTodo,
  // 登录
  hasConsent,
  setConsent,
  login,
  changePassword,
  loginByWechat,
  logout,
  getCurrentUser,
  isLoggedIn,
  registerUser,
  enterTeam,
  // 团队
  listAll,
  currentTeamId,
  currentTeam,
  teamMembers,
  isOwner,
  createTeam,
  joinTeam,
  renameTeam,
  regenerateInviteCode,
  updateMemberRole,
  removeMember,
  TEAM_ROLES,
  // 权限
  can,
  guard,
  // 云同步
  initCloud,
  syncNow,
  flushToCloud,
  syncFromCloud,
  // 统计
  dashboardStats,
  logAction,
  auditLog,
  reportStats
};
