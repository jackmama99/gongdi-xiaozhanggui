const store = require('../../data/store');
const F = require('../../utils/format');
const C = require('../../utils/constants');

Page({
  data: {
    tabs: [{ key: 'all', name: '全部' }].concat(C.PROJECT_STATUS.map((s) => ({ key: s, name: s }))),
    activeTab: 'all',
    keyword: '',
    list: [],
    rawList: [],
    summary: {}
  },

  onLoad(options) {
    if (options && options.status) {
      this.setData({ activeTab: options.status });
    }
  },

  onShow() {
    if (!getApp().requireLogin()) return;
    this.load();
  },

  onPullDownRefresh() {
    this.load();
    wx.stopPullDownRefresh();
  },

  load() {
    const all = store.projectCards();
    const rawList = all.map((p) => {
      const cust = store.customerOf(p.customerId);
      return {
        id: p.id,
        no: p.no,
        name: p.name,
        address: p.address,
        status: p.status,
        statusColor: C.PROJECT_STATUS_COLOR[p.status] || 'gray',
        customerName: cust ? cust.name : '',
        area: p.area,
        houseType: p.houseType,
        projectType: p.projectType,
        progress: p.progress,
        currentStage: p.currentStage,
        doneNodes: p.doneNodes,
        totalNodes: p.totalNodes,
        overdueNodes: p.overdueNodes,
        daysLeft: p.daysLeft,
        daysLeftText: p.daysLeft >= 0 ? '剩余 ' + p.daysLeft + ' 天' : '逾期 ' + Math.abs(p.daysLeft) + ' 天',
        isOverdue: p.daysLeft < 0,
        hasOverdueNode: p.overdueNodes > 0,
        contractWan: p.contractWan,
        managerName: p.managerName,
        designerName: p.designerName,
        _kw: (p.name + (cust ? cust.name : '') + p.address + p.managerName).toLowerCase()
      };
    });

    const running = rawList.filter((p) => p.status === '施工中');
    const summary = {
      running: running.length,
      total: rawList.length,
      avgProgress: running.length
        ? Math.round(running.reduce((s, p) => s + p.progress, 0) / running.length)
        : 0,
      overdueNodes: rawList.reduce((s, p) => s + p.overdueNodes, 0)
    };

    this.setData({ rawList, summary });
    this.applyFilter(this.data.activeTab, this.data.keyword);
  },

  applyFilter(status, keyword) {
    const kw = (keyword || '').trim().toLowerCase();
    let list = this.data.rawList;
    if (status && status !== 'all') {
      list = list.filter((p) => p.status === status);
    }
    if (kw) {
      list = list.filter((p) => p._kw.indexOf(kw) > -1);
    }
    this.setData({ list });
  },

  switchTab(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ activeTab: key });
    this.applyFilter(key, this.data.keyword);
  },

  onSearchInput(e) {
    const keyword = e.detail.value;
    this.setData({ keyword });
    this.applyFilter(this.data.activeTab, keyword);
  },

  onEmptyAction() {
    wx.switchTab({ url: '/pages/customer/list' });
  },

  clearSearch() {
    this.setData({ keyword: '' });
    this.applyFilter(this.data.activeTab, '');
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/project/detail?id=' + id });
  },

  callManager(e) {
    const name = e.currentTarget.dataset.name;
    const user = store.list('users').find((u) => u.name === name);
    if (!user) return;
    wx.makePhoneCall({
      phoneNumber: user.phone,
      fail() {
        wx.showToast({ title: '已取消', icon: 'none' });
      }
    });
  }
});
