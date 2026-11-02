const store = require('../../data/store');
const config = require('../../config');
const F = require('../../utils/format');

Page({
  data: {
    isDemo: false,
    version: config.version,
    user: {},
    initial: '',
    company: {},
    team: {},
    teamName: '',
    memberCount: 0,
    isOwner: false,
    stats: [],
    menus: [],
    todoCount: 0
  },

  onLoad() {
    this.refresh();
  },

  onShow() {
    if (!getApp().requireLogin()) return;
    this.refresh();
  },

  refresh() {
    const user = store.getCurrentUser() || {};
    const d = store.dashboardStats();
    const team = store.currentTeam();
    const isOwner = store.isOwner();
    const memberCount = store.teamMembers().length;

    const stats = [
      { label: '在建项目', value: d.runningCount },
      { label: '待办事项', value: d.todoCount },
      { label: '合同总数', value: store.list('contracts').length },
      { label: '客户总数', value: store.list('customers').length }
    ];

    const menus = [
      {
        group: '团队',
        items: [
          {
            icon: '🏢',
            name: '团队管理',
            url: '/pages/team/index',
            color: '#e8f0f8',
            badge: memberCount,
            desc: isOwner ? '老板 · 可管理成员' : (user.role || '成员')
          }
        ]
      },
      {
        group: '业务管理',
        items: [
          { icon: '👥', name: '客户管理', url: '/pages/customer/list', tab: true, color: '#edf1f3' },
          { icon: '🏗', name: '项目工地', url: '/pages/project/list', tab: true, color: '#fff0e3' }
        ]
          .concat(
            store.can('finance')
              ? [{ icon: '💳', name: '财务中心', url: '/pages/finance/index', tab: true, color: '#fbe9e7' }]
              : []
          )
          .concat(
            store.can('report')
              ? [{ icon: '📊', name: '经营报表', url: '/pages/report/index', color: '#e8f0f8' }]
              : []
          )
      },
      {
        group: '我的工作',
        items: [
          { icon: '✅', name: '待办审批', url: '/pages/todo/index', color: '#edf1f3', badge: d.todoCount, module: 'todo' },
          { icon: '🛠', name: '售后维保', url: '/pages/aftersale/list', color: '#fff0e3', module: 'aftersale' },
          { icon: '🚚', name: '材料采购', url: '/pages/material/list', color: '#fbe9e7', module: 'material' },
          { icon: '📐', name: '报价管理', url: '/pages/quote/list', color: '#e8f0f8', module: 'quote' }
        ].filter((e) => store.can(e.module))
      }
    ];

    this.setData({
      isDemo: config.demoMode !== false,
      user,
      initial: F.shortName(user.name || ''),
      company: team
        ? Object.assign({}, team, {
            address: [team.city, team.industry].filter(Boolean).join(' · ')
          })
        : { name: '未加入团队', address: '' },
      team: team || {},
      teamName: team ? team.name : '未加入团队',
      memberCount,
      isOwner,
      stats,
      todoCount: d.todoCount,
      menus
    });
  },

  goMenu(e) {
    const item = e.currentTarget.dataset.item;
    if (item.tab) {
      wx.switchTab({ url: item.url });
    } else {
      wx.navigateTo({ url: item.url });
    }
  },

  goSetting() {
    wx.navigateTo({ url: '/pages/setting/index' });
  },

  doReset() {
    wx.showModal({
      title: '重置演示数据',
      content: '将清空所有新增/修改记录，恢复到初始演示数据，确定继续吗？',
      confirmColor: '#C94F45',
      success(res) {
        if (!res.confirm) return;
        store.reset();
        wx.showToast({ title: '已重置', icon: 'success' });
        setTimeout(() => {
          wx.reLaunch({ url: '/pages/login/index' });
        }, 600);
      }
    });
  },

  doLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      confirmColor: '#C94F45',
      success(res) {
        if (!res.confirm) return;
        store.logout();
        wx.reLaunch({ url: '/pages/login/index' });
      }
    });
  }
});
