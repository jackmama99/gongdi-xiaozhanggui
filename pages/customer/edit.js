const store = require('../../data/store');
const F = require('../../utils/format');
const C = require('../../utils/constants');

Page({
  data: {
    id: '',
    isEdit: false,
    form: {
      name: '',
      phone: '',
      gender: '男',
      source: '门店到访',
      status: '新线索',
      level: 'C',
      house: '',
      area: '',
      houseType: '平层',
      style: '现代简约',
      budget: '',
      intention: '',
      nextFollow: '',
      ownerId: ''
    },
    genders: ['男', '女'],
    levels: C.CUSTOMER_LEVEL,
    sources: C.CUSTOMER_SOURCE,
    statuses: C.CUSTOMER_STATUS,
    houseTypes: C.HOUSE_TYPE,
    styles: C.DESIGN_STYLE,
    sourceIndex: 1,
    statusIndex: 0,
    houseTypeIndex: 0,
    styleIndex: 0,
    ownerOptions: [],
    ownerIndex: -1,
    ownerName: '',
    todayDate: F.today(),
    saving: false
  },

  onLoad(options) {
    if (wx.enableAlertBeforeUnload) wx.enableAlertBeforeUnload({ message: '客户资料还没保存，确定离开吗？' });
    this.loadOwners();
    if (options && options.id) {
      this.setData({ id: options.id, isEdit: true });
      this.loadCustomer(options.id);
      wx.setNavigationBarTitle({ title: '编辑客户' });
    } else {
      wx.setNavigationBarTitle({ title: '新增客户' });
      const user = store.getCurrentUser();
      const idx = this.data.ownerOptions.findIndex((u) => u.id === (user && user.id));
      this.setData({
        'form.nextFollow': F.dayOffset(2),
        ownerIndex: idx > -1 ? idx : 0,
        'form.ownerId': idx > -1 ? user.id : (this.data.ownerOptions[0] ? this.data.ownerOptions[0].id : ''),
        ownerName: idx > -1 ? user.name : (this.data.ownerOptions[0] ? this.data.ownerOptions[0].name : '')
      });
    }
  },

  /** 负责人候选 */
  loadOwners() {
    const owners = store.list('users').map((u) => ({
      id: u.id,
      name: u.name,
      label: u.name + ' · ' + u.role
    }));
    this.setData({ ownerOptions: owners });
  },

  /** 编辑回填 */
  loadCustomer(id) {
    const c = store.customerOf(id);
    if (!c) {
      wx.showToast({ title: '客户不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack({ fail() { wx.switchTab({ url: '/pages/customer/list' }); } }), 600);
      return;
    }
    const sourceIndex = Math.max(0, C.CUSTOMER_SOURCE.indexOf(c.source));
    const statusIndex = Math.max(0, C.CUSTOMER_STATUS.indexOf(c.status));
    const houseTypeIndex = Math.max(0, C.HOUSE_TYPE.indexOf(c.houseType));
    const styleIndex = Math.max(0, C.DESIGN_STYLE.indexOf(c.style));
    const ownerIndex = this.data.ownerOptions.findIndex((u) => u.id === c.ownerId);
    // 记录打开时的版本，保存前比对，检测同事的并发修改
    this.originUpdateTime = c.updateTime || 0;
    this.setData({
      form: {
        name: c.name || '',
        phone: c.phone || '',
        gender: c.gender || '男',
        source: c.source || '门店到访',
        status: c.status || '新线索',
        level: c.level || 'C',
        house: c.house || '',
        area: c.area ? String(c.area) : '',
        houseType: c.houseType || '平层',
        style: c.style || '现代简约',
        budget: c.budget ? String(c.budget) : '',
        intention: c.intention || '',
        nextFollow: c.nextFollow || '',
        ownerId: c.ownerId || ''
      },
      sourceIndex,
      statusIndex,
      houseTypeIndex,
      styleIndex,
      ownerIndex,
      ownerName: c.ownerName || ''
    });
  },

  // ---------------- 表单输入 ----------------
  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ ['form.' + field]: e.detail.value });
  },

  onGenderTap(e) {
    this.setData({ 'form.gender': e.currentTarget.dataset.value });
  },

  onLevelTap(e) {
    this.setData({ 'form.level': e.currentTarget.dataset.value });
  },

  onSourceChange(e) {
    const i = Number(e.detail.value);
    this.setData({ sourceIndex: i, 'form.source': C.CUSTOMER_SOURCE[i] });
  },

  onStatusChange(e) {
    const i = Number(e.detail.value);
    this.setData({ statusIndex: i, 'form.status': C.CUSTOMER_STATUS[i] });
  },

  onHouseTypeChange(e) {
    const i = Number(e.detail.value);
    this.setData({ houseTypeIndex: i, 'form.houseType': C.HOUSE_TYPE[i] });
  },

  onStyleChange(e) {
    const i = Number(e.detail.value);
    this.setData({ styleIndex: i, 'form.style': C.DESIGN_STYLE[i] });
  },

  onOwnerChange(e) {
    const i = Number(e.detail.value);
    const owner = this.data.ownerOptions[i];
    if (!owner) return;
    this.setData({ ownerIndex: i, 'form.ownerId': owner.id, ownerName: owner.name });
  },

  onDateChange(e) {
    this.setData({ 'form.nextFollow': e.detail.value });
  },

  onDateClear() {
    this.setData({ 'form.nextFollow': '' });
  },

  // ---------------- 提交 ----------------
  validate() {
    const f = this.data.form;
    if (!String(f.name || '').trim()) return '请填写客户姓名';
    const phone = String(f.phone || '').trim();
    if (!phone) return '请填写联系电话';
    if (!/^1[3-9]\d{9}$/.test(phone) && !/^0\d{2,3}-?\d{7,8}$/.test(phone)) {
      return '请填写正确的手机号';
    }
    if (!String(f.house || '').trim()) return '请填写小区 / 地址';
    const okNum = (v) => v === '' || v === null || v === undefined
      || (Number.isFinite(Number(v)) && Number(v) >= 0);
    if (!okNum(f.area)) return '建筑面积需为非负数字';
    if (!okNum(f.budget)) return '装修预算需为非负数字';
    return '';
  },

  onSubmit() {
    if (this.data.saving) return;
    const err = this.validate();
    if (err) {
      wx.showToast({ title: err, icon: 'none' });
      return;
    }
    const f = this.data.form;
    const owner = this.data.ownerOptions[this.data.ownerIndex];
    const origin = this.data.isEdit ? store.customerOf(this.data.id) : null;
    // 原负责人已不在团队成员里时，保留原归属，不要静默清空
    const fallbackOwner = (!owner && origin)
      ? { id: origin.ownerId || '', name: origin.ownerName || '' }
      : null;
    const payload = {
      name: String(f.name).trim(),
      phone: String(f.phone).trim(),
      gender: f.gender,
      source: f.source,
      // 状态由跟进/报价/签约自动推进，编辑表单不参与修改
      status: origin ? origin.status : '新线索',
      level: f.level,
      house: String(f.house).trim(),
      area: f.area === '' ? 0 : Number(f.area),
      houseType: f.houseType,
      style: f.style,
      budget: f.budget === '' ? 0 : Number(f.budget),
      intention: String(f.intention || '').trim(),
      nextFollow: f.nextFollow || '',
      ownerId: owner ? owner.id : (fallbackOwner ? fallbackOwner.id : ''),
      ownerName: owner ? owner.name : (fallbackOwner ? fallbackOwner.name : '')
    };

    if (this.data.isEdit) {
      const latest = store.find('customers', this.data.id);
      if (!latest) {
        this.setData({ saving: false });
        wx.showToast({ title: '该客户已被删除', icon: 'none' });
        return;
      }
      if (this.originUpdateTime && latest.updateTime && latest.updateTime !== this.originUpdateTime) {
        wx.showModal({
          title: '记录已被同事修改',
          content: '你打开后，这条客户被其他人改过。继续保存会覆盖对方的改动。',
          confirmText: '仍然保存',
          cancelText: '刷新看看',
          success: (r) => {
            if (r.confirm) this.doSave(payload);
            else this.loadCustomer(this.data.id);
          }
        });
        return;
      }
    }
    this.doSave(payload);
  },

  /** 实际落库 */
  doSave(payload) {
    this.setData({ saving: true });
    const saved = this.data.isEdit
      ? store.saveCustomer(Object.assign({ id: this.data.id }, payload))
      : store.saveCustomer(payload);
    if (!saved) {
      this.setData({ saving: false });
      wx.showToast({ title: '保存失败，请刷新后重试', icon: 'none' });
      return;
    }
    if (wx.disableAlertBeforeUnload) wx.disableAlertBeforeUnload();
    wx.showToast({ title: this.data.isEdit ? '已保存' : '客户已新增', icon: 'success' });
    setTimeout(() => {
      wx.navigateBack({
        fail() {
          wx.switchTab({ url: '/pages/customer/list' });
        }
      });
    }, 500);
  },

  onCancel() {
    wx.navigateBack({
      fail() {
        wx.switchTab({ url: '/pages/customer/list' });
      }
    });
  }
});
