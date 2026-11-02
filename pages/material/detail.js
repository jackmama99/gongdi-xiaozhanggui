const store = require('../../data/store');
const F = require('../../utils/format');
const C = require('../../utils/constants');

// 采购流程步骤定义
const STEP_DEFS = [
  { status: '待采购', name: '待采购', emoji: '📝' },
  { status: '已下单', name: '已下单', emoji: '🛒' },
  { status: '在途', name: '运输在途', emoji: '🚚' },
  { status: '已入库', name: '已入库', emoji: '📦' },
  { status: '已使用', name: '已使用', emoji: '✅' }
];

// 下一步动作
const NEXT_ACTION = {
  待采购: { label: '确认下单', next: '已下单' },
  已下单: { label: '标记在途', next: '在途' },
  在途: { label: '确认入库', next: '已入库' },
  已入库: { label: '标记已使用', next: '已使用' }
};

Page({
  data: {
    id: '',
    notFound: false,
    material: {},
    steps: [],
    action: null,
    canDelete: false
  },

  onLoad(options) {
    if (!store.guard('material')) return;
    this.setData({ id: (options && options.id) || '' });
    this.load();
  },

  onShow() {
    if (!this.data.id) return;
    if (!store.guard('material')) return;
    this.load();
  },

  onPullDownRefresh() {
    this.load();
    wx.stopPullDownRefresh();
  },

  load() {
    const m = store.find('materials', this.data.id);
    if (!m) {
      this.setData({ notFound: true });
      return;
    }

    const project = store.find('projects', m.projectId);
    const currentIndex = Math.max(0, STEP_DEFS.findIndex((s) => s.status === m.status));

    const steps = STEP_DEFS.map((s, i) => {
      let dateText = '';
      if (s.status === '已下单') dateText = m.orderDate ? F.date(m.orderDate) : '';
      if (s.status === '已入库') dateText = m.arriveDate ? F.date(m.arriveDate) : '';
      return {
        name: s.name,
        emoji: s.emoji,
        done: i <= currentIndex,
        active: i === currentIndex,
        isLast: i === STEP_DEFS.length - 1,
        dateText
      };
    });

    this.setData({
      notFound: false,
      material: {
        id: m.id,
        no: m.no,
        name: m.name,
        category: m.category,
        spec: m.spec || '—',
        unit: m.unit,
        qty: m.qty,
        priceText: F.money(m.price),
        amountText: F.money(m.amount),
        amountWan: F.wan(m.amount),
        supplier: m.supplier || '未填写',
        keeper: m.keeper || '—',
        status: m.status,
        statusType: C.MATERIAL_STATUS_COLOR[m.status] || 'gray',
        projectId: m.projectId,
        projectName: project ? project.name : '未知项目',
        projectNo: project ? project.no : '',
        projectStatus: project ? project.status : '',
        projectStatusType: project ? C.PROJECT_STATUS_COLOR[project.status] || 'gray' : 'gray'
      },
      steps,
      action: NEXT_ACTION[m.status] || null,
      canDelete: store.canDelete('materials')
    });

    wx.setNavigationBarTitle({ title: m.name });
  },

  goList() {
    wx.navigateBack({
      fail() {
        wx.redirectTo({ url: '/pages/material/list' });
      }
    });
  },

  goProject() {
    const pid = this.data.material.projectId;
    if (!pid) return;
    wx.navigateTo({ url: '/pages/project/detail?id=' + pid });
  },

  onNext() {
    const action = this.data.action;
    if (!action) return;
    const that = this;
    wx.showModal({
      title: action.label,
      content: '确认将材料状态更新为「' + action.next + '」？',
      confirmColor: '#1D4E89',
      success(res) {
        if (!res.confirm) return;
        store.setMaterialStatus(that.data.id, action.next);
        wx.showToast({ title: '状态已更新', icon: 'success' });
        that.load();
      }
    });
  },

  /** 删除材料（老板/项目经理） */
  confirmDelete() {
    const name = this.data.material.name || '该材料';
    const that = this;
    wx.showModal({
      title: '删除材料',
      content: '确定删除「' + name + '」？删除后列表不再显示。',
      confirmText: '删除',
      confirmColor: '#C94F45',
      success(res) {
        if (!res.confirm) return;
        const r = store.deleteRecord('materials', that.data.id);
        if (!r.ok) {
          wx.showToast({ title: r.msg, icon: 'none' });
          return;
        }
        wx.showToast({ title: '已删除', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 600);
      }
    });
  }
});
