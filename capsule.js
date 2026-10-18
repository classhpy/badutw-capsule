/**
 * 霸肚燒瓶・膠囊 1.0.1
 * 每一頁共用：認出是誰、回報發生的事、存檔讀檔、膠囊列。
 * 接口說明：專案的 30_膠囊\00_膠囊接口說明.md（頁面只用 霸肚.呼叫(...)）。
 * 規矩：樣式與元素一律 bdc- 開頭；不綁整頁鍵盤；不跑常駐動畫；看得到的文字一律 textContent；
 *      中央斷線或沒登入時頁面照常能用，不產生假身分、假能量。
 */
(function () {
  'use strict';
  var 版本 = '1.0.1';
  if (window.霸肚 && window.霸肚.版本) return; // 同一頁載入兩次時，只留第一個

  var 設定 = window.霸肚設定 || {};
  var 測試 = 設定.測試 || {}; // 只給測試頁用，正式頁面不要寫
  var 中央網址 = 測試.中央網址 || 'https://script.google.com/macros/s/AKfycbwcqLU1qK3gZFtVcvxkhAkGZaYnfe6RZxCbYV_qr1Vie6fGrL8E9-a6n5PzccXouEA/exec';
  var 中繼頁網址 = 測試.中繼頁網址 || 'https://classhpy.github.io/badutw-capsule/relay.html';
  var 停留秒數 = Number(測試.停留秒數) > 0 ? Number(測試.停留秒數) : 60;
  var 停留事件 = 測試.停留事件 || '停留滿60秒';
  var 閒置上限毫秒 = Number(測試.閒置上限毫秒) > 0 ? Number(測試.閒置上限毫秒) : 0;
  var 頁面類型 = ['遊戲', '內容', '作品'].indexOf(設定.頁面類型) >= 0 ? 設定.頁面類型 : '內容';
  var 活動間隔 = 5 * 60 * 1000;

  var 狀態 = { 準備好: false, 模式: '準備中', 中繼版本: '', 憑證: '', 到期: 0, 使用者: null, 離線: false, 位置: '' };
  var 畫面 = {};

  // ───────── 工具 ─────────

  function 複製(v) { return v == null ? null : JSON.parse(JSON.stringify(v)); }
  function 等(毫秒) { return new Promise(function (好) { setTimeout(好, 毫秒); }); }
  function 派送(名, 內容) {
    try { window.dispatchEvent(new CustomEvent(名, { detail: 複製(內容) })); } catch (e) { /* 舊瀏覽器 */ }
  }
  function 已登入() { return !!狀態.憑證 && (!狀態.到期 || Date.now() < 狀態.到期); }
  function 看得到的使用者() { return 已登入() && !狀態.離線 ? 狀態.使用者 : null; }
  function 發通知() { 派送('霸肚:登入狀態', 看得到的使用者()); }

  function 頁面Key() {
    if (設定.計數器Key) return String(設定.計數器Key).trim();
    var 標題 = document.getElementById('badu-page-title');
    var k = String(window.COUNTER_PAGE_KEY || (標題 && 標題.dataset && 標題.dataset.pageKey) || '').trim();
    if (k && k !== '請輸入新工具專屬Key') return k;
    var 字 = String((標題 && 標題.textContent) || document.title || '').trim();
    if (!字 || 字 === '你的新工具名稱' || 字 === 'Badu 新工具名稱') return '';
    return 'badu_' + 字.replace(/\s+/g, '_');
  }

  // ───────── 中繼頁（記住登入） ─────────

  var 中繼 = { 框: null, 好了: false, 等: {}, 號: 0, 來源: '' };

  function 開中繼() {
    return new Promise(function (好) {
      if (測試.停用中繼頁) { 好(false); return; }
      try { 中繼.來源 = new URL(中繼頁網址).origin; } catch (e) { 好(false); return; }
      var 完成 = false;
      function 結束(ok) { if (!完成) { 完成 = true; 好(ok); } }
      window.addEventListener('message', function (ev) {
        if (ev.origin !== 中繼.來源) return;
        var d = ev.data || {};
        if (d.badu === 'relay-ready') {
          狀態.中繼版本 = String(d.版本 || '');
          中繼.好了 = !!d.storageOk;
          結束(中繼.好了);
        } else if (d.badu === 'relay-reply' && 中繼.等[d.id]) {
          中繼.等[d.id](d);
          delete 中繼.等[d.id];
        } else if (d.badu === 'relay-changed') {
          同步中繼();
        }
      });
      var f = document.createElement('iframe');
      f.src = 中繼頁網址;
      f.title = '霸肚燒瓶中繼頁';
      f.tabIndex = -1;
      f.setAttribute('aria-hidden', 'true');
      f.style.cssText = 'position:absolute;width:0;height:0;border:0;left:-9999px;top:0;visibility:hidden;';
      中繼.框 = f;
      document.body.appendChild(f);
      setTimeout(function () { 結束(false); }, 6000);
    });
  }

  function 問中繼(cmd, 資料) {
    return new Promise(function (好) {
      if (!中繼.好了 || !中繼.框 || !中繼.框.contentWindow) { 好(null); return; }
      var id = 'c' + (++中繼.號);
      中繼.等[id] = 好;
      var 訊息 = { badu: 'relay', id: id, cmd: cmd };
      Object.keys(資料 || {}).forEach(function (k) { 訊息[k] = 資料[k]; });
      if (閒置上限毫秒) 訊息.閒置上限毫秒 = 閒置上限毫秒;
      中繼.框.contentWindow.postMessage(訊息, 中繼.來源);
      setTimeout(function () { if (中繼.等[id]) { delete 中繼.等[id]; 好(null); } }, 4000);
    });
  }

  // ───────── 中央程式 ─────────

  function 設離線(是) {
    if (狀態.離線 === 是) return;
    狀態.離線 = 是;
    發通知();
    畫();
  }

  function 送中央(資料, 毫秒) {
    var 控制 = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var 計時 = 控制 ? setTimeout(function () { 控制.abort(); }, 毫秒 || 20000) : 0;
    return fetch(中央網址, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(資料),
      signal: 控制 ? 控制.signal : undefined
    }).then(function (r) { return r.json(); })
      .then(function (j) { clearTimeout(計時); 設離線(false); return j || { 成功: false, 訊息: '中央沒有回應內容' }; },
        function () { clearTimeout(計時); 設離線(true); return { 成功: false, 離線: true, 訊息: '連不上中央' }; });
  }

  // ───────── 登入、登出 ─────────

  function 設登入(憑證, 到期, 使用者) {
    狀態.憑證 = 憑證 || '';
    狀態.到期 = Number(到期) || 0;
    狀態.使用者 = 憑證 ? (使用者 || null) : null;
    發通知();
    畫();
  }

  function 本地登出(訊息) {
    var 原本有 = !!狀態.憑證;
    設登入('', 0, null);
    問中繼('清');
    if (訊息 && 原本有) 提示(訊息);
  }

  function 登入(碼) {
    碼 = String(碼 == null ? '' : 碼).trim();
    if (!碼) return Promise.resolve({ 成功: false, 訊息: '請輸入通行碼' });
    return 送中央({ 動作: '登入', 通行碼: 碼 }, 20000).then(function (j) {
      if (j.成功 && j.憑證) {
        設登入(j.憑證, j.到期, j.使用者);
        問中繼('存', { 憑證: j.憑證, 到期: j.到期, 使用者: j.使用者 });
        return { 成功: true, 使用者: 複製(j.使用者) };
      }
      return { 成功: false, 離線: !!j.離線, 忙碌: !!j.忙碌, 訊息: j.訊息 || '登入失敗' };
    });
  }

  /** 從中繼頁讀登入；憑證換了才問中央。 */
  function 同步中繼() {
    if (!中繼.好了) return Promise.resolve();
    return 問中繼('讀').then(function (回) {
      if (!回) return;
      var 資 = 回.登入;
      if (!資 || !資.憑證) {
        if (狀態.憑證) { 設登入('', 0, null); }
        return;
      }
      if (資.憑證 === 狀態.憑證) return;
      設登入(資.憑證, 資.到期, 資.使用者);
      return 刷新我();
    });
  }

  function 刷新我() {
    if (!狀態.憑證) return Promise.resolve();
    return 送中央({ 動作: '我', 憑證: 狀態.憑證 }, 15000).then(function (j) {
      if (j.成功) {
        狀態.使用者 = j.使用者;
        問中繼('活動', { 使用者: j.使用者 });
        發通知();
        畫();
      } else if (j.需要登入) {
        本地登出('登入已過期，請重新登入');
      }
    });
  }

  function 檢查到期() {
    if (狀態.憑證 && 狀態.到期 && Date.now() >= 狀態.到期) 本地登出('登入已過期，請重新登入');
  }

  // ───────── 回報、存檔、讀檔 ─────────

  function 文字(v) {
    if (v == null) return '';
    if (typeof v === 'object') { try { return JSON.stringify(v); } catch (e) { return String(v); } }
    return v;
  }

  function 前置檢查() {
    檢查到期();
    if (!狀態.憑證) return { 成功: false, 未登入: true, 訊息: '還沒登入' };
    if (!頁面Key()) return { 成功: false, 訊息: '這一頁還沒有計數器 Key' };
    return null;
  }

  // 1.0.1：回傳多一個「膠囊耗時」（同時送出幾筆、第一次幾毫秒、有沒有因為忙碌重送、總共幾毫秒），用來查回報為什麼慢
  var 送出中 = 0;
  function 送並重試忙碌(資料) {
    var 起 = Date.now();
    var 計 = { 同時送出: 送出中, 重送: false };
    送出中++;
    return 送中央(資料).then(function (j) {
      計.第一次毫秒 = Date.now() - 起;
      if (!j.忙碌) return j;
      計.重送 = true;
      計.等重送毫秒 = Math.round(1500 + Math.random() * 1500);
      return 等(計.等重送毫秒).then(function () {
        var t = Date.now();
        return 送中央(資料).then(function (j2) { 計.第二次毫秒 = Date.now() - t; return j2; });
      });
    }).then(function (j) {
      送出中--;
      計.總毫秒 = Date.now() - 起;
      if (j && typeof j === 'object') j.膠囊耗時 = 計;
      return j;
    });
  }

  function 處理需要登入(j) {
    if (j && j.需要登入) 本地登出('登入已過期，請重新登入');
    return j;
  }

  function 回報(事件, 選項) {
    選項 = 選項 || {};
    事件 = String(事件 == null ? '' : 事件).trim();
    if (!事件) return Promise.resolve({ 成功: false, 訊息: '沒有事件名稱' });
    var 擋 = 前置檢查();
    if (擋) { 派送('霸肚:回報結果', { 事件: 事件, 結果: 擋 }); return Promise.resolve(擋); }
    var 資料 = {
      動作: '回報', 憑證: 狀態.憑證, 計數器Key: 頁面Key(), 頁面類型: 頁面類型, 事件: 事件,
      關卡: 選項.關卡 == null ? '' : String(選項.關卡), 數值: 選項.數值 == null ? '' : 選項.數值, 細節: 文字(選項.細節)
    };
    return 送並重試忙碌(資料).then(處理需要登入).then(function (j) {
      if (j.成功 && 狀態.使用者) {
        if (!j.無限能量 && j.能量 != null) 狀態.使用者.能量 = j.能量;
        問中繼('活動', { 使用者: 狀態.使用者 });
        發通知();
        畫();
        if (Number(j.能量增減) > 0) 提示('+' + j.能量增減 + ' 能量');
      }
      派送('霸肚:回報結果', { 事件: 事件, 數值: 資料.數值, 結果: j });
      return j;
    });
  }

  function 存檔(內容) {
    var 擋 = 前置檢查();
    if (擋) return Promise.resolve(擋);
    return 送並重試忙碌({ 動作: '存檔', 憑證: 狀態.憑證, 計數器Key: 頁面Key(), 內容: 內容 === undefined ? null : 內容 })
      .then(處理需要登入);
  }

  function 讀檔() {
    var 擋 = 前置檢查();
    if (擋) return Promise.resolve(擋);
    return 送中央({ 動作: '讀檔', 憑證: 狀態.憑證, 計數器Key: 頁面Key() }).then(處理需要登入);
  }

  // ───────── 停留滿 60 秒、活動 ─────────

  function 開始停留計時() {
    if (設定.停留回報 === false) return;
    var 累計 = 0, 上次 = Date.now(), 已送 = false;
    var 計 = setInterval(function () {
      var 現在 = Date.now();
      if (document.visibilityState === 'visible') 累計 += Math.min(現在 - 上次, 6000);
      上次 = 現在;
      if (!已送 && 累計 >= 停留秒數 * 1000 && 已登入() && 頁面Key()) {
        已送 = true;
        clearInterval(計);
        回報(停留事件, { 數值: Math.round(累計 / 1000) });
      }
    }, 測試.停留秒數 ? 500 : 5000);
  }

  function 開始活動回報() {
    setInterval(function () {
      if (document.visibilityState !== 'visible' || !狀態.憑證 || !中繼.好了) return;
      問中繼('活動').then(function (回) { if (回 && !回.登入 && 狀態.憑證) 設登入('', 0, null); });
    }, 活動間隔);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') { 檢查到期(); 同步中繼(); }
    });
  }

  // ───────── 畫面 ─────────

  var 樣式 = [
    '.bdc-wrap{display:flex;justify-content:center;margin:6px 0 0;font-family:var(--font-main,system-ui,sans-serif);color:var(--primary,#264653);font-size:15px;line-height:1.3}',
    '.bdc-wrap *{box-sizing:border-box}',
    '.bdc-bar{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;max-width:100%;min-height:38px;padding:4px 8px 4px 14px;background:#fff;border:2.5px solid var(--primary,#264653);border-radius:999px;box-shadow:2px 3px 0 rgba(38,70,83,.18)}',
    '.bdc-text{font-weight:bold;white-space:nowrap}',
    '.bdc-energy{color:var(--error,#E76F51)}',
    '.bdc-msg{font-size:13px;opacity:.85}',
    '.bdc-btn{font:inherit;font-size:14px;font-weight:bold;padding:5px 12px;border:0;border-radius:999px;background:var(--primary,#264653);color:#fff;cursor:pointer}',
    '.bdc-btn.bdc-soft{background:var(--accent,#E9C46A);color:var(--primary,#264653)}',
    '.bdc-btn.bdc-ghost{background:transparent;color:var(--primary,#264653);border:1.5px solid currentColor}',
    '.bdc-form{display:inline-flex;align-items:center;gap:6px}',
    '.bdc-input{font:inherit;font-size:15px;width:9em;padding:5px 10px;border:1.5px solid var(--secondary,#2A9D8F);border-radius:999px;background:#fff;color:var(--primary,#264653)}',
    '.bdc-hide{display:none!important}',
    '.bdc-float{position:fixed;right:16px;bottom:16px;z-index:9990;flex-direction:column;align-items:flex-end;gap:8px;margin:0}',
    '.bdc-fab{width:46px;height:46px;border-radius:50%;border:2.5px solid var(--primary,#264653);background:var(--accent,#E9C46A);font-size:22px;cursor:pointer;box-shadow:2px 3px 0 rgba(38,70,83,.25)}',
    '.bdc-slotfill{display:inline-flex;align-items:center;gap:6px}'
  ].join('\n');

  function 元素(標籤, 類別, 字) {
    var e = document.createElement(標籤);
    if (類別) e.className = 類別;
    if (字 != null) e.textContent = 字;
    return e;
  }

  function 找格子(名) {
    try { return document.querySelector('[data-霸肚格子="' + 名 + '"]'); } catch (e) { return null; }
  }

  function 放膠囊列() {
    var st = 元素('style');
    st.id = 'bdc-style';
    st.textContent = 樣式;
    document.head.appendChild(st);

    var 外框 = 元素('div', 'bdc-wrap');
    外框.setAttribute('role', 'region');
    外框.setAttribute('aria-label', '霸肚燒瓶登入');
    var 列 = 元素('div', 'bdc-bar');
    var 字 = 元素('span', 'bdc-text');
    var 能量 = 元素('span', 'bdc-energy');
    var 訊息 = 元素('span', 'bdc-msg');
    var 登入鈕 = 元素('button', 'bdc-btn', '登入');
    var AI鈕 = 元素('button', 'bdc-btn bdc-soft', 'AI 對話');
    var 留言鈕 = 元素('button', 'bdc-btn bdc-soft', '留言');
    var 登出鈕 = 元素('button', 'bdc-btn bdc-ghost', '登出');
    [登入鈕, AI鈕, 留言鈕, 登出鈕].forEach(function (b) { b.type = 'button'; });

    var 表單 = 元素('form', 'bdc-form bdc-hide');
    var 輸入 = 元素('input', 'bdc-input');
    輸入.type = 'text';
    輸入.placeholder = '通行碼';
    輸入.autocomplete = 'off';
    輸入.setAttribute('autocapitalize', 'off');
    輸入.spellcheck = false;
    輸入.setAttribute('aria-label', '通行碼');
    var 送出 = 元素('button', 'bdc-btn', '進入');
    送出.type = 'submit';
    var 取消 = 元素('button', 'bdc-btn bdc-ghost', '取消');
    取消.type = 'button';
    表單.appendChild(輸入); 表單.appendChild(送出); 表單.appendChild(取消);

    [字, 能量, 表單, 登入鈕, AI鈕, 留言鈕, 登出鈕, 訊息].forEach(function (e) { 列.appendChild(e); });

    登入鈕.onclick = function () { 表單.classList.remove('bdc-hide'); 登入鈕.classList.add('bdc-hide'); 輸入.focus(); };
    取消.onclick = function () { 表單.classList.add('bdc-hide'); 輸入.value = ''; 畫(); };
    表單.onsubmit = function (e) {
      e.preventDefault();
      送出.disabled = true;
      提示('登入中…', 20000);
      登入(輸入.value).then(function (r) {
        送出.disabled = false;
        if (r.成功) { 輸入.value = ''; 表單.classList.add('bdc-hide'); 提示('歡迎，' + (r.使用者 && r.使用者.姓名 || '')); }
        else 提示(r.訊息 || '登入失敗');
        畫();
      });
    };
    登出鈕.onclick = function () { 本地登出(); 提示('已登出'); };
    function 尚未開放(名) { return function () { 提示(名 + '尚未開放'); }; }
    AI鈕.onclick = 尚未開放('AI 對話');
    留言鈕.onclick = 尚未開放('留言');

    // 放哪：格子 → 頁尾正下方 → 右下角小圓鈕
    var 格子 = 找格子('膠囊列');
    var 頁尾 = document.querySelector('.badu-foot');
    if (格子) {
      外框.appendChild(列);
      格子.appendChild(外框);
      狀態.位置 = '格子';
    } else if (頁尾 && 頁尾.parentNode) {
      外框.appendChild(列);
      頁尾.parentNode.insertBefore(外框, 頁尾.nextSibling);
      狀態.位置 = '頁尾下方';
    } else {
      外框.classList.add('bdc-float');
      var 圓鈕 = 元素('button', 'bdc-fab', '🧪');
      圓鈕.type = 'button';
      圓鈕.title = '霸肚燒瓶登入';
      圓鈕.setAttribute('aria-label', '霸肚燒瓶登入');
      列.classList.add('bdc-hide');
      圓鈕.onclick = function () { 列.classList.toggle('bdc-hide'); };
      外框.appendChild(列);
      外框.appendChild(圓鈕);
      document.body.appendChild(外框);
      狀態.位置 = '右下角';
    }

    // 頁面自己留的 AI、留言、角色格子
    var 格子們 = {};
    ['AI', '留言', '角色'].forEach(function (名) {
      var g = 找格子(名);
      if (!g || !設定[名]) return;
      var 填 = 元素('span', 'bdc-slotfill');
      g.appendChild(填);
      格子們[名] = 填;
    });
    if (格子們.AI) { var b1 = 元素('button', 'bdc-btn bdc-soft', 'AI 對話'); b1.type = 'button'; b1.onclick = 尚未開放('AI 對話'); 格子們.AI.appendChild(b1); }
    if (格子們.留言) { var b2 = 元素('button', 'bdc-btn bdc-soft', '留言'); b2.type = 'button'; b2.onclick = 尚未開放('留言'); 格子們.留言.appendChild(b2); }

    畫面 = { 外框: 外框, 列: 列, 字: 字, 能量: 能量, 訊息: 訊息, 登入鈕: 登入鈕, AI鈕: AI鈕, 留言鈕: 留言鈕, 登出鈕: 登出鈕, 表單: 表單, 格子們: 格子們 };
  }

  var 提示計時 = 0;
  function 提示(字, 毫秒) {
    if (!畫面.訊息) return;
    clearTimeout(提示計時);
    畫面.訊息.textContent = 字;
    提示計時 = setTimeout(function () { if (畫面.訊息) 畫面.訊息.textContent = ''; }, 毫秒 || 3500);
  }

  function 顯示(e, 要) { if (e) e.classList.toggle('bdc-hide', !要); }

  function 畫() {
    if (!畫面.列) return;
    var 人 = 看得到的使用者();
    var 輸入中 = !畫面.表單.classList.contains('bdc-hide');
    if (!狀態.準備好) {
      畫面.字.textContent = '準備中…';
    } else if (狀態.離線) {
      畫面.字.textContent = '離線';
    } else if (人) {
      畫面.字.textContent = 人.姓名 || '已登入';
    } else {
      畫面.字.textContent = '';
    }
    畫面.能量.textContent = 人 && !狀態.離線 ? '⚡' + (人.無限能量 ? '無限' : (人.能量 == null ? '' : 人.能量)) : '';
    顯示(畫面.字, !!畫面.字.textContent);
    顯示(畫面.能量, !!畫面.能量.textContent);
    顯示(畫面.登入鈕, 狀態.準備好 && !已登入() && !輸入中);
    顯示(畫面.登出鈕, 狀態.準備好 && 已登入());
    顯示(畫面.AI鈕, 狀態.準備好 && !!設定.AI && !畫面.格子們.AI);
    顯示(畫面.留言鈕, 狀態.準備好 && !!設定.留言 && !畫面.格子們.留言);
    畫面.登入鈕.title = 狀態.模式 === '單頁' ? '這個瀏覽器不能共用登入，只有這一頁有效' : '';
    if (畫面.格子們.角色) 畫面.格子們.角色.textContent = 人 ? (人.姓名 || '') : '';
  }

  // ───────── 給頁面呼叫 ─────────

  function 執行(名, 參數) {
    switch (名) {
      case '回報': return 回報(參數[0], 參數[1]);
      case '存檔': return 存檔(參數[0]);
      case '讀檔': return 讀檔();
      case '我': 檢查到期(); return Promise.resolve(複製(看得到的使用者()));
      case '問AI': return Promise.resolve({ 成功: false, 尚未開放: true, 訊息: 'AI 對話尚未開放' });
      case '留言': return Promise.resolve({ 成功: false, 尚未開放: true, 訊息: '留言尚未開放' });
      case '登入': return 登入(參數[0]);
      case '登出': 本地登出(); return Promise.resolve({ 成功: true });
      case '同步': return 同步中繼().then(function () { 檢查到期(); return { 成功: true, 已登入: 已登入() }; });
      case '狀態': return Promise.resolve({
        版本: 版本, 模式: 狀態.模式, 中繼版本: 狀態.中繼版本, 已登入: 已登入(), 離線: 狀態.離線,
        位置: 狀態.位置, 頁面Key: 頁面Key(), 頁面類型: 頁面類型
      });
      default: return Promise.resolve({ 成功: false, 訊息: '不認得的呼叫：' + 名 });
    }
  }

  function 安全(名, 參數) {
    var p;
    try { p = 執行(名, 參數); } catch (e) { p = Promise.resolve({ 成功: false, 訊息: '膠囊出錯：' + (e && e.message || e) }); }
    return Promise.resolve(p).catch(function (e) { return { 成功: false, 訊息: '膠囊出錯：' + (e && e.message || e) }; });
  }

  var 舊 = window.霸肚;
  var 待辦 = (舊 && 舊.待辦) || [];
  window.霸肚 = {
    版本: 版本,
    待辦: 待辦,
    呼叫: function (名) {
      var 參數 = [].slice.call(arguments, 1);
      if (!狀態.準備好) return new Promise(function (好) { 待辦.push([名, 參數, 好]); });
      return 安全(名, 參數);
    }
  };

  // ───────── 開始 ─────────

  function 開始() {
    try { 放膠囊列(); } catch (e) { /* 畫面放不上去也不影響回報 */ }
    畫();
    開中繼().then(function (ok) {
      狀態.模式 = ok ? '全站' : '單頁';
      return ok ? 同步中繼() : null;
    }).catch(function () { /* 中繼頁出問題就當單頁 */ }).then(function () {
      狀態.準備好 = true;
      畫();
      發通知();
      var 清單 = 待辦.splice(0, 待辦.length);
      清單.forEach(function (項) { 安全(項[0], 項[1] || []).then(項[2]); });
      開始停留計時();
      開始活動回報();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', 開始);
  else 開始();
})();
