/**
 * tab_muctieu.js - Logic xử lý dữ liệu và giao diện Tab 3: Mục Tiêu (Team Offline & Online)
 */

function formatMuctieuVal(val, colIdx) {
  if (val === '' || val == null) return '';
  if (colIdx === 0) return String(val).trim();
  if (colIdx === 1 || colIdx === 2) {
    const num = Number(val);
    if (isNaN(num)) return String(val);
    return Math.round(num).toString();
  }
  // Col 3-7: % đạt, Tuần 1, Tuần 2, Tuần 3, Tuần 4
  const num = Number(val);
  if (isNaN(num)) return String(val);
  return (num * 100).toFixed(2) + '%';
}

function renderOfflineTable(data) {
  if (!Array.isArray(data) || !data.length) {
    return '<div style="padding:16px;color:#94a3b8;text-align:center">Không có dữ liệu</div>';
  }
  const headers = data[0];
  let html = '<table class="excel-table"><thead><tr>';
  headers.forEach(h => {
    html += `<th>${esc(String(h || '').trim())}</th>`;
  });
  html += '</tr></thead><tbody>';

  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const name = String(row[0] || '').trim();
    const isImpactOrAddon = name.includes('Số KH có impact') || name.includes('TV addon');
    const isMainRow = isImpactOrAddon || name.includes('Số KH đi được') || name.includes('Số KH tiếp cận được');
    const isSub = !isMainRow;

    const trClass = isImpactOrAddon ? 'bg-peach bold' : (isMainRow ? 'bold' : '');
    html += `<tr class="${trClass}">`;

    row.forEach((val, c) => {
      let tdClass = '';
      if (c === 0) {
        tdClass = isSub ? 'cell-sub text-right' : 'text-left';
      } else {
        tdClass = 'text-right';
      }
      const formatted = formatMuctieuVal(val, c);
      html += `<td class="${tdClass}">${esc(formatted)}</td>`;
    });
    html += '</tr>';
  }

  html += '</tbody></table>';
  return html;
}

function renderOnlineTable(data) {
  if (!Array.isArray(data) || !data.length) {
    return '<div style="padding:16px;color:#94a3b8;text-align:center">Không có dữ liệu</div>';
  }
  const headers = data[0];
  let html = '<table class="excel-table"><thead><tr>';
  headers.forEach(h => {
    html += `<th>${esc(String(h || '').trim())}</th>`;
  });
  html += '</tr></thead><tbody>';

  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const name = String(row[0] || '').trim();
    const isPeach = name.includes('Số KH có impact') || name.includes('Tổng addon');
    const isMainCyan = name.includes('Số KH đã liên hệ') || name.includes('Số KH chăm sóc') || name.includes('Số KH Liên hệ thành công');
    const isSub = !isPeach && !isMainCyan;
    const isBold = isPeach || isMainCyan;

    html += `<tr class="${isBold ? 'bold' : ''}">`;

    row.forEach((val, c) => {
      let tdClass = '';
      if (c === 0) {
        if (isPeach) tdClass = 'bg-peach text-left';
        else if (isSub) tdClass = 'bg-cyan cell-sub text-right';
        else tdClass = 'bg-cyan text-left';
      } else if (c === 1) {
        tdClass = 'bg-pink text-right';
      } else {
        tdClass = 'text-right';
      }
      const formatted = formatMuctieuVal(val, c);
      html += `<td class="${tdClass}">${esc(formatted)}</td>`;
    });
    html += '</tr>';
  }

  html += '</tbody></table>';
  return html;
}

function renderMuctieu() {
  if (MUCTIEU_STATE.offline) {
    $('offlineTblContainer').innerHTML = renderOfflineTable(MUCTIEU_STATE.offline);
  }
  if (MUCTIEU_STATE.online) {
    $('onlineTblContainer').innerHTML = renderOnlineTable(MUCTIEU_STATE.online);
  }
}

async function loadMuctieu(force = false) {
  const badge = $('targetSrcBadge');
  const btn = $('btnReloadTarget');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Đang tải…'; }
  if (badge) { badge.className = 'badge b-load'; badge.textContent = 'Đang tải API…'; }

  // 1. Kiểm tra cache IndexedDB nếu không phải force reload
  if (!force) {
    try {
      const db = await openDB();
      const cached = await new Promise(resolve => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(CACHE_KEY_MUCTIEU);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
      if (cached && cached.offline && cached.online) {
        const ageMs = Date.now() - (cached.savedAt || 0);
        if (ageMs < CACHE_TTL_MS) {
          MUCTIEU_STATE = cached;
          renderMuctieu();
          const minsAgo = Math.max(0, Math.floor(ageMs / 60000));
          const timeLabel = minsAgo === 0 ? 'vừa xong' : `${minsAgo} phút trước`;
          if (badge) { badge.className = 'badge b-cache'; badge.textContent = `Bộ nhớ đệm (${timeLabel})`; }
          if (btn) { btn.disabled = false; btn.textContent = '⟳ Tải lại Mục Tiêu'; }
          return;
        }
      }
    } catch (e) {
      console.warn('Lỗi đọc cache mục tiêu:', e);
    }
  }

  // 2. Tải an toàn từ Google Apps Script API (tuần tự, chống concurrency collision)
  try {
    const t = Date.now();
    const jOff = await safeFetchJson(`${API_MUCTIEU_OFFLINE}&_t=${t}`, 2);
    // Giãn cách 250ms giữa 2 request để tránh máy chủ Google chặn quá tải đồng thời
    await new Promise(r => setTimeout(r, 250));
    const jOn = await safeFetchJson(`${API_MUCTIEU_ONLINE}&_t=${t + 1}`, 2);

    if (jOff.status !== 'success' || !Array.isArray(jOff.data)) throw new Error('Dữ liệu Offline không hợp lệ');
    if (jOn.status !== 'success' || !Array.isArray(jOn.data)) throw new Error('Dữ liệu Online không hợp lệ');

    const now = new Date();
    const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    MUCTIEU_STATE = {
      offline: jOff.data,
      online: jOn.data,
      savedAt: Date.now(),
      timeStr: timeStr
    };

    // Lưu vào IndexedDB
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(MUCTIEU_STATE, CACHE_KEY_MUCTIEU);
    } catch (e) {}

    renderMuctieu();
    if (badge) { badge.className = 'badge b-live'; badge.textContent = `API trực tiếp ${timeStr}`; }
    showToast(`Đã đồng bộ thành công dữ liệu Mục Tiêu (Offline & Online) lúc ${timeStr}!`, true);
  } catch (e) {
    console.error('Lỗi khi tải Mục Tiêu:', e);
    // Nếu trước đó đã có dữ liệu Mục Tiêu, giữ nguyên hiển thị và thông báo thân thiện
    if (MUCTIEU_STATE.offline && MUCTIEU_STATE.online) {
      if (badge) { badge.className = 'badge b-err'; badge.textContent = 'API bận — giữ dữ liệu cũ'; }
      showToast('Máy chủ Google đang bận — bảng Mục Tiêu vẫn giữ nguyên dữ liệu hiện tại.', false);
    } else {
      if (badge) { badge.className = 'badge b-err'; badge.textContent = 'Lỗi tải API mục tiêu'; }
      const friendlyMsg = e.message && e.message.includes('trang web thay vì dữ liệu JSON')
        ? 'Máy chủ Google tạm thời bận, vui lòng bấm "⟳ Tải lại Mục Tiêu" sau giây lát.'
        : (e.message || 'Mất kết nối');
      showToast('Lỗi khi tải dữ liệu Mục Tiêu: ' + friendlyMsg, false);
    }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '⟳ Tải lại Mục Tiêu'; }
  }
}

function exportMuctieuCsv(type) {
  const data = type === 'offline' ? MUCTIEU_STATE.offline : MUCTIEU_STATE.online;
  if (!Array.isArray(data) || !data.length) {
    showToast('Chưa có dữ liệu để xuất CSV!', false);
    return;
  }
  const lines = data.map((row, r) => {
    return row.map((val, c) => {
      const formatted = r === 0 ? String(val) : formatMuctieuVal(val, c);
      return '"' + String(formatted).replace(/"/g, '""') + '"';
    }).join(',');
  });
  const csv = '\ufeff' + lines.join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `bao_cao_muc_tieu_${type}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}
