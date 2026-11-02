const store = require('../../data/store');
const F = require('../../utils/format');
const C = require('../../utils/constants');

const LEVEL_COLOR = { A: 'red', B: 'orange', C: 'blue', D: 'gray' };
const LEVEL_DESC = { A: '高意向 · 重点跟进', B: '意向明确 · 正常跟进', C: '待培育 · 保持触达', D: '低意向 · 低频维护' };

// 客户状态只能往前走，避免录一次“已量房”把“已报价”的客户拉回去
const STATUS_ORDER = ['新线索', '跟进中', '已量房', '已报价', '已签约'];
const RESULT_STATUS = {
  继续跟进: '跟进中',
  待确认: '跟进中',
  需协调: '跟进中',
  已约到店: '跟进中',
  待出方案: '跟进中',
  已确认: '跟进中',
  已量房: '已量房'
};

/** 根据跟进结果推导应该推进到的状态；不该变时返回空串 */
function nextStatusFor(customer, result) {
  const target = RESULT_STATUS[result];
  if (!target || !customer) return '';
  if (customer.status === '已流失' || customer.status === '已签约') return '';
  const cur = STATUS_ORDER.indexOf(customer.status);
  const to = STATUS_ORDER.indexOf(target);
  return to > cur ? target : '';
}

Page({
  data: {
    id: '',
    tab: 'follow',          // follow | quote | contract
    tabs: [
      { key: 'follow', name: '跟进记录', count: 0 },
      { key: 'quote', name: '报价单', count: 0 },
      { key: 'contract', name: '合同', count: 0 }
    ],
    customer: null,
    follows: [],
    quotes: [],
    contracts: [],
    counts: { follow: 0, quote: 0, contract: 0 },    levelColor: 'gray',
    levelDesc: '',
    // 新增跟进弹窗
    popupVisible: false,
    todayStr: '',
    followTypes: C.FOLLOW_TYPE,
    followForm: { type: '电话', content: '', result: '', nextFollow: '' },
    followResultOptions: ['继续跟进', '待确认', '已确认', '已约到店', '需协调', '已量房', '待出方案']
  },

  onLoad(options) {
    this.setData({ id: options.id || '' });
  },

  onShow() {
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData();
    wx.stopPullDownRefresh();
  },

  loadData() {
    const c = store.customerOf(this.data.id);
    if (!c) {
      wx.showToast({ title: '客户不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack({ fail() { wx.switchTab({ url: '/pages/customer/list' }); } }), 600);
      return;
    }
    const follows = store.followsOfCustomer(c.id).map((f) => ({
      id: f.id,
      type: f.type,
      content: f.content,
      result: f.result,
      ownerName: f.ownerName || '系统',
      time: f.time,
      timeText: F.time(f.time),
      typeColor: f.type === '签约' ? 'green' : f.type === '量房' ? 'violet' : 'blue'
    }));
    const quotes = store.quotesOfCustomer(c.id).map((q) => ({
      id: q.id,
      no: q.no,
      title: q.title,
      area: q.area,
      status: q.status,
      statusColor: q.status === '已确认' ? 'green' : q.status === '待客户确认' ? 'orange' : q.status === '待内部审批' ? 'violet' : 'gray',
      totalText: F.money(q.total),
      itemsCount: (q.items || []).length,
      createTimeText: F.date(q.createTime)
    }));
    const contracts = store.contractsOfCustomer(c.id).map((ct) => {
      const paid = (ct.payPlan || []).reduce((s, p) => s + (p.paidAmount || 0), 0);
      return {
        id: ct.id,
        no: ct.no,
        title: ct.title,
        amountText: F.money(ct.amount),
        status: ct.status,
        statusColor: C.CONTRACT_STATUS_COLOR[ct.status] || 'gray',
        signDateText: ct.signDate ? F.date(ct.signDate) : '未签约',
        paidText: F.wan(paid),
        rate: F.percent(paid, ct.amount || 1)
      };
    });
    const project = store.projectOf(c.id);

    const nextDiff = c.nextFollow ? F.daysFromToday(c.nextFollow) : null;

    this.setData({
      customer: {
        id: c.id,
        no: c.no,
        name: c.name,
        avatar: F.shortName(c.name),
        level: c.level || 'D',
        levelText: (c.level || 'D') + ' 级',
        levelColor: LEVEL_COLOR[c.level] || 'gray',
        levelDesc: LEVEL_DESC[c.level] || '',
        status: c.status || '新线索',
        statusColor: C.CUSTOMER_STATUS_COLOR[c.status] || 'gray',
        source: c.source || '其他',
        gender: c.gender || '—',
        phone: c.phone || '',
        phoneMasked: F.maskPhone(c.phone),
        house: c.house || '未填写小区',
        areaText: (c.area || 0) + '㎡',
        houseType: c.houseType || '—',
        style: c.style || '—',
        budgetText: F.wan(c.budget || 0),
        budgetFull: F.money(c.budget || 0),
        intention: c.intention || '暂无意向说明',
        tags: c.tags || [],
        ownerName: c.ownerName || '未分配',
        createTimeText: F.date(c.createTime),
        lastFollowText: c.lastFollow ? F.time(c.lastFollow) : '暂未跟进',
        nextFollowText: c.nextFollow || '未设置',
        nextFollowTip: nextDiff === null ? '' : nextDiff < 0 ? '逾期 ' + Math.abs(nextDiff) + ' 天' : nextDiff === 0 ? '今天' : '还有 ' + nextDiff + ' 天',
        nextFollowCls: nextDiff === null ? 'none' : nextDiff < 0 ? 'danger' : nextDiff <= 1 ? 'warning' : 'normal',
        projectId: project ? project.id : '',
        projectName: project ? project.name : ''
      },
      follows,
      quotes,
      contracts,
      counts: { follow: follows.length, quote: quotes.length, contract: contracts.length },
      // 没有对应模块权限的角色，不显示报价/合同页签
      tabs: [
        { key: 'follow', name: '跟进记录', count: follows.length }
      ].concat(
        store.can('quote') ? [{ key: 'quote', name: '报价单', count: quotes.length }] : [],
        store.can('contract') ? [{ key: 'contract', name: '合同', count: contracts.length }] : []
      )
    });
    wx.setNavigationBarTitle({ title: c.name + ' · 客户详情' });
  },

  onTabTap(e) {
    this.setData({ tab: e.currentTarget.dataset.key });
  },

  // ---------------- 电话 ----------------
  onCall() {
    const p = this.data.customer && this.data.customer.phone;
    if (!p) return;
    wx.makePhoneCall({ phoneNumber: String(p), fail() {} });
  },

  // ---------------- 跟进弹窗 ----------------
  openFollowPopup() {
    // 带出客户原有的下次跟进，避免“只记内容就保存”把计划抹掉
    const c = store.customerOf(this.data.id) || {};
    this.setData({
      popupVisible: true,
      todayStr: F.today(),
      followForm: { type: '电话', content: '', result: '继续跟进', nextFollow: c.nextFollow || '' }
    });
  },

  onClearNextFollow() {
    this.setData({ 'followForm.nextFollow': '' });
  },

  onNextFollowChange(e) {
    this.setData({ 'followForm.nextFollow': e.detail.value });
  },

  closeFollowPopup() {
    this.setData({ popupVisible: false });
  },

  onFollowTypeTap(e) {
    this.setData({ 'followForm.type': e.currentTarget.dataset.value });
  },

  onFollowResultTap(e) {
    this.setData({ 'followForm.result': e.currentTarget.dataset.value });
  },

  onFollowContentInput(e) {
    this.setData({ 'followForm.content': e.detail.value });
  },

  confirmFollow() {
    const { followForm } = this.data;
    if (!String(followForm.content || '').trim()) {
      wx.showToast({ title: '请填写跟进内容', icon: 'none' });
      return;
    }
    store.addFollow(this.data.id, {
      type: followForm.type,
      content: String(followForm.content).trim(),
      result: followForm.result,
      nextFollow: followForm.nextFollow || ''
    });
    // 跟进结果自动推进客户状态（只进不退，已签约/已流失不动）
    const c = store.customerOf(this.data.id);
    const target = nextStatusFor(c, followForm.result);
    if (c && target) {
      store.update('customers', c.id, { status: target });
    }
    this.setData({ popupVisible: false });
    wx.showToast({ title: '跟进已记录', icon: 'success' });
    this.loadData();
  },

  // ---------------- 跳转 ----------------
  goEdit() {
    wx.navigateTo({ url: '/pages/customer/edit?id=' + this.data.id });
  },

  goQuoteDetail(e) {
    wx.navigateTo({ url: '/pages/quote/detail?id=' + e.currentTarget.dataset.id });
  },

  goContractDetail(e) {
    wx.navigateTo({ url: '/pages/contract/detail?id=' + e.currentTarget.dataset.id });
  },

  goCreateQuote() {
    wx.navigateTo({ url: '/pages/quote/edit?customerId=' + this.data.id });
  },

  goProject() {
    const pid = this.data.customer.projectId;
    if (!pid) {
      wx.showToast({ title: '该客户暂无关联项目', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/project/detail?id=' + pid });
  },

  onMore() {
    const c = this.data.customer || {};
    const items = ['编辑客户资料', '新建报价单', '添加到店跟进'];
    // 状态只读后，流失/恢复放在这里作为唯一的手动入口
    const lostAction = c.status === '已流失' ? '重新激活客户' : (c.status === '已签约' ? '' : '标记为已流失');
    if (lostAction) items.push(lostAction);
    const canDel = store.canDelete('customers');
    if (canDel) items.push('删除客户');

    wx.showActionSheet({
      itemList: items,
      success: (res) => {
        const picked = items[res.tapIndex];
        if (picked === '编辑客户资料') this.goEdit();
        else if (picked === '新建报价单') this.goCreateQuote();
        else if (picked === '添加到店跟进') {
          store.addFollow(this.data.id, { type: '到店', content: '客户到店沟通需求', result: '已到店' });
          wx.showToast({ title: '已记录到店', icon: 'success' });
          this.loadData();
        } else if (picked === '标记为已流失' || picked === '重新激活客户') {
          this.toggleLost(picked === '重新激活客户');
        } else if (picked === '删除客户') {
          this.confirmDelete();
        }
      }
    });
  },

  /** 标记流失 / 重新激活 */
  toggleLost(activate) {
    const target = activate ? '跟进中' : '已流失';
    store.update('customers', this.data.id, { status: target });
    wx.showToast({ title: activate ? '已重新激活' : '已标记流失', icon: 'success' });
    this.loadData();
  },

  /** 删除客户（仅老板；软删除，历史单据保留） */
  confirmDelete() {
    const name = (this.data.customer && this.data.customer.name) || '该客户';
    const that = this;
    wx.showModal({
      title: '删除客户',
      content: '确定删除「' + name + '」？删除后列表不再显示，历史单据保留。',
      confirmText: '删除',
      confirmColor: '#C94F45',
      success(res) {
        if (!res.confirm) return;
        const r = store.deleteRecord('customers', that.data.id);
        if (!r.ok) {
          wx.showToast({ title: r.msg, icon: 'none' });
          return;
        }
        wx.showToast({ title: '已删除', icon: 'success' });
        setTimeout(() => wx.navigateBack({ fail() { wx.switchTab({ url: '/pages/customer/list' }); } }), 600);
      }
    });
  }
});
