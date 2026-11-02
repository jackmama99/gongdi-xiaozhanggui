Component({
  properties: {
    percent: { type: Number, value: 0 },
    height: { type: Number, value: 12 },
    // '' | warning | danger | success
    type: { type: String, value: '' },
    showText: { type: Boolean, value: false },
    label: { type: String, value: '' }
  },
  data: {
    typeText: ''
  },
  observers: {
    type(v) {
      this.setData({ typeText: v || '' });
    }
  }
});
