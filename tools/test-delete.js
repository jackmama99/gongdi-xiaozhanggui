/**
 * 软删除 / 作废 测试
 *
 * 覆盖：
 * 1. 删除后 list/find 不可见，但记录仍在库中（软删标记）
 * 2. 权限：非允许角色无权删除
 * 3. 合同作废：状态置「已作废」，不物理删除
 * 4. 删除随云同步思路：软删记录仍在 listAll 中（由云同步带出）
 *
 * 用法：node tools/test-delete.js
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

const config = require(path.join(__dirname, '..', 'config.js'));
config.demoMode = true;
config.useCloud = false;
const store = require(path.join(__dirname, '..', 'data', 'store.js'));

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

store.reset();

// ============================================================
section('1. 老板删除客户');
store.login('admin', '123456');
// 新建一个没有合同/项目的客户，才能删除（有下游单据的客户现在会被拦截）
const c = store.saveCustomer({ name: '待删客户', phone: '13800000000', house: '测试小区' });
const before = store.list('customers').length;
ok('老板有删除权限', store.canDelete('customers') === true);
const busy = store.list('customers').find((x) =>
  store.listAll('contracts').some((ct) => ct.customerId === x.id && ct.status !== '已作废')
);
if (busy) ok('有合同的客户不可删', store.deleteRecord('customers', busy.id).ok === false);
const r = store.deleteRecord('customers', c.id);
ok('删除成功', r.ok === true);
ok('列表数 -1', store.list('customers').length === before - 1);
ok('find 返回 null', store.find('customers', c.id) === null);
ok('记录仍在库（软删）', !!(store.listAll('customers').find((x) => x.id === c.id && x.deleted)));

// ============================================================
section('2. 非允许角色无权删除');
store.logout();
store.login('lin', '123456'); // 设计师
ok('设计师无客户删除权限', store.canDelete('customers') === false);
ok('设计师删除被拒', store.deleteRecord('customers', store.list('customers')[0].id).ok === false);
ok('设计师可删报价', store.canDelete('quotes') === true);

// ============================================================
section('3. 合同作废');
store.logout();
store.login('admin', '123456');
const contract = store.list('contracts').find((x) => x.status !== '已作废');
const vr = store.voidContract(contract.id);
ok('作废成功', vr.ok === true);
ok('状态已作废', store.find('contracts', contract.id).status === '已作废');
ok('作废记录仍在库', !!(store.listAll('contracts').find((x) => x.id === contract.id)));
ok('重复作废被拒', store.voidContract(contract.id).ok === false);

// ============================================================
section('4. 撤销删除（restore）');
const c2 = store.listAll('customers').find((x) => x.deleted);
ok('找到软删客户', !!c2);
ok('恢复成功', store.restore('customers', c2.id) === true);
ok('恢复后可见', !!store.find('customers', c2.id));

// ============================================================
console.log('\n' + '='.repeat(60));
console.log(`删除/作废测试：通过 ${pass} 项，失败 ${fail} 项`);
if (fail) {
  console.log('❌ 存在问题');
  process.exit(1);
}
console.log('✅ 删除/作废逻辑通过');
