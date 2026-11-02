/**
 * 云函数：setup（一次性初始化，可重复执行）
 * 作用：幂等创建业务集合，供首次上线使用
 * 用法：部署后在模拟器调用一次；确认 14 个集合齐全后请务必在控制台删除本函数
 */
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

const COLLECTIONS = [
  'teams',
  'users',
  'customers',
  'follows',
  'quotes',
  'contracts',
  'projects',
  'inspections',
  'changes',
  'receipts',
  'expenses',
  'materials',
  'aftersales',
  'todos'
];

exports.main = async () => {
  const created = [];
  const existed = [];
  const failed = [];

  for (const name of COLLECTIONS) {
    try {
      await db.createCollection(name);
      created.push(name);
    } catch (e) {
      const msg = (e && (e.errMsg || e.message)) || String(e);
      if (/exist/i.test(msg)) {
        existed.push(name);
      } else {
        failed.push({ name, msg });
      }
    }
  }

  return { ok: failed.length === 0, total: COLLECTIONS.length, created, existed, failed };
};
