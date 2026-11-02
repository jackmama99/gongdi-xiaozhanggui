# 工地小掌柜 · 工地管理小程序 — 开发契约（CONTRACT）

> 所有开发者必须先读完本文件再动笔。契约优先于个人偏好，冲突以本文件为准。
>
> **2026-11-02 更新（v1.3.1）**：设计令牌已升级为 Blueprint / Clay；配色、圆角、阴影以 `app.wxss` 和本文 3.1/3.2 为准。旧版「禁止修改 app.wxss / data / utils」是 v1 协作期的冻结约定，现由单一负责人统一维护，改前跑 `npm test`。

---

## 1. 项目定位

面向 **家装/整装公司** 的内部管理小程序（管理端），覆盖从获客到售后的全流程：

```
客户线索 → 量房跟进 → 报价预算 → 合同签约 → 施工进度/验收 → 材料采购 → 收付款/成本 → 售后维保 → 经营报表
```

- 技术栈：**微信原生小程序**（无框架、无 npm 依赖、无构建步骤）
- 数据：`data/store.js` 本地存储模拟后端（已实现，勿改接口签名）
- 直接微信开发者工具「导入项目」即可运行

---

## 2. 目录结构

```
zhuangxiu-erp/
├── app.js / app.json / app.wxss      # 全局（已完成，勿改）
├── project.config.json / sitemap.json
├── icons/                            # tabBar 图标（已生成）
├── data/
│   ├── seed.js                       # 种子数据（已完成，勿改）
│   └── store.js                      # 数据仓库 API（已完成，勿改）
├── utils/
│   ├── constants.js                  # 业务字典（已完成，勿改）
│   └── format.js                     # 格式化工具（已完成，勿改）
├── components/                       # 共享组件（已完成，勿改）
│   ├── tag/  section-header/  empty/  popup/  progress-bar/  stat-card/
└── pages/                            # 各人按分工编写
```

**禁止修改**：`app.js`、`app.json`、`app.wxss`、`data/*`、`utils/*`、`components/*`。
如确需新增共享方法，先告知 Lead，由 Lead 统一追加。

---

## 3. 设计规范（必须严格遵守）

### 3.1 颜色

> v1.3 起为 Blueprint / Clay 主题；以下为唯一有效取值，页面与组件禁止再写旧色硬编码。

| 用途 | 变量 | 值 |
|---|---|---|
| 主色 | `var(--primary)` | `#1D4E89` |
| 主色浅底 | `var(--primary-light)` | `#E8F0F8` |
| 成功 | `var(--success)` | `#258F78` |
| 警告 | `var(--warning)` | `#D9823B` |
| 危险 | `var(--danger)` | `#C94F45` |
| 紫色 | `var(--violet)` | `#6E63A8` |
| 主文字 | `var(--text-1)` | `#172B3A` |
| 次文字 | `var(--text-2)` | `#465968` |
| 弱文字 | `var(--text-3)` | `#7C8B96` |
| 极弱 | `var(--text-4)` | `#A7B1B8` |
| 分割线 | `var(--line)` | `#E3E8EB` |
| 页面底色 | `var(--bg)` | `#F5F3EF` |
| 卡片 | `var(--card)` | `#FFFDFA` |

> 校验：`npm run test:theme`（旧色出现即失败）。

### 3.2 尺寸

- 页面左右留白：`24rpx`；卡片内边距 `28rpx`；卡片圆角 `24rpx`
- 正文 `28rpx`，辅助 `24rpx`，标题 `32rpx`，金额大字 `40rpx`
- 卡片阴影：`0 6rpx 20rpx rgba(23,43,58,0.06)`
- 列表卡片间距 `20rpx`

### 3.3 app.wxss 已提供的全局类（直接用，勿重复定义）

布局：`.page` `.container` `.row` `.row-between` `.row-top` `.col` `.flex-1` `.center` `.wrap` `.gap-8/12/16/20`
间距：`.mt-8/12/16/20/24/32` `.mb-16/24` `.ml-8/16` `.mr-8` `.p-24`
文字：`.t-1~.t-4` `.t-primary/.t-success/.t-danger/.t-warning` `.fs-20/22/24/26/28/30/32/36/44` `.fw-500/600/700` `.bold-num` `.ellipsis` `.ellipsis-2`
容器：`.card` `.card-flat` `.card-hover` `.divider` `.divider-full`
按钮：`.btn` + `.btn-primary/.btn-ghost/.btn-plain/.btn-danger/.btn-success` + `.btn-sm/.btn-block/.btn-disabled`
表单：`.form-item` `.form-label` `.form-label-req` `.form-value` `.form-input` `.form-placeholder` `.form-arrow` `.arrow-right`
其他：`.filter-bar/.filter-item.active` `.tab-chip.active` `.cell` `.cell-icon` `.cell-title` `.cell-sub` `.dot` `.progress-track/.progress-fill` `.fab` `.bottom-bar` `.bottom-placeholder` `.group-title` `.loading`

### 3.4 共享组件（在页面 json 中 `usingComponents` 引入）

```json
{
  "usingComponents": {
    "t-tag": "/components/tag/index",
    "t-section": "/components/section-header/index",
    "t-empty": "/components/empty/index",
    "t-popup": "/components/popup/index",
    "t-progress": "/components/progress-bar/index",
    "t-stat": "/components/stat-card/index"
  }
}
```

| 组件 | 属性 | 事件 |
|---|---|---|
| `t-tag` | `text` `type`(blue/green/orange/red/gray/violet) `size`(small/default/large) `dot` `plain` | — |
| `t-section` | `title` `sub` `extra` `bar` `barColor` | `extra` |
| `t-empty` | `icon`(emoji) `text` `action` | `action` |
| `t-popup` | `visible` `title` `cancelText` `confirmText` `maxHeight`，内容用 slot | `cancel` `confirm` |
| `t-progress` | `percent`(Number) `height` `type`(''/warning/danger/success) `showText` `label` | — |
| `t-stat` | `label` `value` `suffix` `unit` `sub` `subType`(up/down) | — |

> 图标统一使用 **emoji**（如 🏗 📋 💰 👤 🔧 📐 ✅ ⚠️ 📊 🧾 🚚 🛠），不引入图片资源，不依赖字体图标。

---

## 4. 数据层 API（`const store = require('../../data/store')`）

### 4.1 基础

```js
store.list(name)                 // 取集合数组（只读！）
store.find(name, id)             // 取单条
store.filter(name, fn)           // 条件查询
store.insert(name, obj)          // 新增（自动 id）
store.update(name, id, patch)    // 局部更新
store.remove(name, id)           // 删除
store.reset()                    // 重置为初始数据
```

集合名：`users` `customers` `follows` `quotes` `contracts` `projects` `inspections` `changes` `receipts` `expenses` `materials` `aftersales` `todos`

### 4.2 关联查询

```js
store.nodesOf(projectId)              // 项目施工节点数组
store.findNode(projectId, nodeId)
store.projectOf(customerId)           // 客户对应的项目
store.contractOfProject(projectId)
store.contractsOfCustomer(customerId)
store.quotesOfCustomer(customerId)
store.followsOfCustomer(customerId)   // 已按时间倒序
store.receiptsOfProject(projectId)
store.receiptsOfContract(contractId)
store.expensesOfProject(projectId)
store.materialsOfProject(projectId)
store.inspectionsOfProject(projectId) // 已按日期倒序
store.changesOfProject(projectId)
store.aftersalesOfProject(projectId)
store.todosPending()
store.customerOf(id)
store.userOf(id)
store.projectCard(project)            // 项目 + 汇总（progress/doneNodes/currentStage/daysLeft...）
store.projectCards(filterFn?)         // 项目卡片数组
```

### 4.3 写入（含业务联动）

```js
store.saveCustomer(data)              // 有 id 则更新，无则新增
store.addFollow(customerId, { type, content, result })
store.updateNode(projectId, nodeId, patch)
store.startNode(projectId, nodeId)    // 上一个进行中节点自动完成
store.finishNode(projectId, nodeId)   // 全部完成时项目自动转「已完工」
store.addInspection(projectId, { type, result, items, remark })
store.addReceipt({ contractId, projectId, customerId, planId, amount, method, remark })
store.addExpense({ projectId, category, amount, supplier, remark })
store.approveExpense(id, pass, remark) // 通过后自动计入项目成本
store.confirmChange(id, pass)
store.addMaterial({ projectId, name, category, spec, unit, qty, price, supplier })
store.setMaterialStatus(id, status)
store.addAftersale({ projectId, customerId, customerName, phone, type, priority, desc, address })
store.addAftersaleRecord(id, action, content)
store.setAftersaleStatus(id, status)
store.saveQuote(data)
store.setQuoteStatus(id, status)
store.dealTodo(id, pass)
store.addTodo(data)
```

### 4.4 登录 / 统计

```js
store.login(account, password)   // → { ok, user } | { ok:false, msg }
store.logout()
store.getCurrentUser()
store.isLoggedIn()
store.dashboardStats()           // { runningCount, totalCount, monthReceipt, monthExpense, receivable, overdueReceivable, overdueNodes, todoCount, avgProgress }
store.reportStats()              // { totalContract, totalReceived, totalCost, totalBudget, grossProfit, grossRate, monthly[], projectProfit[], byManager[], bySource[] }
```

### 4.5 业务字典（`const C = require('../../utils/constants')`）

`C.PROJECT_STATUS`、`C.PROJECT_STATUS_COLOR`、`C.NODE_STATUS`、`C.NODE_STATUS_COLOR`、`C.NODE_CATEGORY`、`C.NODE_TEMPLATE`、`C.CUSTOMER_SOURCE`、`C.CUSTOMER_STATUS`、`C.CUSTOMER_STATUS_COLOR`、`C.CUSTOMER_LEVEL`、`C.FOLLOW_TYPE`、`C.CONTRACT_STATUS`、`C.CONTRACT_STATUS_COLOR`、`C.PAY_STATUS`、`C.PAY_STATUS_COLOR`、`C.PAY_METHOD`、`C.EXPENSE_CATEGORY`、`C.EXPENSE_STATUS`、`C.EXPENSE_STATUS_COLOR`、`C.MATERIAL_STATUS`、`C.MATERIAL_STATUS_COLOR`、`C.MATERIAL_CATEGORY`、`C.INSPECT_TYPE`、`C.INSPECT_RESULT`、`C.AFTERSALE_STATUS`、`C.AFTERSALE_STATUS_COLOR`、`C.AFTERSALE_TYPE`、`C.PRIORITY`、`C.PRIORITY_COLOR`、`C.TODO_TYPE`、`C.QUOTE_CATEGORY`、`C.PROJECT_TYPE`、`C.HOUSE_TYPE`、`C.DESIGN_STYLE`、`C.ROLES`

### 4.6 格式化（`const F = require('../../utils/format')`）

```js
F.money(n)      // 12800.5 → "12,800.50"
F.wan(n)        // 128000 → "12.8万"
F.yuan(n)       // 12800 → "12,800 元"
F.date(d)       // "2026-10-21"
F.md(d)         // "10-21"
F.time(d)       // "10-21 14:30"
F.today()
F.dayOffset(n)
F.diffDays(a,b)
F.daysFromToday(d)   // 负数=已过期
F.percent(a,b)
F.maskPhone(p)
F.shortName(name)    // 头像文字
F.fromNow(d)         // "3小时前"
```

---

## 5. 数据字段速查

### customers
`id, no, name, phone, gender, source, status, level(A/B/C/D), house, area, houseType, style, budget, intention, ownerId, ownerName, createTime, lastFollow, nextFollow, tags[]`

### projects
`id, no, name, customerId, address, area, houseType, projectType, style, status, startDate, planEndDate, actualEndDate, managerId, managerName, designerId, designerName, supervisorName, contractId, contractAmount, budget, cost, received, nodes[], tags[]`
`projectCard()` 追加：`progress, doneNodes, totalNodes, overdueNodes, currentStage, daysLeft, contractWan, costRatio`

### nodes
`id, projectId, seq, name, category, weight, status(未开始/进行中/已完成/已逾期), planStart, planEnd, actualStart, actualEnd, owner, remark, images[]`

### quotes
`id, no, customerId, projectId, title, area, projectType, manageRate, designFee, discount, status, createTime, creator, items[], itemsAmount, manageFee, total`
item：`id, category, name, spec, unit, qty, price, amount`

### contracts
`id, no, customerId, projectId, quoteId, title, amount, signDate, startDate, planEndDate, status, payMode, creator, remark, payPlan[]`
payPlan：`id, name, ratio, amount, dueDate, status(未收款/部分收款/已收款/已逾期), paidAmount, paidDate`

### receipts
`id, contractId, projectId, customerId, planId, amount, method, date, operator, no, remark`

### expenses
`id, no, projectId, category, amount, status(待审批/已通过/已支付/已驳回), applicant, date, approver, approveDate, payDate, remark, supplier`

### materials
`id, no, projectId, name, category, spec, unit, qty, price, amount, supplier, status, orderDate, arriveDate, keeper`

### inspections
`id, projectId, nodeId, type, result(待整改/合格/不合格), inspector, date, items[{name,pass,note}], images[], remark`

### changes
`id, projectId, no, title, amount, status(待确认/待审批/已确认/已驳回), applicant, createTime, confirmTime, reason`

### aftersales
`id, no, projectId, customerId, customerName, phone, type, priority(普通/紧急/特急), status(待受理/处理中/已完成/已关闭), desc, address, createTime, handler, resolveTime, records[{id,time,operator,action,content}]`

### todos
`id, type, title, desc, targetId, targetType, level, status(待处理/已处理/已驳回), createTime, applicant`

---

## 6. 页面清单与路由

| 路由 | 职责 | 负责人 |
|---|---|---|
| `pages/login/index` | 登录 | Lead |
| `pages/workbench/index` | 工作台（tab） | Lead |
| `pages/todo/index` | 待办审批 | Lead |
| `pages/mine/index` | 我的（tab） | Lead |
| `pages/setting/index` | 设置 | Lead |
| `pages/project/list` | 项目列表（tab） | A |
| `pages/project/detail` | 项目详情 | A |
| `pages/project/node` | 施工节点管理 | A |
| `pages/project/inspect` | 巡检记录/新增巡检 | A |
| `pages/aftersale/list` | 售后工单列表 | A |
| `pages/aftersale/detail` | 售后工单详情 | A |
| `pages/customer/list` | 客户列表（tab） | B |
| `pages/customer/detail` | 客户详情 | B |
| `pages/customer/edit` | 新增/编辑客户 | B |
| `pages/quote/list` | 报价单列表 | B |
| `pages/quote/detail` | 报价单详情 | B |
| `pages/quote/edit` | 报价单编辑 | B |
| `pages/contract/list` | 合同列表 | B |
| `pages/contract/detail` | 合同详情 | B |
| `pages/finance/index` | 财务中心（tab） | C |
| `pages/finance/receipt` | 收款登记 | C |
| `pages/finance/expense` | 支出登记 | C |
| `pages/material/list` | 材料采购列表 | C |
| `pages/material/detail` | 材料详情 | C |
| `pages/report/index` | 经营报表 | C |

### 跳转约定（务必按此写，否则联调会断链）

```
项目列表 → 项目详情:   /pages/project/detail?id=xxx
项目详情 → 节点:       /pages/project/node?id=<projectId>
项目详情 → 巡检:       /pages/project/inspect?id=<projectId>
项目详情 → 收款:       /pages/finance/receipt?projectId=xxx
项目详情 → 支出:       /pages/finance/expense?projectId=xxx
项目详情 → 材料:       /pages/material/list?projectId=xxx
项目详情 → 合同:       /pages/contract/detail?id=<contractId>
项目详情 → 客户:       /pages/customer/detail?id=<customerId>
项目详情 → 售后:       /pages/aftersale/list?projectId=xxx
客户列表 → 客户详情:   /pages/customer/detail?id=xxx
客户详情 → 报价:       /pages/quote/detail?id=xxx
客户详情 → 合同:       /pages/contract/detail?id=xxx
客户详情 → 新建报价:   /pages/quote/edit?customerId=xxx
报价详情 → 合同:       /pages/contract/detail?id=xxx
合同详情 → 收款:       /pages/finance/receipt?contractId=xxx
财务 → 收款/支出:      /pages/finance/receipt | /pages/finance/expense
财务 → 报表:           /pages/report/index
材料列表 → 材料详情:   /pages/material/detail?id=xxx
售后列表 → 售后详情:   /pages/aftersale/detail?id=xxx
工作台 → 待办:         /pages/todo/index
```

---

## 7. 编码规范

1. **页面四件套齐全**：`index.js` / `index.wxml` / `index.wxss` / `index.json`
2. `index.json` 必须写 `{"navigationBarTitleText": "..."}`，并按需引入组件
3. `Page({})` 中数据统一放 `data`，事件用 `bindtap`，禁止内联 `catchtap=""` 空实现
4. 列表渲染必须写 `wx:key`（用 `id` 或 `index`）
5. 计算/格式化在 JS 中完成，**WXML 里禁止调用函数**（小程序不支持）
6. 所有金额展示使用 `F.money` / `F.wan`
7. 空列表必须用 `<t-empty>`，不要留白
8. 交互反馈用 `wx.showToast({ title, icon:'none' })`，确认用 `wx.showModal`
9. 不写 `console.log` 遗留调试
10. 中文文案，语气专业简洁；金额数字用 `.bold-num`
11. 每个可点击的列表项要有 `hover-class` 或 `.card-hover`
12. 禁止跨页面修改别人负责的文件

---

## 8. 页面实现要求（通用）

每个列表页需具备：
- 顶部筛选/分段控件
- 数据卡片列表
- 空状态
- 下拉刷新（`onPullDownRefresh` + `enablePullDownRefresh`）

每个详情页需具备：
- 头部关键信息卡（名称/状态/金额/进度）
- 分块信息区
- 底部操作栏（`.bottom-bar` + `.bottom-placeholder`）
- 有意义的操作能真实写回 store，并 toast 提示

每个表单页需具备：
- 校验必填项
- 提交后写入 store 并 `wx.navigateBack()`
- 保存成功后上一页 `onShow` 能刷新出最新数据

---

## 9. 自测清单（提交前逐条过）

- [ ] 微信开发者工具「编译」无报错、无 WXML 编译错误
- [ ] 页面在 iPhone 12 尺寸下布局正常，不横向溢出
- [ ] 所有跳转链接目标页面存在且参数名正确
- [ ] 空数据时显示空状态
- [ ] 新增/编辑操作后返回上一页，数据已刷新
- [ ] 无未使用的 `require`，无拼写错误的组件路径
- [ ] 无 `undefined` 出现在界面上

---

## 10. 协作规则

- 只改自己负责的 `pages/` 子目录，**不要碰** `data/`、`utils/`、`components/`、`app.*`
- 如需新增共享工具方法 → 先告知 Lead
- 页面已完成但缺字段 → 用 store 已有字段组合，不要改 seed
- 每完成一个页面，尽快落盘，避免长时间占用
- 全部完成后在群里汇报：完成了哪些页面 + 已知问题
