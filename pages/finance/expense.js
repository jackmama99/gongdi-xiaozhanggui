const store = require('../../data/store');
const F = require('../../utils/format');
const C = require('../../utils/constants');

Page({
  data: {
    budgetInfo: null,
    projects: [],
    projectIndex: -1,
    categoryList: C.EXPENSE_CATEGORY,
    categoryIndex: 0,
    amount: '',
    supplier: '',
    date: F.today(),
    remark: '',
    canSubmit: false,
    listTitle: '最近支出',
    listHint: '',
    expenseList: []
  },

  onLoad(options) {
    if (!store.guard('finance')) return;
    this.buildProjects();
    const projectId = (options && options.projectId) || '';
    if (projectId) {
      const idx = this.data.projects.findIndex((p) => p.value === projectId);
      if (idx > -1) this.selectProject(idx);
    } else if (this.data.projects.length) {
      this.selectProject(0);
    } else {
      this.loadList('');
    }
  },

  onShow() {
    // 返回时刷新列表（可能有新增支出）
    this.loadList(this.currentProjectId || '');
  },

  buildProjects() {
    const list = store.list('projects').map((p) => {
      const cust = store.customerOf(p.customerId);
      return {
        value: p.id,
        label: p.name + (cust ? ' · ' + cust.name : '')
      };
    });
    list.push({ value: '', label: '不关联项目（公司费用）' });
    this.setData({ projects: list });
  },

  selectProject(index) {
    const p = this.data.projects[index];
    if (!p) return;
    this.currentProjectId = p.value;
    this.setData({ projectIndex: index });

    const project = store.find('projects', p.value);
    let budgetInfo = null;
    if (project) {
      const budget = project.budget || 0;
      const cost = project.cost || 0;
      const percent = F.percent(cost, budget || 1);
      const over = cost > budget && budget > 0;
      budgetInfo = {
        id: project.id,
        name: project.name,
        no: project.no,
        status: project.status,
        statusType: C.PROJECT_STATUS_COLOR[project.status] || 'gray',
        percent,
        over,
        barType: over ? 'danger' : percent > 80 ? 'warning' : '',
        budgetText: F.money(budget),
        costText: F.money(cost),
        remainText: F.money(Math.abs(budget - cost))
      };
    }

    this.setData({ budgetInfo });
    this.loadList(p.value);
    this.updateCanSubmit();
  },

  loadList(projectId) {
    let raw;
    if (projectId) {
      raw = store.expensesOfProject(projectId);
      this.setData({ listTitle: '该项目支出记录', listHint: '共 ' + raw.length + ' 条' });
    } else {
      raw = store.list('expenses').slice(0, 20);
      this.setData({ listTitle: '最近支出', listHint: '全部项目' });
    }

    const expenseList = raw.map((e) => ({
      id: e.id,
      category: e.category,
      status: e.status,
      statusType: C.EXPENSE_STATUS_COLOR[e.status] || 'gray',
      supplier: e.supplier || '未填写',
      applicant: e.applicant || '—',
      dateText: F.date(e.date),
      remark: e.remark || '',
      amountText: F.money(e.amount)
    }));

    this.setData({ expenseList });
  },

  onProjectChange(e) {
    this.selectProject(Number(e.detail.value));
  },

  onCategoryChange(e) {
    this.setData({ categoryIndex: Number(e.detail.value) });
  },

  onAmountInput(e) {
    this.setData({ amount: e.detail.value });
    this.updateCanSubmit();
  },

  onSupplierInput(e) {
    this.setData({ supplier: e.detail.value });
  },

  onDateChange(e) {
    this.setData({ date: e.detail.value });
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value });
  },

  updateCanSubmit() {
    this.setData({
      canSubmit: this.data.projectIndex > -1 && Number(this.data.amount) > 0
    });
  },

  goProject() {
    const info = this.data.budgetInfo;
    if (!info) return;
    wx.navigateTo({ url: '/pages/project/detail?id=' + info.id });
  },

  onSubmit() {
    const proj = this.data.projects[this.data.projectIndex];
    if (!proj) {
      wx.showToast({ title: '请选择所属项目或公司费用', icon: 'none' });
      return;
    }
    const amount = Number(this.data.amount);
    if (!(amount > 0)) {
      wx.showToast({ title: '请输入正确的金额', icon: 'none' });
      return;
    }

    store.addExpense({
      projectId: proj.value,
      category: this.data.categoryList[this.data.categoryIndex],
      amount,
      supplier: this.data.supplier,
      date: this.data.date,
      remark: this.data.remark
    });

    wx.showToast({ title: '已提交审批', icon: 'success' });
    this.setData({ amount: '', supplier: '', remark: '' });
    this.updateCanSubmit();
    this.reloadProject();
  },

  reloadProject() {
    // 重新计算预算卡与列表
    this.selectProject(this.data.projectIndex);
  },

  onPullDownRefresh() {
    this.selectProject(this.data.projectIndex);
    wx.stopPullDownRefresh();
  }
});
