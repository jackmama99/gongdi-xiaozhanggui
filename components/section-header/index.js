Component({
  properties: {
    title: { type: String, value: '' },
    sub: { type: String, value: '' },
    extra: { type: String, value: '' },
    bar: { type: Boolean, value: true },
    barColor: { type: String, value: '#1D4E89' }
  },
  methods: {
    onExtra() {
      this.triggerEvent('extra');
    }
  }
});
