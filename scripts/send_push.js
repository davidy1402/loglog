#!/usr/bin/env node

/**
 * PutPut APNs Web Push CLI Test Runner
 *
 * Usage:
 *   node scripts/send_push.js --delay 5
 *   (自动从 Mac 系统剪贴板 pbpaste 读取 iPhone 复制的 PushSubscription)
 *
 *   或者手动指定:
 *   node scripts/send_push.js --file ./subscription.json --delay 5
 *   node scripts/send_push.js --sub '{"endpoint":"https://web.push.apple.com/...","keys":{...}}' --delay 5
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const webpush = require('web-push');

const VAPID = {
  publicKey: 'BESInMhTogu5qLjgz9f8jyMhG2pQRBGYU12USMTFJXrel-L1Ubm-8IQF_MO3lLmREp1_anGdOf1K7Msc-wq4g-g',
  privateKey: 'tpZBQKSfHHiQQoYWIS4SuYA6UHwlqAt3vE9JBDgLDFQ',
  subject: 'mailto:david@davidyong.dev'
};

webpush.setVapidDetails(
  VAPID.subject,
  VAPID.publicKey,
  VAPID.privateKey
);

const args = process.argv.slice(2);
let subJson = null;
let delay = 0;
let title = 'PutPut: 锁屏系统级提醒测试';
let body = '锁屏推送成功！这是由苹果 APNs 唤醒的系统级通知 💧🥗';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--sub' && args[i + 1]) {
    subJson = args[++i];
  } else if (args[i] === '--file' && args[i + 1]) {
    subJson = fs.readFileSync(path.resolve(args[++i]), 'utf8');
  } else if (args[i] === '--delay' && args[i + 1]) {
    delay = parseInt(args[++i], 10) || 0;
  } else if (args[i] === '--title' && args[i + 1]) {
    title = args[++i];
  } else if (args[i] === '--body' && args[i + 1]) {
    body = args[++i];
  }
}

// Check if user accidentally passed literal placeholder text
if (subJson && (subJson.startsWith('<') || subJson.includes('粘贴你的订阅JSON'))) {
  console.warn('⚠️ 提示: 你直接传入了占位符文字 "' + subJson + '"。');
  console.warn('正在尝试从剪贴板或本地文件中查找真实的订阅凭证...\n');
  subJson = null;
}

// 1. Try reading from default scripts/subscription.json if exists
if (!subJson) {
  const defaultFile = path.join(__dirname, 'subscription.json');
  if (fs.existsSync(defaultFile)) {
    try {
      const content = fs.readFileSync(defaultFile, 'utf8').trim();
      if (content.startsWith('{') && content.includes('endpoint')) {
        console.log(`📁 从本地文件 ${defaultFile} 读取到订阅凭证！`);
        subJson = content;
      }
    } catch (e) {}
  }
}

// 2. Try auto-reading from macOS system clipboard (pbpaste)
if (!subJson) {
  try {
    const clipboard = execSync('pbpaste', { encoding: 'utf8' }).trim();
    if (clipboard.startsWith('{') && clipboard.includes('endpoint') && clipboard.includes('keys')) {
      console.log('📋 检测到 Mac 剪贴板中存在有效的 PushSubscription，已自动读取！');
      subJson = clipboard;
    }
  } catch (e) {}
}

if (!subJson) {
  console.error('\n❌ 缺少推送订阅凭证 (PushSubscription)！\n');
  console.log('💡 快速操作指南（2选1）：\n');
  console.log('【方案 A：苹果生态剪贴板一键读取（最推荐）】');
  console.log('1. 在 iPhone 的 PutPut 网页中点击「复制本设备推送凭证」');
  console.log('2. 在 Mac 终端直接运行: node scripts/send_push.js --delay 5');
  console.log('   （脚本会自动通过通用剪贴板读取，无需手动粘贴参数！）\n');
  console.log('【方案 B：保存到文件】');
  console.log('把 iPhone 上复制出来的 JSON 粘贴并保存到 scripts/subscription.json');
  console.log('然后直接运行: node scripts/send_push.js --delay 5\n');
  process.exit(1);
}

let subscription;
try {
  subscription = JSON.parse(subJson.trim());
} catch (e) {
  console.error('❌ 解析订阅 JSON 失败:', e.message);
  console.error('当前读取到的内容前 100 字符:\n', subJson.slice(0, 100));
  process.exit(1);
}

if (!subscription.endpoint || !subscription.keys) {
  console.error('❌ 订阅数据格式不正确，缺少 endpoint 或 keys 字段！');
  process.exit(1);
}

const payload = JSON.stringify({
  title,
  body,
  url: './'
});

async function main() {
  console.log(`\n🎯 目标端点: ${subscription.endpoint.slice(0, 45)}...`);
  
  if (delay > 0) {
    console.log(`\n⏳ 倒计时 ${delay} 秒... 请立刻按 iPhone 电源键锁屏！`);
    for (let s = delay; s > 0; s--) {
      process.stdout.write(`   ${s}... `);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    console.log('触发！🚀\n');
  }

  console.log('[Push] 正在向 Apple APNs / FCM 发送系统级推送请求...');

  try {
    const res = await webpush.sendNotification(subscription, payload, {
      TTL: 86400,
      urgency: 'high'
    });
    console.log(`\n🎉 推送成功！APNs 状态码: ${res.statusCode} ${res.statusMessage || 'OK'}`);
    console.log('📱 你的手机应该已在锁屏亮屏并弹出系统级通知！\n');
  } catch (err) {
    console.error('\n❌ 推送失败:', err.statusCode || '', err.body || err.message);
    if (err.statusCode === 410 || err.statusCode === 404) {
      console.error('⚠️ 该推送端点已失效（可能用户重新安装或取消了授权）。请在手机端重新生成订阅。');
    }
  }
}

main();
