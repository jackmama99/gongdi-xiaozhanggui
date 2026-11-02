/** 财务中心：资金概览 / 待收款提醒 / 待审批支出 / 最近收款 */
const store = require('../../data/store');
const F = require('../../utils/format');

const NEAR_DAYS = 7;
const RECENT_LIMIT = 5;

function mapById(arr) {
  const map = {};
  arr.forEach((x) => {
    map[x.id] = x;
  });
  return map;
}

Page({
  data: {
    monthText: '',
    hero: {
      receipt: '0.00',
      expense: '0.00',
      net: '0.00',
      netType: 'success'
    },
    metrics: [],
    entries: [
      { emoji: '💰', title: '收款登记', sub: '客户回款', tone: 'blue', url: '/pages/finance/receipt' },
      { emoji: '🧾', title: '支出登记', sub: '费用报批', tone: 'orange', url: '/pages/finance/expense' },
      { emoji: '📅', title: '收款计划', sub: '分期跟踪', tone: 'violet', url: '/pages/contract/list' },
      { emoji: '📊', title: '经营报表', sub: '营收毛利', tone: 'green', url: '/pages/report/index' }
    ],
    receivables: [],
    receivableHint: '',
    expenses: [],
    expenseHint: '',
    expandedId: '',
    recentReceipts: [],
    canDeleteExpense: false
  },

  onShow() {
    if (!getApp().requireLogin()) return;
    if (!store.can('finance')) {
      store.guard('finance');
      return;
    }
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData();
    wx.stopPullDownRefresh();
  },

  loadData() {
    const stats = store.dashboardStats();
    const contracts = store.list('contracts');
    const receipts = store.list('receipts');
    const expenses = store.list('expenses');
    const projectMap = mapById(store.list('projects'));
    const customerMap = mapById(store.list('customers'));

    // 有效合同：排除待签约 / 已作废
    const validContracts = contracts.filter((c) => c.status !== '待签约' && c.status !== '已作废');

    const totalContract = validContracts.reduce((s, c) => s + (c.amount || 0), 0);
    const totalReceived = receipts.reduce((s, r) => s + (r.amount || 0), 0);
    const totalCost = expenses
      .filter((e) => e.status === '已通过' || e.status === '已支付')
      .reduce((s, e) => s + (e.amount || 0), 0);

    const receivable = validContracts.reduce((s, c) => {
      return (
        s +
        (c.payPlan || []).reduce((ss, p) => ss + Math.max(0, (p.amount || 0) - (p.paidAmount || 0)), 0)
      );
    }, 0);

    const overdue = validContracts.reduce((s, c) => {
      return (
        s +
        (c.payPlan || [])
          .filter((p) => p.status !== '已收款' && p.dueDate && F.daysFromToday(p.dueDate) < 0)
          .reduce((ss, p) => ss + Math.max(0, (p.amount || 0) - (p.paidAmount || 0)), 0)
      );
    }, 0);

    const monthReceipt = stats.monthReceipt || 0;
    const monthExpense = stats.monthExpense || 0;
    const net = monthReceipt - monthExpense;
    const monthText = F.today().slice(0, 4) + ' 年 ' + Number(F.today().slice(5, 7)) + ' 月';

    const metrics = [
      {
        emoji: '📑',
        label: '合同总额',
        value: F.wan(totalContract),
        sub: '有效合同 ' + validContracts.length + ' 份',
        subClass: ''
      },
      {
        emoji: '✅',
        label: '已收金额',
        value: F.wan(totalReceived),
        sub: '回款率 ' + F.percent(totalReceived, totalContract || 1) + '%',
        subClass: 't-success'
      },
      {
        emoji: '⏳',
        label: '待收金额',
        value: F.wan(receivable),
        sub: overdue > 0 ? '逾期 ' + F.wan(overdue) : '暂无逾期款项',
        subClass: overdue > 0 ? 't-danger' : ''
      },
      {
        emoji: '💸',
        label: '累计支出',
        value: F.wan(totalCost),
        sub: '成本占比 ' + F.percent(totalCost, totalContract || 1) + '%',
        subClass: 't-warning'
      }
    ];

    // 待收款提醒：所有有效合同未收清的期次，已到期或 7 天内到期
    const receivables = [];
    validContracts.forEach((ct) => {
      const customer = customerMap[ct.customerId] || {};
      (ct.payPlan || []).forEach((p) => {
        const remain = Math.max(0, (p.amount || 0) - (p.paidAmount || 0));
        if (p.status === '已收款' || remain <= 0 || !p.dueDate) return;
        const days = F.daysFromToday(p.dueDate);
        if (days > NEAR_DAYS) return;
        receivables.push({
          key: ct.id + '_' + p.id,
          contractId: ct.id,
          customerName: customer.name || '未知客户',
          contractNo: ct.no || '',
          planName: p.name,
          amountText: F.money(remain),
          dueText: p.dueDate,
          isOverdue: days < 0,
          tip: days < 0 ? '已逾期 ' + Math.abs(days) + ' 天' : days === 0 ? '今日到期' : days + ' 天后到期'
        });
      });
    });
    receivables.sort((a, b) => (a.dueText < b.dueText ? -1 : a.dueText > b.dueText ? 1 : 0));
    const overdueCount = receivables.filter((r) => r.isOverdue).length;
    const receivableHint =
      receivables.length > 0 ? '共 ' + receivables.length + ' 期 · 逾期 ' + overdueCount + ' 期' : '暂无';

    // 待审批支出
    const pendingExpenses = expenses
      .filter((e) => e.status === '待审批')
      .sort((a, b) => (String(a.date) < String(b.date) ? 1 : -1))
      .map((e) => {
        const p = projectMap[e.projectId] || {};
        return {
          id: e.id,
          category: e.category,
          projectName: p.name || '未关联项目',
          applicant: e.applicant || '—',
          dateText: e.date || '',
          amountText: F.money(e.amount),
          expanded: e.id === this.data.expandedId
        };
      });
    const expenseHint = pendingExpenses.length > 0 ? pendingExpenses.length + ' 笔待审批' : '';

    // 最近收款
    const recentReceipts = receipts
      .slice()
      .sort((a, b) => (String(a.date) < String(b.date) ? 1 : -1))
      .slice(0, RECENT_LIMIT)
      .map((r) => {
        const c = customerMap[r.customerId] || {};
        const ct = contracts.find((x) => x.id === r.contractId) || {};
        return {
          id: r.id,
          customerName: c.name || '未知客户',
          initial: F.shortName(c.name || '客'),
          contractNo: ct.no || '',
          amountText: F.money(r.amount),
          method: r.method || '—',
          dateText: r.date || ''
        };
      });

    this.setData({
      monthText,
      hero: {
        receipt: F.money(monthReceipt),
        expense: F.money(monthExpense),
        net: F.money(net),
        netType: net >= 0 ? 'success' : 'danger'
      },
      metrics,
      receivables,
      receivableHint,
      expenses: pendingExpenses,
      expenseHint,
      recentReceipts,
      canDeleteExpense: store.canDelete('expenses')
    });
  },

  goEntry(e) {
    const url = e.currentTarget.dataset.url;
    if (url) wx.navigateTo({ url });
  },

  goContract(e) {
    const id = e.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: '/pages/contract/detail?id=' + id });
  },

  goReceipt() {
    wx.navigateTo({ url: '/pages/finance/receipt' });
  },

  goExpense() {
    wx.navigateTo({ url: '/pages/finance/expense' });
  },

  toggleExpense(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ expandedId: this.data.expandedId === id ? '' : id });
    this.loadData();
  },

  onApprove(e) {
    const ds = e.currentTarget.dataset;
    const pass = ds.act === 'pass';
    const item = this.data.expenses.find((x) => x.id === ds.id);
    if (!item) return;
    wx.showModal({
      title: pass ? '通过支出' : '驳回支出',
      content: (pass ? '确认通过「' : '确认驳回「') + item.category + ' ¥' + item.amountText + '」？',
      success: (res) => {
        if (!res.confirm) return;
        store.approveExpense(ds.id, pass);
        wx.showToast({
          title: pass ? '已通过并计入成本' : '已驳回该笔支出',
          icon: 'none'
        });
        this.setData({ expandedId: '' });
        this.loadData();
      }
    });
  },

  /** 删除待审批支出（财务/老板） */
  onDeleteExpense(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.expenses.find((x) => x.id === id);
    if (!item) return;
    const that = this;
    wx.showModal({
      title: '删除支出',
      content: '确定删除「' + item.category + ' ¥' + item.amountText + '」？删除后列表不再显示。',
      confirmText: '删除',
      confirmColor: '#C94F45',
      success(res) {
        if (!res.confirm) return;
        const r = store.deleteRecord('expenses', id);
        if (!r.ok) {
          wx.showToast({ title: r.msg, icon: 'none' });
          return;
        }
        wx.showToast({ title: '已删除', icon: 'success' });
        that.setData({ expandedId: '' });
        that.loadData();
      }
    });
  }
});
