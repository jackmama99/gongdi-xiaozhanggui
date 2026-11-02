const store = require('../../data/store');
const F = require('../../utils/format');

// 报价状态配色（constants 未定义，页面内统一维护）
const QUOTE_STATUS_COLOR = {
  草稿: 'gray',
  待内部审批: 'violet',
  待客户确认: 'orange',
  已确认: 'green',
  已作废: 'red'
};

const FILTERS = [
  { key: '全部', status: '' },
  { key: '待客户确认', status: '待客户确认' },
  { key: '待内部审批', status: '待内部审批' },
  { key: '已确认', status: '已确认' },
  { key: '草稿', status: '草稿' }
];

Page({
  data: {
    filters: [],
    activeFilter: '全部',
    list: [],
    stat: {
      totalText: '0.00',
      confirmedText: '0.00',
      avgUnitText: '0.00',
      count: 0
    },
    loading: true
  },

  onLoad() {
    if (!store.guard('quote')) return;
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
    const quotes = store.list('quotes');
    const filters = FILTERS.map((f) => ({
      key: f.key,
      status: f.status,
      count: f.status ? quotes.filter((q) => q.status === f.status).length : quotes.length
    }));
    this.setData({ filters });
  },

  refresh() {
    this.buildFilters();
    const all = store.list('quotes');
    const active = this.data.activeFilter;
    const filtered = active === '全部' ? all.slice() : all.filter((q) => q.status === active);

    // 统计条基于全部报价（未作废）
    const valid = all.filter((q) => q.status !== '已作废');
    const totalAmount = valid.reduce((s, q) => s + (q.total || 0), 0);
    const totalArea = valid.reduce((s, q) => s + (q.area || 0), 0);
    const confirmedAmount = valid
      .filter((q) => q.status === '已确认')
      .reduce((s, q) => s + (q.total || 0), 0);
    const avgUnit = totalArea > 0 ? totalAmount / totalArea : 0;

    const list = filtered
      .slice()
      .sort((a, b) => (String(a.createTime) < String(b.createTime) ? 1 : -1))
      .map((q) => {
        const c = store.customerOf(q.customerId);
        return {
          id: q.id,
          no: q.no,
          title: q.title,
          customerName: c ? c.name : '未关联客户',
          avatar: c ? F.shortName(c.name) : '客',
          area: q.area || 0,
          areaText: (q.area || 0) + '㎡',
          projectType: q.projectType,
          status: q.status,
          statusColor: QUOTE_STATUS_COLOR[q.status] || 'gray',
          totalText: F.money(q.total || 0),
          totalWan: F.wan(q.total || 0),
          unitText: q.area > 0 ? F.money((q.total || 0) / q.area) : '0.00',
          itemsCount: (q.items || []).length,
          createTimeText: F.date(q.createTime),
          creator: q.creator || '—'
        };
      });

    this.setData({
      list,
      loading: false,
      stat: {
        totalText: F.money(totalAmount),
        confirmedText: F.money(confirmedAmount),
        avgUnitText: F.money(avgUnit),
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
    wx.navigateTo({ url: '/pages/quote/detail?id=' + e.currentTarget.dataset.id });
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/quote/edit' });
  },

  onEmptyAction() {
    wx.navigateTo({ url: '/pages/quote/edit' });
  }
});
