/**
 * 全局业务字典
 * 所有状态值统一使用这里的中文常量，禁止页面里出现魔法字符串。
 */

// 项目状态
const PROJECT_STATUS = ['未开工', '施工中', '已完工', '已结算', '已停工'];
const PROJECT_STATUS_COLOR = {
  未开工: 'gray',
  施工中: 'blue',
  已完工: 'green',
  已结算: 'green',
  已停工: 'red'
};

// 施工节点状态
const NODE_STATUS = ['未开始', '进行中', '已完成', '已逾期'];
const NODE_STATUS_COLOR = {
  未开始: 'gray',
  进行中: 'blue',
  已完成: 'green',
  已逾期: 'red'
};

// 施工阶段（标准家装工序）
const NODE_CATEGORY = ['开工交底', '拆改', '水电', '泥瓦', '木工', '油漆', '安装', '竣工'];

// 标准节点模板（新建项目时自动生成，weight 合计 100）
const NODE_TEMPLATE = [
  { seq: 1, name: '开工交底', category: '开工交底', weight: 5, days: 1 },
  { seq: 2, name: '墙体拆改', category: '拆改', weight: 5, days: 3 },
  { seq: 3, name: '水电改造', category: '水电', weight: 15, days: 7 },
  { seq: 4, name: '水电验收', category: '水电', weight: 5, days: 1 },
  { seq: 5, name: '防水闭水试验', category: '泥瓦', weight: 5, days: 3 },
  { seq: 6, name: '瓷砖铺贴', category: '泥瓦', weight: 12, days: 8 },
  { seq: 7, name: '木工吊顶', category: '木工', weight: 10, days: 6 },
  { seq: 8, name: '墙面腻子', category: '油漆', weight: 10, days: 7 },
  { seq: 9, name: '油漆涂刷', category: '油漆', weight: 8, days: 5 },
  { seq: 10, name: '主材安装', category: '安装', weight: 15, days: 8 },
  { seq: 11, name: '竣工验收', category: '竣工', weight: 10, days: 2 }
];

// 客户来源
const CUSTOMER_SOURCE = ['电话咨询', '门店到访', '老客转介绍', '抖音/小红书', '楼盘拓展', '装修平台', '其他'];

// 客户状态（销售漏斗）
const CUSTOMER_STATUS = ['新线索', '跟进中', '已量房', '已报价', '已签约', '已流失'];
const CUSTOMER_STATUS_COLOR = {
  新线索: 'gray',
  跟进中: 'blue',
  已量房: 'violet',
  已报价: 'orange',
  已签约: 'green',
  已流失: 'red'
};

// 客户意向等级
const CUSTOMER_LEVEL = ['A', 'B', 'C', 'D'];

// 跟进方式
const FOLLOW_TYPE = ['电话', '微信', '到店', '量房', '方案沟通', '签约'];

// 合同状态
const CONTRACT_STATUS = ['待签约', '已签约', '履行中', '已完成', '已作废'];
const CONTRACT_STATUS_COLOR = {
  待签约: 'gray',
  已签约: 'blue',
  履行中: 'orange',
  已完成: 'green',
  已作废: 'red'
};

// 收款状态
const PAY_STATUS = ['未收款', '部分收款', '已收清', '已逾期'];
const PAY_STATUS_COLOR = {
  未收款: 'gray',
  部分收款: 'orange',
  已收清: 'green',
  已逾期: 'red'
};

// 收款方式
const PAY_METHOD = ['微信', '支付宝', '银行转账', '现金', '刷卡'];

// 费用类型
const EXPENSE_CATEGORY = ['主材采购', '辅材采购', '人工费', '运输费', '管理费', '设计费', '其他'];
const EXPENSE_STATUS = ['待审批', '已通过', '已支付', '已驳回'];
const EXPENSE_STATUS_COLOR = {
  待审批: 'orange',
  已通过: 'blue',
  已支付: 'green',
  已驳回: 'red'
};

// 材料状态
const MATERIAL_STATUS = ['待采购', '已下单', '在途', '已入库', '已使用'];
const MATERIAL_STATUS_COLOR = {
  待采购: 'gray',
  已下单: 'blue',
  在途: 'orange',
  已入库: 'green',
  已使用: 'gray'
};

// 材料类别
const MATERIAL_CATEGORY = ['主材', '辅材', '设备', '软装'];

// 巡检类型 & 结果
const INSPECT_TYPE = ['隐蔽工程验收', '中期验收', '竣工验收', '日常巡检'];
const INSPECT_RESULT = ['待整改', '合格', '不合格'];

// 售后状态
const AFTERSALE_STATUS = ['待受理', '处理中', '已完成', '已关闭'];
const AFTERSALE_STATUS_COLOR = {
  待受理: 'red',
  处理中: 'orange',
  已完成: 'green',
  已关闭: 'gray'
};

// 售后类型
const AFTERSALE_TYPE = ['水电问题', '墙面开裂', '地面空鼓', '门窗五金', '防水渗漏', '其他'];

// 优先级
const PRIORITY = ['普通', '紧急', '特急'];
const PRIORITY_COLOR = {
  普通: 'gray',
  紧急: 'orange',
  特急: 'red'
};

// 待办类型
const TODO_TYPE = ['收款确认', '费用审批', '报价审批', '变更签证', '验收确认', '售后派单'];
const TODO_STATUS = ['待处理', '已处理', '已驳回'];

// 角色
const ROLES = ['总经理', '项目经理', '设计师', '财务', '销售', '监理'];

// 报价分类
const QUOTE_CATEGORY = ['基础工程', '水电工程', '泥瓦工程', '木工工程', '油漆工程', '主材', '安装', '其他'];

// 工程类型
const PROJECT_TYPE = ['全包', '半包', '整装', '局部改造'];
const HOUSE_TYPE = ['平层', '复式', '别墅', '商铺', '办公'];

// 风格
const DESIGN_STYLE = ['现代简约', '新中式', '北欧', '轻奢', '奶油风', '原木风', '美式', '日式'];

module.exports = {
  PROJECT_STATUS,
  PROJECT_STATUS_COLOR,
  NODE_STATUS,
  NODE_STATUS_COLOR,
  NODE_CATEGORY,
  NODE_TEMPLATE,
  CUSTOMER_SOURCE,
  CUSTOMER_STATUS,
  CUSTOMER_STATUS_COLOR,
  CUSTOMER_LEVEL,
  FOLLOW_TYPE,
  CONTRACT_STATUS,
  CONTRACT_STATUS_COLOR,
  PAY_STATUS,
  PAY_STATUS_COLOR,
  PAY_METHOD,
  EXPENSE_CATEGORY,
  EXPENSE_STATUS,
  EXPENSE_STATUS_COLOR,
  MATERIAL_STATUS,
  MATERIAL_STATUS_COLOR,
  MATERIAL_CATEGORY,
  INSPECT_TYPE,
  INSPECT_RESULT,
  AFTERSALE_STATUS,
  AFTERSALE_STATUS_COLOR,
  AFTERSALE_TYPE,
  PRIORITY,
  PRIORITY_COLOR,
  TODO_TYPE,
  TODO_STATUS,
  ROLES,
  QUOTE_CATEGORY,
  PROJECT_TYPE,
  HOUSE_TYPE,
  DESIGN_STYLE
};
