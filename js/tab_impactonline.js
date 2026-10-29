/**
 * tab_impactonline.js - Xử lý dữ liệu và giao diện Tab KPI SC: Impact Team Online
 * Nguồn: Sheet 'impactonline' từ Google Apps Script API
 *   - Mục 1: Range A1:H6
 *   - Mục 2: Range A9:H23
 */

/**
 * Định dạng giá trị hiển thị cho bảng Impact Online
 */
function formatImpactVal(val, colIdx, rowIdx) {
  if (val === '' || val == null) return '-';
  if (rowIdx === 0 || colIdx === 0) return String(val).trim();

  // Kiểm tra nếu chuỗi đã có sẵn ký tự %
  const str = String(val).trim();
  if (str.endsWith('%')) return str;

  const num = Number(val);
  if (isNaN(num)) return str;

  // Nếu là số thập phân tỷ lệ (<= 1) hoặc có dấu hiệu tỷ lệ %
  if (Math.abs(num) <= 1 && num !== 0 && (str.includes('.') || str.includes(','))) {
    return (num * 100).toFixed(2) + '%';
  }

  // Số lượng nguyên: làm tròn và phân cách hàng nghìn
  return Math.round(num).toLocaleString('vi-VN');
}

/**
 * Tải dữ liệu Tab Impact Online (Hỗ trợ Smart Cache IndexedDB và nạp trực tiếp)
 */
async function loadImpactOnline(forceReload = false, isSilent = false) {
  const btn = $('btnReloadImpactOnline');
  const badge = $('impactOnlineSrcBadge');

  if (btn && !isSilent) {
    btn.disabled = true;
    btn.textContent = '⏳ Đang tải…';
  }
  if (badge && !isSilent) {
    badge.className = 'badge b-load';
    badge.textContent = 'Đang tải…';
  }

  // 1. Kiểm tra IndexedDB Smart Cache
  if (!forceReload) {
    try {
      const db = await openDB();
      const cached = await new Promise(resolve => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(CACHE_KEY_IMPACT_ONLINE);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });

      if (cached && (cached.muc1 || cached.muc2)) {
        const ageMs = Date.now() - (cached.savedAt || 0);
        const minsAgo = Math.max(0, Math.floor(ageMs / 60000));
        const timeLabel = minsAgo === 0 ? 'vừa xong' : `${minsAgo} phút trước`;

        if (ageMs < CACHE_TTL_MS) {
          IMPACT_ONLINE_STATE = cached;
          if (badge) {
            badge.className = 'badge b-cache';
            badge.textContent = `Bộ nhớ đệm (${timeLabel})`;
          }
          if (btn) {
            btn.disabled = false;
            btn.textContent = '⟳ Tải lại Impact Online';
          }
          renderImpactOnline();
          return;
        }
      }
    } catch (e) {
      console.warn('Impact Online Cache read error:', e);
    }
  }

  // 2. Tải trực tiếp từ Google Apps Script API (sheet impactonline: A1:H6 & A9:H23)
  const t = Date.now();
  const url1 = `${API_IMPACT_ONLINE_1}&_t=${t}`;
  const url2 = `${API_IMPACT_ONLINE_2}&_t=${t + 1}`;

  try {
    const [res1, res2] = await Promise.all([
      safeFetchJson(url1, 2),
      safeFetchJson(url2, 2)
    ]);

    const data1 = res1 && res1.data ? res1.data : (Array.isArray(res1) ? res1 : null);
    const data2 = res2 && res2.data ? res2.data : (Array.isArray(res2) ? res2 : null);

    if (!data1 && !data2) {
      throw new Error('Không nhận được dữ liệu từ sheet impactonline.');
    }

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    IMPACT_ONLINE_STATE = {
      muc1: data1,
      muc2: data2,
      savedAt: Date.now(),
      timeStr: timeStr
    };

    // Lưu cache IndexedDB
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(IMPACT_ONLINE_STATE, CACHE_KEY_IMPACT_ONLINE);
    } catch (e) {}

    if (badge) {
      badge.className = 'badge b-live';
      badge.textContent = `API trực tiếp ${timeStr}`;
    }

    renderImpactOnline();

    if (!isSilent && forceReload) {
      showToast('Đã cập nhật dữ liệu Impact Online mới nhất!', true);
    }
  } catch (err) {
    console.error('Lỗi khi tải Impact Online:', err);
    if (badge) {
      badge.className = 'badge b-err';
      badge.textContent = 'Lỗi tải API';
    }
    const c1 = $('impactOnlineTbl1Container');
    const c2 = $('impactOnlineTbl2Container');
    if (c1 && (!IMPACT_ONLINE_STATE || !IMPACT_ONLINE_STATE.muc1)) {
      c1.innerHTML = `<div style="padding:16px;color:#ef4444;text-align:center">⚠️ Không thể tải dữ liệu Mục 1 (A1:H6): ${esc(err.message || String(err))}</div>`;
    }
    if (c2 && (!IMPACT_ONLINE_STATE || !IMPACT_ONLINE_STATE.muc2)) {
      c2.innerHTML = `<div style="padding:16px;color:#ef4444;text-align:center">⚠️ Không thể tải dữ liệu Mục 2 (A9:H23): ${esc(err.message || String(err))}</div>`;
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '⟳ Tải lại Impact Online';
    }
  }
}

/**
 * Render toàn bộ giao diện Tab Impact Online
 */
function renderImpactOnline() {
  const d1 = IMPACT_ONLINE_STATE.muc1;
  const d2 = IMPACT_ONLINE_STATE.muc2;

  renderImpactOnlineSummaryCards(d1, d2);
  renderImpactOnlineTable(d1, 'impactOnlineTbl1Container', 'muc1');
  renderImpactOnlineTable(d2, 'impactOnlineTbl2Container', 'muc2');
}

/**
 * Render các thẻ tóm tắt KPI trên cùng
 */
function renderImpactOnlineSummaryCards(d1, d2) {
  const container = $('impactOnlineSummaryCards');
  if (!container) return;

  let totalItems1 = Array.isArray(d1) && d1.length > 1 ? d1.length - 1 : 0;
  let totalItems2 = Array.isArray(d2) && d2.length > 1 ? d2.length - 1 : 0;

  // Tìm dòng tổng cộng trong d1 hoặc d2 nếu có
  let summaryTitle = 'Chỉ số Impact';
  let summaryRate = '-';

  if (Array.isArray(d1) && d1.length > 1) {
    const lastRow = d1[d1.length - 1] || [];
    const rName = String(lastRow[0] || '').toLowerCase();
    if (rName.includes('tổng') || rName.includes('total') || rName.includes('trung bình')) {
      for (let c = 1; c < lastRow.length; c++) {
        const v = String(lastRow[c] || '');
        if (v.includes('%') || (Number(v) > 0 && Number(v) <= 1)) {
          summaryRate = formatImpactVal(lastRow[c], c, d1.length - 1);
          break;
        }
      }
    }
  }

  const cardsHtml = `
    <div class="kpi-card" style="border-top: 3px solid #3b82f6;">
      <div class="kpi-label">⚡ Tổng Số Chỉ Tiêu Mục 1</div>
      <div class="kpi-val" style="color:#3b82f6">${totalItems1} <span style="font-size:13px;font-weight:500;color:var(--tx-muted)">chỉ tiêu (A1:H6)</span></div>
      <div class="kpi-sub">Bảng tổng hợp Impact Online</div>
    </div>
    <div class="kpi-card" style="border-top: 3px solid #10b981;">
      <div class="kpi-label">👥 Số Nhân Sự / Hạng Mục Mục 2</div>
      <div class="kpi-val" style="color:#10b981">${totalItems2} <span style="font-size:13px;font-weight:500;color:var(--tx-muted)">dòng (A9:H23)</span></div>
      <div class="kpi-sub">Chi tiết Impact Online</div>
    </div>
    <div class="kpi-card" style="border-top: 3px solid #f59e0b;">
      <div class="kpi-label">📈 Tỷ Lệ Điển Hình</div>
      <div class="kpi-val" style="color:#f59e0b">${summaryRate !== '-' ? summaryRate : 'Đang cập nhật'}</div>
      <div class="kpi-sub">Hiệu suất thực tế từ Sheet</div>
    </div>
    <div class="kpi-card" style="border-top: 3px solid #8b5cf6;">
      <div class="kpi-label">🔄 Cập Nhật Hệ Thống</div>
      <div class="kpi-val" style="color:#8b5cf6;font-size:19px">${IMPACT_ONLINE_STATE.timeStr || 'Vừa xong'}</div>
      <div class="kpi-sub">Đồng bộ sheet impactonline</div>
    </div>
  `;

  container.innerHTML = cardsHtml;
}

/**
 * Render một bảng Impact Online theo cấu trúc mảng 2 chiều
 */
function renderImpactOnlineTable(rawData, containerId, sectionKey) {
  const el = $(containerId);
  if (!el) return;

  if (!Array.isArray(rawData) || !rawData.length) {
    el.innerHTML = '<div style="padding:16px;color:var(--tx-muted,#94a3b8);text-align:center">Chưa có dữ liệu từ Google Sheets</div>';
    return;
  }

  const headers = rawData[0] || [];
  const query = IMPACT_ONLINE_SEARCH;

  let html = '<table class="excel-table"><thead><tr>';
  headers.forEach((h, idx) => {
    const hText = String(h || '').trim();
    const alignClass = idx === 0 ? 'text-left' : 'text-center';
    html += `<th class="${alignClass}">${esc(hText)}</th>`;
  });
  html += '</tr></thead><tbody>';

  let matchCount = 0;
  for (let r = 1; r < rawData.length; r++) {
    const row = rawData[r];
    if (!row || !row.length) continue;

    const rowName = String(row[0] || '').trim();
    if (query) {
      const match = row.some(cell => String(cell || '').toLowerCase().includes(query));
      if (!match) continue;
    }
    matchCount++;

    const isTotal = /tổng cộng|total|trung bình|grand total/i.test(rowName);
    const trClass = isTotal ? 'bg-peach bold' : '';

    html += `<tr class="${trClass}">`;
    row.forEach((val, c) => {
      let tdClass = c === 0 ? 'text-left bold' : 'text-center';
      const formatted = formatImpactVal(val, c, r);

      // Nếu có ký tự % thì áp dụng màu sắc nổi bật
      if (formatted.endsWith('%')) {
        const pNum = parseFloat(formatted);
        if (!isNaN(pNum)) {
          if (pNum >= 100) tdClass += ' text-success';
          else if (pNum >= 70) tdClass += ' text-warning';
          else if (pNum < 50 && pNum > 0) tdClass += ' text-danger';
        }
      }

      html += `<td class="${tdClass}">${esc(formatted)}</td>`;
    });
    html += '</tr>';
  }

  if (matchCount === 0 && query) {
    html += `<tr><td colspan="${headers.length}" style="text-align:center;padding:16px;color:#94a3b8">Không tìm thấy kết quả phù hợp với "${esc(query)}"</td></tr>`;
  }

  html += '</tbody></table>';
  el.innerHTML = html;
}

/**
 * Tìm kiếm tức thời trên cả 2 bảng Impact Online
 */
function onImpactOnlineSearch(val) {
  IMPACT_ONLINE_SEARCH = (val || '').trim().toLowerCase();
  renderImpactOnlineTable(IMPACT_ONLINE_STATE.muc1, 'impactOnlineTbl1Container', 'muc1');
  renderImpactOnlineTable(IMPACT_ONLINE_STATE.muc2, 'impactOnlineTbl2Container', 'muc2');
}

/**
 * Xuất file CSV cho từng mục
 */
function exportImpactOnlineCsv(sectionKey) {
  const isMuc1 = sectionKey === 'muc1';
  const data = isMuc1 ? IMPACT_ONLINE_STATE.muc1 : IMPACT_ONLINE_STATE.muc2;
  const secTitle = isMuc1 ? 'MỤC 1: TỔNG HỢP IMPACT ONLINE (A1:H6)' : 'MỤC 2: CHI TIẾT IMPACT ONLINE (A9:H23)';

  if (!Array.isArray(data) || !data.length) {
    showToast(`Chưa có dữ liệu ${secTitle} để xuất CSV!`, false);
    return;
  }

  const lines = [];
  lines.push([`BÁO CÁO IMPACT TEAM ONLINE - ${secTitle}`]);
  lines.push(['Xuất ngày: ' + new Date().toLocaleString('vi-VN')]);
  lines.push([]);

  data.forEach((row, r) => {
    const line = row.map((val, c) => {
      const formatted = formatImpactVal(val, c, r);
      return `"${String(formatted).replace(/"/g, '""')}"`;
    });
    lines.push(line.join(','));
  });

  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Impact_Online_${isMuc1 ? 'Muc1_A1_H6' : 'Muc2_A9_H23'}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`Đã xuất CSV ${isMuc1 ? 'Mục 1' : 'Mục 2'} thành công!`, true);
}

/**
 * Xuất file CSV tổng hợp cả 2 mục
 */
function exportImpactOnlineAllCsv() {
  const d1 = IMPACT_ONLINE_STATE.muc1;
  const d2 = IMPACT_ONLINE_STATE.muc2;

  if ((!Array.isArray(d1) || !d1.length) && (!Array.isArray(d2) || !d2.length)) {
    showToast('Chưa có dữ liệu Impact Online để xuất CSV!', false);
    return;
  }

  const lines = [];
  lines.push(['BÁO CÁO TỔNG HỢP IMPACT TEAM ONLINE']);
  lines.push(['Nguồn dữ liệu: Google Sheets (sheet impactonline: A1:H6 & A9:H23)']);
  lines.push(['Xuất ngày: ' + new Date().toLocaleString('vi-VN')]);
  lines.push([]);

  if (Array.isArray(d1) && d1.length) {
    lines.push(['=== MỤC 1: TỔNG HỢP IMPACT ONLINE (A1:H6) ===']);
    d1.forEach((row, r) => {
      lines.push(row.map((val, c) => `"${String(formatImpactVal(val, c, r)).replace(/"/g, '""')}"`).join(','));
    });
    lines.push([]);
  }

  if (Array.isArray(d2) && d2.length) {
    lines.push(['=== MỤC 2: CHI TIẾT IMPACT ONLINE (A9:H23) ===']);
    d2.forEach((row, r) => {
      lines.push(row.map((val, c) => `"${String(formatImpactVal(val, c, r)).replace(/"/g, '""')}"`).join(','));
    });
  }

  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Bao_Cao_Impact_Online_TongHop_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Đã xuất toàn bộ dữ liệu Impact Online ra CSV thành công!', true);
}
