const store = require('../../data/store');
const F = require('../../utils/format');
const C = require('../../utils/constants');

// 收款状态配色：兼容 seed 中实际使用的「已收款」与字典中的「已收清」
const PAY_COLOR = Object.assign({}, C.PAY_STATUS_COLOR, {
  已收款: 'green',
  已结清: 'green'
});

Page({
  data: {
    id: '',
    contract: null,
    plans: [],
    progress: {
      paid: 0,
      paidText: '0.00',
      unpaidText: '0.00',
      rate: 0,
      barType: '',
      label: ''
    },
    summary: {
      paidWan: '0',
      unpaidWan: '0',
      totalWan: '0'
    },
    overdueCount: 0,
    hasQuote: false
  },

  onLoad(options) {
    if (!store.guard('contract')) return;
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
    const ct = store.find('contracts', this.data.id);
    if (!ct) {
      wx.showToast({ title: '合同不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack({ fail() { wx.switchTab({ url: '/pages/contract/list' }); } }), 600);
      return;
    }
    const cust = store.customerOf(ct.customerId);
    const project = ct.projectId ? store.find('projects', ct.projectId) : store.projectOf(ct.customerId);
    const quote = ct.quoteId ? store.find('quotes', ct.quoteId) : null;

    let paidTotal = 0;
    let overdueCount = 0;

    const plans = (ct.payPlan || []).map((p, i) => {
      const paidAmount = p.paidAmount || 0;
      paidTotal += paidAmount;
      const remain = Math.max(0, (p.amount || 0) - paidAmount);
      const diff = p.dueDate ? F.daysFromToday(p.dueDate) : 0;
      const isSettled = p.status === '已收款' || p.status === '已收清' || remain <= 0;
      const overdue = !isSettled && p.dueDate && diff < 0;
      if (overdue) overdueCount += 1;

      // 逾期时状态显示为「已逾期」，配色走 danger
      const statusText = overdue ? '已逾期' : p.status || '未收款';
      const statusColor = overdue
        ? 'red'
        : PAY_COLOR[statusText] || (isSettled ? 'green' : 'gray');

      return {
        id: p.id,
        seq: i + 1,
        name: p.name,
        ratioText: Math.round((p.ratio || 0) * 1000) / 10 + '%',
        amountText: F.money(p.amount || 0),
        amountWan: F.wan(p.amount || 0),
        dueDateText: p.dueDate ? F.date(p.dueDate) : '—',
        statusText,
        statusColor,
        paidAmountText: F.money(paidAmount),
        paidDateText: p.paidDate ? F.date(p.paidDate) : '—',
        remainText: F.money(remain),
        isSettled,
        isOverdue: !!overdue,
        overdueDays: overdue ? Math.abs(diff) : 0,
        overdueTip: overdue ? '逾期 ' + Math.abs(diff) + ' 天' : ''
      };
    });

    const amount = ct.amount || 0;
    const unpaid = Math.max(0, amount - paidTotal);
    const rate = F.percent(paidTotal, amount || 1);

    this.setData({
      contract: {
        id: ct.id,
        no: ct.no,
        title: ct.title,
        status: ct.status,
        statusColor: C.CONTRACT_STATUS_COLOR[ct.status] || 'gray',
        amount,
        amountText: F.money(amount),
        amountWan: F.wan(amount),
        customerId: ct.customerId,
        customerName: cust ? cust.name : '未关联客户',
        customerPhone: cust ? F.maskPhone(cust.phone) : '',
        customerHouse: cust ? cust.house : '',
        projectId: project ? project.id : '',
        projectName: project ? project.name : '',
        projectStatus: project ? project.status : '',
        quoteId: ct.quoteId || '',
        quoteNo: quote ? quote.no : '',
        quoteTotal: quote ? F.money(quote.total) : '',
        signDateText: ct.signDate ? F.date(ct.signDate) : '未签约',
        startDateText: ct.startDate ? F.date(ct.startDate) : '—',
        planEndText: ct.planEndDate ? F.date(ct.planEndDate) : '—',
        creator: ct.creator || '—',
        payMode: ct.payMode || '按进度分期',
        remark: ct.remark || '',
        payCount: plans.length
      },
      plans,
      progress: {
        paid: paidTotal,
        paidText: F.money(paidTotal),
        unpaidText: F.money(unpaid),
        rate,
        barType: rate >= 100 ? 'success' : overdueCount > 0 ? 'danger' : rate > 0 ? '' : 'warning',
        label: rate + '%'
      },
      summary: {
        paidWan: F.wan(paidTotal),
        unpaidWan: F.wan(unpaid),
        totalWan: F.wan(amount)
      },
      overdueCount,
      hasQuote: !!ct.quoteId
    });
    wx.setNavigationBarTitle({ title: ct.no + ' · 合同详情' });
  },

  // ---------------- 跳转 ----------------
  goCustomer() {
    const cid = this.data.contract && this.data.contract.customerId;
    if (!cid) return;
    wx.navigateTo({ url: '/pages/customer/detail?id=' + cid });
  },

  goProject() {
    const pid = this.data.contract && this.data.contract.projectId;
    if (!pid) {
      wx.showToast({ title: '该合同暂未关联项目', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/project/detail?id=' + pid });
  },

  goQuote() {
    if (!this.data.hasQuote) {
      wx.showToast({ title: '该合同未关联报价单', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/quote/detail?id=' + this.data.contract.quoteId });
  },

  /** 登记收款：带合同与项目参数 */
  goReceipt() {
    const ct = this.data.contract;
    const pid = ct.projectId || '';
    let url = '/pages/finance/receipt?contractId=' + ct.id;
    if (pid) url += '&projectId=' + pid;
    wx.navigateTo({ url });
  },

  /** 点击某一期直接登记该期收款 */
  goPlanReceipt(e) {
    const plan = this.data.plans[e.currentTarget.dataset.index];
    if (!plan) return;
    if (plan.isSettled) {
      wx.showToast({ title: '该期已收清', icon: 'none' });
      return;
    }
    const ct = this.data.contract;
    const pid = ct.projectId || '';
    let url = '/pages/finance/receipt?contractId=' + ct.id + '&planId=' + plan.id;
    if (pid) url += '&projectId=' + pid;
    wx.navigateTo({ url });
  },

  onCall() {
    const c = store.customerOf(this.data.contract.customerId);
    if (!c || !c.phone) return;
    wx.makePhoneCall({ phoneNumber: String(c.phone), fail() {} });
  },

  /** 签约：待签约合同可标记为履行中 */
  onSign() {
    wx.showModal({
      title: '确认签约',
      content: '将合同状态更新为「履行中」，并记录签约日期为今天。',
      confirmText: '确认签约',
      success: (res) => {
        if (!res.confirm) return;
        store.signContract(this.data.id);
        wx.showToast({ title: '已确认签约', icon: 'success' });
        this.loadData();
      }
    });
  },

  onMore() {
    const ct = this.data.contract;
    const items = ['登记收款', ct.projectId ? '查看项目' : '查看客户'];
    if (this.data.hasQuote) items.push('查看关联报价');
    const canVoid = ct.status !== '已作废' && (store.currentRole() === '老板' || store.currentRole() === '财务');
    if (canVoid) items.push('作废合同');

    wx.showActionSheet({
      itemList: items,
      success: (res) => {
        if (res.tapIndex === 0) this.goReceipt();
        else if (res.tapIndex === 1) {
          if (ct.projectId) this.goProject();
          else this.goCustomer();
        } else if (res.tapIndex === 2) this.goQuote();
        else if (res.tapIndex === items.length - 1 && canVoid) this.confirmVoid();
      }
    });
  },

  /** 作废合同（保留记录，状态置为已作废） */
  confirmVoid() {
    const that = this;
    wx.showModal({
      title: '作废合同',
      content: '作废后合同不再计入有效合同额，记录保留可查。确定作废？',
      confirmText: '作废',
      confirmColor: '#C94F45',
      success(res) {
        if (!res.confirm) return;
        const r = store.voidContract(that.data.id);
        if (!r.ok) {
          wx.showToast({ title: r.msg, icon: 'none' });
          return;
        }
        wx.showToast({ title: '已作废', icon: 'success' });
        that.loadData();
      }
    });
  }
});
