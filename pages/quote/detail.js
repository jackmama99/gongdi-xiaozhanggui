const store = require('../../data/store');
const F = require('../../utils/format');
const C = require('../../utils/constants');

const QUOTE_STATUS_COLOR = {
  草稿: 'gray',
  待内部审批: 'violet',
  待客户确认: 'orange',
  已确认: 'green',
  已作废: 'red'
};

/** 按报价分类分组，并计算分组小计 */
function groupItems(items) {
  const order = C.QUOTE_CATEGORY;
  const map = {};
  items.forEach((it) => {
    const key = it.category || '其他';
    if (!map[key]) map[key] = { category: key, items: [], subtotal: 0 };
    map[key].items.push({
      id: it.id,
      name: it.name,
      spec: it.spec || '—',
      unit: it.unit,
      qty: it.qty,
      priceText: F.money(it.price),
      amountText: F.money(it.amount)
    });
    map[key].subtotal += it.amount || 0;
  });
  return Object.keys(map)
    .sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    })
    .map((k) => ({
      category: k,
      items: map[k].items,
      subtotalText: F.money(map[k].subtotal),
      count: map[k].items.length
    }));
}

Page({
  data: {
    id: '',
    quote: null,
    groups: [],
    canConfirm: false,
    hasContract: false,
    contractId: '',
    canDelete: false
  },

  onLoad(options) {
    if (!store.guard('quote')) return;
    this.setData({ id: options.id || '' });
  },

  onShow() {
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData();
    wx.stopPullDownRefresh();
  },

  loadData() {
    const q = store.find('quotes', this.data.id);
    if (!q) {
      wx.showToast({ title: '报价单不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack({ fail() { wx.switchTab({ url: '/pages/quote/list' }); } }), 600);
      return;
    }
    const c = store.customerOf(q.customerId);
    const rates = q.manageRate || 0;
    const relatedContract = store.list('contracts').find((ct) => ct.quoteId === q.id) || null;
    const area = q.area || 0;

    this.setData({
      quote: {
        id: q.id,
        no: q.no,
        title: q.title,
        status: q.status,
        statusColor: QUOTE_STATUS_COLOR[q.status] || 'gray',
        customerId: q.customerId,
        customerName: c ? c.name : '未关联客户',
        customerPhone: c ? F.maskPhone(c.phone) : '',
        projectId: q.projectId || '',
        areaText: area + '㎡',
        area,
        projectType: q.projectType,
        creator: q.creator || '—',
        createTimeText: F.date(q.createTime),
        itemsCount: (q.items || []).length,
        // 金额
        itemsAmountText: F.money(q.itemsAmount || 0),
        manageRatePercent: Math.round(rates * 1000) / 10,
        manageFeeText: F.money(q.manageFee || 0),
        designFeeText: F.money(q.designFee || 0),
        discountText: F.money(q.discount || 0),
        totalText: F.money(q.total || 0),
        totalWan: F.wan(q.total || 0),
        unitText: area > 0 ? F.money((q.total || 0) / area) : '0.00',
        itemsUnitText: area > 0 ? F.money((q.itemsAmount || 0) / area) : '0.00'
      },
      groups: groupItems(q.items || []),
      // 草稿必须先确认，不能直接转合同
      canConfirm: q.status === '待客户确认' || q.status === '待内部审批',
      hasContract: !!relatedContract,
      contractId: relatedContract ? relatedContract.id : '',
      canDelete: store.canDelete('quotes')
    });
    wx.setNavigationBarTitle({ title: q.no + ' · 报价详情' });
  },

  /** 标记已确认 */
  onConfirm() {
    wx.showModal({
      title: '标记已确认',
      content: '确认客户已接受该报价？确认后状态将变为「已确认」。',
      confirmText: '确认',
      success: (res) => {
        if (!res.confirm) return;
        store.setQuoteStatus(this.data.id, '已确认');
        wx.showToast({ title: '已标记确认', icon: 'success' });
        this.loadData();
      }
    });
  },

  /** 转为合同：生成待签约合同 + 分期收款计划 */
  onConvertContract() {
    if (this.data.hasContract) {
      wx.navigateTo({ url: '/pages/contract/detail?id=' + this.data.contractId });
      return;
    }
    wx.showModal({
      title: '转为合同',
      content: '将按报价金额生成一份「待签约」合同，并自动生成 30%/30%/30%/10% 分期收款计划。',
      confirmText: '生成合同',
      success: (res) => {
        if (!res.confirm) return;
        this.createContract();
      }
    });
  },

  createContract() {
    const q = store.find('quotes', this.data.id);
    if (!q) return;
    const c = store.customerOf(q.customerId);
    const amount = q.total || 0;
    const planDefs = [
      { name: '合同签订首付款', ratio: 0.3, offset: 3 },
      { name: '水电验收款', ratio: 0.3, offset: 25 },
      { name: '泥木验收款', ratio: 0.3, offset: 60 },
      { name: '竣工尾款', ratio: 0.1, offset: 93 }
    ];
    const payPlan = planDefs.map((p, i) => {
      // 前几期按比例四舍五入，末期吸收舍入差额，保证分期合计 = 合同额
      const isLast = i === planDefs.length - 1;
      const planAmount = isLast
        ? amount - planDefs.slice(0, i).reduce((s, x) => s + Math.round(amount * x.ratio), 0)
        : Math.round(amount * p.ratio);
      return {
        id: 'pp_' + Date.now().toString(36) + i,
        name: p.name,
        ratio: p.ratio,
        amount: planAmount,
        dueDate: F.dayOffset(p.offset),
        status: '未收款',
        paidAmount: 0,
        paidDate: ''
      };
    });
    const seq = store.list('contracts').length + 1;
    const contract = store.insert('contracts', {
      no: store.nextSerial('contracts', 'HT'),
      customerId: q.customerId,
      projectId: q.projectId || '',
      quoteId: q.id,
      title: (c ? c.name + ' · ' : '') + q.title.replace(/^[^·]*·\s*/, '') + ' 施工合同',
      amount,
      signDate: '',
      startDate: F.dayOffset(3),
      planEndDate: F.dayOffset(93),
      status: '待签约',
      payMode: '按进度分期',
      creator: (store.getCurrentUser() || {}).name || q.creator || '',
      remark: '由报价单 ' + q.no + ' 自动生成，签约后生效。',
      payPlan
    });
    store.setQuoteStatus(q.id, '已确认');
    // 回写报价侧的合同关联，编辑页据此禁止再改价
    store.update('quotes', q.id, { contractId: contract.id });

    // 合同生成后自动开立施工项目（含标准工序节点），打通「签约 → 施工」
    const project = store.createProjectFromContract(contract.id);

    wx.showToast({
      title: project ? '合同与项目已生成' : '合同已生成',
      icon: 'success'
    });
    setTimeout(() => {
      wx.navigateTo({ url: '/pages/contract/detail?id=' + contract.id });
    }, 500);
  },

  goCustomer() {
    wx.navigateTo({ url: '/pages/customer/detail?id=' + this.data.quote.customerId });
  },

  goContract() {
    if (!this.data.contractId) {
      wx.showToast({ title: '暂无关联合同', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/contract/detail?id=' + this.data.contractId });
  },

  goEdit() {
    wx.navigateTo({ url: '/pages/quote/edit?id=' + this.data.id });
  },

  /** 删除报价单（已转合同的不允许删，避免合同失去来源） */
  confirmDelete() {
    if (this.data.hasContract) {
      wx.showToast({ title: '已转合同的报价不能删除', icon: 'none' });
      return;
    }
    const that = this;
    wx.showModal({
      title: '删除报价单',
      content: '确定删除该报价单？删除后列表不再显示。',
      confirmText: '删除',
      confirmColor: '#C94F45',
      success(res) {
        if (!res.confirm) return;
        const r = store.deleteRecord('quotes', that.data.id);
        if (!r.ok) {
          wx.showToast({ title: r.msg, icon: 'none' });
          return;
        }
        wx.showToast({ title: '已删除', icon: 'success' });
        setTimeout(() => wx.navigateBack({ fail() { wx.switchTab({ url: '/pages/quote/list' }); } }), 600);
      }
    });
  }
});
