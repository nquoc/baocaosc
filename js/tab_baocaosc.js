/**
 * tab_baocaosc.js - Logic xử lý dữ liệu và giao diện Tab 6: BÁO CÁO SC
 * Mục 1: Báo Cáo Mục Tiêu & Tiến Độ Tháng (Team Offline & Online)
 * Mục 2: Tỷ Lệ Inactive Theo Tháng Năm 2026 (Sheet baocaotuan AV2:BB15)
 * Mục 3: Active Rate Năm 2026 (Retail, F&B, Booking qua các tháng)
 * Mục 4: Tỷ Lệ Chăm Khách New T10 (Ký Mới, Inactive, SC Chăm)
 * Mục 5: Triển Khai Tệp FNB Lớn (Sheet baocaotuan AR2:AS9)
 * Mục 6: Impact Theo Tỉnh Thành Phố (T7 - T12)
 * Mục 7: Tỷ Lệ Impact Theo Nguồn Data & Ngành Hàng
 * Mục 8: Quân Số Đội Ngũ SC
 * Mục 9: Hiệu Suất KPI Team & Tư Vấn Chuyển Addon
 */

/* ==========================================================================
   MỤC 1: BÁO CÁO MỤC TIÊU & TIẾN ĐỘ THÁNG (TEAM OFFLINE & TEAM ONLINE)
   - Sheet: 'muctieu' (A2:I13 cho Offline & A16:I28 cho Online)
   ========================================================================== */

function findMuctieuRow(data, keyword) {
  if (!Array.isArray(data)) return null;
  const kw = keyword.toLowerCase();
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (row && String(row[0] || '').toLowerCase().includes(kw)) {
      const rawTarget = Number(row[1]) || 0;
      const rawActual = Number(row[2]) || 0;
      const target = Math.round(rawTarget);
      const actual = Math.round(rawActual);
      let pct = null;
      if (row[3] != null && row[3] !== '') {
        const pNum = Number(row[3]);
        pct = isNaN(pNum) ? null : (pNum <= 5 ? pNum * 100 : pNum);
      } else if (rawTarget > 0) {
        pct = (rawActual / rawTarget) * 100;
      }
      return {
        label: String(row[0] || '').trim(),
        target,
        actual,
        pct
      };
    }
  }
  return null;
}

function renderBaoCaoScMuctieuSummaryCards(offData, onData) {
  const box = $('bscMuctieuSummaryCards');
  if (!box) return;

  const offImpact = findMuctieuRow(offData, 'impact');
  const offAddon = findMuctieuRow(offData, 'addon');
  const onImpact = findMuctieuRow(onData, 'impact');
  const onAddon = findMuctieuRow(onData, 'addon');

  const K = (label, val, sub, color = '') => `
    <div class="card kpi">
      <div class="l">${label}</div>
      <div class="v" style="${color}">${val}</div>
      <div class="s">${sub}</div>
    </div>`;

  const fmtVal = row => {
    if (!row) return '–';
    const pctStr = row.pct != null ? ` (${row.pct.toFixed(1)}%)` : '';
    return `${n0(Math.round(row.actual))} / ${n0(Math.round(row.target))}${pctStr}`;
  };

  const fmtSub = (row, team) => {
    if (!row) return `Chưa có số liệu (${team})`;
    return `Mục tiêu: ${n0(Math.round(row.target))} · Thực đạt: ${n0(Math.round(row.actual))}`;
  };

  box.innerHTML =
    K('🏢 Impact Offline (Tháng)', fmtVal(offImpact), fmtSub(offImpact, 'Offline'), 'color:#facc15') +
    K('🏢 Addon Offline (Tháng)', fmtVal(offAddon), fmtSub(offAddon, 'Offline'), 'color:#ec4899') +
    K('🌐 Impact Online (Tháng)', fmtVal(onImpact), fmtSub(onImpact, 'Online'), 'color:#38bdf8') +
    K('🌐 Addon Online (Tháng)', fmtVal(onAddon), fmtSub(onAddon, 'Online'), 'color:#a855f7');
}

function renderBaoCaoScMuctieu() {
  const offData = BAOCAOSC_STATE.muctieuOffline || (typeof MUCTIEU_STATE !== 'undefined' ? MUCTIEU_STATE.offline : null);
  const onData = BAOCAOSC_STATE.muctieuOnline || (typeof MUCTIEU_STATE !== 'undefined' ? MUCTIEU_STATE.online : null);

  renderBaoCaoScMuctieuSummaryCards(offData, onData);

  const offEl = $('bscOfflineTblContainer');
  const onEl = $('bscOnlineTblContainer');

  if (offEl && offData && typeof renderOfflineTable === 'function') {
    offEl.innerHTML = renderOfflineTable(offData);
  }
  if (onEl && onData && typeof renderOnlineTable === 'function') {
    onEl.innerHTML = renderOnlineTable(onData);
  }
}

function exportMuctieuOfflineCsv() {
  const data = BAOCAOSC_STATE.muctieuOffline || (typeof MUCTIEU_STATE !== 'undefined' ? MUCTIEU_STATE.offline : null);
  if (!Array.isArray(data) || !data.length) {
    showToast('Chưa có dữ liệu Mục Tiêu Offline để xuất CSV!', false);
    return;
  }
  const lines = [];
  lines.push(['BÁO CÁO SC - MỤC 1.1: MỤC TIÊU TEAM OFFLINE']);
  lines.push(['Xuất ngày: ' + new Date().toLocaleString('vi-VN')]);
  lines.push([]);
  data.forEach((row, r) => {
    const line = row.map((val, c) => {
      const formatted = r === 0 ? String(val || '') : (typeof formatMuctieuVal === 'function' ? formatMuctieuVal(val, c) : String(val || ''));
      return '"' + String(formatted).replace(/"/g, '""') + '"';
    });
    lines.push(line);
  });
  const csv = '\ufeff' + lines.map(r => r.join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `BaoCaoSC_Muc_1_1_Muctieu_Offline_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('Đã xuất file CSV Mục Tiêu Team Offline (Mục 1.1) thành công!', true);
}

function exportMuctieuOnlineCsv() {
  const data = BAOCAOSC_STATE.muctieuOnline || (typeof MUCTIEU_STATE !== 'undefined' ? MUCTIEU_STATE.online : null);
  if (!Array.isArray(data) || !data.length) {
    showToast('Chưa có dữ liệu Mục Tiêu Online để xuất CSV!', false);
    return;
  }
  const lines = [];
  lines.push(['BÁO CÁO SC - MỤC 1.2: MỤC TIÊU TEAM ONLINE']);
  lines.push(['Xuất ngày: ' + new Date().toLocaleString('vi-VN')]);
  lines.push([]);
  data.forEach((row, r) => {
    const line = row.map((val, c) => {
      const formatted = r === 0 ? String(val || '') : (typeof formatMuctieuVal === 'function' ? formatMuctieuVal(val, c) : String(val || ''));
      return '"' + String(formatted).replace(/"/g, '""') + '"';
    });
    lines.push(line);
  });
  const csv = '\ufeff' + lines.map(r => r.join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `BaoCaoSC_Muc_1_2_Muctieu_Online_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('Đã xuất file CSV Mục Tiêu Team Online (Mục 1.2) thành công!', true);
}

// Helper parse số tỷ lệ phần trăm từ Google Sheet
function parseActiveRateVal(val) {
  if (val == null || val === '' || val === '-') return null;
  if (typeof val === 'number') {
    if (isNaN(val)) return null;
    return val <= 1 ? val * 100 : val;
  }
  const s = String(val).replace(/%/g, '').replace(/\./g, '').replace(/,/g, '.').trim();
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return n <= 1 ? n * 100 : n;
}

/* ==========================================================================
   MỤC 2: TỶ LỆ INACTIVE THEO THÁNG NĂM 2026
   - Sheet: 'baocaotuan' (range AV2:BB15)
   - Cột: Tháng ký | Tổng gian hàng | Số GH Inactive | % Inactive | SL SC chăm | % SC chăm | % SC Onboarding
   ========================================================================== */

/**
 * Chuẩn hóa dữ liệu thô từ sheet 'baocaotuan' (range AV2:BB15)
 */
function normalizeMonthlyInactiveData(rawData) {
  if (!Array.isArray(rawData) || rawData.length < 2) return null;

  const items = [];
  let totalItem = null;

  function parseMonth(val) {
    if (!val) return null;
    const s = String(val).trim();
    if (s.toLowerCase().includes('total') || s.toLowerCase().includes('tổng')) {
      return { label: 'TỔNG CỘNG', fullLabel: 'TỔNG CỘNG (10 Tháng)', mNum: 99, year: 2026, isTotal: true };
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const vn = new Date(d.getTime() + 7 * 3600 * 1000);
      const m = vn.getUTCMonth() + 1;
      const y = vn.getUTCFullYear();
      return { label: `Tháng ${m}`, fullLabel: `Tháng ${m}/${y}`, mNum: m, year: y, isTotal: false };
    }
    const match = s.match(/\d+/);
    const m = match ? parseInt(match[0], 10) : 0;
    return { label: `Tháng ${m}`, fullLabel: s, mNum: m, year: 2026, isTotal: false };
  }

  for (let r = 1; r < rawData.length; r++) {
    const row = rawData[r];
    if (!row || !row.length || !row[0]) continue;
    const monthInfo = parseMonth(row[0]);
    if (!monthInfo) continue;

    const noRetailer = Number(row[1]) || 0;
    const noInactive = Number(row[2]) || 0;
    const pctInactive = parseActiveRateVal(row[3]);
    const numSccs = Number(row[4]) || 0;
    const pctSccs = parseActiveRateVal(row[5]);
    const pctSccsOnboarding = parseActiveRateVal(row[6]);

    // Bỏ qua dòng trống
    if (noRetailer === 0 && noInactive === 0 && !monthInfo.isTotal) continue;

    const item = {
      rawMonth: row[0],
      label: monthInfo.label,
      fullLabel: monthInfo.fullLabel,
      mNum: monthInfo.mNum,
      year: monthInfo.year,
      noRetailer,
      noInactive,
      pctInactive: pctInactive != null ? pctInactive : (noRetailer > 0 ? (noInactive / noRetailer) * 100 : 0),
      numSccs,
      pctSccs: pctSccs != null ? pctSccs : (noRetailer > 0 ? (numSccs / noRetailer) * 100 : 0),
      pctSccsOnboarding: pctSccsOnboarding != null ? pctSccsOnboarding : 0,
      isTotal: monthInfo.isTotal || false
    };

    if (item.isTotal) {
      totalItem = item;
    } else {
      items.push(item);
    }
  }

  // Fallback nếu thiếu dòng Total: tự tính tổng từ các tháng
  if (!totalItem && items.length > 0) {
    const totRetailer = items.reduce((s, it) => s + it.noRetailer, 0);
    const totInactive = items.reduce((s, it) => s + it.noInactive, 0);
    const totSccs = items.reduce((s, it) => s + it.numSccs, 0);
    totalItem = {
      rawMonth: 'Total',
      label: 'TỔNG CỘNG',
      fullLabel: 'TỔNG CỘNG (10 Tháng)',
      mNum: 99,
      year: 2026,
      noRetailer: totRetailer,
      noInactive: totInactive,
      pctInactive: totRetailer > 0 ? (totInactive / totRetailer) * 100 : 0,
      numSccs: totSccs,
      pctSccs: totRetailer > 0 ? (totSccs / totRetailer) * 100 : 0,
      pctSccsOnboarding: 0,
      isTotal: true
    };
  }

  return {
    items,
    totalItem
  };
}

/**
 * Hiển thị 4 thẻ KPI tóm tắt Mục 2
 */
function renderMonthlyInactiveSummaryCards(parsed) {
  const box = $('bscMonthlyInactiveSummaryCards');
  if (!box || !parsed || !parsed.totalItem) return;

  const tot = parsed.totalItem;
  const K = (label, val, sub, color = '') => `
    <div class="card kpi">
      <div class="l">${label}</div>
      <div class="v" style="${color}">${val}</div>
      <div class="s">${sub}</div>
    </div>`;

  box.innerHTML =
    K('📉 Tỷ Lệ Inactive (Cả Năm)', `${tot.pctInactive.toFixed(2)}%`, `${n0(tot.noInactive)} / ${n0(tot.noRetailer)} gian hàng`, 'color:#f43f5e') +
    K('🏢 Tổng Gian Hàng Ký Mới', `${n0(tot.noRetailer)} <span style="font-size:13px;font-weight:400;color:var(--mut)">gian hàng</span>`, `Ghi nhận 10 tháng đầu năm 2026`, 'color:#38bdf8') +
    K('👥 Tỷ Lệ SC Chăm Sóc', `${tot.pctSccs.toFixed(2)}%`, `${n0(tot.numSccs)} / ${n0(tot.noRetailer)} gian hàng`, 'color:#10b981') +
    K('🚀 Tỷ Lệ SC Onboarding', `${tot.pctSccsOnboarding.toFixed(2)}%`, `Tỷ lệ gian hàng mới được SC onboarding`, 'color:#a855f7');
}

/**
 * Điều khiển sắp xếp bảng Mục 2
 */
function sortMonthlyInactive(key) {
  if (BAOCAOSC_MONTHLY_INACTIVE_SORT.k === key) {
    BAOCAOSC_MONTHLY_INACTIVE_SORT.dir = -BAOCAOSC_MONTHLY_INACTIVE_SORT.dir;
  } else {
    BAOCAOSC_MONTHLY_INACTIVE_SORT.k = key;
    BAOCAOSC_MONTHLY_INACTIVE_SORT.dir = (key === 'mNum' || key === 'label') ? 1 : -1;
  }
  if (BAOCAOSC_STATE.monthlyInactive) {
    const parsed = normalizeMonthlyInactiveData(BAOCAOSC_STATE.monthlyInactive);
    if (parsed) renderMonthlyInactiveTable(parsed);
  }
}

/**
 * Lọc tìm kiếm theo tháng Mục 2
 */
function onMonthlyInactiveSearch(val) {
  BAOCAOSC_MONTHLY_INACTIVE_SEARCH = String(val || '').trim().toLowerCase();
  if (BAOCAOSC_STATE.monthlyInactive) {
    const parsed = normalizeMonthlyInactiveData(BAOCAOSC_STATE.monthlyInactive);
    if (parsed) renderMonthlyInactiveTable(parsed);
  }
}

/**
 * Render bảng chi tiết Mục 2: Tỷ Lệ Inactive Theo Tháng
 */
function renderMonthlyInactiveTable(parsed) {
  const tbl = $('bscMonthlyInactiveTable');
  if (!tbl || !parsed) return;

  let list = [...parsed.items];
  const q = BAOCAOSC_MONTHLY_INACTIVE_SEARCH;
  if (q) {
    list = list.filter(it => it.label.toLowerCase().includes(q) || it.fullLabel.toLowerCase().includes(q));
  }

  const { k, dir } = BAOCAOSC_MONTHLY_INACTIVE_SORT;
  list.sort((a, b) => {
    if (k === 'label' || k === 'fullLabel') {
      return dir * a.label.localeCompare(b.label, 'vi');
    }
    return dir * ((a[k] || 0) - (b[k] || 0));
  });

  const getArrow = col => {
    if (k !== col) return ' ⇅';
    return dir === 1 ? ' ▲' : ' ▼';
  };

  let thead = `
    <thead>
      <tr>
        <th style="width:45px;text-align:center">STT</th>
        <th style="text-align:left;cursor:pointer" onclick="sortMonthlyInactive('mNum')">Tháng Ký${getArrow('mNum')}</th>
        <th style="text-align:right;cursor:pointer;width:130px" onclick="sortMonthlyInactive('noRetailer')">Tổng Gian Hàng${getArrow('noRetailer')}</th>
        <th style="text-align:right;cursor:pointer;width:130px" onclick="sortMonthlyInactive('noInactive')">Số GH Inactive${getArrow('noInactive')}</th>
        <th style="text-align:right;cursor:pointer;width:135px" onclick="sortMonthlyInactive('pctInactive')">Tỷ Lệ Inactive${getArrow('pctInactive')}</th>
        <th style="text-align:right;cursor:pointer;width:135px" onclick="sortMonthlyInactive('numSccs')">SL SC Chăm Sóc${getArrow('numSccs')}</th>
        <th style="text-align:right;cursor:pointer;width:135px" onclick="sortMonthlyInactive('pctSccs')">Tỷ Lệ SC Chăm${getArrow('pctSccs')}</th>
        <th style="text-align:right;cursor:pointer;width:145px" onclick="sortMonthlyInactive('pctSccsOnboarding')">Tỷ Lệ SC Onboard${getArrow('pctSccsOnboarding')}</th>
      </tr>
    </thead>`;

  let tbody = '<tbody>';
  if (list.length === 0) {
    tbody += '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--mut)">Không tìm thấy tháng phù hợp</td></tr>';
  } else {
    list.forEach((it, idx) => {
      // Badge màu Tỷ Lệ Inactive (thấp là tốt)
      let inactiveBadge = 'background:rgba(16,185,129,0.15);color:#10b981;padding:3px 8px;border-radius:6px;font-weight:700';
      if (it.pctInactive >= 40) {
        inactiveBadge = 'background:rgba(239,68,68,0.18);color:#ef4444;padding:3px 8px;border-radius:6px;font-weight:700';
      } else if (it.pctInactive >= 30) {
        inactiveBadge = 'background:rgba(245,158,11,0.18);color:#f59e0b;padding:3px 8px;border-radius:6px;font-weight:700';
      }

      // Badge màu Tỷ Lệ SC Chăm (cao là tốt)
      let sccsBadge = 'background:rgba(16,185,129,0.15);color:#10b981;padding:3px 8px;border-radius:6px;font-weight:700';
      if (it.pctSccs < 70) {
        sccsBadge = 'background:rgba(239,68,68,0.18);color:#ef4444;padding:3px 8px;border-radius:6px;font-weight:700';
      } else if (it.pctSccs < 90) {
        sccsBadge = 'background:rgba(56,189,248,0.15);color:#0284c7;padding:3px 8px;border-radius:6px;font-weight:700';
      }

      tbody += `
        <tr>
          <td style="text-align:center;color:var(--mut)">${idx + 1}</td>
          <td style="text-align:left;font-weight:700;color:var(--tx-heading)">${esc(it.label)} <span class="mut sm" style="font-weight:400">(/2026)</span></td>
          <td style="text-align:right;font-weight:700;color:var(--tx-heading)">${n0(it.noRetailer)}</td>
          <td style="text-align:right;font-weight:700;color:#f43f5e">${n0(it.noInactive)}</td>
          <td style="text-align:right"><span class="badge" style="${inactiveBadge}">${it.pctInactive.toFixed(2)}%</span></td>
          <td style="text-align:right;font-weight:700;color:#10b981">${n0(it.numSccs)}</td>
          <td style="text-align:right"><span class="badge" style="${sccsBadge}">${it.pctSccs.toFixed(2)}%</span></td>
          <td style="text-align:right;color:var(--tx);font-weight:600">${it.pctSccsOnboarding.toFixed(2)}%</td>
        </tr>`;
    });
  }
  tbody += '</tbody>';

  const tot = parsed.totalItem;
  let tfoot = '';
  if (tot) {
    tfoot = `
      <tfoot>
        <tr style="font-weight:800;background:var(--card-sub, var(--card))">
          <td style="text-align:center;color:var(--mut)">★</td>
          <td style="text-align:left;color:var(--tx-heading)">TỔNG CỘNG (${list.length} Tháng)</td>
          <td style="text-align:right;color:var(--tx-heading);font-size:14px">${n0(tot.noRetailer)}</td>
          <td style="text-align:right;color:#f43f5e;font-size:14px">${n0(tot.noInactive)}</td>
          <td style="text-align:right;color:#f43f5e;font-size:13.5px">${tot.pctInactive.toFixed(2)}%</td>
          <td style="text-align:right;color:#10b981;font-size:14px">${n0(tot.numSccs)}</td>
          <td style="text-align:right;color:#10b981;font-size:13.5px">${tot.pctSccs.toFixed(2)}%</td>
          <td style="text-align:right;color:var(--tx);font-size:13.5px">${tot.pctSccsOnboarding.toFixed(2)}%</td>
        </tr>
      </tfoot>`;
  }

  tbl.innerHTML = thead + tbody + tfoot;
}

/**
 * Xuất file CSV Mục 2
 */
function exportMonthlyInactiveCsv() {
  if (!BAOCAOSC_STATE.monthlyInactive) {
    showToast('Chưa có dữ liệu Tỷ Lệ Inactive để xuất CSV!', false);
    return;
  }
  const parsed = normalizeMonthlyInactiveData(BAOCAOSC_STATE.monthlyInactive);
  if (!parsed) return;

  const rows = parsed.items.map((it, idx) => [
    idx + 1,
    it.fullLabel,
    it.noRetailer,
    it.noInactive,
    it.pctInactive.toFixed(2) + '%',
    it.numSccs,
    it.pctSccs.toFixed(2) + '%',
    it.pctSccsOnboarding.toFixed(2) + '%'
  ]);

  if (parsed.totalItem) {
    const tot = parsed.totalItem;
    rows.push(['★', tot.label, tot.noRetailer, tot.noInactive, tot.pctInactive.toFixed(2) + '%', tot.numSccs, tot.pctSccs.toFixed(2) + '%', tot.pctSccsOnboarding.toFixed(2) + '%']);
  }

  exportGenericCsv(
    'BÁO CÁO SC - MỤC 2: TỶ LỆ INACTIVE THEO THÁNG NĂM 2026 (SHEET baocaotuan AV2:BB15)',
    ['STT', 'Tháng Ký', 'Tổng Gian Hàng', 'Số GH Inactive', 'Tỷ Lệ Inactive (%)', 'SL SC Chăm Sóc', 'Tỷ Lệ SC Chăm (%)', 'Tỷ Lệ SC Onboarding (%)'],
    rows,
    'BaoCaoSC_Muc_2_TyLe_Inactive_TheoThang_2026',
    'Đã xuất file CSV Tỷ Lệ Inactive Theo Tháng (Mục 2) thành công!'
  );
}

/* ==========================================================================
   MỤC 3: ACTIVE RATE NĂM 2026 (RETAIL · F&B · BOOKING)
   ========================================================================== */

/**
 * Chuẩn hóa dữ liệu thô từ sheet 'baocaotuan' (range A2:D14)
 */
function normalizeActiveRateData(rawData) {
  if (!Array.isArray(rawData) || rawData.length < 2) return null;

  // 1. Nhận diện dòng tiêu đề & các cột
  let headerRowIdx = 0;
  for (let r = 0; r < Math.min(3, rawData.length); r++) {
    const row = rawData[r] || [];
    const rowStr = row.map(x => String(x || '').toLowerCase()).join(' ');
    if (rowStr.includes('reatail') || rowStr.includes('retail') || rowStr.includes('fnb') || rowStr.includes('booking')) {
      headerRowIdx = r;
      break;
    }
  }

  const headerRow = rawData[headerRowIdx] || [];
  let colMonth = 0;
  let colRetail = -1;
  let colFnb = -1;
  let colBooking = -1;

  for (let c = 0; c < headerRow.length; c++) {
    const h = String(headerRow[c] || '').trim().toLowerCase();
    if (h.includes('mục') || h.includes('tháng') || h.includes('kỳ')) colMonth = c;
    else if (h.includes('retail') || h.includes('reatail')) colRetail = c;
    else if (h.includes('fnb') || h.includes('f&b') || h.includes('ẩm thực')) colFnb = c;
    else if (h.includes('booking') || h.includes('đặt chỗ')) colBooking = c;
  }

  // Fallback thứ tự mặc định: 0: Mục, 1: Retail, 2: F&B, 3: Booking
  if (colRetail === -1) colRetail = 1;
  if (colFnb === -1) colFnb = 2;
  if (colBooking === -1) colBooking = 3;

  // 2. Duyệt từng dòng tháng (chỉ lấy các dòng có tên tháng)
  const months = [];
  for (let r = headerRowIdx + 1; r < rawData.length; r++) {
    const row = rawData[r];
    if (!row || !row.length) continue;

    const rawMonth = String(row[colMonth] || '').trim();
    if (!rawMonth || (!rawMonth.toLowerCase().includes('tháng') && !/^\d+$/.test(rawMonth))) {
      continue;
    }

    const numMatch = rawMonth.match(/\d+/);
    const mNum = numMatch ? parseInt(numMatch[0], 10) : (months.length + 1);
    const cleanLabel = `Tháng ${mNum}`;

    const retailVal = parseActiveRateVal(row[colRetail]);
    const fnbVal = parseActiveRateVal(row[colFnb]);
    const bookingVal = parseActiveRateVal(row[colBooking]);

    // Tính trung bình cộng 3 ngành của tháng (nếu có dữ liệu)
    const validVals = [retailVal, fnbVal, bookingVal].filter(v => v != null);
    const avgVal = validVals.length ? validVals.reduce((s, x) => s + x, 0) / validVals.length : null;

    months.push({
      rawLabel: rawMonth,
      cleanLabel: cleanLabel,
      mNum: mNum,
      mIdx: months.length,
      retail: retailVal,
      fnb: fnbVal,
      booking: bookingVal,
      avg: avgVal,
      diffRetail: null,
      diffFnb: null,
      diffBooking: null,
      diffAvg: null,
      isBase: false
    });
  }

  if (!months.length) return null;

  // Sắp xếp theo số tháng tăng dần
  months.sort((a, b) => a.mNum - b.mNum);
  months.forEach((m, idx) => { m.mIdx = idx; });

  // 3. Tính mức độ tăng / giảm so với tháng trước đó (MoM Delta)
  let lastFilled = null;
  for (let i = 0; i < months.length; i++) {
    const cur = months[i];
    const hasData = cur.retail != null || cur.fnb != null || cur.booking != null;

    if (!lastFilled && hasData) {
      cur.isBase = true; // Tháng có số liệu đầu tiên là mốc khởi điểm
      lastFilled = cur;
    } else if (lastFilled && hasData) {
      cur.isBase = false;
      cur.diffRetail = (cur.retail != null && lastFilled.retail != null) ? (cur.retail - lastFilled.retail) : null;
      cur.diffFnb = (cur.fnb != null && lastFilled.fnb != null) ? (cur.fnb - lastFilled.fnb) : null;
      cur.diffBooking = (cur.booking != null && lastFilled.booking != null) ? (cur.booking - lastFilled.booking) : null;
      cur.diffAvg = (cur.avg != null && lastFilled.avg != null) ? (cur.avg - lastFilled.avg) : null;
      lastFilled = cur;
    }
  }

  // 4. Thống kê cả năm
  function calcStats(key) {
    const valid = months.filter(m => m[key] != null);
    if (!valid.length) return { avg: 0, min: 0, max: 0, latest: 0, latestDiff: 0, bestMonth: '–' };
    const sum = valid.reduce((s, m) => s + m[key], 0);
    const avg = sum / valid.length;
    let minM = valid[0];
    let maxM = valid[0];
    valid.forEach(m => {
      if (m[key] < minM[key]) minM = m;
      if (m[key] > maxM[key]) maxM = m;
    });
    return {
      avg,
      min: minM[key],
      minMonth: minM.cleanLabel,
      max: maxM[key],
      maxMonth: maxM.cleanLabel
    };
  }

  const statsRetail = calcStats('retail');
  const statsFnb = calcStats('fnb');
  const statsBooking = calcStats('booking');
  const statsAvg = calcStats('avg');

  // Lấy tháng mới nhất có số liệu thực tế để hiển thị lên thẻ KPI
  const monthsWithData = months.filter(m => m.retail != null || m.fnb != null || m.booking != null);
  const latestMonth = monthsWithData.length ? monthsWithData[monthsWithData.length - 1] : months[months.length - 1];

  return {
    months,
    statsRetail,
    statsFnb,
    statsBooking,
    statsAvg,
    latestMonth
  };
}

/**
 * Format ô tỷ lệ Active kèm màu sắc xanh/đỏ tăng giảm so với tháng trước
 */
function renderActiveRateCell(val, diff, isBase = false) {
  if (val == null || isNaN(val)) {
    return `<div class="ar-cell"><span style="color:var(--mut);opacity:0.5">–</span></div>`;
  }

  const valTxt = val.toFixed(2) + '%';

  // Tháng đầu tiên (mốc khởi điểm)
  if (isBase) {
    return `
      <div class="ar-cell">
        <span class="ar-val" style="color:var(--tx-heading)">${valTxt}</span>
        <span class="ar-badge ar-base" title="Tháng khởi điểm trong năm">Mốc đầu</span>
      </div>`;
  }

  if (diff == null || isNaN(diff)) {
    return `<div class="ar-cell"><span class="ar-val">${valTxt}</span></div>`;
  }

  // Tăng (> 0) -> XANH LÁ
  if (diff > 0.0001) {
    const diffTxt = `+${diff.toFixed(2)}%`;
    return `
      <div class="ar-cell">
        <span class="ar-val" style="color:#10b981">${valTxt}</span>
        <span class="ar-badge ar-up" title="Tăng ${diffTxt} so với tháng trước">▲ ${diffTxt}</span>
      </div>`;
  }

  // Giảm (< 0) -> ĐỎ
  if (diff < -0.0001) {
    const diffTxt = `${diff.toFixed(2)}%`;
    return `
      <div class="ar-cell">
        <span class="ar-val" style="color:#ef4444">${valTxt}</span>
        <span class="ar-badge ar-down" title="Giảm ${diffTxt} so với tháng trước">▼ ${diffTxt}</span>
      </div>`;
  }

  // Giữ nguyên (== 0) -> XÁM
  return `
    <div class="ar-cell">
      <span class="ar-val" style="color:var(--tx)">${valTxt}</span>
      <span class="ar-badge ar-flat" title="Không đổi so với tháng trước">— 0.00%</span>
    </div>`;
}

/**
 * Hiển thị 3 thẻ KPI tóm tắt cho 3 ngành (Retail, F&B, Booking)
 */
function renderBaoCaoScSummaryCards(parsed) {
  const box = $('bscSummaryCards');
  if (!box || !parsed) return;

  const lat = parsed.latestMonth;
  const K = (label, val, sub, color = '') => `
    <div class="card kpi">
      <div class="l">${label}</div>
      <div class="v" style="${color}">${val}</div>
      <div class="s">${sub}</div>
    </div>`;

  const makeDiffSub = (diff, prevVal, prevLabel) => {
    if (diff == null || isNaN(diff)) return 'Mốc so sánh khởi điểm';
    if (diff > 0.0001) {
      return `<b style="color:#10b981">▲ +${diff.toFixed(2)}%</b> so với ${prevLabel} (${prevVal.toFixed(2)}%)`;
    }
    if (diff < -0.0001) {
      return `<b style="color:#ef4444">▼ ${diff.toFixed(2)}%</b> so với ${prevLabel} (${prevVal.toFixed(2)}%)`;
    }
    return `<span style="color:var(--mut)">— Không đổi</span> so với ${prevLabel} (${prevVal.toFixed(2)}%)`;
  };

  const dataMonths = parsed.months.filter(m => m.retail != null || m.fnb != null || m.booking != null);
  const latIdx = dataMonths.indexOf(lat);
  const prevM = latIdx > 0 ? dataMonths[latIdx - 1] : null;
  const prevLabel = prevM ? prevM.cleanLabel : '';

  box.innerHTML =
    K(`Retail (${esc(lat.cleanLabel)})`, lat.retail != null ? lat.retail.toFixed(2) + '%' : '–', prevM && prevM.retail != null ? makeDiffSub(lat.diffRetail, prevM.retail, prevLabel) : 'Mốc đầu', 'color:#38bdf8') +
    K(`F&B (${esc(lat.cleanLabel)})`, lat.fnb != null ? lat.fnb.toFixed(2) + '%' : '–', prevM && prevM.fnb != null ? makeDiffSub(lat.diffFnb, prevM.fnb, prevLabel) : 'Mốc đầu', 'color:#10b981') +
    K(`Booking (${esc(lat.cleanLabel)})`, lat.booking != null ? lat.booking.toFixed(2) + '%' : '–', prevM && prevM.booking != null ? makeDiffSub(lat.diffBooking, prevM.booking, prevLabel) : 'Mốc đầu', 'color:#c084fc');
}

/**
 * Placeholder cho hàm chart (đã lược bỏ biểu đồ theo yêu cầu)
 */
function renderBaoCaoScCharts() {}

/**
 * BẢNG CHI TIẾT THEO TỪNG THÁNG (TIMELINE VIEW - MỤC 3)
 */
function renderActiveRateTimelineTable(parsed) {
  const tbl = $('bscTimelineTable');
  if (!tbl || !parsed) return;

  const countBox = $('bscTableCount');
  let list = [...parsed.months];

  // Tìm kiếm theo tên tháng
  if (BAOCAOSC_SEARCH) {
    const q = BAOCAOSC_SEARCH.toLowerCase();
    list = list.filter(m => m.cleanLabel.toLowerCase().includes(q) || m.rawLabel.toLowerCase().includes(q));
  }

  if (countBox) {
    countBox.textContent = `Hiển thị ${list.length} / ${parsed.months.length} tháng`;
  }

  // Sắp xếp
  const { k, dir } = BAOCAOSC_SORT;
  list.sort((a, b) => {
    if (k === 'mNum' || k === 'mIdx') {
      return dir * (a.mNum - b.mNum);
    }
    if (k === 'retail') {
      return dir * ((a.retail || 0) - (b.retail || 0));
    }
    if (k === 'fnb') {
      return dir * ((a.fnb || 0) - (b.fnb || 0));
    }
    if (k === 'booking') {
      return dir * ((a.booking || 0) - (b.booking || 0));
    }
    return 0;
  });

  // 1. THEAD
  let thead = '<thead><tr>';
  const sortArrow = key => (BAOCAOSC_SORT.k === key ? (BAOCAOSC_SORT.dir === 1 ? ' ▲' : ' ▼') : ' ⇅');

  thead += `<th onclick="sortActiveRate('mNum')" style="width:60px;cursor:pointer;text-align:center">STT${sortArrow('mNum')}</th>`;
  thead += `<th onclick="sortActiveRate('mNum')" style="min-width:140px;cursor:pointer;text-align:center">Thời Gian (Tháng)${sortArrow('mNum')}</th>`;
  thead += `<th onclick="sortActiveRate('retail')" style="min-width:160px;cursor:pointer;text-align:center">Retail (Active Rate)${sortArrow('retail')}</th>`;
  thead += `<th onclick="sortActiveRate('fnb')" style="min-width:160px;cursor:pointer;text-align:center">F&B (Active Rate)${sortArrow('fnb')}</th>`;
  thead += `<th onclick="sortActiveRate('booking')" style="min-width:160px;cursor:pointer;text-align:center">Booking (Active Rate)${sortArrow('booking')}</th>`;
  thead += `<th style="text-align:center;min-width:160px">Đánh Giá Xu Hướng</th>`;
  thead += '</tr></thead>';

  // 2. TBODY
  let tbody = '<tbody>';
  if (!list.length) {
    tbody += `<tr><td colspan="6" style="padding:24px;text-align:center;color:var(--mut)">Không có dữ liệu phù hợp với tìm kiếm</td></tr>`;
  } else {
    list.forEach(m => {
      let trendBadge = '';
      const hasAnyData = m.retail != null || m.fnb != null || m.booking != null;

      if (!hasAnyData) {
        trendBadge = '<span style="color:var(--mut);font-size:11px">Chưa có số liệu</span>';
      } else if (m.isBase) {
        trendBadge = '<span style="display:inline-block;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700;background:rgba(59,130,246,0.14);color:#60a5fa">Khởi điểm 2026</span>';
      } else {
        const upCount = [m.diffRetail, m.diffFnb, m.diffBooking].filter(d => d != null && d > 0.0001).length;
        const downCount = [m.diffRetail, m.diffFnb, m.diffBooking].filter(d => d != null && d < -0.0001).length;

        if (upCount === 3) {
          trendBadge = '<span style="display:inline-block;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700;background:rgba(16,185,129,0.18);color:#10b981">🔥 3/3 ngành tăng</span>';
        } else if (downCount === 3) {
          trendBadge = '<span style="display:inline-block;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700;background:rgba(239,68,68,0.18);color:#ef4444">⚠️ Giảm toàn diện</span>';
        } else if (upCount > downCount) {
          trendBadge = `<span style="display:inline-block;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700;background:rgba(16,185,129,0.12);color:#34d399">▲ ${upCount} ngành tăng</span>`;
        } else if (downCount > upCount) {
          trendBadge = `<span style="display:inline-block;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700;background:rgba(239,68,68,0.12);color:#f87171">▼ ${downCount} ngành giảm</span>`;
        } else {
          trendBadge = '<span style="display:inline-block;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700;background:rgba(148,163,184,0.12);color:var(--mut)">— Cân bằng</span>';
        }
      }

      tbody += '<tr>';
      tbody += `<td style="color:var(--mut);text-align:center">${m.mNum}</td>`;
      tbody += `<td class="sc-name" style="text-align:center;font-weight:700">${esc(m.cleanLabel)}</td>`;
      tbody += `<td style="text-align:center">${renderActiveRateCell(m.retail, m.diffRetail, m.isBase)}</td>`;
      tbody += `<td style="text-align:center">${renderActiveRateCell(m.fnb, m.diffFnb, m.isBase)}</td>`;
      tbody += `<td style="text-align:center">${renderActiveRateCell(m.booking, m.diffBooking, m.isBase)}</td>`;
      tbody += `<td style="text-align:center">${trendBadge}</td>`;
      tbody += '</tr>';
    });
  }
  tbody += '</tbody>';

  // 3. TFOOT (Hàng TRUNG BÌNH CẢ NĂM)
  const filledMonthsCount = parsed.months.filter(m => m.retail != null || m.fnb != null || m.booking != null).length;
  let tfoot = '<tfoot><tr>';
  tfoot += '<td style="text-align:center">★</td>';
  tfoot += '<td class="sc-name" style="text-align:center;color:var(--acc)">TRUNG BÌNH CẢ NĂM</td>';
  tfoot += `<td style="text-align:center;color:#38bdf8;font-weight:800;font-size:13px">${parsed.statsRetail.avg.toFixed(2)}%</td>`;
  tfoot += `<td style="text-align:center;color:#10b981;font-weight:800;font-size:13px">${parsed.statsFnb.avg.toFixed(2)}%</td>`;
  tfoot += `<td style="text-align:center;color:#c084fc;font-weight:800;font-size:13px">${parsed.statsBooking.avg.toFixed(2)}%</td>`;
  tfoot += `<td style="text-align:center;color:var(--acc);font-weight:700">${filledMonthsCount} Tháng 2026</td>`;
  tfoot += '</tr></tfoot>';

  tbl.innerHTML = thead + tbody + tfoot;
}

/**
 * Sắp xếp bảng Mục 3
 */
function sortActiveRate(key) {
  if (BAOCAOSC_SORT.k === key) {
    BAOCAOSC_SORT.dir = -BAOCAOSC_SORT.dir;
  } else {
    BAOCAOSC_SORT.k = key;
    BAOCAOSC_SORT.dir = (key === 'mNum' || key === 'mIdx') ? 1 : -1;
  }
  if (BAOCAOSC_STATE.activeRate) {
    const parsed = normalizeActiveRateData(BAOCAOSC_STATE.activeRate);
    renderActiveRateTimelineTable(parsed);
  }
}

/**
 * Tìm kiếm theo tên tháng
 */
function onActiveRateSearch(val) {
  BAOCAOSC_SEARCH = String(val || '').trim();
  if (BAOCAOSC_STATE.activeRate) {
    const parsed = normalizeActiveRateData(BAOCAOSC_STATE.activeRate);
    renderActiveRateTimelineTable(parsed);
  }
}

/* ==========================================================================
   MỤC 4: TỶ LỆ CHĂM KHÁCH NEW T10 (KÝ MỚI · INACTIVE · SC CHĂM)
   ========================================================================== */

/**
 * Chuẩn hóa dữ liệu thô từ sheet 'baocaotuan' (range F2:I6)
 */
function normalizeCareRateData(rawData) {
  if (!Array.isArray(rawData) || rawData.length < 2) return null;

  const header = rawData[0] || [];
  let colName = 0;
  let colKyMoi = 1;
  let colInactive = 2;
  let colScCham = 3;

  for (let c = 0; c < header.length; c++) {
    const h = String(header[c] || '').trim().toLowerCase();
    if (h.includes('ngành') || h.includes('tháng')) colName = c;
    else if (h.includes('ký mới') || h.includes('ky moi')) colKyMoi = c;
    else if (h.includes('inactive')) colInactive = c;
    else if (h.includes('sc chăm') || h.includes('sc cham')) colScCham = c;
  }

  const items = [];
  let totalRow = null;

  for (let r = 1; r < rawData.length; r++) {
    const row = rawData[r];
    if (!row || !row.length) continue;
    const rawName = String(row[colName] || '').trim();
    if (!rawName) continue;

    // Chuẩn hóa tên ngành
    let name = rawName;
    if (name.toUpperCase().startsWith('FNB')) name = 'F&B';

    const kyMoi = parseInt(String(row[colKyMoi] || '0').replace(/\D/g, ''), 10) || 0;
    const inactive = parseActiveRateVal(row[colInactive]);
    const scCham = parseActiveRateVal(row[colScCham]);

    const isTotal = name.toLowerCase().includes('tổng');
    const item = {
      name,
      kyMoi,
      inactive,
      scCham,
      share: 0,
      activeRate: inactive != null ? Math.max(0, 100 - inactive) : null,
      isTotal
    };

    if (isTotal) {
      totalRow = item;
    } else {
      items.push(item);
    }
  }

  const totKyMoi = totalRow && totalRow.kyMoi > 0 ? totalRow.kyMoi : items.reduce((s, it) => s + it.kyMoi, 0);

  items.forEach(it => {
    it.share = totKyMoi > 0 ? (it.kyMoi / totKyMoi) * 100 : 0;
  });

  if (totalRow) {
    totalRow.share = 100;
  }

  return {
    items,
    totalRow,
    totKyMoi,
    avgInactive: totalRow ? (totalRow.inactive || 0) : 0,
    avgScCham: totalRow ? (totalRow.scCham || 0) : 0
  };
}

/**
 * Hiển thị 3 thẻ KPI tóm tắt cho Mục 4
 */
function renderBaoCaoScCareSummaryCards(parsedCare) {
  const box = $('bscCareSummaryCards');
  if (!box || !parsedCare) return;

  const K = (label, val, sub, color = '') => `
    <div class="card kpi">
      <div class="l">${label}</div>
      <div class="v" style="${color}">${val}</div>
      <div class="s">${sub}</div>
    </div>`;

  const itemsSummary = parsedCare.items.map(it => `${esc(it.name)}: ${n0(it.kyMoi)}`).join(' · ');

  box.innerHTML =
    K('Tổng Ký Mới (Tháng 10)', `${n0(parsedCare.totKyMoi)} gian hàng`, itemsSummary, 'color:#38bdf8') +
    K('Tỷ Lệ Inactive Chung', `${parsedCare.avgInactive.toFixed(2)}%`, `Khách hàng ký mới chưa active (T10)`, 'color:#f59e0b') +
    K('Tỷ Lệ SC Chăm Chung', `${parsedCare.avgScCham.toFixed(2)}%`, `Gian hàng mới đã được SC hỗ trợ chăm sóc`, 'color:#c084fc');
}

/**
 * Hiển thị bảng chi tiết Mục 4
 */
function renderBaoCaoScCareTable(parsedCare) {
  const tbl = $('bscCareTable');
  if (!tbl || !parsedCare) return;

  let list = [...parsedCare.items];

  // Sắp xếp
  const { k, dir } = BAOCAOSC_CARE_SORT;
  list.sort((a, b) => {
    if (k === 'name') return dir * a.name.localeCompare(b.name, 'vi');
    if (k === 'kyMoi') return dir * (a.kyMoi - b.kyMoi);
    if (k === 'share') return dir * (a.share - b.share);
    if (k === 'inactive') return dir * ((a.inactive || 0) - (b.inactive || 0));
    if (k === 'scCham') return dir * ((a.scCham || 0) - (b.scCham || 0));
    return 0;
  });

  let thead = '<thead><tr>';
  const sortArrow = key => (BAOCAOSC_CARE_SORT.k === key ? (BAOCAOSC_CARE_SORT.dir === 1 ? ' ▲' : ' ▼') : ' ⇅');

  thead += `<th onclick="sortCareRate('name')" style="min-width:140px;cursor:pointer;text-align:center">Ngành Hàng${sortArrow('name')}</th>`;
  thead += `<th onclick="sortCareRate('kyMoi')" style="min-width:140px;cursor:pointer;text-align:center">Ký Mới (Gian Hàng)${sortArrow('kyMoi')}</th>`;
  thead += `<th onclick="sortCareRate('share')" style="min-width:120px;cursor:pointer;text-align:center">Tỷ Trọng Ký Mới${sortArrow('share')}</th>`;
  thead += `<th onclick="sortCareRate('inactive')" style="min-width:140px;cursor:pointer;text-align:center">Tỷ Lệ Inactive${sortArrow('inactive')}</th>`;
  thead += `<th onclick="sortCareRate('scCham')" style="min-width:140px;cursor:pointer;text-align:center">Tỷ Lệ SC Chăm${sortArrow('scCham')}</th>`;
  thead += '</tr></thead>';

  let tbody = '<tbody>';
  list.forEach(it => {
    const badgeInactive = it.inactive != null ? `<span class="ar-badge" style="background:rgba(245,158,11,0.16);color:#f59e0b">${it.inactive.toFixed(2)}%</span>` : '–';
    const badgeScCham = it.scCham != null ? `<span class="ar-badge" style="background:rgba(192,132,252,0.16);color:#c084fc">${it.scCham.toFixed(2)}%</span>` : '–';

    tbody += '<tr>';
    tbody += `<td class="sc-name" style="text-align:center;font-weight:700">${esc(it.name)}</td>`;
    tbody += `<td style="text-align:center;font-weight:700;color:#38bdf8">${n0(it.kyMoi)}</td>`;
    tbody += `<td style="text-align:center;font-weight:600">${it.share.toFixed(2)}%</td>`;
    tbody += `<td style="text-align:center">${badgeInactive}</td>`;
    tbody += `<td style="text-align:center">${badgeScCham}</td>`;
    tbody += '</tr>';
  });
  tbody += '</tbody>';

  let tfoot = '';
  if (parsedCare.totalRow) {
    const tot = parsedCare.totalRow;
    tfoot += '<tfoot><tr>';
    tfoot += '<td class="sc-name" style="text-align:center;color:var(--acc)">TỔNG TOÀN BỘ</td>';
    tfoot += `<td style="text-align:center;color:#38bdf8;font-weight:800;font-size:14px">${n0(tot.kyMoi)}</td>`;
    tfoot += `<td style="text-align:center;color:var(--acc);font-weight:800">100%</td>`;
    tfoot += `<td style="text-align:center;color:#f59e0b;font-weight:800">${tot.inactive ? tot.inactive.toFixed(2) + '%' : '–'}</td>`;
    tfoot += `<td style="text-align:center;color:#c084fc;font-weight:800">${tot.scCham ? tot.scCham.toFixed(2) + '%' : '–'}</td>`;
    tfoot += '</tr></tfoot>';
  }

  tbl.innerHTML = thead + tbody + tfoot;
}

/**
 * Sắp xếp bảng Mục 4
 */
function sortCareRate(key) {
  if (BAOCAOSC_CARE_SORT.k === key) {
    BAOCAOSC_CARE_SORT.dir = -BAOCAOSC_CARE_SORT.dir;
  } else {
    BAOCAOSC_CARE_SORT.k = key;
    BAOCAOSC_CARE_SORT.dir = key === 'name' ? 1 : -1;
  }
  if (BAOCAOSC_STATE.careRate) {
    const parsed = normalizeCareRateData(BAOCAOSC_STATE.careRate);
    renderBaoCaoScCareTable(parsed);
  }
}

/* ==========================================================================
   ĐIỀU PHỐI CHUNG & TẢI DỮ LIỆU TAB BÁO CÁO SC
   ========================================================================== */

/**
 * Điều phối render toàn bộ Tab BÁO CÁO SC (Mục 1 đến Mục 9)
 */
function renderBaoCaoSc() {
  if (BAOCAOSC_STATE.muctieuOffline || BAOCAOSC_STATE.muctieuOnline || (typeof MUCTIEU_STATE !== 'undefined' && (MUCTIEU_STATE.offline || MUCTIEU_STATE.online))) {
    renderBaoCaoScMuctieu();
  }

  if (BAOCAOSC_STATE.monthlyInactive) {
    const parsedInactive = normalizeMonthlyInactiveData(BAOCAOSC_STATE.monthlyInactive);
    if (parsedInactive) {
      renderMonthlyInactiveSummaryCards(parsedInactive);
      renderMonthlyInactiveTable(parsedInactive);
    }
  }

  if (BAOCAOSC_STATE.activeRate) {
    const parsedActive = normalizeActiveRateData(BAOCAOSC_STATE.activeRate);
    if (parsedActive) {
      renderBaoCaoScSummaryCards(parsedActive);
      renderActiveRateTimelineTable(parsedActive);
    }
  }

  if (BAOCAOSC_STATE.careRate) {
    const parsedCare = normalizeCareRateData(BAOCAOSC_STATE.careRate);
    if (parsedCare) {
      renderBaoCaoScCareSummaryCards(parsedCare);
      renderBaoCaoScCareTable(parsedCare);
    }
  }

  if (BAOCAOSC_STATE.fnbIssue) {
    const parsedFnb = normalizeFnbIssueData(BAOCAOSC_STATE.fnbIssue);
    if (parsedFnb) {
      renderBaoCaoScFnbIssueSummaryCards(parsedFnb);
      renderFnbIssueTable(parsedFnb);
    }
  }

  if (BAOCAOSC_STATE.provinceImpact) {
    const parsedProvince = normalizeProvinceImpactData(BAOCAOSC_STATE.provinceImpact);
    if (parsedProvince) {
      renderBaoCaoScProvinceSummaryCards(parsedProvince);
      renderProvinceImpactTable(parsedProvince);
    }
  }

  if (BAOCAOSC_STATE.impactDataSource || BAOCAOSC_STATE.impactIndustry) {
    const parsedSource = BAOCAOSC_STATE.impactDataSource ? normalizeImpactTableData(BAOCAOSC_STATE.impactDataSource) : null;
    const parsedIndustry = BAOCAOSC_STATE.impactIndustry ? normalizeImpactTableData(BAOCAOSC_STATE.impactIndustry) : null;
    renderBaoCaoScImpactSummaryCards(parsedSource, parsedIndustry);
    if (parsedSource) renderImpactSourceTable(parsedSource);
    if (parsedIndustry) renderImpactIndustryTable(parsedIndustry);
  }

  if (BAOCAOSC_STATE.headcountRegion || BAOCAOSC_STATE.headcountProvince) {
    const parsedRegion = BAOCAOSC_STATE.headcountRegion ? normalizeHeadcountRegionData(BAOCAOSC_STATE.headcountRegion) : null;
    const parsedProvince = BAOCAOSC_STATE.headcountProvince ? normalizeHeadcountProvinceData(BAOCAOSC_STATE.headcountProvince) : null;
    renderBaoCaoScHeadcountSummaryCards(parsedRegion, parsedProvince);
    if (parsedRegion) renderHeadcountRegionTable(parsedRegion);
    if (parsedProvince) renderHeadcountProvinceTable(parsedProvince);
  }

  if (BAOCAOSC_STATE.kpiOnlineT9 || BAOCAOSC_STATE.kpiOfflineT10 || BAOCAOSC_STATE.addonT10) {
    const parsedOnline = BAOCAOSC_STATE.kpiOnlineT9 ? normalizeKpiOnlineT9Data(BAOCAOSC_STATE.kpiOnlineT9) : null;
    const parsedOffline = BAOCAOSC_STATE.kpiOfflineT10 ? normalizeKpiOfflineT10Data(BAOCAOSC_STATE.kpiOfflineT10) : null;
    const parsedAddon = BAOCAOSC_STATE.addonT10 ? normalizeAddonT10Data(BAOCAOSC_STATE.addonT10) : null;
    renderBaoCaoScKpiAddonSummaryCards(parsedOnline, parsedOffline, parsedAddon);
    if (parsedOnline) renderKpiOnlineT9Table(parsedOnline);
    if (parsedOffline) renderKpiOfflineT10Table(parsedOffline);
    if (parsedAddon) renderAddonT10Table(parsedAddon);
  }
}

/**
 * Tải dữ liệu BÁO CÁO SC từ IndexedDB hoặc API trực tiếp (Mục 1 đến Mục 9 song song)
 */
async function loadBaoCaoSc(forceReload = false, isSilent = false) {
  const btn = $('btnReloadBaoCaoSc');
  const badge = $('baocaoscSrcBadge');

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
        const req = tx.objectStore(STORE_NAME).get(CACHE_KEY_BAOCAOSC);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });

      if (cached && cached.muctieuOffline && cached.muctieuOnline && cached.monthlyInactive && cached.activeRate && Array.isArray(cached.activeRate) && cached.activeRate.length >= 2 && cached.fnbIssue && cached.provinceImpact && cached.headcountRegion && cached.headcountProvince && cached.impactDataSource && cached.impactIndustry && cached.kpiOnlineT9 && cached.kpiOfflineT10 && cached.addonT10) {
        const ageMs = Date.now() - (cached.savedAt || 0);
        const minsAgo = Math.max(0, Math.floor(ageMs / 60000));
        const timeLabel = minsAgo === 0 ? 'vừa xong' : `${minsAgo} phút trước`;

        if (ageMs < CACHE_TTL_MS) {
          BAOCAOSC_STATE = cached;
          if (typeof MUCTIEU_STATE !== 'undefined') {
            MUCTIEU_STATE = {
              offline: cached.muctieuOffline,
              online: cached.muctieuOnline,
              savedAt: cached.savedAt,
              timeStr: cached.timeStr
            };
          }
          renderBaoCaoSc();
          if (badge) {
            badge.className = 'badge b-cache';
            badge.textContent = `Bộ nhớ đệm (${timeLabel})`;
          }
          if (btn) {
            btn.disabled = false;
            btn.textContent = '⟳ Tải lại Báo Cáo SC';
          }
          if (!isSilent) {
            showToast(`⚡ Đã tải tức thì Báo Cáo SC từ bộ nhớ đệm (${timeLabel}).`, true);
          }
          return;
        } else {
          BAOCAOSC_STATE = cached;
          if (typeof MUCTIEU_STATE !== 'undefined') {
            MUCTIEU_STATE = {
              offline: cached.muctieuOffline,
              online: cached.muctieuOnline,
              savedAt: cached.savedAt,
              timeStr: cached.timeStr
            };
          }
          renderBaoCaoSc();
          if (badge) {
            badge.className = 'badge b-load';
            badge.textContent = `Bộ nhớ đệm cũ (${timeLabel}) · Đang cập nhật…`;
          }
        }
      }
    } catch (e) {
      console.warn('Lỗi kiểm tra cache baocaosc:', e);
    }
  }

  // 2. Tải API trực tiếp song song (Mục 1 đến Mục 9)
  const urlMuctieuOffline = API_MUCTIEU_OFFLINE + (API_MUCTIEU_OFFLINE.includes('?') ? '&' : '?') + '_t=' + Date.now();
  const urlMuctieuOnline = API_MUCTIEU_ONLINE + (API_MUCTIEU_ONLINE.includes('?') ? '&' : '?') + '_t=' + (Date.now() + 1);
  const urlMonthlyInactive = API_BAOCAOSC_MONTHLY_INACTIVE + (API_BAOCAOSC_MONTHLY_INACTIVE.includes('?') ? '&' : '?') + '_t=' + Date.now();
  const urlActive = API_BAOCAOSC_ACTIVE_RATE + (API_BAOCAOSC_ACTIVE_RATE.includes('?') ? '&' : '?') + '_t=' + Date.now();
  const urlCare = API_BAOCAOSC_CARE_RATE + (API_BAOCAOSC_CARE_RATE.includes('?') ? '&' : '?') + '_t=' + Date.now();
  const urlFnbIssue = API_BAOCAOSC_FNB_ISSUE + (API_BAOCAOSC_FNB_ISSUE.includes('?') ? '&' : '?') + '_t=' + Date.now();
  const urlProvince = API_BAOCAOSC_PROVINCE_IMPACT + (API_BAOCAOSC_PROVINCE_IMPACT.includes('?') ? '&' : '?') + '_t=' + Date.now();
  const urlImpactDataSource = API_BAOCAOSC_IMPACT_DATA_SOURCE + (API_BAOCAOSC_IMPACT_DATA_SOURCE.includes('?') ? '&' : '?') + '_t=' + Date.now();
  const urlImpactIndustry = API_BAOCAOSC_IMPACT_INDUSTRY + (API_BAOCAOSC_IMPACT_INDUSTRY.includes('?') ? '&' : '?') + '_t=' + Date.now();
  const urlHeadcountRegion = API_BAOCAOSC_HEADCOUNT_REGION + (API_BAOCAOSC_HEADCOUNT_REGION.includes('?') ? '&' : '?') + '_t=' + Date.now();
  const urlHeadcountProvince = API_BAOCAOSC_HEADCOUNT_PROVINCE + (API_BAOCAOSC_HEADCOUNT_PROVINCE.includes('?') ? '&' : '?') + '_t=' + Date.now();
  const urlKpiOnlineT9 = API_BAOCAOSC_KPI_ONLINE_T9 + (API_BAOCAOSC_KPI_ONLINE_T9.includes('?') ? '&' : '?') + '_t=' + Date.now();
  const urlKpiOfflineT10 = API_BAOCAOSC_KPI_OFFLINE_T10 + (API_BAOCAOSC_KPI_OFFLINE_T10.includes('?') ? '&' : '?') + '_t=' + Date.now();
  const urlAddonT10 = API_BAOCAOSC_ADDON_T10 + (API_BAOCAOSC_ADDON_T10.includes('?') ? '&' : '?') + '_t=' + Date.now();

  try {
    const [
      resMuctieuOffline,
      resMuctieuOnline,
      resMonthlyInactive,
      resActive,
      resCare,
      resFnbIssue,
      resProvince,
      resImpactDataSource,
      resImpactIndustry,
      resHeadcountRegion,
      resHeadcountProvince,
      resKpiOnlineT9,
      resKpiOfflineT10,
      resAddonT10
    ] = await Promise.all([
      safeFetchJson(urlMuctieuOffline, 2),
      safeFetchJson(urlMuctieuOnline, 2),
      safeFetchJson(urlMonthlyInactive, 2),
      safeFetchJson(urlActive, 2),
      safeFetchJson(urlCare, 2),
      safeFetchJson(urlFnbIssue, 2),
      safeFetchJson(urlProvince, 2),
      safeFetchJson(urlImpactDataSource, 2),
      safeFetchJson(urlImpactIndustry, 2),
      safeFetchJson(urlHeadcountRegion, 2),
      safeFetchJson(urlHeadcountProvince, 2),
      safeFetchJson(urlKpiOnlineT9, 2),
      safeFetchJson(urlKpiOfflineT10, 2),
      safeFetchJson(urlAddonT10, 2)
    ]);

    if (resActive.status !== 'success' || !Array.isArray(resActive.data) || resActive.data.length < 2) {
      throw new Error(resActive.status || 'Dữ liệu Báo Cáo SC không đầy đủ');
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    BAOCAOSC_STATE = {
      muctieuOffline: resMuctieuOffline && resMuctieuOffline.data ? resMuctieuOffline.data : null,
      muctieuOnline: resMuctieuOnline && resMuctieuOnline.data ? resMuctieuOnline.data : null,
      monthlyInactive: resMonthlyInactive && resMonthlyInactive.data ? resMonthlyInactive.data : null,
      activeRate: resActive.data,
      careRate: resCare && resCare.data ? resCare.data : null,
      fnbIssue: resFnbIssue && resFnbIssue.data ? resFnbIssue.data : null,
      provinceImpact: resProvince && resProvince.data ? resProvince.data : null,
      impactDataSource: resImpactDataSource && resImpactDataSource.data ? resImpactDataSource.data : null,
      impactIndustry: resImpactIndustry && resImpactIndustry.data ? resImpactIndustry.data : null,
      headcountRegion: resHeadcountRegion && resHeadcountRegion.data ? resHeadcountRegion.data : null,
      headcountProvince: resHeadcountProvince && resHeadcountProvince.data ? resHeadcountProvince.data : null,
      kpiOnlineT9: resKpiOnlineT9 && resKpiOnlineT9.data ? resKpiOnlineT9.data : null,
      kpiOfflineT10: resKpiOfflineT10 && resKpiOfflineT10.data ? resKpiOfflineT10.data : null,
      addonT10: resAddonT10 && resAddonT10.data ? resAddonT10.data : null,
      savedAt: Date.now(),
      timeStr: timeStr
    };

    if (typeof MUCTIEU_STATE !== 'undefined') {
      MUCTIEU_STATE = {
        offline: BAOCAOSC_STATE.muctieuOffline,
        online: BAOCAOSC_STATE.muctieuOnline,
        savedAt: BAOCAOSC_STATE.savedAt,
        timeStr: BAOCAOSC_STATE.timeStr
      };
    }

    // Lưu IndexedDB
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(BAOCAOSC_STATE, CACHE_KEY_BAOCAOSC);
    } catch (e) {}

    renderBaoCaoSc();
    if (badge) {
      badge.className = 'badge b-live';
      badge.textContent = `API trực tiếp ${timeStr}`;
    }
    if (!isSilent) {
      showToast(`Đã đồng bộ thành công Báo Cáo SC (Mục 1 đến Mục 9) lúc ${timeStr}!`, true);
    }
  } catch (err) {
    console.error('Lỗi khi tải Báo Cáo SC:', err);
    if (BAOCAOSC_STATE.activeRate) {
      if (badge) {
        badge.className = 'badge b-err';
        badge.textContent = 'API bận — giữ dữ liệu cũ';
      }
      if (!isSilent) showToast('Máy chủ Google đang bận — vẫn giữ nguyên dữ liệu Báo Cáo SC hiện tại.', false);
    } else {
      if (badge) {
        badge.className = 'badge b-err';
        badge.textContent = 'Lỗi kết nối API';
      }
      if (!isSilent) showToast('Lỗi khi tải Báo Cáo SC: ' + (err.message || 'Không kết nối được'), false);
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '⟳ Tải lại Báo Cáo SC';
    }
  }
}

/**
 * Xuất file CSV UTF-8 với BOM tương thích 100% Microsoft Excel - Mục 3
 */
function exportActiveRateCsv() {
  if (!BAOCAOSC_STATE.activeRate) {
    showToast('Chưa có dữ liệu Mục 3 để xuất CSV!', false);
    return;
  }
  const parsed = normalizeActiveRateData(BAOCAOSC_STATE.activeRate);
  if (!parsed) return;

  const lines = [];

  // Tiêu đề
  lines.push(['BÁO CÁO SC - MỤC 3: ACTIVE RATE NĂM 2026']);
  lines.push(['Xuất ngày: ' + new Date().toLocaleString('vi-VN')]);
  lines.push([]);

  // Bảng Chi Tiết Theo Tháng
  lines.push(['STT', 'Tháng', 'Retail (%)', 'Biến động Retail', 'F&B (%)', 'Biến động F&B', 'Booking (%)', 'Biến động Booking']);
  parsed.months.forEach(m => {
    const formatDiff = d => d == null ? 'Mốc đầu' : (d > 0 ? `+${d.toFixed(2)}%` : `${d.toFixed(2)}%`);
    lines.push([
      m.mNum,
      m.cleanLabel,
      m.retail != null ? m.retail.toFixed(2) + '%' : '–',
      formatDiff(m.diffRetail),
      m.fnb != null ? m.fnb.toFixed(2) + '%' : '–',
      formatDiff(m.diffFnb),
      m.booking != null ? m.booking.toFixed(2) + '%' : '–',
      formatDiff(m.diffBooking)
    ]);
  });

  // Footer Trung bình
  lines.push([
    '★',
    'TRUNG BÌNH CẢ NĂM',
    parsed.statsRetail.avg.toFixed(2) + '%',
    '',
    parsed.statsFnb.avg.toFixed(2) + '%',
    '',
    parsed.statsBooking.avg.toFixed(2) + '%',
    ''
  ]);

  const csvContent = '\ufeff' + lines.map(row => {
    return row.map(cell => {
      const s = String(cell == null ? '' : cell);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',');
  }).join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `BaoCaoSC_Muc_3_ActiveRate_2026_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Đã xuất file CSV Active Rate (Mục 3) thành công!', true);
}

/**
 * Xuất file CSV UTF-8 với BOM tương thích 100% Microsoft Excel - Mục 4
 */
function exportCareRateCsv() {
  if (!BAOCAOSC_STATE.careRate) {
    showToast('Chưa có dữ liệu Mục 4 để xuất CSV!', false);
    return;
  }
  const parsed = normalizeCareRateData(BAOCAOSC_STATE.careRate);
  if (!parsed) return;

  const lines = [];

  // Tiêu đề
  lines.push(['BÁO CÁO SC - MỤC 4: TỶ LỆ CHĂM KHÁCH NEW T10']);
  lines.push(['Xuất ngày: ' + new Date().toLocaleString('vi-VN')]);
  lines.push([]);

  lines.push(['Ngành Hàng', 'Ký Mới (Gian Hàng)', 'Tỷ Trọng Ký Mới (%)', 'Tỷ Lệ Inactive (%)', 'Tỷ Lệ SC Chăm (%)']);
  parsed.items.forEach(it => {
    lines.push([
      it.name,
      it.kyMoi,
      it.share.toFixed(2) + '%',
      it.inactive != null ? it.inactive.toFixed(2) + '%' : '–',
      it.scCham != null ? it.scCham.toFixed(2) + '%' : '–'
    ]);
  });

  if (parsed.totalRow) {
    const tot = parsed.totalRow;
    lines.push([
      'TỔNG TOÀN BỘ',
      tot.kyMoi,
      '100%',
      tot.inactive != null ? tot.inactive.toFixed(2) + '%' : '–',
      tot.scCham != null ? tot.scCham.toFixed(2) + '%' : '–'
    ]);
  }

  const csvContent = '\ufeff' + lines.map(row => {
    return row.map(cell => {
      const s = String(cell == null ? '' : cell);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',');
  }).join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `BaoCaoSC_Muc_4_ChamKhachNew_T10_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Đã xuất file CSV Chăm Khách New (Mục 4) thành công!', true);
}

/* ==========================================================================
   MỤC 5: TRIỂN KHAI TỆP FNB LỚN (SHEET 'baocaotuan', RANGE AR2:AS9)
   ========================================================================== */

/**
 * Chuẩn hóa dữ liệu thô từ sheet 'baocaotuan' (range AR2:AS9)
 */
function normalizeFnbIssueData(rawData) {
  if (!Array.isArray(rawData) || rawData.length < 2) return null;

  const items = [];
  let totalRow = null;

  for (let r = 1; r < rawData.length; r++) {
    const row = rawData[r];
    if (!row || !row.length) continue;
    const name = String(row[0] || '').trim();
    if (!name) continue;

    const count = parseBscNumber(row[1]);
    const isTotal = name.toLowerCase() === 'tổng cộng' || name.toLowerCase() === 'total' || name.toLowerCase().includes('tổng');

    const item = {
      name,
      count,
      pct: 0
    };

    if (isTotal) {
      totalRow = item;
    } else {
      item.id = items.length + 1;
      items.push(item);
    }
  }

  const calculatedTotal = items.reduce((s, it) => s + it.count, 0);
  const grandTotal = totalRow && totalRow.count > 0 ? totalRow.count : calculatedTotal;

  items.forEach(it => {
    it.pct = grandTotal > 0 ? (it.count / grandTotal) * 100 : 0;
  });

  if (totalRow) {
    totalRow.pct = 100;
  }

  // Phân tích các chỉ số
  const sortedByCount = [...items].sort((a, b) => b.count - a.count);
  const topIssue = sortedByCount[0] || null;

  // Nhóm lỗi kỹ thuật (App/POS, In ấn, Máy in, App Food)
  const techKeywords = ['app/pos', 'lỗi in', 'máy in', 'app food'];
  const techItems = items.filter(it => techKeywords.some(kw => it.name.toLowerCase().includes(kw)));
  const techCount = techItems.reduce((s, it) => s + it.count, 0);
  const techPct = grandTotal > 0 ? (techCount / grandTotal) * 100 : 0;

  // Nhóm không lỗi / không nhu cầu
  const nonIssueItem = items.find(it => it.name.toLowerCase().includes('không lỗi') || it.name.toLowerCase().includes('không nhu cầu'));
  const nonIssueCount = nonIssueItem ? nonIssueItem.count : 0;
  const nonIssuePct = grandTotal > 0 ? (nonIssueCount / grandTotal) * 100 : 0;

  return {
    items,
    totalRow: totalRow || { name: 'Tổng cộng', count: grandTotal, pct: 100 },
    grandTotal,
    topIssue,
    techCount,
    techPct,
    nonIssueCount,
    nonIssuePct
  };
}

/**
 * Hiển thị 4 thẻ KPI tóm tắt cho Mục 5: Triển Khai Tệp FNB Lớn
 */
function renderBaoCaoScFnbIssueSummaryCards(parsed) {
  const box = $('bscFnbIssueSummaryCards');
  if (!box || !parsed) return;

  const K = (label, val, sub, color = '') => `
    <div class="card kpi">
      <div class="l">${label}</div>
      <div class="v" style="${color}">${val}</div>
      <div class="s">${sub}</div>
    </div>`;

  const top = parsed.topIssue;
  const topName = top ? esc(top.name) : '–';
  const topVal = top ? `${top.count} case` : '–';
  const topSub = top ? `Tỷ trọng cao nhất: <b style="color:var(--tx)">${top.pct.toFixed(2)}%</b>` : '–';

  box.innerHTML =
    K('Tổng Khách Hàng / Case F&B Lớn', `${n0(parsed.grandTotal)} case`, `Ghi nhận qua ${parsed.items.length} nhóm vấn đề`, 'color:#ea580c') +
    K('Phát Sinh Nhiều Nhất', topVal, `Nhóm: <b style="color:var(--tx)" title="${topName}">${topName.length > 28 ? topName.slice(0, 26) + '…' : topName}</b> (${top ? top.pct.toFixed(1) + '%' : ''})`, 'color:#3b82f6') +
    K('Sự Cố Kỹ Thuật / Vận Hành', `${n0(parsed.techCount)} case`, `Chiếm <b style="color:#ef4444">${parsed.techPct.toFixed(2)}%</b> (App/POS, Máy in, Báo Bếp, Food)`, 'color:#ef4444') +
    K('Không Lỗi / Chưa Có Nhu Cầu', `${n0(parsed.nonIssueCount)} case`, `Tỷ trọng: <b style="color:#10b981">${parsed.nonIssuePct.toFixed(2)}%</b> tổng tệp`, 'color:#10b981');
}

/**
 * Hiển thị bảng chi tiết Mục 5: Nhóm Vấn Đề / Lỗi Phát Sinh
 */
function renderFnbIssueTable(parsed) {
  const tbl = $('bscFnbIssueTable');
  if (!tbl || !parsed) return;

  const items = [...parsed.items];
  const { k, dir } = BAOCAOSC_FNB_ISSUE_SORT;

  items.sort((a, b) => {
    if (k === 'id') return dir * ((a.id || 0) - (b.id || 0));
    if (k === 'name') return dir * a.name.localeCompare(b.name, 'vi');
    if (k === 'count' || k === 'pct') return dir * (a.count - b.count);
    return 0;
  });

  const sortArrow = col => (BAOCAOSC_FNB_ISSUE_SORT.k === col ? (BAOCAOSC_FNB_ISSUE_SORT.dir === 1 ? ' ▲' : ' ▼') : ' ⇅');

  let thead = '<thead><tr>';
  thead += `<th onclick="sortFnbIssue('id')" style="width:55px;text-align:center;cursor:pointer">STT${sortArrow('id')}</th>`;
  thead += `<th onclick="sortFnbIssue('name')" style="text-align:left;cursor:pointer;min-width:240px">Nhóm Vấn Đề / Lỗi Phát Sinh${sortArrow('name')}</th>`;
  thead += `<th onclick="sortFnbIssue('count')" style="text-align:center;cursor:pointer;min-width:140px">Số Lượng (Case / GH)${sortArrow('count')}</th>`;
  thead += `<th onclick="sortFnbIssue('pct')" style="text-align:center;cursor:pointer;min-width:180px">Tỷ Trọng Đóng Góp${sortArrow('pct')}</th>`;
  thead += '</tr></thead>';

  let tbody = '<tbody>';
  items.forEach((item, idx) => {
    let barColor = '#38bdf8';
    if (item.pct >= 30) barColor = '#ea580c';
    else if (item.pct >= 15) barColor = '#f59e0b';
    else if (item.pct >= 5) barColor = '#3b82f6';
    else barColor = '#10b981';

    tbody += '<tr>';
    tbody += `<td style="text-align:center;color:var(--mut);font-weight:700">${idx + 1}</td>`;
    tbody += `<td style="text-align:left;font-weight:700;color:var(--tx-heading)">${esc(item.name)}</td>`;
    tbody += `<td style="text-align:center;font-weight:700;color:#ea580c;font-size:13.5px">${n0(item.count)}</td>`;
    tbody += `<td style="text-align:center">
      <div style="display:flex;align-items:center;justify-content:center;gap:8px">
        <div style="flex:1;max-width:110px;height:7px;border-radius:4px;background:rgba(148,163,184,0.18);overflow:hidden">
          <div style="width:${Math.min(100, item.pct)}%;height:100%;background:${barColor};border-radius:4px"></div>
        </div>
        <span style="font-weight:800;color:${barColor};min-width:55px;text-align:right">${item.pct.toFixed(2)}%</span>
      </div>
    </td>`;
    tbody += '</tr>';
  });
  tbody += '</tbody>';

  let tfoot = '';
  if (parsed.totalRow) {
    const tot = parsed.totalRow;
    tfoot += '<tfoot><tr>';
    tfoot += `<td style="text-align:center;color:var(--mut)">★</td>`;
    tfoot += `<td style="text-align:left;font-weight:800;color:var(--acc)">TỔNG CỘNG</td>`;
    tfoot += `<td style="text-align:center;font-weight:900;font-size:14px;color:#ea580c">${n0(tot.count)}</td>`;
    tfoot += `<td style="text-align:center;font-weight:800;color:var(--acc)">100.00%</td>`;
    tfoot += '</tr></tfoot>';
  }

  tbl.innerHTML = thead + tbody + tfoot;
}

function sortFnbIssue(col) {
  if (BAOCAOSC_FNB_ISSUE_SORT.k === col) {
    BAOCAOSC_FNB_ISSUE_SORT.dir *= -1;
  } else {
    BAOCAOSC_FNB_ISSUE_SORT = { k: col, dir: (col === 'name' || col === 'id') ? 1 : -1 };
  }
  if (BAOCAOSC_STATE.fnbIssue) {
    const parsed = normalizeFnbIssueData(BAOCAOSC_STATE.fnbIssue);
    renderFnbIssueTable(parsed);
  }
}

/**
 * Xuất file CSV UTF-8 với BOM - Mục 5: Triển Khai Tệp FNB Lớn
 */
function exportFnbIssueCsv() {
  if (!BAOCAOSC_STATE.fnbIssue) {
    showToast('Chưa có dữ liệu Mục 5 để xuất CSV!', false);
    return;
  }
  const parsed = normalizeFnbIssueData(BAOCAOSC_STATE.fnbIssue);
  if (!parsed) return;

  const lines = [];
  lines.push(['BÁO CÁO SC - MỤC 5: TRIỂN KHAI TỆP FNB LỚN (AR2:AS9)']);
  lines.push(['Xuất ngày: ' + new Date().toLocaleString('vi-VN')]);
  lines.push([]);
  lines.push(['STT', 'Nhóm Vấn Đề / Lỗi Phát Sinh', 'Số Lượng', 'Tỷ Trọng (%)']);

  parsed.items.forEach((it, idx) => {
    lines.push([idx + 1, it.name, it.count, it.pct.toFixed(2) + '%']);
  });

  if (parsed.totalRow) {
    const tot = parsed.totalRow;
    lines.push(['★', 'TỔNG CỘNG', tot.count, '100.00%']);
  }

  const csvContent = '\ufeff' + lines.map(row => {
    return row.map(cell => {
      const s = String(cell == null ? '' : cell);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',');
  }).join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `BaoCaoSC_Muc_5_TrienKhai_FnbLon_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Đã xuất file CSV Triển Khai Tệp FNB Lớn (Mục 5) thành công!', true);
}

/* ==========================================================================
   MỤC 6: IMPACT THEO TỈNH THÀNH PHỐ (SHEET 'baocaotuan', RANGE K2:Q19)
   ========================================================================== */

function parseProvinceImpactVal(val) {
  if (val == null || val === '' || val === '-') return null;
  if (typeof val === 'number') {
    if (isNaN(val)) return null;
    return (val >= -1 && val <= 1 && val !== 0) ? (val * 100) : (val === 0 ? 0 : val);
  }
  const s = String(val).replace(/%/g, '').trim();
  if (!s) return null;
  const n = parseFloat(s.replace(/,/g, '.'));
  if (isNaN(n)) return null;
  return (n >= -1 && n <= 1 && n !== 0) ? (n * 100) : (n === 0 ? 0 : n);
}

/**
 * Chuẩn hóa dữ liệu thô từ sheet 'baocaotuan' (range K2:Q19)
 */
function normalizeProvinceImpactData(rawData) {
  if (!Array.isArray(rawData) || rawData.length < 2) return null;

  const headerRow = rawData[0] || [];
  let colName = 0, colT7 = 1, colT8 = 2, colT9 = 3, colT10 = 4, colT11 = 5, colT12 = 6;

  headerRow.forEach((h, idx) => {
    const s = String(h || '').trim().toLowerCase();
    if (s.includes('tỉnh')) colName = idx;
    else if (s === 't7' || s.includes('tháng 7')) colT7 = idx;
    else if (s === 't8' || s.includes('tháng 8')) colT8 = idx;
    else if (s === 't9' || s.includes('tháng 9')) colT9 = idx;
    else if (s === 't10' || s.includes('tháng 10')) colT10 = idx;
    else if (s === 't11' || s.includes('tháng 11')) colT11 = idx;
    else if (s === 't12' || s.includes('tháng 12')) colT12 = idx;
  });

  const MONTH_DEFS = [
    { key: 't7', label: 'T7', name: 'Tháng 7' },
    { key: 't8', label: 'T8', name: 'Tháng 8' },
    { key: 't9', label: 'T9', name: 'Tháng 9' },
    { key: 't10', label: 'T10', name: 'Tháng 10' },
    { key: 't11', label: 'T11', name: 'Tháng 11' },
    { key: 't12', label: 'T12', name: 'Tháng 12' }
  ];

  const computeRowMonths = (item) => {
    let lastVal = null;
    let lastLabel = null;
    item.months = {};

    MONTH_DEFS.forEach(m => {
      const val = item[m.key];
      if (val != null) {
        if (lastVal != null) {
          item.months[m.key] = {
            val: val,
            diff: val - lastVal,
            prevVal: lastVal,
            prevLabel: lastLabel
          };
        } else {
          item.months[m.key] = {
            val: val,
            diff: null,
            prevVal: null,
            prevLabel: null
          };
        }
        lastVal = val;
        lastLabel = m.label;
      } else {
        item.months[m.key] = {
          val: null,
          diff: null,
          prevVal: null,
          prevLabel: null
        };
      }
    });
  };

  const provinces = [];
  let totalRow = null;

  for (let r = 1; r < rawData.length; r++) {
    const row = rawData[r];
    if (!row || !row.length) continue;

    const name = String(row[colName] || '').trim();
    if (!name) continue;

    const isTotal = name.toLowerCase() === 'total' || name.toLowerCase().includes('tổng');

    const item = {
      name: isTotal ? 'Total' : name,
      t7: parseProvinceImpactVal(row[colT7]),
      t8: parseProvinceImpactVal(row[colT8]),
      t9: parseProvinceImpactVal(row[colT9]),
      t10: parseProvinceImpactVal(row[colT10]),
      t11: parseProvinceImpactVal(row[colT11]),
      t12: parseProvinceImpactVal(row[colT12])
    };

    computeRowMonths(item);

    if (isTotal) {
      totalRow = item;
    } else {
      item.id = provinces.length + 1;
      provinces.push(item);
    }
  }

  // Thống kê tóm tắt KPI
  const validT10 = provinces.filter(p => p.t10 != null);
  let topT10 = null;
  if (validT10.length) {
    topT10 = validT10.reduce((max, p) => (p.t10 > max.t10 ? p : max), validT10[0]);
  }

  // So sánh T10 với tháng trước
  const validDiffT10 = provinces.filter(p => p.months && p.months.t10 && p.months.t10.diff != null);
  let topIncrease = null;
  let topDecrease = null;

  const positiveDiffs = validDiffT10.filter(p => p.months.t10.diff > 0);
  if (positiveDiffs.length) {
    topIncrease = positiveDiffs.reduce((max, p) => (p.months.t10.diff > max.months.t10.diff ? p : max), positiveDiffs[0]);
  }

  const negativeDiffs = validDiffT10.filter(p => p.months.t10.diff < 0);
  if (negativeDiffs.length) {
    topDecrease = negativeDiffs.reduce((min, p) => (p.months.t10.diff < min.months.t10.diff ? p : min), negativeDiffs[0]);
  }

  return {
    headers: headerRow,
    provinces,
    totalRow,
    topT10,
    topIncrease,
    topDecrease
  };
}

/**
 * Hiển thị các thẻ KPI tóm tắt Mục 6
 */
function renderBaoCaoScProvinceSummaryCards(parsed) {
  const box = $('bscProvinceSummaryCards');
  if (!box || !parsed) return;

  const K = (label, val, sub, color = '') => `
    <div class="card kpi">
      <div class="l">${label}</div>
      <div class="v" style="${color}">${val}</div>
      <div class="s">${sub}</div>
    </div>`;

  const tot = parsed.totalRow;
  const totVal = tot && tot.t10 != null ? tot.t10.toFixed(2) + '%' : '–';
  const totT10 = tot && tot.months && tot.months.t10;
  let totSub = 'Trung bình toàn quốc';
  if (totT10 && totT10.diff != null) {
    if (totT10.diff > 0.0001) {
      totSub = `<b style="color:#10b981">▲ +${totT10.diff.toFixed(2)}%</b> so với ${totT10.prevLabel}`;
    } else if (totT10.diff < -0.0001) {
      totSub = `<b style="color:#ef4444">▼ ${totT10.diff.toFixed(2)}%</b> so với ${totT10.prevLabel}`;
    } else {
      totSub = `<b style="color:var(--mut)">— 0.00%</b> so với ${totT10.prevLabel}`;
    }
  }

  const top10 = parsed.topT10;
  const top10Val = top10 && top10.t10 != null ? top10.t10.toFixed(2) + '%' : '–';
  const top10Sub = top10 ? `Tỉnh: <b style="color:var(--tx)">${esc(top10.name)}</b>` : '–';

  const topUp = parsed.topIncrease;
  const topUpM = topUp && topUp.months && topUp.months.t10;
  const topUpVal = topUpM && topUpM.diff != null ? `+${topUpM.diff.toFixed(2)}%` : '–';
  const topUpSub = topUp && topUpM ? `Tỉnh: <b style="color:var(--tx)">${esc(topUp.name)}</b> (T10: ${topUp.t10 != null ? topUp.t10.toFixed(2) + '%' : '–'} · ${topUpM.prevLabel}: ${topUpM.prevVal.toFixed(2)}%)` : '–';

  const topDown = parsed.topDecrease;
  const topDownM = topDown && topDown.months && topDown.months.t10;
  const topDownVal = topDownM && topDownM.diff != null ? `${topDownM.diff.toFixed(2)}%` : '–';
  const topDownSub = topDown && topDownM ? `Tỉnh: <b style="color:var(--tx)">${esc(topDown.name)}</b> (T10: ${topDown.t10 != null ? topDown.t10.toFixed(2) + '%' : '–'} · ${topDownM.prevLabel}: ${topDownM.prevVal.toFixed(2)}%)` : '–';

  box.innerHTML =
    K('Toàn Quốc (T10)', totVal, totSub, 'color:#38bdf8') +
    K('Top 1 Impact T10', top10Val, top10Sub, 'color:#10b981') +
    K('Tăng Trưởng Tốt Nhất', topUpVal, topUpSub, 'color:#34d399') +
    K('Giảm Sâu Nhất', topDownVal, topDownSub, 'color:#ef4444');
}

/**
 * Hiển thị 1 ô dữ liệu tháng có kèm icon so sánh với tháng trước
 */
function renderProvinceMonthCell(monthInfo) {
  if (!monthInfo || monthInfo.val == null) {
    return `<span style="color:var(--mut);opacity:0.6">—</span>`;
  }

  const { val, diff, prevVal, prevLabel } = monthInfo;
  let color = 'var(--tx)';
  if (val >= 70) color = '#10b981';
  else if (val < 50) color = '#f59e0b';

  let iconHtml = '';
  if (diff != null) {
    if (diff > 0.0001) {
      const tooltip = `Tăng +${diff.toFixed(2)}% so với ${prevLabel} (${prevVal.toFixed(2)}%)`;
      iconHtml = `<span title="${tooltip}" style="color:#10b981;font-size:11px;font-weight:800;margin-left:3px;cursor:help;display:inline-block">▲</span>`;
    } else if (diff < -0.0001) {
      const tooltip = `Giảm ${diff.toFixed(2)}% so với ${prevLabel} (${prevVal.toFixed(2)}%)`;
      iconHtml = `<span title="${tooltip}" style="color:#ef4444;font-size:11px;font-weight:800;margin-left:3px;cursor:help;display:inline-block">▼</span>`;
    } else {
      const tooltip = `Không đổi (0.00%) so với ${prevLabel} (${prevVal.toFixed(2)}%)`;
      iconHtml = `<span title="${tooltip}" style="color:var(--mut);font-size:11px;font-weight:800;margin-left:3px;cursor:help;display:inline-block">—</span>`;
    }
  }

  return `<span style="display:inline-flex;align-items:center;justify-content:center;gap:2px;white-space:nowrap"><span style="font-weight:700;color:${color}">${val.toFixed(2)}%</span>${iconHtml}</span>`;
}

/**
 * Hiển thị bảng chi tiết Mục 6: Impact Theo Tỉnh Thành (8 cột: STT + Tỉnh + T7..T12)
 */
function renderProvinceImpactTable(parsed) {
  const tbl = $('bscProvinceTable');
  if (!tbl || !parsed) return;

  const countBox = $('bscProvinceTableCount');
  let list = [...parsed.provinces];

  // Tìm kiếm theo tên tỉnh
  if (BAOCAOSC_PROVINCE_SEARCH) {
    const q = BAOCAOSC_PROVINCE_SEARCH.toLowerCase();
    list = list.filter(p => p.name.toLowerCase().includes(q));
  }

  if (countBox) {
    countBox.textContent = `Hiển thị ${list.length} / ${parsed.provinces.length} tỉnh/thành`;
  }

  // Sắp xếp
  const { k, dir } = BAOCAOSC_PROVINCE_SORT;
  list.sort((a, b) => {
    if (k === 'id') {
      return dir * ((a.id || 0) - (b.id || 0));
    }
    if (k === 'name') {
      return dir * a.name.localeCompare(b.name, 'vi');
    }
    if (k in a) {
      return dir * ((a[k] != null ? a[k] : -9999) - (b[k] != null ? b[k] : -9999));
    }
    return 0;
  });

  const sortArrow = key => (BAOCAOSC_PROVINCE_SORT.k === key ? (BAOCAOSC_PROVINCE_SORT.dir === 1 ? ' ▲' : ' ▼') : ' ⇅');

  // THEAD (8 CỘT)
  let thead = '<thead><tr>';
  thead += `<th onclick="sortProvinceImpact('id')" style="width:50px;text-align:center;cursor:pointer">STT${sortArrow('id')}</th>`;
  thead += `<th onclick="sortProvinceImpact('name')" style="min-width:140px;cursor:pointer;text-align:center">Tỉnh / Thành Phố${sortArrow('name')}</th>`;
  thead += `<th onclick="sortProvinceImpact('t7')" style="min-width:105px;cursor:pointer;text-align:center">Tháng 7${sortArrow('t7')}</th>`;
  thead += `<th onclick="sortProvinceImpact('t8')" style="min-width:105px;cursor:pointer;text-align:center">Tháng 8${sortArrow('t8')}</th>`;
  thead += `<th onclick="sortProvinceImpact('t9')" style="min-width:105px;cursor:pointer;text-align:center">Tháng 9${sortArrow('t9')}</th>`;
  thead += `<th onclick="sortProvinceImpact('t10')" style="min-width:105px;cursor:pointer;text-align:center">Tháng 10${sortArrow('t10')}</th>`;
  thead += `<th onclick="sortProvinceImpact('t11')" style="min-width:105px;cursor:pointer;text-align:center">Tháng 11${sortArrow('t11')}</th>`;
  thead += `<th onclick="sortProvinceImpact('t12')" style="min-width:105px;cursor:pointer;text-align:center">Tháng 12${sortArrow('t12')}</th>`;
  thead += '</tr></thead>';

  // TBODY
  let tbody = '<tbody>';
  if (!list.length) {
    tbody += `<tr><td colspan="8" style="padding:24px;text-align:center;color:var(--mut)">Không có dữ liệu phù hợp với tìm kiếm</td></tr>`;
  } else {
    list.forEach((p, idx) => {
      tbody += '<tr>';
      tbody += `<td style="color:var(--mut);text-align:center">${idx + 1}</td>`;
      tbody += `<td class="sc-name" style="text-align:center;font-weight:700">${esc(p.name)}</td>`;
      tbody += `<td style="text-align:center">${renderProvinceMonthCell(p.months.t7)}</td>`;
      tbody += `<td style="text-align:center">${renderProvinceMonthCell(p.months.t8)}</td>`;
      tbody += `<td style="text-align:center">${renderProvinceMonthCell(p.months.t9)}</td>`;
      tbody += `<td style="text-align:center">${renderProvinceMonthCell(p.months.t10)}</td>`;
      tbody += `<td style="text-align:center">${renderProvinceMonthCell(p.months.t11)}</td>`;
      tbody += `<td style="text-align:center">${renderProvinceMonthCell(p.months.t12)}</td>`;
      tbody += '</tr>';
    });
  }
  tbody += '</tbody>';

  // TFOOT (Total Row - 8 Cột)
  let tfoot = '';
  if (parsed.totalRow) {
    const tot = parsed.totalRow;
    tfoot += '<tfoot><tr>';
    tfoot += '<td style="text-align:center">★</td>';
    tfoot += '<td class="sc-name" style="text-align:center;color:var(--acc);font-weight:800">TOÀN QUỐC (TOTAL)</td>';
    tfoot += `<td style="text-align:center">${renderProvinceMonthCell(tot.months.t7)}</td>`;
    tfoot += `<td style="text-align:center">${renderProvinceMonthCell(tot.months.t8)}</td>`;
    tfoot += `<td style="text-align:center">${renderProvinceMonthCell(tot.months.t9)}</td>`;
    tfoot += `<td style="text-align:center">${renderProvinceMonthCell(tot.months.t10)}</td>`;
    tfoot += `<td style="text-align:center">${renderProvinceMonthCell(tot.months.t11)}</td>`;
    tfoot += `<td style="text-align:center">${renderProvinceMonthCell(tot.months.t12)}</td>`;
    tfoot += '</tr></tfoot>';
  }

  tbl.innerHTML = thead + tbody + tfoot;
}

/**
 * Sắp xếp bảng Mục 6
 */
function sortProvinceImpact(key) {
  if (BAOCAOSC_PROVINCE_SORT.k === key) {
    BAOCAOSC_PROVINCE_SORT.dir = -BAOCAOSC_PROVINCE_SORT.dir;
  } else {
    BAOCAOSC_PROVINCE_SORT.k = key;
    BAOCAOSC_PROVINCE_SORT.dir = (key === 'name' || key === 'id') ? 1 : -1;
  }
  if (BAOCAOSC_STATE.provinceImpact) {
    const parsed = normalizeProvinceImpactData(BAOCAOSC_STATE.provinceImpact);
    renderProvinceImpactTable(parsed);
  }
}

/**
 * Tìm kiếm tỉnh thành ở Mục 6
 */
function onProvinceImpactSearch(val) {
  BAOCAOSC_PROVINCE_SEARCH = String(val || '').trim();
  if (BAOCAOSC_STATE.provinceImpact) {
    const parsed = normalizeProvinceImpactData(BAOCAOSC_STATE.provinceImpact);
    renderProvinceImpactTable(parsed);
  }
}

/**
 * Xuất file CSV UTF-8 với BOM tương thích 100% Microsoft Excel - Mục 6
 */
function exportProvinceImpactCsv() {
  if (!BAOCAOSC_STATE.provinceImpact) {
    showToast('Chưa có dữ liệu Mục 6 để xuất CSV!', false);
    return;
  }
  const parsed = normalizeProvinceImpactData(BAOCAOSC_STATE.provinceImpact);
  if (!parsed) return;

  const lines = [];
  lines.push(['BÁO CÁO SC - MỤC 6: IMPACT THEO TỈNH THÀNH PHỐ (T7 - T12)']);
  lines.push(['Xuất ngày: ' + new Date().toLocaleString('vi-VN')]);
  lines.push([]);

  lines.push(['STT', 'Tỉnh / Thành Phố', 'Tháng 7 (%)', 'Tháng 8 (%)', 'Tháng 9 (%)', 'Tháng 10 (%)', 'Tháng 11 (%)', 'Tháng 12 (%)']);

  const fmt = mInfo => {
    if (!mInfo || mInfo.val == null) return '–';
    let s = mInfo.val.toFixed(2) + '%';
    if (mInfo.diff != null) {
      if (mInfo.diff > 0.0001) s += ` (+${mInfo.diff.toFixed(2)}%)`;
      else if (mInfo.diff < -0.0001) s += ` (${mInfo.diff.toFixed(2)}%)`;
      else s += ' (0.00%)';
    }
    return s;
  };

  parsed.provinces.forEach((p, idx) => {
    lines.push([
      idx + 1,
      p.name,
      fmt(p.months.t7),
      fmt(p.months.t8),
      fmt(p.months.t9),
      fmt(p.months.t10),
      fmt(p.months.t11),
      fmt(p.months.t12)
    ]);
  });

  if (parsed.totalRow) {
    const tot = parsed.totalRow;
    lines.push([
      '★',
      'TOÀN QUỐC (TOTAL)',
      fmt(tot.months.t7),
      fmt(tot.months.t8),
      fmt(tot.months.t9),
      fmt(tot.months.t10),
      fmt(tot.months.t11),
      fmt(tot.months.t12)
    ]);
  }

  const csvContent = '\ufeff' + lines.map(row => {
    return row.map(cell => {
      const s = String(cell == null ? '' : cell);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',');
  }).join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `BaoCaoSC_Muc_6_Impact_TheoTinhThanh_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Đã xuất file CSV Impact Theo Tỉnh Thành (Mục 6) thành công!', true);
}

/* ==========================================================================
   MỤC 8: QUÂN SỐ ĐỘI NGŨ SC (SHEET 'baocaotuan', U2:AA5 & U7:V24)
   ========================================================================== */

/**
 * Chuẩn hóa dữ liệu thô Bảng 1: Quân số theo Miền & Vị trí (range U2:AA5)
 * Header: ['Miền', 'ONLINE', 'OFFLINE', 'SalePhần cứng', 'Quản lý', 'Tổng Miền', 'Thử việc']
 */
function normalizeHeadcountRegionData(rawData) {
  if (!Array.isArray(rawData) || rawData.length < 2) return null;

  const headerRow = rawData[0] || [];
  let colRegion = 0, colOnline = 1, colOffline = 2, colSalePC = 3, colManager = 4, colTotal = 5, colProbation = 6;

  headerRow.forEach((h, idx) => {
    const s = String(h || '').trim().toLowerCase();
    if (s.includes('tổng')) colTotal = idx;
    else if (s.includes('miền')) colRegion = idx;
    else if (s.includes('online')) colOnline = idx;
    else if (s.includes('offline')) colOffline = idx;
    else if (s.includes('sale') || s.includes('phần cứng')) colSalePC = idx;
    else if (s.includes('quản lý') || s.includes('ql')) colManager = idx;
    else if (s.includes('thử việc')) colProbation = idx;
  });

  const parseNum = val => {
    if (val == null || val === '' || val === '-') return 0;
    const n = parseInt(String(val).replace(/[^0-9-]/g, ''), 10);
    return isNaN(n) ? 0 : n;
  };

  const regions = [];
  let totalRow = null;

  for (let r = 1; r < rawData.length; r++) {
    const row = rawData[r];
    if (!row || !row.length) continue;

    const name = String(row[colRegion] || '').trim();
    if (!name) continue;

    const isTotal = name.toLowerCase().includes('toàn quốc') || name.toLowerCase().includes('tổng') || name.toLowerCase() === 'total';

    const item = {
      name: isTotal ? 'Toàn Quốc' : name,
      online: parseNum(row[colOnline]),
      offline: parseNum(row[colOffline]),
      salePC: parseNum(row[colSalePC]),
      manager: parseNum(row[colManager]),
      total: parseNum(row[colTotal]),
      probation: parseNum(row[colProbation])
    };

    if (isTotal) {
      totalRow = item;
    } else {
      item.id = regions.length + 1;
      regions.push(item);
    }
  }

  return {
    headers: headerRow,
    regions,
    totalRow
  };
}

/**
 * Chuẩn hóa dữ liệu thô Bảng 2: Quân số theo Tỉnh thành / Khu vực (range U7:V24)
 * Header: ['Khu vực', 'Số lượng']
 */
function normalizeHeadcountProvinceData(rawData) {
  if (!Array.isArray(rawData) || rawData.length < 2) return null;

  const headerRow = rawData[0] || [];
  let colName = 0, colCount = 1;

  headerRow.forEach((h, idx) => {
    const s = String(h || '').trim().toLowerCase();
    if (s.includes('khu vực') || s.includes('tỉnh')) colName = idx;
    else if (s.includes('số lượng') || s.includes('quân số') || s.includes('sl')) colCount = idx;
  });

  const parseNum = val => {
    if (val == null || val === '' || val === '-') return 0;
    const n = parseInt(String(val).replace(/[^0-9-]/g, ''), 10);
    return isNaN(n) ? 0 : n;
  };

  const provinces = [];
  let totalRow = null;

  for (let r = 1; r < rawData.length; r++) {
    const row = rawData[r];
    if (!row || !row.length) continue;

    const name = String(row[colName] || '').trim();
    if (!name) continue;

    const isTotal = name.toLowerCase() === 'tổng' || name.toLowerCase().includes('tổng cộng') || name.toLowerCase() === 'total';

    const item = {
      name: isTotal ? 'Tổng Cộng' : name,
      count: parseNum(row[colCount])
    };

    if (isTotal) {
      totalRow = item;
    } else {
      item.id = provinces.length + 1;
      provinces.push(item);
    }
  }

  // Tính tổng số lượng từ các tỉnh nếu chưa có totalRow
  const calculatedTotal = provinces.reduce((sum, p) => sum + p.count, 0);
  const totalCount = totalRow && totalRow.count > 0 ? totalRow.count : calculatedTotal;

  // Tính % tỷ trọng cho từng tỉnh
  provinces.forEach(p => {
    p.pct = totalCount > 0 ? (p.count / totalCount) * 100 : 0;
  });

  // Tỉnh có quân số đông nhất
  let maxProvince = null;
  if (provinces.length) {
    maxProvince = provinces.reduce((max, p) => (p.count > max.count ? p : max), provinces[0]);
  }

  return {
    headers: headerRow,
    provinces,
    totalRow: totalRow || { name: 'Tổng Cộng', count: calculatedTotal },
    totalCount,
    maxProvince
  };
}

/**
 * Hiển thị các thẻ KPI tóm tắt Mục 8
 */
function renderBaoCaoScHeadcountSummaryCards(parsedRegion, parsedProvince) {
  const box = $('bscHeadcountSummaryCards');
  if (!box) return;

  const K = (label, val, sub, color = '') => `
    <div class="card kpi">
      <div class="l">${label}</div>
      <div class="v" style="${color}">${val}</div>
      <div class="s">${sub}</div>
    </div>`;

  let totVal = '–', totSub = '–';
  let offVal = '–', offSub = '–';
  let onlVal = '–', onlSub = '–';
  let otherVal = '–', otherSub = '–';

  if (parsedRegion && parsedRegion.totalRow) {
    const tot = parsedRegion.totalRow;
    const mb = parsedRegion.regions.find(r => r.name.toLowerCase().includes('bắc'));
    const mn = parsedRegion.regions.find(r => r.name.toLowerCase().includes('nam'));

    totVal = `${tot.total} nhân sự`;
    totSub = `Miền Bắc: <b style="color:var(--tx)">${mb ? mb.total : '–'}</b> · Miền Nam: <b style="color:var(--tx)">${mn ? mn.total : '–'}</b>`;

    const offPct = tot.total > 0 ? ((tot.offline / tot.total) * 100).toFixed(1) + '%' : '–';
    offVal = `${tot.offline} nhân sự`;
    offSub = `Tỷ trọng: <b style="color:#10b981">${offPct}</b> (Bắc: ${mb ? mb.offline : '–'} · Nam: ${mn ? mn.offline : '–'})`;

    const onlPct = tot.total > 0 ? ((tot.online / tot.total) * 100).toFixed(1) + '%' : '–';
    onlVal = `${tot.online} nhân sự`;
    onlSub = `Tỷ trọng: <b style="color:#0ea5e9">${onlPct}</b> (Bắc: ${mb ? mb.online : '–'} · Nam: ${mn ? mn.online : '–'})`;

    otherVal = `${tot.probation} Thử Việc`;
    otherSub = `Quản lý: <b style="color:var(--tx)">${tot.manager}</b> · Sale Phần cứng: <b style="color:var(--tx)">${tot.salePC}</b>`;
  } else if (parsedProvince && parsedProvince.totalRow) {
    totVal = `${parsedProvince.totalCount} nhân sự`;
    totSub = `Phân bổ tại ${parsedProvince.provinces.length} khu vực / tỉnh thành`;
    if (parsedProvince.maxProvince) {
      offVal = `${parsedProvince.maxProvince.count} nhân sự`;
      offSub = `Khu vực đông nhất: <b style="color:var(--tx)">${esc(parsedProvince.maxProvince.name)}</b>`;
    }
  }

  box.innerHTML =
    K('Tổng Quân Số Toàn Quốc', totVal, totSub, 'color:#8b5cf6') +
    K('Lực Lượng OFFLINE', offVal, offSub, 'color:#10b981') +
    K('Lực Lượng ONLINE', onlVal, onlSub, 'color:#0ea5e9') +
    K('Hỗ TrỢ & Thử Việc', otherVal, otherSub, 'color:#f59e0b');
}

/**
 * Hiển thị Bảng 1: Quân số theo Miền & Vị trí (U2:AA5)
 */
function renderHeadcountRegionTable(parsedRegion) {
  const tbl = $('bscHeadcountRegionTable');
  if (!tbl || !parsedRegion) return;

  // THEAD
  let thead = '<thead><tr>';
  thead += `<th style="width:50px;text-align:center">STT</th>`;
  thead += `<th style="min-width:140px;text-align:center">Phân Vùng Miền</th>`;
  thead += `<th style="min-width:90px;text-align:center">ONLINE</th>`;
  thead += `<th style="min-width:90px;text-align:center">OFFLINE</th>`;
  thead += `<th style="min-width:115px;text-align:center">Sale Phần Cứng</th>`;
  thead += `<th style="min-width:95px;text-align:center">Quản Lý</th>`;
  thead += `<th style="min-width:110px;text-align:center">Tổng Miền</th>`;
  thead += `<th style="min-width:95px;text-align:center">Thử Việc</th>`;
  thead += '</tr></thead>';

  const fmtNum = v => `<span style="font-weight:700;color:var(--tx)">${v}</span>`;

  // TBODY
  let tbody = '<tbody>';
  parsedRegion.regions.forEach((r, idx) => {
    tbody += '<tr>';
    tbody += `<td style="color:var(--mut);text-align:center">${idx + 1}</td>`;
    tbody += `<td class="sc-name" style="text-align:center;font-weight:700">${esc(r.name)}</td>`;
    tbody += `<td style="text-align:center">${fmtNum(r.online)}</td>`;
    tbody += `<td style="text-align:center">${fmtNum(r.offline)}</td>`;
    tbody += `<td style="text-align:center">${fmtNum(r.salePC)}</td>`;
    tbody += `<td style="text-align:center">${fmtNum(r.manager)}</td>`;
    tbody += `<td style="text-align:center"><span style="font-weight:800;color:#38bdf8">${r.total}</span></td>`;
    tbody += `<td style="text-align:center"><span style="font-weight:700;color:#f59e0b">${r.probation}</span></td>`;
    tbody += '</tr>';
  });
  tbody += '</tbody>';

  // TFOOT (Toàn Quốc)
  let tfoot = '';
  if (parsedRegion.totalRow) {
    const tot = parsedRegion.totalRow;
    tfoot += '<tfoot><tr>';
    tfoot += '<td style="text-align:center">★</td>';
    tfoot += '<td class="sc-name" style="text-align:center;color:var(--acc);font-weight:800">TOÀN QUỐC (TOTAL)</td>';
    tfoot += `<td style="text-align:center"><span style="font-weight:800;color:#0ea5e9">${tot.online}</span></td>`;
    tfoot += `<td style="text-align:center"><span style="font-weight:800;color:#10b981">${tot.offline}</span></td>`;
    tfoot += `<td style="text-align:center">${fmtNum(tot.salePC)}</td>`;
    tfoot += `<td style="text-align:center">${fmtNum(tot.manager)}</td>`;
    tfoot += `<td style="text-align:center"><span style="font-weight:900;font-size:14px;color:#38bdf8">${tot.total}</span></td>`;
    tfoot += `<td style="text-align:center"><span style="font-weight:800;color:#f59e0b">${tot.probation}</span></td>`;
    tfoot += '</tr></tfoot>';
  }

  tbl.innerHTML = thead + tbody + tfoot;
}

/**
 * Hiển thị Bảng 2: Quân số theo Tỉnh Thành / Khu Vực (U7:V24)
 */
function renderHeadcountProvinceTable(parsedProvince) {
  const tbl = $('bscHeadcountProvinceTable');
  if (!tbl || !parsedProvince) return;

  const countBox = $('bscHeadcountProvinceCount');
  let list = [...parsedProvince.provinces];

  // Tìm kiếm theo tên khu vực
  if (BAOCAOSC_HEADCOUNT_PROVINCE_SEARCH) {
    const q = BAOCAOSC_HEADCOUNT_PROVINCE_SEARCH.toLowerCase();
    list = list.filter(p => p.name.toLowerCase().includes(q));
  }

  if (countBox) {
    countBox.textContent = `Hiển thị ${list.length} / ${parsedProvince.provinces.length} khu vực`;
  }

  // Sắp xếp
  const { k, dir } = BAOCAOSC_HEADCOUNT_PROVINCE_SORT;
  list.sort((a, b) => {
    if (k === 'id') return dir * ((a.id || 0) - (b.id || 0));
    if (k === 'name') return dir * a.name.localeCompare(b.name, 'vi');
    if (k === 'count' || k === 'pct') return dir * (a.count - b.count);
    return 0;
  });

  const sortArrow = key => (BAOCAOSC_HEADCOUNT_PROVINCE_SORT.k === key ? (BAOCAOSC_HEADCOUNT_PROVINCE_SORT.dir === 1 ? ' ▲' : ' ▼') : ' ⇅');

  // THEAD (3 CỘT: STT + Khu Vực + Quân Số & Tỷ Trọng)
  let thead = '<thead><tr>';
  thead += `<th onclick="sortHeadcountProvince('id')" style="width:50px;text-align:center;cursor:pointer">STT${sortArrow('id')}</th>`;
  thead += `<th onclick="sortHeadcountProvince('name')" style="min-width:160px;text-align:center;cursor:pointer">Khu Vực / Tỉnh Thành${sortArrow('name')}</th>`;
  thead += `<th onclick="sortHeadcountProvince('count')" style="min-width:140px;text-align:center;cursor:pointer">Quân Số (% Tỷ Trọng)${sortArrow('count')}</th>`;
  thead += '</tr></thead>';

  // TBODY
  let tbody = '<tbody>';
  if (!list.length) {
    tbody += `<tr><td colspan="3" style="padding:24px;text-align:center;color:var(--mut)">Không có khu vực phù hợp với tìm kiếm</td></tr>`;
  } else {
    list.forEach((p, idx) => {
      const pctVal = p.pct != null ? p.pct : 0;

      tbody += '<tr>';
      tbody += `<td style="color:var(--mut);text-align:center">${idx + 1}</td>`;
      tbody += `<td class="sc-name" style="text-align:center;font-weight:700">${esc(p.name)}</td>`;
      tbody += `<td style="text-align:center">
        <span style="font-weight:800;font-size:13px;color:${p.count > 0 ? 'var(--tx)' : 'var(--mut)'}">${p.count}</span>
        <span style="font-weight:600;font-size:12px;color:var(--mut);margin-left:4px">(${pctVal.toFixed(2)}%)</span>
      </td>`;
      tbody += '</tr>';
    });
  }
  tbody += '</tbody>';

  // TFOOT (Tổng)
  let tfoot = '';
  if (parsedProvince.totalRow) {
    tfoot += '<tfoot><tr>';
    tfoot += '<td style="text-align:center">★</td>';
    tfoot += '<td class="sc-name" style="text-align:center;color:var(--acc);font-weight:800">TỔNG CỘNG (16 TỈNH THÀNH)</td>';
    tfoot += `<td style="text-align:center">
      <span style="font-weight:900;font-size:14px;color:var(--acc)">${parsedProvince.totalCount}</span>
      <span style="font-weight:700;font-size:12px;color:var(--acc);margin-left:4px">(100.00%)</span>
    </td>`;
    tfoot += '</tr></tfoot>';
  }

  tbl.innerHTML = thead + tbody + tfoot;
}

/**
 * Sắp xếp bảng Bảng 2 Mục 8
 */
function sortHeadcountProvince(key) {
  if (BAOCAOSC_HEADCOUNT_PROVINCE_SORT.k === key) {
    BAOCAOSC_HEADCOUNT_PROVINCE_SORT.dir = -BAOCAOSC_HEADCOUNT_PROVINCE_SORT.dir;
  } else {
    BAOCAOSC_HEADCOUNT_PROVINCE_SORT.k = key;
    BAOCAOSC_HEADCOUNT_PROVINCE_SORT.dir = (key === 'name' || key === 'id') ? 1 : -1;
  }
  if (BAOCAOSC_STATE.headcountProvince) {
    const parsed = normalizeHeadcountProvinceData(BAOCAOSC_STATE.headcountProvince);
    renderHeadcountProvinceTable(parsed);
  }
}

/**
 * Tìm kiếm khu vực ở Bảng 2 Mục 8
 */
function onHeadcountProvinceSearch(val) {
  BAOCAOSC_HEADCOUNT_PROVINCE_SEARCH = String(val || '').trim();
  if (BAOCAOSC_STATE.headcountProvince) {
    const parsed = normalizeHeadcountProvinceData(BAOCAOSC_STATE.headcountProvince);
    renderHeadcountProvinceTable(parsed);
  }
}

/**
 * Xuất file CSV UTF-8 với BOM tương thích 100% Microsoft Excel - Mục 8
 */
function exportHeadcountCsv() {
  if (!BAOCAOSC_STATE.headcountRegion && !BAOCAOSC_STATE.headcountProvince) {
    showToast('Chưa có dữ liệu Mục 8 để xuất CSV!', false);
    return;
  }

  const lines = [];
  lines.push(['BÁO CÁO SC - MỤC 8: QUÂN SỐ ĐỘI NGŨ SC']);
  lines.push(['Xuất ngày: ' + new Date().toLocaleString('vi-VN')]);
  lines.push([]);

  // Phần 1: Theo Miền & Vị trí
  if (BAOCAOSC_STATE.headcountRegion) {
    const parsedRegion = normalizeHeadcountRegionData(BAOCAOSC_STATE.headcountRegion);
    if (parsedRegion) {
      lines.push(['--- BẢNG 1: PHÂN BỔ QUÂN SỐ THEO MIỀN & VỊ TRÍ ---']);
      lines.push(['STT', 'Phân Vùng Miền', 'ONLINE', 'OFFLINE', 'Sale Phần Cứng', 'Quản Lý', 'Tổng Miền', 'Thử Việc']);
      parsedRegion.regions.forEach((r, idx) => {
        lines.push([idx + 1, r.name, r.online, r.offline, r.salePC, r.manager, r.total, r.probation]);
      });
      if (parsedRegion.totalRow) {
        const tot = parsedRegion.totalRow;
        lines.push(['★', 'TOÀN QUỐC', tot.online, tot.offline, tot.salePC, tot.manager, tot.total, tot.probation]);
      }
      lines.push([]);
    }
  }

  // Phần 2: Theo Tỉnh thành / Khu vực
  if (BAOCAOSC_STATE.headcountProvince) {
    const parsedProvince = normalizeHeadcountProvinceData(BAOCAOSC_STATE.headcountProvince);
    if (parsedProvince) {
      lines.push(['--- BẢNG 2: PHÂN BỔ QUÂN SỐ THEO TỈNH THÀNH / KHU VỰC ---']);
      lines.push(['STT', 'Khu Vực / Tỉnh Thành', 'Quân Số (% Tỷ Trọng)']);
      parsedProvince.provinces.forEach((p, idx) => {
        lines.push([idx + 1, p.name, `${p.count} (${p.pct != null ? p.pct.toFixed(2) : '0.00'}%)`]);
      });
      if (parsedProvince.totalRow) {
        lines.push(['★', 'TỔNG CỘNG', `${parsedProvince.totalCount} (100.00%)`]);
      }
    }
  }

  const csvContent = '\ufeff' + lines.map(row => {
    return row.map(cell => {
      const s = String(cell == null ? '' : cell);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',');
  }).join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `BaoCaoSC_Muc_8_QuanSo_Headcount_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Đã xuất file CSV Quân Số Đội Ngũ SC (Mục 8) thành công!', true);
}

/**
 * Xuất file CSV Bảng 1 Mục 8: Phân bổ quân số theo Miền & Vị trí
 */
function exportHeadcountRegionCsv() {
  if (!BAOCAOSC_STATE.headcountRegion) {
    showToast('Chưa có dữ liệu Quân số theo Miền để xuất CSV!', false);
    return;
  }
  const parsedRegion = normalizeHeadcountRegionData(BAOCAOSC_STATE.headcountRegion);
  if (!parsedRegion) return;

  const lines = [];
  lines.push(['BÁO CÁO SC - MỤC 8.1: PHÂN BỔ QUÂN SỐ THEO MIỀN & VỊ TRÍ']);
  lines.push(['Xuất ngày: ' + new Date().toLocaleString('vi-VN')]);
  lines.push([]);
  lines.push(['STT', 'Phân Vùng Miền', 'ONLINE', 'OFFLINE', 'Sale Phần Cứng', 'Quản Lý', 'Tổng Miền', 'Thử Việc']);
  parsedRegion.regions.forEach((r, idx) => {
    lines.push([idx + 1, r.name, r.online, r.offline, r.salePC, r.manager, r.total, r.probation]);
  });
  if (parsedRegion.totalRow) {
    const tot = parsedRegion.totalRow;
    lines.push(['★', 'TOÀN QUỐC', tot.online, tot.offline, tot.salePC, tot.manager, tot.total, tot.probation]);
  }

  const csvContent = '\ufeff' + lines.map(row => {
    return row.map(cell => {
      const s = String(cell == null ? '' : cell);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',');
  }).join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `BaoCaoSC_Muc_8_1_QuanSo_TheoMien_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Đã xuất file CSV Quân số theo Miền (Mục 8.1) thành công!', true);
}

/**
 * Xuất file CSV Bảng 2 Mục 8: Phân bổ quân số theo Tỉnh thành / Khu vực
 */
function exportHeadcountProvinceCsv() {
  if (!BAOCAOSC_STATE.headcountProvince) {
    showToast('Chưa có dữ liệu Quân số theo Tỉnh thành để xuất CSV!', false);
    return;
  }
  const parsedProvince = normalizeHeadcountProvinceData(BAOCAOSC_STATE.headcountProvince);
  if (!parsedProvince) return;

  const lines = [];
  lines.push(['BÁO CÁO SC - MỤC 8.2: PHÂN BỔ QUÂN SỐ THEO TỈNH THÀNH / KHU VỰC']);
  lines.push(['Xuất ngày: ' + new Date().toLocaleString('vi-VN')]);
  lines.push([]);
  lines.push(['STT', 'Khu Vực / Tỉnh Thành', 'Quân Số', 'Tỷ Trọng (%)']);
  parsedProvince.provinces.forEach((p, idx) => {
    lines.push([idx + 1, p.name, p.count, (p.pct != null ? p.pct.toFixed(2) : '0.00') + '%']);
  });
  if (parsedProvince.totalRow) {
    lines.push(['★', 'TỔNG CỘNG', parsedProvince.totalCount, '100.00%']);
  }

  const csvContent = '\ufeff' + lines.map(row => {
    return row.map(cell => {
      const s = String(cell == null ? '' : cell);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',');
  }).join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `BaoCaoSC_Muc_8_2_QuanSo_TheoTinhThanh_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Đã xuất file CSV Quân số theo Tỉnh thành (Mục 8.2) thành công!', true);
}

/* ==========================================================================
   MỤC 7: TỶ LỆ IMPACT THEO NGUỒN DATA & NGÀNH HÀNG (AD2:AG9 & AD13:AG17)
   ========================================================================== */

/**
 * Chuyển đổi an toàn chuỗi/số sang số nguyên cho Báo Cáo SC
 */
function parseBscNumber(val) {
  if (val == null || val === '' || val === '-') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.round(val);
  const s = String(val).replace(/,/g, '').replace(/[^0-9.-]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.round(n);
}

/**
 * Chuyển đổi an toàn chuỗi/số sang phần trăm (0-100) cho Báo Cáo SC
 */
function parseBscPct(val) {
  if (val == null || val === '' || val === '-') return 0;
  if (typeof val === 'number') {
    if (isNaN(val)) return 0;
    // Nếu là dạng số thập phân <= 10 (ví dụ 0.6148 -> 61.48% hoặc 1.3403 -> 134.03%)
    return val <= 10 && val > 0 ? val * 100 : val;
  }
  const s = String(val).trim();
  const isPercentSign = s.includes('%');
  const n = parseFloat(s.replace(/%/g, '').replace(/,/g, ''));
  if (isNaN(n)) return 0;
  if (!isPercentSign && n > 0 && n <= 10) {
    return n * 100;
  }
  return n;
}

/**
 * Chuẩn hóa dữ liệu thô bảng Impact (dùng chung cho Nguồn Data AD2:AG9 & Ngành Hàng AD13:AG17)
 */
function normalizeImpactTableData(rawData) {
  if (!Array.isArray(rawData) || rawData.length < 2) return null;

  const items = [];
  let totalRow = null;

  for (let r = 1; r < rawData.length; r++) {
    const row = rawData[r];
    if (!row || !row.length) continue;
    const name = String(row[0] || '').trim();
    if (!name) continue;

    const act = parseBscNumber(row[1]);
    const impact = parseBscNumber(row[2]);
    let rate = parseBscPct(row[3]);
    if (rate === 0 && act > 0 && impact > 0) {
      rate = (impact / act) * 100;
    }

    const item = {
      name,
      act,
      impact,
      rate
    };

    if (name.toLowerCase() === 'tổng' || name.toLowerCase() === 'total') {
      totalRow = item;
    } else {
      items.push(item);
    }
  }

  const sortedByRate = [...items].sort((a, b) => b.rate - a.rate);
  const topItem = sortedByRate[0] || null;
  const lowestItem = sortedByRate[sortedByRate.length - 1] || null;

  const totAct = totalRow ? totalRow.act : items.reduce((s, it) => s + it.act, 0);
  const totImpact = totalRow ? totalRow.impact : items.reduce((s, it) => s + it.impact, 0);
  const avgRate = totalRow ? totalRow.rate : (totAct > 0 ? (totImpact / totAct) * 100 : 0);

  return {
    items,
    totalRow,
    topItem,
    lowestItem,
    totAct,
    totImpact,
    avgRate
  };
}

/**
 * Màu sắc trực quan cho tỷ lệ Impact
 */
function getImpactRateColor(rate) {
  if (rate >= 70) return '#10b981'; // Xanh lá
  if (rate >= 55) return '#38bdf8'; // Xanh dương
  return '#f59e0b'; // Vàng cam
}

let BAOCAOSC_IMPACT_SOURCE_SORT = { k: 'rate', dir: -1 };
let BAOCAOSC_IMPACT_INDUSTRY_SORT = { k: 'rate', dir: -1 };

function sortImpactSource(key) {
  if (BAOCAOSC_IMPACT_SOURCE_SORT.k === key) {
    BAOCAOSC_IMPACT_SOURCE_SORT.dir = -BAOCAOSC_IMPACT_SOURCE_SORT.dir;
  } else {
    BAOCAOSC_IMPACT_SOURCE_SORT.k = key;
    BAOCAOSC_IMPACT_SOURCE_SORT.dir = (key === 'name') ? 1 : -1;
  }
  if (BAOCAOSC_STATE.impactDataSource) {
    const parsed = normalizeImpactTableData(BAOCAOSC_STATE.impactDataSource);
    renderImpactSourceTable(parsed);
  }
}

function sortImpactIndustry(key) {
  if (BAOCAOSC_IMPACT_INDUSTRY_SORT.k === key) {
    BAOCAOSC_IMPACT_INDUSTRY_SORT.dir = -BAOCAOSC_IMPACT_INDUSTRY_SORT.dir;
  } else {
    BAOCAOSC_IMPACT_INDUSTRY_SORT.k = key;
    BAOCAOSC_IMPACT_INDUSTRY_SORT.dir = (key === 'name') ? 1 : -1;
  }
  if (BAOCAOSC_STATE.impactIndustry) {
    const parsed = normalizeImpactTableData(BAOCAOSC_STATE.impactIndustry);
    renderImpactIndustryTable(parsed);
  }
}

/**
 * Hiển thị 4 thẻ KPI tóm tắt cho Mục 7
 */
function renderBaoCaoScImpactSummaryCards(parsedSource, parsedIndustry) {
  const box = $('bscImpactSummaryCards');
  if (!box) return;

  const K = (l, v, s, c = '') => `
    <div class="card kpi">
      <div class="l">${l}</div>
      <div class="v" style="${c}">${v}</div>
      <div class="s">${s}</div>
    </div>
  `;

  // 1. Tỷ lệ impact chung Nguồn Data
  const srcRateStr = parsedSource ? `${parsedSource.avgRate.toFixed(2)}%` : '–';
  const srcSub = parsedSource ? `${parsedSource.totImpact.toLocaleString('vi-VN')} / ${parsedSource.totAct.toLocaleString('vi-VN')} GH (${parsedSource.items.length} nguồn)` : '';
  const srcColor = parsedSource ? getImpactRateColor(parsedSource.avgRate) : '#38bdf8';

  // 2. Nguồn Data Hiệu Quả Nhất
  const topSrc = parsedSource && parsedSource.topItem ? parsedSource.topItem : null;
  const topSrcVal = topSrc ? `${esc(topSrc.name)}` : '–';
  const topSrcSub = topSrc ? `Impact: ${topSrc.rate.toFixed(2)}% (${topSrc.impact}/${topSrc.act} GH)` : '';

  // 3. Tỷ lệ impact chung Ngành Hàng
  const indRateStr = parsedIndustry ? `${parsedIndustry.avgRate.toFixed(2)}%` : '–';
  const indSub = parsedIndustry ? `${parsedIndustry.totImpact.toLocaleString('vi-VN')} / ${parsedIndustry.totAct.toLocaleString('vi-VN')} GH (${parsedIndustry.items.length} ngành)` : '';
  const indColor = parsedIndustry ? getImpactRateColor(parsedIndustry.avgRate) : '#a78bfa';

  // 4. Ngành Hàng Hiệu Quả Nhất
  const topInd = parsedIndustry && parsedIndustry.topItem ? parsedIndustry.topItem : null;
  const topIndVal = topInd ? `${esc(topInd.name)}` : '–';
  const topIndSub = topInd ? `Impact: ${topInd.rate.toFixed(2)}% (${topInd.impact}/${topInd.act} GH)` : '';

  box.innerHTML =
    K('Impact Chung (Nguồn Data)', srcRateStr, srcSub, `color:${srcColor}`) +
    K('Nguồn Hiệu Quả Nhất', topSrcVal, topSrcSub, 'color:#10b981') +
    K('Impact Chung (Ngành Hàng)', indRateStr, indSub, `color:${indColor}`) +
    K('Ngành Hiệu Quả Nhất', topIndVal, topIndSub, 'color:#8b5cf6');
}

/**
 * Hiển thị Bảng 1: Impact Theo Nguồn Data (AD2:AG9)
 */
function renderImpactSourceTable(parsed) {
  const tbl = $('bscImpactSourceTable');
  if (!tbl || !parsed) return;

  const dir = BAOCAOSC_IMPACT_SOURCE_SORT.dir;
  const k = BAOCAOSC_IMPACT_SOURCE_SORT.k;
  const items = [...parsed.items].sort((a, b) => {
    if (k === 'name') return dir * a.name.localeCompare(b.name, 'vi');
    if (k === 'act') return dir * (a.act - b.act);
    if (k === 'impact') return dir * (a.impact - b.impact);
    if (k === 'rate') return dir * (a.rate - b.rate);
    return 0;
  });

  const sortArrow = key => (k === key ? (dir === 1 ? ' ▲' : ' ▼') : ' ⇅');

  let thead = '<thead><tr>';
  thead += `<th style="width:45px;text-align:center">STT</th>`;
  thead += `<th onclick="sortImpactSource('name')" style="text-align:left;cursor:pointer">Tệp / Nguồn Data${sortArrow('name')}</th>`;
  thead += `<th onclick="sortImpactSource('act')" style="text-align:center;cursor:pointer">Số Lượng ACT${sortArrow('act')}</th>`;
  thead += `<th onclick="sortImpactSource('impact')" style="text-align:center;cursor:pointer">Số Lượng Impact${sortArrow('impact')}</th>`;
  thead += `<th onclick="sortImpactSource('rate')" style="text-align:center;cursor:pointer">Tỷ Lệ Impact${sortArrow('rate')}</th>`;
  thead += '</tr></thead>';

  let tbody = '<tbody>';
  items.forEach((item, idx) => {
    const color = getImpactRateColor(item.rate);
    tbody += '<tr>';
    tbody += `<td style="text-align:center;color:var(--mut);font-weight:700">${idx + 1}</td>`;
    tbody += `<td style="text-align:left;font-weight:700;color:var(--tx-heading)">${esc(item.name)}</td>`;
    tbody += `<td style="text-align:center;font-weight:600">${item.act.toLocaleString('vi-VN')}</td>`;
    tbody += `<td style="text-align:center;font-weight:600;color:#38bdf8">${item.impact.toLocaleString('vi-VN')}</td>`;
    tbody += `<td style="text-align:center">
      <div style="display:flex;align-items:center;justify-content:center;gap:8px">
        <div style="flex:1;max-width:70px;height:6px;border-radius:3px;background:rgba(148,163,184,0.18);overflow:hidden">
          <div style="width:${Math.min(100, item.rate)}%;height:100%;background:${color};border-radius:3px"></div>
        </div>
        <span style="font-weight:800;color:${color};min-width:55px;text-align:right">${item.rate.toFixed(2)}%</span>
      </div>
    </td>`;
    tbody += '</tr>';
  });
  tbody += '</tbody>';

  let tfoot = '';
  if (parsed.totalRow) {
    const tot = parsed.totalRow;
    const color = getImpactRateColor(tot.rate);
    tfoot += '<tfoot><tr>';
    tfoot += `<td style="text-align:center;color:var(--mut)">★</td>`;
    tfoot += `<td style="text-align:left;font-weight:800;color:var(--tx-heading)">TỔNG CỘNG</td>`;
    tfoot += `<td style="text-align:center;font-weight:800">${tot.act.toLocaleString('vi-VN')}</td>`;
    tfoot += `<td style="text-align:center;font-weight:800;color:#38bdf8">${tot.impact.toLocaleString('vi-VN')}</td>`;
    tfoot += `<td style="text-align:center">
      <div style="display:flex;align-items:center;justify-content:center;gap:8px">
        <div style="flex:1;max-width:70px;height:6px;border-radius:3px;background:rgba(148,163,184,0.25);overflow:hidden">
          <div style="width:${Math.min(100, tot.rate)}%;height:100%;background:${color};border-radius:3px"></div>
        </div>
        <span style="font-weight:800;color:${color};min-width:55px;text-align:right">${tot.rate.toFixed(2)}%</span>
      </div>
    </td>`;
    tfoot += '</tr></tfoot>';
  }

  tbl.innerHTML = thead + tbody + tfoot;
}

/**
 * Hiển thị Bảng 2: Impact Theo Ngành Hàng (AD13:AG17)
 */
function renderImpactIndustryTable(parsed) {
  const tbl = $('bscImpactIndustryTable');
  if (!tbl || !parsed) return;

  const dir = BAOCAOSC_IMPACT_INDUSTRY_SORT.dir;
  const k = BAOCAOSC_IMPACT_INDUSTRY_SORT.k;
  const items = [...parsed.items].sort((a, b) => {
    if (k === 'name') return dir * a.name.localeCompare(b.name, 'vi');
    if (k === 'act') return dir * (a.act - b.act);
    if (k === 'impact') return dir * (a.impact - b.impact);
    if (k === 'rate') return dir * (a.rate - b.rate);
    return 0;
  });

  const sortArrow = key => (k === key ? (dir === 1 ? ' ▲' : ' ▼') : ' ⇅');

  let thead = '<thead><tr>';
  thead += `<th style="width:45px;text-align:center">STT</th>`;
  thead += `<th onclick="sortImpactIndustry('name')" style="text-align:left;cursor:pointer">Ngành Hàng${sortArrow('name')}</th>`;
  thead += `<th onclick="sortImpactIndustry('act')" style="text-align:center;cursor:pointer">Số Lượng ACT${sortArrow('act')}</th>`;
  thead += `<th onclick="sortImpactIndustry('impact')" style="text-align:center;cursor:pointer">Số Lượng Impact${sortArrow('impact')}</th>`;
  thead += `<th onclick="sortImpactIndustry('rate')" style="text-align:center;cursor:pointer">Tỷ Lệ Impact${sortArrow('rate')}</th>`;
  thead += '</tr></thead>';

  let tbody = '<tbody>';
  items.forEach((item, idx) => {
    const color = getImpactRateColor(item.rate);
    tbody += '<tr>';
    tbody += `<td style="text-align:center;color:var(--mut);font-weight:700">${idx + 1}</td>`;
    tbody += `<td style="text-align:left;font-weight:700;color:var(--tx-heading)">${esc(item.name)}</td>`;
    tbody += `<td style="text-align:center;font-weight:600">${item.act.toLocaleString('vi-VN')}</td>`;
    tbody += `<td style="text-align:center;font-weight:600;color:#38bdf8">${item.impact.toLocaleString('vi-VN')}</td>`;
    tbody += `<td style="text-align:center">
      <div style="display:flex;align-items:center;justify-content:center;gap:8px">
        <div style="flex:1;max-width:70px;height:6px;border-radius:3px;background:rgba(148,163,184,0.18);overflow:hidden">
          <div style="width:${Math.min(100, item.rate)}%;height:100%;background:${color};border-radius:3px"></div>
        </div>
        <span style="font-weight:800;color:${color};min-width:55px;text-align:right">${item.rate.toFixed(2)}%</span>
      </div>
    </td>`;
    tbody += '</tr>';
  });
  tbody += '</tbody>';

  let tfoot = '';
  if (parsed.totalRow) {
    const tot = parsed.totalRow;
    const color = getImpactRateColor(tot.rate);
    tfoot += '<tfoot><tr>';
    tfoot += `<td style="text-align:center;color:var(--mut)">★</td>`;
    tfoot += `<td style="text-align:left;font-weight:800;color:var(--tx-heading)">TỔNG CỘNG</td>`;
    tfoot += `<td style="text-align:center;font-weight:800">${tot.act.toLocaleString('vi-VN')}</td>`;
    tfoot += `<td style="text-align:center;font-weight:800;color:#38bdf8">${tot.impact.toLocaleString('vi-VN')}</td>`;
    tfoot += `<td style="text-align:center">
      <div style="display:flex;align-items:center;justify-content:center;gap:8px">
        <div style="flex:1;max-width:70px;height:6px;border-radius:3px;background:rgba(148,163,184,0.25);overflow:hidden">
          <div style="width:${Math.min(100, tot.rate)}%;height:100%;background:${color};border-radius:3px"></div>
        </div>
        <span style="font-weight:800;color:${color};min-width:55px;text-align:right">${tot.rate.toFixed(2)}%</span>
      </div>
    </td>`;
    tfoot += '</tr></tfoot>';
  }

  tbl.innerHTML = thead + tbody + tfoot;
}

/**
 * Xuất file CSV Bảng 1: Impact Theo Nguồn Data (Mục 7.1)
 */
function exportImpactSourceCsv() {
  if (!BAOCAOSC_STATE.impactDataSource) {
    showToast('Chưa có dữ liệu Nguồn Data để xuất CSV!', false);
    return;
  }
  const parsed = normalizeImpactTableData(BAOCAOSC_STATE.impactDataSource);
  if (!parsed) return;

  const lines = [];
  lines.push(['BÁO CÁO SC - MỤC 7.1: IMPACT THEO NGUỒN DATA']);
  lines.push(['Xuất ngày: ' + new Date().toLocaleString('vi-VN')]);
  lines.push([]);
  lines.push(['STT', 'Tệp / Nguồn Data', 'Số Lượng ACT', 'Số Lượng Impact', 'Tỷ Lệ Impact (%)']);

  parsed.items.forEach((it, idx) => {
    lines.push([idx + 1, it.name, it.act, it.impact, it.rate.toFixed(2) + '%']);
  });

  if (parsed.totalRow) {
    const tot = parsed.totalRow;
    lines.push(['★', 'TỔNG CỘNG', tot.act, tot.impact, tot.rate.toFixed(2) + '%']);
  }

  const csvContent = '\ufeff' + lines.map(row => {
    return row.map(cell => {
      const s = String(cell == null ? '' : cell);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',');
  }).join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `BaoCaoSC_Muc_7_1_Impact_NguonData_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Đã xuất file CSV Impact Theo Nguồn Data (Mục 7.1) thành công!', true);
}

/**
 * Xuất file CSV Bảng 2: Impact Theo Ngành Hàng (Mục 7.2)
 */
function exportImpactIndustryCsv() {
  if (!BAOCAOSC_STATE.impactIndustry) {
    showToast('Chưa có dữ liệu Ngành Hàng để xuất CSV!', false);
    return;
  }
  const parsed = normalizeImpactTableData(BAOCAOSC_STATE.impactIndustry);
  if (!parsed) return;

  const lines = [];
  lines.push(['BÁO CÁO SC - MỤC 7.2: IMPACT THEO NGÀNH HÀNG']);
  lines.push(['Xuất ngày: ' + new Date().toLocaleString('vi-VN')]);
  lines.push([]);
  lines.push(['STT', 'Ngành Hàng', 'Số Lượng ACT', 'Số Lượng Impact', 'Tỷ Lệ Impact (%)']);

  parsed.items.forEach((it, idx) => {
    lines.push([idx + 1, it.name, it.act, it.impact, it.rate.toFixed(2) + '%']);
  });

  if (parsed.totalRow) {
    const tot = parsed.totalRow;
    lines.push(['★', 'TỔNG CỘNG', tot.act, tot.impact, tot.rate.toFixed(2) + '%']);
  }

  const csvContent = '\ufeff' + lines.map(row => {
    return row.map(cell => {
      const s = String(cell == null ? '' : cell);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',');
  }).join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `BaoCaoSC_Muc_7_2_Impact_NganhHang_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Đã xuất file CSV Impact Theo Ngành Hàng (Mục 7.2) thành công!', true);
}

/**
 * Xuất file CSV Tổng Hợp Mục 7 (Gồm cả 2 bảng Nguồn Data & Ngành Hàng)
 */
function exportImpactSection7Csv() {
  if (!BAOCAOSC_STATE.impactDataSource && !BAOCAOSC_STATE.impactIndustry) {
    showToast('Chưa có dữ liệu Mục 7 để xuất CSV!', false);
    return;
  }

  const lines = [];
  lines.push(['BÁO CÁO SC - MỤC 7: TỶ LỆ IMPACT THEO NGUỒN DATA & NGÀNH HÀNG']);
  lines.push(['Xuất ngày: ' + new Date().toLocaleString('vi-VN')]);
  lines.push([]);

  // Bảng 1: Nguồn Data
  if (BAOCAOSC_STATE.impactDataSource) {
    const parsedSource = normalizeImpactTableData(BAOCAOSC_STATE.impactDataSource);
    if (parsedSource) {
      lines.push(['--- BẢNG 1: IMPACT THEO NGUỒN DATA (AD2:AG9) ---']);
      lines.push(['STT', 'Tệp / Nguồn Data', 'Số Lượng ACT', 'Số Lượng Impact', 'Tỷ Lệ Impact (%)']);
      parsedSource.items.forEach((it, idx) => {
        lines.push([idx + 1, it.name, it.act, it.impact, it.rate.toFixed(2) + '%']);
      });
      if (parsedSource.totalRow) {
        const tot = parsedSource.totalRow;
        lines.push(['★', 'TỔNG CỘNG', tot.act, tot.impact, tot.rate.toFixed(2) + '%']);
      }
      lines.push([]);
    }
  }

  // Bảng 2: Ngành Hàng
  if (BAOCAOSC_STATE.impactIndustry) {
    const parsedIndustry = normalizeImpactTableData(BAOCAOSC_STATE.impactIndustry);
    if (parsedIndustry) {
      lines.push(['--- BẢNG 2: IMPACT THEO NGÀNH HÀNG (AD13:AG17) ---']);
      lines.push(['STT', 'Ngành Hàng', 'Số Lượng ACT', 'Số Lượng Impact', 'Tỷ Lệ Impact (%)']);
      parsedIndustry.items.forEach((it, idx) => {
        lines.push([idx + 1, it.name, it.act, it.impact, it.rate.toFixed(2) + '%']);
      });
      if (parsedIndustry.totalRow) {
        const tot = parsedIndustry.totalRow;
        lines.push(['★', 'TỔNG CỘNG', tot.act, tot.impact, tot.rate.toFixed(2) + '%']);
      }
    }
  }

  const csvContent = '\ufeff' + lines.map(row => {
    return row.map(cell => {
      const s = String(cell == null ? '' : cell);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',');
  }).join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `BaoCaoSC_Muc_7_Impact_NguonData_NganhHang_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Đã xuất file CSV Tổng Hợp Mục 7 thành công!', true);
}

function exportImpactSection6Csv() {
  exportImpactSection7Csv();
}

function exportImpactSection5Csv() {
  exportImpactSection7Csv();
}

/* ==========================================================================
   MỤC 9: HIỆU SUẤT KPI TEAM & TƯ VẤN CHUYỂN ADDON (THÁNG 9 & THÁNG 10)
   - 9.1: KPI Team Online Tháng 9 (AJ2:AP5)
   - 9.2: KPI Team Offline Tháng 10 (AJ13:AP17)
   - 9.3: Tư Vấn Chuyển Addon Tháng 10 (AJ22:AM29)
   ========================================================================== */

let BAOCAOSC_KPI_ONLINE_T9_SORT = { k: 'default', dir: -1 };
let BAOCAOSC_KPI_OFFLINE_T10_SORT = { k: 'default', dir: -1 };
let BAOCAOSC_ADDON_T10_SORT = { k: 'default', dir: -1 };

/**
 * Helper phân tích số thập phân
 */
function parseBscDecimal(val) {
  if (val == null || val === '' || val === '-') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const s = String(val).replace(/,/g, '').replace(/[^0-9.-]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/**
 * Helper phân tích thời lượng Talktime (giây) từ ISO date hoặc chuỗi time
 */
function parseBscTalktimeSec(val) {
  if (val == null || val === '' || val === 0 || val === '0') return 0;
  if (typeof val === 'number') {
    return Math.round(val * 86400);
  }
  if (typeof val === 'string') {
    if (val.includes('T')) {
      const d = new Date(val);
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
 * Định dạng số giây sang hh:mm:ss
 */
function formatBscTalktimeStr(sec) {
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
 * Màu sắc trực quan cho tỷ lệ KPI
 */
function getKpiPercentBadge(pct, baseline = 100) {
  if (pct == null || isNaN(pct)) return '<span style="color:var(--mut)">–</span>';
  let color = '#38bdf8';
  if (baseline === 100) {
    if (pct >= 120) color = '#10b981';
    else if (pct >= 100) color = '#38bdf8';
    else if (pct >= 80) color = '#f59e0b';
    else color = '#ef4444';
  } else {
    if (pct >= 50) color = '#10b981';
    else if (pct >= 40) color = '#38bdf8';
    else color = '#ef4444';
  }
  return `<span style="font-weight:700;color:${color}">${pct.toFixed(2)}%</span>`;
}

/**
 * Chuẩn hóa dữ liệu thô 6.1: KPI Team Online Tháng 9 (AJ2:AP5)
 */
function normalizeKpiOnlineT9Data(rawData) {
  if (!Array.isArray(rawData) || rawData.length < 2) return null;

  const items = [];
  let totalRow = null;

  for (let r = 1; r < rawData.length; r++) {
    const row = rawData[r];
    if (!row || !row.length) continue;
    const name = String(row[0] || '').trim();
    if (!name) continue;

    const headcount = parseBscNumber(row[1]);
    const kpiImpact = parseBscPct(row[2]);
    const kpiTotalScore = parseBscPct(row[3]);
    const kpiAddon = parseBscPct(row[4]);
    const kpiTeam = parseBscPct(row[5]);
    const talktimeSec = parseBscTalktimeSec(row[6]);
    const talktimeStr = formatBscTalktimeStr(talktimeSec);

    const item = {
      name,
      headcount,
      kpiImpact,
      kpiTotalScore,
      kpiAddon,
      kpiTeam,
      talktimeSec,
      talktimeStr
    };

    if (name.toLowerCase().includes('toàn quốc') || name.toLowerCase() === 'tổng') {
      totalRow = item;
    } else {
      items.push(item);
    }
  }

  return { items, totalRow };
}

/**
 * Chuẩn hóa dữ liệu thô 6.2: KPI Team Offline Tháng 10 (AJ13:AP17)
 */
function normalizeKpiOfflineT10Data(rawData) {
  if (!Array.isArray(rawData) || rawData.length < 2) return null;

  const items = [];
  let totalRow = null;

  for (let r = 1; r < rawData.length; r++) {
    const row = rawData[r];
    if (!row || !row.length) continue;
    const name = String(row[0] || '').trim();
    if (!name) continue;

    const headcount = parseBscNumber(row[1]);
    const kpiActive = parseBscPct(row[2]);
    const kpiTotalScore = parseBscPct(row[3]);
    const kpiAddon = parseBscPct(row[4]);
    const kpiTeam = parseBscPct(row[5]);
    const impact = parseBscPct(row[6]);

    const item = {
      name,
      headcount,
      kpiActive,
      kpiTotalScore,
      kpiAddon,
      kpiTeam,
      impact
    };

    if (name.toLowerCase().includes('toàn quốc') || name.toLowerCase() === 'tổng') {
      totalRow = item;
    } else {
      items.push(item);
    }
  }

  return { items, totalRow };
}

/**
 * Chuẩn hóa dữ liệu thô 6.3: Tư Vấn Chuyển Addon Tháng 10 (AJ22:AM29)
 */
function normalizeAddonT10Data(rawData) {
  if (!Array.isArray(rawData) || rawData.length < 2) return null;

  const items = [];
  let totalRow = null;

  for (let r = 1; r < rawData.length; r++) {
    const row = rawData[r];
    if (!row || !row.length) continue;
    const name = String(row[0] || '').trim();
    if (!name) continue;

    const offline = parseBscDecimal(row[1]);
    const online = parseBscDecimal(row[2]);
    const total = parseBscDecimal(row[3]);

    const item = {
      name,
      offline,
      online,
      total,
      pct: 0
    };

    if (name.toLowerCase().includes('tổng') || name.toLowerCase() === 'total') {
      totalRow = item;
    } else {
      items.push(item);
    }
  }

  const grandTotal = totalRow ? totalRow.total : items.reduce((s, it) => s + it.total, 0);
  items.forEach(it => {
    it.pct = grandTotal > 0 ? (it.total / grandTotal) * 100 : 0;
  });
  if (totalRow) {
    totalRow.pct = 100;
  }

  return { items, totalRow, grandTotal };
}

/**
 * Render 4 thẻ KPI tóm tắt đầu Mục 9
 */
function renderBaoCaoScKpiAddonSummaryCards(parsedOnline, parsedOffline, parsedAddon) {
  const c = $('bscKpiAddonSummaryCards');
  if (!c) return;

  const K = (title, val, sub = '', style = '') => `
    <div class="card kpi">
      <div class="title">${title}</div>
      <div class="val" style="${style}">${val}</div>
      ${sub ? `<div class="sub">${sub}</div>` : ''}
    </div>`;

  let html = '';

  // Thẻ 1: KPI Team Online T9
  if (parsedOnline && parsedOnline.totalRow) {
    const tot = parsedOnline.totalRow;
    html += K('KPI Team Online (T9)', `${tot.kpiTeam.toFixed(2)}%`, `Toàn quốc · ${tot.headcount} nhân sự (Điểm tổng: ${tot.kpiTotalScore.toFixed(1)}%)`, 'color:#38bdf8');
  } else {
    html += K('KPI Team Online (T9)', '–', 'Đang cập nhật', 'color:var(--mut)');
  }

  // Thẻ 2: KPI Team Offline T10
  if (parsedOffline && parsedOffline.totalRow) {
    const tot = parsedOffline.totalRow;
    html += K('KPI Team Offline (T10)', `${tot.kpiTeam.toFixed(2)}%`, `Toàn quốc · ${tot.headcount} nhân sự (Impact: ${tot.impact.toFixed(1)}%)`, 'color:#a855f7');
  } else {
    html += K('KPI Team Offline (T10)', '–', 'Đang cập nhật', 'color:var(--mut)');
  }

  // Thẻ 3: Talktime TB Online T9
  if (parsedOnline && parsedOnline.totalRow) {
    const tot = parsedOnline.totalRow;
    const mb = parsedOnline.items.find(it => it.name.toLowerCase().includes('bắc'));
    const mn = parsedOnline.items.find(it => it.name.toLowerCase().includes('nam'));
    const subStr = (mb ? `MB: ${mb.talktimeStr}` : '') + (mb && mn ? ' · ' : '') + (mn ? `MN: ${mn.talktimeStr}` : '');
    html += K('Talktime TB Online (T9)', tot.talktimeStr, subStr || 'Toàn quốc', 'color:#06b6d4');
  } else {
    html += K('Talktime TB Online (T9)', '–', 'Đang cập nhật', 'color:var(--mut)');
  }

  // Thẻ 4: Tư Vấn Chuyển Addon T10
  if (parsedAddon && parsedAddon.totalRow) {
    const tot = parsedAddon.totalRow;
    const off = tot.offline.toLocaleString('vi-VN');
    const on = tot.online.toLocaleString('vi-VN');
    html += K('Tư Vấn Addon (T10)', `${tot.total.toLocaleString('vi-VN')}`, `Offline: ${off} · Online: ${on}`, 'color:#10b981');
  } else {
    html += K('Tư Vấn Addon (T10)', '–', 'Đang cập nhật', 'color:var(--mut)');
  }

  c.innerHTML = html;
}

/**
 * BẢNG 1: KPI TEAM ONLINE THÁNG 9
 */
function renderKpiOnlineT9Table(parsed) {
  const tbl = $('bscKpiOnlineT9Table');
  if (!tbl || !parsed) return;

  const items = [...parsed.items];
  const { k, dir } = BAOCAOSC_KPI_ONLINE_T9_SORT;

  if (k !== 'default') {
    items.sort((a, b) => {
      if (k === 'name') return dir * a.name.localeCompare(b.name, 'vi');
      return dir * ((a[k] || 0) - (b[k] || 0));
    });
  }

  const sortArrow = col => (BAOCAOSC_KPI_ONLINE_T9_SORT.k === col ? (BAOCAOSC_KPI_ONLINE_T9_SORT.dir === 1 ? ' ▲' : ' ▼') : ' ⇅');

  let thead = '<thead><tr>';
  thead += `<th style="width:55px;text-align:center">STT</th>`;
  thead += `<th onclick="sortKpiOnlineT9('name')" style="cursor:pointer;text-align:center;min-width:140px">Phân Vùng / Miền${sortArrow('name')}</th>`;
  thead += `<th onclick="sortKpiOnlineT9('headcount')" style="cursor:pointer;text-align:center;width:110px">Số Nhân Sự${sortArrow('headcount')}</th>`;
  thead += `<th onclick="sortKpiOnlineT9('kpiImpact')" style="cursor:pointer;text-align:center;min-width:130px">KPI Impact${sortArrow('kpiImpact')}</th>`;
  thead += `<th onclick="sortKpiOnlineT9('kpiTotalScore')" style="cursor:pointer;text-align:center;min-width:130px">KPI Điểm Tổng${sortArrow('kpiTotalScore')}</th>`;
  thead += `<th onclick="sortKpiOnlineT9('kpiAddon')" style="cursor:pointer;text-align:center;min-width:130px">KPI Addon${sortArrow('kpiAddon')}</th>`;
  thead += `<th onclick="sortKpiOnlineT9('kpiTeam')" style="cursor:pointer;text-align:center;min-width:130px">KPI Team${sortArrow('kpiTeam')}</th>`;
  thead += `<th onclick="sortKpiOnlineT9('talktimeSec')" style="cursor:pointer;text-align:center;min-width:120px">Talktime (TB)${sortArrow('talktimeSec')}</th>`;
  thead += '</tr></thead>';

  let tbody = '<tbody>';
  items.forEach((item, idx) => {
    tbody += '<tr>';
    tbody += `<td style="text-align:center;color:var(--mut);font-weight:700">${idx + 1}</td>`;
    tbody += `<td style="text-align:left;font-weight:700;color:var(--tx-heading)">${esc(item.name)}</td>`;
    tbody += `<td style="text-align:center;font-weight:600">${item.headcount}</td>`;
    tbody += `<td style="text-align:center">${getKpiPercentBadge(item.kpiImpact, 100)}</td>`;
    tbody += `<td style="text-align:center">${getKpiPercentBadge(item.kpiTotalScore, 100)}</td>`;
    tbody += `<td style="text-align:center">${getKpiPercentBadge(item.kpiAddon, 100)}</td>`;
    tbody += `<td style="text-align:center">${getKpiPercentBadge(item.kpiTeam, 100)}</td>`;
    tbody += `<td style="text-align:center;font-weight:700;color:#06b6d4">${esc(item.talktimeStr)}</td>`;
    tbody += '</tr>';
  });
  tbody += '</tbody>';

  let tfoot = '';
  if (parsed.totalRow) {
    const tot = parsed.totalRow;
    tfoot += '<tfoot><tr>';
    tfoot += `<td style="text-align:center;color:var(--mut)">★</td>`;
    tfoot += `<td style="text-align:left;font-weight:800;color:var(--tx-heading)">TOÀN QUỐC</td>`;
    tfoot += `<td style="text-align:center;font-weight:800">${tot.headcount}</td>`;
    tfoot += `<td style="text-align:center;font-weight:800">${getKpiPercentBadge(tot.kpiImpact, 100)}</td>`;
    tfoot += `<td style="text-align:center;font-weight:800">${getKpiPercentBadge(tot.kpiTotalScore, 100)}</td>`;
    tfoot += `<td style="text-align:center;font-weight:800">${getKpiPercentBadge(tot.kpiAddon, 100)}</td>`;
    tfoot += `<td style="text-align:center;font-weight:800">${getKpiPercentBadge(tot.kpiTeam, 100)}</td>`;
    tfoot += `<td style="text-align:center;font-weight:800;color:#06b6d4">${esc(tot.talktimeStr)}</td>`;
    tfoot += '</tr></tfoot>';
  }

  tbl.innerHTML = thead + tbody + tfoot;
}

/**
 * BẢNG 2: KPI TEAM OFFLINE THÁNG 10
 */
function renderKpiOfflineT10Table(parsed) {
  const tbl = $('bscKpiOfflineT10Table');
  if (!tbl || !parsed) return;

  const items = [...parsed.items];
  const { k, dir } = BAOCAOSC_KPI_OFFLINE_T10_SORT;

  if (k !== 'default') {
    items.sort((a, b) => {
      if (k === 'name') return dir * a.name.localeCompare(b.name, 'vi');
      return dir * ((a[k] || 0) - (b[k] || 0));
    });
  }

  const sortArrow = col => (BAOCAOSC_KPI_OFFLINE_T10_SORT.k === col ? (BAOCAOSC_KPI_OFFLINE_T10_SORT.dir === 1 ? ' ▲' : ' ▼') : ' ⇅');

  let thead = '<thead><tr>';
  thead += `<th style="width:55px;text-align:center">STT</th>`;
  thead += `<th onclick="sortKpiOfflineT10('name')" style="cursor:pointer;text-align:center;min-width:140px">Coacher Quản Lý${sortArrow('name')}</th>`;
  thead += `<th onclick="sortKpiOfflineT10('headcount')" style="cursor:pointer;text-align:center;width:110px">Số Nhân Sự${sortArrow('headcount')}</th>`;
  thead += `<th onclick="sortKpiOfflineT10('kpiActive')" style="cursor:pointer;text-align:center;min-width:145px">KPI Active Ngày Check-in${sortArrow('kpiActive')}</th>`;
  thead += `<th onclick="sortKpiOfflineT10('kpiTotalScore')" style="cursor:pointer;text-align:center;min-width:130px">KPI Điểm Tổng${sortArrow('kpiTotalScore')}</th>`;
  thead += `<th onclick="sortKpiOfflineT10('kpiAddon')" style="cursor:pointer;text-align:center;min-width:130px">KPI Addon${sortArrow('kpiAddon')}</th>`;
  thead += `<th onclick="sortKpiOfflineT10('kpiTeam')" style="cursor:pointer;text-align:center;min-width:130px">KPI Team${sortArrow('kpiTeam')}</th>`;
  thead += `<th onclick="sortKpiOfflineT10('impact')" style="cursor:pointer;text-align:center;min-width:130px">Tỷ Lệ Impact${sortArrow('impact')}</th>`;
  thead += '</tr></thead>';

  let tbody = '<tbody>';
  items.forEach((item, idx) => {
    tbody += '<tr>';
    tbody += `<td style="text-align:center;color:var(--mut);font-weight:700">${idx + 1}</td>`;
    tbody += `<td style="text-align:left;font-weight:700;color:var(--tx-heading)">${esc(item.name)}</td>`;
    tbody += `<td style="text-align:center;font-weight:600">${item.headcount}</td>`;
    tbody += `<td style="text-align:center">${getKpiPercentBadge(item.kpiActive, 50)}</td>`;
    tbody += `<td style="text-align:center">${getKpiPercentBadge(item.kpiTotalScore, 50)}</td>`;
    tbody += `<td style="text-align:center">${getKpiPercentBadge(item.kpiAddon, 50)}</td>`;
    tbody += `<td style="text-align:center">${getKpiPercentBadge(item.kpiTeam, 50)}</td>`;
    tbody += `<td style="text-align:center">${getKpiPercentBadge(item.impact, 50)}</td>`;
    tbody += '</tr>';
  });
  tbody += '</tbody>';

  let tfoot = '';
  if (parsed.totalRow) {
    const tot = parsed.totalRow;
    tfoot += '<tfoot><tr>';
    tfoot += `<td style="text-align:center;color:var(--mut)">★</td>`;
    tfoot += `<td style="text-align:left;font-weight:800;color:var(--tx-heading)">TOÀN QUỐC</td>`;
    tfoot += `<td style="text-align:center;font-weight:800">${tot.headcount}</td>`;
    tfoot += `<td style="text-align:center;font-weight:800">${getKpiPercentBadge(tot.kpiActive, 50)}</td>`;
    tfoot += `<td style="text-align:center;font-weight:800">${getKpiPercentBadge(tot.kpiTotalScore, 50)}</td>`;
    tfoot += `<td style="text-align:center;font-weight:800">${getKpiPercentBadge(tot.kpiAddon, 50)}</td>`;
    tfoot += `<td style="text-align:center;font-weight:800">${getKpiPercentBadge(tot.kpiTeam, 50)}</td>`;
    tfoot += `<td style="text-align:center;font-weight:800">${getKpiPercentBadge(tot.impact, 50)}</td>`;
    tfoot += '</tr></tfoot>';
  }

  tbl.innerHTML = thead + tbody + tfoot;
}

/**
 * BẢNG 3: TƯ VẤN CHUYỂN ADDON THÁNG 10
 */
function renderAddonT10Table(parsed) {
  const tbl = $('bscAddonT10Table');
  if (!tbl || !parsed) return;

  const items = [...parsed.items];
  const { k, dir } = BAOCAOSC_ADDON_T10_SORT;

  if (k !== 'default') {
    items.sort((a, b) => {
      if (k === 'name') return dir * a.name.localeCompare(b.name, 'vi');
      return dir * ((a[k] || 0) - (b[k] || 0));
    });
  }

  const sortArrow = col => (BAOCAOSC_ADDON_T10_SORT.k === col ? (BAOCAOSC_ADDON_T10_SORT.dir === 1 ? ' ▲' : ' ▼') : ' ⇅');

  let thead = '<thead><tr>';
  thead += `<th style="width:55px;text-align:center">STT</th>`;
  thead += `<th onclick="sortAddonT10('name')" style="cursor:pointer;text-align:center;min-width:180px">Dịch Vụ Addon${sortArrow('name')}</th>`;
  thead += `<th onclick="sortAddonT10('offline')" style="cursor:pointer;text-align:center;min-width:130px">Team Offline${sortArrow('offline')}</th>`;
  thead += `<th onclick="sortAddonT10('online')" style="cursor:pointer;text-align:center;min-width:130px">Team Online${sortArrow('online')}</th>`;
  thead += `<th onclick="sortAddonT10('total')" style="cursor:pointer;text-align:center;min-width:130px">Tổng Số Lượng${sortArrow('total')}</th>`;
  thead += `<th onclick="sortAddonT10('pct')" style="cursor:pointer;text-align:center;min-width:160px">Tỷ Trọng Đóng Góp${sortArrow('pct')}</th>`;
  thead += '</tr></thead>';

  let tbody = '<tbody>';
  items.forEach((item, idx) => {
    let barColor = '#38bdf8';
    if (item.pct >= 30) barColor = '#10b981';
    else if (item.pct >= 15) barColor = '#38bdf8';
    else if (item.pct >= 5) barColor = '#a855f7';
    else barColor = '#f59e0b';

    tbody += '<tr>';
    tbody += `<td style="text-align:center;color:var(--mut);font-weight:700">${idx + 1}</td>`;
    tbody += `<td style="text-align:left;font-weight:700;color:var(--tx-heading)">${esc(item.name)}</td>`;
    tbody += `<td style="text-align:center;font-weight:600">${item.offline.toLocaleString('vi-VN')}</td>`;
    tbody += `<td style="text-align:center;font-weight:600">${item.online.toLocaleString('vi-VN')}</td>`;
    tbody += `<td style="text-align:center;font-weight:800;color:#38bdf8">${item.total.toLocaleString('vi-VN')}</td>`;
    tbody += `<td style="text-align:center">
      <div style="display:flex;align-items:center;justify-content:center;gap:8px">
        <div style="flex:1;max-width:80px;height:6px;border-radius:3px;background:rgba(148,163,184,0.18);overflow:hidden">
          <div style="width:${Math.min(100, item.pct)}%;height:100%;background:${barColor};border-radius:3px"></div>
        </div>
        <span style="font-weight:800;color:${barColor};min-width:55px;text-align:right">${item.pct.toFixed(2)}%</span>
      </div>
    </td>`;
    tbody += '</tr>';
  });
  tbody += '</tbody>';

  let tfoot = '';
  if (parsed.totalRow) {
    const tot = parsed.totalRow;
    tfoot += '<tfoot><tr>';
    tfoot += `<td style="text-align:center;color:var(--mut)">★</td>`;
    tfoot += `<td style="text-align:left;font-weight:800;color:var(--tx-heading)">TỔNG CỘNG</td>`;
    tfoot += `<td style="text-align:center;font-weight:800">${tot.offline.toLocaleString('vi-VN')}</td>`;
    tfoot += `<td style="text-align:center;font-weight:800">${tot.online.toLocaleString('vi-VN')}</td>`;
    tfoot += `<td style="text-align:center;font-weight:800;color:#38bdf8">${tot.total.toLocaleString('vi-VN')}</td>`;
    tfoot += `<td style="text-align:center;font-weight:800;color:#10b981">100.00%</td>`;
    tfoot += '</tr></tfoot>';
  }

  tbl.innerHTML = thead + tbody + tfoot;
}

/**
 * Xử lý sắp xếp Bảng 1: KPI Team Online T9
 */
function sortKpiOnlineT9(col) {
  if (BAOCAOSC_KPI_ONLINE_T9_SORT.k === col) {
    BAOCAOSC_KPI_ONLINE_T9_SORT.dir *= -1;
  } else {
    BAOCAOSC_KPI_ONLINE_T9_SORT = { k: col, dir: -1 };
  }
  if (BAOCAOSC_STATE.kpiOnlineT9) {
    const parsed = normalizeKpiOnlineT9Data(BAOCAOSC_STATE.kpiOnlineT9);
    renderKpiOnlineT9Table(parsed);
  }
}

/**
 * Xử lý sắp xếp Bảng 2: KPI Team Offline T10
 */
function sortKpiOfflineT10(col) {
  if (BAOCAOSC_KPI_OFFLINE_T10_SORT.k === col) {
    BAOCAOSC_KPI_OFFLINE_T10_SORT.dir *= -1;
  } else {
    BAOCAOSC_KPI_OFFLINE_T10_SORT = { k: col, dir: -1 };
  }
  if (BAOCAOSC_STATE.kpiOfflineT10) {
    const parsed = normalizeKpiOfflineT10Data(BAOCAOSC_STATE.kpiOfflineT10);
    renderKpiOfflineT10Table(parsed);
  }
}

/**
 * Xử lý sắp xếp Bảng 3: Addon T10
 */
function sortAddonT10(col) {
  if (BAOCAOSC_ADDON_T10_SORT.k === col) {
    BAOCAOSC_ADDON_T10_SORT.dir *= -1;
  } else {
    BAOCAOSC_ADDON_T10_SORT = { k: col, dir: -1 };
  }
  if (BAOCAOSC_STATE.addonT10) {
    const parsed = normalizeAddonT10Data(BAOCAOSC_STATE.addonT10);
    renderAddonT10Table(parsed);
  }
}

/**
 * Xuất file CSV Bảng 1 Mục 9: KPI Team Online Tháng 9
 */
function exportKpiOnlineT9Csv() {
  if (!BAOCAOSC_STATE.kpiOnlineT9) {
    showToast('Chưa có dữ liệu KPI Team Online Tháng 9 để xuất CSV!', false);
    return;
  }
  const parsed = normalizeKpiOnlineT9Data(BAOCAOSC_STATE.kpiOnlineT9);
  if (!parsed) return;

  const lines = [];
  lines.push(['BÁO CÁO SC - MỤC 9.1: KPI TEAM ONLINE THÁNG 9 (AJ2:AP5)']);
  lines.push(['Xuất ngày: ' + new Date().toLocaleString('vi-VN')]);
  lines.push([]);
  lines.push(['STT', 'Phân Vùng / Miền', 'Số Nhân Sự', 'KPI Impact (%)', 'KPI Điểm Tổng (%)', 'KPI Addon (%)', 'KPI Team (%)', 'Talktime (TB)']);

  parsed.items.forEach((it, idx) => {
    lines.push([
      idx + 1,
      it.name,
      it.headcount,
      it.kpiImpact.toFixed(2) + '%',
      it.kpiTotalScore.toFixed(2) + '%',
      it.kpiAddon.toFixed(2) + '%',
      it.kpiTeam.toFixed(2) + '%',
      it.talktimeStr
    ]);
  });

  if (parsed.totalRow) {
    const tot = parsed.totalRow;
    lines.push([
      '★',
      'TOÀN QUỐC',
      tot.headcount,
      tot.kpiImpact.toFixed(2) + '%',
      tot.kpiTotalScore.toFixed(2) + '%',
      tot.kpiAddon.toFixed(2) + '%',
      tot.kpiTeam.toFixed(2) + '%',
      tot.talktimeStr
    ]);
  }

  const csvContent = '\ufeff' + lines.map(row => {
    return row.map(cell => {
      const s = String(cell == null ? '' : cell);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',');
  }).join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `BaoCaoSC_Muc_9_1_KPI_Team_Online_T9_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Đã xuất file CSV KPI Team Online Tháng 9 (Mục 9.1) thành công!', true);
}

/**
 * Xuất file CSV Bảng 2 Mục 9: KPI Team Offline Tháng 10
 */
function exportKpiOfflineT10Csv() {
  if (!BAOCAOSC_STATE.kpiOfflineT10) {
    showToast('Chưa có dữ liệu KPI Team Offline Tháng 10 để xuất CSV!', false);
    return;
  }
  const parsed = normalizeKpiOfflineT10Data(BAOCAOSC_STATE.kpiOfflineT10);
  if (!parsed) return;

  const lines = [];
  lines.push(['BÁO CÁO SC - MỤC 9.2: KPI TEAM OFFLINE THÁNG 10 (AJ13:AP17)']);
  lines.push(['Xuất ngày: ' + new Date().toLocaleString('vi-VN')]);
  lines.push([]);
  lines.push(['STT', 'Coacher Quản Lý', 'Số Nhân Sự', 'KPI Active Ngày Checkin (%)', 'KPI Điểm Tổng (%)', 'KPI Addon (%)', 'KPI Team (%)', 'Tỷ Lệ Impact (%)']);

  parsed.items.forEach((it, idx) => {
    lines.push([
      idx + 1,
      it.name,
      it.headcount,
      it.kpiActive.toFixed(2) + '%',
      it.kpiTotalScore.toFixed(2) + '%',
      it.kpiAddon.toFixed(2) + '%',
      it.kpiTeam.toFixed(2) + '%',
      it.impact.toFixed(2) + '%'
    ]);
  });

  if (parsed.totalRow) {
    const tot = parsed.totalRow;
    lines.push([
      '★',
      'TOÀN QUỐC',
      tot.headcount,
      tot.kpiActive.toFixed(2) + '%',
      tot.kpiTotalScore.toFixed(2) + '%',
      tot.kpiAddon.toFixed(2) + '%',
      tot.kpiTeam.toFixed(2) + '%',
      tot.impact.toFixed(2) + '%'
    ]);
  }

  const csvContent = '\ufeff' + lines.map(row => {
    return row.map(cell => {
      const s = String(cell == null ? '' : cell);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',');
  }).join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `BaoCaoSC_Muc_9_2_KPI_Team_Offline_T10_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Đã xuất file CSV KPI Team Offline Tháng 10 (Mục 9.2) thành công!', true);
}

/**
 * Xuất file CSV Bảng 3 Mục 9: Tư Vấn Chuyển Addon Tháng 10
 */
function exportAddonT10Csv() {
  if (!BAOCAOSC_STATE.addonT10) {
    showToast('Chưa có dữ liệu Tư Vấn Chuyển Addon Tháng 10 để xuất CSV!', false);
    return;
  }
  const parsed = normalizeAddonT10Data(BAOCAOSC_STATE.addonT10);
  if (!parsed) return;

  const lines = [];
  lines.push(['BÁO CÁO SC - MỤC 9.3: TƯ VẤN CHUYỂN ADDON THÁNG 10 (AJ22:AM29)']);
  lines.push(['Xuất ngày: ' + new Date().toLocaleString('vi-VN')]);
  lines.push([]);
  lines.push(['STT', 'Dịch Vụ Addon', 'Team Offline', 'Team Online', 'Tổng Số Lượng', 'Tỷ Trọng (%)']);

  parsed.items.forEach((it, idx) => {
    lines.push([
      idx + 1,
      it.name,
      it.offline,
      it.online,
      it.total,
      it.pct.toFixed(2) + '%'
    ]);
  });

  if (parsed.totalRow) {
    const tot = parsed.totalRow;
    lines.push([
      '★',
      'TỔNG CỘNG',
      tot.offline,
      tot.online,
      tot.total,
      '100.00%'
    ]);
  }

  const csvContent = '\ufeff' + lines.map(row => {
    return row.map(cell => {
      const s = String(cell == null ? '' : cell);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',');
  }).join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `BaoCaoSC_Muc_9_3_Tu_Van_Addon_T10_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Đã xuất file CSV Tư Vấn Chuyển Addon Tháng 10 (Mục 9.3) thành công!', true);
}
