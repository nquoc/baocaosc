/**
 * tab_phancung.js - Logic xử lý dữ liệu và giao diện Tab 5: DS Phần Cứng
 */

function parsePcNumber(val) {
  if (val == null || val === '' || val === '-') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const s = String(val).replace(/\./g, '').replace(/,/g, '').trim();
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function parsePcPct(val) {
  if (val == null || val === '' || val === '-') return 0;
  if (typeof val === 'number') return val <= 1 ? val * 100 : val;
  const s = String(val).replace('%', '').replace(/\./g, '').replace(/,/g, '.').trim();
  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  return n <= 1 ? n * 100 : n;
}

function formatVND(num) {
  if (num == null || isNaN(num) || num === 0) return '0 ₫';
  return Math.round(num).toLocaleString('vi-VN') + ' ₫';
}

function formatVNDShort(num) {
  if (num == null || isNaN(num) || num === 0) return '0 ₫';
  if (Math.abs(num) >= 1e9) {
    return (num / 1e9).toFixed(2).replace('.', ',') + ' tỷ ₫';
  }
  if (Math.abs(num) >= 1e6) {
    return (num / 1e6).toFixed(1).replace('.', ',') + ' tr ₫';
  }
  return Math.round(num).toLocaleString('vi-VN') + ' ₫';
}

function getPcPctBadge(pct) {
  if (pct == null || isNaN(pct) || pct === 0) {
    return `<span style="display:inline-block;padding:2px 8px;border-radius:6px;font-weight:700;font-size:12px;color:var(--mut);background:rgba(148,163,184,0.12)">0%</span>`;
  }
  let color = '#ef4444';
  let bg = 'rgba(239, 68, 68, 0.16)';
  if (pct >= 80) {
    color = '#10b981';
    bg = 'rgba(16, 185, 129, 0.18)';
  } else if (pct >= 50) {
    color = '#f59e0b';
    bg = 'rgba(245, 158, 11, 0.18)';
  }
  return `<span style="display:inline-block;padding:2px 8px;border-radius:6px;font-weight:800;font-size:12px;color:${color};background:${bg}">${pct.toFixed(2)}%</span>`;
}

/**
 * Chuẩn hóa dữ liệu thô từ sheet 'phancung'
 */
function normalizePhanCungData(rawData) {
  if (!Array.isArray(rawData) || rawData.length < 12) {
    return null;
  }

  // 1. Nhận diện các cột tháng (Tháng 1 -> Tháng 12) từ Row 2 hoặc Row 10
  const monthCols = [];
  const monthLabels = [];
  const row2 = rawData[1] || [];
  for (let c = 0; c < row2.length; c++) {
    const s = String(row2[c] || '').trim();
    if (/^Tháng\s+\d+$/i.test(s)) {
      monthCols.push(c);
      monthLabels.push(s);
    }
  }

  // Fallback nếu không khớp regex
  if (monthCols.length === 0) {
    const startCol = rawData[1][2] === 'Tháng' ? 3 : 2;
    for (let c = startCol; c < startCol + 12; c++) {
      monthCols.push(c);
      monthLabels.push(String(rawData[1][c] || `Tháng ${c - startCol + 1}`).trim());
    }
  }

  // 2. Row 3: KPI tháng
  const kpiMonths = monthCols.map(c => parsePcNumber(rawData[2][c]));

  // Row 4: Đạt tháng
  const datMonths = monthCols.map(c => parsePcNumber(rawData[3][c]));

  // Row 5: % Đạt tháng
  const pctMonths = monthCols.map((c, mIdx) => {
    let p = parsePcPct(rawData[4][c]);
    if (p === 0 && kpiMonths[mIdx] > 0 && datMonths[mIdx] > 0) {
      p = (datMonths[mIdx] / kpiMonths[mIdx]) * 100;
    }
    return p;
  });

  // 3. Quý (Q1..Q4): Cột đầu tiên của mỗi quý
  const qCols = [
    monthCols[0],
    monthCols[3],
    monthCols[6],
    monthCols[9]
  ];
  const quarters = [
    { name: 'Quý 1 (T1-T3)', months: [0, 1, 2] },
    { name: 'Quý 2 (T4-T6)', months: [3, 4, 5] },
    { name: 'Quý 3 (T7-T9)', months: [6, 7, 8] },
    { name: 'Quý 4 (T10-T12)', months: [9, 10, 11] }
  ];

  quarters.forEach((q, idx) => {
    const c = qCols[idx];
    let datQ = parsePcNumber(rawData[5][c]);
    let kpiQ = parsePcNumber(rawData[6][c]);
    let pctQ = parsePcPct(rawData[7][c]);

    if (datQ === 0) {
      datQ = q.months.reduce((s, mIdx) => s + (datMonths[mIdx] || 0), 0);
    }
    if (kpiQ === 0) {
      kpiQ = q.months.reduce((s, mIdx) => s + (kpiMonths[mIdx] || 0), 0);
    }
    if (pctQ === 0 && kpiQ > 0) {
      pctQ = (datQ / kpiQ) * 100;
    }

    q.dat = datQ;
    q.kpi = kpiQ;
    q.pct = pctQ;
  });

  // 4. Table 2: Nhận diện cột Level và Tổng Doanh Số từ Row 10 (Header)
  const headerRow = rawData[9] || [];
  let levelCol = -1;
  let totalCol = headerRow.length - 1;

  for (let c = 0; c < headerRow.length; c++) {
    const h = String(headerRow[c] || '').trim().toLowerCase();
    if (h === 'level' || h.includes('định mức')) {
      levelCol = c;
    } else if (h.includes('tổng doanh số') || h === 'tổng') {
      totalCol = c;
    }
  }

  const items = [];
  let grandTotalRow = null;

  for (let r = 10; r < rawData.length; r++) {
    const row = rawData[r];
    if (!row || !row.length) continue;
    const stt = row[0] != null && String(row[0]).trim() !== '' ? parseInt(row[0], 10) : null;
    const name = String(row[1] || '').trim();
    if (!name) continue;

    const level = levelCol !== -1 ? parsePcNumber(row[levelCol]) : null;
    const rowMonths = monthCols.map(c => parsePcNumber(row[c]));
    const total = parsePcNumber(row[totalCol]);

    const isGrandTotal = name.toUpperCase() === 'TỔNG';
    const isChannel = name.startsWith('SC ') || name.includes('SC');

    const item = {
      stt: (stt != null && !isNaN(stt)) ? stt : null,
      name,
      level,
      type: isGrandTotal ? 'total' : (isChannel ? 'channel' : 'sale'),
      months: rowMonths,
      total,
      pct: 0
    };

    if (isGrandTotal) {
      grandTotalRow = item;
    } else {
      items.push(item);
    }
  }

  const grandTotal = grandTotalRow && grandTotalRow.total > 0 ? grandTotalRow.total : items.reduce((s, x) => s + x.total, 0);

  // Tính tỷ trọng % đóng góp của từng dòng
  items.forEach(it => {
    it.pct = grandTotal > 0 ? (it.total / grandTotal) * 100 : 0;
  });
  if (grandTotalRow) {
    grandTotalRow.pct = 100;
  }

  // Tổng KPI năm & Tổng Đạt năm
  const totKpiYear = kpiMonths.reduce((s, v) => s + v, 0);
  const totDatYear = (grandTotalRow && grandTotalRow.total > 0) ? grandTotalRow.total : datMonths.reduce((s, v) => s + v, 0);
  const pctDatYear = totKpiYear > 0 ? (totDatYear / totKpiYear) * 100 : 0;

  // Top 1 Sale
  const salesOnly = items.filter(it => it.type === 'sale').sort((a, b) => b.total - a.total);
  const topSale = salesOnly[0] || null;

  // Kênh SC
  const channelOnly = items.filter(it => it.type === 'channel');
  const scTotal = channelOnly.reduce((s, it) => s + it.total, 0);
  const scPct = grandTotal > 0 ? (scTotal / grandTotal) * 100 : 0;

  return {
    hasLevel: levelCol !== -1,
    monthLabels,
    kpiMonths,
    datMonths,
    pctMonths,
    quarters,
    items,
    grandTotalRow,
    grandTotal,
    totKpiYear,
    totDatYear,
    pctDatYear,
    topSale,
    channelOnly,
    scTotal,
    scPct
  };
}

/**
 * Hiển thị thẻ tóm tắt KPI
 */
function renderPhanCungSummaryCards(parsed) {
  const box = $('pcSummaryCards');
  if (!box || !parsed) return;

  const now = new Date();
  const curMonthIdx = now.getMonth(); // 0-based: 9 = Tháng 10
  const curMonthNum = curMonthIdx + 1;
  const curYear = now.getFullYear();
  const curMonthStr = `Tháng ${curMonthNum}/${curYear}`;
  const curQuarterIdx = Math.floor(curMonthIdx / 3);
  const curQuarterStr = `Quý ${curQuarterIdx + 1}/${curYear}`;
  const curQ = (parsed.quarters && parsed.quarters[curQuarterIdx]) ? parsed.quarters[curQuarterIdx] : { dat: 0, pct: 0, kpi: 0 };

  const curMonthDat = parsed.datMonths ? (parsed.datMonths[curMonthIdx] || 0) : 0;
  const curMonthKpi = parsed.kpiMonths ? (parsed.kpiMonths[curMonthIdx] || 0) : 0;
  const curMonthPct = parsed.pctMonths ? (parsed.pctMonths[curMonthIdx] || 0) : (curMonthKpi > 0 ? (curMonthDat / curMonthKpi * 100) : 0);

  const K = (l, v, s, c = '', timeTag = '') => `
    <div class="card kpi">
      <div class="l" style="display:flex;justify-content:space-between;align-items:center;gap:4px">
        <span>${l}</span>
        ${timeTag ? `<span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;background:rgba(56,189,248,0.15);color:#38bdf8;white-space:nowrap">${timeTag}</span>` : ''}
      </div>
      <div class="v" style="${c}">${v}</div>
      <div class="s">${s}</div>
    </div>`;

  const colorQ = curQ.pct >= 80 ? 'var(--ok)' : (curQ.pct >= 50 ? 'var(--warn)' : 'var(--bad)');
  const colorM = curMonthPct >= 80 ? 'var(--ok)' : (curMonthPct >= 50 ? 'var(--warn)' : 'var(--bad)');

  box.innerHTML =
    K('Tổng Doanh Số Đạt Được', formatVNDShort(parsed.totDatYear), `% Đạt toàn năm: ${parsed.pctDatYear.toFixed(2)}% · Lũy kế đến ${curMonthStr}`, 'color:#38bdf8', curMonthStr) +
    K('Tổng Chỉ Tiêu KPI Năm', formatVNDShort(parsed.totKpiYear), `Trung bình ${formatVNDShort(parsed.totKpiYear / 12)} / tháng · Năm ${curYear}`, 'color:#facc15', `Năm ${curYear}`) +
    K('Top 1 Nhân Sự Sale', parsed.topSale ? esc(parsed.topSale.name) : '–', parsed.topSale ? `${formatVNDShort(parsed.topSale.total)} (${parsed.topSale.pct.toFixed(2)}% tổng)` : '', 'color:var(--ok)', curMonthStr) +
    K('Kênh SC Đóng Góp', formatVNDShort(parsed.scTotal), `SC Toàn Quốc + MB + MN (${parsed.scPct.toFixed(2)}%)`, 'color:#a78bfa', curMonthStr) +
    K(`Tiến Độ ${curMonthStr}`, formatVNDShort(curMonthDat), `Đạt ${curMonthPct.toFixed(2)}% / KPI ${formatVNDShort(curMonthKpi)}`, 'color:' + colorM, 'Hiện tại') +
    K(`Tiến Độ ${curQuarterStr}`, formatVNDShort(curQ.dat), `Đạt ${curQ.pct.toFixed(2)}% / KPI ${formatVNDShort(curQ.kpi)}`, 'color:' + colorQ, 'Hiện tại');
}

/**
 * Vẽ Biểu đồ Chart.js
 */
function renderPhanCungCharts(parsed) {
  if (!parsed || !window.Chart) return;
  window._lastPcChartArgs = [parsed];

  const isDark = (document.body.getAttribute('data-theme') || 'dark') === 'dark';
  const gridColor = isDark ? 'rgba(148,163,184,0.12)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? '#94a3b8' : '#475569';

  // 1. Biểu đồ Combo Cột + Đường: Thực Đạt vs KPI theo 12 Tháng
  const ctxMonth = $('chPcMonth');
  if (ctxMonth) {
    if (charts.pcMonth) charts.pcMonth.destroy();
    charts.pcMonth = new Chart(ctxMonth, {
      data: {
        labels: parsed.monthLabels,
        datasets: [
          {
            type: 'bar',
            label: 'Thực Đạt',
            data: parsed.datMonths,
            backgroundColor: 'rgba(56, 189, 248, 0.75)',
            borderColor: '#38bdf8',
            borderWidth: 1.5,
            borderRadius: 6,
            order: 2
          },
          {
            type: 'line',
            label: 'Chỉ Tiêu KPI',
            data: parsed.kpiMonths,
            borderColor: '#f59e0b',
            backgroundColor: '#f59e0b',
            borderWidth: 2.5,
            borderDash: [5, 5],
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.2,
            order: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { color: textColor, font: { size: 12, weight: 'bold' } }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const val = context.raw || 0;
                const mIdx = context.dataIndex;
                const pct = parsed.pctMonths[mIdx] || 0;
                if (context.dataset.type === 'bar') {
                  return ` Thực Đạt: ${formatVND(val)} (Hoàn thành ${pct.toFixed(2)}%)`;
                }
                return ` Chỉ Tiêu KPI: ${formatVND(val)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: textColor, font: { size: 11 } }
          },
          y: {
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              callback: val => (val / 1e9).toFixed(1) + ' tỷ'
            }
          }
        }
      }
    });
  }

  // 2. Biểu đồ Doughnut: Cơ Cấu Doanh Số Theo Nhân Sự & Kênh SC
  const ctxShare = $('chPcShare');
  if (ctxShare) {
    if (charts.pcShare) charts.pcShare.destroy();

    const contributors = parsed.items.filter(it => it.total > 0).sort((a, b) => b.total - a.total);
    const labels = contributors.map(it => it.name);
    const dataVals = contributors.map(it => it.total);
    const colors = [
      '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6',
      '#06b6d4', '#14b8a6', '#f97316', '#6366f1', '#84cc16'
    ];

    charts.pcShare = new Chart(ctxShare, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: dataVals,
          backgroundColor: colors.slice(0, labels.length),
          borderColor: isDark ? '#0b111e' : '#ffffff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: textColor,
              boxWidth: 14,
              font: { size: 11 },
              padding: 10
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const it = contributors[context.dataIndex];
                return ` ${it.name}: ${formatVND(it.total)} (${it.pct.toFixed(2)}%)`;
              }
            }
          }
        },
        cutout: '62%'
      }
    });
  }
}

/**
 * Vẽ Bảng 1: Bảng KPI & Thực Đạt 12 Tháng
 */
function renderKpiMonthTable(parsed) {
  const container = $('pcMonthTableContainer');
  if (!container || !parsed) return;

  let html = '<table class="excel-table"><thead><tr>';
  html += '<th style="text-align:left;min-width:160px;background:#ffff00;color:#000;font-weight:800">Chỉ Tiêu / Thời Gian</th>';
  parsed.monthLabels.forEach(m => {
    html += `<th style="text-align:right;background:#ffff00;color:#000;font-weight:700">${esc(m)}</th>`;
  });
  html += '<th style="text-align:right;background:#ffff00;color:#000;font-weight:800">Cả Năm 2026</th>';
  html += '</tr></thead><tbody>';

  // Hàng 1: KPI Tháng
  html += '<tr>';
  html += '<td class="bold text-left" style="color:#facc15">Chỉ Tiêu KPI</td>';
  parsed.kpiMonths.forEach(v => {
    html += `<td class="text-right">${v > 0 ? esc(formatVND(v)) : '–'}</td>`;
  });
  html += `<td class="bold text-right" style="color:#facc15">${esc(formatVND(parsed.totKpiYear))}</td>`;
  html += '</tr>';

  // Hàng 2: Thực Đạt Tháng
  html += '<tr class="bold">';
  html += '<td class="text-left" style="color:#38bdf8">Thực Đạt</td>';
  parsed.datMonths.forEach(v => {
    html += `<td class="text-right">${v > 0 ? esc(formatVND(v)) : (v === 0 ? '0 ₫' : '–')}</td>`;
  });
  html += `<td class="text-right" style="color:#38bdf8">${esc(formatVND(parsed.totDatYear))}</td>`;
  html += '</tr>';

  // Hàng 3: % Đạt Tháng
  html += '<tr>';
  html += '<td class="bold text-left">% Hoàn Thành</td>';
  parsed.pctMonths.forEach(p => {
    html += `<td class="text-right">${getPcPctBadge(p)}</td>`;
  });
  html += `<td class="text-right">${getPcPctBadge(parsed.pctDatYear)}</td>`;
  html += '</tr>';

  // Header phân cách: Tiến Độ Theo Quý (Colspan 3 cho mỗi quý)
  html += '<tr style="border-top:2px solid var(--line);border-bottom:2px solid var(--line)">';
  html += '<th style="text-align:left;background:#fef08a;color:#854d0e;font-weight:800">Tiến Độ Theo Quý</th>';
  parsed.quarters.forEach(q => {
    html += `<th colspan="3" style="text-align:center;background:#fef08a;color:#854d0e;font-weight:800">${esc(q.name)}</th>`;
  });
  html += '<th style="text-align:right;background:#fef08a;color:#854d0e;font-weight:800">Tổng Cả Năm</th>';
  html += '</tr>';

  // Hàng 4: KPI Quý
  html += '<tr>';
  html += '<td class="bold text-left" style="color:#facc15">KPI Quý</td>';
  parsed.quarters.forEach(q => {
    html += `<td colspan="3" class="text-center" style="font-weight:600">${esc(formatVND(q.kpi))}</td>`;
  });
  html += `<td class="bold text-right" style="color:#facc15">${esc(formatVND(parsed.totKpiYear))}</td>`;
  html += '</tr>';

  // Hàng 5: Đạt Quý
  html += '<tr class="bold">';
  html += '<td class="text-left" style="color:#38bdf8">Đạt Quý</td>';
  parsed.quarters.forEach(q => {
    html += `<td colspan="3" class="text-center" style="color:#38bdf8">${esc(formatVND(q.dat))}</td>`;
  });
  html += `<td class="text-right" style="color:#38bdf8">${esc(formatVND(parsed.totDatYear))}</td>`;
  html += '</tr>';

  // Hàng 6: % Đạt Quý
  html += '<tr>';
  html += '<td class="bold text-left">% Hoàn Thành Quý</td>';
  parsed.quarters.forEach(q => {
    html += `<td colspan="3" class="text-center">${getPcPctBadge(q.pct)}</td>`;
  });
  html += `<td class="text-right">${getPcPctBadge(parsed.pctDatYear)}</td>`;
  html += '</tr>';

  html += '</tbody></table>';
  container.innerHTML = html;
}

function renderKpiQuarterTable(parsed) {
  // Đã gộp toàn bộ vào bảng trên để căn chỉnh 14 cột hoàn hảo
}

/**
 * Vẽ Bảng 2: Chi Tiết Doanh Số Theo Nhân Sự Sale & Kênh SC
 */
function renderSaleDetailTable(parsed) {
  const tbl = $('pcSaleTable');
  if (!tbl || !parsed) return;

  const countBox = $('pcTableCount');
  let list = [...parsed.items];

  // Tìm kiếm
  if (PHANCUNG_SEARCH) {
    const q = PHANCUNG_SEARCH.toLowerCase();
    list = list.filter(it => it.name.toLowerCase().includes(q));
  }

  if (countBox) {
    countBox.textContent = `Hiển thị ${list.length} / ${parsed.items.length} đối tượng`;
  }

  // Sắp xếp
  const { k, dir } = PHANCUNG_SORT;
  list.sort((a, b) => {
    if (k === 'stt') {
      const sA = a.stt || 999;
      const sB = b.stt || 999;
      return dir * (sA - sB);
    }
    if (k === 'name') {
      return dir * a.name.localeCompare(b.name, 'vi');
    }
    if (k === 'level') {
      return dir * ((a.level || 0) - (b.level || 0));
    }
    if (k.startsWith('m')) {
      const mIdx = parseInt(k.slice(1), 10);
      return dir * ((a.months[mIdx] || 0) - (b.months[mIdx] || 0));
    }
    if (k === 'pct' || k === 'total') {
      return dir * ((a.total || 0) - (b.total || 0));
    }
    return 0;
  });

  // 1. THEAD
  let thead = '<thead><tr>';
  const sortArrow = key => (PHANCUNG_SORT.k === key ? (PHANCUNG_SORT.dir === 1 ? ' ▲' : ' ▼') : ' ⇅');

  thead += `<th onclick="sortPhanCung('stt')" style="width:45px;cursor:pointer">STT${sortArrow('stt')}</th>`;
  thead += `<th onclick="sortPhanCung('name')" style="text-align:left;min-width:180px;cursor:pointer">Nhân Sự / Kênh SC${sortArrow('name')}</th>`;
  if (parsed.hasLevel) {
    thead += `<th onclick="sortPhanCung('level')" style="text-align:right;min-width:120px;cursor:pointer">Định Mức / Level${sortArrow('level')}</th>`;
  }

  parsed.monthLabels.forEach((m, idx) => {
    thead += `<th onclick="sortPhanCung('m${idx}')" style="text-align:right;cursor:pointer">${esc(m)}${sortArrow('m' + idx)}</th>`;
  });

  thead += `<th onclick="sortPhanCung('total')" class="kpi-final-th" style="text-align:right;min-width:130px;cursor:pointer">Tổng Doanh Số${sortArrow('total')}</th>`;
  thead += `<th onclick="sortPhanCung('pct')" style="text-align:right;width:90px;cursor:pointer">Tỷ Trọng${sortArrow('pct')}</th>`;
  thead += '</tr></thead>';

  // 2. TBODY
  let tbody = '<tbody>';
  const totalCols = (parsed.hasLevel ? 1 : 0) + parsed.monthLabels.length + 4;
  if (!list.length) {
    tbody += `<tr><td colspan="${totalCols}" style="padding:24px;text-align:center;color:var(--mut)">Không có dữ liệu phù hợp với tìm kiếm</td></tr>`;
  } else {
    list.forEach((it, idx) => {
      const isChannel = it.type === 'channel';
      const badgeType = isChannel
        ? '<span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;background:rgba(167,139,250,0.18);color:#c084fc;margin-left:6px">KÊNH</span>'
        : '<span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;background:rgba(56,189,248,0.18);color:#38bdf8;margin-left:6px">SALE</span>';

      const rowBg = isChannel ? 'background:rgba(167,139,250,0.04)' : '';

      tbody += `<tr style="${rowBg}">`;
      tbody += `<td style="color:var(--mut);text-align:center">${it.stt != null ? it.stt : '–'}</td>`;
      tbody += `<td class="sc-name" style="text-align:left">${esc(it.name)}${badgeType}</td>`;

      if (parsed.hasLevel) {
        const lvlTxt = it.level > 0 ? formatVNDShort(it.level) : '<span style="color:var(--mut);opacity:0.5">–</span>';
        tbody += `<td style="text-align:right;font-weight:600;color:var(--tx-heading)">${lvlTxt}</td>`;
      }

      it.months.forEach(val => {
        const txt = val > 0 ? formatVND(val) : '<span style="color:var(--mut);opacity:0.6">–</span>';
        tbody += `<td style="text-align:right">${txt}</td>`;
      });

      tbody += `<td class="kpi-final-col" style="text-align:right;color:#38bdf8">${esc(formatVND(it.total))}</td>`;
      tbody += `<td style="text-align:right;font-weight:700">${it.pct.toFixed(2)}%</td>`;
      tbody += '</tr>';
    });
  }
  tbody += '</tbody>';

  // 3. TFOOT (Hàng TỔNG)
  let tfoot = '';
  if (parsed.grandTotalRow) {
    const gt = parsed.grandTotalRow;
    tfoot += '<tfoot><tr>';
    tfoot += '<td style="text-align:center">★</td>';
    tfoot += '<td class="sc-name" style="text-align:left;color:var(--acc)">TỔNG TOÀN BỘ</td>';
    if (parsed.hasLevel) {
      const gtLvl = gt.level > 0 ? formatVNDShort(gt.level) : '–';
      tfoot += `<td style="text-align:right;color:#facc15;font-weight:800">${gtLvl}</td>`;
    }
    gt.months.forEach(val => {
      tfoot += `<td style="text-align:right;color:var(--tx-heading)">${val > 0 ? esc(formatVND(val)) : '–'}</td>`;
    });
    tfoot += `<td class="kpi-final-col" style="text-align:right;color:#38bdf8;font-size:14px">${esc(formatVND(gt.total))}</td>`;
    tfoot += '<td style="text-align:right;color:var(--acc)">100%</td>';
    tfoot += '</tr></tfoot>';
  }

  tbl.innerHTML = thead + tbody + tfoot;
}

/**
 * Xử lý sự kiện sắp xếp bảng
 */
function sortPhanCung(colKey) {
  if (PHANCUNG_SORT.k === colKey) {
    PHANCUNG_SORT.dir = -PHANCUNG_SORT.dir;
  } else {
    PHANCUNG_SORT.k = colKey;
    PHANCUNG_SORT.dir = colKey === 'name' || colKey === 'stt' ? 1 : -1;
  }
  if (PHANCUNG_STATE.data) {
    const parsed = normalizePhanCungData(PHANCUNG_STATE.data);
    renderSaleDetailTable(parsed);
  }
}

/**
 * Lắng nghe ô tìm kiếm
 */
function onPhanCungSearch(val) {
  PHANCUNG_SEARCH = String(val || '').trim();
  if (PHANCUNG_STATE.data) {
    const parsed = normalizePhanCungData(PHANCUNG_STATE.data);
    renderSaleDetailTable(parsed);
  }
}

/**
 * Điều phối render toàn bộ Tab DS Phần Cứng
 */
function renderPhanCung() {
  if (!PHANCUNG_STATE.data) return;
  const parsed = normalizePhanCungData(PHANCUNG_STATE.data);
  if (!parsed) {
    showToast('Dữ liệu DS Phần Cứng chưa hoàn chỉnh!', false);
    return;
  }

  renderPhanCungSummaryCards(parsed);
  renderPhanCungCharts(parsed);
  renderKpiMonthTable(parsed);
  renderKpiQuarterTable(parsed);
  renderSaleDetailTable(parsed);
  renderPhanCungOct();
  renderPhanCungSource();
}

/**
 * Tải dữ liệu DS Phần Cứng từ IndexedDB hoặc API trực tiếp (Mục 1, Mục 2, Mục 3)
 */
async function loadPhanCung(forceReload = false, isSilent = false) {
  const btn = $('btnReloadPhanCung');
  const badge = $('phancungSrcBadge');

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
      const [cachedYear, cachedOct, cachedSource] = await Promise.all([
        new Promise(resolve => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const req = tx.objectStore(STORE_NAME).get(CACHE_KEY_PHANCUNG);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        }),
        new Promise(resolve => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const req = tx.objectStore(STORE_NAME).get(CACHE_KEY_PHANCUNG_OCT);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        }),
        new Promise(resolve => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const req = tx.objectStore(STORE_NAME).get(CACHE_KEY_PHANCUNG_SOURCE);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        })
      ]);

      if (cachedYear && cachedYear.data && Array.isArray(cachedYear.data) && cachedYear.data.length >= 12 &&
          cachedSource && cachedSource.data && Array.isArray(cachedSource.data) && cachedSource.data.length >= 2) {
        const ageMs = Date.now() - (cachedYear.savedAt || 0);
        const minsAgo = Math.max(0, Math.floor(ageMs / 60000));
        const timeLabel = minsAgo === 0 ? 'vừa xong' : `${minsAgo} phút trước`;

        PHANCUNG_STATE = cachedYear;
        if (cachedOct && cachedOct.data) PHANCUNG_OCT_STATE = cachedOct;
        PHANCUNG_SOURCE_STATE = cachedSource;

        if (ageMs < CACHE_TTL_MS) {
          renderPhanCung();
          if (badge) {
            badge.className = 'badge b-cache';
            badge.textContent = `Bộ nhớ đệm (${timeLabel})`;
          }
          if (btn) {
            btn.disabled = false;
            btn.textContent = '⟳ Tải lại DS Phần Cứng';
          }
          if (!isSilent) {
            showToast(`⚡ Đã tải tức thì DS Phần Cứng (Mục 1, 2 & 3) từ bộ nhớ đệm (${timeLabel}).`, true);
          }
          return;
        } else {
          // Hiển thị tạm cache cũ và tải ngầm
          PHANCUNG_STATE = cachedYear;
          if (cachedOct && cachedOct.data) PHANCUNG_OCT_STATE = cachedOct;
          PHANCUNG_SOURCE_STATE = cachedSource;
          renderPhanCung();
          if (badge) {
            badge.className = 'badge b-load';
            badge.textContent = `Bộ nhớ đệm cũ (${timeLabel}) · Đang cập nhật…`;
          }
        }
      }
    } catch (e) {
      console.warn('Lỗi kiểm tra cache phancung:', e);
    }
  }

  // 2. Tải API trực tiếp song song (Mục 1 sheet phancung + Mục 2 sheet opp + Mục 3 sheet phancung T1:W9)
  const urlYear = API_PHANCUNG + (API_PHANCUNG.includes('?') ? '&' : '?') + '_t=' + Date.now();
  const urlOct = API_PHANCUNG_OCT + (API_PHANCUNG_OCT.includes('?') ? '&' : '?') + '_t=' + Date.now();
  const urlSource = API_PHANCUNG_SOURCE + (API_PHANCUNG_SOURCE.includes('?') ? '&' : '?') + '_t=' + Date.now();
  try {
    const [resYear, resOct, resSource] = await Promise.all([
      safeFetchJson(urlYear, 2),
      safeFetchJson(urlOct, 2),
      safeFetchJson(urlSource, 2)
    ]);

    if (resYear.status !== 'success' || !Array.isArray(resYear.data) || resYear.data.length < 12) {
      throw new Error(resYear.status || 'Dữ liệu Mục 1 không đầy đủ');
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    PHANCUNG_STATE = {
      data: resYear.data,
      savedAt: Date.now(),
      timeStr: timeStr
    };

    if (resOct && resOct.status === 'success' && Array.isArray(resOct.data) && resOct.data.length >= 2) {
      PHANCUNG_OCT_STATE = {
        data: resOct.data,
        savedAt: Date.now(),
        timeStr: timeStr
      };
    }

    if (resSource && resSource.status === 'success' && Array.isArray(resSource.data) && resSource.data.length >= 2) {
      PHANCUNG_SOURCE_STATE = {
        data: resSource.data,
        savedAt: Date.now(),
        timeStr: timeStr
      };
    }

    // Lưu IndexedDB
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(PHANCUNG_STATE, CACHE_KEY_PHANCUNG);
      if (PHANCUNG_OCT_STATE.data) {
        tx.objectStore(STORE_NAME).put(PHANCUNG_OCT_STATE, CACHE_KEY_PHANCUNG_OCT);
      }
      if (PHANCUNG_SOURCE_STATE.data) {
        tx.objectStore(STORE_NAME).put(PHANCUNG_SOURCE_STATE, CACHE_KEY_PHANCUNG_SOURCE);
      }
    } catch (e) {}

    renderPhanCung();
    if (badge) {
      badge.className = 'badge b-live';
      badge.textContent = `API trực tiếp ${timeStr}`;
    }
    if (!isSilent) {
      showToast(`Đã đồng bộ thành công DS Phần Cứng (Mục 1, 2 & 3) lúc ${timeStr}!`, true);
    }
  } catch (err) {
    console.error('Lỗi khi tải DS Phần Cứng:', err);
    if (PHANCUNG_STATE.data) {
      if (badge) {
        badge.className = 'badge b-err';
        badge.textContent = 'API bận — giữ dữ liệu cũ';
      }
      if (!isSilent) showToast('Máy chủ Google đang bận — vẫn giữ nguyên dữ liệu Phần Cứng hiện tại.', false);
    } else {
      if (badge) {
        badge.className = 'badge b-err';
        badge.textContent = 'Lỗi kết nối API';
      }
      if (!isSilent) showToast('Lỗi khi tải DS Phần Cứng: ' + (err.message || 'Không kết nối được'), false);
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '⟳ Tải lại DS Phần Cứng';
    }
  }
}

/**
 * Xuất file CSV UTF-8 với BOM tương thích 100% Microsoft Excel
 */
function exportPhanCungCsv() {
  if (!PHANCUNG_STATE.data) {
    showToast('Chưa có dữ liệu để xuất CSV!', false);
    return;
  }
  const parsed = normalizePhanCungData(PHANCUNG_STATE.data);
  if (!parsed) return;

  const lines = [];

  // 1. Header Bảng KPI
  lines.push(['BÁO CÁO KPI PHẦN CỨNG 2026']);
  lines.push(['Chỉ Tiêu / Tháng', ...parsed.monthLabels, 'Tổng Năm']);
  lines.push(['KPI', ...parsed.kpiMonths.map(v => v || 0), parsed.totKpiYear]);
  lines.push(['Thực Đạt', ...parsed.datMonths.map(v => v || 0), parsed.totDatYear]);
  lines.push(['% Hoàn Thành', ...parsed.pctMonths.map(p => (p || 0).toFixed(2) + '%'), parsed.pctDatYear.toFixed(2) + '%']);
  lines.push([]);

  // 2. Header Bảng Quý
  lines.push(['TIẾN ĐỘ THEO QUÝ 2026']);
  lines.push(['Chỉ Tiêu', ...parsed.quarters.map(q => q.name), 'Tổng Năm']);
  lines.push(['KPI Quý', ...parsed.quarters.map(q => q.kpi), parsed.totKpiYear]);
  lines.push(['Đạt Quý', ...parsed.quarters.map(q => q.dat), parsed.totDatYear]);
  lines.push(['% Hoàn Thành', ...parsed.quarters.map(q => q.pct.toFixed(2) + '%'), parsed.pctDatYear.toFixed(2) + '%']);
  lines.push([]);

  // 3. Header Bảng Chi Tiết Sale
  lines.push(['DOANH SỐ CHI TIẾT THEO NHÂN SỰ SALE & KÊNH SC']);
  const t2Headers = ['STT', 'Nhân Sự / Kênh SC'];
  if (parsed.hasLevel) t2Headers.push('Định Mức / Level');
  t2Headers.push(...parsed.monthLabels, 'Tổng Doanh Số', 'Tỷ Trọng (%)');
  lines.push(t2Headers);

  parsed.items.forEach(it => {
    const row = [it.stt != null ? it.stt : '', it.name];
    if (parsed.hasLevel) row.push(it.level > 0 ? it.level : '');
    row.push(...it.months, it.total, it.pct.toFixed(2) + '%');
    lines.push(row);
  });
  if (parsed.grandTotalRow) {
    const gt = parsed.grandTotalRow;
    const row = ['', gt.name];
    if (parsed.hasLevel) row.push(gt.level > 0 ? gt.level : '');
    row.push(...gt.months, gt.total, '100%');
    lines.push(row);
  }

  const csvContent = '\ufeff' + lines.map(row => {
    return row.map(val => {
      const s = String(val == null ? '' : val);
      return '"' + s.replace(/"/g, '""') + '"';
    }).join(',');
  }).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `doanh_so_phan_cung_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  showToast('Đã xuất thành công file CSV Doanh số Phần Cứng (Mục 1)!', true);
}

/* ==========================================================================
   MỤC 2: CHI TIẾT PHẦN CỨNG THÁNG 10 (MA TRẬN TÌNH TRẠNG × NHÓM)
   ========================================================================== */

/**
 * Rút gọn tên nhóm nhân sự để vừa vặn tiêu đề cột bảng
 */
function getShortGroupName(nhom) {
  if (!nhom) return { title: 'Khác', sub: '' };
  const s = String(nhom).trim();
  const parts = s.split('-').map(p => p.trim());
  if (parts.length >= 3) {
    const code = parts[0];
    const name = parts[1];
    const dept = parts.slice(2).join(' · ');
    return { title: name, sub: `${code} · ${dept}` };
  }
  if (parts.length === 2) {
    return { title: parts[1], sub: parts[0] };
  }
  return { title: s, sub: '' };
}

/**
 * Badge trạng thái đơn cơ hội
 */
function getOctStatusBadge(st) {
  const s = String(st || '').trim();
  if (s === 'Thành công') {
    return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:6px;font-weight:800;font-size:12px;color:#10b981;background:rgba(16,185,129,0.18);border:1px solid rgba(16,185,129,0.3)">✓ Thành công</span>`;
  }
  if (s === 'KH đã thanh toán') {
    return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:6px;font-weight:800;font-size:12px;color:#0ea5e9;background:rgba(14,165,233,0.18);border:1px solid rgba(14,165,233,0.3)">💳 KH đã thanh toán</span>`;
  }
  if (s === 'Chờ Xét Duyệt') {
    return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:6px;font-weight:800;font-size:12px;color:#f59e0b;background:rgba(245,158,11,0.18);border:1px solid rgba(245,158,11,0.3)">⏳ Chờ Xét Duyệt</span>`;
  }
  if (s === 'Bán hàng') {
    return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:6px;font-weight:800;font-size:12px;color:#a855f7;background:rgba(168,85,247,0.18);border:1px solid rgba(168,85,247,0.3)">🛒 Bán hàng</span>`;
  }
  return `<span style="display:inline-block;padding:3px 8px;border-radius:6px;font-weight:700;font-size:12px;color:var(--mut);background:rgba(148,163,184,0.15)">${esc(s)}</span>`;
}

/**
 * Định dạng ô ma trận: SL: {count} / {val ₫}
 */
function formatPivotCell(count, val) {
  if (!count && !val) {
    return '<span style="color:var(--mut);opacity:0.45">–</span>';
  }
  const valStr = formatVND(val);
  return `<div style="font-weight:600;font-size:12.5px;line-height:1.35;white-space:nowrap">
    <span style="color:var(--mut);font-size:11px;font-weight:600">SL:</span> <b style="font-weight:800;color:var(--tx-heading);font-size:13px">${count}</b> <span style="color:var(--mut);font-weight:600;margin:0 3px">/</span> <span style="color:${val > 0 ? '#38bdf8' : 'var(--mut)'};font-weight:700">${valStr}</span>
  </div>`;
}

/**
 * Chuẩn hóa dữ liệu thô sheet 'opp' (Mục 2 Phần Cứng Tháng 10)
 */
function normalizePhanCungOctData(rawData) {
  if (!Array.isArray(rawData) || rawData.length < 2) return null;

  const headers = rawData[0].map(h => String(h || '').trim());
  let colStatus = headers.findIndex(h => h.toLowerCase() === 'tình trạng');
  let colNhom = headers.findIndex(h => h.toLowerCase() === 'nhóm');
  let colTienVal = headers.findIndex(h => h.toLowerCase() === 'thành tiền value');
  let colTienStr = headers.findIndex(h => h.toLowerCase() === 'thành tiền');

  if (colStatus === -1) colStatus = 10;
  if (colNhom === -1) colNhom = 16;
  if (colTienVal === -1) colTienVal = 17;
  if (colTienStr === -1) colTienStr = 6;

  const records = [];
  const statusSet = new Set();
  const groupSet = new Set();
  const groupTotals = {};
  const statusTotals = {};
  const matrix = {};

  for (let r = 1; r < rawData.length; r++) {
    const row = rawData[r];
    if (!row || !row.length) continue;

    const st = String(row[colStatus] || '').trim();
    const gp = String(row[colNhom] || '').trim();
    if (!st && !gp) continue;

    let val = 0;
    if (colTienVal !== -1 && row[colTienVal] != null && String(row[colTienVal]).trim() !== '') {
      val = parsePcNumber(row[colTienVal]);
    } else if (colTienStr !== -1 && row[colTienStr] != null) {
      val = parsePcNumber(row[colTienStr]);
    }

    const safeSt = st || 'Chưa phân loại';
    const safeGp = gp || 'Khác';

    statusSet.add(safeSt);
    groupSet.add(safeGp);

    if (!matrix[safeSt]) matrix[safeSt] = {};
    if (!matrix[safeSt][safeGp]) matrix[safeSt][safeGp] = { count: 0, val: 0, records: [] };
    matrix[safeSt][safeGp].count += 1;
    matrix[safeSt][safeGp].val += val;
    matrix[safeSt][safeGp].records.push(row);

    if (!statusTotals[safeSt]) statusTotals[safeSt] = { count: 0, val: 0 };
    statusTotals[safeSt].count += 1;
    statusTotals[safeSt].val += val;

    if (!groupTotals[safeGp]) groupTotals[safeGp] = { count: 0, val: 0 };
    groupTotals[safeGp].count += 1;
    groupTotals[safeGp].val += val;

    records.push({
      status: safeSt,
      group: safeGp,
      val: val,
      raw: row
    });
  }

  // Thứ tự tình trạng nghiệp vụ chuẩn
  const preferredStatuses = ['Thành công', 'KH đã thanh toán', 'Chờ Xét Duyệt', 'Bán hàng'];
  const statuses = Array.from(statusSet).sort((a, b) => {
    const ia = preferredStatuses.indexOf(a);
    const ib = preferredStatuses.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b, 'vi');
  });

  // Thứ tự nhóm: Doanh số cao nhất xếp trước
  const groups = Array.from(groupSet).sort((a, b) => {
    const va = groupTotals[a]?.val || 0;
    const vb = groupTotals[b]?.val || 0;
    if (vb !== va) return vb - va;
    const ca = groupTotals[a]?.count || 0;
    const cb = groupTotals[b]?.count || 0;
    return cb - ca;
  });

  const grandTotal = {
    count: records.length,
    val: records.reduce((s, r) => s + r.val, 0)
  };

  return {
    headers,
    records,
    statuses,
    groups,
    matrix,
    statusTotals,
    groupTotals,
    grandTotal,
    rawData
  };
}

/**
 * Hiển thị thẻ tóm tắt KPI Mục 2
 */
function renderPhanCungOctSummaryCards(parsedOct) {
  const box = $('pcOctSummaryCards');
  if (!box || !parsedOct) return;

  const now = new Date();
  const curMonthNum = now.getMonth() + 1;
  const curYear = now.getFullYear();
  const curMonthStr = `Tháng ${curMonthNum}/${curYear}`;

  const K = (l, v, s, c = '', timeTag = curMonthStr) => `
    <div class="card kpi">
      <div class="l" style="display:flex;justify-content:space-between;align-items:center;gap:4px">
        <span>${l}</span>
        ${timeTag ? `<span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;background:rgba(16,185,129,0.15);color:#10b981;white-space:nowrap">${timeTag}</span>` : ''}
      </div>
      <div class="v" style="${c}">${v}</div>
      <div class="s">${s}</div>
    </div>`;

  const gt = parsedOct.grandTotal;
  const tc = parsedOct.statusTotals['Thành công'] || { count: 0, val: 0 };
  const tt = parsedOct.statusTotals['KH đã thanh toán'] || { count: 0, val: 0 };
  const cxd = parsedOct.statusTotals['Chờ Xét Duyệt'] || { count: 0, val: 0 };
  const bh = parsedOct.statusTotals['Bán hàng'] || { count: 0, val: 0 };

  const tcPct = gt.val > 0 ? (tc.val / gt.val * 100).toFixed(1) : '0';
  const cxdPct = gt.val > 0 ? (cxd.val / gt.val * 100).toFixed(1) : '0';

  box.innerHTML =
    K(`Tổng Cơ Hội ${curMonthStr}`, `${gt.count} đơn`, `Tổng giá trị: ${formatVND(gt.val)} · Mốc hiện tại`, 'color:#38bdf8', 'Hiện tại') +
    K('Thành Công (Đã Chốt)', `${tc.count} đơn`, `${formatVND(tc.val)} (${tcPct}% tổng)`, 'color:#10b981', curMonthStr) +
    K('KH Đã Thanh Toán', `${tt.count} đơn`, `${formatVND(tt.val)}`, 'color:#0ea5e9', curMonthStr) +
    K('Chờ Xét Duyệt', `${cxd.count} đơn`, `${formatVND(cxd.val)} (${cxdPct}% tổng)`, 'color:#f59e0b', curMonthStr) +
    K('Đang Bán Hàng / Tư Vấn', `${bh.count} đơn`, `${formatVND(bh.val)}`, 'color:#a855f7', curMonthStr);
}

/**
 * Render bảng ma trận Pivot: Dòng là Nhóm, Cột là Tình trạng
 */
function renderPhanCungOctPivotTable(parsedOct) {
  const tbl = $('pcOctPivotTable');
  if (!tbl || !parsedOct) return;

  const { statuses, groups, matrix, statusTotals, groupTotals, grandTotal } = parsedOct;

  // 1. THEAD (Cột là Tình trạng)
  let thead = '<thead><tr>';
  thead += '<th style="min-width:180px;text-align:center">NHÓM / NHÂN SỰ</th>';
  statuses.forEach(st => {
    thead += `<th style="min-width:150px;padding:9px 8px;text-align:center">
      <div>${getOctStatusBadge(st)}</div>
    </th>`;
  });
  thead += '<th class="kpi-final-col" style="min-width:150px;color:#38bdf8;text-align:center">TỔNG CỘNG</th>';
  thead += '</tr></thead>';

  // 2. TBODY (Dòng là Nhóm)
  let tbody = '<tbody>';
  groups.forEach(gp => {
    const meta = getShortGroupName(gp);
    tbody += '<tr>';
    // Cột 1: Tên Nhóm
    tbody += `<td class="sc-name" title="${esc(gp)}" style="text-align:center;padding:10px 8px">
      <div style="font-weight:800;font-size:13px;color:var(--tx-heading)">${esc(meta.title)}</div>
      ${meta.sub ? `<div style="font-size:10.5px;font-weight:600;opacity:0.75;margin-top:2px;color:var(--mut)">${esc(meta.sub)}</div>` : ''}
    </td>`;

    // Các cột Tình trạng
    statuses.forEach(st => {
      const cell = matrix[st]?.[gp] || { count: 0, val: 0 };
      const safeSt = st.replace(/'/g, "\\'");
      const safeGp = gp.replace(/'/g, "\\'");
      const clickAttr = cell.count > 0 ? `onclick="openPhanCungOctCellModal('${safeSt}', '${safeGp}')" style="cursor:pointer" title="Bấm để xem ${cell.count} đơn chi tiết"` : '';
      tbody += `<td ${clickAttr}>${formatPivotCell(cell.count, cell.val)}</td>`;
    });

    // Cột Tổng cộng của từng Nhóm
    const gpTot = groupTotals[gp] || { count: 0, val: 0 };
    const safeGpTot = gp.replace(/'/g, "\\'");
    const clickGpTot = gpTot.count > 0 ? `onclick="openPhanCungOctCellModal('', '${safeGpTot}')" style="cursor:pointer" title="Bấm để xem tất cả ${gpTot.count} đơn của nhóm"` : '';
    tbody += `<td class="kpi-final-col" style="font-weight:700" ${clickGpTot}>${formatPivotCell(gpTot.count, gpTot.val)}</td>`;
    tbody += '</tr>';
  });
  tbody += '</tbody>';

  // 3. TFOOT (Hàng Tổng cộng theo từng Tình trạng)
  let tfoot = '<tfoot><tr>';
  tfoot += '<td class="sc-name" style="color:var(--acc);font-weight:800;text-align:center">TỔNG CỘNG</td>';
  statuses.forEach(st => {
    const stTot = statusTotals[st] || { count: 0, val: 0 };
    const safeSt = st.replace(/'/g, "\\'");
    const clickStTot = stTot.count > 0 ? `onclick="openPhanCungOctCellModal('${safeSt}', '')" style="cursor:pointer" title="Bấm để xem tất cả ${stTot.count} đơn ${esc(st)}"` : '';
    tfoot += `<td style="font-weight:800" ${clickStTot}>${formatPivotCell(stTot.count, stTot.val)}</td>`;
  });
  const clickAll = grandTotal.count > 0 ? `onclick="openPhanCungOctCellModal('', '')" style="cursor:pointer" title="Bấm để xem toàn bộ ${grandTotal.count} đơn tháng 10"` : '';
  tfoot += `<td class="kpi-final-col" style="color:#38bdf8;font-weight:800;background:rgba(56,189,248,0.12)" ${clickAll}>${formatPivotCell(grandTotal.count, grandTotal.val)}</td>`;
  tfoot += '</tr></tfoot>';

  tbl.innerHTML = thead + tbody + tfoot;
}

/**
 * Hiển thị Modal chi tiết khi bấm vào một ô trong Ma Trận
 */
function openPhanCungOctCellModal(st, gp) {
  if (!PHANCUNG_OCT_STATE.data) return;
  const parsed = normalizePhanCungOctData(PHANCUNG_OCT_STATE.data);
  if (!parsed) return;

  let filtered = parsed.records;
  let titleStr = '';

  if (st && gp) {
    filtered = filtered.filter(r => r.status === st && r.group === gp);
    const meta = getShortGroupName(gp);
    titleStr = `${st} · ${meta.title}`;
  } else if (st && !gp) {
    filtered = filtered.filter(r => r.status === st);
    titleStr = `${st} (Tất cả các nhóm)`;
  } else if (!st && gp) {
    filtered = filtered.filter(r => r.group === gp);
    const meta = getShortGroupName(gp);
    titleStr = `${meta.title} (Tất cả tình trạng)`;
  } else {
    titleStr = 'Tất cả cơ hội phần cứng Tháng 10';
  }

  const totVal = filtered.reduce((s, r) => s + r.val, 0);

  const m = $('cardListModal');
  const t = $('mTitle');
  const s = $('mSubtitle');
  const body = $('mCardList');
  if (!m || !t || !body) return;

  t.textContent = titleStr;
  if (s) s.textContent = `${filtered.length} cơ hội · Tổng giá trị: ${formatVND(totVal)}`;

  if (filtered.length === 0) {
    body.innerHTML = '<div style="text-align:center;padding:30px;color:var(--mut)">Không có dữ liệu đơn nào.</div>';
  } else {
    body.innerHTML = filtered.map((item, idx) => {
      const r = item.raw;
      const recordId = r[0] || '–';
      const shopName = r[1] || '–';
      const retId = r[2] || '–';
      const custName = r[3] || '–';
      const creator = r[4] || '–';
      const createdTime = r[5] || '–';
      const dateConfirm = r[8] || '–';
      const oppType = r[9] || '–';
      const status = r[10] || '–';
      const industry = r[11] || '–';
      const custType = r[12] || '–';
      const province = r[13] || '–';
      const handler = r[15] || '–';
      const groupName = r[16] || '–';
      const valStr = formatVND(item.val);

      return `
        <div class="card" style="margin-bottom:10px;padding:12px 14px;border:1px solid var(--line);background:var(--card-sub, var(--card));border-radius:8px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:6px">
            <div>
              <div style="font-weight:700;font-size:14px;color:var(--tx-heading)">
                ${idx + 1}. ${esc(shopName)} <span style="font-size:12px;color:var(--acc);font-weight:600">(${esc(retId)})</span>
              </div>
              <div class="mut sm" style="margin-top:2px">
                KH: <b>${esc(custName)}</b> · ${esc(province)} · Ngành: ${esc(industry)}
              </div>
            </div>
            <div style="text-align:right;white-space:nowrap">
              <div style="font-size:14px;font-weight:800;color:#38bdf8">${valStr}</div>
              <div style="margin-top:3px">${getOctStatusBadge(status)}</div>
            </div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:10px;font-size:11.5px;color:var(--mut);border-top:1px dashed var(--line);padding-top:6px;margin-top:6px">
            <span>👤 Người tạo: <b>${esc(creator)}</b></span>
            <span>🛠 Xử lý: <b>${esc(handler)}</b></span>
            <span>👥 Nhóm: <b>${esc(groupName)}</b></span>
            <span>📅 Tạo: ${esc(createdTime)}</span>
            ${dateConfirm && dateConfirm !== '–' ? `<span>✓ Xác nhận: ${esc(dateConfirm)}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  m.style.display = 'flex';
}

/**
 * Trạng thái lọc, phân nhóm và sắp xếp bảng chi tiết DVKH Manager
 */
let DVKH_SORT = { k: 'stt', dir: 1 };
let DVKH_SEARCH = '';
let DVKH_SELECTED_REGION = 'all'; // 'all' hoặc tên khu vực cụ thể
let DVKH_EXPANDED_REGIONS = {};   // Lưu trạng thái mở/đóng của từng khu vực: { [kv]: boolean }

function sortPhanCungDvkh(colKey) {
  if (DVKH_SORT.k === colKey) {
    DVKH_SORT.dir = -DVKH_SORT.dir;
  } else {
    DVKH_SORT.k = colKey;
    DVKH_SORT.dir = (colKey === 'val' || colKey === 'stt') ? (colKey === 'val' ? -1 : 1) : 1;
  }
  renderPhanCungDvkhManager();
}

function onPhanCungDvkhSearch(val) {
  DVKH_SEARCH = (val || '').trim().toLowerCase();
  renderPhanCungDvkhManager();
}

function onSelectDvkhRegion(regionName) {
  if (DVKH_SELECTED_REGION === regionName && regionName !== 'all') {
    DVKH_SELECTED_REGION = 'all';
  } else {
    DVKH_SELECTED_REGION = regionName;
    if (regionName !== 'all') {
      DVKH_EXPANDED_REGIONS[regionName] = true;
    }
  }
  renderPhanCungDvkhManager();
}

function toggleDvkhRegion(regionName) {
  DVKH_EXPANDED_REGIONS[regionName] = !DVKH_EXPANDED_REGIONS[regionName];
  renderPhanCungDvkhManager();
}

function expandAllDvkhRegions(shouldExpand) {
  if (PHANCUNG_OCT_STATE.data && PHANCUNG_OCT_STATE.data.length > 1) {
    const rawData = PHANCUNG_OCT_STATE.data;
    const headers = rawData[0].map(h => String(h || '').trim());
    let colNhom = headers.findIndex(h => h.toLowerCase() === 'nhóm');
    let colKhuVuc = headers.findIndex(h => h.toLowerCase() === 'khu vực');
    if (colNhom === -1) colNhom = 16;
    if (colKhuVuc === -1) colKhuVuc = 14;

    for (let r = 1; r < rawData.length; r++) {
      const row = rawData[r];
      if (!row) continue;
      const nhom = String(row[colNhom] || '').trim();
      if (!/dvkh\s*manager/i.test(nhom)) continue;
      const kv = String(row[colKhuVuc] || 'Khác').trim() || 'Khác';
      DVKH_EXPANDED_REGIONS[kv] = shouldExpand;
    }
  }
  renderPhanCungDvkhManager();
}

/**
 * Render Bảng Chi Tiết Cơ Hội Nhóm DVKH Manager (Nhóm theo Khu Vực)
 */
function renderPhanCungDvkhManager(parsedOct) {
  const tbl = $('pcDvkhTable');
  const countBadge = $('pcDvkhCount');
  const pillsBox = $('pcDvkhRegionPills');
  if (!tbl) return;

  if (!PHANCUNG_OCT_STATE.data || !Array.isArray(PHANCUNG_OCT_STATE.data) || PHANCUNG_OCT_STATE.data.length < 2) {
    tbl.innerHTML = '<tbody><tr><td colspan="8" style="padding:20px;text-align:center;color:var(--mut)">Chưa có dữ liệu cơ hội phần cứng.</td></tr></tbody>';
    if (countBadge) countBadge.textContent = '0';
    if (pillsBox) pillsBox.innerHTML = '';
    return;
  }

  const rawData = PHANCUNG_OCT_STATE.data;
  const headers = rawData[0].map(h => String(h || '').trim());
  let colStatus = headers.findIndex(h => h.toLowerCase() === 'tình trạng');
  let colNhom = headers.findIndex(h => h.toLowerCase() === 'nhóm');
  let colTenGh = headers.findIndex(h => h.toLowerCase() === 'tên gian hàng');
  let colRetailerId = headers.findIndex(h => h.toLowerCase() === 'retailer id');
  let colNguoiTao = headers.findIndex(h => h.toLowerCase() === 'người tạo');
  let colNgayTao = headers.findIndex(h => h.toLowerCase() === 'thời gian tạo' || h.toLowerCase() === 'ngày tạo');
  let colKhuVuc = headers.findIndex(h => h.toLowerCase() === 'khu vực');
  let colTinhTp = headers.findIndex(h => h.toLowerCase() === 'tỉnh/thành phố' || h.toLowerCase() === 'tỉnh thành phố' || h.toLowerCase() === 'tỉnh/thành');
  let colTienVal = headers.findIndex(h => h.toLowerCase() === 'thành tiền value');
  let colTienStr = headers.findIndex(h => h.toLowerCase() === 'thành tiền');

  if (colStatus === -1) colStatus = 10;
  if (colNhom === -1) colNhom = 16;
  if (colTenGh === -1) colTenGh = 1;
  if (colRetailerId === -1) colRetailerId = 2;
  if (colNguoiTao === -1) colNguoiTao = 4;
  if (colNgayTao === -1) colNgayTao = 5;
  if (colTinhTp === -1) colTinhTp = 13;
  if (colKhuVuc === -1) colKhuVuc = 14;
  if (colTienVal === -1) colTienVal = 17;
  if (colTienStr === -1) colTienStr = 6;

  // Lọc các bản ghi thuộc nhóm DVKH Manager
  const allDvkh = [];
  for (let r = 1; r < rawData.length; r++) {
    const row = rawData[r];
    if (!row || !row.length) continue;
    const nhom = String(row[colNhom] || '').trim();
    if (!/dvkh\s*manager/i.test(nhom)) continue;

    let val = 0;
    if (colTienVal !== -1 && row[colTienVal] != null && String(row[colTienVal]).trim() !== '') {
      val = parsePcNumber(row[colTienVal]);
    } else if (colTienStr !== -1 && row[colTienStr] != null) {
      val = parsePcNumber(row[colTienStr]);
    }

    const kv = String(row[colKhuVuc] || '').trim() || 'Chưa phân loại';

    allDvkh.push({
      origIdx: r,
      tenGh: String(row[colTenGh] || '–').trim(),
      retailerId: String(row[colRetailerId] || '–').trim(),
      ngayTao: String(row[colNgayTao] || '–').trim(),
      nguoiTao: String(row[colNguoiTao] || '–').trim(),
      khuVuc: kv,
      tinhTp: String(row[colTinhTp] || '–').trim(),
      tinhTrang: String(row[colStatus] || '–').trim(),
      nhom: nhom,
      val: val,
      raw: row
    });
  }

  if (countBadge) countBadge.textContent = String(allDvkh.length);

  // Thống kê theo từng khu vực cho thanh điều hướng pills
  const regionTotals = {};
  allDvkh.forEach(item => {
    const kv = item.khuVuc;
    if (!regionTotals[kv]) {
      regionTotals[kv] = { count: 0, val: 0 };
    }
    regionTotals[kv].count++;
    regionTotals[kv].val += item.val;
  });

  // Render các nút Pills khu vực
  if (pillsBox) {
    const distinctRegions = Object.keys(regionTotals).sort((a, b) => regionTotals[b].count - regionTotals[a].count);
    let phtml = '';
    const isAllActive = (DVKH_SELECTED_REGION === 'all');
    phtml += `<button type="button" class="dvkh-pill-btn ${isAllActive ? 'active' : ''}" onclick="onSelectDvkhRegion('all')">
      🌐 Tất cả (${allDvkh.length})
    </button>`;
    distinctRegions.forEach(kv => {
      const isActive = (DVKH_SELECTED_REGION === kv);
      const cnt = regionTotals[kv].count;
      phtml += `<button type="button" class="dvkh-pill-btn ${isActive ? 'active' : ''}" onclick="onSelectDvkhRegion('${esc(kv)}')">
        📍 ${esc(kv)} (${cnt})
      </button>`;
    });
    pillsBox.innerHTML = phtml;
  }

  // Lọc theo từ khóa tìm kiếm & khu vực được chọn (nếu có)
  let list = allDvkh;
  if (DVKH_SELECTED_REGION !== 'all') {
    list = list.filter(item => item.khuVuc === DVKH_SELECTED_REGION);
  }

  if (DVKH_SEARCH) {
    const q = DVKH_SEARCH;
    list = list.filter(item => {
      return item.tenGh.toLowerCase().includes(q) ||
             item.retailerId.toLowerCase().includes(q) ||
             item.nguoiTao.toLowerCase().includes(q) ||
             item.khuVuc.toLowerCase().includes(q) ||
             item.tinhTp.toLowerCase().includes(q) ||
             item.tinhTrang.toLowerCase().includes(q) ||
             item.ngayTao.toLowerCase().includes(q);
    });
  }

  // Nhóm các bản ghi theo Khu Vực
  const groupMap = {};
  list.forEach(item => {
    const kv = item.khuVuc;
    if (!groupMap[kv]) {
      groupMap[kv] = {
        name: kv,
        items: [],
        provinces: new Set(),
        totalVal: 0
      };
    }
    groupMap[kv].items.push(item);
    if (item.tinhTp && item.tinhTp !== '–') groupMap[kv].provinces.add(item.tinhTp);
    groupMap[kv].totalVal += item.val;
  });

  // Thứ tự ưu tiên hiển thị khu vực tiêu chuẩn
  const regionOrder = ['Miền Bắc', 'Hà Nội', 'Miền Trung', 'Miền Nam', 'Sài Gòn'];
  const groupedRegions = Object.values(groupMap).map(g => ({
    ...g,
    provinces: Array.from(g.provinces)
  })).sort((a, b) => {
    const idxA = regionOrder.indexOf(a.name);
    const idxB = regionOrder.indexOf(b.name);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return b.items.length - a.items.length;
  });

  // Sắp xếp các bản ghi bên trong từng nhóm theo DVKH_SORT
  const dir = DVKH_SORT.dir;
  const k = DVKH_SORT.k;
  groupedRegions.forEach(g => {
    g.items.sort((a, b) => {
      if (k === 'stt') return dir * (a.origIdx - b.origIdx);
      if (k === 'val') return dir * (a.val - b.val);
      if (k === 'tenGh') return dir * a.tenGh.localeCompare(b.tenGh, 'vi');
      if (k === 'retailerId') return dir * a.retailerId.localeCompare(b.retailerId, 'vi');
      if (k === 'ngayTao') return dir * a.ngayTao.localeCompare(b.ngayTao, 'vi');
      if (k === 'nguoiTao') return dir * a.nguoiTao.localeCompare(b.nguoiTao, 'vi');
      if (k === 'khuVuc') return dir * a.khuVuc.localeCompare(b.khuVuc, 'vi');
      if (k === 'tinhTp') return dir * a.tinhTp.localeCompare(b.tinhTp, 'vi');
      if (k === 'tinhTrang') return dir * a.tinhTrang.localeCompare(b.tinhTrang, 'vi');
      return 0;
    });
  });

  const sortArrow = key => (DVKH_SORT.k === key ? (DVKH_SORT.dir === 1 ? ' ▲' : ' ▼') : ' ⇅');

  // THEAD
  let thead = '<thead><tr>';
  thead += `<th onclick="sortPhanCungDvkh('stt')" style="width:50px;text-align:center;cursor:pointer" title="Sắp xếp theo STT">STT${sortArrow('stt')}</th>`;
  thead += `<th onclick="sortPhanCungDvkh('tenGh')" style="min-width:180px;text-align:left;cursor:pointer" title="Sắp xếp theo Tên gian hàng">TÊN GH / RETAILER ID${sortArrow('tenGh')}</th>`;
  thead += `<th onclick="sortPhanCungDvkh('ngayTao')" style="min-width:140px;text-align:center;cursor:pointer" title="Sắp xếp theo Ngày tạo">NGÀY TẠO${sortArrow('ngayTao')}</th>`;
  thead += `<th onclick="sortPhanCungDvkh('nguoiTao')" style="min-width:190px;text-align:left;cursor:pointer" title="Sắp xếp theo Người tạo">NGƯỜI TẠO${sortArrow('nguoiTao')}</th>`;
  thead += `<th onclick="sortPhanCungDvkh('khuVuc')" style="min-width:110px;text-align:center;cursor:pointer" title="Sắp xếp theo Khu vực">KHU VỰC${sortArrow('khuVuc')}</th>`;
  thead += `<th onclick="sortPhanCungDvkh('tinhTp')" style="min-width:130px;text-align:left;cursor:pointer" title="Sắp xếp theo Tỉnh thành phố">TỈNH THÀNH PHỐ${sortArrow('tinhTp')}</th>`;
  thead += `<th onclick="sortPhanCungDvkh('tinhTrang')" style="min-width:130px;text-align:center;cursor:pointer" title="Sắp xếp theo Tình trạng">TÌNH TRẠNG${sortArrow('tinhTrang')}</th>`;
  thead += `<th onclick="sortPhanCungDvkh('val')" style="min-width:120px;text-align:right;cursor:pointer" title="Sắp xếp theo Thành tiền">THÀNH TIỀN${sortArrow('val')}</th>`;
  thead += '</tr></thead>';

  // TBODY
  let tbody = '<tbody>';
  if (groupedRegions.length === 0) {
    tbody += '<tr><td colspan="8" style="padding:24px;text-align:center;color:var(--mut)">Không có dữ liệu cơ hội DVKH Manager phù hợp điều kiện tìm kiếm.</td></tr>';
  } else {
    groupedRegions.forEach(g => {
      const kv = g.name;
      const groupItems = g.items;
      const groupVal = g.totalVal;
      // Khi đang gõ tìm kiếm hoặc đã chọn riêng 1 khu vực, tự động mở chi tiết
      const isExpanded = DVKH_SEARCH ? true : (DVKH_SELECTED_REGION === kv || DVKH_EXPANDED_REGIONS[kv] === true);

      // DÒNG TIÊU ĐỀ NHÓM KHU VỰC (BẤM VÀO ĐỂ ĐÓNG / MỞ ACCORDION)
      tbody += `
        <tr class="dvkh-region-group-row ${isExpanded ? 'expanded' : 'collapsed'}" onclick="toggleDvkhRegion('${esc(kv)}')" title="Bấm để ${isExpanded ? 'thu gọn' : 'xem chi tiết'} khu vực ${esc(kv)}">
          <td colspan="8" style="padding:10px 14px;text-align:left">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
              <div style="display:flex;align-items:center;gap:10px">
                <span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:6px;background:${isExpanded ? 'rgba(56,189,248,0.25)' : 'rgba(148,163,184,0.15)'};color:${isExpanded ? '#38bdf8' : 'var(--mut)'};font-size:11px;font-weight:bold;transition:all 0.15s">
                  ${isExpanded ? '▼' : '▶'}
                </span>
                <span style="font-weight:800;font-size:13.5px;color:var(--tx-heading)">📍 Khu Vực: ${esc(kv)}</span>
                <span class="badge" style="background:rgba(56,189,248,0.18);color:#38bdf8;font-size:11px;font-weight:700">${groupItems.length} cơ hội</span>
                ${g.provinces.length > 0 ? `<span class="mut sm" style="font-size:11.5px">(${esc(g.provinces.slice(0, 4).join(', '))}${g.provinces.length > 4 ? '...' : ''})</span>` : ''}
              </div>
              <div style="display:flex;align-items:center;gap:14px">
                <span style="font-size:12.5px;font-weight:700;color:${groupVal > 0 ? '#38bdf8' : 'var(--mut)'}">
                  Tổng: ${formatVND(groupVal)}
                </span>
                <span class="mut sm" style="font-size:11.5px;font-weight:600;color:${isExpanded ? '#38bdf8' : 'var(--mut)'}">
                  ${isExpanded ? 'Thu gọn ▲' : 'Bấm xem chi tiết (' + groupItems.length + ' đơn) ▼'}
                </span>
              </div>
            </div>
          </td>
        </tr>
      `;

      // CÁC DÒNG CHI TIẾT (KHI ĐƯỢC MỞ)
      if (isExpanded) {
        groupItems.forEach((item, idx) => {
          tbody += `<tr class="dvkh-detail-row">`;
          tbody += `<td style="text-align:center;font-weight:700;color:var(--mut)">${idx + 1}</td>`;
          tbody += `<td style="text-align:left">
            <div style="font-weight:700;font-size:13px;color:var(--tx-heading)">${esc(item.tenGh)}</div>
            <div class="sm mut" style="font-family:monospace;margin-top:2px">${esc(item.retailerId)}</div>
          </td>`;
          tbody += `<td style="text-align:center;font-size:12px;color:var(--mut);white-space:nowrap">${esc(item.ngayTao)}</td>`;
          tbody += `<td style="text-align:left;font-size:12.5px;font-weight:600">${esc(item.nguoiTao)}</td>`;
          tbody += `<td style="text-align:center"><span class="badge" style="background:rgba(56,189,248,0.15);color:#38bdf8;font-size:11px">${esc(item.khuVuc)}</span></td>`;
          tbody += `<td style="text-align:left;font-size:12.5px">${esc(item.tinhTp)}</td>`;
          tbody += `<td style="text-align:center">${getOctStatusBadge(item.tinhTrang)}</td>`;
          tbody += `<td style="text-align:right;font-weight:700;color:${item.val > 0 ? '#38bdf8' : 'var(--mut)'}">${formatVND(item.val)}</td>`;
          tbody += '</tr>';
        });
      }
    });
  }
  tbody += '</tbody>';

  // TFOOT
  const totVal = list.reduce((s, it) => s + it.val, 0);
  let tfoot = '<tfoot><tr>';
  tfoot += '<td style="text-align:center;color:var(--mut)">–</td>';
  tfoot += `<td style="text-align:left;font-weight:800;color:var(--tx-heading)">Tổng hiển thị: ${list.length} Opp ${DVKH_SELECTED_REGION !== 'all' ? `(${DVKH_SELECTED_REGION})` : ''}</td>`;
  tfoot += '<td colspan="5" style="text-align:center;color:var(--mut)"></td>';
  tfoot += `<td style="text-align:right;font-weight:800;color:#38bdf8">${formatVND(totVal)}</td>`;
  tfoot += '</tr></tfoot>';

  tbl.innerHTML = thead + tbody + tfoot;
}

/**
 * Xuất file CSV danh sách cơ hội DVKH Manager (hỗ trợ lọc theo khu vực và tìm kiếm)
 */
function exportPhanCungDvkhCsv() {
  if (!PHANCUNG_OCT_STATE.data || !Array.isArray(PHANCUNG_OCT_STATE.data) || PHANCUNG_OCT_STATE.data.length < 2) {
    showToast('Chưa có dữ liệu cơ hội DVKH Manager để xuất CSV!', false);
    return;
  }

  const rawData = PHANCUNG_OCT_STATE.data;
  const headers = rawData[0].map(h => String(h || '').trim());
  let colStatus = headers.findIndex(h => h.toLowerCase() === 'tình trạng');
  let colNhom = headers.findIndex(h => h.toLowerCase() === 'nhóm');
  let colTenGh = headers.findIndex(h => h.toLowerCase() === 'tên gian hàng');
  let colRetailerId = headers.findIndex(h => h.toLowerCase() === 'retailer id');
  let colNguoiTao = headers.findIndex(h => h.toLowerCase() === 'người tạo');
  let colNgayTao = headers.findIndex(h => h.toLowerCase() === 'thời gian tạo' || h.toLowerCase() === 'ngày tạo');
  let colKhuVuc = headers.findIndex(h => h.toLowerCase() === 'khu vực');
  let colTinhTp = headers.findIndex(h => h.toLowerCase() === 'tỉnh/thành phố' || h.toLowerCase() === 'tỉnh thành phố' || h.toLowerCase() === 'tỉnh/thành');
  let colTienVal = headers.findIndex(h => h.toLowerCase() === 'thành tiền value');
  let colTienStr = headers.findIndex(h => h.toLowerCase() === 'thành tiền');

  if (colStatus === -1) colStatus = 10;
  if (colNhom === -1) colNhom = 16;
  if (colTenGh === -1) colTenGh = 1;
  if (colRetailerId === -1) colRetailerId = 2;
  if (colNguoiTao === -1) colNguoiTao = 4;
  if (colNgayTao === -1) colNgayTao = 5;
  if (colTinhTp === -1) colTinhTp = 13;
  if (colKhuVuc === -1) colKhuVuc = 14;
  if (colTienVal === -1) colTienVal = 17;
  if (colTienStr === -1) colTienStr = 6;

  const rows = [];
  rows.push(['STT', 'Tên Gian Hàng', 'Retailer ID', 'Ngày Tạo', 'Người Tạo', 'Khu Vực', 'Tỉnh / Thành Phố', 'Tình Trạng', 'Thành Tiền', 'Nhóm']);

  let count = 0;
  for (let r = 1; r < rawData.length; r++) {
    const row = rawData[r];
    if (!row || !row.length) continue;
    const nhom = String(row[colNhom] || '').trim();
    if (!/dvkh\s*manager/i.test(nhom)) continue;

    const kv = String(row[colKhuVuc] || '').trim() || 'Chưa phân loại';
    if (DVKH_SELECTED_REGION !== 'all' && kv !== DVKH_SELECTED_REGION) continue;

    const tenGh = String(row[colTenGh] || '').trim();
    const retId = String(row[colRetailerId] || '').trim();
    const nguoiTao = String(row[colNguoiTao] || '').trim();
    const ngayTao = String(row[colNgayTao] || '').trim();
    const tinhTp = String(row[colTinhTp] || '').trim();
    const status = String(row[colStatus] || '').trim();

    if (DVKH_SEARCH) {
      const q = DVKH_SEARCH;
      const match = tenGh.toLowerCase().includes(q) ||
                    retId.toLowerCase().includes(q) ||
                    nguoiTao.toLowerCase().includes(q) ||
                    kv.toLowerCase().includes(q) ||
                    tinhTp.toLowerCase().includes(q) ||
                    status.toLowerCase().includes(q) ||
                    ngayTao.toLowerCase().includes(q);
      if (!match) continue;
    }

    let val = 0;
    if (colTienVal !== -1 && row[colTienVal] != null && String(row[colTienVal]).trim() !== '') {
      val = parsePcNumber(row[colTienVal]);
    } else if (colTienStr !== -1 && row[colTienStr] != null) {
      val = parsePcNumber(row[colTienStr]);
    }

    count++;
    rows.push([
      count,
      tenGh,
      retId,
      ngayTao,
      nguoiTao,
      kv,
      tinhTp,
      status,
      val,
      nhom
    ]);
  }

  if (count === 0) {
    showToast('Không có bản ghi DVKH Manager nào phù hợp để xuất!', false);
    return;
  }

  const csvContent = '\ufeff' + rows.map(r => {
    return (r || []).map(val => {
      const s = String(val == null ? '' : val);
      return '"' + s.replace(/"/g, '""') + '"';
    }).join(',');
  }).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const regionSuffix = DVKH_SELECTED_REGION !== 'all' ? `_${DVKH_SELECTED_REGION.replace(/\s+/g, '_')}` : '';
  a.download = `co_hoi_dvkh_manager${regionSuffix}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
  showToast(`Đã xuất thành công ${count} cơ hội DVKH Manager ra CSV!`, true);
}

/**
 * Render Mục 2: Chi Tiết Phần Cứng Tháng 10
 */
function renderPhanCungOct() {
  const container = $('pcSecOct');
  const cardsBox = $('pcOctSummaryCards');
  const tbl = $('pcOctPivotTable');
  const dvkhTbl = $('pcDvkhTable');
  if (!container) return;

  if (!PHANCUNG_OCT_STATE.data) {
    if (cardsBox) cardsBox.style.display = 'none';
    if (tbl) tbl.innerHTML = '';
    if (dvkhTbl) dvkhTbl.innerHTML = '';
    return;
  }

  if (cardsBox) cardsBox.style.display = 'grid';
  const parsedOct = normalizePhanCungOctData(PHANCUNG_OCT_STATE.data);
  if (!parsedOct) return;

  renderPhanCungOctSummaryCards(parsedOct);
  renderPhanCungOctPivotTable(parsedOct);
  renderPhanCungDvkhManager(parsedOct);
}

/**
 * Tải dữ liệu Mục 2 từ API Tháng 10 (IndexedDB Smart Cache + Fetch trực tiếp)
 */
async function loadPhanCungOct(forceReload = false) {
  return loadPhanCung(forceReload);
}

/**
 * Xuất file CSV Mục 2: Ma Trận Nhóm x Tình Trạng + Danh Sách 164 Đơn Chi Tiết
 */
function exportPhanCungOctCsv() {
  if (!PHANCUNG_OCT_STATE.data) {
    showToast('Chưa có dữ liệu API Tháng 10 để xuất CSV!', false);
    return;
  }
  const parsed = normalizePhanCungOctData(PHANCUNG_OCT_STATE.data);
  if (!parsed) {
    showToast('Lỗi cấu trúc dữ liệu Tháng 10!', false);
    return;
  }

  const lines = [];

  // Phần 1: BẢNG MA TRẬN PIVOT NHÓM × TÌNH TRẠNG
  lines.push(['BÁO CÁO PHẦN CỨNG THÁNG 10 - MA TRẬN NHÓM x TÌNH TRẠNG']);
  lines.push(['Thời gian xuất:', new Date().toLocaleString('vi-VN')]);
  lines.push([]);

  // Header dòng ma trận (Cột là Tình trạng)
  const matrixHeaders = ['Nhóm / Nhân Sự', ...parsed.statuses, 'TỔNG CỘNG'];
  lines.push(matrixHeaders);

  // Các dòng Nhóm
  parsed.groups.forEach(gp => {
    const meta = getShortGroupName(gp);
    const row = [meta.sub ? `${meta.title} (${meta.sub})` : meta.title];
    parsed.statuses.forEach(st => {
      const cell = parsed.matrix[st]?.[gp] || { count: 0, val: 0 };
      row.push(`SL: ${cell.count} / ${cell.val.toLocaleString('vi-VN')} đ`);
    });
    const gpTot = parsed.groupTotals[gp] || { count: 0, val: 0 };
    row.push(`SL: ${gpTot.count} / ${gpTot.val.toLocaleString('vi-VN')} đ`);
    lines.push(row);
  });

  // Dòng TỔNG CỘNG
  const footRow = ['TỔNG CỘNG'];
  parsed.statuses.forEach(st => {
    const stTot = parsed.statusTotals[st] || { count: 0, val: 0 };
    footRow.push(`SL: ${stTot.count} / ${stTot.val.toLocaleString('vi-VN')} đ`);
  });
  footRow.push(`SL: ${parsed.grandTotal.count} / ${parsed.grandTotal.val.toLocaleString('vi-VN')} đ`);
  lines.push(footRow);

  lines.push([]);
  lines.push(['------------------------------------------------------------']);
  lines.push(['DANH SÁCH CHI TIẾT CƠ HỘI PHẦN CỨNG THÁNG 10']);
  lines.push([]);

  // Thêm toàn bộ danh sách 164 dòng từ API
  if (Array.isArray(parsed.rawData)) {
    parsed.rawData.forEach(r => {
      lines.push(r);
    });
  }

  const csvContent = '\ufeff' + lines.map(row => {
    return (row || []).map(val => {
      const s = String(val == null ? '' : val);
      return '"' + s.replace(/"/g, '""') + '"';
    }).join(',');
  }).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ma_tran_phan_cung_thang_10_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  showToast('Đã xuất thành công file CSV Ma Trận Phần Cứng Tháng 10!', true);
}

// =========================================================================
// MỤC 3: BÁN HÀNG TỪ NGUỒN (SHEET PHANCUNG T1:W9)
// =========================================================================

/**
 * Lấy icon trực quan cho từng kênh / nguồn tiếp cận
 */
function getPhanCungSourceIcon(name) {
  const s = String(name || '').toLowerCase();
  if (s.includes('sale')) return '💼';
  if (s.includes('dvkh') || s.includes('chăm sóc')) return '🎧';
  if (s.includes('shopee') || s.includes('lazada') || s.includes('tiktok') || s.includes('sàn')) return '🛍️';
  if (s.includes('fanpage') || s.includes('fb') || s.includes('facebook')) return '📱';
  if (s.includes('mky')) return '🏷️';
  return '📁';
}

/**
 * Chuẩn hóa dữ liệu Mục 3: Bán Hàng Từ Nguồn từ Sheet phancung (T1:W9)
 */
function normalizePhanCungSourceData(rawData) {
  if (!Array.isArray(rawData) || rawData.length < 2) return null;

  const headerRow = rawData[0] || [];
  let colName = 0;
  let colT10 = 1;
  let colT11 = 2;
  let colT12 = 3;

  headerRow.forEach((h, idx) => {
    const s = String(h || '').trim().toLowerCase();
    if (s.includes('nguồn')) colName = idx;
    else if (s.includes('10')) colT10 = idx;
    else if (s.includes('11')) colT11 = idx;
    else if (s.includes('12')) colT12 = idx;
  });

  const items = [];
  let totalRow = null;

  for (let r = 1; r < rawData.length; r++) {
    const row = rawData[r];
    if (!row || !row.length) continue;
    const name = String(row[colName] == null ? '' : row[colName]).trim();
    if (!name) continue;

    const valT10Raw = row[colT10];
    const valT11Raw = row[colT11];
    const valT12Raw = row[colT12];

    const t10 = (valT10Raw === '' || valT10Raw == null) ? null : parsePcNumber(valT10Raw);
    const t11 = (valT11Raw === '' || valT11Raw == null) ? null : parsePcNumber(valT11Raw);
    const t12 = (valT12Raw === '' || valT12Raw == null) ? null : parsePcNumber(valT12Raw);

    const q4 = (t10 || 0) + (t11 || 0) + (t12 || 0);

    const itemObj = {
      stt: r,
      name,
      t10,
      t11,
      t12,
      q4,
      pct10: 0,
      rawRow: row
    };

    if (/^tổng/i.test(name)) {
      totalRow = itemObj;
    } else {
      items.push(itemObj);
    }
  }

  // Tính tổng
  const sumT10Items = items.reduce((s, it) => s + (it.t10 || 0), 0);
  const sumT11Items = items.reduce((s, it) => s + (it.t11 || 0), 0);
  const sumT12Items = items.reduce((s, it) => s + (it.t12 || 0), 0);
  const sumQ4Items = items.reduce((s, it) => s + it.q4, 0);

  const grandT10 = (totalRow && totalRow.t10 != null && totalRow.t10 > 0) ? totalRow.t10 : sumT10Items;
  const grandT11 = (totalRow && totalRow.t11 != null && totalRow.t11 > 0) ? totalRow.t11 : sumT11Items;
  const grandT12 = (totalRow && totalRow.t12 != null && totalRow.t12 > 0) ? totalRow.t12 : sumT12Items;
  const grandQ4 = (totalRow && totalRow.q4 > 0) ? totalRow.q4 : sumQ4Items;

  items.forEach(it => {
    if (it.t10 != null && grandT10 > 0) {
      it.pct10 = (it.t10 / grandT10) * 100;
    } else {
      it.pct10 = 0;
    }
  });

  const saleItem = items.find(it => /sale/i.test(it.name));
  const dvkhItem = items.find(it => /dvkh/i.test(it.name) || /chăm sóc/i.test(it.name));
  const otherItems = items.filter(it => it !== saleItem && it !== dvkhItem);
  const otherT10 = otherItems.reduce((s, it) => s + (it.t10 || 0), 0);

  return {
    headers: headerRow,
    items,
    totalRow: totalRow || { name: 'Tổng', t10: grandT10, t11: grandT11, t12: grandT12, q4: grandQ4, pct10: 100 },
    grandT10,
    grandT11,
    grandT12,
    grandQ4,
    saleItem,
    dvkhItem,
    otherItems,
    otherT10
  };
}

/**
 * Hiển thị các thẻ KPI tóm tắt Mục 3
 */
function renderPhanCungSourceSummaryCards(parsed) {
  const box = $('pcSourceSummaryCards');
  if (!box || !parsed) return;

  const K = (l, v, s, c = '', tag = '') => `
    <div class="card kpi">
      <div class="l" style="display:flex;justify-content:space-between;align-items:center;gap:4px">
        <span>${l}</span>
        ${tag ? `<span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;background:rgba(124,58,237,0.18);color:#c084fc;white-space:nowrap">${tag}</span>` : ''}
      </div>
      <div class="v" style="${c}">${v}</div>
      <div class="s">${s}</div>
    </div>`;

  const totalT10 = parsed.grandT10 || 0;
  const saleCount = parsed.saleItem ? (parsed.saleItem.t10 || 0) : 0;
  const salePct = parsed.saleItem ? parsed.saleItem.pct10 : 0;
  const dvkhCount = parsed.dvkhItem ? (parsed.dvkhItem.t10 || 0) : 0;
  const dvkhPct = parsed.dvkhItem ? parsed.dvkhItem.pct10 : 0;
  const otherCount = parsed.otherT10 || 0;
  const otherPct = totalT10 > 0 ? (otherCount / totalT10 * 100) : 0;

  box.innerHTML =
    K('Tổng Sản Lượng T10', `${n0(totalT10)} <span style="font-size:14px;font-weight:400;color:var(--mut)">đơn/máy</span>`, `Toàn bộ các kênh ghi nhận trong Tháng 10`, 'color:#38bdf8', 'Tháng 10') +
    K('Kênh Sale Trực Tiếp', `${n0(saleCount)} <span style="font-size:14px;font-weight:400;color:var(--mut)">đơn/máy</span>`, `Chiếm ${salePct.toFixed(1)}% sản lượng Tháng 10`, 'color:#10b981', `${salePct.toFixed(1)}%`) +
    K('DVKH CS (Chăm Sóc)', `${n0(dvkhCount)} <span style="font-size:14px;font-weight:400;color:var(--mut)">đơn/máy</span>`, `Chiếm ${dvkhPct.toFixed(1)}% sản lượng Tháng 10`, 'color:#f59e0b', `${dvkhPct.toFixed(1)}%`) +
    K('Các Kênh Khác (MKY / Sàn)', `${n0(otherCount)} <span style="font-size:14px;font-weight:400;color:var(--mut)">đơn/máy</span>`, `MKY (7) · Shopee, Lazada, Tiktok, Fanpage (0)`, 'color:#c084fc', `${otherPct.toFixed(1)}%`);
}

/**
 * Hiển thị bảng chi tiết Mục 3: Bán Hàng Từ Nguồn
 */
function renderPhanCungSourceTable(parsed) {
  const tbl = $('pcSourceTable');
  if (!tbl || !parsed) return;

  const { k, dir } = PHANCUNG_SOURCE_SORT;
  const sortArrow = key => (k === key ? (dir > 0 ? ' ▲' : ' ▼') : ' ⇅');

  const items = [...parsed.items];
  items.sort((a, b) => {
    if (k === 'name') {
      return dir * String(a.name).localeCompare(String(b.name), 'vi');
    }
    let vA = a[k];
    let vB = b[k];
    vA = vA == null ? -Infinity : Number(vA);
    vB = vB == null ? -Infinity : Number(vB);
    return dir * (vA - vB);
  });

  let hHtml = `
    <thead>
      <tr style="background:var(--subtle);border-bottom:2px solid var(--line)">
        <th onclick="sortPhanCungSource('stt')" style="cursor:pointer;text-align:center;width:55px" title="Sắp xếp theo STT">STT${sortArrow('stt')}</th>
        <th onclick="sortPhanCungSource('name')" style="cursor:pointer;text-align:left;min-width:220px" title="Sắp xếp theo Kênh / Nguồn">Kênh / Nguồn Tiếp Cận${sortArrow('name')}</th>
        <th onclick="sortPhanCungSource('t10')" style="cursor:pointer;text-align:right;width:125px" title="Sắp xếp theo Số lượng Tháng 10">Tháng 10 (SL)${sortArrow('t10')}</th>
        <th onclick="sortPhanCungSource('pct10')" style="cursor:pointer;text-align:left;min-width:180px" title="Sắp xếp theo Tỷ trọng % Tháng 10">Tỷ Trọng T10 (%)${sortArrow('pct10')}</th>
        <th onclick="sortPhanCungSource('t11')" style="cursor:pointer;text-align:right;width:115px" title="Sắp xếp theo Tháng 11">Tháng 11 (SL)${sortArrow('t11')}</th>
        <th onclick="sortPhanCungSource('t12')" style="cursor:pointer;text-align:right;width:115px" title="Sắp xếp theo Tháng 12">Tháng 12 (SL)${sortArrow('t12')}</th>
        <th onclick="sortPhanCungSource('q4')" style="cursor:pointer;text-align:right;width:130px" title="Sắp xếp theo Tổng Quý 4">Tổng Quý 4 (SL)${sortArrow('q4')}</th>
      </tr>
    </thead>
  `;

  let bHtml = '<tbody>';
  items.forEach((it, idx) => {
    const pct = it.pct10 || 0;
    let barColor = '#a855f7';
    if (pct >= 50) barColor = '#10b981';
    else if (pct >= 30) barColor = '#38bdf8';
    else if (pct >= 10) barColor = '#f59e0b';
    else if (pct > 0) barColor = '#a855f7';
    else barColor = 'rgba(148, 163, 184, 0.3)';

    bHtml += `
      <tr style="border-bottom:1px solid var(--line);transition:background 0.2s">
        <td style="text-align:center;color:var(--mut);font-weight:600">${idx + 1}</td>
        <td style="text-align:left;font-weight:600;color:var(--tx)">
          <span style="font-size:15px;margin-right:8px">${getPhanCungSourceIcon(it.name)}</span>
          <span>${esc(it.name)}</span>
        </td>
        <td style="text-align:right;font-weight:700;color:var(--tx-heading)">
          ${it.t10 != null ? n0(it.t10) : '<span class="mut">–</span>'}
        </td>
        <td style="text-align:left">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="flex:1;height:7px;background:rgba(255,255,255,0.08);border-radius:4px;overflow:hidden;min-width:60px">
              <div style="width:${Math.min(100, pct)}%;height:100%;background:${barColor};border-radius:4px"></div>
            </div>
            <span style="font-size:12px;font-weight:700;color:${pct > 0 ? barColor : 'var(--mut)'};min-width:44px;text-align:right">${pct.toFixed(1)}%</span>
          </div>
        </td>
        <td style="text-align:right;color:var(--mut)">
          ${it.t11 != null ? n0(it.t11) : '<span class="mut">–</span>'}
        </td>
        <td style="text-align:right;color:var(--mut)">
          ${it.t12 != null ? n0(it.t12) : '<span class="mut">–</span>'}
        </td>
        <td style="text-align:right;font-weight:800;color:#facc15">
          ${n0(it.q4)}
        </td>
      </tr>
    `;
  });

  // Dòng TỔNG CỘNG
  bHtml += `
    <tr style="background:rgba(124, 58, 237, 0.12);border-top:2px solid var(--line);font-weight:800">
      <td style="text-align:center;color:var(--mut)">–</td>
      <td style="text-align:left;color:#facc15;font-weight:800">
        <span style="font-size:15px;margin-right:8px">∑</span>
        <span>TỔNG CỘNG</span>
      </td>
      <td style="text-align:right;color:#38bdf8;font-size:14px;font-weight:800">
        ${n0(parsed.grandT10)}
      </td>
      <td style="text-align:left">
        <span style="display:inline-block;padding:2px 8px;border-radius:6px;font-weight:800;font-size:12px;background:rgba(16, 185, 129, 0.2);color:#10b981">100.0%</span>
      </td>
      <td style="text-align:right;color:var(--mut)">
        ${parsed.grandT11 > 0 ? n0(parsed.grandT11) : '<span class="mut">–</span>'}
      </td>
      <td style="text-align:right;color:var(--mut)">
        ${parsed.grandT12 > 0 ? n0(parsed.grandT12) : '<span class="mut">–</span>'}
      </td>
      <td style="text-align:right;color:#facc15;font-size:14px;font-weight:800">
        ${n0(parsed.grandQ4)}
      </td>
    </tr>
  `;

  bHtml += '</tbody>';
  tbl.innerHTML = hHtml + bHtml;
}

/**
 * Xử lý sắp xếp bảng Mục 3: Bán Hàng Từ Nguồn
 */
function sortPhanCungSource(colKey) {
  if (PHANCUNG_SOURCE_SORT.k === colKey) {
    PHANCUNG_SOURCE_SORT.dir = -PHANCUNG_SOURCE_SORT.dir;
  } else {
    PHANCUNG_SOURCE_SORT.k = colKey;
    PHANCUNG_SOURCE_SORT.dir = (colKey === 'name') ? 1 : -1;
  }
  if (!PHANCUNG_SOURCE_STATE.data) return;
  const parsed = normalizePhanCungSourceData(PHANCUNG_SOURCE_STATE.data);
  if (parsed) renderPhanCungSourceTable(parsed);
}

/**
 * Điều phối render Mục 3: Bán Hàng Từ Nguồn
 */
function renderPhanCungSource() {
  if (!PHANCUNG_SOURCE_STATE.data) return;
  const parsed = normalizePhanCungSourceData(PHANCUNG_SOURCE_STATE.data);
  if (!parsed) return;
  renderPhanCungSourceSummaryCards(parsed);
  renderPhanCungSourceTable(parsed);
}

/**
 * Xuất file CSV Mục 3: Bán Hàng Từ Nguồn (Quý 4: T10 - T12)
 */
function exportPhanCungSourceCsv() {
  if (!PHANCUNG_SOURCE_STATE.data) {
    showToast('Chưa có dữ liệu Bán Hàng Từ Nguồn để xuất CSV!', false);
    return;
  }
  const parsed = normalizePhanCungSourceData(PHANCUNG_SOURCE_STATE.data);
  if (!parsed) {
    showToast('Lỗi cấu trúc dữ liệu Bán Hàng Từ Nguồn!', false);
    return;
  }

  const lines = [];
  lines.push(['BÁO CÁO PHẦN CỨNG - BÁN HÀNG TỪ NGUỒN (QUÝ 4)']);
  lines.push(['Thời gian xuất:', new Date().toLocaleString('vi-VN')]);
  lines.push(['Nguồn dữ liệu:', 'Sheet phancung (T1:W9)']);
  lines.push([]);

  lines.push(['STT', 'Kênh / Nguồn Tiếp Cận', 'Tháng 10 (SL)', 'Tỷ Trọng T10 (%)', 'Tháng 11 (SL)', 'Tháng 12 (SL)', 'Tổng Quý 4 (SL)']);

  parsed.items.forEach((it, idx) => {
    lines.push([
      idx + 1,
      it.name,
      it.t10 != null ? it.t10 : '',
      it.pct10.toFixed(1) + '%',
      it.t11 != null ? it.t11 : '',
      it.t12 != null ? it.t12 : '',
      it.q4
    ]);
  });

  lines.push([
    '',
    'TỔNG CỘNG',
    parsed.grandT10,
    '100.0%',
    parsed.grandT11 > 0 ? parsed.grandT11 : '',
    parsed.grandT12 > 0 ? parsed.grandT12 : '',
    parsed.grandQ4
  ]);

  const csvContent = '\ufeff' + lines.map(row => {
    return (row || []).map(val => {
      const s = String(val == null ? '' : val);
      return '"' + s.replace(/"/g, '""') + '"';
    }).join(',');
  }).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ban_hang_tu_nguon_phancung_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  showToast('Đã xuất thành công file CSV Bán Hàng Từ Nguồn (Mục 3)!', true);
}
