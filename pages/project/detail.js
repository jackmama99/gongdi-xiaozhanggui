const store = require('../../data/store');
const F = require('../../utils/format');
const C = require('../../utils/constants');

Page({
  data: {
    id: '',
    project: {},
    nodes: [],
    visibleNodes: [],
    changes: [],
    canFinance: false,
    changeVisible: false,
    changeForm: { title: '', amount: '', remark: '' },
    inspections: [],
    entries: [],
    finance: {},
    daysLeftText: '',
    isOverdue: false
  },

  onLoad(options) {
    const id = (options && options.id) || '';
    this.setData({ id });
  },

  onShow() {
    if (this.data.id) this.load();
  },

  onPullDownRefresh() {
    this.load();
    wx.stopPullDownRefresh();
  },

  load() {
    const id = this.data.id;
    const raw = store.find('projects', id);
    if (!raw) {
      wx.showToast({ title: '项目不存在或无权查看', icon: 'none' });
      setTimeout(() => {
        wx.navigateBack({ fail() { wx.switchTab({ url: '/pages/project/list' }); } });
      }, 600);
      return;
    }
    const project = store.projectCard(raw);
    const cust = store.customerOf(project.customerId);

    const profit = (project.contractAmount || 0) - (project.cost || 0);
    const finance = {
      contract: F.money(project.contractAmount),
      received: F.money(project.received),
      cost: F.money(project.cost),
      profit: F.money(profit),
      receivedRate: F.percent(project.received, project.contractAmount || 1),
      costRate: F.percent(project.cost, project.contractAmount || 1),
      profitRate: F.percent(profit, project.contractAmount || 1),
      remainReceive: F.money((project.contractAmount || 0) - (project.received || 0))
    };

    const nodes = store.nodesOf(id);
    const doneCount = nodes.filter((n) => n.status === '已完成').length;
    const visibleNodes = nodes
      .map((n) => ({
        id: n.id,
        seq: n.seq,
        name: n.name,
        category: n.category,
        status: n.status,
        statusColor: C.NODE_STATUS_COLOR[n.status] || 'gray',
        planStart: F.md(n.planStart),
        planEnd: F.md(n.planEnd),
        actualEnd: n.actualEnd ? F.md(n.actualEnd) : '',
        weight: n.weight
      }))
      .slice(Math.max(0, doneCount - 2), Math.max(5, doneCount + 3));

    const changes = store.changesOfProject(id).map((c) => ({
      id: c.id,
      no: c.no,
      title: c.title,
      amount: F.money(c.amount),
      status: c.status,
      statusColor: c.status === '已确认' ? 'green' : c.status === '已驳回' ? 'red' : 'orange',
      confirmable: c.status === '待确认' || c.status === '待审批',
      applicant: c.applicant,
      time: F.md(c.createTime)
    }));

    const inspections = store.inspectionsOfProject(id).slice(0, 2).map((i) => ({
      id: i.id,
      type: i.type,
      result: i.result,
      resultColor: i.result === '合格' ? 'green' : i.result === '待整改' ? 'orange' : 'red',
      date: i.date,
      inspector: i.inspector,
      passCount: (i.items || []).filter((x) => x.pass).length,
      totalCount: (i.items || []).length
    }));

    const entries = [
      { icon: '📋', name: '施工节点', url: '/pages/project/node?id=' + id, color: '#e8f0f8', module: 'project' },
      { icon: '✅', name: '巡检记录', url: '/pages/project/inspect?id=' + id, color: '#e5f3ef', module: 'project' },
      { icon: '🧾', name: '合同详情', url: project.contractId ? '/pages/contract/detail?id=' + project.contractId : '', color: '#fff0e3', module: 'contract', toast: project.contractId ? '' : '暂无关联合同' },
      { icon: '👤', name: '客户信息', url: '/pages/customer/detail?id=' + project.customerId, color: '#e8f0f8', module: 'customer' },
      { icon: '💳', name: '收款登记', url: '/pages/finance/receipt?projectId=' + id, color: '#e8f0f8', module: 'finance' },
      { icon: '💸', name: '支出登记', url: '/pages/finance/expense?projectId=' + id, color: '#fbe9e7', module: 'finance' },
      { icon: '🚚', name: '材料采购', url: '/pages/material/list?projectId=' + id, color: '#e5f3ef', module: 'material' },
      { icon: '🛠', name: '售后工单', url: '/pages/aftersale/list?projectId=' + id, color: '#fff0e3', module: 'aftersale' },
      { icon: '📐', name: '报价单', url: '/pages/quote/list', color: '#e8f0f8', module: 'quote' }
    ].filter((e) => store.can(e.module));

    const daysLeft = project.daysLeft;
    this.setData({
      canFinance: store.can('finance'),
      project: Object.assign({}, project, {
        customerName: cust ? cust.name : '',
        customerPhone: cust ? cust.phone : '',
        statusColor: C.PROJECT_STATUS_COLOR[project.status] || 'gray',
        startDate: F.date(project.startDate),
        planEndDate: F.date(project.planEndDate),
        actualEndDate: project.actualEndDate ? F.date(project.actualEndDate) : '',
        contractWanText: F.wan(project.contractAmount)
      }),
      nodes: nodes.map((n) => ({ id: n.id, name: n.name, status: n.status, statusColor: C.NODE_STATUS_COLOR[n.status] || 'gray', weight: n.weight })),
      visibleNodes,
      changes,
      inspections,
      entries,
      finance,
      daysLeftText: daysLeft >= 0 ? '剩余 ' + daysLeft + ' 天' : '已逾期 ' + Math.abs(daysLeft) + ' 天',
      isOverdue: daysLeft < 0
    });

    wx.setNavigationBarTitle({ title: project.name });
  },

  goEntry(e) {
    const item = e.currentTarget.dataset.item;
    if (!item.url) {
      wx.showToast({ title: item.toast || '暂不可用', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: item.url });
  },

  goNode() {
    wx.navigateTo({ url: '/pages/project/node?id=' + this.data.id });
  },

  goInspect() {
    wx.navigateTo({ url: '/pages/project/inspect?id=' + this.data.id });
  },

  goCustomer() {
    wx.navigateTo({ url: '/pages/customer/detail?id=' + this.data.project.customerId });
  },

  callCustomer() {
    const phone = this.data.project.customerPhone;
    if (!phone) return;
    wx.makePhoneCall({
      phoneNumber: phone,
      fail() {
        wx.showToast({ title: '已取消', icon: 'none' });
      }
    });
  },

  // ---------------- 变更签证 ----------------
  openChange() {
    this.setData({ changeVisible: true, changeForm: { title: '', amount: '', remark: '' } });
  },

  closeChange() {
    this.setData({ changeVisible: false });
  },

  noop() {},

  onChangeInput(e) {
    this.setData({ ['changeForm.' + e.currentTarget.dataset.field]: e.detail.value });
  },

  submitChange() {
    const f = this.data.changeForm;
    if (!String(f.title || '').trim()) {
      wx.showToast({ title: '请填写变更事项', icon: 'none' });
      return;
    }
    const amount = Number(f.amount) || 0;
    if (amount < 0) {
      wx.showToast({ title: '金额不能为负', icon: 'none' });
      return;
    }
    store.addChange(this.data.id, {
      title: String(f.title).trim(),
      amount,
      remark: String(f.remark || '').trim()
    });
    this.setData({ changeVisible: false });
    wx.showToast({ title: '已提交', icon: 'success' });
    this.load();
  },

  confirmChange(e) {
    const id = e.currentTarget.dataset.id;
    const that = this;
    wx.showModal({
      title: '确认变更签证',
      content: '确认该变更已获客户同意并计入合同？',
      confirmColor: '#1D4E89',
      success(res) {
        if (!res.confirm) return;
        store.confirmChange(id, true);
        wx.showToast({ title: '已确认', icon: 'success' });
        that.load();
      }
    });
  },

  onShareAppMessage() {
    return { title: this.data.project.name, path: '/pages/project/detail?id=' + this.data.id };
  }
});
