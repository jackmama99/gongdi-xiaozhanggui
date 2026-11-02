/**
 * 团队机制测试
 *
 * 覆盖：
 * 1. 未登录不可见任何数据
 * 2. 演示团队与邀请码
 * 3. 老板 / 普通成员的角色权限
 * 4. 新用户用邀请码加入团队，加入后可见团队客户
 * 5. 团队内新增数据，其他成员可见（共享）
 * 6. 另建团队后数据互相隔离
 * 7. 老板管理成员（改角色 / 移除），非老板不可
 *
 * 用法：node tools/test-team.js
 */
const path = require('path');

const mem = new Map();
global.wx = {
  getStorageSync: (k) => (mem.has(k) ? JSON.parse(mem.get(k)) : ''),
  setStorageSync: (k, v) => mem.set(k, JSON.stringify(v)),
  removeStorageSync: (k) => mem.delete(k),
  showToast: () => {},
  navigateTo: () => {},
  switchTab: () => {},
  reLaunch: () => {},
  navigateBack: () => {}
};

const ROOT = path.join(__dirname, '..');
const config = require(path.join(ROOT, 'config.js'));
config.demoMode = true;
config.useCloud = false;
const store = require(path.join(ROOT, 'data', 'store.js'));

let pass = 0;
let fail = 0;

function ok(name, cond, extra) {
  if (cond) {
    pass++;
    console.log('  ✓ ' + name);
  } else {
    fail++;
    console.log('  ✗ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : ''));
  }
}

function section(t) {
  console.log('\n▶ ' + t);
}

(async () => {
store.reset();

// ============================================================
section('1. 未登录状态');
ok('未登录时客户为空', store.list('customers').length === 0);
ok('未登录时项目为空', store.list('projects').length === 0);
ok('未登录时无团队', store.currentTeam() === null);
ok('isLoggedIn 为 false', store.isLoggedIn() === false);

// ============================================================
section('2. 老板登录（演示团队）');
const adminLogin = store.login('admin', '123456');
ok('登录成功', adminLogin.ok === true);
ok('账号已有团队', adminLogin.needTeam === false);
const team = store.currentTeam();
ok('拿到当前团队', !!team);
ok('团队名 = 种子公司名', team.name === '杭州整装家居设计工程有限公司', team.name);
ok('邀请码为 6 位', String(team.inviteCode).length === 6, team.inviteCode);
ok('登录后可见客户', store.list('customers').length === 10, store.list('customers').length);
ok('当前用户是周文斌', store.getCurrentUser().name === '周文斌');
ok('是老板', store.isOwner() === true);

// ============================================================
section('3. 老板权限');
ok('老板可看财务', store.can('finance') === true);
ok('老板可看报表', store.can('report') === true);
ok('老板可看客户', store.can('customer') === true);
ok('成员数 = 6', store.teamMembers().length === 6, store.teamMembers().length);
ok('成员带 isOwner 标记', store.teamMembers().filter((m) => m.isOwner).length === 1);

// ============================================================
section('4. 普通成员权限（设计师）');
store.logout();
const linLogin = store.login('lin', '123456');
ok('设计师登录成功', linLogin.ok === true);
ok('设计师不是老板', store.isOwner() === false);
ok('设计师可看客户', store.can('customer') === true);
ok('设计师可看报价', store.can('quote') === true);
ok('设计师不可看财务', store.can('finance') === false);
ok('设计师不可看报表', store.can('report') === false);
ok('设计师可见团队客户（共享）', store.list('customers').length === 10, store.list('customers').length);
ok('设计师不可改成员角色', store.updateMemberRole('u_5', '财务').ok === false);
ok('设计师不可移除成员', store.removeMember('u_5').ok === false);

// ============================================================
section('5. 新用户用邀请码加入团队');
const inviteCode = team.inviteCode;
store.logout();
const reg = store.registerUser({ name: '测试新人', phone: '13900001111', role: '设计师' });
ok('注册账号成功', reg.ok === true);
ok('新账号还没有团队', store.currentTeamId() === '');
ok('未入团队看不到客户', store.list('customers').length === 0);

const badJoin = await store.joinTeam({ inviteCode: 'XXXXXX' });
ok('错误邀请码被拒绝', badJoin.ok === false);

const join = await store.joinTeam({ inviteCode: inviteCode, role: '设计师' });
ok('用正确邀请码加入成功', join.ok === true);
ok('加入的团队正确', store.currentTeamId() === team.id);
ok('加入后能看到团队客户', store.list('customers').length === 10, store.list('customers').length);
ok('成员数变为 7', store.teamMembers().length === 7, store.teamMembers().length);
ok('新成员角色为设计师', store.getCurrentUser().role === '设计师', store.getCurrentUser().role);

// ============================================================
section('6. 团队内数据共享');
const beforeCount = store.list('customers').length;
const newCust = store.saveCustomer({
  name: '新人录入的客户',
  phone: '13900002222',
  source: '朋友介绍',
  status: '新线索',
  level: 'B',
  house: '共享测试小区',
  area: 100,
  budget: 200000
});
ok('新成员可新增客户', !!newCust.id);
ok('新客户自动归属当前团队', newCust.teamId === team.id, newCust.teamId);
ok('团队客户数 +1', store.list('customers').length === beforeCount + 1);

// 切回老板，应能看到新人录入的客户
store.logout();
store.login('admin', '123456');
ok('老板能看到新人录入的客户', !!store.find('customers', newCust.id));
ok('老板侧客户数同步 +1', store.list('customers').length === beforeCount + 1);

// ============================================================
section('7. 团队隔离');
store.logout();
const reg2 = store.registerUser({ name: '李四', phone: '13900003333' });
ok('第二个新账号注册成功', reg2.ok === true);
const createRes = store.createTeam({ name: '李四独立工作室', city: '宁波', industry: '家装 / 整装' });
ok('创建团队成功', createRes.ok === true);
ok('创建者是老板', store.isOwner() === true);
ok('新团队邀请码不同于演示团队', store.currentTeam().inviteCode !== inviteCode);
ok('新团队看不到别人的客户', store.list('customers').length === 0, store.list('customers').length);
ok('新团队看不到别人的项目', store.list('projects').length === 0);
ok('新团队只有 1 名成员', store.teamMembers().length === 1, store.teamMembers().length);
ok('新团队可以独立建客户', !!store.saveCustomer({ name: '独立客户', phone: '13900004444' }).id);
ok('新团队客户数为 1', store.list('customers').length === 1);

// ============================================================
section('8. 回到演示团队，数据未被污染');
store.logout();
store.login('admin', '123456');
ok('演示团队客户数正确', store.list('customers').length === beforeCount + 1, store.list('customers').length);
ok('看不到独立团队的客户', !store.list('customers').some((c) => c.name === '独立客户'));
ok('项目数据完整', store.list('projects').length === 6, store.list('projects').length);

// ============================================================
section('9. 老板管理成员');
const members = store.teamMembers();
const target = members.find((m) => m.id !== store.getCurrentUser().id && !m.isOwner);
ok('找到可管理成员', !!target);
const roleRes = store.updateMemberRole(target.id, '财务');
ok('老板可改角色', roleRes.ok === true);
ok('角色已更新', store.listAll('users').find((u) => u.id === target.id).role === '财务');
ok('不能移除老板自己', store.removeMember(store.getCurrentUser().id).ok === false);

const removeRes = store.removeMember(target.id);
ok('老板可移除成员', removeRes.ok === true);
ok('移除后成员数 -1', store.teamMembers().length === members.length - 1, store.teamMembers().length);
ok('被移除者不再属于团队', store.listAll('users').find((u) => u.id === target.id).teamId === '');

// ============================================================
section('10. 邀请码重置');
const oldCode = store.currentTeam().inviteCode;
const regen = store.regenerateInviteCode();
ok('重置成功', regen.ok === true);
ok('邀请码已变化', store.currentTeam().inviteCode !== oldCode);
ok('旧邀请码失效', (await store.joinTeam({ inviteCode: oldCode })).ok === false);
ok('新邀请码可用', (await store.joinTeam({ inviteCode: store.currentTeam().inviteCode })).ok === true);

// ============================================================
console.log('\n' + '='.repeat(60));
console.log(`团队机制测试：通过 ${pass} 项，失败 ${fail} 项`);
if (fail) {
  console.log('❌ 团队机制存在问题');
  process.exit(1);
}
console.log('✅ 团队机制全部通过');
})();
