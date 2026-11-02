Component({
  properties: {
    visible: { type: Boolean, value: false },
    title: { type: String, value: '请选择' },
    cancelText: { type: String, value: '取消' },
    confirmText: { type: String, value: '确定' },
    maxHeight: { type: String, value: '70vh' }
  },
  methods: {
    noop() {},
    onMask() {
      this.triggerEvent('cancel');
    },
    onCancel() {
      this.triggerEvent('cancel');
    },
    onConfirm() {
      this.triggerEvent('confirm');
    }
  }
});
