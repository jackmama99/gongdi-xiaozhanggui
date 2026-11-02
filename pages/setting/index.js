const store = require('../../data/store');
const config = require('../../config');
const F = require('../../utils/format');

Page({
  data: {
    user: {},
    company: {},
    users: [],
    // 统计
    dbStats: [],
    isDemo: false,
    pwdVisible: false,
    oldPwd: '',
    newPwd: '',
    newPwd2: '',
    pwdError: '',
    appInfo: {
      version: config.version,
      tech: '微信原生小程序',
      dataMode: '本地演示数据'
    }
  },

  onLoad() {
    this.refresh();
  },

  refresh() {
    const user = store.getCurrentUser() || {};
    const team = store.currentTeam() || {};
    const collections = [
      ['customers', '客户'],
      ['projects', '项目'],
      ['contracts', '合同'],
      ['quotes', '报价单'],
      ['receipts', '收款'],
      ['expenses', '支出'],
      ['materials', '材料'],
      ['inspections', '巡检'],
      ['aftersales', '售后'],
      ['todos', '待办']
    ];
    const dbStats = collections.map(([key, name]) => ({
      key,
      name,
      count: store.list(key).length
    }));

    this.setData({
      isDemo: config.demoMode !== false,
      user,
      company: {
        name: team.name || '未加入团队',
        tag: team.industry || '',
        address: team.city || '未填写',
        phone: team.phone || '未填写'
      },
      users: store.list('users'),
      dbStats
    });
  },

  callCompany() {
    const phone = (this.data.company.phone || '').replace(/\s/g, '');
    if (!phone || phone === '未填写') {
      wx.showToast({ title: '还没有填写公司电话', icon: 'none' });
      return;
    }
    wx.makePhoneCall({
      phoneNumber: phone,
      fail() {
        wx.showToast({ title: '拨号已取消', icon: 'none' });
      }
    });
  },

  copyAddress() {
    wx.setClipboardData({
      data: this.data.company.address,
      success() {
        wx.showToast({ title: '地址已复制', icon: 'success' });
      }
    });
  },

  doReset() {
    wx.showModal({
      title: '重置演示数据',
      content: '将清空所有新增/修改的记录，恢复初始演示数据。确定继续吗？',
      confirmColor: '#C94F45',
      success(res) {
        if (!res.confirm) return;
        store.reset();
        wx.showToast({ title: '数据已重置', icon: 'success' });
      }
    });
  },

  showAbout() {
    wx.showModal({
      title: '关于工地小掌柜',
      content: '工地小掌柜是一款面向家装/整装公司的内部经营管理小程序，覆盖客户 CRM、报价预算、合同收款、施工进度、材料采购、售后维保与经营分析。\n\n数据存储于微信云开发，团队成员凭邀请码加入后共享同一套数据，仅本团队成员可见。',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  // ---------------- 法律文本 ----------------
  goService() {
    wx.navigateTo({ url: '/pages/agreement/service' });
  },

  goPrivacy() {
    wx.navigateTo({ url: '/pages/agreement/privacy' });
  },

  // ---------------- 操作记录 / 备份 ----------------
  showAudit() {
    const rows = store.auditLog(20);
    if (!rows.length) {
      wx.showModal({ title: '操作记录', content: '暂无操作记录', showCancel: false });
      return;
    }
    const text = rows
      .slice(0, 10)
      .map((r) => r.time + ' ' + r.operator + ' ' + r.action + (r.detail ? '：' + r.detail : ''))
      .join(String.fromCharCode(10));
    wx.showModal({
      title: '最近操作（前 10 条）',
      content: text,
      confirmText: '复制全部',
      success: (res) => {
        if (!res.confirm) return;
        const all = rows
          .map((r) => r.time + ' ' + r.operator + ' ' + r.action + (r.detail ? '：' + r.detail : ''))
          .join(String.fromCharCode(10));
        wx.setClipboardData({ data: all });
      }
    });
  },

  exportBackup() {
    try {
      const db = wx.getStorageSync('zx_erp_db_v2') || {};
      const teamId = store.currentTeamId();
      const payload = {};
      Object.keys(db).forEach((k) => {
        const rows = db[k];
        if (!Array.isArray(rows)) return;          // company 等对象不参与导出
        payload[k] = rows
          .filter((x) => !teamId || x.teamId === teamId || k === 'teams' || k === 'users')
          .map((x) => {
            const row = Object.assign({}, x);
            delete row.password;                    // 备份不含明文密码
            return row;
          });
      });
      wx.setClipboardData({
        data: JSON.stringify(payload),
        success: () => wx.showToast({ title: '备份已复制，粘贴保存即可', icon: 'none' })
      });
    } catch (e) {
      wx.showToast({ title: '导出失败', icon: 'none' });
    }
  },

  // ---------------- 修改密码 ----------------
  openPwdPopup() {
    this.setData({ pwdVisible: true, oldPwd: '', newPwd: '', newPwd2: '', pwdError: '' });
  },

  closePwd() {
    this.setData({ pwdVisible: false });
  },

  noop() {},

  onOldPwd(e) { this.setData({ oldPwd: e.detail.value, pwdError: '' }); },
  onNewPwd(e) { this.setData({ newPwd: e.detail.value, pwdError: '' }); },
  onNewPwd2(e) { this.setData({ newPwd2: e.detail.value, pwdError: '' }); },

  submitPwd() {
    const { oldPwd, newPwd, newPwd2 } = this.data;
    const user = store.getCurrentUser();
    if (!user) return;
    if (!oldPwd) return this.setData({ pwdError: '请输入原密码' });
    if (!newPwd || newPwd.length < 6) return this.setData({ pwdError: '新密码至少 6 位' });
    if (newPwd !== newPwd2) return this.setData({ pwdError: '两次输入的新密码不一致' });
    const res = store.changePassword(user.id, oldPwd, newPwd);
    if (!res.ok) return this.setData({ pwdError: res.msg || '修改失败' });
    this.setData({ pwdVisible: false });
    wx.showToast({ title: '密码已修改', icon: 'success' });
  },

  showAccount() {
    const u = this.data.user;
    wx.showModal({
      title: '账号信息',
      content:
        '姓名：' + u.name + '\n' +
        '角色：' + u.role + '\n' +
        '部门：' + u.dept + '\n' +
        '手机：' + u.phone + '\n' +
        '账号：' + u.account,
      showCancel: false,
      confirmText: '关闭'
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
