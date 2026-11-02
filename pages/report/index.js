const store = require('../../data/store');
const F = require('../../utils/format');

Page({
  data: {
    updatedAt: '',
    totals: {},
    maxIncomeText: '',
    maxCostText: '',
    monthly: [],
    projectProfit: [],
    projectExpanded: false,
    managers: [],
    sources: []
  },

  onLoad() {
    if (!store.guard('report')) return;
    this.load();
  },

  onShow() {
    if (!store.can('report')) return;
    this.load();
  },

  onPullDownRefresh() {
    this.load();
    wx.stopPullDownRefresh();
  },

  load() {
    const rs = store.reportStats();

    // ---------- 核心指标 ----------
    const grossRate = F.percent(rs.grossProfit, rs.totalContract || 1);
    const totals = {
      profitText: F.wan(rs.grossProfit),
      profitType: rs.grossProfit >= 0 ? 'success' : 'danger',
      grossRateText: grossRate + '%',
      contractText: F.wan(rs.totalContract),
      receivedText: F.wan(rs.totalReceived),
      costText: F.wan(rs.totalCost),
      receiveRate: F.percent(rs.totalReceived, rs.totalContract || 1),
      costRate: F.percent(rs.totalCost, rs.totalReceived || 1)
    };

    // ---------- 月度柱状图 ----------
    const rawMax = Math.max(
      1,
      ...rs.monthly.map((m) => Math.max(m.income, m.cost))
    );
    const maxVal = Math.max(1000, rawMax);
    const monthly = rs.monthly.map((m) => ({
      month: m.month,
      incomeH: Math.max(m.income > 0 ? 4 : 0, Math.round((m.income / maxVal) * 100)),
      costH: Math.max(m.cost > 0 ? 4 : 0, Math.round((m.cost / maxVal) * 100)),
      incomeText: F.wan(m.income),
      costText: F.wan(m.cost),
      profitText: F.wan(m.profit),
      profitType: m.profit >= 0 ? 'success' : 'danger'
    }));
    const maxIncomeText = F.wan(maxVal);
    const maxCostText = F.wan(Math.round(maxVal / 2));

    // ---------- 项目毛利排行 ----------
    const maxAbsProfit = Math.max(1, ...rs.projectProfit.map((p) => Math.abs(p.profit)));
    const projectProfit = rs.projectProfit.map((p) => {
      const rate = p.rate;
      const barType = rate >= 25 ? 'success' : rate >= 10 ? 'warning' : 'danger';
      const rateClass = rate >= 25 ? 't-success' : rate >= 10 ? 't-warning' : 't-danger';
      return {
        id: p.id,
        name: p.name,
        profitText: F.wan(p.profit),
        profitType: p.profit >= 0 ? 'success' : 'danger',
        barType,
        barWidth: Math.round((Math.abs(p.profit) / maxAbsProfit) * 100),
        rate,
        rateClass,
        contractText: F.wan(p.contractAmount),
        costText: F.wan(p.cost)
      };
    });

    // ---------- 项目经理维度 ----------
    const managers = rs.byManager.map((m) => {
      const rate = F.percent(m.profit, m.amount || 1);
      return {
        name: m.name,
        initial: m.name.slice(0, 1),
        count: m.count,
        amountText: F.wan(m.amount),
        profitText: F.wan(m.profit),
        profitType: m.profit >= 0 ? 'success' : 'danger',
        rate: Math.min(100, Math.max(0, rate))
      };
    });

    // ---------- 客户来源转化 ----------
    const sources = rs.bySource
      .map((s) => {
        const rate = F.percent(s.signed, s.total || 1);
        return {
          source: s.source,
          signed: s.signed,
          total: s.total,
          rate,
          rateText: rate + '%',
          barType: rate >= 50 ? 'success' : rate >= 25 ? 'warning' : 'danger'
        };
      })
      .sort((a, b) => b.total - a.total);

    this.setData({
      updatedAt: F.time(new Date()),
      totals,
      maxIncomeText,
      maxCostText,
      monthly,
      hasChartData: rs.monthly.some((m) => m.income > 0 || m.cost > 0),
      projectProfit,
      managers,
      sources
    });
  },

  toggleProject() {
    this.setData({ projectExpanded: !this.data.projectExpanded });
  },

  goProject(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: '/pages/project/detail?id=' + id });
  }
});
