const store = require('../../data/store');
const F = require('../../utils/format');
const C = require('../../utils/constants');

const FILTERS = [
  { key: '全部', status: '' },
  { key: '待签约', status: '待签约' },
  { key: '履行中', status: '履行中' },
  { key: '已完成', status: '已完成' },
  { key: '已作废', status: '已作废' }
];

/** 合同收款汇总 */
function paySummary(ct) {
  const plan = ct.payPlan || [];
  const paid = plan.reduce((s, p) => s + (p.paidAmount || 0), 0);
  const amount = ct.amount || 0;
  const unpaid = Math.max(0, amount - paid);
  const rate = F.percent(paid, amount || 1);
  const overdue = plan.filter(
    (p) => p.status !== '已收款' && p.dueDate && F.daysFromToday(p.dueDate) < 0
  ).length;
  return {
    paid,
    unpaid,
    rate,
    overdue,
    paidText: F.wan(paid),
    unpaidText: F.wan(unpaid),
    paidFull: F.money(paid),
    unpaidFull: F.money(unpaid),
    barType: rate >= 100 ? 'success' : overdue > 0 ? 'danger' : rate > 0 ? '' : 'warning'
  };
}

Page({
  data: {
    filters: [],
    activeFilter: '全部',
    list: [],
    stat: {
      totalText: '0.00',
      receivedText: '0.00',
      pendingText: '0.00',
      count: 0
    },
    loading: true
  },

  onLoad() {
    if (!store.guard('contract')) return;
    this.buildFilters();
  },

  onShow() {
    this.refresh();
  },

  onPullDownRefresh() {
    this.refresh();
    wx.stopPullDownRefresh();
  },

  buildFilters() {
    const contracts = store.list('contracts');
    const filters = FILTERS.map((f) => ({
      key: f.key,
      status: f.status,
      count: f.status ? contracts.filter((c) => c.status === f.status).length : contracts.length
    }));
    this.setData({ filters });
  },

  refresh() {
    this.buildFilters();
    const all = store.list('contracts');
    const active = this.data.activeFilter;
    const filtered = active === '全部' ? all.slice() : all.filter((c) => c.status === active);

    // 统计条（排除已作废）
    const valid = all.filter((c) => c.status !== '已作废');
    const totalAmount = valid.reduce((s, c) => s + (c.amount || 0), 0);
    let totalReceived = 0;
    valid.forEach((c) => {
      totalReceived += (c.payPlan || []).reduce((s, p) => s + (p.paidAmount || 0), 0);
    });

    const list = filtered
      .slice()
      .sort((a, b) => (String(a.signDate || '0') < String(b.signDate || '0') ? 1 : -1))
      .map((c) => {
        const cust = store.customerOf(c.customerId);
        const s = paySummary(c);
        return {
          id: c.id,
          no: c.no,
          title: c.title,
          customerName: cust ? cust.name : '未关联客户',
          avatar: cust ? F.shortName(cust.name) : '客',
          status: c.status,
          statusColor: C.CONTRACT_STATUS_COLOR[c.status] || 'gray',
          amountText: F.money(c.amount || 0),
          amountWan: F.wan(c.amount || 0),
          paidText: s.paidText,
          unpaidText: s.unpaidText,
          paidRate: s.rate,
          barType: s.barType,
          payMode: c.payMode,
          signDateText: c.signDate ? F.date(c.signDate) : '待签约',
          planEndText: c.planEndDate ? F.date(c.planEndDate) : '—',
          overdueCount: s.overdue,
          payTotal: (c.payPlan || []).length
        };
      });

    this.setData({
      list,
      loading: false,
      stat: {
        totalText: F.money(totalAmount),
        receivedText: F.money(totalReceived),
        pendingText: F.money(Math.max(0, totalAmount - totalReceived)),
        count: valid.length
      }
    });
  },

  onFilterTap(e) {
    const key = e.currentTarget.dataset.key;
    if (key === this.data.activeFilter) return;
    this.setData({ activeFilter: key }, () => this.refresh());
  },

  onCardTap(e) {
    wx.navigateTo({ url: '/pages/contract/detail?id=' + e.currentTarget.dataset.id });
  },

  goCreate() {
    wx.showToast({ title: '请从报价单转为合同', icon: 'none' });
  },

  onEmptyAction() {
    wx.switchTab({ url: '/pages/customer/list' });
  }
});
