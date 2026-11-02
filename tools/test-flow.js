/**
 * 端到端业务流程集成测试
 * 模拟真实业务链路：
 *   新建客户 → 跟进 → 报价 → 转合同 → 自动开项目 → 登记收款
 *   → 申请支出 → 审批 → 推进施工节点 → 完工 → 售后 → 报表校验
 *
 * 用法：node tools/test-flow.js
 */
const path = require('path');

const mem = new Map();
global.wx = {
  getStorageSync: (k) => (mem.has(k) ? JSON.parse(mem.get(k)) : ''),
  setStorageSync: (k, v) => mem.set(k, JSON.stringify(v)),
  removeStorageSync: (k) => mem.delete(k)
};

const ROOT = path.join(__dirname, '..');
const config = require(path.join(ROOT, 'config.js'));
config.demoMode = true;
config.useCloud = false;
const store = require(path.join(ROOT, 'data', 'store.js'));
const F = require(path.join(ROOT, 'utils', 'format.js'));
const C = require(path.join(ROOT, 'utils', 'constants.js'));

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

function step(t) {
  console.log('\n▶ ' + t);
}

store.reset();
store.login('admin', '123456');

// ============================================================
step('1. 新建客户');
const cust = store.saveCustomer({
  name: '集成测试客户',
  phone: '13800001234',
  source: '门店到访',
  status: '新线索',
  level: 'B',
  house: '测试花园 1-101',
  area: 120,
  houseType: '平层',
  style: '现代简约',
  budget: 300000,
  ownerName: '马克明'
});
ok('客户已创建', !!cust.id);
ok('客户编号规则正确', /^KH\d{4}\d{3}$/.test(cust.no), cust.no);
ok('初始状态为新线索', cust.status === '新线索', cust.status);

// ============================================================
step('2. 添加跟进记录');
const follow = store.addFollow(cust.id, {
  type: '电话',
  content: '客户已到店，确认量房时间',
  result: '已约量房'
});
ok('跟进记录已创建', !!follow.id);
ok('跟进归属正确', follow.customerId === cust.id);
ok('客户最后跟进时间已更新', !!store.find('customers', cust.id).lastFollow);
ok('跟进记录可查询', store.followsOfCustomer(cust.id).length === 1);

// ============================================================
step('3. 编制报价单');
const items = [
  { id: 'qi_1', category: '基础工程', name: '墙面处理', spec: '腻子两遍', unit: '㎡', qty: 260, price: 28, amount: 7280 },
  { id: 'qi_2', category: '水电工程', name: '水电改造', spec: '全改', unit: '㎡', qty: 120, price: 165, amount: 19800 },
  { id: 'qi_3', category: '主材', name: '瓷砖', spec: '750×1500', unit: '㎡', qty: 120, price: 158, amount: 18960 }
];
const itemsAmount = items.reduce((s, x) => s + x.amount, 0);
const manageRate = 0.08;
const manageFee = Math.round(itemsAmount * manageRate);
const designFee = 8000;
const discount = 2000;
const total = itemsAmount + manageFee + designFee - discount;

const quote = store.saveQuote({
  customerId: cust.id,
  title: '集成测试客户 · 测试花园 120㎡ 全包报价',
  area: 120,
  projectType: '全包',
  manageRate,
  designFee,
  discount,
  items,
  itemsAmount,
  manageFee,
  total,
  status: '待客户确认'
});
ok('报价单已创建', !!quote.id);
ok('报价单编号规则正确', /^BJ\d{4}\d{3}$/.test(quote.no), quote.no);
ok('明细合计正确', quote.itemsAmount === itemsAmount, quote.itemsAmount);
ok('管理费 = 明细 × 8%', quote.manageFee === manageFee, quote.manageFee);
ok('总价公式正确', quote.total === total, quote.total);
ok('客户可查到报价', store.quotesOfCustomer(cust.id).length === 1);

// ============================================================
step('4. 转为合同（模拟页面逻辑，含分期与尾差处理）');
const planDefs = [
  { name: '合同签订首付款', ratio: 0.3, offset: 3 },
  { name: '水电验收款', ratio: 0.3, offset: 25 },
  { name: '泥木验收款', ratio: 0.3, offset: 60 },
  { name: '竣工尾款', ratio: 0.1, offset: 93 }
];
const payPlan = planDefs.map((p, i) => {
  const isLast = i === planDefs.length - 1;
  const planAmount = isLast
    ? total - planDefs.slice(0, i).reduce((s, x) => s + Math.round(total * x.ratio), 0)
    : Math.round(total * p.ratio);
  return {
    id: 'pp_test_' + i,
    name: p.name,
    ratio: p.ratio,
    amount: planAmount,
    dueDate: F.dayOffset(p.offset),
    status: '未收款',
    paidAmount: 0,
    paidDate: ''
  };
});
const contract = store.insert('contracts', {
  no: 'HT' + new Date().getFullYear() + String(store.list('contracts').length + 1).padStart(3, '0'),
  customerId: cust.id,
  projectId: '',
  quoteId: quote.id,
  title: '集成测试客户 · 测试花园 施工合同',
  amount: total,
  signDate: '',
  startDate: F.dayOffset(3),
  planEndDate: F.dayOffset(93),
  status: '待签约',
  payMode: '按进度分期',
  creator: '周文斌',
  remark: '集成测试生成',
  payPlan
});
ok('合同已创建', !!contract.id);
const planSum = contract.payPlan.reduce((s, p) => s + p.amount, 0);
ok('分期合计等于合同额（尾差已吸收）', planSum === total, { planSum, total });
ok('分期为 4 期', contract.payPlan.length === 4);

// ============================================================
step('5. 合同自动开立施工项目');
const project = store.createProjectFromContract(contract.id);
ok('项目已自动创建', !!project, project);
ok('项目编号规则正确', /^XM\d{4}\d{3}$/.test(project.no), project.no);
ok('项目关联正确客户', project.customerId === cust.id);
ok('项目合同额 = 合同金额', project.contractAmount === total, project.contractAmount);
ok('项目是未开工状态', project.status === '未开工', project.status);
ok('节点数量 = 标准工序数', project.nodes.length === C.NODE_TEMPLATE.length, project.nodes.length);
ok('节点权重合计约 100', Math.abs(project.nodes.reduce((s, n) => s + n.weight, 0) - 100) < 2);
ok('节点全部为未开始', project.nodes.every((n) => n.status === '未开始'));
ok('合同已回写 projectId', store.find('contracts', contract.id).projectId === project.id);
ok('生成待签约合同时客户还未算签约', store.find('customers', cust.id).status !== '已签约', store.find('customers', cust.id).status);
ok('客户状态已推进为已报价', store.find('customers', cust.id).status === '已报价', store.find('customers', cust.id).status);
ok('重复开户不会产生第二个项目', (() => {
  const before = store.list('projects').length;
  store.createProjectFromContract(contract.id);
  return store.list('projects').length === before;
})());
ok('项目出现在项目列表', store.projectCards().some((p) => p.id === project.id));

// ============================================================
step('5.5 合同确认签约');
const signed = store.signContract(contract.id);
ok('签约后合同状态为履行中', signed.status === '履行中', signed.status);
ok('签约日期已记录', !!signed.signDate, signed.signDate);
ok('签约后客户状态为已签约', store.find('customers', cust.id).status === '已签约', store.find('customers', cust.id).status);

// ============================================================
step('6. 登记首期收款');
const firstPlan = store.find('contracts', contract.id).payPlan[0];
const rcAmount = firstPlan.amount;
store.addReceipt({
  contractId: contract.id,
  projectId: project.id,
  customerId: cust.id,
  planId: firstPlan.id,
  amount: rcAmount,
  method: '银行转账',
  remark: '首付款'
});
const ctAfterPay = store.find('contracts', contract.id);
ok('分期状态变为已收款', ctAfterPay.payPlan[0].status === '已收款', ctAfterPay.payPlan[0].status);
ok('分期已收金额正确', ctAfterPay.payPlan[0].paidAmount === rcAmount);
ok('分期实收日期已记录', !!ctAfterPay.payPlan[0].paidDate);
ok('项目已收款同步累加', store.find('projects', project.id).received === rcAmount, store.find('projects', project.id).received);
ok('收款记录可查询', store.receiptsOfProject(project.id).length === 1);

// ============================================================
step('7. 支出申请与审批');
const exp = store.addExpense({
  projectId: project.id,
  category: '主材采购',
  amount: 50000,
  supplier: '测试供应商',
  remark: '集成测试支出'
});
ok('支出已创建', !!exp.id);
ok('默认状态为待审批', exp.status === '待审批', exp.status);
const costBefore = store.find('projects', project.id).cost;
store.approveExpense(exp.id, true, '同意');
const expAfter = store.find('expenses', exp.id);
ok('审批后状态为已通过', expAfter.status === '已通过', expAfter.status);
ok('审批人已记录', !!expAfter.approver, expAfter.approver);
ok('审批后计入项目成本', store.find('projects', project.id).cost === costBefore + 50000);

// ============================================================
step('8. 推进施工节点直至完工');
const nodes = store.nodesOf(project.id);
nodes.forEach((n, i) => {
  store.startNode(project.id, n.id);
  store.finishNode(project.id, n.id);
});
const doneProject = store.find('projects', project.id);
ok('所有节点已完成', doneProject.nodes.every((n) => n.status === '已完成'));
ok('项目状态自动转为已完工', doneProject.status === '已完工', doneProject.status);
ok('项目实际完工日期已记录', !!doneProject.actualEndDate, doneProject.actualEndDate);
const summary = require(path.join(ROOT, 'data', 'seed.js')).projectSummary(doneProject);
ok('完工后进度为 100', summary.progress === 100, summary.progress);

// ============================================================
step('9. 售后工单闭环');
const as = store.addAftersale({
  projectId: project.id,
  customerId: cust.id,
  customerName: '集成测试客户',
  phone: '13800001234',
  type: '墙面开裂',
  priority: '紧急',
  desc: '集成测试报修',
  address: '测试花园 1-101'
});
ok('工单已创建', !!as.id);
ok('工单编号规则正确', /^SH\d{4}\d{3}$/.test(as.no), as.no);
ok('默认待受理', as.status === '待受理');
ok('自动生成首条处理记录', as.records.length === 1);
store.setAftersaleStatus(as.id, '处理中');
ok('受理后有处理人', !!store.find('aftersales', as.id).handler);
store.addAftersaleRecord(as.id, '上门处理', '已修复');
ok('处理记录已追加', store.find('aftersales', as.id).records.length === 2);
store.setAftersaleStatus(as.id, '已完成');
ok('完成后有解决时间', !!store.find('aftersales', as.id).resolveTime);

// ============================================================
step('10. 巡检记录');
const ins = store.addInspection(project.id, {
  type: '竣工验收',
  result: '合格',
  items: [
    { name: '墙面平整度', pass: true, note: '' },
    { name: '地面空鼓', pass: true, note: '' }
  ],
  remark: '验收合格'
});
ok('巡检已创建', !!ins.id);
ok('巡检自动记录巡检人', !!ins.inspector, ins.inspector);
ok('巡检可查询', store.inspectionsOfProject(project.id).length === 1);

// ============================================================
step('11. 全局统计与报表包含新数据');
const ds = store.dashboardStats();
ok('看板待收款项 > 0', ds.receivable > 0);
ok('看板总计包含新项目', ds.totalCount >= 7, ds.totalCount);

const rs = store.reportStats();
ok('报表合同总额包含新合同', rs.totalContract >= total);
ok('报表已收款包含新收款', rs.totalReceived >= rcAmount);
ok('报表已支出包含新支出', rs.totalCost >= 50000);
ok('项目毛利排行包含新项目', rs.projectProfit.some((p) => p.id === project.id));
ok('客户来源转化包含新客户', rs.bySource.some((s) => s.source === '门店到访'));

// ============================================================
step('12. 数据持久化');
const raw = mem.get('zx_erp_db_v2');
ok('数据已写入本地存储', !!raw);
const parsed = JSON.parse(raw);
ok('存储中包含新项目', parsed.projects.some((p) => p.id === project.id));
ok('存储中包含新合同', parsed.contracts.some((c) => c.id === contract.id));
const reloaded = JSON.parse(mem.get('zx_erp_db_v2')).projects.find((p) => p.id === project.id);
ok('持久化后节点完整', reloaded.nodes.length === C.NODE_TEMPLATE.length);

// ============================================================
console.log('\n' + '='.repeat(60));
console.log(`端到端流程测试：通过 ${pass} 项，失败 ${fail} 项`);
if (fail) {
  console.log('❌ 流程存在断裂');
  process.exit(1);
}
console.log('✅ 全链路业务闭环验证通过');
