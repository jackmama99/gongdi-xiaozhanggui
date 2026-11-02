const store = require('../../data/store');
const F = require('../../utils/format');
const C = require('../../utils/constants');

const LEVEL_COLOR = { 特急: 'red', 紧急: 'orange', 普通: 'gray' };

Page({
  data: {
    tabs: [
      { key: 'all', name: '全部' },
      { key: '收款确认', name: '收款' },
      { key: '费用审批', name: '费用' },
      { key: '报价审批', name: '报价' },
      { key: '变更签证', name: '变更' },
      { key: '验收确认', name: '验收' },
      { key: '售后派单', name: '售后' }
    ],
    activeTab: 'all',
    list: [],
    rawList: [],
    pendingCount: 0,
    handledCount: 0,
    showPopup: false,
    current: null,
    handleRemark: ''
  },

  onLoad() {
    if (!store.guard('todo')) return;
    this.load();
  },

  onShow() {
    if (!store.guard('todo')) return;
    this.load();
  },

  onPullDownRefresh() {
    this.load();
    wx.stopPullDownRefresh();
  },

  load() {
    const all = store.list('todos');
    const pending = all.filter((t) => t.status === '待处理');
    const handled = all.filter((t) => t.status !== '待处理');

    const rawList = pending.map((t) => ({
      id: t.id,
      type: t.type,
      title: t.title,
      desc: t.desc,
      level: t.level,
      levelColor: LEVEL_COLOR[t.level] || 'gray',
      applicant: t.applicant,
      targetId: t.targetId,
      targetType: t.targetType,
      createTime: t.createTime,
      timeText: F.fromNow(t.createTime)
    }));

    this.setData({
      rawList,
      pendingCount: pending.length,
      handledCount: handled.length
    });
    this.applyFilter(this.data.activeTab, rawList);
  },

  applyFilter(key, raw) {
    const list = raw || this.data.rawList;
    const filtered = key === 'all' ? list : list.filter((t) => t.type === key);
    this.setData({ list: filtered });
  },

  switchTab(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ activeTab: key });
    this.applyFilter(key);
  },

  openHandle(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.rawList.find((t) => t.id === id);
    this.setData({ showPopup: true, current: item, handleRemark: '' });
  },

  closePopup() {
    this.setData({ showPopup: false, current: null });
  },

  onRemarkInput(e) {
    this.setData({ handleRemark: e.detail.value });
  },

  doApprove() {
    this.finish(true);
  },

  doReject() {
    this.finish(false);
  },

  finish(pass) {
    const item = this.data.current;
    if (!item) return;
    // 费用/合同类审批只允许老板或财务处理
    if (['expense', 'change', 'quote'].indexOf(item.targetType) > -1) {
      const user = store.getCurrentUser() || {};
      const allowed = store.isOwner() || user.role === '财务';
      if (!allowed) {
        wx.showToast({ title: '当前角色无权审批该类事项', icon: 'none' });
        return;
      }
    }
    // 核心审批动作必须在数据层再次校验，页面守卫不能单独承担权限边界
    if (item.targetType === 'expense' && !store.can('finance')) {
      wx.showToast({ title: '只有老板或财务可以审批支出', icon: 'none' });
      return;
    }
    const that = this;

    wx.showModal({
      title: pass ? '确认通过' : '确认驳回',
      content: (pass ? '通过' : '驳回') + '「' + item.title + '」？',
      confirmColor: pass ? '#1D4E89' : '#C94F45',
      success(res) {
        if (!res.confirm) return;
        store.dealTodo(item.id, pass);

        // 联动对应业务对象
        if (item.targetType === 'expense') {
          store.approveExpense(item.targetId, pass, that.data.handleRemark);
        } else if (item.targetType === 'change') {
          store.confirmChange(item.targetId, pass);
        } else if (item.targetType === 'quote') {
          store.setQuoteStatus(item.targetId, pass ? '已确认' : '已退回');
        } else if (item.targetType === 'aftersale') {
          if (pass) store.setAftersaleStatus(item.targetId, '处理中');
        }

        that.setData({ showPopup: false, current: null });
        wx.showToast({ title: pass ? '已通过' : '已驳回', icon: 'success' });
        that.load();
      }
    });
  },

  goDetail(e) {
    const item = e.currentTarget.dataset.item;
    const map = {
      contract: '/pages/contract/detail?id=',
      expense: '/pages/finance/expense?projectId=',
      quote: '/pages/quote/detail?id=',
      aftersale: '/pages/aftersale/detail?id=',
      inspection: '/pages/project/inspect?id=',
      change: '/pages/project/detail?id='
    };
    const base = map[item.targetType];
    if (!base) return;
    // 收支/巡检类待办的 targetId 指向业务对象，这里按类型做映射
    if (item.targetType === 'expense') {
      wx.navigateTo({ url: '/pages/finance/index' });
      return;
    }
    if (item.targetType === 'inspection') {
      const ins = store.find('inspections', item.targetId);
      if (ins) {
        wx.navigateTo({ url: '/pages/project/inspect?id=' + ins.projectId });
        return;
      }
    }
    if (item.targetType === 'change') {
      const ch = store.find('changes', item.targetId);
      if (ch) {
        wx.navigateTo({ url: '/pages/project/detail?id=' + ch.projectId });
        return;
      }
    }
    wx.navigateTo({ url: base + item.targetId });
  },

  goHandled() {
    wx.showToast({ title: '已完成 ' + this.data.handledCount + ' 项', icon: 'none' });
  }
});
