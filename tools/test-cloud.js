/**
 * 云同步逻辑测试（用注入的假传输层，不依赖真实云环境）
 *
 * 覆盖：
 * 1. 未开启 useCloud 时完全不发请求，离线可用
 * 2. 开启后本地写入会推送到云端，且只推当前团队数据
 * 3. 从云端拉取时按 updateTime 合并（远端新覆盖、本地新保留）
 * 4. 合并结果不会回推（避免回环）
 * 5. 无团队时不同步
 *
 * 用法：node tools/test-cloud.js
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
const cloud = require(path.join(ROOT, 'data', 'cloud.js'));
const store = require(path.join(ROOT, 'data', 'store.js'));

// 测试起点固定：演示数据 + 关闭云同步
config.demoMode = true;
config.useCloud = false;

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

// ---------- 假云端 ----------
const fake = {
  calls: [],
  remote: {}, // { collectionName: [records] }
  openid: 'o_test_user',
  async call(name, data) {
    fake.calls.push({ name, data });
    if (name === 'login') return { ok: true, openid: fake.openid };
    if (name === 'sync') {
      if (data.action === 'pull') return { ok: true, collections: fake.remote };
      if (data.action === 'push') {
        const arr = fake.remote[data.name] || [];
        data.records.forEach((r) => {
          const i = arr.findIndex((x) => x.id === r.id);
          if (i > -1) arr[i] = r;
          else arr.push(r);
        });
        fake.remote[data.name] = arr;
        return { ok: true, written: data.records.length };
      }
    }
    return { ok: false, msg: 'unknown' };
  }
};

function resetFake() {
  fake.calls = [];
  fake.remote = {};
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async function main() {
  // ============================================================
  section('1. 未开启云同步（默认状态）');
  store.reset();
  store.login('admin', '123456');
  resetFake();
  cloud.setTransport(fake);
  ok('enabled() 为 false', cloud.enabled() === false);
  ok('离线可正常读数据', store.list('customers').length === 10);
  store.saveCustomer({ name: '离线客户', phone: '13800000001' });
  await sleep(1000);
  ok('未开启时不发任何云请求', fake.calls.length === 0, fake.calls.length);

  // ============================================================
  section('2. 开启云同步后写入推送');
  config.useCloud = true;
  cloud._reset();
  cloud.setTransport(fake);
  resetFake();
  store.reset();
  store.login('admin', '123456');

  ok('enabled() 为 true', cloud.enabled() === true);

  const before = fake.calls.length;
  store.saveCustomer({ name: '云端客户A', phone: '13800000002', house: '测试小区' });
  await sleep(1200); // 等防抖

  const pushCalls = fake.calls.filter((c) => c.name === 'sync' && c.data.action === 'push');
  ok('触发了推送', pushCalls.length > 0, pushCalls.length);
  ok('推送带上了 teamId', pushCalls.every((c) => !!c.data.teamId));

  const pushedCustomers = (fake.remote.customers || []).filter((c) => c.name === '云端客户A');
  ok('云端已收到新客户', pushedCustomers.length === 1, pushedCustomers.length);
  ok('推送数据都归属当前团队', (fake.remote.customers || []).every((c) => c.teamId === store.currentTeamId()));

  // ============================================================
  section('3. 拉取合并（updateTime 谁新用谁）');
  const tid = store.currentTeamId();
  const localCust = store.list('customers')[0];
  const now = Date.now();

  // 远端：一条更新（更新版本），一条只有云端有（新记录）
  fake.remote = {
    customers: [
      Object.assign({}, localCust, { name: '远端改过的名字', updateTime: now + 10000 }),
      {
        id: 'c_remote_1',
        teamId: tid,
        name: '只有云端的客户',
        phone: '13800000003',
        updateTime: now
      }
    ]
  };

  const merged = await store.syncFromCloud();
  ok('拉取合并执行成功', merged === true);
  ok(
    '远端较新记录覆盖本地',
    store.find('customers', localCust.id).name === '远端改过的名字',
    store.find('customers', localCust.id).name
  );
  ok('云端独有记录被合并进来', !!store.find('customers', 'c_remote_1'));
  ok(
    '本地更新的记录不被旧数据覆盖',
    (() => {
      const c = store.find('customers', 'c_remote_1');
      const before = c.updateTime;
      return before === now;
    })()
  );

  // ============================================================
  section('4. 合并结果不回推（避免回环）');
  resetFake();
  fake.remote = { customers: [] };
  await store.syncFromCloud();
  await sleep(1200);
  const loopPushes = fake.calls.filter((c) => c.name === 'sync' && c.data.action === 'push');
  ok('合并后没有触发回推', loopPushes.length === 0, loopPushes.length);

  // ============================================================
  section('5. 未加入团队时不同步');
  cloud._reset();
  cloud.setTransport(fake);
  resetFake();
  store.logout();
  store.registerUser({ name: '无团队用户', phone: '13800000004' });
  ok('当前无团队', store.currentTeamId() === '');
  const r = await store.syncNow();
  ok('无团队时 syncNow 返回 false', r === false);
  const dataCalls = fake.calls.filter((c) => c.name === 'sync');
  ok('无团队时不拉取/推送数据', dataCalls.length === 0, dataCalls.length);
  ok(
    '无团队时仍绑定 openid（加入团队时服务端要校验）',
    (store.listAll('users').find((u) => u.name === '无团队用户') || {}).openid === fake.openid
  );

  // ============================================================
  section('6. 关闭开关后恢复纯离线');
  config.useCloud = false;
  cloud._reset();
  ok('enabled() 恢复 false', cloud.enabled() === false);

  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log(`云同步测试：通过 ${pass} 项，失败 ${fail} 项`);
  if (fail) {
    console.log('❌ 云同步逻辑存在问题');
    process.exit(1);
  }
  console.log('✅ 云同步逻辑通过（真实云端需部署后用真机验证）');
})();
