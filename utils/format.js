/**
 * 格式化工具，全项目唯一来源。
 */

/** 金额千分位：12800.5 -> 12,800.50 */
function money(n, digits = 2) {
  const num = Number(n);
  if (isNaN(num)) return '0.00';
  const fixed = Math.abs(num).toFixed(digits);
  const [int, dec] = fixed.split('.');
  const withSep = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (num < 0 ? '-' : '') + withSep + (digits > 0 && dec !== undefined ? '.' + dec : '');
}

/** 大额金额用万元展示：128000 -> 12.8万 */
function wan(n, digits = 1) {
  const num = Number(n) || 0;
  if (Math.abs(num) < 10000) return money(num, 0) + '元';
  return (num / 10000).toFixed(digits) + '万';
}

/** 金额 + 元 */
function yuan(n) {
  return money(n, 0) + ' 元';
}

/** Date -> YYYY-MM-DD */
function date(d) {
  if (!d) return '';
  const t = d instanceof Date ? d : new Date(String(d).replace(/-/g, '/'));
  if (isNaN(t.getTime())) return String(d);
  const p = (x) => String(x).padStart(2, '0');
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
}

/** Date -> MM-DD */
function md(d) {
  const s = date(d);
  return s ? s.slice(5) : '';
}

/** Date -> MM-DD HH:mm */
function time(d) {
  if (!d) return '';
  const t = d instanceof Date ? d : new Date(String(d).replace(/-/g, '/'));
  if (isNaN(t.getTime())) return String(d);
  const p = (x) => String(x).padStart(2, '0');
  return `${p(t.getMonth() + 1)}-${p(t.getDate())} ${p(t.getHours())}:${p(t.getMinutes())}`;
}

/** 今天 YYYY-MM-DD */
function today() {
  return date(new Date());
}

/** 相对今天偏移 n 天的日期字符串 */
function dayOffset(n, base) {
  const d = base ? new Date(String(base).replace(/-/g, '/')) : new Date();
  d.setDate(d.getDate() + n);
  return date(d);
}

/** 两个日期相差天数（b - a） */
function diffDays(a, b) {
  if (!a || !b) return 0;
  const t1 = new Date(String(a).replace(/-/g, '/')).getTime();
  const t2 = new Date(String(b).replace(/-/g, '/')).getTime();
  return Math.round((t2 - t1) / 86400000);
}

/** 距离今天还有多少天，负数表示已过 */
function daysFromToday(d) {
  return diffDays(today(), date(d));
}

/** 百分比，保留整数 */
function percent(part, total) {
  const p = Number(part) || 0;
  const t = Number(total) || 0;
  if (t === 0) return 0;
  return Math.min(100, Math.max(0, Math.round((p / t) * 100)));
}

/** 手机号脱敏 */
function maskPhone(p) {
  const s = String(p || '');
  return s.length >= 7 ? s.slice(0, 3) + '****' + s.slice(-4) : s;
}

/** 姓名取末两字做头像 */
function shortName(name) {
  const s = String(name || '');
  return s.length > 2 ? s.slice(-2) : s;
}

/** 相对时间描述 */
function fromNow(d) {
  const t = new Date(String(d).replace(/-/g, '/')).getTime();
  if (isNaN(t)) return '';
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return m + '分钟前';
  const h = Math.floor(m / 60);
  if (h < 24) return h + '小时前';
  const dd = Math.floor(h / 24);
  if (dd < 30) return dd + '天前';
  return md(d);
}

module.exports = {
  money,
  wan,
  yuan,
  date,
  md,
  time,
  today,
  dayOffset,
  diffDays,
  daysFromToday,
  percent,
  maskPhone,
  shortName,
  fromNow
};
