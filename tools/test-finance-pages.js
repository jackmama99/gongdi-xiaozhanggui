/**
 * ⚠️ 已过时（2026-10-23）：本脚本针对旧版页面字段（如 submitted / projectOptions）编写，
 * 当前页面已改用 saving / projects，直接运行会大量失败，因此不在 `npm test` 主链路中。
 * 保留作为页面级测试的参考模板；如需恢复，请先按当前页面 data 结构重写断言。
 */
/**
 * 页面逻辑冒烟测试：用 mock wx 在 Node 中执行页面 JS，校验数据计算无异常。
 * 仅本地自测用，不参与小程序运行。
 */
const path = require('path');
const vm = require('vm');
const fs = require('fs');
const Module = require('module');

const ROOT = path.resolve(__dirname, '..');
const config = require(path.join(ROOT, 'config.js'));
config.demoMode = true;
config.useCloud = false;

// ---- mock 小程序环境 ----
const storage = {};
global.wx = {
  getStorageSync: (k) => storage[k],
  setStorageSync: (k, v) => {
    storage[k] = JSON.parse(JSON.stringify(v));
  },
  removeStorageSync: (k) => {
    delete storage[k];
  },
  showToast: () => {},
  showModal: () => {},
  navigateTo: () => {},
  navigateBack: () => {},
  switchTab: () => {},
  reLaunch: () => {},
  stopPullDownRefresh: () => {}
};

let pageStack = [];
global.getCurrentPages = () => pageStack;

function loadPage(relJs) {
  const file = path.join(ROOT, relJs);
  let captured = null;
  global.Page = (cfg) => {
    captured = cfg;
  };
  delete require.cache[require.resolve(file)];
  require(file);
  const cfg = captured;
  if (!cfg) throw new Error('未捕获 Page 配置: ' + relJs);

  // 模拟 setData
  const inst = Object.assign({}, cfg);
  inst.data = JSON.parse(JSON.stringify(cfg.data || {}));
  inst.setData = function (patch, cb) {
    Object.keys(patch).forEach((key) => {
      if (key.indexOf('.') > -1) {
        const parts = key.split('.');
        let obj = this.data;
        for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
        obj[parts[parts.length - 1]] = patch[key];
      } else {
        this.data[key] = patch[key];
      }
    });
    if (cb) cb();
  };
  return inst;
}

function assert(cond, msg) {
  if (!cond) throw new Error('断言失败: ' + msg);
}

const results = [];

function run(name, fn) {
  try {
    fn();
    results.push('  ✅ ' + name);
  } catch (e) {
    results.push('  ❌ ' + name + ' -> ' + e.message);
  }
}

// ---------------- 财务中心 ----------------
run('finance/index 数据加载', () => {
  const p = loadPage('pages/finance/index.js');
  pageStack = [p];
  p.onShow();
  const d = p.data;
  assert(d.metrics.length === 4, 'metrics 应为 4 项，实际 ' + d.metrics.length);
  assert(d.entries.length === 4, 'entries 应为 4 项');
  assert(typeof d.hero.net === 'string', 'hero.net 应为字符串');
  assert(Array.isArray(d.receivables), 'receivables 应为数组');
  assert(d.receivables.length > 0, '种子数据应有逾期/临近待收款');
  d.receivables.forEach((r) => {
    assert(r.customerName && r.planName && r.amountText, '待收款字段缺失');
    assert(typeof r.isOverdue === 'boolean', 'isOverdue 应为布尔');
    assert(!/undefined|NaN/.test(r.tip), 'tip 出现 undefined/NaN: ' + r.tip);
  });
  assert(d.expenses.length === 2, '待审批支出应为 2 笔，实际 ' + d.expenses.length);
  d.expenses.forEach((e) => assert(!/undefined|NaN/.test(e.amountText), '支出金额异常'));
  assert(d.recentReceipts.length === 5, '最近收款应为 5 条，实际 ' + d.recentReceipts.length);
  d.recentReceipts.forEach((r) => assert(r.initial, '客户头像文字缺失'));
  console.log('    待收款 ' + d.receivables.length + ' 期，待审批支出 ' + d.expenses.length + ' 笔，净现金流 ' + d.hero.net);
});

run('finance/index 审批展开与通过', () => {
  const p = loadPage('pages/finance/index.js');
  pageStack = [p];
  p.onShow();
  const id = p.data.expenses[0].id;
  p.toggleExpense({ currentTarget: { dataset: { id } } });
  assert(p.data.expandedId === id, '展开失败');
  const expanded = p.data.expenses.find((x) => x.id === id);
  assert(expanded && expanded.expanded === true, 'expanded 标记未生效');
  // 直接调用审批（mock showModal 不回调，这里手动触发内部逻辑等价物）
  const store = require(path.join(ROOT, 'data/store.js'));
  store.approveExpense(id, true);
  const after = store.find('expenses', id);
  assert(after.status === '已通过', '审批状态未更新: ' + after.status);
  console.log('    审批链路 OK，支出状态 -> ' + after.status);
});

// ---------------- 收款登记 ----------------
run('finance/receipt 带 contractId 预填并提交', () => {
  const store = require(path.join(ROOT, 'data/store.js'));
  store.reset();
  const ct = store.list('contracts').find((c) => c.id === 'ct_1');
  const paidBefore = (ct.payPlan || []).reduce((s, x) => s + (x.paidAmount || 0), 0);
  const projectBefore = store.find('projects', 'p_1').received;

  const p = loadPage('pages/finance/receipt.js');
  pageStack = [p];
  p.onLoad({ contractId: 'ct_1' });

  assert(p.data.contractInfo, '合同信息卡应为空');
  assert(p.data.lockContract === true, 'contractId 传入应锁定合同');
  assert(p.data.plans.length === 2, 'ct_1 应有 2 个待收期次，实际 ' + p.data.plans.length);
  assert(p.data.plans[0].remain > 0, '待收金额异常');

  p.onPlanChange({ detail: { value: 0 } });
  assert(p.data.amount === String(p.data.plans[0].remain), '选择期次未自动填入待收金额');
  assert(p.data.canSubmit === true, 'canSubmit 应为 true');

  const idx = p.data.contractIndex;
  assert(p.data.contracts[idx].id === 'ct_1', 'contractIndex 指向错误');
  console.log('    合同 ' + p.data.contractInfo.no + '，待收期次 ' + p.data.plans.length + '，自动填充 ¥' + p.data.amount);

  // 提交
  p.onSubmit();
  assert(p.data.saving === true || p.data.canSubmit === false || store.list('receipts').length > 0, '提交未产生效果');

  const ctAfter = store.find('contracts', 'ct_1');
  const paidAfter = (ctAfter.payPlan || []).reduce((s, x) => s + (x.paidAmount || 0), 0);
  assert(paidAfter > paidBefore, 'addReceipt 未更新合同分期 paidAmount');
  assert(store.find('projects', 'p_1').received > projectBefore, 'addReceipt 未更新项目 received');
  assert(store.list('receipts').length >= 15, '未新增收款记录');
  console.log('    合同已收 ' + paidBefore + ' -> ' + paidAfter + '，项目 received 同步更新');
});

run('finance/receipt 带 projectId 预填', () => {
  const p = loadPage('pages/finance/receipt.js');
  pageStack = [p];
  p.onLoad({ projectId: 'p_2' });
  assert(p.data.contractInfo, 'projectId 应能定位合同');
  assert(p.data.contractInfo.id === 'ct_2', '定位合同错误: ' + p.data.contractInfo.id);
  assert(p.data.lockContract === false, '仅 projectId 时不应锁定合同');
  console.log('    projectId -> ' + p.data.contractInfo.no + '，可切换合同');
});

run('finance/receipt 空值校验', () => {
  const p = loadPage('pages/finance/receipt.js');
  pageStack = [p];
  p.onLoad({});
  assert(p.data.contractInfo === null, '未选合同时不应有信息卡');
  assert(p.data.canSubmit === false, '空表单 canSubmit 应为 false');
  p.onSubmit(); // 应提示且不抛错
  assert(p.data.submitted === false, '校验未通过不应提交');
  console.log('    空表单校验 OK');
});

// ---------------- 支出登记 ----------------
run('finance/expense 带 projectId 预填与提交', () => {
  const store = require(path.join(ROOT, 'data/store.js'));
  store.reset();
  const before = store.expensesOfProject('p_1').length;

  const p = loadPage('pages/finance/expense.js');
  pageStack = [p];
  p.onLoad({ projectId: 'p_1' });

  assert(p.data.projectIndex > -1, 'projectIndex 未预填');
  assert(p.data.budgetInfo, '预算信息缺失');
  const b = p.data.budgetInfo;
  assert(b.budgetText && b.costText && b.remainText, '预算字段缺失');
  assert(b.percent >= 0 && b.percent <= 100, '预算百分比异常: ' + b.percent);
  assert(p.data.expenseList.length === before, '支出列表条数不符');
  console.log('    预算 ' + b.budgetText + '，已支出 ' + b.costText + '，消耗 ' + b.percent + '%');

  p.onAmountInput({ detail: { value: '1234.5' } });
  p.onCategoryChange({ detail: { value: 2 } });
  assert(p.data.canSubmit === true, 'canSubmit 应为 true');
  p.onSubmit();
  assert(p.data.submitted === true, '提交标记未设置');

  const list = store.expensesOfProject('p_1');
  assert(list.length === before + 1, '支出未写入');
  const created = list[0];
  assert(created.status === '待审批', '新增支出状态应为待审批，实际 ' + created.status);
  assert(created.amount === 1234.5, '金额写入错误: ' + created.amount);
  assert(created.category === '人工费', '分类写入错误: ' + created.category);
  console.log('    新增支出 ' + created.no + ' ¥' + created.amount + ' 状态 ' + created.status);
});

run('finance/expense 无 projectId 展示最近支出', () => {
  const p = loadPage('pages/finance/expense.js');
  pageStack = [p];
  p.onLoad({});
  assert(p.data.budgetInfo === null, '未选项目不应有预算卡');
  assert(p.data.expenseList.length > 0, '最近支出列表为空');
  assert(p.data.listTitle === '最近支出记录', '列表标题错误: ' + p.data.listTitle);
  p.data.expenseList.forEach((e) => assert(e.projectName, '缺少项目名'));
  console.log('    最近支出 ' + p.data.expenseList.length + ' 笔');
});

// ---------------- 材料列表 ----------------
run('material/list 全量统计与筛选', () => {
  const store = require(path.join(ROOT, 'data/store.js'));
  store.reset();
  const p = loadPage('pages/material/list.js');
  pageStack = [p];
  p.onLoad({});
  p.onShow();

  assert(p.data.stats.total === store.list('materials').length, '总项数不符');
  assert(p.data.list.length === p.data.stats.total, '全部筛选条数不符');
  assert(p.data.stats.pending === 3, '待采购应为 3 项，实际 ' + p.data.stats.pending);
  assert(p.data.stats.shipping === 3, '已下单+在途应为 3 项，实际 ' + p.data.stats.shipping);
  p.data.list.forEach((m) => {
    assert(m.name && m.status && m.statusType, '材料字段缺失');
    assert(!/undefined|NaN/.test(m.amountText), '金额格式异常: ' + m.amountText);
    assert(m.unit && m.qty !== undefined, '数量单位缺失');
  });
  console.log('    总计 ' + p.data.stats.total + ' 项 / ' + p.data.stats.totalAmount + '，待采购 ' + p.data.stats.pending + '，在途 ' + p.data.stats.shipping);

  p.onTabTap({ currentTarget: { dataset: { tab: '待采购' } } });
  assert(p.data.list.length === 3, '待采购筛选应为 3，实际 ' + p.data.list.length);
  p.data.list.forEach((m) => assert(m.status === '待采购', '筛选结果状态错误'));
  p.onTabTap({ currentTarget: { dataset: { tab: '全部' } } });
  console.log('    状态筛选 OK');
});

run('material/list 按项目过滤', () => {
  const p = loadPage('pages/material/list.js');
  pageStack = [p];
  p.onLoad({ projectId: 'p_1' });
  assert(p.data.projectName, '项目名未预填');
  assert(p.data.list.length === 3, 'p_1 应有 3 项材料，实际 ' + p.data.list.length);
  p.data.list.forEach((m) => assert(m.projectId === 'p_1', '过滤结果混入其他项目'));
  console.log('    p_1 材料 ' + p.data.list.length + ' 项，' + p.data.projectName);
});

run('material/list 新建材料', () => {
  const store = require(path.join(ROOT, 'data/store.js'));
  const before = store.list('materials').length;
  const p = loadPage('pages/material/list.js');
  pageStack = [p];
  p.onLoad({});
  p.openForm();
  assert(p.data.showForm === true, '弹窗未打开');
  assert(p.data.projectOptions.length > 0, '项目选项为空');

  p.onFormProject({ detail: { value: 0 } });
  p.onFormName({ detail: { value: '测试岩板' } });
  p.onFormCategory({ detail: { value: 0 } });
  p.onFormSpec({ detail: { value: '1200×2400 哑光' } });
  p.onFormUnitPick({ currentTarget: { dataset: { unit: '㎡' } } });
  p.onFormQty({ detail: { value: '12' } });
  p.onFormPrice({ detail: { value: '320' } });
  p.onFormSupplier({ detail: { value: '岩板供应商' } });
  assert(p.data.form.unit === '㎡', '单位快捷选择失败');

  p.submitForm();
  const list = store.list('materials');
  assert(list.length === before + 1, '材料未写入');
  const created = list[0];
  assert(created.name === '测试岩板', '名称写入错误');
  assert(created.amount === 3840, '金额应自动计算为 3840，实际 ' + created.amount);
  assert(created.status === '待采购', '新建材料状态应为待采购');
  assert(p.data.showForm === false, '提交后弹窗未关闭');
  assert(p.data.stats.total === before + 1, '列表未刷新');
  console.log('    新增材料 ' + created.no + ' ¥' + created.amount + '，状态 ' + created.status);
});

run('material/list 新建校验', () => {
  const p = loadPage('pages/material/list.js');
  pageStack = [p];
  p.onLoad({});
  p.openForm();
  p.onFormName({ detail: { value: '' } });
  p.onFormQty({ detail: { value: '1' } });
  p.onFormPrice({ detail: { value: '10' } });
  p.submitForm();
  assert(p.data.showForm === true, '校验未通过时不应关闭弹窗');
  console.log('    名称为空被拦截 OK');
});

// ---------------- 材料详情 ----------------
run('material/detail 时间轴与状态流转', () => {
  const store = require(path.join(ROOT, 'data/store.js'));
  store.reset();
  const p = loadPage('pages/material/detail.js');
  pageStack = [p];
  p.onLoad({ id: 'm_3' }); // 待采购

  const m = p.data.material;
  assert(m && m.name === '立邦净味乳胶漆', '材料加载失败');
  assert(m.status === '待采购', '初始状态错误');
  assert(p.data.steps.length === 5, '时间轴应为 5 步，实际 ' + p.data.steps.length);
  assert(p.data.steps[0].active === true, '第一步应为当前状态');
  assert(p.data.steps[0].done === true, '当前步应高亮为完成');
  assert(p.data.steps[4].done === false, '后续步骤不应高亮');
  assert(p.data.action && p.data.action.status === '已下单', '待采购的下一步应为已下单');
  console.log('    待采购 -> 下一步「' + p.data.action.label + '」，时间轴 5 步，已完成 1 步');

  // 逐级推进
  const chain = [
    ['已下单', '在途'],
    ['在途', '已入库'],
    ['已入库', '已使用']
  ];
  chain.forEach((pair) => {
    store.setMaterialStatus('m_3', pair[0]);
    p.loadData();
    assert(p.data.material.status === pair[0], '状态未同步: ' + p.data.material.status);
    const doneCount = p.data.steps.filter((s) => s.done).length;
    const expect = ['待采购', '已下单', '在途', '已入库', '已使用'].indexOf(pair[0]) + 1;
    assert(doneCount === expect, '已完成步数应为 ' + expect + '，实际 ' + doneCount);
    if (p.data.action) assert(p.data.action.status === pair[1], '下一步应为 ' + pair[1]);
  });
  assert(p.data.action === null, '已使用状态不应再有下一步操作');
  assert(p.data.material.arriveDateText !== '—', '入库日期应已记录');
  console.log('    5 步流转全部通过，入库日期 ' + p.data.material.arriveDateText);
});

run('material/detail 已入库日期/下单日期展示', () => {
  const store = require(path.join(ROOT, 'data/store.js'));
  const p = loadPage('pages/material/detail.js');
  pageStack = [p];
  p.onLoad({ id: 'm_1' }); // 已入库
  const m = p.data.material;
  assert(m.orderDateText !== '—', '下单日期缺失');
  assert(m.arriveDateText !== '—', '到货日期缺失');
  assert(m.status === '已入库', '状态错误');
  assert(p.data.action && p.data.action.status === '已使用', '已入库下一步应为已使用');
  console.log('    下单 ' + m.orderDateText + ' / 入库 ' + m.arriveDateText);
});

run('material/detail 不存在 id', () => {
  const p = loadPage('pages/material/detail.js');
  pageStack = [p];
  p.onLoad({ id: 'not_exist' });
  assert(p.data.notFound === true, 'notFound 应为 true');
  assert(p.data.material === null, 'material 应为 null');
  console.log('    不存在 id 走空状态 OK');
});

// ---------------- 经营报表 ----------------
run('report/index 全量数据与柱状图', () => {
  const store = require(path.join(ROOT, 'data/store.js'));
  store.reset();
  const p = loadPage('pages/report/index.js');
  pageStack = [p];
  p.onShow();

  const s = store.reportStats();
  assert(p.data.monthly.length === 6, '应有 6 个月数据，实际 ' + p.data.monthly.length);
  assert(p.data.totals, '核心指标缺失');
  assert(p.data.totals.contractText && p.data.totals.receivedText, '指标文案缺失');
  assert(p.data.totals.costText && p.data.totals.profitText, '指标文案缺失');
  assert(!/NaN|undefined/.test(p.data.totals.profitText), '毛利额异常: ' + p.data.totals.profitText);
  assert(typeof p.data.totals.grossRateText === 'string', '毛利率缺失');

  // 柱高必须在 2~100 之间，0 值也要可见
  p.data.monthly.forEach((m) => {
    assert(m.incomeH >= 2 && m.incomeH <= 100, m.month + ' 收入柱高越界: ' + m.incomeH);
    assert(m.costH >= 2 && m.costH <= 100, m.month + ' 成本柱高越界: ' + m.costH);
    assert(!/undefined|NaN/.test(m.incomeText), m.month + ' 收入文案异常');
  });
  const maxH = Math.max.apply(null, p.data.monthly.map((m) => Math.max(m.incomeH, m.costH)));
  assert(maxH === 100, '最大值柱高应为 100%，实际 ' + maxH);
  assert(p.data.maxIncomeText && p.data.maxCostText, '基准值文案缺失');
  console.log('    6 个月柱状图 OK，最大柱高 ' + maxH + '%，基准 ' + p.data.maxIncomeText + ' / ' + p.data.maxCostText);

  // 项目毛利排行降序
  assert(p.data.projectProfit.length === s.projectProfit.length, '项目数量不符');
  const profits = p.data.projectProfit.map((x) => x.profitText);
  p.data.projectProfit.forEach((x, i) => {
    assert(x.barWidth >= 0 && x.barWidth <= 100, '毛利条宽度越界: ' + x.barWidth);
    if (i > 0) {
      assert(x.rate <= p.data.projectProfit[i - 1].rate, '毛利排行未按降序排列');
    }
  });
  assert(p.data.projectProfit[0].barWidth === 100, '第一名毛利条应为 100%');
  console.log('    项目毛利排行 ' + p.data.projectProfit.length + ' 个，Top1 ' + p.data.projectProfit[0].name + ' ' + p.data.projectProfit[0].profitText);

  assert(p.data.managers.length > 0, '项目经理维度为空');
  p.data.managers.forEach((m) => {
    assert(m.name && m.initial && m.amountText, '经理字段缺失');
    assert(!/undefined|NaN/.test(m.profitText), '经理毛利异常');
  });
  assert(p.data.sources.length > 0, '来源转化数据为空');
  p.data.sources.forEach((x) => {
    assert(x.source && x.total > 0, '来源字段缺失');
    assert(x.rate >= 0 && x.rate <= 100, '转化率越界: ' + x.rate);
    assert(x.rateText, '转化率文案缺失');
  });
  console.log('    经理 ' + p.data.managers.length + ' 人，来源 ' + p.data.sources.length + ' 个');

  // 展开切换
  p.toggleProject();
  assert(p.data.projectExpanded === true, '展开状态未切换');
  p.toggleProject();
  assert(p.data.projectExpanded === false, '收起状态未切换');
  console.log('    排行展开/收起 OK');
});

// ---------------- 输出 ----------------
console.log('\n' + '='.repeat(64));
console.log('页面逻辑冒烟测试结果');
console.log('='.repeat(64));
results.forEach((r) => console.log(r));
const failed = results.filter((r) => r.indexOf('❌') > -1);
console.log('='.repeat(64));
if (failed.length) {
  console.log(`❌ 失败 ${failed.length} / ${results.length}`);
  process.exit(1);
}
console.log(`✅ 全部通过（${results.length} 组）`);
