const store = require('../../data/store');
const F = require('../../utils/format');
const C = require('../../utils/constants');

Page({
  data: {
    user: {},
    roleLine: '',
    team: {},
    today: '',
    greeting: '',
    stats: {},
    statCards: [],
    todoList: [],
    todoCount: 0,
    runningProjects: [],
    alerts: [],
    quickEntries: [],
    todayTasks: [],
    todayTaskCount: 0,
    // 逾期收款提醒
    overdueList: []
  },

  onLoad() {
    const user = store.getCurrentUser();
    const hour = new Date().getHours();
    let greeting = '上午好';
    if (hour < 6) greeting = '凌晨好';
    else if (hour < 12) greeting = '上午好';
    else if (hour < 14) greeting = '中午好';
    else if (hour < 18) greeting = '下午好';
    else greeting = '晚上好';

    const now = new Date();
    const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()];

    this.setData({
      user: user || {},
      roleLine: user ? (user.dept ? user.role + ' · ' + user.dept : user.role || '') : '',
      team: store.currentTeam() || {},
      greeting,
      today: F.today() + ' ' + week
    });

    this.buildQuickEntries();
    this.refresh();
  },

  onShow() {
    if (!getApp().requireLogin()) return;
    // 从其它页面返回时刷新数据（tabBar 页不会重复 onLoad）
    if (this.data.user && this.data.user.id) {
      this.refresh();
    }
  },

  onPullDownRefresh() {
    this.refresh();
    wx.stopPullDownRefresh();
    wx.showToast({ title: '已刷新', icon: 'none' });
  },

  buildQuickEntries() {
    // 每个入口声明所属模块，按当前角色过滤
    const raw = [
      { icon: '👥', name: '客户管理', desc: '线索跟进', url: '/pages/customer/list', tab: true, color: '#e8f0f8' },
      { icon: '🏗', name: '项目工地', desc: '进度管控', url: '/pages/project/list', tab: true, color: '#edf1f3' },
      { icon: '📐', name: '报价预算', desc: '预算编制', url: '/pages/quote/list', color: '#fff0e3' },
      { icon: '🧾', name: '合同管理', desc: '签约收款', url: '/pages/contract/list', color: '#fbe9e7' },
      { icon: '✅', name: '待办审批', desc: '事项处理', url: '/pages/todo/index', color: '#e8f0f8' },
      { icon: '💳', name: '收款登记', desc: '回款登记', url: '/pages/finance/receipt', color: '#edf1f3' },
      { icon: '🚚', name: '材料采购', desc: '采购进度', url: '/pages/material/list', color: '#fff0e3' },
      { icon: '🛠', name: '售后维保', desc: '工单处理', url: '/pages/aftersale/list', color: '#fbe9e7' },
      { icon: '📊', name: '经营报表', desc: '数据分析', url: '/pages/report/index', color: '#e8f0f8' }
    ];
    const MODULE = {
      客户管理: 'customer', 项目工地: 'project', 报价预算: 'quote',
      合同管理: 'contract', 待办审批: 'todo', 收款登记: 'finance',
      材料采购: 'material', 售后维保: 'aftersale', 经营报表: 'report'
    };
    const entries = raw.filter((e) => {
      const m = MODULE[e.name];
      return !m || store.can(m);
    });
    this.setData({ quickEntries: entries });
  },

  refresh() {
    const stats = store.dashboardStats();
    // 财务流水对非财务角色不下发，指标也就不该展示（否则永远显示 0）
    const canFinance = store.can('finance');
    const cardList = [
      { label: '在建工地', value: String(stats.runningCount), suffix: '个', sub: '共 ' + stats.totalCount + ' 个项目' },
      canFinance
        ? { label: '本月回款', value: F.wan(stats.monthReceipt), suffix: '', sub: '本月支出 ' + F.wan(stats.monthExpense) }
        : { label: '待办事项', value: String(stats.todoCount), suffix: '项', sub: stats.todoCount > 0 ? '请及时处理' : '暂无待办' },
      { label: '待收款项', value: F.wan(stats.receivable), suffix: '', sub: stats.overdueReceivable > 0 ? '逾期 ' + F.wan(stats.overdueReceivable) : '暂无逾期' },
      { label: '平均进度', value: String(stats.avgProgress), suffix: '%', sub: stats.overdueNodes > 0 ? stats.overdueNodes + ' 个节点逾期' : '工期正常' }
    ];

    // 待办（最多 4 条）
    const todos = store.todosPending().slice(0, 4).map((t) => {
      const colorMap = { 特急: 'red', 紧急: 'orange', 普通: 'gray' };
      return {
        id: t.id,
        type: t.type,
        title: t.title,
        desc: t.desc,
        level: t.level,
        levelColor: colorMap[t.level] || 'gray',
        time: F.fromNow(t.createTime)
      };
    });

    // 在建项目（最多 3 个）
    const running = store
      .projectCards((p) => p.status === '施工中')
      .map((p) => ({
        id: p.id,
        name: p.name,
        address: p.address,
        progress: p.progress,
        currentStage: p.currentStage,
        doneNodes: p.doneNodes,
        totalNodes: p.totalNodes,
        overdueNodes: p.overdueNodes,
        daysLeft: p.daysLeft,
        daysLeftText: p.daysLeft >= 0 ? '剩余 ' + p.daysLeft + ' 天' : '已逾期 ' + Math.abs(p.daysLeft) + ' 天',
        danger: p.daysLeft < 0 || p.overdueNodes > 0,
        managerName: p.managerName,
        contractWan: p.contractWan
      }))
      .slice(0, 3);

    // 风险提醒：逾期节点 + 逾期收款
    const alerts = [];
    store.list('projects').forEach((p) => {
      const overdue = (p.nodes || []).filter((n) => n.status !== '已完成' && n.planEnd && F.daysFromToday(n.planEnd) < 0);
      if (overdue.length) {
        alerts.push({
          id: 'a_' + p.id,
          icon: '⚠️',
          text: p.name + ' 有 ' + overdue.length + ' 个节点逾期',
          sub: overdue[0].name + ' 计划 ' + F.md(overdue[0].planEnd) + ' 完成',
          url: '/pages/project/node?id=' + p.id,
          type: 'danger'
        });
      }
    });
    // 逾期未收
    store.list('contracts').forEach((ct) => {
      (ct.payPlan || []).forEach((pp) => {
        if (pp.status !== '已收款' && pp.dueDate && F.daysFromToday(pp.dueDate) < 0) {
          const cust = store.customerOf(ct.customerId);
          alerts.push({
            id: 'a_' + ct.id + '_' + pp.id,
            icon: '💰',
            text: (cust ? cust.name : '客户') + ' ' + pp.name + ' 已逾期 ' + Math.abs(F.daysFromToday(pp.dueDate)) + ' 天',
            sub: '待收 ' + F.money(pp.amount - (pp.paidAmount || 0)) + ' 元 · ' + ct.no,
            url: '/pages/contract/detail?id=' + ct.id,
            type: 'warning'
          });
        }
      });
    });

    // 今日施工：将未完成且正在进行、今天到期或已逾期的节点压缩成现场任务清单。
    const today = F.today();
    const todayTasks = [];
    store.list('projects').forEach((p) => {
      (p.nodes || []).forEach((n) => {
        if (n.status === '已完成') return;
        const start = n.planStart || '';
        const end = n.planEnd || '';
        const overdueDays = end ? F.daysFromToday(end) : 0;
        const activeToday = n.status === '进行中' || overdueDays < 0 || (start && start <= today && (!end || end >= today));
        if (!activeToday) return;
        todayTasks.push({
          id: p.id + '_' + n.id,
          projectId: p.id,
          name: n.name,
          projectName: p.name,
          owner: n.owner || '未指派',
          statusText: overdueDays < 0 ? '已逾期 ' + Math.abs(overdueDays) + ' 天' : (n.status === '进行中' ? '进行中' : '今日待办'),
          danger: overdueDays < 0
        });
      });
    });
    todayTasks.sort((a, b) => Number(b.danger) - Number(a.danger));

    this.setData({
      stats,
      statCards: cardList,
      todoList: todos,
      todoCount: stats.todoCount,
      runningProjects: running,
      alerts: alerts.slice(0, 3),
      todayTasks: todayTasks.slice(0, 5),
      todayTaskCount: todayTasks.length
    });
  },

  goTodo() {
    wx.navigateTo({ url: '/pages/todo/index' });
  },

  goProject(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/project/detail?id=' + id });
  },

  goNode(e) {
    const projectId = e.currentTarget.dataset.projectId;
    wx.navigateTo({ url: '/pages/project/node?id=' + projectId });
  },

  goProjectAll() {
    wx.switchTab({ url: '/pages/project/list' });
  },

  goAlert(e) {
    const url = e.currentTarget.dataset.url;
    wx.navigateTo({ url });
  },

  goQuick(e) {
    const item = e.currentTarget.dataset.item;
    if (item.tab) {
      wx.switchTab({ url: item.url });
    } else {
      wx.navigateTo({ url: item.url });
    }
  },

  onShareAppMessage() {
    return { title: '工地小掌柜 · 装修企业管理', path: '/pages/workbench/index' };
  }
});
