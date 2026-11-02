const store = require('../../data/store');
const F = require('../../utils/format');
const C = require('../../utils/constants');

Page({
  data: {
    contractInfo: null,
    contracts: [],
    contractIndex: -1,
    plans: [],
    planIndex: -1,
    currentPlan: null,
    amount: '',
    methodList: C.PAY_METHOD,
    methodIndex: 2,
    date: F.today(),
    remark: '',
    canSubmit: false,
    saving: false,
    lockContract: false
  },

  onLoad(options) {
    if (!store.guard('finance')) return;
    this.buildContracts();
    const contractId = (options && options.contractId) || '';
    const projectId = (options && options.projectId) || '';
    const planId = (options && options.planId) || '';

    if (contractId) {
      this.selectContract(contractId, true, planId);
    } else if (projectId) {
      const ct = store.contractOfProject(projectId);
      if (ct) this.selectContract(ct.id, true);
    } else if (this.data.contracts.length === 1) {
      this.selectContract(this.data.contracts[0].value, false);
    }
  },

  /** 构建合同下拉项 */
  buildContracts() {
    const list = store
      .list('contracts')
      .filter((c) => c.status !== '待签约' && c.status !== '已作废')
      .map((c) => {
        const cust = store.customerOf(c.customerId);
        return {
          value: c.id,
          label: (cust ? cust.name : '未知客户') + ' · ' + c.no + ' · ¥' + F.wan(c.amount)
        };
      });
    this.setData({ contracts: list });
  },

  /** 选中合同 */
  selectContract(contractId, lock, preferPlanId) {
    const index = this.data.contracts.findIndex((c) => c.value === contractId);
    if (index < 0) return;
    this.setData({ contractIndex: index, lockContract: !!lock });

    const ct = store.find('contracts', contractId);
    if (!ct) return;
    const cust = store.customerOf(ct.customerId);
    const project = ct.projectId ? store.find('projects', ct.projectId) : null;

    const paid = (ct.payPlan || []).reduce((s, p) => s + (p.paidAmount || 0), 0);
    const remain = Math.max(0, ct.amount - paid);

    const contractInfo = {
      id: ct.id,
      no: ct.no,
      customerName: cust ? cust.name : '未知客户',
      statusText: ct.status,
      statusType: C.CONTRACT_STATUS_COLOR[ct.status] || 'gray',
      projectName: project ? project.name : ct.title,
      phoneText: cust ? F.maskPhone(cust.phone) : '',
      amountText: F.money(ct.amount),
      paidText: F.money(paid),
      remainText: F.money(remain),
      percent: F.percent(paid, ct.amount || 1)
    };

    // 可收期次
    const plans = (ct.payPlan || [])
      .filter((p) => {
        const left = (p.amount || 0) - (p.paidAmount || 0);
        return left > 0 && p.status !== '已收款';
      })
      .map((p) => {
        const left = Math.max(0, p.amount - (p.paidAmount || 0));
        return {
          id: p.id,
          name: p.name,
          label: p.name + ' · 待收 ¥' + F.money(left),
          dueDate: F.date(p.dueDate),
          amount: p.amount,
          paidAmount: p.paidAmount || 0,
          remain: left,
          amountText: F.money(p.amount),
          paidText: F.money(p.paidAmount || 0),
          remainText: F.money(left),
          percent: F.percent(p.paidAmount || 0, p.amount || 1),
          overdue: !!p.dueDate && F.daysFromToday(p.dueDate) < 0
        };
      });

    this.setData({
      contractInfo,
      plans,
      planIndex: -1,
      currentPlan: null,
      amount: ''
    });
    this.updateCanSubmit();

    if (plans.length) {
      // 从某一期点进来时优先选中该期，否则默认第一期
      const idx = preferPlanId ? plans.findIndex((x) => x.id === preferPlanId) : -1;
      this.selectPlan(idx >= 0 ? idx : 0);
    }
  },

  /** 选中期次 */
  selectPlan(index) {
    const plan = this.data.plans[index];
    if (!plan) return;
    this.setData({
      planIndex: index,
      currentPlan: plan,
      amount: String(plan.remain)
    });
    this.updateCanSubmit();
  },

  onContractChange(e) {
    const index = Number(e.detail.value);
    const ct = this.data.contracts[index];
    if (ct) this.selectContract(ct.value, false);
  },

  onPlanChange(e) {
    const index = Number(e.detail.value);
    this.selectPlan(index);
  },

  onAmountInput(e) {
    this.setData({ amount: e.detail.value });
    this.updateCanSubmit();
  },

  /** 一键填入待收全额 */
  fillAll() {
    if (!this.data.currentPlan) return;
    this.setData({ amount: String(this.data.currentPlan.remain) });
    this.updateCanSubmit();
  },

  onMethodChange(e) {
    this.setData({ methodIndex: Number(e.detail.value) });
  },

  onDateChange(e) {
    this.setData({ date: e.detail.value });
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value });
  },

  updateCanSubmit() {
    const amount = Number(this.data.amount);
    const ok = this.data.contractIndex > -1 && this.data.planIndex > -1 && amount > 0;
    this.setData({ canSubmit: ok });
  },

  goContract() {
    const info = this.data.contractInfo;
    if (!info) return;
    wx.navigateTo({ url: '/pages/contract/detail?id=' + info.id });
  },

  onSubmit() {
    if (this.data.saving) return;
    if (!this.data.canSubmit) {
      if (this.data.contractIndex < 0) {
        wx.showToast({ title: '请选择合同', icon: 'none' });
      } else if (this.data.planIndex < 0) {
        wx.showToast({ title: '请选择收款期次', icon: 'none' });
      } else {
        wx.showToast({ title: '请输入正确的金额', icon: 'none' });
      }
      return;
    }

    const ct = this.data.contractInfo;
    const plan = this.data.currentPlan;
    const amount = Number(this.data.amount);

    if (amount > plan.remain + 0.01) {
      wx.showToast({ title: '金额不能超过待收 ' + F.money(plan.remain), icon: 'none' });
      return;
    }

    const contract = store.find('contracts', ct.id);
    this.setData({ saving: true });
    const receipt = store.addReceipt({
      contractId: ct.id,
      projectId: contract ? contract.projectId : '',
      customerId: contract ? contract.customerId : '',
      planId: plan.id,
      amount,
      method: this.data.methodList[this.data.methodIndex],
      date: this.data.date,
      remark: this.data.remark || plan.name
    });

    if (!receipt) {
      this.setData({ saving: false });
      wx.showToast({ title: '登记失败，请刷新后重试', icon: 'none' });
      return;
    }

    wx.showToast({ title: '收款登记成功', icon: 'success' });
    setTimeout(() => {
      wx.navigateBack({ fail() { wx.switchTab({ url: '/pages/finance/index' }); } });
    }, 700);
  }
});
