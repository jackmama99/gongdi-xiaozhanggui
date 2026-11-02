/**
 * 云开发适配层
 *
 * 设计要点：
 * 1. 页面永远读本地缓存（同步），云同步在后台异步进行 —— 27 个页面无需改造；
 * 2. 未开启云开发 / 无 wx.cloud 时，所有方法安全空跑，不影响离线使用；
 * 3. 通过 setTransport() 可注入传输实现，便于 Node 端测试。
 */
const config = require('../config');

// 可注入的传输层 { call(name, data) => Promise<any> }
let transport = null;
let openid = '';
let inited = false;

function setTransport(t) {
  transport = t;
}

function hasCloud() {
  return typeof wx !== 'undefined' && !!wx.cloud;
}

/** 云同步是否可用 */
function enabled() {
  if (!config.useCloud) return false;
  return !!(transport || hasCloud());
}

/** 初始化云开发（幂等） */
function init() {
  if (!enabled() || inited) return enabled();
  if (transport) {
    inited = true;
    return true;
  }
  try {
    wx.cloud.init({
      env: config.cloudEnv || undefined,
      traceUser: true
    });
    inited = true;
  } catch (e) {
    console.warn('[cloud] 初始化失败', e);
    return false;
  }
  return true;
}

/** 调用云函数 */
async function call(name, data) {
  if (transport) return transport.call(name, data);
  const res = await wx.cloud.callFunction({ name, data });
  return res && res.result;
}

/** 登录：拿到当前微信用户 openid */
async function ensureLogin() {
  if (openid) return openid;
  if (!init()) return '';
  try {
    const r = await call('login', {});
    if (r && r.ok && r.openid) openid = r.openid;
  } catch (e) {
    console.warn('[cloud] 登录失败', e);
  }
  return openid;
}

function getOpenid() {
  return openid;
}

/** 拉取整个团队的数据 */
async function pullTeam(teamId) {
  if (!enabled()) return null;
  if (!init()) return null;
  try {
    const r = await call('sync', { action: 'pull', teamId });
    if (!r || !r.ok) {
      console.warn('[cloud] 拉取失败', r && r.msg);
      return null;
    }
    return r.collections || {};
  } catch (e) {
    console.warn('[cloud] 拉取异常', e);
    return null;
  }
}

/**
 * 推送团队数据（按集合分批）
 * @param {string} teamId
 * @param {Object} payload { collectionName: records[] }
 */
async function pushTeam(teamId, payload) {
  if (!enabled()) return false;
  if (!init()) return false;
  const result = { ok: true };
  try {
    const names = Object.keys(payload || {});
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const records = payload[name] || [];
      if (!records.length) continue;
      // 分批，避免单次请求过大
      for (let start = 0; start < records.length; start += config.pushChunkSize) {
        const chunk = records.slice(start, start + config.pushChunkSize);
        const r = await call('sync', { action: 'push', teamId, name, records: chunk });
        if (!r || !r.ok) {
          console.warn('[cloud] 推送失败', name, r && r.msg);
          result.ok = false;
        }
      }
    }
  } catch (e) {
    console.warn('[cloud] 推送异常', e);
    result.ok = false;
  }
  return result.ok;
}

/**
 * 自举：上报团队与成员（在成员关系建立前调用，服务端只做 openid 轻校验）
 * @param {string} teamId
 * @param {object} team 团队记录
 * @param {array} members 成员记录（含当前用户，带 openid）
 */
async function bootstrapTeam(teamId, team, members) {
  if (!enabled()) return false;
  if (!init()) return false;
  try {
    const r = await call('sync', { action: 'bootstrap', teamId, team, members });
    return !!(r && r.ok);
  } catch (e) {
    console.warn('[cloud] 团队自举失败', e);
    return false;
  }
}

/**
 * 微信一键登录：用 openid 在云端反查成员与团队
 * @returns {Promise<{ok:boolean, found?:boolean, user?:object, team?:object, msg?:string}>}
 */
async function whoami() {
  if (!enabled()) return { ok: false, msg: '云端未启用' };
  if (!init()) return { ok: false, msg: '云端初始化失败' };
  try {
    const r = await call('sync', { action: 'whoami' });
    if (!r) return { ok: false, msg: '云端无响应' };
    return r;
  } catch (e) {
    console.warn('[cloud] 一键登录失败', e);
    return { ok: false, msg: '网络异常，请重试' };
  }
}

/**
 * 凭邀请码加入团队（云端校验，返回团队信息）
 * @param {string} inviteCode
 * @param {object} member 成员记录（name/phone/role/...）
 */
async function joinByCode(inviteCode, member) {
  if (!enabled()) return null;
  if (!init()) return null;
  try {
    const r = await call('sync', { action: 'join', inviteCode, member });
    if (!r || !r.ok) return { ok: false, msg: (r && r.msg) || '加入失败' };
    return { ok: true, team: r.team, memberId: r.memberId };
  } catch (e) {
    console.warn('[cloud] 加入团队失败', e);
    return { ok: false, msg: '网络异常，请重试' };
  }
}

module.exports = {
  enabled,
  init,
  call,
  ensureLogin,
  getOpenid,
  pullTeam,
  pushTeam,
  bootstrapTeam,
  joinByCode,
  whoami,
  setTransport,
  // 供测试重置内部状态
  _reset() {
    transport = null;
    openid = '';
    inited = false;
  }
};
