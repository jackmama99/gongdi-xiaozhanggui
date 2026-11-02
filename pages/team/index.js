const store = require('../../data/store');
const F = require('../../utils/format');

Page({
  data: {
    hasTeam: false,
    team: {},
    members: [],
    isOwner: false,
    roleList: ['设计师', '项目经理', '财务', '销售'],
    stats: { members: 0, customers: 0, projects: 0 },
    showRename: false,
    renameValue: '',
    currentUserId: ''
  },

  onShow() {
    this.load();
  },

  onPullDownRefresh() {
    this.load();
    wx.stopPullDownRefresh();
  },

  load() {
    const team = store.currentTeam();
    if (!team) {
      this.setData({ hasTeam: false, members: [] });
      return;
    }

    const owner = store.isOwner();
    const me = store.getCurrentUser();

    const members = store.teamMembers().map((m) => ({
      id: m.id,
      name: m.name,
      phone: F.maskPhone(m.phone || ''),
      initial: (m.name || '?').slice(0, 1),
      isOwner: m.isOwner,
      roleText: m.roleText || m.role || '成员',
      roleIndex: Math.max(0, this.data.roleList.indexOf(m.role)),
      isMe: !!(me && me.id === m.id)
    }));

    this.setData({
      hasTeam: true,
      isOwner: owner,
      currentUserId: me ? me.id : '',
      team: {
        id: team.id,
        name: team.name,
        inviteCode: team.inviteCode,
        city: team.city || '未填写',
        industry: team.industry || '未填写',
        createTime: team.createTime || ''
      },
      members,
      stats: {
        members: members.length,
        customers: store.list('customers').length,
        projects: store.list('projects').length
      },
      renameValue: team.name
    });

    wx.setNavigationBarTitle({ title: team.name });
  },

  copyCode() {
    const code = this.data.team.inviteCode;
    if (!code) return;
    wx.setClipboardData({
      data: code,
      success() {
        wx.showToast({ title: '邀请码已复制', icon: 'success' });
      }
    });
  },

  regenCode() {
    if (!this.data.isOwner) return;
    const that = this;
    wx.showModal({
      title: '重置邀请码',
      content: '重置后旧邀请码立即失效，已加入的成员不受影响。',
      confirmColor: '#1D4E89',
      success(res) {
        if (!res.confirm) return;
        const r = store.regenerateInviteCode();
        if (r.ok) {
          wx.showToast({ title: '已重置', icon: 'success' });
          that.load();
        }
      }
    });
  },

  onRoleChange(e) {
    const id = e.currentTarget.dataset.id;
    const index = Number(e.detail.value);
    const res = store.updateMemberRole(id, this.data.roleList[index]);
    if (!res.ok) {
      wx.showToast({ title: res.msg, icon: 'none' });
      return;
    }
    wx.showToast({ title: '角色已调整', icon: 'success' });
    this.load();
  },

  removeMember(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;
    const that = this;
    wx.showModal({
      title: '移除成员',
      content: '将「' + name + '」移出团队？移除后他看不到团队数据。',
      confirmColor: '#C94F45',
      success(res) {
        if (!res.confirm) return;
        const r = store.removeMember(id);
        if (!r.ok) {
          wx.showToast({ title: r.msg, icon: 'none' });
          return;
        }
        wx.showToast({ title: '已移除', icon: 'success' });
        that.load();
      }
    });
  },

  callMember(e) {
    const phone = e.currentTarget.dataset.phone;
    if (!phone) {
      wx.showToast({ title: '未填写手机号', icon: 'none' });
      return;
    }
    wx.makePhoneCall({
      phoneNumber: phone,
      fail() {
        wx.showToast({ title: '已取消', icon: 'none' });
      }
    });
  },

  openRename() {
    if (!this.data.isOwner) return;
    this.setData({ showRename: true, renameValue: this.data.team.name });
  },

  closeRename() {
    this.setData({ showRename: false });
  },

  onRenameInput(e) {
    this.setData({ renameValue: e.detail.value });
  },

  submitRename() {
    const name = this.data.renameValue.trim();
    if (!name) {
      wx.showToast({ title: '请输入团队名称', icon: 'none' });
      return;
    }
    store.renameTeam(name);
    this.setData({ showRename: false });
    wx.showToast({ title: '已保存', icon: 'success' });
    this.load();
  },

  goSetup() {
    wx.navigateTo({ url: '/pages/team/setup?mode=create' });
  },

  copyInviteText() {
    const t = this.data.team;
    const text =
      '邀请你加入「' + t.name + '」的工地小掌柜团队\n邀请码：' + t.inviteCode + '\n打开小程序 → 加入团队 → 输入邀请码';
    wx.setClipboardData({
      data: text,
      success() {
        wx.showToast({ title: '邀请文案已复制', icon: 'success' });
      }
    });
  }
});
