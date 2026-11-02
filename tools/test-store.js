/**
 * 数据层运行时冒烟测试
 * 用内存 Map 模拟 wx 存储，验证 store.js 全部核心业务逻辑。
 * 用法：node tools/test-store.js
 */
const path = require('path');

// ---------- 模拟小程序环境 ----------
const mem = new Map();
global.wx = {
  getStorageSync(k) {
    return mem.has(k) ? JSON.parse(mem.get(k)) : '';
  },
  setStorageSync(k, v) {
    mem.set(k, JSON.stringify(v));
  },
  removeStorageSync(k) {
    mem.delete(k);
  },
  showToast() {},
  navigateTo() {},
  switchTab() {},
  reLaunch() {}
};

const store = require(path.join(__dirname, '..', 'data', 'store.js'));
const seed = require(path.join(__dirname, '..', 'data', 'seed.js'));
const F = require(path.join(__dirname, '..', 'utils', 'format.js'));
const C = require(path.join(__dirname, '..', 'utils', 'constants.js'));
const config = require(path.join(__dirname, '..', 'config.js'));

// 测试固定用演示数据 + 关闭云同步，不受上线配置影响
config.demoMode = true;
config.useCloud = false;

// 数据按团队隔离，测试前必须先登录到演示团队
store.reset();
const __login = store.login('admin', '123456');
if (!__login.ok || !store.currentTeamId()) {
  console.error('✗ 测试前置失败：无法登录演示团队', __login);
  process.exit(1);
}

let pass = 0;
let fail = 0;

function ok(name, cond, extra) {
  if (cond) {
    pass++;
    console.log('  ✓ ' + name);
  } else {
    fail++;
    console.log('  ✗ ' + name + (extra ? '  → ' + extra : ''));
  }
}

function section(t) {
  console.log('\n[' + t + ']');
}

// ---------- 基础数据 ----------
section('种子数据完整性');
ok('客户 >= 10', store.list('customers').length >= 10, store.list('customers').length);
ok('项目 = 6', store.list('projects').length === 6, store.list('projects').length);
ok('合同 = 6', store.list('contracts').length === 6);
ok('报价 = 4', store.list('quotes').length === 4);
ok('用户 = 6', store.list('users').length === 6);
ok('每个项目都有节点', store.list('projects').every((p) => p.nodes && p.nodes.length > 0));
ok('节点权重合计约 100', store.list('projects').every((p) => {
  const s = p.nodes.reduce((a, n) => a + n.weight, 0);
  return Math.abs(s - 100) < 2;
}));

// ---------- 进度计算 ----------
section('施工进度计算');
const p1 = store.find('projects', 'p_1');
const s1 = seed.projectSummary(p1);
ok('p_1 有已完成节点', s1.doneNodes > 0, s1.doneNodes);
ok('p_1 进度 0-100', s1.progress >= 0 && s1.progress <= 100, s1.progress);
ok('p_1 当前阶段非空', !!s1.currentStage, s1.currentStage);
const p3 = store.find('projects', 'p_3');
const s3 = seed.projectSummary(p3);
ok('未开工项目进度较低', s3.progress < 30, s3.progress);

// ---------- 项目卡片 ----------
section('项目卡片聚合');
const cards = store.projectCards();
ok('卡片数量 = 项目数', cards.length === 6, cards.length);
ok('卡片含 progress 字段', typeof cards[0].progress === 'number');
ok('卡片含 contractWan 字段', typeof cards[0].contractWan === 'string');
const running = store.projectCards((p) => p.status === '施工中');
ok('施工中项目 = 3', running.length === 3, running.length);

// ---------- 关联查询 ----------
section('关联查询');
ok('p_1 合同存在', !!store.contractOfProject('p_1'));
ok('c_1 的合同数 >= 1', store.contractsOfCustomer('c_1').length >= 1);
ok('c_1 的跟进记录 >= 2', store.followsOfCustomer('c_1').length >= 2);
ok('c_1 有项目', !!store.projectOf('c_1'));
ok('跟进记录按时间倒序', (() => {
  const f = store.followsOfCustomer('c_1');
  return f.length < 2 || f[0].time >= f[1].time;
})());
ok('p_1 的收款记录 >= 2', store.receiptsOfProject('p_1').length >= 2);

// ---------- 登录 ----------
section('登录鉴权');
store.logout();
ok('未登录状态', store.isLoggedIn() === false);
ok('错误密码被拒绝', store.login('admin', 'wrong').ok === false);
ok('错误账号被拒绝', store.login('nobody', '123456').ok === false);
const loginRes = store.login('admin', '123456');
ok('正确账号登录成功', loginRes.ok === true);
ok('登录后 isLoggedIn', store.isLoggedIn() === true);
ok('当前用户是周文斌', store.getCurrentUser().name === '周文斌', store.getCurrentUser().name);
store.logout();
ok('登出后 isLoggedIn=false', store.isLoggedIn() === false);
store.login('admin', '123456');

// ---------- 统计 ----------
section('经营统计');
const ds = store.dashboardStats();
ok('在建工地 > 0', ds.runningCount > 0, ds.runningCount);
ok('待收款项 > 0', ds.receivable > 0, ds.receivable);
ok('待办数 > 0', ds.todoCount > 0, ds.todoCount);
ok('平均进度 0-100', ds.avgProgress >= 0 && ds.avgProgress <= 100, ds.avgProgress);

const rs = store.reportStats();
ok('合同总额 > 0', rs.totalContract > 0, rs.totalContract);
ok('已收款 > 0', rs.totalReceived > 0, rs.totalReceived);
ok('月度趋势 6 条', rs.monthly.length === 6, rs.monthly.length);
ok('月度数据含 income', typeof rs.monthly[0].income === 'number');
ok('项目毛利排行非空', rs.projectProfit.length > 0);
ok('项目经理维度非空', rs.byManager.length > 0);
ok('客户来源维度非空', rs.bySource.length > 0);

// ---------- 施工节点写入 ----------
section('施工节点流转');
const p2 = store.find('projects', 'p_2');
const runningNode = p2.nodes.find((n) => n.status === '进行中');
ok('p_2 有进行中节点', !!runningNode);
if (runningNode) {
  store.finishNode('p_2', runningNode.id);
  const after = store.findNode('p_2', runningNode.id);
  ok('节点标记完成后状态正确', after.status === '已完成', after.status);
  ok('完成节点有实际完成日期', !!after.actualEnd, after.actualEnd);
  // 进度应增加
  const newS = seed.projectSummary(store.find('projects', 'p_2'));
  ok('完成后进度提升', newS.progress > 0);
}

// ---------- 收款联动 ----------
section('收款登记联动');
const ct2 = store.find('contracts', 'ct_2');
const unpaid = ct2.payPlan.find((x) => x.status !== '已收款');
const beforeReceived = store.find('projects', 'p_2').received;
const beforePaid = unpaid.paidAmount || 0;
const beforeProjectReceived = store.find('projects', 'p_2').received;
const targetAmount = Math.min(10000, unpaid.amount - beforePaid);
const rc = store.addReceipt({
  contractId: 'ct_2',
  projectId: 'p_2',
  customerId: 'c_2',
  planId: unpaid.id,
  amount: targetAmount,
  method: '微信',
  remark: '测试收款'
});
ok('收款记录已创建', !!rc.id);
const ctAfter = store.find('contracts', 'ct_2');
const planAfter = ctAfter.payPlan.find((x) => x.id === unpaid.id);
ok('分期已收金额增加', planAfter.paidAmount === beforePaid + targetAmount, planAfter.paidAmount);
ok('分期状态已更新', planAfter.status === '部分收款' || planAfter.status === '已收款', planAfter.status);
ok('项目已收款增加', store.find('projects', 'p_2').received === beforeProjectReceived + targetAmount);

// ---------- 支出审批联动 ----------
section('支出审批联动');
const pendingExp = store.list('expenses').find((e) => e.status === '待审批');
ok('存在待审批支出', !!pendingExp);
if (pendingExp) {
  const costBefore = store.find('projects', pendingExp.projectId).cost;
  const approved = store.approveExpense(pendingExp.id, true, '同意');
  ok('审批状态变为已通过', approved.status === '已通过', approved.status);
  ok('审批人已记录', !!approved.approver, approved.approver);
  ok('项目成本已累加', store.find('projects', pendingExp.projectId).cost === costBefore + pendingExp.amount);
  const linkedTodo = store.list('todos').find(
    (t) => t.targetId === pendingExp.id || t.refId === pendingExp.id
  );
  if (linkedTodo) ok('审批后关联待办自动关闭', linkedTodo.status !== '待处理', linkedTodo.status);
}
const pendingExp2 = store.list('expenses').find((e) => e.status === '待审批');
if (pendingExp2) {
  const costBefore2 = store.find('projects', pendingExp2.projectId).cost;
  const rejected = store.approveExpense(pendingExp2.id, false, '缺单据');
  ok('驳回状态正确', rejected.status === '已驳回');
  ok('驳回不计入成本', store.find('projects', pendingExp2.projectId).cost === costBefore2);
}

// ---------- 客户 CRUD ----------
section('客户增改');
const newCust = store.saveCustomer({
  name: '测试客户',
  phone: '13500001111',
  source: '门店到访',
  house: '测试小区 1-101',
  area: 90,
  budget: 200000,
  ownerName: '马克明'
});
ok('新增客户有 id', !!newCust.id);
ok('新增客户有编号', /^KH/.test(newCust.no), newCust.no);
ok('新增客户默认状态 新线索', newCust.status === '新线索', newCust.status);

const upd = store.saveCustomer({ id: newCust.id, status: '跟进中', budget: 210000 });
ok('更新客户状态', upd.status === '跟进中', upd.status);
ok('更新客户预算', upd.budget === 210000, upd.budget);
ok('更新未丢失其他字段', upd.name === '测试客户', upd.name);

const f = store.addFollow(newCust.id, { type: '电话', content: '首次联系', result: '有意向' });
ok('新增跟进记录', !!f.id);
ok('跟进记录归属正确', f.customerId === newCust.id);
ok('客户最后跟进时间已更新', !!store.find('customers', newCust.id).lastFollow);

// ---------- 报价 ----------
section('报价计算');
const q = store.find('quotes', 'q_1');
const itemsSum = q.items.reduce((s, x) => s + x.amount, 0);
ok('明细金额合计正确', Math.abs(itemsSum - q.itemsAmount) < 2, `${itemsSum} vs ${q.itemsAmount}`);
const expectManage = Math.round(q.itemsAmount * q.manageRate);
ok('管理费计算正确', Math.abs(expectManage - q.manageFee) < 2, `${expectManage} vs ${q.manageFee}`);
const expectTotal = q.itemsAmount + q.manageFee + q.designFee - q.discount;
ok('合计金额正确', Math.abs(expectTotal - q.total) < 2, `${expectTotal} vs ${q.total}`);

const newQuote = store.saveQuote({
  customerId: 'c_8',
  title: '测试报价',
  area: 100,
  items: [{ name: '测试项', qty: 10, price: 100, amount: 1000, unit: '项', spec: '', category: '基础工程' }],
  itemsAmount: 1000,
  manageFee: 80,
  designFee: 0,
  discount: 0,
  total: 1080
});
ok('新增报价单', !!newQuote.id);
ok('报价单编号正确', /^BJ/.test(newQuote.no), newQuote.no);

// ---------- 材料 ----------
section('材料流转');
const mat = store.addMaterial({
  projectId: 'p_1',
  name: '测试材料',
  category: '辅材',
  spec: '测试规格',
  unit: '件',
  qty: 10,
  price: 50,
  supplier: '测试供应商'
});
ok('新增材料', !!mat.id);
ok('材料默认待采购', mat.status === '待采购', mat.status);
store.setMaterialStatus(mat.id, '已下单');
ok('下单后有下单日期', !!store.find('materials', mat.id).orderDate);
store.setMaterialStatus(mat.id, '已入库');
ok('入库后有到货日期', !!store.find('materials', mat.id).arriveDate);

// ---------- 售后 ----------
section('售后工单');
const as = store.addAftersale({
  projectId: 'p_1',
  customerId: 'c_1',
  customerName: '张明远',
  phone: '13812345678',
  type: '水电问题',
  priority: '普通',
  desc: '测试工单',
  address: '测试地址'
});
ok('新增售后工单', !!as.id);
ok('售后默认待受理', as.status === '待受理', as.status);
ok('自动生成创建记录', as.records.length === 1, as.records.length);
store.setAftersaleStatus(as.id, '处理中');
const asAfter = store.find('aftersales', as.id);
ok('受理后有处理人', !!asAfter.handler, asAfter.handler);
store.addAftersaleRecord(as.id, '上门', '已上门检查');
ok('处理记录已追加', store.find('aftersales', as.id).records.length === 2);
store.setAftersaleStatus(as.id, '已完成');
ok('完成有解决时间', !!store.find('aftersales', as.id).resolveTime);

// ---------- 巡检 ----------
section('巡检记录');
const ins = store.addInspection('p_1', {
  type: '日常巡检',
  result: '合格',
  items: [{ name: '安全', pass: true, note: '' }],
  remark: '测试巡检'
});
ok('新增巡检记录', !!ins.id);
ok('巡检自动记录巡检人', !!ins.inspector, ins.inspector);
ok('巡检记录关联项目', store.inspectionsOfProject('p_1').some((x) => x.id === ins.id));

// ---------- 变更签证 ----------
section('变更签证');
const ch = store.confirmChange('ch_2', true);
ok('变更确认成功', ch.status === '已确认', ch.status);
ok('确认时间已记录', !!ch.confirmTime);

// ---------- 待办 ----------
section('待办处理');
const todo = store.list('todos').find((t) => t.status === '待处理');
ok('存在待办', !!todo);
if (todo) {
  store.dealTodo(todo.id, true);
  const t2 = store.find('todos', todo.id);
  ok('待办状态已处理', t2.status === '已处理', t2.status);
  ok('待办有处理时间', !!t2.dealTime);
}

// ---------- 持久化 ----------
section('持久化与重置');
const custCountBefore = store.list('customers').length;
ok('内存已持久化', mem.has('zx_erp_db_v2'));
store.reset();
ok('重置后客户数恢复', store.list('customers').length === seed.customers.length, store.list('customers').length);
ok('重置后无测试客户', !store.list('customers').some((c) => c.name === '测试客户'));

// ---------- 格式化 ----------
section('格式化工具');
ok('money 千分位', F.money(12800.5) === '12,800.50', F.money(12800.5));
ok('money 零值', F.money(0) === '0.00', F.money(0));
ok('wan 万级', F.wan(128000) === '12.8万', F.wan(128000));
ok('wan 小额', F.wan(5000).indexOf('元') > 0, F.wan(5000));
ok('percent 正常', F.percent(50, 200) === 25, F.percent(50, 200));
ok('percent 除零安全', F.percent(10, 0) === 0, F.percent(10, 0));
ok('percent 上限 100', F.percent(300, 100) === 100, F.percent(300, 100));
ok('maskPhone 脱敏', F.maskPhone('13812345678') === '138****5678', F.maskPhone('13812345678'));
ok('shortName 取末两字', F.shortName('周文斌') === '文斌', F.shortName('周文斌'));
ok('date 格式化', /^\d{4}-\d{2}-\d{2}$/.test(F.date(new Date())), F.date(new Date()));
ok('today 格式正确', /^\d{4}-\d{2}-\d{2}$/.test(F.today()), F.today());
ok('daysFromToday 今天=0', F.daysFromToday(F.today()) === 0, F.daysFromToday(F.today()));
ok('daysFromToday 明天=1', F.daysFromToday(F.dayOffset(1)) === 1, F.daysFromToday(F.dayOffset(1)));
ok('daysFromToday 昨天=-1', F.daysFromToday(F.dayOffset(-1)) === -1, F.daysFromToday(F.dayOffset(-1)));

// ---------- 字典一致性 ----------
section('字典与数据一致性');
const projectStatuses = new Set(store.list('projects').map((p) => p.status));
ok('项目状态都在字典内', [...projectStatuses].every((s) => C.PROJECT_STATUS.includes(s)), [...projectStatuses].join(','));
const nodeStatuses = new Set();
store.list('projects').forEach((p) => p.nodes.forEach((n) => nodeStatuses.add(n.status)));
ok('节点状态都在字典内', [...nodeStatuses].every((s) => C.NODE_STATUS.includes(s)), [...nodeStatuses].join(','));
const custStatuses = new Set(store.list('customers').map((c) => c.status));
ok('客户状态都在字典内', [...custStatuses].every((s) => C.CUSTOMER_STATUS.includes(s)), [...custStatuses].join(','));
const ctStatuses = new Set(store.list('contracts').map((c) => c.status));
ok('合同状态都在字典内', [...ctStatuses].every((s) => C.CONTRACT_STATUS.includes(s)), [...ctStatuses].join(','));
const expStatuses = new Set(store.list('expenses').map((e) => e.status));
ok('支出状态都在字典内', [...expStatuses].every((s) => C.EXPENSE_STATUS.includes(s)), [...expStatuses].join(','));
const matStatuses = new Set(store.list('materials').map((m) => m.status));
ok('材料状态都在字典内', [...matStatuses].every((s) => C.MATERIAL_STATUS.includes(s)), [...matStatuses].join(','));
const asStatuses = new Set(store.list('aftersales').map((a) => a.status));
ok('售后状态都在字典内', [...asStatuses].every((s) => C.AFTERSALE_STATUS.includes(s)), [...asStatuses].join(','));

// 所有状态色映射已定义
ok('项目状态色齐全', C.PROJECT_STATUS.every((s) => !!C.PROJECT_STATUS_COLOR[s]));
ok('节点状态色齐全', C.NODE_STATUS.every((s) => !!C.NODE_STATUS_COLOR[s]));
ok('客户状态色齐全', C.CUSTOMER_STATUS.every((s) => !!C.CUSTOMER_STATUS_COLOR[s]));
ok('合同状态色齐全', C.CONTRACT_STATUS.every((s) => !!C.CONTRACT_STATUS_COLOR[s]));
ok('收款状态色齐全', C.PAY_STATUS.every((s) => !!C.PAY_STATUS_COLOR[s]));
ok('支出状态色齐全', C.EXPENSE_STATUS.every((s) => !!C.EXPENSE_STATUS_COLOR[s]));
ok('材料状态色齐全', C.MATERIAL_STATUS.every((s) => !!C.MATERIAL_STATUS_COLOR[s]));
ok('售后状态色齐全', C.AFTERSALE_STATUS.every((s) => !!C.AFTERSALE_STATUS_COLOR[s]));
ok('优先级色齐全', C.PRIORITY.every((s) => !!C.PRIORITY_COLOR[s]));

// ---------- 汇总 ----------
console.log('\n' + '='.repeat(56));
console.log(`结果：通过 ${pass} 项，失败 ${fail} 项`);
if (fail > 0) {
  console.log('❌ 存在失败项');
  process.exit(1);
}
console.log('✅ 数据层全部测试通过');
