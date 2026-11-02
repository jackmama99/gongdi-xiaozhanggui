const store = require('../../data/store');
const F = require('../../utils/format');
const C = require('../../utils/constants');

// 有意向等级配色：A红 / B橙 / C蓝 / D灰
const LEVEL_COLOR = { A: 'red', B: 'orange', C: 'blue', D: 'gray' };
// 统计条固定展示的漏斗状态
const STAT_STATUS = ['新线索', '跟进中', '已量房', '已报价', '已签约'];
// 每页加载条数（列表分页）
const PAGE_SIZE = 30;

/** 下次跟进提示：今天 / 逾期 N 天 / 日期 */
function followHint(date) {
  if (!date) return { text: '无需跟进', cls: 'none' };
  const diff = F.daysFromToday(date);
  if (diff < 0) return { text: '已逾期 ' + Math.abs(diff) + ' 天', cls: 'danger' };
  if (diff === 0) return { text: '今天待跟进', cls: 'warning' };
  if (diff === 1) return { text: '明天待跟进', cls: 'warning' };
  return { text: F.md(date) + ' 待跟进', cls: 'normal' };
}

/** 客户 -> 列表卡片所需的展示数据 */
function toCard(c) {
  const hint = followHint(c.nextFollow);
  return {
    id: c.id,
    no: c.no,
    name: c.name,
    avatar: F.shortName(c.name),
    level: c.level || 'D',
    levelText: (c.level || 'D') + ' 级',
    levelColor: LEVEL_COLOR[c.level] || 'gray',
    status: c.status || '新线索',
    statusColor: C.CUSTOMER_STATUS_COLOR[c.status] || 'gray',
    phone: F.maskPhone(c.phone),
    rawPhone: c.phone || '',
    house: c.house || '未填写小区',
    areaText: (c.area || 0) + '㎡',
    budgetText: F.wan(c.budget || 0),
    source: c.source || '其他',
    ownerName: c.ownerName || '未分配',
    lastFollowText: c.lastFollow ? F.fromNow(c.lastFollow) : '暂未跟进',
    nextText: hint.text,
    nextCls: hint.cls
  };
}

Page({
  data: {
    tabs: [],            // 全部 + 各状态
    activeStatus: '全部',
    ownerTabs: [],
    followFilter: 'all',
    followTabs: [],       // 全部 + 团队成员（负责人）
    ownerFilter: '全部',
    keyword: '',
    list: [],
    fullList: [],        // 过滤后的完整列表（内存）
    hasMore: false,
    stats: { total: 0, signed: 0, list: [] },
    loading: true
  },

  onLoad() {
    this.buildTabs();
  },

  onShow() {
    if (!getApp().requireLogin()) return;
    this.refresh();
  },

  onPullDownRefresh() {
    this.refresh();
    wx.stopPullDownRefresh();
  },

  /** 生成筛选 tab 及数量 */
  buildTabs() {
    const customers = store.list('customers');
    const kw = String(this.data.keyword || '').trim().toLowerCase();
    const ownerId = this.data.ownerFilter || '全部';
    // tab 计数跟随「搜索 + 负责人」条件，避免显示与列表不符的数字
    const base = customers.filter((c) => {
      if (ownerId !== '全部' && String(c.ownerId || '') !== ownerId) return false;
      if (!kw) return true;
      return [c.name, c.phone, c.house].some(
        (v) => String(v || '').toLowerCase().indexOf(kw) > -1
      );
    });
    const countOf = (status) => base.filter((c) => c.status === status).length;
    const tabs = [{ key: '全部', count: base.length, color: 'blue' }].concat(
      C.CUSTOMER_STATUS.map((s) => ({
        key: s,
        count: countOf(s),
        color: C.CUSTOMER_STATUS_COLOR[s] || 'gray'
      }))
    );
    // 统计条（不含「已流失」）
    const statList = STAT_STATUS.map((s) => ({ name: s, count: countOf(s) }));
    const today = customers.filter((c) => c.nextFollow && F.daysFromToday(c.nextFollow) === 0).length;
    const overdue = customers.filter((c) => c.nextFollow && F.daysFromToday(c.nextFollow) < 0).length;
    this.setData({
      followTabs: [
        { key: 'all', name: '全部跟进', count: 0 },
        { key: 'today', name: '今天待跟进', count: today },
        { key: 'overdue', name: '已逾期', count: overdue }
      ],
      tabs,
      ownerTabs: [{ id: '全部', name: '全部同事' }].concat(store.teamMembers().map((m) => ({ id: m.id, name: m.name }))),
      stats: {
        total: base.length,
        signed: countOf('已签约'),
        list: statList
      }
    });
  },

  /** 查询 + 过滤 */
  refresh() {
    this.buildTabs();
    const { activeStatus, keyword, ownerFilter } = this.data;
    const kw = String(keyword || '').trim().toLowerCase();
    let arr = store.list('customers').slice();
    if (activeStatus !== '全部') {
      arr = arr.filter((c) => c.status === activeStatus);
    }
    // 团队共享：可按负责人筛选
    if (ownerFilter && ownerFilter !== '全部') {
      arr = arr.filter((c) => String(c.ownerId || '') === ownerFilter);
    }
    if (kw) {
      arr = arr.filter((c) => {
        const name = String(c.name || '').toLowerCase();
        const phone = String(c.phone || '');
        const house = String(c.house || '').toLowerCase();
        return name.indexOf(kw) > -1 || phone.indexOf(kw) > -1 || house.indexOf(kw) > -1;
      });
    }
    // 跟进提醒筛选
    const followFilter = this.data.followFilter || 'all';
    if (followFilter === 'today') {
      arr = arr.filter((c) => c.nextFollow && F.daysFromToday(c.nextFollow) === 0);
    } else if (followFilter === 'overdue') {
      arr = arr.filter((c) => c.nextFollow && F.daysFromToday(c.nextFollow) < 0);
    }
    // 已签约/已流失沉底，再按最后跟进时间倒序
    const weight = (s) => (s === '已签约' ? 2 : s === '已流失' ? 3 : 1);
    arr.sort((a, b) => {
      const w = weight(a.status) - weight(b.status);
      if (w !== 0) return w;
      return String(b.lastFollow || '') < String(a.lastFollow || '') ? -1 : 1;
    });
    const full = arr.map(toCard);
    this.setData({
      fullList: full,
      list: full.slice(0, PAGE_SIZE),
      hasMore: full.length > PAGE_SIZE,
      hasFilter: !!kw || activeStatus !== '全部' || ownerFilter !== '全部' || followFilter !== 'all',
      loading: false
    });
  },

  /** 触底加载更多 */
  onReachBottom() {
    const { fullList, list } = this.data;
    if (list.length >= fullList.length) return;
    this.setData({
      list: fullList.slice(0, list.length + PAGE_SIZE),
      hasMore: list.length + PAGE_SIZE < fullList.length
    });
  },

  onTabTap(e) {
    const key = e.currentTarget.dataset.key;
    if (key === this.data.activeStatus) return;
    this.setData({ activeStatus: key }, () => this.refresh());
  },

  /** 按负责人筛选（团队共享客户） */
  onFollowFilterTap(e) {
    const key = e.currentTarget.dataset.key;
    if (key === this.data.followFilter) return;
    this.setData({ followFilter: key }, () => this.refresh());
  },

  onOwnerTap(e) {
    const id = e.currentTarget.dataset.id;
    if (id === this.data.ownerFilter) return;
    this.setData({ ownerFilter: id }, () => this.refresh());
  },

  onStatTap(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ activeStatus: key, keyword: '' }, () => this.refresh());
  },

  onSearchInput(e) {
    this.setData({ keyword: e.detail.value }, () => this.refresh());
  },

  onSearchClear() {
    this.setData({ keyword: '' }, () => this.refresh());
  },

  onCardTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/customer/detail?id=' + id });
  },

  onCall(e) {
    const phone = e.currentTarget.dataset.phone;
    if (!phone) return;
    wx.makePhoneCall({ phoneNumber: String(phone), fail() {} });
  },

  goCreate() {
    // 清掉筛选，保证保存返回后一定能看到新客户
    this.setData({
      activeStatus: '全部',
      ownerFilter: '全部',
      followFilter: 'all',
      keyword: ''
    });
    wx.navigateTo({ url: '/pages/customer/edit' });
  },

  onEmptyAction() {
    wx.navigateTo({ url: '/pages/customer/edit' });
  }
});
