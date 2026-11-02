const store = require('../../data/store');
const config = require('../../config');
const F = require('../../utils/format');

const DEMO_ACCOUNTS = [
  { account: 'admin', role: '总经理', name: '周文斌', initial: '周' },
  { account: 'chen', role: '项目经理', name: '陈国栋', initial: '陈' },
  { account: 'lin', role: '设计师', name: '林思雨', initial: '林' },
  { account: 'wu', role: '财务', name: '吴晓静', initial: '吴' },
  { account: 'ma', role: '销售', name: '马克明', initial: '马' }
];

Page({
  data: {
    account: '',
    password: '',
    showPwd: false,
    loading: false,
    errorMsg: '',
    // 演示模式才显示演示账号；正式版为空，首次使用引导创建团队
    isDemo: false,
    accounts: [],
    hasUser: false,
    version: '',
    agreed: false,
    agreeShake: false
  },

  onLoad() {
    const isDemo = config.demoMode !== false;
    this.setData({
      isDemo,
      accounts: isDemo ? DEMO_ACCOUNTS : [],
      hasUser: store.listAll('users').length > 0,
      version: config.version,
      agreed: store.hasConsent()
    });
    // 已登录（且已加入团队）直接进工作台
    if (store.isLoggedIn()) {
      wx.switchTab({ url: '/pages/workbench/index' });
    }
  },

  onAccountInput(e) {
    this.setData({ account: e.detail.value, errorMsg: '' });
  },

  onPwdInput(e) {
    this.setData({ password: e.detail.value, errorMsg: '' });
  },

  togglePwd() {
    this.setData({ showPwd: !this.data.showPwd });
  },

  fillAccount(e) {
    const item = e.currentTarget.dataset.item;
    this.setData({ account: item.account, password: '123456', errorMsg: '' });
  },

  /** 勾选/取消同意协议 */
  toggleAgree() {
    this.setData({ agreed: !this.data.agreed, errorMsg: '' });
  },

  goService() {
    wx.navigateTo({ url: '/pages/agreement/service' });
  },

  goPrivacy() {
    wx.navigateTo({ url: '/pages/agreement/privacy' });
  },

  /**
   * 登录前的同意门禁：未勾选则不采集任何用户信息
   * 返回 true 表示已同意，可继续登录
   */
  requireAgree() {
    if (this.data.agreed) {
      store.setConsent();
      return true;
    }
    this.setData({ errorMsg: '请先阅读并同意《用户服务协议》和《隐私政策》', agreeShake: true });
    setTimeout(() => this.setData({ agreeShake: false }), 500);
    return false;
  },

  doLogin() {
    const { account, password } = this.data;
    if (!account.trim()) {
      this.setData({ errorMsg: '请输入账号' });
      return;
    }
    if (!password.trim()) {
      this.setData({ errorMsg: '请输入密码' });
      return;
    }
    if (!this.requireAgree()) return;
    this.setData({ loading: true, errorMsg: '' });
    setTimeout(() => {
      const res = store.login(account.trim(), password.trim());
      if (!res.ok) {
        this.setData({ loading: false, errorMsg: res.msg || '登录失败' });
        return;
      }
      const app = getApp();
      app.globalData.user = res.user;

      // 账号还没归属团队 → 先去创建/加入团队
      if (res.needTeam) {
        wx.showToast({ title: '请先加入团队', icon: 'none' });
        setTimeout(() => {
          wx.navigateTo({ url: '/pages/team/setup' });
        }, 400);
        return;
      }

      wx.showToast({ title: '登录成功', icon: 'success' });
      // 后台与云端对齐（未开启云同步时无副作用）
      store.syncNow().catch(() => {});
      setTimeout(() => {
        wx.switchTab({ url: '/pages/workbench/index' });
      }, 400);
    }, 260);
  },

  /** 微信一键登录：按 openid 取回成员与团队 */
  doWechatLogin() {
    if (this.data.loading) return;
    if (!this.requireAgree()) return;
    this.setData({ loading: true, errorMsg: '' });
    store.loginByWechat().then((res) => {
      // 认得这个人，但还没有团队 → 引导去创建或加入
      if (res.needTeam) {
        this.setData({ loading: false });
        wx.showToast({ title: '请先创建或加入团队', icon: 'none' });
        setTimeout(() => {
          wx.navigateTo({ url: '/pages/team/setup' });
        }, 400);
        return;
      }
      if (!res.ok) {
        this.setData({ loading: false, errorMsg: res.msg || '登录失败' });
        return;
      }
      getApp().globalData.user = res.user;
      wx.showToast({ title: '登录成功', icon: 'success' });
      setTimeout(() => {
        this.setData({ loading: false });
        wx.switchTab({ url: '/pages/workbench/index' });
      }, 400);
    }).catch(() => {
      this.setData({ loading: false, errorMsg: '网络异常，请重试' });
    });
  },

  /** 没有账号：走加入/创建团队流程 */
  goTeamSetup() {
    wx.navigateTo({ url: '/pages/team/setup?mode=join' });
  },

  onDemoLogin() {
    this.setData({ account: 'admin', password: '123456' });
    this.doLogin();
  }
});
