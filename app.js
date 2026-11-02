/**
 * 工地小掌柜 · 工地管理小程序
 * 全局逻辑
 */
const store = require('./data/store');

App({
  globalData: {
    user: null,
    theme: {
      primary: '#1D4E89'
    },
    // 供页面间轻量传参（复杂对象不宜放 url）
    cache: {}
  },

  onLaunch() {
    // 预热数据层
    store.refresh();
    // 初始化云同步（未开启 useCloud 时为空操作）
    store.initCloud();
    this.globalData.user = store.getCurrentUser();
    this.globalData.team = store.currentTeam();
    // 已登录则后台对齐云端数据
    if (store.currentTeamId()) {
      store.syncNow().catch(() => {});
    }
  },

  onShow() {
    this.globalData.user = store.getCurrentUser();
    this.globalData.team = store.currentTeam();
  },

  /**
   * 登录守卫：
   * - 未登录 → 登录页
   * - 已登录但没有团队 → 创建/加入团队页
   */
  requireLogin() {
    if (!store.getCurrentUser()) {
      wx.reLaunch({ url: '/pages/login/index' });
      return false;
    }
    if (!store.currentTeamId()) {
      wx.reLaunch({ url: '/pages/team/setup' });
      return false;
    }
    return true;
  }
});
