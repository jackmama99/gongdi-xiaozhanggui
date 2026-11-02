const store = require('../../data/store');
const F = require('../../utils/format');
const C = require('../../utils/constants');

// 处理记录的动作类型（默认「处理记录」）
const ACTIONS = ['处理记录', '上门维修', '更换配件', '电话回访'];
const RECORD_THEME = {
  创建工单: 'gray',
  受理工单: 'blue',
  上门排查: 'orange',
  上门维修: 'orange',
  更换配件: 'orange',
  完工回访: 'green',
  工单完成: 'green',
  处理记录: 'blue',
  电话回访: 'violet'
};

Page({
  data: {
    id: '',
    ticket: null,
    statusColor: 'gray',
    priorityColor: 'gray',
    records: [],
    hasRecords: false,
    actions: ACTIONS,
    // 处理记录弹窗
    popupVisible: false,
    actionIndex: 0,
    recordContent: ''
  },

  onLoad(options) {
    if (!store.guard('aftersale')) return;
    this.setData({ id: (options && options.id) || '' });
    this.load();
  },

  onPullDownRefresh() {
    this.load();
    wx.stopPullDownRefresh();
  },

  /** 读取工单并格式化全部展示字段 */
  load() {
    const a = store.find('aftersales', this.data.id);
    if (!a) {
      wx.showToast({ title: '工单不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack({ fail() { wx.switchTab({ url: '/pages/aftersale/list' }); } }), 700);
      return;
    }

    const proj = a.projectId ? store.find('projects', a.projectId) : null;
    const customer = a.customerId ? store.customerOf(a.customerId) : null;
    const phone = a.phone || (customer ? customer.phone : '');

    const rawRecords = (a.records || []).slice();
    // 按时间正序（历史在前，最新在后）
    rawRecords.sort((x, y) => (String(x.time || '') < String(y.time || '') ? -1 : 1));

    const records = rawRecords.map((r, i) => ({
      id: r.id || 'rec_' + i,
      timeText: r.time ? F.time(r.time) : '—',
      operator: r.operator || '系统',
      action: r.action || '处理记录',
      content: r.content || '',
      theme: RECORD_THEME[r.action] || 'blue',
      isLast: i === rawRecords.length - 1
    }));

    const isDone = a.status === '已完成' || a.status === '已关闭';

    this.setData({
      ticket: {
        id: a.id,
        no: a.no,
        type: a.type,
        status: a.status,
        priority: a.priority || '普通',
        desc: a.desc || '（无问题描述）',
        customerName: a.customerName || (customer ? customer.name : '未知客户'),
        phone,
        phoneText: phone || '未留电话',
        address: a.address || (proj ? proj.address : '—'),
        projectId: a.projectId || '',
        projectName: proj ? proj.name : '未关联项目',
        handler: a.handler || '待指派',
        createTimeText: a.createTime ? F.time(a.createTime) : '—',
        createTimeFull: a.createTime ? F.date(a.createTime) : '—',
        resolveTimeText: a.resolveTime ? F.date(a.resolveTime) : '',
        recordCount: records.length,
        isPending: a.status === '待受理',
        isDoing: a.status === '处理中',
        isDone,
        doneBtnText: a.resolveTime
          ? '✅ ' + a.status + ' · ' + F.date(a.resolveTime)
          : '✅ ' + a.status
      },
      statusColor: C.AFTERSALE_STATUS_COLOR[a.status] || 'gray',
      priorityColor: C.PRIORITY_COLOR[a.priority] || 'gray',
      records,
      hasRecords: records.length > 0
    });

    wx.setNavigationBarTitle({ title: a.no + ' · 工单详情' });
  },

  // ---------------- 跳转 / 拨号 ----------------

  onCall() {
    const phone = this.data.ticket && this.data.ticket.phone;
    if (!phone) {
      wx.showToast({ title: '该工单未留联系电话', icon: 'none' });
      return;
    }
    wx.makePhoneCall({ phoneNumber: String(phone), fail() {} });
  },

  goProject() {
    const pid = this.data.ticket && this.data.ticket.projectId;
    if (!pid) {
      wx.showToast({ title: '该工单未关联项目', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/project/detail?id=' + pid });
  },

  // ---------------- 业务操作 ----------------

  /** 受理工单：待受理 → 处理中 */
  onAccept() {
    const that = this;
    wx.showModal({
      title: '受理工单',
      content: '确认受理该售后工单并开始处理？',
      confirmText: '确认受理',
      confirmColor: '#1D4E89',
      success(res) {
        if (!res.confirm) return;
        store.setAftersaleStatus(that.data.id, '处理中');
        store.addAftersaleRecord(that.data.id, '受理工单', '工单已受理，安排师傅跟进处理。');
        wx.showToast({ title: '已受理', icon: 'success' });
        that.load();
      }
    });
  },

  /** 标记完成：处理中 → 已完成 */
  onFinish() {
    const that = this;
    wx.showModal({
      title: '标记完成',
      content: '确认该工单已处理完毕？完成后将记录完成时间。',
      confirmText: '标记完成',
      confirmColor: '#1D4E89',
      success(res) {
        if (!res.confirm) return;
        store.setAftersaleStatus(that.data.id, '已完成');
        store.addAftersaleRecord(that.data.id, '工单完成', '售后处理完毕，工单已关闭。');
        wx.showToast({ title: '工单已完成', icon: 'success' });
        that.load();
      }
    });
  },

  // ---------------- 添加处理记录 ----------------

  openRecordPopup() {
    this.setData({ popupVisible: true, actionIndex: 0, recordContent: '' });
  },

  closeRecordPopup() {
    this.setData({ popupVisible: false });
  },

  onActionTap(e) {
    this.setData({ actionIndex: Number(e.currentTarget.dataset.index) || 0 });
  },

  onContentInput(e) {
    this.setData({ recordContent: e.detail.value });
  },

  doAddRecord() {
    const content = String(this.data.recordContent || '').trim();
    if (!content) {
      wx.showToast({ title: '请填写处理内容', icon: 'none' });
      return;
    }
    const action = ACTIONS[this.data.actionIndex] || '处理记录';
    store.addAftersaleRecord(this.data.id, action, content);
    this.setData({ popupVisible: false, recordContent: '' });
    wx.showToast({ title: '记录已添加', icon: 'success' });
    this.load();
  }
});
