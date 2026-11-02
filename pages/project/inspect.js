const store = require('../../data/store');
const F = require('../../utils/format');
const C = require('../../utils/constants');
const upload = require('../../utils/upload');

const RESULT_COLOR = { 合格: 'green', 待整改: 'orange', 不合格: 'red' };
const DEFAULT_ITEMS = ['水电管线走向', '防水闭水试验', '瓷砖空鼓率', '木作垂直度'];

Page({
  data: {
    id: '',
    project: {},
    list: [],
    expandedId: '',
    showPopup: false,
    form: {
      type: '日常巡检',
      result: '合格',
      items: [],
      remark: '',
      images: []
    },
    typeOptions: C.INSPECT_TYPE,
    resultOptions: C.INSPECT_RESULT,
    typeIndex: 0,
    resultIndex: 1
  },

  onLoad(options) {
    this.setData({ id: (options && options.id) || '' });
    this.resetForm();
  },

  onShow() {
    if (this.data.id) this.load();
  },

  onPullDownRefresh() {
    this.load();
    wx.stopPullDownRefresh();
  },

  resetForm() {
    this.setData({
      form: {
        type: '日常巡检',
        result: '',   // 必须由巡检人明确判定
        items: DEFAULT_ITEMS.map((name) => ({ name, pass: null, note: '' })),
        remark: '',
        images: []
      },
      typeIndex: 0,
      resultIndex: -1
    });
  },

  load() {
    const id = this.data.id;
    const project = store.find('projects', id);
    if (!project) {
      wx.showToast({ title: '项目不存在', icon: 'none' });
      return;
    }

    const list = store.inspectionsOfProject(id).map((i) => {
      const items = i.items || [];
      return {
        id: i.id,
        type: i.type,
        result: i.result,
        resultColor: RESULT_COLOR[i.result] || 'gray',
        inspector: i.inspector,
        date: F.date(i.date),
        remark: i.remark || '',
        passCount: items.filter((x) => x.pass).length,
        totalCount: items.length,
        items: items.map((x) => ({
          name: x.name,
          pass: x.pass,
          note: x.note || ''
        })),
        images: i.images || [],
        hasImages: !!(i.images && i.images.length),
        expanded: this.data.expandedId === i.id
      };
    });

    this.setData({
      project: { name: project.name, managerName: project.managerName },
      list
    });
  },

  toggleExpand(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ expandedId: this.data.expandedId === id ? '' : id });
    this.load();
  },

  openPopup() {
    this.resetForm();
    this.setData({ showPopup: true });
  },

  closePopup() {
    this.setData({ showPopup: false });
  },

  onTypeChange(e) {
    const index = Number(e.detail.value);
    this.setData({
      typeIndex: index,
      'form.type': this.data.typeOptions[index]
    });
  },

  onResultChange(e) {
    const index = Number(e.detail.value);
    this.setData({
      resultIndex: index,
      'form.result': this.data.resultOptions[index]
    });
  },

  toggleItem(e) {
    const index = e.currentTarget.dataset.index;
    const items = this.data.form.items;
    const key = 'form.items[' + index + '].pass';
    this.setData({ [key]: !items[index].pass });
  },

  onItemNote(e) {
    const index = e.currentTarget.dataset.index;
    const key = 'form.items[' + index + '].note';
    this.setData({ [key]: e.detail.value });
  },

  onRemark(e) {
    this.setData({ 'form.remark': e.detail.value });
  },

  // ---------------- 现场照片 ----------------

  /** 选择现场照片（最多 9 张） */
  onChooseImage() {
    const current = (this.data.form.images || []).length;
    if (current >= 9) {
      wx.showToast({ title: '最多 9 张', icon: 'none' });
      return;
    }
    const that = this;
    upload.chooseImages(9 - current).then(async (paths) => {
      if (!paths.length) return;
      wx.showLoading({ title: '处理中', mask: true });
      const res = await upload.uploadImages(paths);
      wx.hideLoading();
      that.setData({ 'form.images': (that.data.form.images || []).concat(res.urls) });
      if (res.failed) {
        wx.showToast({ title: res.failed + ' 张照片上传失败，请重试', icon: 'none' });
      }
    });
  },

  onPreviewImage(e) {
    const list = this.data.form.images || [];
    const idx = e.currentTarget.dataset.index;
    upload.previewImages(list, list[idx]);
  },

  onDeleteImage(e) {
    const idx = e.currentTarget.dataset.index;
    const list = (this.data.form.images || []).slice();
    list.splice(idx, 1);
    this.setData({ 'form.images': list });
  },

  /** 预览已保存巡检的照片 */
  onPreviewSaved(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.list.find((x) => x.id === id);
    if (!item) return;
    upload.previewImages(item.images || [], (item.images || [])[0]);
  },

  submit() {
    const f = this.data.form;
    if (!f.result) {
      wx.showToast({ title: '请选择巡检结论', icon: 'none' });
      return;
    }
    if (f.items.some((x) => x.pass === null || x.pass === undefined)) {
      wx.showToast({ title: '请逐项确认检查结果', icon: 'none' });
      return;
    }
    if (!f.remark.trim() && f.result !== '合格') {
      wx.showToast({ title: '请填写整改说明', icon: 'none' });
      return;
    }

    store.addInspection(this.data.id, {
      type: f.type,
      result: f.result,
      items: f.items.map((x) => ({ name: x.name, pass: x.pass, note: x.note || '' })),
      remark: f.remark,
      images: f.images || []
    });

    this.setData({ showPopup: false });
    wx.showToast({ title: '巡检已记录', icon: 'success' });
    this.load();
  }
});
