/**
 * tab_baocaosc.js - Logic xử lý dữ liệu và giao diện Tab 6: BÁO CÁO SC
 * Mục 1: Active Rate Năm 2026 (Retail, F&B, Booking qua các tháng)
 * Mục 2: Tỷ Lệ Chăm Khách New T10 (Ký Mới, Inactive, SC Chăm)
 */

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
   MỤC 1: ACTIVE RATE NĂM 2026 (RETAIL · F&B · BOOKING)
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
 * BẢNG CHI TIẾT THEO TỪNG THÁNG (TIMELINE VIEW - MỤC 1)
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
 * Sắp xếp bảng Mục 1
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
   MỤC 2: TỶ LỆ CHĂM KHÁCH NEW T10 (KÝ MỚI · INACTIVE · SC CHĂM)
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
 * Hiển thị 3 thẻ KPI tóm tắt cho Mục 2
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
 * Hiển thị bảng chi tiết Mục 2
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
 * Sắp xếp bảng Mục 2
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
 * Điều phối render toàn bộ Tab BÁO CÁO SC (Mục 1, Mục 2, Mục 3 & Mục 4)
 */
function renderBaoCaoSc() {
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

  if (BAOCAOSC_STATE.provinceImpact) {
    const parsedProvince = normalizeProvinceImpactData(BAOCAOSC_STATE.provinceImpact);
    if (parsedProvince) {
      renderBaoCaoScProvinceSummaryCards(parsedProvince);
      renderProvinceImpactTable(parsedProvince);
    }
  }

  if (BAOCAOSC_STATE.headcountRegion || BAOCAOSC_STATE.headcountProvince) {
    const parsedRegion = BAOCAOSC_STATE.headcountRegion ? normalizeHeadcountRegionData(BAOCAOSC_STATE.headcountRegion) : null;
    const parsedProvince = BAOCAOSC_STATE.headcountProvince ? normalizeHeadcountProvinceData(BAOCAOSC_STATE.headcountProvince) : null;
    renderBaoCaoScHeadcountSummaryCards(parsedRegion, parsedProvince);
    if (parsedRegion) renderHeadcountRegionTable(parsedRegion);
    if (parsedProvince) renderHeadcountProvinceTable(parsedProvince);
  }
}

/**
 * Tải dữ liệu BÁO CÁO SC từ IndexedDB hoặc API trực tiếp (Mục 1, Mục 2, Mục 3 & Mục 4 song song)
 */
async function loadBaoCaoSc(forceReload = false) {
  const btn = $('btnReloadBaoCaoSc');
  const badge = $('baocaoscSrcBadge');

  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Đang tải…';
  }
  if (badge) {
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

      if (cached && cached.activeRate && Array.isArray(cached.activeRate) && cached.activeRate.length >= 2 && cached.provinceImpact && cached.headcountRegion && cached.headcountProvince) {
        const ageMs = Date.now() - (cached.savedAt || 0);
        const minsAgo = Math.max(0, Math.floor(ageMs / 60000));
        const timeLabel = minsAgo === 0 ? 'vừa xong' : `${minsAgo} phút trước`;

        if (ageMs < CACHE_TTL_MS) {
          BAOCAOSC_STATE = cached;
          renderBaoCaoSc();
          if (badge) {
            badge.className = 'badge b-cache';
            badge.textContent = `Bộ nhớ đệm (${timeLabel})`;
          }
          if (btn) {
            btn.disabled = false;
            btn.textContent = '⟳ Tải lại Báo Cáo SC';
          }
          showToast(`⚡ Đã tải tức thì Báo Cáo SC từ bộ nhớ đệm (${timeLabel}).`, true);
          return;
        } else {
          BAOCAOSC_STATE = cached;
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

  // 2. Tải API trực tiếp song song (Mục 1 range A2:D14 + Mục 2 range F2:I6 + Mục 3 range K2:Q19 + Mục 4 range U2:AA5 & U7:V24)
  const urlActive = API_BAOCAOSC_ACTIVE_RATE + (API_BAOCAOSC_ACTIVE_RATE.includes('?') ? '&' : '?') + '_t=' + Date.now();
  const urlCare = API_BAOCAOSC_CARE_RATE + (API_BAOCAOSC_CARE_RATE.includes('?') ? '&' : '?') + '_t=' + Date.now();
  const urlProvince = API_BAOCAOSC_PROVINCE_IMPACT + (API_BAOCAOSC_PROVINCE_IMPACT.includes('?') ? '&' : '?') + '_t=' + Date.now();
  const urlHeadcountRegion = API_BAOCAOSC_HEADCOUNT_REGION + (API_BAOCAOSC_HEADCOUNT_REGION.includes('?') ? '&' : '?') + '_t=' + Date.now();
  const urlHeadcountProvince = API_BAOCAOSC_HEADCOUNT_PROVINCE + (API_BAOCAOSC_HEADCOUNT_PROVINCE.includes('?') ? '&' : '?') + '_t=' + Date.now();

  try {
    const [resActive, resCare, resProvince, resHeadcountRegion, resHeadcountProvince] = await Promise.all([
      safeFetchJson(urlActive, 2),
      safeFetchJson(urlCare, 2),
      safeFetchJson(urlProvince, 2),
      safeFetchJson(urlHeadcountRegion, 2),
      safeFetchJson(urlHeadcountProvince, 2)
    ]);

    if (resActive.status !== 'success' || !Array.isArray(resActive.data) || resActive.data.length < 2) {
      throw new Error(resActive.status || 'Dữ liệu Mục 1 không đầy đủ');
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    BAOCAOSC_STATE = {
      activeRate: resActive.data,
      careRate: resCare && resCare.data ? resCare.data : null,
      provinceImpact: resProvince && resProvince.data ? resProvince.data : null,
      headcountRegion: resHeadcountRegion && resHeadcountRegion.data ? resHeadcountRegion.data : null,
      headcountProvince: resHeadcountProvince && resHeadcountProvince.data ? resHeadcountProvince.data : null,
      savedAt: Date.now(),
      timeStr: timeStr
    };

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
    showToast(`Đã đồng bộ thành công Báo Cáo SC (Mục 1, 2, 3 & 4) lúc ${timeStr}!`, true);
  } catch (err) {
    console.error('Lỗi khi tải Báo Cáo SC:', err);
    if (BAOCAOSC_STATE.activeRate) {
      if (badge) {
        badge.className = 'badge b-err';
        badge.textContent = 'API bận — giữ dữ liệu cũ';
      }
      showToast('Máy chủ Google đang bận — vẫn giữ nguyên dữ liệu Báo Cáo SC hiện tại.', false);
    } else {
      if (badge) {
        badge.className = 'badge b-err';
        badge.textContent = 'Lỗi kết nối API';
      }
      showToast('Lỗi khi tải Báo Cáo SC: ' + (err.message || 'Không kết nối được'), false);
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '⟳ Tải lại Báo Cáo SC';
    }
  }
}

/**
 * Xuất file CSV UTF-8 với BOM tương thích 100% Microsoft Excel - Mục 1
 */
function exportActiveRateCsv() {
  if (!BAOCAOSC_STATE.activeRate) {
    showToast('Chưa có dữ liệu để xuất CSV!', false);
    return;
  }
  const parsed = normalizeActiveRateData(BAOCAOSC_STATE.activeRate);
  if (!parsed) return;

  const lines = [];

  // Tiêu đề
  lines.push(['BÁO CÁO SC - MỤC 1: ACTIVE RATE NĂM 2026']);
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
  a.download = `BaoCaoSC_ActiveRate_2026_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Đã xuất file CSV Active Rate (Mục 1) thành công!', true);
}

/**
 * Xuất file CSV UTF-8 với BOM tương thích 100% Microsoft Excel - Mục 2
 */
function exportCareRateCsv() {
  if (!BAOCAOSC_STATE.careRate) {
    showToast('Chưa có dữ liệu Mục 2 để xuất CSV!', false);
    return;
  }
  const parsed = normalizeCareRateData(BAOCAOSC_STATE.careRate);
  if (!parsed) return;

  const lines = [];

  // Tiêu đề
  lines.push(['BÁO CÁO SC - MỤC 2: TỶ LỆ CHĂM KHÁCH NEW T10']);
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
  a.download = `BaoCaoSC_ChamKhachNew_T10_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Đã xuất file CSV Chăm Khách New (Mục 2) thành công!', true);
}

/* ==========================================================================
   MỤC 3: IMPACT THEO TỈNH THÀNH PHỐ (SHEET 'baocaotuan', RANGE K2:Q19)
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
 * Hiển thị các thẻ KPI tóm tắt Mục 3
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
 * Hiển thị bảng chi tiết Mục 3: Impact Theo Tỉnh Thành (8 cột: STT + Tỉnh + T7..T12)
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
 * Sắp xếp bảng Mục 3
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
 * Tìm kiếm tỉnh thành ở Mục 3
 */
function onProvinceImpactSearch(val) {
  BAOCAOSC_PROVINCE_SEARCH = String(val || '').trim();
  if (BAOCAOSC_STATE.provinceImpact) {
    const parsed = normalizeProvinceImpactData(BAOCAOSC_STATE.provinceImpact);
    renderProvinceImpactTable(parsed);
  }
}

/**
 * Xuất file CSV UTF-8 với BOM tương thích 100% Microsoft Excel - Mục 3
 */
function exportProvinceImpactCsv() {
  if (!BAOCAOSC_STATE.provinceImpact) {
    showToast('Chưa có dữ liệu Mục 3 để xuất CSV!', false);
    return;
  }
  const parsed = normalizeProvinceImpactData(BAOCAOSC_STATE.provinceImpact);
  if (!parsed) return;

  const lines = [];
  lines.push(['BÁO CÁO SC - MỤC 3: IMPACT THEO TỈNH THÀNH PHỐ (T7 - T12)']);
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
  a.download = `BaoCaoSC_Impact_TinhThanh_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Đã xuất file CSV Impact Theo Tỉnh Thành (Mục 3) thành công!', true);
}

/* ==========================================================================
   MỤC 4: QUÂN SỐ ĐỘI NGŨ SC (SHEET 'baocaotuan', U2:AA5 & U7:V24)
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
 * Hiển thị các thẻ KPI tóm tắt Mục 4
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
    K('Hỗ Trợ & Thử Việc', otherVal, otherSub, 'color:#f59e0b');
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
 * Sắp xếp bảng Bảng 2 Mục 4
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
 * Tìm kiếm khu vực ở Bảng 2 Mục 4
 */
function onHeadcountProvinceSearch(val) {
  BAOCAOSC_HEADCOUNT_PROVINCE_SEARCH = String(val || '').trim();
  if (BAOCAOSC_STATE.headcountProvince) {
    const parsed = normalizeHeadcountProvinceData(BAOCAOSC_STATE.headcountProvince);
    renderHeadcountProvinceTable(parsed);
  }
}

/**
 * Xuất file CSV UTF-8 với BOM tương thích 100% Microsoft Excel - Mục 4
 */
function exportHeadcountCsv() {
  if (!BAOCAOSC_STATE.headcountRegion && !BAOCAOSC_STATE.headcountProvince) {
    showToast('Chưa có dữ liệu Mục 4 để xuất CSV!', false);
    return;
  }

  const lines = [];
  lines.push(['BÁO CÁO SC - MỤC 4: QUÂN SỐ ĐỘI NGŨ SC']);
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
  a.download = `BaoCaoSC_QuanSo_Headcount_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Đã xuất file CSV Quân Số Đội Ngũ SC (Mục 4) thành công!', true);
}
