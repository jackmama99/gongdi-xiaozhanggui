/**
 * 云函数：login
 * 作用：返回当前微信用户的 openid，供客户端绑定账号
 */
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async () => {
  const ctx = cloud.getWXContext();
  return {
    ok: true,
    openid: ctx.OPENID,
    appid: ctx.APPID,
    unionid: ctx.UNIONID || ''
  };
};
