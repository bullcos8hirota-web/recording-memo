#!/usr/bin/env node
/*
 * スタジオ映像同期サーバー（司令塔PC用）
 * -------------------------------------------------
 * 全タブレットの「共通の時計」となる超軽量サーバーです。
 * Node.js の標準機能だけで動くので、npm install は不要です。
 *
 * 使い方（司令塔PCで実行）:
 *   node sync-server.js
 *   （動画の長さを指定する場合）  DURATION=604 node sync-server.js
 *   （ポートを変える場合）        PORT=8080  node sync-server.js
 *
 * 提供するエンドポイント:
 *   GET /time      … サーバーの現在時刻(ms)。各タブレットが時計合わせに使う。
 *   GET /config    … 動画の長さなど共通設定。
 *   GET /          … 動作確認用ダッシュボード（LAN IPと現在の再生位置を表示）。
 */

const http = require('http');
const os = require('os');

const PORT = parseInt(process.env.PORT || '8080', 10);
// 動画の長さ（秒）。全タブレット共通。小数もOK（例: 1800 = 30分）。
const DURATION = parseFloat(process.env.DURATION || '1800');

function setCommonHeaders(res) {
  // file:// のタブレットからも読めるように全許可
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Cache-Control', 'no-store');
}

// このPCのLAN上のIPアドレス一覧を取得（タブレットに入力する用）
function getLanIps() {
  const ips = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
}

function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function dashboardHtml() {
  const ips = getLanIps();
  const urlList = ips.length
    ? ips.map((ip) => `http://${ip}:${PORT}`).join(' / ')
    : `http://（このPCのIPアドレス）:${PORT}`;
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>映像同期サーバー 稼働中</title>
<style>
  body{font-family:sans-serif;background:#0b1020;color:#e6ecff;margin:0;padding:32px;}
  .card{max-width:720px;margin:0 auto;background:#151b34;border-radius:16px;padding:28px 32px;box-shadow:0 8px 40px rgba(0,0,0,.4);}
  h1{font-size:22px;margin:0 0 4px;}
  .ok{color:#4ade80;font-weight:bold;}
  .row{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #2a3358;}
  .row:last-child{border-bottom:none;}
  .label{color:#9fb0e0;}
  .val{font-variant-numeric:tabular-nums;font-weight:bold;}
  code{background:#0b1020;padding:3px 8px;border-radius:6px;color:#7dd3fc;}
  .bar{height:14px;background:#0b1020;border-radius:8px;overflow:hidden;margin-top:6px;}
  .bar > div{height:100%;background:linear-gradient(90deg,#38bdf8,#818cf8);width:0%;}
  .hint{margin-top:20px;color:#9fb0e0;font-size:14px;line-height:1.7;}
</style>
</head>
<body>
<div class="card">
  <h1>映像同期サーバー <span class="ok">● 稼働中</span></h1>
  <p class="hint">このPCが全タブレットの「共通の時計」です。起動したままにしてください。</p>
  <div class="row"><span class="label">タブレットに入力するアドレス</span><span class="val"><code>${urlList}</code></span></div>
  <div class="row"><span class="label">動画の長さ (duration)</span><span class="val">${DURATION} 秒</span></div>
  <div class="row"><span class="label">サーバー時刻</span><span class="val" id="now">-</span></div>
  <div class="row"><span class="label">現在のループ位置</span><span class="val" id="pos">-</span></div>
  <div class="bar"><div id="prog"></div></div>
  <p class="hint">
    各タブレットの <code>index.html</code> の先頭にある <code>server</code> を、上のアドレスに書き換えてください。<br>
    全タブレットで同じ <code>index.html</code> を使えます（違うのは各端末のローカル動画ファイルだけ）。
  </p>
</div>
<script>
  const DURATION = ${DURATION};
  async function tick(){
    try{
      const r = await fetch('/config', {cache:'no-store'});
      const j = await r.json();
      const pos = (j.server/1000) % DURATION;
      const m = Math.floor(pos/60), s = (pos%60).toFixed(1).padStart(4,'0');
      document.getElementById('now').textContent = new Date(j.server).toLocaleTimeString('ja-JP');
      document.getElementById('pos').textContent = m + '分' + s + '秒';
      document.getElementById('prog').style.width = (pos/DURATION*100).toFixed(1) + '%';
    }catch(e){}
  }
  setInterval(tick, 250); tick();
</script>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  setCommonHeaders(res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/time') {
    // NTP風の時計合わせ用。クライアントが送ってきた t0 をそのまま返す。
    sendJson(res, 200, {
      server: Date.now(),
      t0: url.searchParams.get('t0'),
    });
    return;
  }

  if (url.pathname === '/config') {
    sendJson(res, 200, {
      duration: DURATION,
      server: Date.now(),
    });
    return;
  }

  if (url.pathname === '/' || url.pathname === '/status') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(dashboardHtml());
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('not found');
});

server.listen(PORT, () => {
  const ips = getLanIps();
  console.log('===================================================');
  console.log(' スタジオ映像同期サーバー 起動しました');
  console.log('===================================================');
  console.log(` 動画の長さ (duration): ${DURATION} 秒`);
  console.log(' 各タブレットに入力するアドレス:');
  if (ips.length) {
    ips.forEach((ip) => console.log(`   http://${ip}:${PORT}`));
  } else {
    console.log(`   http://（このPCのIPアドレス）:${PORT}`);
  }
  console.log('---------------------------------------------------');
  console.log(' ブラウザで上のアドレスを開くと動作確認できます。');
  console.log(' 終了するには Ctrl + C を押してください。');
  console.log('===================================================');
});
