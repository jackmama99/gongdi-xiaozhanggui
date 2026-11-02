'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const source = path.join(root, 'utils', 'business.js');
const target = path.join(root, 'cloudfunctions', 'sync', 'business.js');
const content = fs.readFileSync(source, 'utf8');
if (process.argv.includes('--check')) {
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== content) {
    console.error('云函数业务规则副本未同步，请运行 node tools/prepare-cloud.js');
    process.exit(1);
  }
} else {
  fs.writeFileSync(target, content);
  console.log('已同步客户端与云函数业务规则');
}
