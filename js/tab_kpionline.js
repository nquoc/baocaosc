/**
 * tab_kpionline.js - Xử lý dữ liệu và giao diện Tab 7: KPI Team Online
 * Nguồn: Sheet 'KPI online' từ Google Apps Script API
 * Bao gồm 4 mục:
 *   1. KPI TEAM ONLINE (A2:AA19)
 *   2. Năng Suất Call (A27:W42)
 *   3. Bảng talktime theo ngày (A47:AG62) - Cột đầu tiên là KPI, vượt=xanh, thiếu=đỏ, 00:00=trắng
 *   4. Bảng số lượng call theo ngày (A67:AG82) - Tự động rút gọn ngày (chỉ hiện 1..hôm nay)
 */

/**
 * Chuyển đổi giá trị talktime (ISO Date string, number hoặc string hh:mm:ss) thành số giây
 */
function parseTalktimeSeconds(val) {
  if (val == null || val === '' || val === 0 || val === '0') return 0;
  if (typeof val === 'number') {
    return Math.round(val * 86400);
  }
  if (typeof val === 'string') {
    if (val.includes('T')) {
      const d = new Date(val);
      // Gốc thời gian 00:00:00 trong Google Apps Script UTC serialization
      const d0 = new Date('1899-12-29T17:17:56.000Z');
      const diffMs = d.getTime() - d0.getTime();
      return Math.max(0, Math.round(diffMs / 1000));
    }
    const parts = val.split(':').map(Number);
    if (parts.length === 3) return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
    if (parts.length === 2) return (parts[0] || 0) * 60 + (parts[1] || 0);
  }
  return 0;
}

/**
 * Định dạng số giây thành chuỗi thời lượng hh:mm:ss hoặc mm:ss
 */
function formatTalktime(sec) {
  if (!sec || sec <= 0) return '00:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = n => String(n).padStart(2, '0');
  if (h > 0) {
    return pad(h) + ':' + pad(m) + ':' + pad(s);
  }
  return pad(m) + ':' + pad(s);
}

/**
 * Định dạng phần trăm
 */
function formatKpiPct(val) {
  if (val == null || val === '' || isNaN(val)) return '–';
  const n = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(n)) return String(val);
  return (n * 100).toFixed(1) + '%';
}

/**
 * Định dạng số nguyên hoặc số thực
 */
function formatKpiNum(val, dec = 1) {
  if (val == null || val === '' || isNaN(val)) return '–';
  const n = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(n)) return String(val);
  return Number.isInteger(n) ? String(n) : n.toFixed(dec);
}

/**
 * Xác định ngày lớn nhất cần hiển thị trong các bảng ngày (Mục 3 & 4)
 * Mặc định: Hiển thị từ ngày 1 đến ngày hiện tại (ví dụ hôm nay ngày 11 -> 1-11)
 * Hoặc nếu có ngày tương lai đã điền data (> 0) thì hiển thị đến ngày đó.
 */
function getKpiOnlineMaxDay(rows, isTalktime = false, forceAll = false) {
  if (forceAll || KPI_ONLINE_SHOW_ALL_DAYS) return 30;

  const currentDay = new Date().getDate(); // ví dụ 11
  let maxDayWithData = 0;

  if (Array.isArray(rows)) {
    for (let c = 2; c <= 31; c++) {
      const dayNum = c - 1;
      let hasData = false;
      for (let r = 0; r < rows.length; r++) {
        const val = rows[r] ? rows[r][c] : null;
        if (isTalktime) {
          if (parseTalktimeSeconds(val) > 0) {
            hasData = true;
            break;
          }
        } else {
          if (typeof val === 'number' && val > 0) {
            hasData = true;
            break;
          }
        }
      }
      if (hasData && dayNum > maxDayWithData) {
        maxDayWithData = dayNum;
      }
    }
  }

  return Math.min(30, Math.max(currentDay, maxDayWithData));
}

/**
 * Phân loại và định dạng màu sắc cho các dòng Total của Miền
 * - Miền Nam / Total HCM: màu xanh dương (row-total-nam)
 * - Miền Bắc / Total HN: màu vàng hổ phách (row-total-bac)
 * - Trung bình toàn đội: màu tím (row-total-all)
 */
function getRegionRowMeta(rawName, rawStt = '', isLastRow = false) {
  const sName = String(rawName || '').trim();
  const sStt = String(rawStt || '').trim();
  const upper = (sName + ' ' + sStt).toUpperCase();

  if (upper.includes('TOTAL HCM') || upper.includes('MIỀN NAM')) {
    return {
      isSummary: true,
      type: 'nam',
      cls: 'row-total-nam',
      icon: '🏙️',
      title: upper.includes('TOTAL HCM') ? 'TOTAL HCM (MIỀN NAM)' : 'MIỀN NAM (Trung bình)'
    };
  }
  if (upper.includes('TOTAL HN') || upper.includes('MIỀN BẮC')) {
    return {
      isSummary: true,
      type: 'bac',
      cls: 'row-total-bac',
      icon: '🏛️',
      title: upper.includes('TOTAL HN') ? 'TOTAL HN (MIỀN BẮC)' : 'MIỀN BẮC (Trung bình)'
    };
  }
  if (isLastRow || upper.includes('TRUNG BÌNH TOÀN ĐỘI') || (upper.includes('TOTAL') && !upper.includes('HCM') && !upper.includes('HN'))) {
    return {
      isSummary: true,
      type: 'all',
      cls: 'row-total-all',
      icon: '⭐',
      title: 'TRUNG BÌNH TOÀN ĐỘI'
    };
  }
  return {
    isSummary: false,
    type: 'normal',
    cls: '',
    icon: '',
    title: sName
  };
}

/**
 * Bật/tắt chế độ hiển thị toàn bộ tháng hay rút gọn ngày cho Mục 3: Talktime
 */
function toggleKpiOnlineTalkDays() {
  KPI_ONLINE_SHOW_ALL_TALK_DAYS = !KPI_ONLINE_SHOW_ALL_TALK_DAYS;
  const btn = $('btnToggleKpiDays');
  if (btn) {
    btn.textContent = KPI_ONLINE_SHOW_ALL_TALK_DAYS ? '📅 Thu gọn ngày (1→Hôm nay)' : '📅 Xem toàn bộ tháng (1→30)';
  }
  if (KPI_ONLINE_STATE.data) {
    renderTalktimeNgayTable(KPI_ONLINE_STATE.data);
  }
}

/**
 * Bật/tắt chế độ hiển thị toàn bộ tháng hay rút gọn ngày cho Mục 4: Số lượng Call
 */
function toggleKpiOnlineCallDays() {
  KPI_ONLINE_SHOW_ALL_CALL_DAYS = !KPI_ONLINE_SHOW_ALL_CALL_DAYS;
  const btn = $('btnToggleCallDays');
  if (btn) {
    btn.textContent = KPI_ONLINE_SHOW_ALL_CALL_DAYS ? '📅 Thu gọn ngày (1→Hôm nay)' : '📅 Xem toàn bộ tháng (1→30)';
  }
  if (KPI_ONLINE_STATE.data) {
    renderSoluongCallNgayTable(KPI_ONLINE_STATE.data);
  }
}

/**
 * Tương thích ngược: Bật/tắt cả 2 mục
 */
function toggleKpiOnlineAllDays() {
  toggleKpiOnlineTalkDays();
  toggleKpiOnlineCallDays();
}

/**
 * Lọc tìm kiếm theo tên nhân sự
 */
function onKpiOnlineSearch(query) {
  KPI_ONLINE_SEARCH = (query || '').trim().toLowerCase();
  if (KPI_ONLINE_STATE.data) {
    renderKpiOnline();
  }
}

/**
 * Tải dữ liệu sheet 'KPI online' (IndexedDB Smart Cache + Trực tiếp)
 */
async function loadKpiOnline(forceReload = false, isSilent = false) {
  const badge = $('kpiOnlineSrcBadge');
  const btn = $('btnReloadKpiOnline');

  if (badge && !isSilent) {
    badge.className = 'badge b-load';
    badge.textContent = 'Đang tải KPI Online…';
  }
  if (btn && !isSilent) btn.disabled = true;

  // 1. Kiểm tra IndexedDB Cache nếu không forceReload
  if (!forceReload) {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(CACHE_KEY_KPI_ONLINE);
      const cached = await new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      if (cached && cached.data && Array.isArray(cached.data) && cached.data.length >= 80) {
        KPI_ONLINE_STATE = cached;
        renderKpiOnline();
        if (badge) {
          badge.className = 'badge b-cache';
          badge.textContent = `Cache ${cached.timeStr || ''}`;
        }
        if (btn) btn.disabled = false;
        return;
      }
    } catch (e) {
      console.warn('Lỗi đọc Cache KPI Online:', e);
    }
  }

  // 2. Fetch API trực tiếp từ Google Apps Script
  const authKey = getAuthKey();
  const sep = API_KPI_ONLINE.includes('?') ? '&' : '?';
  const url = `${API_KPI_ONLINE}${sep}key=${encodeURIComponent(authKey)}&_t=${Date.now()}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    if (json.status !== 'success' || !Array.isArray(json.data) || json.data.length < 50) {
      throw new Error(json.message || 'Dữ liệu sheet KPI online không hợp lệ');
    }

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    KPI_ONLINE_STATE = {
      data: json.data,
      savedAt: Date.now(),
      timeStr: timeStr
    };

    // Lưu vào IndexedDB
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(KPI_ONLINE_STATE, CACHE_KEY_KPI_ONLINE);
    } catch (e) {}

    renderKpiOnline();

    if (badge) {
      badge.className = 'badge b-live';
      badge.textContent = `API trực tiếp ${timeStr}`;
    }
    if (!isSilent) {
      showToast('Đồng bộ thành công dữ liệu KPI Online!', true);
    }
  } catch (err) {
    console.error('Lỗi tải KPI Online:', err);
    if (badge) {
      badge.className = 'badge b-err';
      badge.textContent = 'Lỗi tải KPI Online';
    }
    if (!isSilent) {
      showToast('Lỗi tải KPI Online: ' + err.message, false);
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

/**
 * Hàm Render chính cho toàn bộ Tab 7
 */
function renderKpiOnline() {
  const container = $('kpionlineSection');
  if (!container || !KPI_ONLINE_STATE.data) return;

  const data = KPI_ONLINE_STATE.data;
  renderKpiOnlineSummaryCards(data);
  renderKpiTeamOnlineTable(data);
  renderNangSuatCallTable(data);
  renderTalktimeNgayTable(data);
  renderSoluongCallNgayTable(data);
}

/**
 * Thẻ KPI tóm tắt tổng quan ở đầu Tab KPI Online
 */
function renderKpiOnlineSummaryCards(data) {
  const box = $('kpiOnlineSummaryCards');
  if (!box || !Array.isArray(data) || data.length < 80) return;

  // Lấy các chỉ số từ Section 1 & Section 2
  const rowHCM = data[10] || [];
  const rowHN = data[17] || [];
  const rowTotal = data[18] || [];

  const actAssigned = (parseFloat(rowHCM[3]) || 0) + (parseFloat(rowHN[3]) || 0);
  const actDone = (parseFloat(rowHCM[4]) || 0) + (parseFloat(rowHN[4]) || 0);
  const actPct = actAssigned > 0 ? ((actDone / actAssigned) * 100).toFixed(1) + '%' : '0%';

  const kpiTotalPct = formatKpiPct(rowTotal[25]);
  const impactPct = formatKpiPct(rowTotal[26]);

  const rowTalkNam = data[54] || [];
  const rowTalkBac = data[61] || [];
  const talkNam = formatTalktime(parseTalktimeSeconds(rowTalkNam[32] || rowTalkNam[1]));
  const talkBac = formatTalktime(parseTalktimeSeconds(rowTalkBac[32] || rowTalkBac[1]));

  const K = (l, v, s, c = '') => `
    <div class="card kpi" style="border-radius:12px;padding:12px 14px">
      <div class="l" style="font-size:11.5px;color:var(--mut);font-weight:600">${l}</div>
      <div class="v" style="${c};font-size:22px;font-weight:800;margin-top:2px">${v}</div>
      <div class="s" style="font-size:11px;color:var(--mut);margin-top:2px">${s}</div>
    </div>
  `;

  box.innerHTML =
    K('Quy Mô Team Online', '13 Nhân Sự', '7 HCM · 6 Hà Nội', 'color:#38bdf8') +
    K('Tổng SL ACT Đã Làm', `${actDone.toLocaleString('vi-VN')} / ${actAssigned.toLocaleString('vi-VN')}`, `Tỷ lệ hoàn thành: ${actPct}`, 'color:#10b981') +
    K('KPI Tổng Đạt Được', kpiTotalPct, `Đạt chuẩn trọng số KPI`, 'color:#f59e0b') +
    K('Tỉ Lệ Impact Team', impactPct, `Tư vấn có phát sinh kết quả`, 'color:#a855f7') +
    K('Talktime TB Miền Nam / Bắc', `${talkNam} / ${talkBac}`, `TB ngày: 01:45 / 01:25`, 'color:#06b6d4');
}

/**
 * =========================================================================
 * MỤC 1: BẢNG KPI TEAM ONLINE (Range A2:AA19 - Data index 3 đến 18)
 * =========================================================================
 */
function renderKpiTeamOnlineTable(data) {
  const tbl = $('tblKpiTeamOnline');
  if (!tbl || !Array.isArray(data) || data.length < 19) return;

  // Lấy các dòng nhân sự từ index 3 đến 18 (Excel row 4 đến 19)
  const rows = data.slice(3, 19);

  // 1. THEAD: Header 2 tầng chuẩn chỉ
  let thead = '<thead>';
  // Tầng 1: Nhóm chỉ số lớn
  thead += `<tr>
    <th rowspan="2" style="width:40px;text-align:center">STT</th>
    <th rowspan="2" style="min-width:180px;text-align:left">NHÂN SỰ</th>
    <th rowspan="2" style="width:55px;text-align:center">LEVEL</th>
    <th colspan="6" style="text-align:center;background:#1e3a8a!important;color:#93c5fd!important">KHỐI LƯỢNG CÔNG VIỆC</th>
    <th colspan="5" style="text-align:center;background:#065f46!important;color:#6ee7b7!important">ĐIỀU KIỆN CẦN</th>
    <th colspan="8" style="text-align:center;background:#854d0e!important;color:#fde047!important">ĐIỀU KIỆN ĐỦ</th>
    <th colspan="3" style="text-align:center;background:#4c1d95!important;color:#c4b5fd!important">TALK TIME (HẾT 9/10)</th>
    <th rowspan="2" style="min-width:90px;text-align:right;background:#0f172a!important;color:#38bdf8!important">KPI TỔNG</th>
    <th rowspan="2" style="min-width:90px;text-align:right;background:#0f172a!important;color:#38bdf8!important">TỈ LỆ IMPACT</th>
  </tr>`;

  // Tầng 2: Chi tiết từng cột
  thead += `<tr>
    <!-- Khối lượng công việc -->
    <th style="min-width:80px;text-align:right">Phân công</th>
    <th style="min-width:80px;text-align:right">Đã làm</th>
    <th style="min-width:80px;text-align:right">Đang làm</th>
    <th style="min-width:80px;text-align:right">Chưa làm</th>
    <th style="min-width:85px;text-align:right">TB/ngày</th>
    <th style="min-width:85px;text-align:right">Tiến độ</th>

    <!-- Điều kiện cần -->
    <th style="min-width:80px;text-align:right">KPI Cần</th>
    <th style="min-width:80px;text-align:right">Thực đạt</th>
    <th style="min-width:80px;text-align:right">Còn thiếu</th>
    <th style="min-width:80px;text-align:right">% Đạt</th>
    <th style="min-width:90px;text-align:center">Đánh giá</th>

    <!-- Điều kiện đủ -->
    <th style="min-width:80px;text-align:right">KPI Tổng</th>
    <th style="min-width:80px;text-align:right">Thực đạt</th>
    <th style="min-width:80px;text-align:right">Còn thiếu</th>
    <th style="min-width:80px;text-align:right">% Đạt</th>
    <th style="min-width:80px;text-align:right">KPI Addon</th>
    <th style="min-width:80px;text-align:right">Thực đạt</th>
    <th style="min-width:80px;text-align:right">Còn thiếu</th>
    <th style="min-width:80px;text-align:right">% Đạt</th>

    <!-- Talk time -->
    <th style="min-width:90px;text-align:center">KPI Talk</th>
    <th style="min-width:90px;text-align:center">Thực đạt</th>
    <th style="min-width:90px;text-align:center">Đánh giá</th>
  </tr></thead>`;

  // 2. TBODY
  let tbody = '<tbody>';

  rows.forEach((r, idx) => {
    const rawStt = r[0];
    const rawName = r[1] || '';
    const isAverageRow = idx === rows.length - 1; // dòng 19
    const meta = getRegionRowMeta(rawName, rawStt, isAverageRow);

    // Lọc theo search
    if (KPI_ONLINE_SEARCH && !meta.isSummary) {
      const q = KPI_ONLINE_SEARCH;
      if (!rawName.toLowerCase().includes(q) && !String(rawStt).toLowerCase().includes(q)) {
        return;
      }
    }

    tbody += `<tr class="${meta.cls}">`;

    // Cột STT & Tên nhân sự
    if (meta.isSummary) {
      let sttLabel = '∑';
      let titleColor = '#38bdf8';
      let badgeBg = '#0284c7';
      if (meta.type === 'nam') {
        sttLabel = '∑ NAM';
        titleColor = '#38bdf8';
        badgeBg = '#0284c7';
      } else if (meta.type === 'bac') {
        sttLabel = '∑ BẮC';
        titleColor = '#fbbf24';
        badgeBg = '#d97706';
      } else {
        sttLabel = '★';
        titleColor = '#c084fc';
        badgeBg = '#9333ea';
      }

      tbody += `<td style="text-align:center"><span style="font-weight:800;color:${titleColor}">${sttLabel}</span></td>`;
      tbody += `<td style="text-align:left;font-weight:800"><span style="display:inline-flex;align-items:center;gap:6px;color:${titleColor}"><span style="font-size:14px">${meta.icon}</span> <b>${meta.title}</b></span></td>`;
      tbody += `<td style="text-align:center"><span class="badge" style="background:${badgeBg};color:#fff;font-weight:800;font-size:10px">${meta.type === 'all' ? 'AVG' : 'TOTAL'}</span></td>`;
    } else {
      tbody += `<td style="text-align:center;color:var(--mut)">${rawStt || idx + 1}</td>`;
      tbody += `<td style="text-align:left;font-weight:600;color:var(--tx-heading)">${esc(rawName)}</td>`;
      tbody += `<td style="text-align:center">${r[2] ? `<span class="level-badge">${esc(r[2])}</span>` : '–'}</td>`;
    }

    // Khối lượng công việc (cột 3..8)
    tbody += `<td style="text-align:right">${formatKpiNum(r[3], 0)}</td>`;
    tbody += `<td style="text-align:right;font-weight:600">${formatKpiNum(r[4], 0)}</td>`;
    tbody += `<td style="text-align:right;color:var(--mut)">${formatKpiNum(r[5], 0)}</td>`;
    tbody += `<td style="text-align:right;color:var(--mut)">${formatKpiNum(r[6], 0)}</td>`;
    tbody += `<td style="text-align:right">${formatKpiNum(r[7], 1)}</td>`;
    tbody += `<td style="text-align:right;font-weight:700;color:#38bdf8">${formatKpiPct(r[8])}</td>`;

    // Điều kiện cần (cột 9..13)
    tbody += `<td style="text-align:right">${formatKpiNum(r[9], 0)}</td>`;
    tbody += `<td style="text-align:right;font-weight:600">${formatKpiNum(r[10], 0)}</td>`;
    tbody += `<td style="text-align:right;color:var(--mut)">${formatKpiNum(r[11], 0)}</td>`;
    tbody += `<td style="text-align:right;font-weight:700">${formatKpiPct(r[12])}</td>`;
    tbody += `<td style="text-align:center">${getKpiStatusBadge(r[13])}</td>`;

    // Điều kiện đủ (cột 14..21)
    tbody += `<td style="text-align:right">${formatKpiNum(r[14], 0)}</td>`;
    tbody += `<td style="text-align:right;font-weight:600">${formatKpiNum(r[15], 0)}</td>`;
    tbody += `<td style="text-align:right;color:var(--mut)">${formatKpiNum(r[16], 0)}</td>`;
    tbody += `<td style="text-align:right;font-weight:700">${formatKpiPct(r[17])}</td>`;
    tbody += `<td style="text-align:right">${formatKpiNum(r[18], 0)}</td>`;
    tbody += `<td style="text-align:right;font-weight:600">${formatKpiNum(r[19], 0)}</td>`;
    tbody += `<td style="text-align:right;color:var(--mut)">${formatKpiNum(r[20], 0)}</td>`;
    tbody += `<td style="text-align:right;font-weight:700">${formatKpiPct(r[21])}</td>`;

    // Talk time (cột 22..24)
    const kpiTalkSec = parseTalktimeSeconds(r[22]);
    const datTalkSec = parseTalktimeSeconds(r[23]);
    tbody += `<td style="text-align:center;font-size:12px;color:var(--mut)">${formatTalktime(kpiTalkSec)}</td>`;
    tbody += `<td style="text-align:center;font-weight:700;font-size:12.5px;color:${datTalkSec >= kpiTalkSec && kpiTalkSec > 0 ? '#10b981' : (datTalkSec > 0 ? '#ef4444' : 'var(--tx)')}">${formatTalktime(datTalkSec)}</td>`;
    tbody += `<td style="text-align:center">${getKpiStatusBadge(r[24])}</td>`;

    // KPI Tổng & Impact
    tbody += `<td style="text-align:right;font-weight:800;color:#38bdf8">${formatKpiPct(r[25])}</td>`;
    tbody += `<td style="text-align:right;font-weight:800;color:#10b981">${formatKpiPct(r[26])}</td>`;

    tbody += '</tr>';
  });

  tbody += '</tbody>';
  tbl.innerHTML = thead + tbody;
}

/**
 * Helper badge trạng thái Đạt / Không đạt
 */
function getKpiStatusBadge(val) {
  const s = String(val || '').trim();
  if (s === 'Đạt') {
    return `<span class="badge" style="background:rgba(16,185,129,0.18);color:#10b981;font-size:11px;padding:2px 7px;font-weight:800">✓ Đạt</span>`;
  }
  if (s === 'Không đạt') {
    return `<span class="badge" style="background:rgba(239,68,68,0.16);color:#ef4444;font-size:11px;padding:2px 7px;font-weight:700">✕ Chưa đạt</span>`;
  }
  return s ? `<span class="mut sm">${esc(s)}</span>` : '–';
}

/**
 * =========================================================================
 * MỤC 2: BẢNG NĂNG SUẤT CALL (Range A27:W42 - Data index 27 đến 41)
 * =========================================================================
 */
function renderNangSuatCallTable(data) {
  const tbl = $('tblNangSuatCall');
  if (!tbl || !Array.isArray(data) || data.length < 42) return;

  const rows = data.slice(27, 42); // 15 dòng (7 HCM + 1 Tổng Nam + 6 HN + 1 Tổng Bắc)

  // 1. THEAD
  let thead = '<thead><tr>';
  thead += '<th style="min-width:180px;text-align:left">NHÂN SỰ / NHÓM</th>';
  thead += '<th style="min-width:75px;text-align:center">CÔNG</th>';
  thead += '<th style="min-width:55px;text-align:center">LEVEL</th>';
  const hours = ['7-8h', '8-9h', '9-10h', '10-11h', '11-12h', '12-13h', '13-14h', '14-15h', '15-16h', '16-17h', '17-18h', '18-19h', '19-20h'];
  hours.forEach(h => {
    thead += `<th style="min-width:60px;text-align:center;font-size:11.5px">${h}</th>`;
  });
  thead += '<th style="min-width:85px;text-align:right;background:#1e3a8a!important;color:#93c5fd!important">TỔNG CALL</th>';
  thead += '<th style="min-width:85px;text-align:right">KẾT NỐI</th>';
  thead += '<th style="min-width:80px;text-align:right">TỈ LỆ K.NỐI</th>';
  thead += '<th style="min-width:85px;text-align:center">KPI TALK</th>';
  thead += '<th style="min-width:85px;text-align:center">THỰC ĐẠT</th>';
  thead += '<th style="min-width:90px;text-align:center">ĐÁNH GIÁ</th>';
  thead += '<th style="min-width:85px;text-align:center;color:#38bdf8">TALK/CALL</th>';
  thead += '</tr></thead>';

  // 2. TBODY
  let tbody = '<tbody>';
  rows.forEach(r => {
    const rawName = r[0] || '';
    const meta = getRegionRowMeta(rawName);

    if (KPI_ONLINE_SEARCH && !meta.isSummary) {
      if (!rawName.toLowerCase().includes(KPI_ONLINE_SEARCH)) return;
    }

    tbody += `<tr class="${meta.cls}">`;

    if (meta.isSummary) {
      const titleColor = meta.type === 'nam' ? '#38bdf8' : (meta.type === 'bac' ? '#fbbf24' : '#c084fc');
      const badgeBg = meta.type === 'nam' ? '#0284c7' : (meta.type === 'bac' ? '#d97706' : '#9333ea');
      tbody += `<td style="text-align:left;font-weight:800"><span style="display:inline-flex;align-items:center;gap:6px;color:${titleColor}"><span style="font-size:14px">${meta.icon}</span> <b>${meta.title}</b></span></td>`;
      tbody += `<td style="text-align:center"><span class="badge" style="background:${badgeBg};color:#fff;font-weight:800;font-size:10px">AVG</span></td>`;
      tbody += `<td style="text-align:center">${r[2] ? `<span class="level-badge">${esc(r[2])}</span>` : '–'}</td>`;
    } else {
      tbody += `<td style="text-align:left;font-weight:600">${esc(rawName)}</td>`;
      tbody += `<td style="text-align:center">${formatKpiNum(r[1], 1)}</td>`;
      tbody += `<td style="text-align:center">${r[2] ? `<span class="level-badge">${esc(r[2])}</span>` : '–'}</td>`;
    }

    // 13 cột giờ: > 20 màu xanh lá, 10-20 màu vàng, dưới 10 màu đỏ, 0 trung tính
    for (let c = 3; c <= 15; c++) {
      const v = parseFloat(r[c]) || 0;
      let cellCls = '';
      let displayVal = '–';

      if (v <= 0) {
        cellCls = 'cell-call-zero';
        displayVal = '–';
      } else if (v >= 20) {
        // > 20 màu xanh lá
        cellCls = 'cell-call-green';
        displayVal = formatKpiNum(v, 1);
      } else if (v >= 10) {
        // 10 < màu vàng < 20
        cellCls = 'cell-call-yellow';
        displayVal = formatKpiNum(v, 1);
      } else {
        // Dưới 10 màu đỏ
        cellCls = 'cell-call-red';
        displayVal = formatKpiNum(v, 1);
      }

      const summaryStyle = meta.isSummary ? 'font-weight:800;' : '';
      tbody += `<td class="${cellCls}" style="text-align:center;padding:6px 4px;font-size:12px;${summaryStyle}">${displayVal}</td>`;
    }

    // Tổng call & kết nối
    tbody += `<td style="text-align:right;font-weight:800;color:#38bdf8">${formatKpiNum(r[16], 1)}</td>`;
    tbody += `<td style="text-align:right;font-weight:600">${formatKpiNum(r[17], 1)}</td>`;
    tbody += `<td style="text-align:right;font-weight:700">${formatKpiPct(r[18])}</td>`;

    // Talktime KPI vs Thực đạt
    const kpiSec = parseTalktimeSeconds(r[19]);
    const datSec = parseTalktimeSeconds(r[20]);
    tbody += `<td style="text-align:center;font-size:12px;color:var(--mut)">${formatTalktime(kpiSec)}</td>`;
    tbody += `<td style="text-align:center;font-weight:700;font-size:12.5px;color:${datSec >= kpiSec && kpiSec > 0 ? '#10b981' : (datSec > 0 ? '#ef4444' : 'var(--tx)')}">${formatTalktime(datSec)}</td>`;
    tbody += `<td style="text-align:center">${getKpiStatusBadge(r[21])}</td>`;

    // Talktime/call
    const perCallSec = parseTalktimeSeconds(r[22]);
    tbody += `<td style="text-align:center;font-weight:600;color:#38bdf8">${formatTalktime(perCallSec)}</td>`;

    tbody += '</tr>';
  });

  tbody += '</tbody>';
  tbl.innerHTML = thead + tbody;
}

/**
 * =========================================================================
 * MỤC 3: BẢNG TALKTIME THEO NGÀY (Range A47:AG62 - Data index 47 đến 61)
 * Yêu cầu đặc biệt:
 * - Cột đầu tiên là cột KPI
 * - Vượt KPI: MÀU XANH
 * - Không đủ KPI: MÀU ĐỎ
 * - 00:00: MÀU TRẮNG / TRUNG TÍNH
 * - Rút gọn ngày (chỉ hiện 1..hôm nay)
 * =========================================================================
 */
function renderTalktimeNgayTable(data) {
  const tbl = $('tblTalktimeNgay');
  const infoSpan = $('talktimeDaysInfo');
  if (!tbl || !Array.isArray(data) || data.length < 62) return;

  const rows = data.slice(47, 62);
  const maxDay = getKpiOnlineMaxDay(rows, true, KPI_ONLINE_SHOW_ALL_TALK_DAYS);

  if (infoSpan) {
    infoSpan.textContent = KPI_ONLINE_SHOW_ALL_TALK_DAYS
      ? `Đang xem toàn bộ tháng (Ngày 1 → 30)`
      : `Đang hiển thị gọn từ Ngày 1 → ${maxDay} (Tự động mở rộng khi có dữ liệu mới)`;
  }
  const btnTalk = $('btnToggleKpiDays');
  if (btnTalk) {
    btnTalk.textContent = KPI_ONLINE_SHOW_ALL_TALK_DAYS ? '📅 Thu gọn ngày (1→Hôm nay)' : '📅 Xem toàn bộ tháng (1→30)';
  }

  // 1. THEAD
  let thead = '<thead><tr>';
  thead += '<th style="min-width:180px;text-align:left">NHÂN SỰ</th>';
  thead += '<th style="min-width:85px;text-align:center;background:#1e3a8a!important;color:#93c5fd!important">KPI</th>';

  for (let d = 1; d <= maxDay; d++) {
    thead += `<th style="min-width:68px;text-align:center;padding:7px 4px" title="Ngày ${d}">N.${d}</th>`;
  }
  thead += '<th style="min-width:90px;text-align:center;background:#0f172a!important;color:#38bdf8!important">TỔNG</th>';
  thead += '</tr></thead>';

  // 2. TBODY
  let tbody = '<tbody>';
  rows.forEach(r => {
    const rawName = r[0] || '';
    const meta = getRegionRowMeta(rawName);

    if (KPI_ONLINE_SEARCH && !meta.isSummary) {
      if (!rawName.toLowerCase().includes(KPI_ONLINE_SEARCH)) return;
    }

    tbody += `<tr class="${meta.cls}">`;

    if (meta.isSummary) {
      const titleColor = meta.type === 'nam' ? '#38bdf8' : (meta.type === 'bac' ? '#fbbf24' : '#c084fc');
      tbody += `<td style="text-align:left;font-weight:800"><span style="display:inline-flex;align-items:center;gap:6px;color:${titleColor}"><span style="font-size:14px">${meta.icon}</span> <b>${meta.title}</b></span></td>`;
    } else {
      tbody += `<td style="text-align:left;font-weight:600">${esc(rawName)}</td>`;
    }

    // Cột KPI chuẩn
    const kpiSec = parseTalktimeSeconds(r[1]);
    const kpiColor = meta.isSummary ? (meta.type === 'nam' ? '#38bdf8' : (meta.type === 'bac' ? '#fbbf24' : '#c084fc')) : '#38bdf8';
    tbody += `<td style="text-align:center;font-weight:700;color:${kpiColor};background:rgba(56,189,248,0.06)">${formatTalktime(kpiSec)}</td>`;

    // Các cột ngày từ 1..maxDay
    for (let d = 1; d <= maxDay; d++) {
      const val = r[d + 1];
      const valSec = parseTalktimeSeconds(val);
      const isZero = valSec === 0;
      const isOver = valSec >= kpiSec && kpiSec > 0;

      let cellStyle = '';
      if (meta.isSummary) {
        if (isZero) {
          cellStyle = 'opacity:0.65;font-weight:700';
        } else if (isOver) {
          cellStyle = 'color:#10b981;font-weight:800;background:rgba(16,185,129,0.22);border-radius:4px';
        } else {
          cellStyle = 'color:#ef4444;font-weight:800;background:rgba(239,68,68,0.2);border-radius:4px';
        }
      } else {
        if (isZero) {
          cellStyle = 'color:var(--tx);opacity:0.65;font-weight:500';
        } else if (isOver) {
          cellStyle = 'color:#10b981;font-weight:700;background:rgba(16,185,129,0.16);border-radius:4px';
        } else {
          cellStyle = 'color:#ef4444;font-weight:600;background:rgba(239,68,68,0.14);border-radius:4px';
        }
      }

      tbody += `<td style="text-align:center;padding:6px 4px;font-size:12px;${cellStyle}">${formatTalktime(valSec)}</td>`;
    }

    // Cột Tổng
    const totSec = parseTalktimeSeconds(r[32]);
    tbody += `<td style="text-align:center;font-weight:800;color:#38bdf8;font-size:12.5px">${formatTalktime(totSec)}</td>`;

    tbody += '</tr>';
  });

  tbody += '</tbody>';
  tbl.innerHTML = thead + tbody;
}

/**
 * =========================================================================
 * MỤC 4: BẢNG SỐ LƯỢNG CALL THEO NGÀY (Range A67:AG82 - Data index 67 đến 81)
 * =========================================================================
 */
function renderSoluongCallNgayTable(data) {
  const tbl = $('tblSoluongCallNgay');
  const infoSpan = $('callDaysInfo');
  if (!tbl || !Array.isArray(data) || data.length < 75) return;

  const rows = data.slice(67, 82);
  const maxDay = getKpiOnlineMaxDay(rows, false, KPI_ONLINE_SHOW_ALL_CALL_DAYS);

  if (infoSpan) {
    infoSpan.textContent = KPI_ONLINE_SHOW_ALL_CALL_DAYS
      ? `Đang xem toàn bộ tháng (Ngày 1 → 30)`
      : `Đang hiển thị gọn từ Ngày 1 → ${maxDay} (Tự động mở rộng khi có dữ liệu mới)`;
  }
  const btnCall = $('btnToggleCallDays');
  if (btnCall) {
    btnCall.textContent = KPI_ONLINE_SHOW_ALL_CALL_DAYS ? '📅 Thu gọn ngày (1→Hôm nay)' : '📅 Xem toàn bộ tháng (1→30)';
  }

  // 1. THEAD
  let thead = '<thead><tr>';
  thead += '<th style="min-width:180px;text-align:left">NHÂN SỰ</th>';
  thead += '<th style="min-width:55px;text-align:center">LEVEL</th>';

  for (let d = 1; d <= maxDay; d++) {
    thead += `<th style="min-width:55px;text-align:center;padding:7px 4px" title="Ngày ${d}">N.${d}</th>`;
  }
  thead += '<th style="min-width:85px;text-align:right;background:#0f172a!important;color:#38bdf8!important">TỔNG</th>';
  thead += '</tr></thead>';

  // 2. TBODY
  let tbody = '<tbody>';
  rows.forEach(r => {
    const rawName = r[0] || '';
    const meta = getRegionRowMeta(rawName);

    if (KPI_ONLINE_SEARCH && !meta.isSummary) {
      if (!rawName.toLowerCase().includes(KPI_ONLINE_SEARCH)) return;
    }

    tbody += `<tr class="${meta.cls}">`;

    if (meta.isSummary) {
      const titleColor = meta.type === 'nam' ? '#38bdf8' : (meta.type === 'bac' ? '#fbbf24' : '#c084fc');
      const badgeBg = meta.type === 'nam' ? '#0284c7' : (meta.type === 'bac' ? '#d97706' : '#9333ea');
      tbody += `<td style="text-align:left;font-weight:800"><span style="display:inline-flex;align-items:center;gap:6px;color:${titleColor}"><span style="font-size:14px">${meta.icon}</span> <b>${meta.title}</b></span></td>`;
      tbody += `<td style="text-align:center"><span class="badge" style="background:${badgeBg};color:#fff;font-weight:800;font-size:10px">AVG</span></td>`;
    } else {
      tbody += `<td style="text-align:left;font-weight:600">${esc(rawName)}</td>`;
      tbody += `<td style="text-align:center">${r[1] ? `<span class="level-badge">${esc(r[1])}</span>` : '–'}</td>`;
    }

    // Các cột ngày từ 1..maxDay
    for (let d = 1; d <= maxDay; d++) {
      const v = r[d + 1];
      const num = typeof v === 'number' ? v : parseFloat(v) || 0;
      const isZero = num === 0;

      let cellStyle = isZero ? 'color:var(--mut);opacity:0.4' : 'font-weight:700;color:var(--tx)';
      tbody += `<td style="text-align:center;padding:6px 4px;font-size:12.5px;${cellStyle}">${isZero ? '0' : formatKpiNum(num, meta.isSummary ? 1 : 0)}</td>`;
    }

    // Cột Tổng
    const tot = typeof r[32] === 'number' ? r[32] : parseFloat(r[32]) || 0;
    tbody += `<td style="text-align:right;font-weight:800;color:#38bdf8">${formatKpiNum(tot, meta.isSummary ? 1 : 0)}</td>`;

    tbody += '</tr>';
  });

  tbody += '</tbody>';
  tbl.innerHTML = thead + tbody;
}

/**
 * =========================================================================
 * XUẤT CSV CHO TAB KPI ONLINE
 * =========================================================================
 */
function exportKpiOnlineCsv(filename, rows) {
  const csvContent = '\ufeff' + rows.map(r => {
    return (r || []).map(val => {
      const s = String(val == null ? '' : val);
      return '"' + s.replace(/"/g, '""') + '"';
    }).join(',');
  }).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  showToast(`Đã xuất thành công file ${filename}!`, true);
}

function exportKpiTeamOnlineCsv() {
  if (!KPI_ONLINE_STATE.data) return;
  const rows = KPI_ONLINE_STATE.data.slice(1, 19);
  exportKpiOnlineCsv(`kpi_team_online_${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

function exportNangSuatCallCsv() {
  if (!KPI_ONLINE_STATE.data) return;
  const rows = KPI_ONLINE_STATE.data.slice(26, 42);
  exportKpiOnlineCsv(`nang_suat_call_${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

function exportTalktimeNgayCsv() {
  if (!KPI_ONLINE_STATE.data) return;
  const rows = KPI_ONLINE_STATE.data.slice(46, 62);
  exportKpiOnlineCsv(`talktime_theo_ngay_${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

function exportSoluongCallNgayCsv() {
  if (!KPI_ONLINE_STATE.data) return;
  const rows = KPI_ONLINE_STATE.data.slice(66, 82);
  exportKpiOnlineCsv(`so_luong_call_theo_ngay_${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

function exportKpiOnlineAllCsv() {
  if (!KPI_ONLINE_STATE.data) return;
  exportKpiOnlineCsv(`toan_bo_kpi_online_${new Date().toISOString().slice(0, 10)}.csv`, KPI_ONLINE_STATE.data);
}
