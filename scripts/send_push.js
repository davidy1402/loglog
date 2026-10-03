#!/usr/bin/env node

/**
 * PutPut APNs Web Push CLI Test Runner
 *
 * Usage:
 *   node scripts/send_push.js --sub '{"endpoint":"https://web.push.apple.com/...","keys":{...}}' --delay 5
 *   node scripts/send_push.js --file ./subscription.json --delay 5
 */

const fs = require('fs');
const path = require('path');
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

if (!subJson) {
  // Try reading from default subscription.json if exists
  const defaultFile = path.join(__dirname, 'subscription.json');
  if (fs.existsSync(defaultFile)) {
    console.log(`[Push] 从 ${defaultFile} 读取订阅信息...`);
    subJson = fs.readFileSync(defaultFile, 'utf8');
  }
}

if (!subJson) {
  console.error('\n❌ 缺少推送订阅凭证 (PushSubscription)！');
  console.log('\n使用方法:');
  console.log('1. 在 iPhone 上的 PutPut 网页/PWA 中点击「复制本设备推送凭证」');
  console.log('2. 运行: node scripts/send_push.js --sub \'<粘贴订阅JSON>\' --delay 5');
  console.log('   或者保存到 scripts/subscription.json 然后直接运行 node scripts/send_push.js --delay 5\n');
  process.exit(1);
}

let subscription;
try {
  subscription = JSON.parse(subJson.trim());
} catch (e) {
  console.error('❌ 解析订阅 JSON 失败:', e.message);
  process.exit(1);
}

const payload = JSON.stringify({
  title,
  body,
  url: './'
});

async function main() {
  if (delay > 0) {
    console.log(`⏳ 等待 ${delay} 秒... 请现在按下手机电源键锁屏！`);
    await new Promise((resolve) => setTimeout(resolve, delay * 1000));
  }

  console.log('[Push] 正在向 Apple APNs / FCM 发送系统级推送请求...');
  console.log(`[Push] Endpoint: ${subscription.endpoint}`);

  try {
    const res = await webpush.sendNotification(subscription, payload, {
      TTL: 86400,
      urgency: 'high'
    });
    console.log(`\n🎉 推送成功！APNs 状态码: ${res.statusCode} ${res.statusMessage || ''}`);
    console.log('📱 你的手机应该已在锁屏亮屏并弹出系统通知！\n');
  } catch (err) {
    console.error('\n❌ 推送失败:', err.statusCode, err.body || err.message);
    if (err.statusCode === 410 || err.statusCode === 404) {
      console.error('⚠️ 该推送端点已失效（可能用户重新安装或取消了授权）。请在手机端重新生成订阅。');
    }
  }
}

main();
