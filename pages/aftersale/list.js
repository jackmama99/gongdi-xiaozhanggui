const store = require('../../data/store');
const F = require('../../utils/format');
const C = require('../../utils/constants');

// 售后状态筛选标签
const STATUS_TABS = ['全部', '待受理', '处理中', '已完成'];

Page({
  data: {
    // 来源项目筛选（从项目详情进入时带 projectId）
    projectId: '',
    projectName: '',
    stat: { total: 0, pending: 0, doing: 0, done: 0 },
    tabs: [],
    activeTab: '全部',
    list: [],
    loading: true,

    // 新建工单弹窗
    popupVisible: false,
    projects: [],
    projectNames: [],
    typeOptions: C.AFTERSALE_TYPE,
    priorityOptions: C.PRIORITY,
    projectIndex: 0,
    typeIndex: 0,
    priorityIndex: 0,
    form: {
      projectId: '',
      customerId: '',
      customerName: '',
      phone: '',
      address: '',
      desc: ''
    }
  },

  onLoad(options) {
    if (!store.guard('aftersale')) return;
    const pid = (options && options.projectId) || '';
    let projectName = '';
    if (pid) {
      const p = store.find('projects', pid);
      projectName = p ? p.name : '';
    }
    this.setData({ projectId: pid, projectName });
    this.load();
  },

  onShow() {
    if (!store.guard('aftersale')) return;
    this.load();
  },

  onPullDownRefresh() {
    this.load();
    wx.stopPullDownRefresh();
  },

  /** 读取数据并渲染列表 */
  load() {
    const all = store.list('aftersales');
    const pid = this.data.projectId;
    const scoped = pid ? all.filter((a) => a.projectId === pid) : all.slice();

    const stat = {
      total: scoped.length,
      pending: scoped.filter((a) => a.status === '待受理').length,
      doing: scoped.filter((a) => a.status === '处理中').length,
      done: scoped.filter((a) => a.status === '已完成').length
    };

    const tabs = STATUS_TABS.map((key) => ({
      key,
      count: key === '全部' ? scoped.length : scoped.filter((a) => a.status === key).length
    }));

    const active = this.data.activeTab;
    const filtered = active === '全部' ? scoped : scoped.filter((a) => a.status === active);

    const list = filtered
      .slice()
      .sort((a, b) => (String(a.createTime || '') < String(b.createTime || '') ? 1 : -1))
      .map((a) => {
        const proj = a.projectId ? store.find('projects', a.projectId) : null;
        const customer = a.customerId ? store.customerOf(a.customerId) : null;
        const records = a.records || [];
        return {
          id: a.id,
          no: a.no,
          type: a.type,
          priority: a.priority || '普通',
          priorityColor: C.PRIORITY_COLOR[a.priority] || 'gray',
          status: a.status,
          statusColor: C.AFTERSALE_STATUS_COLOR[a.status] || 'gray',
          customerName: a.customerName || (customer ? customer.name : '未知客户'),
          phone: a.phone || (customer ? customer.phone : ''),
          projectId: a.projectId || '',
          projectName: proj ? proj.name : '未关联项目',
          desc: a.desc || '（无问题描述）',
          createTimeText: a.createTime ? F.fromNow(a.createTime) : '—',
          createTimeFull: a.createTime ? F.date(a.createTime) : '—',
          handler: a.handler || '待指派',
          recordCount: records.length,
          lastRecord: records.length ? records[records.length - 1].content : '',
          isPending: a.status === '待受理'
        };
      });

    const projects = store.list('projects').map((p) => ({
      id: p.id,
      name: p.name,
      customerId: p.customerId,
      status: p.status
    }));

    this.setData({
      stat,
      tabs,
      list,
      loading: false,
      projects,
      projectNames: projects.map((p) => p.name)
    });
    this.fillProjectIndex(projects);
  },

  /** 按当前 projectId 定位 picker 选中项 */
  fillProjectIndex(projects) {
    const list = projects || this.data.projects;
    const pid = this.data.form.projectId || this.data.projectId;
    let idx = 0;
    if (pid) {
      const found = list.findIndex((p) => p.id === pid);
      if (found > -1) idx = found;
    }
    this.setData({ projectIndex: idx });
  },

  onFilterTap(e) {
    const key = e.currentTarget.dataset.key;
    if (key === this.data.activeTab) return;
    this.setData({ activeTab: key }, () => this.load());
  },

  onCardTap(e) {
    wx.navigateTo({ url: '/pages/aftersale/detail?id=' + e.currentTarget.dataset.id });
  },

  /** 清除项目维度筛选 */
  clearProjectFilter() {
    this.setData({ projectId: '', projectName: '' }, () => this.load());
  },

  goProject() {
    if (!this.data.projectId) return;
    wx.navigateTo({ url: '/pages/project/detail?id=' + this.data.projectId });
  },

  // ---------------- 新建工单 ----------------

  openCreate() {
    const projects = this.data.projects;
    const pid = this.data.projectId || (projects[0] ? projects[0].id : '');
    const p = pid ? store.find('projects', pid) : null;
    const cust = p && p.customerId ? store.customerOf(p.customerId) : null;

    this.setData({
      popupVisible: true,
      typeIndex: 0,
      priorityIndex: 0,
      form: {
        projectId: pid,
        customerId: cust ? cust.id : '',
        customerName: cust ? cust.name : '',
        phone: cust ? cust.phone : '',
        address: p ? p.address : '',
        desc: ''
      }
    });
    this.fillProjectIndex(projects);
  },

  closeCreate() {
    this.setData({ popupVisible: false });
  },

  onProjectChange(e) {
    const idx = Number(e.detail.value) || 0;
    const p = this.data.projects[idx];
    if (!p) return;
    const proj = store.find('projects', p.id);
    const cust = p.customerId ? store.customerOf(p.customerId) : null;
    this.setData({
      projectIndex: idx,
      'form.projectId': p.id,
      'form.customerId': cust ? cust.id : '',
      'form.customerName': cust ? cust.name : this.data.form.customerName,
      'form.phone': cust ? cust.phone : this.data.form.phone,
      'form.address': proj ? proj.address : this.data.form.address
    });
  },

  onTypeChange(e) {
    this.setData({ typeIndex: Number(e.detail.value) || 0 });
  },

  onPriorityChange(e) {
    this.setData({ priorityIndex: Number(e.detail.value) || 0 });
  },

  onNameInput(e) {
    this.setData({ 'form.customerName': e.detail.value });
  },

  onPhoneInput(e) {
    this.setData({ 'form.phone': e.detail.value });
  },

  onAddressInput(e) {
    this.setData({ 'form.address': e.detail.value });
  },

  onDescInput(e) {
    this.setData({ 'form.desc': e.detail.value });
  },

  doCreate() {
    const form = this.data.form;
    const name = String(form.customerName || '').trim();
    const phone = String(form.phone || '').trim();
    const desc = String(form.desc || '').trim();

    if (!form.projectId) {
      wx.showToast({ title: '请选择所属项目', icon: 'none' });
      return;
    }
    if (!name) {
      wx.showToast({ title: '请填写客户姓名', icon: 'none' });
      return;
    }
    if (!/^1\d{10}$/.test(phone)) {
      wx.showToast({ title: '请填写正确的手机号', icon: 'none' });
      return;
    }
    if (!desc) {
      wx.showToast({ title: '请填写问题描述', icon: 'none' });
      return;
    }

    store.addAftersale({
      projectId: form.projectId,
      customerId: form.customerId || '',
      customerName: name,
      phone,
      type: this.data.typeOptions[this.data.typeIndex],
      priority: this.data.priorityOptions[this.data.priorityIndex],
      desc,
      address: String(form.address || '').trim()
    });

    // 若在项目维度下新建了别的项目的工单，自动取消项目筛选，保证新工单可见
    const patch = {
      popupVisible: false,
      form: {
        projectId: '',
        customerId: '',
        customerName: '',
        phone: '',
        address: '',
        desc: ''
      }
    };
    if (this.data.projectId && form.projectId !== this.data.projectId) {
      patch.projectId = '';
      patch.projectName = '';
      patch.activeTab = '全部';
    }
    this.setData(patch);
    wx.showToast({ title: '工单已创建', icon: 'success' });
    this.load();
  }
});
