/**
 * 全局配置
 *
 * 云开发接入步骤：
 * 1. 微信开发者工具 → 云开发 → 开通，拿到环境 ID（形如 zhuangxiu-erp-3gkxxxxx）
 * 2. 把环境 ID 填到下面的 cloudEnv
 * 3. 右键 cloudfunctions/login、cloudfunctions/sync → 上传并部署（云端安装依赖）
 * 4. 把 useCloud 改成 true，重新编译
 *
 * 未开启时整套系统仍可离线运行（本地存储）。
 *
 * ⚠️ 开源仓库请勿提交真实值：AppID、云环境 ID、客服手机号都属于你的私有配置，
 *    本地开发建议改用 `.gitignore` 中的本地覆盖文件，或提交前手动清空。
 */
module.exports = {
  version: '1.3.1',

  /**
   * 演示模式
   * true  ：首次启动写入演示数据（10 客户 / 6 项目…），登录页展示演示账号 —— 开发体验用
   * false ：空库启动，首次进入引导创建团队 —— 上线必须用这个
   */
  demoMode: true,

  // 是否启用云同步（true 后团队数据跨设备共享）
  useCloud: false,

  // 云开发环境 ID（公开仓库请勿填写真实环境 ID）
  cloudEnv: '',

  // 修改后多久推送到云端（毫秒），避免连续操作频繁请求
  syncDebounceMs: 800,

  // 单次推送最多携带记录数（云函数有请求体上限）
  pushChunkSize: 200,

  /**
   * 法律文本信息
   * 需与「微信公众平台 → 设置 → 服务内容声明 → 用户隐私保护指引」保持一致，
   * 否则审核可能因两处信息不符被驳回。
   */
  operatorName: '示例团队（部署前替换为你的主体名称）',
  supportPhone: '',
  legalUpdatedAt: '2026-10-23',

  // 协议版本号：变更实质内容时递增，用户需重新同意
  legalVersion: '1.0'
};
