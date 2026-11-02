/**
 * 演示种子数据
 * 说明：全部为演示用假数据，不涉及真实客户信息。
 * 日期基于「今天」动态生成，保证任何时候打开都有合理的进行中/逾期状态。
 */
const F = require('../utils/format');
const C = require('../utils/constants');

const TODAY = F.today();
const d = (n) => F.dayOffset(n);
const t = (n, hm) => F.dayOffset(n) + ' ' + (hm || '10:00');

// ---------------- 公司 / 人员 ----------------
const company = {
  id: 'co_1',
  name: '杭州整装家居设计工程有限公司',
  shortName: '整装家居',
  logo: '',
  address: '杭州市西湖区文三路 478 号华星时代广场 A 座 12F',
  phone: '0571-8888 6666'
};

const users = [
  { id: 'u_1', name: '周文斌', role: '总经理', dept: '总经办', phone: '13900001111', avatar: '', account: 'admin', password: '123456' },
  { id: 'u_2', name: '陈国栋', role: '项目经理', dept: '工程部', phone: '13900002222', avatar: '', account: 'chen', password: '123456' },
  { id: 'u_3', name: '林思雨', role: '设计师', dept: '设计部', phone: '13900003333', avatar: '', account: 'lin', password: '123456' },
  { id: 'u_4', name: '吴晓静', role: '财务', dept: '财务部', phone: '13900004444', avatar: '', account: 'wu', password: '123456' },
  { id: 'u_5', name: '马克明', role: '销售', dept: '市场部', phone: '13900005555', avatar: '', account: 'ma', password: '123456' },
  { id: 'u_6', name: '黄志强', role: '监理', dept: '工程部', phone: '13900006666', avatar: '', account: 'huang', password: '123456' }
];

// ---------------- 客户 ----------------
const customers = [
  {
    id: 'c_1', no: 'KH2026001', name: '张明远', phone: '13812345678', gender: '男',
    source: '抖音/小红书', status: '已签约', level: 'A',
    house: '滨江壹号院 3-1802', area: 126, houseType: '平层', style: '现代简约',
    budget: 320000, intention: '全包，注重收纳和儿童房环保材料',
    ownerId: 'u_5', ownerName: '马克明', createTime: t(-68, '09:12'),
    lastFollow: t(-1, '16:40'), nextFollow: d(2), tags: ['高意向', '有小孩', '预算充足']
  },
  {
    id: 'c_2', no: 'KH2026002', name: '王浩然', phone: '13955556666', gender: '男',
    source: '老客转介绍', status: '已签约', level: 'A',
    house: '翡翠城 12-2-2601', area: 158, houseType: '平层', style: '新中式',
    budget: 450000, intention: '三代同住，需要独立书房和茶室',
    ownerId: 'u_5', ownerName: '马克明', createTime: t(-95, '14:20'),
    lastFollow: t(-3, '11:00'), nextFollow: d(5), tags: ['大平层', '转介绍']
  },
  {
    id: 'c_3', no: 'KH2026003', name: '陈静怡', phone: '13677778888', gender: '女',
    source: '门店到访', status: '已报价', level: 'B',
    house: '湖畔花园 8-1101', area: 98, houseType: '平层', style: '奶油风',
    budget: 220000, intention: '婚房，喜欢奶油风，工期要快',
    ownerId: 'u_5', ownerName: '马克明', createTime: t(-32, '10:05'),
    lastFollow: t(-2, '15:30'), nextFollow: d(1), tags: ['婚房', '着急入住']
  },
  {
    id: 'c_4', no: 'KH2026004', name: '刘建国', phone: '13722223333', gender: '男',
    source: '楼盘拓展', status: '已签约', level: 'B',
    house: '金色海岸 5-901', area: 142, houseType: '平层', style: '轻奢',
    budget: 380000, intention: '改善型住房，重钢结构改造',
    ownerId: 'u_5', ownerName: '马克明', createTime: t(-140, '09:30'),
    lastFollow: t(-10, '10:20'), nextFollow: '', tags: ['已完工']
  },
  {
    id: 'c_5', no: 'KH2026005', name: '赵敏', phone: '13844445555', gender: '女',
    source: '装修平台', status: '已签约', level: 'A',
    house: '云栖玫瑰园 7-1-302', area: 210, houseType: '复式', style: '日式',
    budget: 680000, intention: '复式楼，全屋定制柜体要求高',
    ownerId: 'u_5', ownerName: '马克明', createTime: t(-48, '13:45'),
    lastFollow: t(-1, '09:15'), nextFollow: d(3), tags: ['复式', '高客单']
  },
  {
    id: 'c_6', no: 'KH2026006', name: '孙立', phone: '13966667777', gender: '男',
    source: '电话咨询', status: '已签约', level: 'B',
    house: '钱塘印象 2-1502', area: 115, houseType: '平层', style: '北欧',
    budget: 260000, intention: '二手房翻新',
    ownerId: 'u_5', ownerName: '马克明', createTime: t(-190, '11:10'),
    lastFollow: t(-30, '14:00'), nextFollow: '', tags: ['已结算']
  },
  {
    id: 'c_7', no: 'KH2026007', name: '周雅琴', phone: '13533334444', gender: '女',
    source: '老客转介绍', status: '已量房', level: 'A',
    house: '望江府 9-2201', area: 135, houseType: '平层', style: '原木风',
    budget: 360000, intention: '两口之家，注重厨房和阳台改造',
    ownerId: 'u_3', ownerName: '林思雨', createTime: t(-12, '16:20'),
    lastFollow: t(-1, '18:05'), nextFollow: d(2), tags: ['已量房', '设计需求明确']
  },
  {
    id: 'c_8', no: 'KH2026008', name: '郑海涛', phone: '13711112222', gender: '男',
    source: '抖音/小红书', status: '跟进中', level: 'B',
    house: '西溪蝶园 4-603', area: 105, houseType: '平层', style: '现代简约',
    budget: 240000, intention: '首次装修，预算敏感',
    ownerId: 'u_3', ownerName: '林思雨', createTime: t(-9, '20:30'),
    lastFollow: t(-2, '19:10'), nextFollow: d(1), tags: ['预算敏感']
  },
  {
    id: 'c_9', no: 'KH2026009', name: '何梦洁', phone: '13899990000', gender: '女',
    source: '门店到访', status: '新线索', level: 'C',
    house: '滨江金茂府 1-802', area: 89, houseType: '平层', style: '轻奢',
    budget: 180000, intention: '刚交房，还在对比装修公司',
    ownerId: 'u_5', ownerName: '马克明', createTime: t(-2, '11:45'),
    lastFollow: t(-2, '11:45'), nextFollow: d(0), tags: ['新交房']
  },
  {
    id: 'c_10', no: 'KH2026010', name: '马文杰', phone: '13655554444', gender: '男',
    source: '装修平台', status: '已流失', level: 'D',
    house: '江南星座 3-705', area: 76, houseType: '平层', style: '北欧',
    budget: 150000, intention: '选择了报价更低的公司',
    ownerId: 'u_5', ownerName: '马克明', createTime: t(-60, '15:00'),
    lastFollow: t(-40, '10:30'), nextFollow: '', tags: ['价格流失']
  }
];

// ---------------- 跟进记录 ----------------
const follows = [
  { id: 'f_1', customerId: 'c_1', type: '微信', content: '发送了主材清单和报价单，客户确认瓷砖品牌', result: '已确认', ownerId: 'u_5', ownerName: '马克明', time: t(-1, '16:40') },
  { id: 'f_2', customerId: 'c_1', type: '量房', content: '现场量房，记录承重墙位置，拍摄管道井照片', result: '已量房', ownerId: 'u_3', ownerName: '林思雨', time: t(-20, '10:00') },
  { id: 'f_3', customerId: 'c_2', type: '电话', content: '沟通施工进度，客户希望提前一周完工', result: '需协调', ownerId: 'u_5', ownerName: '马克明', time: t(-3, '11:00') },
  { id: 'f_4', customerId: 'c_3', type: '方案沟通', content: '确认奶油风方案第二稿，微调餐边柜尺寸', result: '待确认', ownerId: 'u_3', ownerName: '林思雨', time: t(-2, '15:30') },
  { id: 'f_5', customerId: 'c_7', type: '量房', content: '完成量房，采集 3D 数据，客户偏好原木+微水泥', result: '待出方案', ownerId: 'u_3', ownerName: '林思雨', time: t(-1, '18:05') },
  { id: 'f_6', customerId: 'c_8', type: '微信', content: '发送三套风格案例，客户倾向现代简约', result: '继续跟进', ownerId: 'u_3', ownerName: '林思雨', time: t(-2, '19:10') },
  { id: 'f_7', customerId: 'c_9', type: '电话', content: '首次电话沟通，客户刚交房，约本周末到店', result: '已约到店', ownerId: 'u_5', ownerName: '马克明', time: t(-2, '11:45') }
];

// ---------------- 报价单 ----------------
function quoteItems(list) {
  return list.map((x, i) => ({
    id: 'qi_' + i,
    category: x[0],
    name: x[1],
    spec: x[2],
    unit: x[3],
    qty: x[4],
    price: x[5],
    amount: Math.round(x[4] * x[5])
  }));
}

function calcQuote(items, manageRate, designFee, discount) {
  const itemsAmount = items.reduce((s, x) => s + x.amount, 0);
  const manageFee = Math.round(itemsAmount * manageRate);
  const total = itemsAmount + manageFee + (designFee || 0) - (discount || 0);
  return { itemsAmount, manageFee, total };
}

const quoteDefs = [
  {
    id: 'q_1', no: 'BJ2026001', customerId: 'c_1', projectId: 'p_1',
    title: '张明远 · 滨江壹号院 126㎡ 全包报价', area: 126, projectType: '全包',
    manageRate: 0.08, designFee: 12000, discount: 3000, status: '已确认',
    createTime: t(-58, '10:00'), creator: '林思雨',
    items: quoteItems([
      ['基础工程', '墙面铲除及找平', '腻子两遍+打磨', '㎡', 320, 28],
      ['水电工程', '水路改造', 'PPR 管 25mm', 'm', 145, 68],
      ['水电工程', '电路改造', '2.5/4 平方铜芯线', 'm', 620, 42],
      ['泥瓦工程', '墙地砖铺贴', '人工+辅料', '㎡', 168, 78],
      ['泥瓦工程', '防水工程', '东方雨虹 两遍', '㎡', 46, 96],
      ['木工工程', '客餐厅吊顶', '轻钢龙骨石膏板', '㎡', 52, 145],
      ['油漆工程', '乳胶漆涂刷', '立邦净味 120', '㎡', 320, 32],
      ['主材', '瓷砖', '马可波罗 750×1500', '㎡', 168, 158],
      ['主材', '木门', 'TATA 静音门', '套', 6, 2380],
      ['主材', '橱柜', '欧派 爱家板', 'm', 6.5, 3200],
      ['安装', '卫浴安装', '含五金辅料', '项', 2, 1200]
    ])
  },
  {
    id: 'q_2', no: 'BJ2026002', customerId: 'c_2', projectId: 'p_2',
    title: '王浩然 · 翡翠城 158㎡ 整装报价', area: 158, projectType: '整装',
    manageRate: 0.08, designFee: 18000, discount: 5000, status: '已确认',
    createTime: t(-88, '14:00'), creator: '林思雨',
    items: quoteItems([
      ['基础工程', '拆除及垃圾清运', '含外运', '项', 1, 6800],
      ['水电工程', '水电全改', '含开槽布管', '㎡', 158, 185],
      ['泥瓦工程', '瓷砖铺贴', '人工+辅料', '㎡', 210, 82],
      ['木工工程', '全屋吊顶', '含灯槽', '㎡', 88, 152],
      ['木工工程', '定制柜体', '多层实木', '㎡', 46, 980],
      ['油漆工程', '乳胶漆', '芬琳诺娃', '㎡', 420, 38],
      ['主材', '地板', '大自然 实木复合', '㎡', 62, 268],
      ['主材', '中央空调', '大金 一拖五', '套', 1, 46800],
      ['主材', '全屋定制', '含衣柜/书柜/榻榻米', '项', 1, 68000],
      ['安装', '灯具洁具安装', '含辅料', '项', 1, 3600]
    ])
  },
  {
    id: 'q_3', no: 'BJ2026003', customerId: 'c_3', projectId: '',
    title: '陈静怡 · 湖畔花园 98㎡ 全包报价', area: 98, projectType: '全包',
    manageRate: 0.08, designFee: 8000, discount: 2000, status: '待客户确认',
    createTime: t(-6, '16:00'), creator: '林思雨',
    items: quoteItems([
      ['基础工程', '墙面处理', '铲墙+找平', '㎡', 260, 26],
      ['水电工程', '水电改造', '局部改造', '㎡', 98, 165],
      ['泥瓦工程', '厨卫瓷砖', '人工+辅料', '㎡', 86, 78],
      ['木工工程', '简单吊顶', '局部', '㎡', 32, 140],
      ['油漆工程', '乳胶漆', '立邦净味', '㎡', 260, 30],
      ['主材', '瓷砖', '东鹏 600×1200', '㎡', 86, 128],
      ['主材', '橱柜', '志邦', 'm', 5.2, 2800],
      ['安装', '基础安装', '含五金', '项', 1, 2800]
    ])
  },
  {
    id: 'q_4', no: 'BJ2026004', customerId: 'c_5', projectId: 'p_5',
    title: '赵敏 · 云栖玫瑰园 210㎡ 复式整装', area: 210, projectType: '整装',
    manageRate: 0.08, designFee: 28000, discount: 8000, status: '待内部审批',
    createTime: t(-4, '11:30'), creator: '林思雨',
    items: quoteItems([
      ['基础工程', '拆除清运', '含外运', '项', 1, 9600],
      ['水电工程', '水电全改', '含开槽布管', '㎡', 210, 195],
      ['泥瓦工程', '瓷砖铺贴', '人工+辅料', '㎡', 280, 85],
      ['木工工程', '全屋吊顶', '含造型', '㎡', 130, 168],
      ['木工工程', '楼梯改造', '钢结构+包板', '项', 1, 32000],
      ['油漆工程', '艺术漆', '微水泥效果', '㎡', 380, 88],
      ['主材', '全屋定制', '进口板材', '项', 1, 128000],
      ['主材', '中央空调+新风', '大金+松下', '套', 1, 86000],
      ['安装', '灯具洁具安装', '含辅料', '项', 1, 5200]
    ])
  }
];

const quotes = quoteDefs.map((q) => {
  const r = calcQuote(q.items, q.manageRate, q.designFee, q.discount);
  return Object.assign({}, q, {
    itemsAmount: r.itemsAmount,
    manageFee: r.manageFee,
    total: r.total
  });
});

// ---------------- 合同 ----------------
function payPlan(total, defs) {
  return defs.map((x, i) => ({
    id: 'pp_' + i,
    name: x[0],
    ratio: x[1],
    amount: Math.round(total * x[1]),
    dueDate: x[2],
    status: x[3] || '未收款',
    paidAmount: x[4] || 0,
    paidDate: x[5] || ''
  }));
}

const contracts = [
  {
    id: 'ct_1', no: 'HT2026001', customerId: 'c_1', projectId: 'p_1', quoteId: 'q_1',
    title: '滨江壹号院 3-1802 全包施工合同', amount: 412600,
    signDate: d(-56), startDate: d(-50), planEndDate: d(40), status: '履行中',
    payMode: '按进度分期', creator: '马克明',
    remark: '含主材，不含家电软装。增项需客户签字确认。',
    payPlan: payPlan(412600, [
      ['合同签订首付款', 0.3, d(-56), '已收款', Math.round(412600 * 0.3), d(-56)],
      ['水电验收款', 0.3, d(-32), '已收款', Math.round(412600 * 0.3), d(-30)],
      ['泥木验收款', 0.3, d(12), '未收款', 0, ''],
      ['竣工尾款', 0.1, d(40), '未收款', 0, '']
    ])
  },
  {
    id: 'ct_2', no: 'HT2026002', customerId: 'c_2', projectId: 'p_2', quoteId: 'q_2',
    title: '翡翠城 12-2-2601 整装施工合同', amount: 586000,
    signDate: d(-86), startDate: d(-80), planEndDate: d(12), status: '履行中',
    payMode: '按进度分期', creator: '马克明',
    remark: '含中央空调与全屋定制，工期 6 个月。',
    payPlan: payPlan(586000, [
      ['合同签订首付款', 0.3, d(-86), '已收款', Math.round(586000 * 0.3), d(-86)],
      ['水电验收款', 0.3, d(-56), '已收款', Math.round(586000 * 0.3), d(-55)],
      ['泥木验收款', 0.3, d(-14), '部分收款', 80000, d(-12)],
      ['竣工尾款', 0.1, d(12), '未收款', 0, '']
    ])
  },
  {
    id: 'ct_3', no: 'HT2026003', customerId: 'c_5', projectId: 'p_5', quoteId: 'q_4',
    title: '云栖玫瑰园 7-1-302 复式工程合同', amount: 892000,
    signDate: d(-46), startDate: d(-44), planEndDate: d(86), status: '履行中',
    payMode: '按进度分期', creator: '马克明',
    remark: '含楼梯钢结构改造，需物业报备。',
    payPlan: payPlan(892000, [
      ['合同签订首付款', 0.3, d(-46), '已收款', Math.round(892000 * 0.3), d(-46)],
      ['水电验收款', 0.3, d(-12), '未收款', 0, ''],
      ['泥木验收款', 0.3, d(40), '未收款', 0, ''],
      ['竣工尾款', 0.1, d(86), '未收款', 0, '']
    ])
  },
  {
    id: 'ct_4', no: 'HT2026004', customerId: 'c_4', projectId: 'p_4', quoteId: '',
    title: '金色海岸 5-901 全包施工合同', amount: 386000,
    signDate: d(-138), startDate: d(-132), planEndDate: d(-20), status: '已完成',
    payMode: '按进度分期', creator: '马克明',
    remark: '',
    payPlan: payPlan(386000, [
      ['首付款', 0.3, d(-138), '已收款', Math.round(386000 * 0.3), d(-138)],
      ['水电验收款', 0.3, d(-110), '已收款', Math.round(386000 * 0.3), d(-108)],
      ['泥木验收款', 0.3, d(-60), '已收款', Math.round(386000 * 0.3), d(-58)],
      ['竣工尾款', 0.1, d(-20), '已收款', Math.round(386000 * 0.1), d(-18)]
    ])
  },
  {
    id: 'ct_5', no: 'HT2026005', customerId: 'c_6', projectId: 'p_6', quoteId: '',
    title: '钱塘印象 2-1502 全包施工合同', amount: 268000,
    signDate: d(-188), startDate: d(-180), planEndDate: d(-30), status: '已完成',
    payMode: '按进度分期', creator: '马克明',
    remark: '',
    payPlan: payPlan(268000, [
      ['首付款', 0.3, d(-188), '已收款', Math.round(268000 * 0.3), d(-188)],
      ['水电验收款', 0.3, d(-160), '已收款', Math.round(268000 * 0.3), d(-158)],
      ['泥木验收款', 0.3, d(-90), '已收款', Math.round(268000 * 0.3), d(-88)],
      ['竣工尾款', 0.1, d(-30), '已收款', Math.round(268000 * 0.1), d(-28)]
    ])
  },
  {
    id: 'ct_6', no: 'HT2026006', customerId: 'c_3', projectId: '', quoteId: 'q_3',
    title: '湖畔花园 8-1101 全包施工合同（待签）', amount: 236000,
    signDate: '', startDate: d(3), planEndDate: d(93), status: '待签约',
    payMode: '按进度分期', creator: '马克明',
    remark: '客户本周内到店签约。',
    payPlan: payPlan(236000, [
      ['合同签订首付款', 0.3, d(3), '未收款', 0, ''],
      ['水电验收款', 0.3, d(25), '未收款', 0, ''],
      ['泥木验收款', 0.3, d(60), '未收款', 0, ''],
      ['竣工尾款', 0.1, d(93), '未收款', 0, '']
    ])
  }
];

// ---------------- 项目与施工节点 ----------------
function buildNodes(projectId, startDate, weights, doneCount) {
  const totalWeight = weights.reduce((a, b) => a + b.weight, 0);
  let cursor = new Date(String(startDate).replace(/-/g, '/'));
  return weights.map((w, i) => {
    const ps = F.date(cursor);
    cursor.setDate(cursor.getDate() + w.days);
    const pe = F.date(cursor);
    let status = '未开始';
    let actualStart = '';
    let actualEnd = '';
    if (i < doneCount) {
      status = '已完成';
      actualStart = ps;
      actualEnd = pe;
    } else if (i === doneCount) {
      status = '进行中';
      actualStart = ps;
    } else if (F.diffDays(TODAY, ps) < 0) {
      status = '已逾期';
    }
    return {
      id: 'n_' + projectId + '_' + (i + 1),
      projectId,
      seq: i + 1,
      name: w.name,
      category: w.category,
      weight: Math.round((w.weight / totalWeight) * 1000) / 10,
      status,
      planStart: ps,
      planEnd: pe,
      actualStart,
      actualEnd,
      owner: '',
      remark: '',
      images: []
    };
  });
}

// 每个项目的节点权重不同，直接复用标准模板，调整个别时长
function nodeWeights(scale) {
  return C.NODE_TEMPLATE.map((n) => ({ ...n, days: Math.max(1, Math.round(n.days * (scale || 1))) }));
}

function sumProgress(nodes) {
  const done = nodes.filter((n) => n.status === '已完成').reduce((s, n) => s + n.weight, 0);
  const running = nodes.filter((n) => n.status === '进行中').reduce((s, n) => s + n.weight * 0.5, 0);
  return Math.round(done + running);
}

function projectSummary(project) {
  const nodes = project.nodes || [];
  const done = nodes.filter((n) => n.status === '已完成').length;
  // 逾期按计划完工日动态判定，不再依赖一个没人写入的状态值
  const overdue = nodes.filter((n) => n.status !== '已完成' && n.planEnd && F.daysFromToday(n.planEnd) < 0).length;
  const current = nodes.find((n) => n.status === '进行中') || nodes.find((n) => n.status === '未开始') || nodes[done - 1] || nodes[0];
  return {
    doneNodes: done,
    totalNodes: nodes.length,
    overdueNodes: overdue,
    currentStage: current ? current.name : '—',
    progress: sumProgress(nodes),
    daysLeft: project.planEndDate ? F.diffDays(TODAY, project.planEndDate) : 0
  };
}

const projectDefs = [
  {
    id: 'p_1', no: 'XM2026001', name: '滨江壹号院 张明远家', customerId: 'c_1',
    address: '杭州市滨江区滨江壹号院 3 幢 1802 室', area: 126, houseType: '平层',
    projectType: '全包', style: '现代简约', status: '施工中',
    startDate: d(-50), planEndDate: d(40), actualEndDate: '',
    managerId: 'u_2', managerName: '陈国栋', designerId: 'u_3', designerName: '林思雨',
    supervisorName: '黄志强',
    contractId: 'ct_1', contractAmount: 412600, budget: 320000, cost: 186400, received: 247560,
    nodes: buildNodes('p_1', d(-50), nodeWeights(1), 5),
    tags: ['重点工地', '有儿童']
  },
  {
    id: 'p_2', no: 'XM2026002', name: '翡翠城 王浩然家', customerId: 'c_2',
    address: '杭州市余杭区翡翠城 12 幢 2 单元 2601 室', area: 158, houseType: '平层',
    projectType: '整装', style: '新中式', status: '施工中',
    startDate: d(-80), planEndDate: d(12), actualEndDate: '',
    managerId: 'u_2', managerName: '陈国栋', designerId: 'u_3', designerName: '林思雨',
    supervisorName: '黄志强',
    contractId: 'ct_2', contractAmount: 586000, budget: 450000, cost: 402800, received: 351600,
    nodes: buildNodes('p_2', d(-80), nodeWeights(1), 8),
    tags: ['大平层', '转介绍']
  },
  {
    id: 'p_3', no: 'XM2026003', name: '湖畔花园 陈静怡家', customerId: 'c_3',
    address: '杭州市西湖区湖畔花园 8 幢 1 单元 1101 室', area: 98, houseType: '平层',
    projectType: '全包', style: '奶油风', status: '未开工',
    startDate: d(3), planEndDate: d(93), actualEndDate: '',
    managerId: 'u_2', managerName: '陈国栋', designerId: 'u_3', designerName: '林思雨',
    supervisorName: '黄志强',
    contractId: '', contractAmount: 236000, budget: 220000, cost: 0, received: 0,
    nodes: buildNodes('p_3', d(3), nodeWeights(0.8), 0),
    tags: ['待签约', '婚房']
  },
  {
    id: 'p_4', no: 'XM2026004', name: '金色海岸 刘建国家', customerId: 'c_4',
    address: '杭州市上城区金色海岸 5 幢 901 室', area: 142, houseType: '平层',
    projectType: '全包', style: '轻奢', status: '已完工',
    startDate: d(-132), planEndDate: d(-20), actualEndDate: d(-22),
    managerId: 'u_2', managerName: '陈国栋', designerId: 'u_3', designerName: '林思雨',
    supervisorName: '黄志强',
    contractId: 'ct_4', contractAmount: 386000, budget: 380000, cost: 328600, received: 386000,
    nodes: buildNodes('p_4', d(-132), nodeWeights(1), 11),
    tags: ['已完工']
  },
  {
    id: 'p_5', no: 'XM2026005', name: '云栖玫瑰园 赵敏家', customerId: 'c_5',
    address: '杭州市西湖区云栖玫瑰园 7 幢 1 单元 302 室', area: 210, houseType: '复式',
    projectType: '整装', style: '日式', status: '施工中',
    startDate: d(-44), planEndDate: d(86), actualEndDate: '',
    managerId: 'u_2', managerName: '陈国栋', designerId: 'u_3', designerName: '林思雨',
    supervisorName: '黄志强',
    contractId: 'ct_3', contractAmount: 892000, budget: 680000, cost: 214600, received: 267600,
    nodes: buildNodes('p_5', d(-44), nodeWeights(1.2), 1),
    tags: ['高客单', '复式']
  },
  {
    id: 'p_6', no: 'XM2026006', name: '钱塘印象 孙立家', customerId: 'c_6',
    address: '杭州市钱塘区钱塘印象 2 幢 1502 室', area: 115, houseType: '平层',
    projectType: '半包', style: '北欧', status: '已结算',
    startDate: d(-180), planEndDate: d(-30), actualEndDate: d(-32),
    managerId: 'u_2', managerName: '陈国栋', designerId: 'u_3', designerName: '林思雨',
    supervisorName: '黄志强',
    contractId: 'ct_5', contractAmount: 268000, budget: 240000, cost: 231400, received: 268000,
    nodes: buildNodes('p_6', d(-180), nodeWeights(0.9), 11),
    tags: ['已结算']
  }
];

// ---------------- 巡检记录 ----------------
const inspections = [
  {
    id: 'ins_1', projectId: 'p_1', nodeId: 'n_p_1_5', type: '隐蔽工程验收',
    result: '合格', inspector: '黄志强', date: d(-18),
    items: [
      { name: '防水涂刷高度', pass: true, note: '淋浴区 1.8m 达标' },
      { name: '闭水试验 24h', pass: true, note: '楼下无渗漏' },
      { name: '管道打压测试', pass: true, note: '0.8MPa 保压 30 分钟无压降' },
      { name: '现场成品保护', pass: true, note: '' }
    ],
    images: [], remark: '隐蔽工程整体合格，允许进入下一节点。'
  },
  {
    id: 'ins_2', projectId: 'p_2', nodeId: 'n_p_2_7', type: '中期验收',
    result: '待整改', inspector: '黄志强', date: d(-6),
    items: [
      { name: '吊顶平整度', pass: false, note: '客厅东侧误差 8mm，需复核' },
      { name: '瓷砖空鼓率', pass: true, note: '抽检 20 片，空鼓 1 片' },
      { name: '木作柜体垂直度', pass: true, note: '' },
      { name: '墙面腻子平整', pass: true, note: '' }
    ],
    images: [], remark: '吊顶需返工后复验，其余合格。'
  },
  {
    id: 'ins_3', projectId: 'p_5', nodeId: 'n_p_5_3', type: '日常巡检',
    result: '合格', inspector: '黄志强', date: d(-3),
    items: [
      { name: '施工现场安全', pass: true, note: '临边防护到位' },
      { name: '材料码放', pass: true, note: '' },
      { name: '成品保护', pass: true, note: '' },
      { name: '卫生情况', pass: false, note: '建筑垃圾未及时清运' }
    ],
    images: [], remark: '已通知班组当日清运。'
  }
];

// ---------------- 变更签证 ----------------
const changes = [
  {
    id: 'ch_1', projectId: 'p_1', no: 'BG2026001',
    title: '客厅电视背景墙增加岩板', amount: 8600, status: '已确认',
    applicant: '陈国栋', createTime: t(-16, '15:20'), confirmTime: t(-14, '10:00'),
    reason: '客户现场确认增加岩板背景墙，含人工与辅料。'
  },
  {
    id: 'ch_2', projectId: 'p_2', no: 'BG2026002',
    title: '主卧增加一个插座点位 + 双控开关', amount: 680, status: '待确认',
    applicant: '陈国栋', createTime: t(-4, '09:40'), confirmTime: '',
    reason: '客户床体位置调整，需增加插座并改双控。'
  },
  {
    id: 'ch_3', projectId: 'p_5', no: 'BG2026003',
    title: '二层卫生间增加地暖', amount: 12800, status: '待审批',
    applicant: '陈国栋', createTime: t(-2, '14:10'), confirmTime: '',
    reason: '客户新增需求，需公司审批成本后再报价。'
  }
];

// ---------------- 收款记录 ----------------
const receipts = [
  { id: 'r_1', contractId: 'ct_1', projectId: 'p_1', customerId: 'c_1', planId: 'pp_0', amount: 123780, method: '银行转账', date: d(-56), operator: '吴晓静', no: 'SK2026001', remark: '首付款' },
  { id: 'r_2', contractId: 'ct_1', projectId: 'p_1', customerId: 'c_1', planId: 'pp_1', amount: 123780, method: '银行转账', date: d(-30), operator: '吴晓静', no: 'SK2026002', remark: '水电验收款' },
  { id: 'r_3', contractId: 'ct_2', projectId: 'p_2', customerId: 'c_2', planId: 'pp_0', amount: 175800, method: '银行转账', date: d(-86), operator: '吴晓静', no: 'SK2026003', remark: '首付款' },
  { id: 'r_4', contractId: 'ct_2', projectId: 'p_2', customerId: 'c_2', planId: 'pp_1', amount: 175800, method: '银行转账', date: d(-55), operator: '吴晓静', no: 'SK2026004', remark: '水电验收款' },
  { id: 'r_5', contractId: 'ct_2', projectId: 'p_2', customerId: 'c_2', planId: 'pp_2', amount: 80000, method: '微信', date: d(-12), operator: '吴晓静', no: 'SK2026005', remark: '泥木验收部分款' },
  { id: 'r_6', contractId: 'ct_3', projectId: 'p_5', customerId: 'c_5', planId: 'pp_0', amount: 267600, method: '银行转账', date: d(-46), operator: '吴晓静', no: 'SK2026006', remark: '首付款' },
  { id: 'r_7', contractId: 'ct_4', projectId: 'p_4', customerId: 'c_4', planId: 'pp_0', amount: 115800, method: '银行转账', date: d(-138), operator: '吴晓静', no: 'SK2026007', remark: '首付款' },
  { id: 'r_8', contractId: 'ct_4', projectId: 'p_4', customerId: 'c_4', planId: 'pp_1', amount: 115800, method: '银行转账', date: d(-108), operator: '吴晓静', no: 'SK2026008', remark: '水电验收款' },
  { id: 'r_9', contractId: 'ct_4', projectId: 'p_4', customerId: 'c_4', planId: 'pp_2', amount: 115800, method: '银行转账', date: d(-58), operator: '吴晓静', no: 'SK2026009', remark: '泥木验收款' },
  { id: 'r_10', contractId: 'ct_4', projectId: 'p_4', customerId: 'c_4', planId: 'pp_3', amount: 38600, method: '银行转账', date: d(-18), operator: '吴晓静', no: 'SK2026010', remark: '竣工尾款' },
  { id: 'r_11', contractId: 'ct_5', projectId: 'p_6', customerId: 'c_6', planId: 'pp_0', amount: 80400, method: '银行转账', date: d(-188), operator: '吴晓静', no: 'SK2026011', remark: '首付款' },
  { id: 'r_12', contractId: 'ct_5', projectId: 'p_6', customerId: 'c_6', planId: 'pp_1', amount: 80400, method: '银行转账', date: d(-158), operator: '吴晓静', no: 'SK2026012', remark: '水电验收款' },
  { id: 'r_13', contractId: 'ct_5', projectId: 'p_6', customerId: 'c_6', planId: 'pp_2', amount: 80400, method: '银行转账', date: d(-88), operator: '吴晓静', no: 'SK2026013', remark: '泥木验收款' },
  { id: 'r_14', contractId: 'ct_5', projectId: 'p_6', customerId: 'c_6', planId: 'pp_3', amount: 26800, method: '银行转账', date: d(-28), operator: '吴晓静', no: 'SK2026014', remark: '竣工尾款' }
];

// ---------------- 费用支出 ----------------
const expenses = [
  { id: 'e_1', no: 'ZC2026001', projectId: 'p_1', category: '主材采购', amount: 38600, status: '已支付', applicant: '陈国栋', date: d(-28), approver: '周文斌', approveDate: d(-27), payDate: d(-26), remark: '马可波罗瓷砖一批', supplier: '杭州马可波罗旗舰店' },
  { id: 'e_2', no: 'ZC2026002', projectId: 'p_1', category: '人工费', amount: 24800, status: '已支付', applicant: '陈国栋', date: d(-22), approver: '周文斌', approveDate: d(-21), payDate: d(-20), remark: '水电班组人工费（第一期）', supplier: '王师傅水电班组' },
  { id: 'e_3', no: 'ZC2026003', projectId: 'p_1', category: '辅材采购', amount: 8620, status: '已支付', applicant: '陈国栋', date: d(-15), approver: '周文斌', approveDate: d(-14), payDate: d(-13), remark: '水泥黄沙及防水材料', supplier: '东方雨虹杭州仓' },
  { id: 'e_4', no: 'ZC2026004', projectId: 'p_2', category: '主材采购', amount: 128000, status: '已支付', applicant: '陈国栋', date: d(-60), approver: '周文斌', approveDate: d(-59), payDate: d(-58), remark: '中央空调设备款', supplier: '大金空调杭州代理' },
  { id: 'e_5', no: 'ZC2026005', projectId: 'p_2', category: '人工费', amount: 86000, status: '已支付', applicant: '陈国栋', date: d(-40), approver: '周文斌', approveDate: d(-39), payDate: d(-38), remark: '泥木班组人工费', supplier: '李师傅泥木班组' },
  { id: 'e_6', no: 'ZC2026006', projectId: 'p_2', category: '主材采购', amount: 62000, status: '待审批', applicant: '陈国栋', date: d(-2), approver: '', approveDate: '', payDate: '', remark: '全屋定制首批款', supplier: '欧派杭州公司' },
  { id: 'e_7', no: 'ZC2026007', projectId: 'p_5', category: '主材采购', amount: 96000, status: '待审批', applicant: '陈国栋', date: d(-1), approver: '', approveDate: '', payDate: '', remark: '进口板材定金', supplier: '爱格板华东仓储' },
  { id: 'e_8', no: 'ZC2026008', projectId: 'p_5', category: '人工费', amount: 42000, status: '已通过', applicant: '陈国栋', date: d(-8), approver: '周文斌', approveDate: d(-7), payDate: '', remark: '水电班组进场款', supplier: '赵师傅水电班组' },
  { id: 'e_9', no: 'ZC2026009', projectId: 'p_4', category: '主材采购', amount: 156000, status: '已支付', applicant: '陈国栋', date: d(-100), approver: '周文斌', approveDate: d(-99), payDate: d(-98), remark: '全屋主材', supplier: '多家供应商' },
  { id: 'e_10', no: 'ZC2026010', projectId: 'p_5', category: '运输费', amount: 3800, status: '已驳回', applicant: '陈国栋', date: d(-5), approver: '周文斌', approveDate: d(-4), payDate: '', remark: '材料二次搬运费，缺少单据', supplier: '顺发货运' }
];

// ---------------- 材料 ----------------
const materials = [
  { id: 'm_1', no: 'CL2026001', projectId: 'p_1', name: '马可波罗瓷砖', category: '主材', spec: '750×1500 星灰', unit: '㎡', qty: 168, price: 158, amount: 26544, supplier: '杭州马可波罗旗舰店', status: '已入库', orderDate: d(-30), arriveDate: d(-24), keeper: '陈国栋' },
  { id: 'm_2', no: 'CL2026002', projectId: 'p_1', name: '东方雨虹防水涂料', category: '辅材', spec: '柔韧型 20kg', unit: '桶', qty: 12, price: 268, amount: 3216, supplier: '东方雨虹杭州仓', status: '已使用', orderDate: d(-40), arriveDate: d(-36), keeper: '陈国栋' },
  { id: 'm_3', no: 'CL2026003', projectId: 'p_1', name: '立邦净味乳胶漆', category: '主材', spec: '120 亚光白 18L', unit: '桶', qty: 18, price: 468, amount: 8424, supplier: '立邦杭州经销商', status: '待采购', orderDate: '', arriveDate: '', keeper: '' },
  { id: 'm_4', no: 'CL2026004', projectId: 'p_2', name: '大金中央空调', category: '设备', spec: '一拖五 6HP', unit: '套', qty: 1, price: 46800, amount: 46800, supplier: '大金空调杭州代理', status: '已入库', orderDate: d(-62), arriveDate: d(-52), keeper: '陈国栋' },
  { id: 'm_5', no: 'CL2026005', projectId: 'p_2', name: '大自然实木复合地板', category: '主材', spec: '橡木 1210×165', unit: '㎡', qty: 62, price: 268, amount: 16616, supplier: '大自然地板杭州店', status: '在途', orderDate: d(-8), arriveDate: '', keeper: '' },
  { id: 'm_6', no: 'CL2026006', projectId: 'p_2', name: '欧派全屋定制柜体', category: '主材', spec: '爱家板 定制', unit: '项', qty: 1, price: 68000, amount: 68000, supplier: '欧派杭州公司', status: '已下单', orderDate: d(-6), arriveDate: '', keeper: '' },
  { id: 'm_7', no: 'CL2026007', projectId: 'p_5', name: '爱格进口板材', category: '主材', spec: 'H3303 原木色', unit: '张', qty: 120, price: 620, amount: 74400, supplier: '爱格板华东仓储', status: '已下单', orderDate: d(-3), arriveDate: '', keeper: '' },
  { id: 'm_8', no: 'CL2026008', projectId: 'p_5', name: '微水泥', category: '主材', spec: '墙面专用 20kg', unit: '桶', qty: 24, price: 880, amount: 21120, supplier: '微水泥华东总代', status: '待采购', orderDate: '', arriveDate: '', keeper: '' },
  { id: 'm_9', no: 'CL2026009', projectId: 'p_3', name: '东鹏瓷砖', category: '主材', spec: '600×1200 米白', unit: '㎡', qty: 86, price: 128, amount: 11008, supplier: '东鹏杭州店', status: '待采购', orderDate: '', arriveDate: '', keeper: '' }
];

// ---------------- 售后工单 ----------------
const aftersales = [
  {
    id: 'as_1', no: 'SH2026001', projectId: 'p_4', customerId: 'c_4', customerName: '刘建国', phone: '13722223333',
    type: '防水渗漏', priority: '紧急', status: '处理中',
    desc: '主卫淋浴区墙角有渗水，墙面起皮，已持续三天。',
    address: '杭州市上城区金色海岸 5 幢 901 室',
    createTime: t(-3, '09:20'), handler: '陈国栋', resolveTime: '',
    records: [
      { id: 'ar_1', time: t(-3, '09:30'), operator: '吴晓静', action: '受理工单', content: '已电话联系业主，约定今日下午上门。' },
      { id: 'ar_2', time: t(-2, '14:10'), operator: '陈国栋', action: '上门排查', content: '确认为淋浴区防水收口不到位，需局部返工。' }
    ]
  },
  {
    id: 'as_2', no: 'SH2026002', projectId: 'p_6', customerId: 'c_6', customerName: '孙立', phone: '13966667777',
    type: '门窗五金', priority: '普通', status: '待受理',
    desc: '厨房推拉门轨道异响，推拉不畅。',
    address: '杭州市钱塘区钱塘印象 2 幢 1502 室',
    createTime: t(-1, '17:45'), handler: '', resolveTime: '',
    records: []
  },
  {
    id: 'as_3', no: 'SH2026003', projectId: 'p_4', customerId: 'c_4', customerName: '刘建国', phone: '13722223333',
    type: '墙面开裂', priority: '普通', status: '已完成',
    desc: '次卧墙面出现细微裂纹。',
    address: '杭州市上城区金色海岸 5 幢 901 室',
    createTime: t(-40, '10:00'), handler: '陈国栋', resolveTime: t(-33, '16:00'),
    records: [
      { id: 'ar_3', time: t(-40, '10:10'), operator: '吴晓静', action: '受理工单', content: '已安排师傅上门。' },
      { id: 'ar_4', time: t(-36, '15:00'), operator: '陈国栋', action: '上门维修', content: '铲除开裂处重新批腻子并补漆。' },
      { id: 'ar_5', time: t(-33, '16:00'), operator: '陈国栋', action: '完工回访', content: '业主确认修复完成，已回访满意。' }
    ]
  }
];

// ---------------- 待办 ----------------
const todos = [
  { id: 'td_1', type: '费用审批', title: '欧派全屋定制首批款 ¥62,000', desc: '翡翠城项目 · 陈国栋 提交', targetId: 'e_6', targetType: 'expense', level: '紧急', status: '待处理', createTime: t(-2, '11:00'), applicant: '陈国栋' },
  { id: 'td_2', type: '收款确认', title: '泥木验收款 ¥58,600 已逾期', desc: '翡翠城项目 · 合同 HT2026002', targetId: 'pp_2', targetType: 'contract', level: '特急', status: '待处理', createTime: t(-14, '09:00'), applicant: '吴晓静' },
  { id: 'td_3', type: '报价审批', title: '云栖玫瑰园复式整装报价 ¥892,000', desc: '赵敏家 · 林思雨 提交', targetId: 'q_4', targetType: 'quote', level: '普通', status: '待处理', createTime: t(-4, '11:30'), applicant: '林思雨' },
  { id: 'td_4', type: '验收确认', title: '翡翠城中期验收待整改复验', desc: '吊顶平整度返工后需复验', targetId: 'ins_2', targetType: 'inspection', level: '紧急', status: '待处理', createTime: t(-6, '17:00'), applicant: '黄志强' },
  { id: 'td_5', type: '变更签证', title: '云栖玫瑰园二层卫生间增加地暖 ¥12,800', desc: '需公司审批成本后再向客户报价', targetId: 'ch_3', targetType: 'change', level: '普通', status: '待处理', createTime: t(-2, '14:10'), applicant: '陈国栋' },
  { id: 'td_6', type: '售后派单', title: '金色海岸主卫渗水需上门返工', desc: '工单 SH2026001 · 紧急', targetId: 'as_1', targetType: 'aftersale', level: '特急', status: '待处理', createTime: t(-2, '14:10'), applicant: '陈国栋' },
  { id: 'td_7', type: '费用审批', title: '爱格进口板材定金 ¥96,000', desc: '云栖玫瑰园项目 · 陈国栋 提交', targetId: 'e_7', targetType: 'expense', level: '普通', status: '待处理', createTime: t(-1, '10:20'), applicant: '陈国栋' },
  { id: 'td_8', type: '收款确认', title: '云栖玫瑰园水电验收款 ¥267,600 待收', desc: '合同 HT2026003 · 已到期', targetId: 'pp_1', targetType: 'contract', level: '紧急', status: '待处理', createTime: t(-12, '09:00'), applicant: '吴晓静' }
];

module.exports = {
  company,
  users,
  customers,
  follows,
  quotes,
  contracts,
  projects: projectDefs,
  inspections,
  changes,
  receipts,
  expenses,
  materials,
  aftersales,
  todos,
  // 供页面复用的纯函数
  projectSummary,
  sumProgress,
  calcQuote
};
