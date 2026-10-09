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
 * Điều phối render toàn bộ Tab BÁO CÁO SC (Mục 1 & Mục 2)
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
}

/**
 * Tải dữ liệu BÁO CÁO SC từ IndexedDB hoặc API trực tiếp (Mục 1 + Mục 2 song song)
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

      if (cached && cached.activeRate && Array.isArray(cached.activeRate) && cached.activeRate.length >= 2) {
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

  // 2. Tải API trực tiếp song song (Mục 1 range A2:D14 + Mục 2 range F2:I6)
  const urlActive = API_BAOCAOSC_ACTIVE_RATE + (API_BAOCAOSC_ACTIVE_RATE.includes('?') ? '&' : '?') + '_t=' + Date.now();
  const urlCare = API_BAOCAOSC_CARE_RATE + (API_BAOCAOSC_CARE_RATE.includes('?') ? '&' : '?') + '_t=' + Date.now();

  try {
    const [resActive, resCare] = await Promise.all([
      safeFetchJson(urlActive, 2),
      safeFetchJson(urlCare, 2)
    ]);

    if (resActive.status !== 'success' || !Array.isArray(resActive.data) || resActive.data.length < 2) {
      throw new Error(resActive.status || 'Dữ liệu Mục 1 không đầy đủ');
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    BAOCAOSC_STATE = {
      activeRate: resActive.data,
      careRate: resCare && resCare.data ? resCare.data : null,
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
    showToast(`Đã đồng bộ thành công Báo Cáo SC (Mục 1 & Mục 2) lúc ${timeStr}!`, true);
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
