const store = require('../../data/store');
const F = require('../../utils/format');
const C = require('../../utils/constants');

Page({
  data: {
    id: '',
    project: {},
    nodes: [],
    doneCount: 0,
    totalCount: 0,
    progress: 0,
    expandedIndex: -1
  },

  onLoad(options) {
    this.setData({ id: (options && options.id) || '' });
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
    const project = store.find('projects', id);
    if (!project) {
      wx.showToast({ title: '项目不存在', icon: 'none' });
      return;
    }
    const raw = store.nodesOf(id);

    const doneCount = raw.filter((n) => n.status === '已完成').length;
    const progress = Math.round(
      raw.reduce((s, n) => {
        if (n.status === '已完成') return s + n.weight;
        if (n.status === '进行中') return s + n.weight * 0.5;
        return s;
      }, 0)
    );

    const nodes = raw.map((n, i) => {
      let overdueDays = 0;
      if (n.status !== '已完成' && n.planEnd) {
        const d = F.daysFromToday(n.planEnd);
        if (d < 0) overdueDays = Math.abs(d);
      }
      return {
        id: n.id,
        seq: n.seq,
        name: n.name,
        category: n.category,
        weight: n.weight,
        status: n.status,
        statusColor: C.NODE_STATUS_COLOR[n.status] || 'gray',
        planStart: F.date(n.planStart),
        planEnd: F.date(n.planEnd),
        actualStart: n.actualStart ? F.date(n.actualStart) : '',
        actualEnd: n.actualEnd ? F.date(n.actualEnd) : '',
        owner: n.owner || '',
        remark: n.remark || '',
        overdueDays,
        isDone: n.status === '已完成',
        isRunning: n.status === '进行中',
        canStart: n.status === '未开始' || n.status === '已逾期',
        expanded: this.data.expandedIndex === i
      };
    });

    this.setData({
      project: {
        name: project.name,
        status: project.status,
        startDate: F.date(project.startDate),
        planEndDate: F.date(project.planEndDate),
        managerName: project.managerName
      },
      nodes,
      doneCount,
      totalCount: raw.length,
      progress
    });
  },

  noop() {},

  toggleExpand(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ expandedIndex: this.data.expandedIndex === index ? -1 : index });
    this.load();
  },

  startNode(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;
    const that = this;
    wx.showModal({
      title: '开始施工',
      content: '确认开始「' + name + '」？\n上一个进行中的节点会自动标记为已完成。',
      confirmColor: '#1D4E89',
      success(res) {
        if (!res.confirm) return;
        const r = store.startNode(that.data.id, id);
        if (!r) {
          wx.showToast({ title: '合同尚未签约，不能开工', icon: 'none' });
          return;
        }
        wx.showToast({ title: '已开始', icon: 'success' });
        that.load();
      }
    });
  },

  finishNode(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;
    const that = this;
    wx.showModal({
      title: '标记完成',
      content: '确认「' + name + '」已完工？完成后将记录实际完成日期。',
      confirmColor: '#1D4E89',
      success(res) {
        if (!res.confirm) return;
        const r = store.finishNode(that.data.id, id);
        if (!r) {
          wx.showToast({ title: '请先开始施工', icon: 'none' });
          return;
        }
        wx.showToast({ title: '已完成', icon: 'success' });
        that.load();
      }
    });
  },

  callOwner(e) {
    const name = e.currentTarget.dataset.name;
    const user = store.list('users').find((u) => u.name === name);
    if (!user) {
      wx.showToast({ title: '暂无联系方式', icon: 'none' });
      return;
    }
    wx.makePhoneCall({
      phoneNumber: user.phone,
      fail() {
        wx.showToast({ title: '已取消', icon: 'none' });
      }
    });
  }
});
