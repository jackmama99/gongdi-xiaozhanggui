// 读取最近日志中的编译/运行时错误（小程序模式后）
const fs = require('fs');
const path = require('path');

const logDir = path.join(
  process.env.LOCALAPPDATA,
  '微信开发者工具',
  'User Data',
  '2ca4252ffa87560ea1fd48b913e45179',
  'WeappLog',
  'logs'
);

const logs = fs
  .readdirSync(logDir)
  .filter((f) => f.endsWith('.log'))
  .map((f) => ({ f, m: fs.statSync(path.join(logDir, f)).mtimeMs }))
  .sort((a, b) => b.m - a.m);

const latest = path.join(logDir, logs[0].f);
const text = fs.readFileSync(latest, 'utf8');
const lines = text.split(/\r?\n/);

console.log('日志:', logs[0].f, '| 行数:', lines.length);

// 找最后一条 miniProgram 编译记录的位置
let lastMini = -1;
lines.forEach((l, i) => {
  if (l.indexOf('miniProgram') > -1) lastMini = i;
});
console.log('最后 miniProgram 记录所在行:', lastMini);

// 之后的所有 WARN / ERROR
console.log('\n==== 小程序模式后的 WARN / ERROR ====');
let shown = 0;
for (let i = Math.max(0, lastMini - 20); i < lines.length; i++) {
  const l = lines[i];
  if (!/\[(ERROR|WARN)\]/.test(l)) continue;
  if (/markDevLaunchEnd|getManifest|vendor-timeline|registercommandHandler|onDynamicSimulatorStateChange/.test(l)) continue;
  console.log(i + ': ' + l.slice(0, 400));
  if (++shown > 30) break;
}
if (!shown) console.log('（无）');

// 页面相关日志
console.log('\n==== 页面/编译相关（末尾 25 条） ====');
const rel = [];
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (/pageframe|WXML|wxml|AppService|appservice|compile|Compile|page load|Page not found|sitemap|app\.json/i.test(l)) {
    rel.push(i + ': ' + l.slice(0, 260));
  }
}
rel.slice(-25).forEach((x) => console.log(x));
