const store = require('../../data/store');
const F = require('../../utils/format');
const C = require('../../utils/constants');

Page({
  data: {
    projectName: '',
    stats: { total: 0, totalAmount: '0.00', pending: 0, shipping: 0 },
    tabs: ['全部'].concat(C.MATERIAL_STATUS),
    activeTab: '全部',
    list: [],
    rawList: [],
    // 新建表单
    showForm: false,
    projects: [],
    projectLabels: [],
    categoryList: C.MATERIAL_CATEGORY,
    unitSuggest: ['㎡', 'm', '桶', '套', '件', '张', '个'],
    form: {
      projectIndex: 0,
      name: '',
      categoryIndex: 0,
      spec: '',
      unit: '',
      qty: '',
      price: '',
      supplier: ''
    }
  },

  onLoad(options) {
    if (!store.guard('material')) return;
    this.projectId = (options && options.projectId) || '';
    this.buildProjects();
    this.load();
  },

  onShow() {
    if (!store.guard('material')) return;
    this.load();
  },

  onPullDownRefresh() {
    this.load();
    wx.stopPullDownRefresh();
  },

  buildProjects() {
    const list = store.list('projects').map((p) => ({
      value: p.id,
      label: p.name
    }));
    this.setData({
      projects: list,
      projectLabels: list.map((x) => x.label)
    });
  },

  load() {
    let raw = store.list('materials');
    if (this.projectId) {
      raw = raw.filter((m) => m.projectId === this.projectId);
    }

    const project = this.projectId ? store.find('projects', this.projectId) : null;

    const mapped = raw.map((m) => {
      const p = store.find('projects', m.projectId);
      return {
        id: m.id,
        no: m.no,
        name: m.name,
        category: m.category,
        spec: m.spec || '—',
        unit: m.unit,
        qty: m.qty,
        priceText: F.money(m.price),
        amountText: F.money(m.amount),
        supplier: m.supplier || '未填写',
        status: m.status,
        statusType: C.MATERIAL_STATUS_COLOR[m.status] || 'gray',
        projectName: p ? p.name : '未知项目',
        _status: m.status
      };
    });

    const totalAmount = raw.reduce((s, m) => s + (m.amount || 0), 0);
    const stats = {
      total: raw.length,
      totalAmount: F.wan(totalAmount),
      pending: raw.filter((m) => m.status === '待采购').length,
      shipping: raw.filter((m) => m.status === '已下单' || m.status === '在途').length
    };

    this.setData({
      projectName: project ? project.name : '',
      stats,
      rawList: mapped
    });
    this.applyFilter(this.data.activeTab);
  },

  applyFilter(tab) {
    const list =
      tab === '全部' ? this.data.rawList : this.data.rawList.filter((m) => m._status === tab);
    this.setData({ list, activeTab: tab });
  },

  onTabTap(e) {
    this.applyFilter(e.currentTarget.dataset.tab);
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/material/detail?id=' + e.currentTarget.dataset.id });
  },

  // ---------------- 新建表单 ----------------
  openForm() {
    const defaultProjectIndex = this.projectId
      ? this.data.projects.findIndex((p) => p.value === this.projectId)
      : 0;
    this.setData({
      showForm: true,
      form: {
        projectIndex: defaultProjectIndex > -1 ? defaultProjectIndex : 0,
        name: '',
        categoryIndex: 0,
        spec: '',
        unit: '',
        qty: '',
        price: '',
        supplier: ''
      }
    });
  },

  closeForm() {
    this.setData({ showForm: false });
  },

  onFormProject(e) {
    this.setData({ 'form.projectIndex': Number(e.detail.value) });
  },

  onFormName(e) {
    this.setData({ 'form.name': e.detail.value });
  },

  onFormCategory(e) {
    this.setData({ 'form.categoryIndex': Number(e.detail.value) });
  },

  onFormSpec(e) {
    this.setData({ 'form.spec': e.detail.value });
  },

  onFormUnit(e) {
    this.setData({ 'form.unit': e.detail.value });
  },

  onFormUnitPick(e) {
    this.setData({ 'form.unit': e.currentTarget.dataset.unit });
  },

  onFormQty(e) {
    this.setData({ 'form.qty': e.detail.value });
  },

  onFormPrice(e) {
    this.setData({ 'form.price': e.detail.value });
  },

  onFormSupplier(e) {
    this.setData({ 'form.supplier': e.detail.value });
  },

  submitForm() {
    const f = this.data.form;
    if (!f.name.trim()) {
      wx.showToast({ title: '请填写材料名称', icon: 'none' });
      return;
    }
    const qty = Number(f.qty);
    const price = Number(f.price);
    if (!(qty > 0)) {
      wx.showToast({ title: '请填写正确的数量', icon: 'none' });
      return;
    }
    if (!(price > 0)) {
      wx.showToast({ title: '请填写正确的单价', icon: 'none' });
      return;
    }
    const project = this.data.projects[f.projectIndex];
    if (!project) {
      wx.showToast({ title: '请选择所属项目', icon: 'none' });
      return;
    }

    store.addMaterial({
      projectId: project.value,
      name: f.name.trim(),
      category: this.data.categoryList[f.categoryIndex],
      spec: f.spec.trim(),
      unit: f.unit.trim() || '项',
      qty,
      price,
      amount: Math.round(qty * price),
      supplier: f.supplier.trim()
    });

    this.setData({ showForm: false });
    wx.showToast({ title: '材料已登记', icon: 'success' });
    this.load();
  }
});
