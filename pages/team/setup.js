const store = require('../../data/store');

Page({
  data: {
    mode: 'join', // join | create
    needProfile: true,
    // 个人资料
    name: '',
    phone: '',
    // 加入
    inviteCode: '',
    // 角色（财务由老板在团队页授予，加入时不可自选）
    roleList: ['设计师', '项目经理', '销售'],
    roleIndex: 0,
    // 创建
    companyName: '',
    city: '',
    industryList: ['家装 / 整装', '公装 / 工装', '软装设计', '全屋定制'],
    industryIndex: 0,
    loading: false,
    errorMsg: ''
  },

  onLoad(options) {
    const mode = (options && options.mode) === 'create' ? 'create' : 'join';
    const user = store.getCurrentUser();
    this.setData({
      mode,
      needProfile: !user,
      name: user ? user.name : '',
      phone: user ? user.phone || '' : '',
      // 已有账号但没团队，默认沿用原角色
      roleIndex: user && this.data.roleList.indexOf(user.role) > -1
        ? this.data.roleList.indexOf(user.role)
        : 0
    });
    wx.setNavigationBarTitle({ title: mode === 'create' ? '创建团队' : '加入团队' });
  },

  switchMode(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ mode, errorMsg: '' });
    wx.setNavigationBarTitle({ title: mode === 'create' ? '创建团队' : '加入团队' });
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value, errorMsg: '' });
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value, errorMsg: '' });
  },

  onCodeInput(e) {
    this.setData({ inviteCode: e.detail.value.toUpperCase(), errorMsg: '' });
  },

  onRoleChange(e) {
    this.setData({ roleIndex: Number(e.detail.value) });
  },

  onCompanyInput(e) {
    this.setData({ companyName: e.detail.value, errorMsg: '' });
  },

  onCityInput(e) {
    this.setData({ city: e.detail.value });
  },

  onIndustryChange(e) {
    this.setData({ industryIndex: Number(e.detail.value) });
  },

  /** 未登录时先注册一个账号 */
  ensureUser() {
    // 合规门禁：采集姓名/手机号前必须有协议同意记录
    if (!store.getCurrentUser() && !store.hasConsent()) {
      this.setData({ errorMsg: '请先返回登录页阅读并同意《用户服务协议》和《隐私政策》' });
      return false;
    }
    if (store.getCurrentUser()) return true;
    const name = this.data.name.trim();
    if (!name) {
      this.setData({ errorMsg: '请填写你的姓名' });
      return false;
    }
    const res = store.registerUser({
      name,
      phone: this.data.phone.trim(),
      role: this.data.roleList[this.data.roleIndex]
    });
    if (!res.ok) {
      this.setData({ errorMsg: res.msg || '创建账号失败' });
      return false;
    }
    return true;
  },

  /** 加入团队 */
  submitJoin() {
    if (this.data.loading) return;
    const code = this.data.inviteCode.trim();
    if (!code) {
      this.setData({ errorMsg: '请输入老板给你的邀请码' });
      return;
    }
    this.setData({ loading: true, errorMsg: '' });
    setTimeout(async () => {
      if (!this.ensureUser()) {
        this.setData({ loading: false });
        return;
      }
      const res = await store.joinTeam({
        inviteCode: code,
        name: this.data.name.trim(),
        phone: this.data.phone.trim(),
        role: this.data.roleList[this.data.roleIndex]
      });
      if (!res.ok) {
        this.setData({ loading: false, errorMsg: res.msg || '加入失败' });
        return;
      }
      wx.showToast({ title: '已加入 ' + res.team.name, icon: 'success' });
      store.syncNow().catch(() => {});
      setTimeout(() => {
        wx.switchTab({ url: '/pages/workbench/index' });
      }, 700);
    }, 200);
  },

  /** 创建团队 */
  submitCreate() {
    if (this.data.loading) return;
    const companyName = this.data.companyName.trim();
    if (!companyName) {
      this.setData({ errorMsg: '请填写公司 / 团队名称' });
      return;
    }
    this.setData({ loading: true, errorMsg: '' });
    setTimeout(() => {
      if (!this.ensureUser()) {
        this.setData({ loading: false });
        return;
      }
      const res = store.createTeam({
        name: companyName,
        city: this.data.city.trim(),
        industry: this.data.industryList[this.data.industryIndex]
      });
      if (!res.ok) {
        this.setData({ loading: false, errorMsg: res.msg || '创建失败' });
        return;
      }
      wx.showToast({ title: '团队创建成功', icon: 'success' });
      store.flushToCloud().catch(() => {});
      setTimeout(() => {
        wx.switchTab({ url: '/pages/workbench/index' });
      }, 700);
    }, 200);
  },

  goLogin() {
    wx.navigateBack({
      fail() {
        wx.reLaunch({ url: '/pages/login/index' });
      }
    });
  }
});
