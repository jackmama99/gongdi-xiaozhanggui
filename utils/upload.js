/**
 * 图片选择与上传
 *
 * 未开启云开发时：只保存本地临时路径（换设备不可见，仅本机演示用）
 * 开启云开发后：上传到云存储，记录 fileID（跨设备可见）
 */
const cloud = require('../data/cloud');

/**
 * 选择图片
 * @param {number} count 最多可选张数
 * @returns {Promise<string[]>} 本地临时路径数组
 */
function chooseImages(count) {
  const max = count || 9;
  return new Promise((resolve) => {
    if (typeof wx === 'undefined') return resolve([]);

    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: max,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed'],
        success(res) {
          resolve((res.tempFiles || []).map((f) => f.tempFilePath));
        },
        fail() {
          resolve([]);
        }
      });
      return;
    }

    // 低版本兜底
    wx.chooseImage({
      count: max,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success(res) {
        resolve(res.tempFilePaths || []);
      },
      fail() {
        resolve([]);
      }
    });
  });
}

/**
 * 上传图片：云开发可用则上传，否则原样返回本地路径
 * @param {string[]} paths
 * @returns {Promise<{urls:string[], failed:number}>} 上传结果与失败张数
 */
async function uploadImages(paths) {
  if (!paths || !paths.length) return { urls: [], failed: 0 };
  if (!cloud.enabled()) return { urls: paths.slice(), failed: 0 };

  const out = [];
  let failed = 0;
  for (let i = 0; i < paths.length; i++) {
    const p = paths[i];
    // 已经是 fileID / 网络地址，不重复上传
    if (String(p).indexOf('cloud://') === 0 || String(p).indexOf('http') === 0) {
      out.push(p);
      continue;
    }
    try {
      const res = await wx.cloud.uploadFile({
        cloudPath: 'photos/' + Date.now() + '_' + i + '.jpg',
        filePath: p
      });
      out.push(res.fileID);
    } catch (e) {
      // 不再把本地临时路径当成功：换设备后它必然失效
      console.warn('[upload] 上传失败', e);
      failed++;
    }
  }
  return { urls: out, failed };
}

/**
 * 预览图片
 * wx.previewImage 不认 cloud:// fileID，必须先换成临时链接。
 */
function previewImages(urls, current) {
  if (!urls || !urls.length) return;
  const list = urls.slice();
  const cloudIds = list.filter((u) => String(u).indexOf('cloud://') === 0);

  const open = (resolved) => {
    const idx = current ? list.indexOf(current) : -1;
    let cur = idx > -1 ? resolved[idx] : resolved[0];
    // 兜底：若仍未解析成临时链接，就退回第一张，避免 previewImage 直接失败
    if (cur && String(cur).indexOf('cloud://') === 0) cur = resolved[0];
    wx.previewImage({ urls: resolved, current: cur });
  };

  if (!cloudIds.length || !cloud.enabled() || !wx.cloud || !wx.cloud.getTempFileURL) {
    open(list);
    return;
  }

  wx.cloud.getTempFileURL({ fileList: cloudIds })
    .then((res) => {
      const map = {};
      ((res && res.fileList) || []).forEach((f) => {
        if (f && f.fileID && f.tempFileURL) map[f.fileID] = f.tempFileURL;
      });
      open(list.map((u) => map[u] || u));
    })
    .catch(() => open(list));
}

/**
 * 转成可直接给 image 组件用的地址
 * fileID 需要换成临时链接；这里返回原值，由页面按需处理
 */
function toDisplayUrl(url) {
  return url;
}

module.exports = {
  chooseImages,
  uploadImages,
  previewImages,
  toDisplayUrl
};
