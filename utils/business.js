'use strict';

// 客户端与云函数共用的纯业务规则；部署副本由 tools/prepare-cloud.js 生成。
const ROLES = ['老板', '设计师', '项目经理', '财务', '销售'];
const ACCESS = {
  老板: ['*'],
  设计师: ['customer', 'quote', 'contract', 'project', 'aftersale', 'todo'],
  销售: ['customer', 'quote', 'contract', 'project', 'aftersale', 'todo'],
  项目经理: ['project', 'material', 'aftersale', 'customer', 'todo', 'inspection', 'change'],
  财务: ['finance', 'report', 'contract', 'customer', 'project', 'todo', 'change']
};
const COLLECTIONS = ['customers', 'follows', 'quotes', 'contracts', 'projects', 'inspections', 'changes', 'receipts', 'expenses', 'materials', 'aftersales', 'todos'];
const MODULES = { customers: 'customer', follows: 'customer', quotes: 'quote', contracts: 'contract', projects: 'project', inspections: 'inspection', changes: 'change', receipts: 'finance', expenses: 'finance', materials: 'material', aftersales: 'aftersale', todos: 'todo' };
const CUSTOMER_FLOW = ['新线索', '跟进中', '已量房', '已报价', '已签约'];
const FOLLOW_STATUS = { 继续跟进: '跟进中', 待确认: '跟进中', 已确认: '跟进中', 已约到店: '跟进中', 已到店: '跟进中', 需协调: '跟进中', 待出方案: '跟进中', 已量房: '已量房' };
const NODE_TEMPLATE = [
  ['开工交底', '开工交底', 5, 1], ['墙体拆改', '拆改', 5, 3], ['水电改造', '水电', 15, 7],
  ['水电验收', '水电', 5, 1], ['防水闭水试验', '泥瓦', 5, 3], ['瓷砖铺贴', '泥瓦', 12, 8],
  ['木工吊顶', '木工', 10, 6], ['墙面腻子', '油漆', 10, 7], ['油漆涂刷', '油漆', 8, 5],
  ['主材安装', '安装', 15, 8], ['竣工验收', '竣工', 10, 2]
];

function ensure(condition, message, code) {
  if (condition) return;
  const error = new Error(message);
  error.code = code || 'INVALID_OPERATION';
  throw error;
}
function can(role, module) { return !!(ACCESS[role] && (ACCESS[role].indexOf('*') >= 0 || ACCESS[role].indexOf(module) >= 0)); }
function isFinance(role) { return role === '老板' || role === '财务'; }
function cents(value) {
  const number = Number(value);
  ensure(Number.isFinite(number) && Math.abs(number) <= 1000000000, '金额超出支持范围');
  return Math.round((number + Number.EPSILON) * 100);
}
function money(value) { return cents(value) / 100; }
function positiveMoney(value) {
  const amount = money(value);
  ensure(amount > 0, '金额必须大于零');
  ensure(Math.abs(Number(value) - amount) < 0.000001, '金额最多保留两位小数');
  return amount;
}
function activeContract(contract) { return !!(contract && !contract.deleted && ['已签约', '履行中', '已完成'].indexOf(contract.status) >= 0); }
function isPaidExpense(expense) {
  return !!(expense && !expense.deleted && (expense.status === '已支付' || (expense.status === '已通过' && !expense.accountingVersion && !!expense.payDate)));
}
function expenseDate(expense) { return expense.payDate || expense.date || ''; }
function advanceStatus(current, target) {
  if (current === '已流失' || current === '已签约') return current;
  return CUSTOMER_FLOW.indexOf(target) > CUSTOMER_FLOW.indexOf(current) ? target : current;
}
function quoteAmounts(input) {
  const source = input || {};
  const items = (source.items || []).filter((item) => String(item.name || '').trim()).map((item) => {
    const qty = Number(item.qty);
    ensure(Number.isFinite(qty) && qty > 0 && qty <= 1000000, '明细数量必须是有效正数');
    const price = money(item.price);
    ensure(price >= 0, '明细单价不能为负');
    return Object.assign({}, item, { name: String(item.name).trim(), qty, price, amount: money(qty * price) });
  });
  ensure(items.length > 0 && items.length <= 500, '请填写一至五百条有效明细');
  const manageRate = Number(source.manageRate || 0);
  ensure(Number.isFinite(manageRate) && manageRate >= 0 && manageRate <= 1, '管理费率应在 0% 至 100% 之间');
  const designFee = money(source.designFee || 0);
  const discount = money(source.discount || 0);
  ensure(designFee >= 0 && discount >= 0, '设计费和优惠不能为负');
  const itemsAmount = items.reduce((sum, item) => sum + cents(item.amount), 0) / 100;
  const manageFee = money(itemsAmount * manageRate);
  const total = money(itemsAmount + manageFee + designFee - discount);
  ensure(total >= 0, '优惠金额不能超过合计');
  return { items, itemsAmount, manageRate, manageFee, designFee, discount, total };
}
function dayOffset(date, days) {
  const d = new Date(String(date).slice(0, 10).replace(/-/g, '/') + ' 00:00:00');
  ensure(Number.isFinite(d.getTime()), '日期无效');
  d.setDate(d.getDate() + days);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function buildContract(quote, customer, id, today, no) {
  ensure(quote && !quote.deleted && quote.status === '已确认', '请先确认客户已接受报价');
  ensure(customer && !customer.deleted && customer.status !== '已流失', '请先激活客户再生成合同');
  const amount = positiveMoney(quote.total);
  const totalCents = cents(amount);
  const defs = [['合同签订首付款', 0.3, 3], ['水电验收款', 0.3, 25], ['泥木验收款', 0.3, 60], ['竣工尾款', 0.1, 93]];
  let allocated = 0;
  const payPlan = defs.map((entry, index) => {
    const value = index === defs.length - 1 ? totalCents - allocated : Math.round(totalCents * entry[1]);
    allocated += value;
    return { id: id + '_pp' + index, name: entry[0], ratio: entry[1], amount: value / 100, dueDate: dayOffset(today, entry[2]), status: '未收款', paidAmount: 0, paidDate: '' };
  });
  return { id, no, customerId: customer.id, quoteId: quote.id, projectId: '', title: quote.title + ' 施工合同', amount, originalAmount: amount, signDate: '', startDate: dayOffset(today, 3), planEndDate: dayOffset(today, 93), status: '待签约', payMode: '按进度分期', payPlan, scheduleBaseDate: today, remark: '由报价单生成，签约后生效' };
}
function buildProject(contract, customer, actor, id, today, no) {
  let date = contract.startDate || today;
  const nodes = NODE_TEMPLATE.map((entry, index) => {
    const planStart = date;
    date = dayOffset(date, entry[3]);
    return { id: id + '_n' + (index + 1), projectId: id, seq: index + 1, name: entry[0], category: entry[1], weight: entry[2], status: '未开始', planStart, planEnd: date, actualStart: '', actualEnd: '', owner: '', remark: '', images: [] };
  });
  return { id, no, name: customer.name + ' · ' + (customer.house || '待补地址') + ' 项目', customerId: customer.id, address: customer.house || '', area: customer.area || 0, houseType: customer.houseType || '平层', projectType: '全包', style: customer.style || '', status: '未开工', startDate: contract.startDate || today, planEndDate: contract.planEndDate || date, actualEndDate: '', managerId: actor.id, managerName: actor.name, designerId: '', designerName: '', supervisorName: '', contractId: contract.id, contractAmount: contract.amount, budget: money(contract.amount * 0.75), cost: 0, received: 0, nodes, tags: ['签约开户'] };
}
function receiptUpdate(contract, project, data, today) {
  ensure(activeContract(contract), '合同未签约或已作废，不能登记收款');
  ensure(!project || (!project.deleted && !project.archived && project.contractId === contract.id), '项目与合同不匹配或已归档');
  const plan = (contract.payPlan || []).find((item) => item.id === data.planId);
  ensure(plan, '收款期次不存在');
  const amount = positiveMoney(data.amount);
  ensure(cents(amount) <= cents(plan.amount) - cents(plan.paidAmount || 0), '收款金额超过该期待收，请刷新');
  const payPlan = contract.payPlan.map((item) => item.id !== plan.id ? Object.assign({}, item) : Object.assign({}, item, { paidAmount: (cents(item.paidAmount || 0) + cents(amount)) / 100, paidDate: data.date || today, status: cents(item.paidAmount || 0) + cents(amount) >= cents(item.amount) ? '已收款' : '部分收款' }));
  const received = payPlan.reduce((sum, item) => sum + cents(item.paidAmount || 0), 0) / 100;
  const complete = project && project.status === '已完工' && cents(received) >= cents(contract.amount);
  return { amount, contract: Object.assign({}, contract, { payPlan, received, status: complete ? '已完成' : contract.status }), project: project ? Object.assign({}, project, { received }) : null };
}
function changeUpdate(contract, project, change, today) {
  ensure(activeContract(contract) && project && !project.archived, '仅有效合同可以确认增减项');
  ensure(change && !change.applied && ['待确认', '待审批'].indexOf(change.status) >= 0, '该变更已处理');
  ensure(String(change.customerEvidence || '').trim(), '请记录客户确认依据');
  const delta = cents(change.amount);
  ensure(delta !== 0, '变更金额不能为零');
  const total = cents(contract.amount) + delta;
  const paid = (contract.payPlan || []).reduce((sum, plan) => sum + cents(plan.paidAmount || 0), 0);
  ensure(total >= paid && total > 0, '减项后合同金额不能低于已收款，请先处理退款');
  const payPlan = contract.payPlan.map((plan) => Object.assign({}, plan));
  if (delta > 0) {
    payPlan.push({ id: change.id + '_pay', name: '增项：' + change.title, amount: delta / 100, dueDate: change.dueDate || today, paidAmount: 0, status: '未收款', paidDate: '' });
  } else {
    let remaining = -delta;
    for (let index = payPlan.length - 1; index >= 0 && remaining > 0; index--) {
      const plan = payPlan[index];
      const reduce = Math.min(remaining, cents(plan.amount) - cents(plan.paidAmount || 0));
      plan.amount = (cents(plan.amount) - reduce) / 100;
      plan.status = cents(plan.amount) === cents(plan.paidAmount || 0) ? '已收款' : Number(plan.paidAmount || 0) > 0 ? '部分收款' : '未收款';
      remaining -= reduce;
    }
    ensure(remaining === 0, '未收款余额不足以抵减');
  }
  return { contract: Object.assign({}, contract, { originalAmount: contract.originalAmount === undefined ? contract.amount : contract.originalAmount, amount: total / 100, payPlan }), project: Object.assign({}, project, { contractAmount: total / 100 }), change: Object.assign({}, change, { applied: true, status: '已确认', confirmTime: today }) };
}
function nodeOverdue(node, today) { return !!(node && node.status !== '已完成' && node.planEnd && String(node.planEnd).slice(0, 10) < today); }

module.exports = { ROLES, ACCESS, COLLECTIONS, MODULES, CUSTOMER_FLOW, FOLLOW_STATUS, NODE_TEMPLATE, ensure, can, isFinance, cents, money, positiveMoney, activeContract, isPaidExpense, expenseDate, advanceStatus, quoteAmounts, dayOffset, buildContract, buildProject, receiptUpdate, changeUpdate, nodeOverdue };
