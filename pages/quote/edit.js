const store = require('../../data/store');
const F = require('../../utils/format');
const C = require('../../utils/constants');

const DEFAULT_MANAGE_RATE = 8; // 默认管理费 8%
const UNITS = ['㎡', 'm', '项', '套', '个', '桶', '张', '樘'];

/** 生成一条空白明细 */
function blankItem(seq) {
  return {
    key: 'tmp_' + seq + '_' + Date.now().toString(36),
    id: '',
    category: '基础工程',
    categoryIndex: 0,
    name: '',
    spec: '',
    unit: '㎡',
    unitIndex: 0,
    qty: '1',
    price: '0',
    amount: 0,
    amountText: '0.00'
  };
}

/** 统一计算明细行金额 */
function calcItem(it) {
  const qty = Number(it.qty) || 0;
  const price = Number(it.price) || 0;
  const amount = Math.round(qty * price * 100) / 100;
  return Object.assign({}, it, { amount, amountText: F.money(amount) });
}

Page({
  data: {
    id: '',
    isEdit: false,
    customers: [],
    customerIndex: -1,
    customerName: '',
    form: {
      title: '',
      area: '',
      projectType: '全包',
      manageRate: String(DEFAULT_MANAGE_RATE),
      designFee: '',
      discount: ''
    },
    projectTypes: C.PROJECT_TYPE,
    projectTypeIndex: 0,
    categories: C.QUOTE_CATEGORY,
    units: UNITS,
    items: [],
    seq: 0,
    summary: {
      itemsAmount: 0,
      itemsAmountText: '0.00',
      manageFee: 0,
      manageFeeText: '0.00',
      designFee: 0,
      designFeeText: '0.00',
      discount: 0,
      discountText: '0.00',
      total: 0,
      totalText: '0.00',
      count: 0
    },
    saving: false
  },

  onLoad(options) {
    if (!store.guard('quote')) return;
    if (wx.enableAlertBeforeUnload) wx.enableAlertBeforeUnload({ message: '报价还没保存，确定离开吗？' });
    // 已转合同的报价不允许再编辑，避免金额与合同脱节
    if (options && options.id) {
      const q = store.find('quotes', options.id);
      if (q && q.contractId) {
        wx.showToast({ title: '已转合同的报价不可修改', icon: 'none' });
        setTimeout(() => wx.navigateBack({ fail() {} }), 600);
        return;
      }
    }
    this.loadCustomers();
    if (options && options.id) {
      this.setData({ id: options.id, isEdit: true });
      wx.setNavigationBarTitle({ title: '编辑报价单' });
      this.loadQuote(options.id);
    } else {
      wx.setNavigationBarTitle({ title: '新建报价单' });
      const cid = options && options.customerId ? options.customerId : '';
      const idx = this.data.customers.findIndex((c) => c.id === cid);
      const c = idx > -1 ? this.data.customers[idx] : null;
      this.setData({
        customerIndex: idx,
        customerName: c ? c.name : '',
        items: [blankItem(1)],
        seq: 1
      });
      if (c) {
        const cust = store.customerOf(c.id);
        const area = cust && cust.area ? String(cust.area) : '';
        const title = cust ? cust.name + ' · ' + (cust.house || '') + (area ? ' ' + area + '㎡' : '') + ' 报价' : '';
        this.setData({ 'form.area': area, 'form.title': title });
      }
      this.recalc();
    }
  },

  loadCustomers() {
    const customers = store.list('customers').map((c) => ({
      id: c.id,
      name: c.name,
      label: c.name + ' · ' + (c.house || '未填写小区'),
      area: c.area || 0,
      house: c.house || ''
    }));
    this.setData({ customers });
  },

  loadQuote(id) {
    const q = store.find('quotes', id);
    this.originUpdateTime = (q && q.updateTime) || 0;
    if (!q) {
      wx.showToast({ title: '报价单不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 600);
      return;
    }
    const customerIndex = this.data.customers.findIndex((c) => c.id === q.customerId);
    const projectTypeIndex = Math.max(0, C.PROJECT_TYPE.indexOf(q.projectType));
    const items = (q.items || []).map((it, i) => {
      const ci = Math.max(0, C.QUOTE_CATEGORY.indexOf(it.category));
      const ui = Math.max(0, UNITS.indexOf(it.unit));
      return calcItem({
        key: 'it_' + i + '_' + it.id,
        id: it.id,
        category: it.category,
        categoryIndex: ci,
        name: it.name,
        spec: it.spec || '',
        unit: it.unit || '㎡',
        unitIndex: ui,
        qty: String(it.qty),
        price: String(it.price),
        amount: it.amount,
        amountText: F.money(it.amount)
      });
    });
    this.setData({
      customerIndex,
      customerName: customerIndex > -1 ? this.data.customers[customerIndex].name : '',
      projectTypeIndex,
      form: {
        title: q.title || '',
        area: q.area ? String(q.area) : '',
        projectType: q.projectType || '全包',
        manageRate: String(Math.round((q.manageRate || 0) * 1000) / 10),
        designFee: q.designFee ? String(q.designFee) : '',
        discount: q.discount ? String(q.discount) : ''
      },
      items: items.length ? items : [blankItem(1)],
      seq: items.length || 1
    });
    this.recalc();
  },

  // ---------------- 头部表单 ----------------
  onCustomerChange(e) {
    const i = Number(e.detail.value);
    const c = this.data.customers[i];
    if (!c) return;
    const patch = {
      customerIndex: i,
      customerName: c.name
    };
    // 面积与标题为空时自动带出
    if (!this.data.form.area && c.area) patch['form.area'] = String(c.area);
    if (!this.data.form.title) {
      patch['form.title'] = c.name + ' · ' + (c.house || '') + (c.area ? ' ' + c.area + '㎡' : '') + ' 报价';
    }
    this.setData(patch);
    this.recalc();
  },

  onProjectTypeChange(e) {
    const i = Number(e.detail.value);
    this.setData({ projectTypeIndex: i, 'form.projectType': C.PROJECT_TYPE[i] });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ ['form.' + field]: e.detail.value }, () => this.recalc());
  },

  // ---------------- 明细操作 ----------------
  onItemInput(e) {
    const index = Number(e.currentTarget.dataset.index);
    const field = e.currentTarget.dataset.field;
    const items = this.data.items.slice();
    items[index] = Object.assign({}, items[index], { [field]: e.detail.value });
    items[index] = calcItem(items[index]);
    this.setData({ items }, () => this.recalc());
  },

  onItemCategoryChange(e) {
    const index = Number(e.currentTarget.dataset.index);
    const ci = Number(e.detail.value);
    const items = this.data.items.slice();
    items[index] = Object.assign({}, items[index], {
      categoryIndex: ci,
      category: C.QUOTE_CATEGORY[ci]
    });
    this.setData({ items });
  },

  onItemUnitChange(e) {
    const index = Number(e.currentTarget.dataset.index);
    const ui = Number(e.detail.value);
    const items = this.data.items.slice();
    items[index] = Object.assign({}, items[index], { unit: this.data.units[ui] });
    this.setData({ items });
  },

  addItem() {
    const seq = this.data.seq + 1;
    const items = this.data.items.concat([blankItem(seq)]);
    this.setData({ items, seq }, () => this.recalc());
  },

  /** 在指定行后插入 */
  insertItem(e) {
    const index = Number(e.currentTarget.dataset.index);
    const seq = this.data.seq + 1;
    const items = this.data.items.slice();
    items.splice(index + 1, 0, blankItem(seq));
    this.setData({ items, seq }, () => this.recalc());
  },

  removeItem(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (this.data.items.length <= 1) {
      wx.showToast({ title: '至少保留一条明细', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '删除明细',
      content: '确定删除「' + (this.data.items[index].name || '此条目') + '」？',
      success: (res) => {
        if (!res.confirm) return;
        const items = this.data.items.slice();
        items.splice(index, 1);
        this.setData({ items }, () => this.recalc());
      }
    });
  },

  /** 实时汇总：明细小计 + 管理费 + 设计费 - 优惠 */
  recalc() {
    const items = this.data.items.map(calcItem);
    const itemsAmount = items.reduce((s, it) => s + (it.amount || 0), 0);
    const rate = (Number(this.data.form.manageRate) || 0) / 100;
    const manageFee = Math.round(itemsAmount * rate);
    const designFee = Number(this.data.form.designFee) || 0;
    const discount = Number(this.data.form.discount) || 0;
    const total = itemsAmount + manageFee + designFee - discount;
    this.setData({
      items,
      summary: {
        itemsAmount,
        itemsAmountText: F.money(itemsAmount),
        manageFee,
        manageFeeText: F.money(manageFee),
        designFee,
        designFeeText: F.money(designFee),
        discount,
        discountText: F.money(discount),
        total,
        totalText: F.money(total),
        count: items.length
      }
    });
  },

  // ---------------- 提交 ----------------
  validate() {
    if (this.data.customerIndex < 0) return '请选择客户';
    if (!String(this.data.form.title || '').trim()) return '请填写报价标题';
    const area = Number(this.data.form.area);
    if (!this.data.form.area || isNaN(area) || area <= 0) return '请填写正确的建筑面积';
    const valid = this.data.items.filter((it) => String(it.name || '').trim());
    if (valid.length === 0) return '请至少填写一条明细名称';
    const badQty = valid.find((it) => !it.qty || isNaN(Number(it.qty)) || Number(it.qty) <= 0);
    if (badQty) return '「' + (badQty.name || '明细') + '」数量需大于 0';
    const badPrice = valid.find((it) => it.price === '' || isNaN(Number(it.price)) || Number(it.price) < 0);
    if (badPrice) return '「' + (badPrice.name || '明细') + '」单价需为非负数字';
    return '';
  },

  onSubmit() {
    if (this.data.saving) return;
    const err = this.validate();
    if (err) {
      wx.showToast({ title: err, icon: 'none' });
      return;
    }
    const c = this.data.customers[this.data.customerIndex];
    const items = this.data.items
      .filter((it) => String(it.name || '').trim())
      .map((it, i) => ({
        id: it.id || 'qi_' + Date.now().toString(36) + '_' + i,
        category: it.category,
        name: String(it.name).trim(),
        spec: String(it.spec || '').trim(),
        unit: it.unit,
        qty: Number(it.qty) || 0,
        price: Number(it.price) || 0,
        amount: it.amount
      }));

    // 用过滤后的明细重算，避免空明细行进入合计
    const itemsAmount = items.reduce((sum, it) => sum + (it.amount || 0), 0);
    const rate = (Number(this.data.form.manageRate) || 0) / 100;
    const manageFee = Math.round(itemsAmount * rate);
    const designFee = Number(this.data.form.designFee) || 0;
    const discount = Number(this.data.form.discount) || 0;
    const total = itemsAmount + manageFee + designFee - discount;
    if (total < 0) {
      this.setData({ saving: false });
      wx.showToast({ title: '优惠金额不能超过合计', icon: 'none' });
      return;
    }
    const payload = {
      customerId: c.id,
      title: String(this.data.form.title).trim(),
      area: Number(this.data.form.area) || 0,
      projectType: this.data.form.projectType,
      manageRate: (Number(this.data.form.manageRate) || 0) / 100,
      designFee,
      discount,
      items,
      itemsAmount,
      manageFee,
      total
    };

    if (this.data.isEdit) {
      const latest = store.find('quotes', this.data.id);
      if (!latest) {
        wx.showToast({ title: '该报价已被删除', icon: 'none' });
        return;
      }
      if (this.originUpdateTime && latest.updateTime && latest.updateTime !== this.originUpdateTime) {
        wx.showModal({
          title: '报价已被同事修改',
          content: '你打开后，这份报价被其他人改过。继续保存会覆盖对方的改动。',
          confirmText: '仍然保存',
          cancelText: '刷新看看',
          success: (r) => {
            if (r.confirm) this.doSubmit(payload);
            else {
              this.loadQuote(this.data.id);
              this.setData({ saving: false });
            }
          }
        });
        return;
      }
    }
    this.doSubmit(payload);
  },

  /** 实际落库 */
  doSubmit(payload) {
    this.setData({ saving: true });
    if (this.data.isEdit) {
      store.saveQuote(Object.assign({ id: this.data.id }, payload));
    } else {
      store.saveQuote(payload);
    }
    if (wx.disableAlertBeforeUnload) wx.disableAlertBeforeUnload();
    wx.showToast({ title: this.data.isEdit ? '报价已更新' : '报价单已创建', icon: 'success' });
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
