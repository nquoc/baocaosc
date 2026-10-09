/**
 * tab_pivot.js - Logic xử lý dữ liệu và giao diện Tab 2: Chi tiết ATC/ngày (Ma trận Pivot & Modals chi tiết)
 */

function getFilteredRawRecords() {
  const searchQ = ($('pvSearch') ? $('pvSearch').value : '').trim().toLowerCase();
  return RAW_RECORDS.filter(r => {
    if (!S.coach.has(r.coach)) return false;
    if (r.date < S.from || r.date > S.to) return false;
    if (S.sc !== 'all' && r.sc !== S.sc) return false;
    const meta = SCS[r.sc] || scMeta(r.sc);
    if (S.status !== 'all' && (S.status === 'left') !== meta.nghi) return false;
    if (searchQ && !meta.name.toLowerCase().includes(searchQ) && !r.sc.toLowerCase().includes(searchQ)) return false;
    return true;
  });
}

function setPivotDaysRange(type) {
  if (type === 'all') {
    S.month = 'all';
    S.from = DATES[0];
    S.to = DATES[DATES.length - 1];
  } else if (type === 'month') {
    if (S.month === 'all' || S.month === 'custom') S.month = MONTHS[0] || 'all';
    const mDates = DATES.filter(d => d.startsWith(S.month));
    if (mDates.length) {
      S.from = mDates[0];
      S.to = mDates[mDates.length - 1];
    }
  } else if (type === '7d') {
    const currentDates = DATES.filter(d => d >= S.from && d <= S.to);
    const end = currentDates[currentDates.length - 1] || DATES[DATES.length - 1];
    const allBefore = DATES.filter(d => d <= end);
    const startIdx = Math.max(0, allBefore.length - 7);
    S.from = allBefore[startIdx];
    S.to = end;
    S.month = 'custom';
  }
  if ($('fMonth')) $('fMonth').value = S.month;
  $('fFrom').value = S.from;
  $('fTo').value = S.to;
  buildScSelect();
  render();
}

function renderPivot() {
  const recs = getFilteredRawRecords();

  // Danh sách các ngày trong khoảng lọc (sắp xếp tăng dần)
  const activeDates = [...new Set(recs.map(r => r.date))].sort();

  // Danh sách SC có trong dữ liệu lọc (sắp xếp theo tên)
  const scSet = [...new Set(recs.map(r => r.sc))].sort((a, b) => {
    const na = (SCS[a] || scMeta(a)).name;
    const nb = (SCS[b] || scMeta(b)).name;
    return na.localeCompare(nb, 'vi');
  });

  // Bản đồ công theo từng (sc, date) từ DAYS
  const congMap = {};
  DAYS.forEach(d => {
    congMap[d.sc + '|' + d.d] = d.c;
  });

  // Bản đồ nhóm record theo (sc, date)
  const cellMap = {};
  recs.forEach(r => {
    const k = r.sc + '|' + r.date;
    if (!cellMap[k]) cellMap[k] = [];
    cellMap[k].push(r);
  });

  // Tổng cộng
  const grandAtc = recs.length;
  const grandDurMin = recs.reduce((sum, r) => sum + r.durMin, 0);
  const grandHours = (grandDurMin / 60).toFixed(1);

  // Tính tổng ngày công trong kỳ của các SC đang được chọn
  let grandCong = 0;
  const filteredDays = DAYS.filter(d => S.coach.has(d.coach) && d.d >= S.from && d.d <= S.to
    && (S.sc === 'all' || d.sc === S.sc)
    && (S.lead || !SCS[d.sc]?.lead)
    && (S.status === 'all' || (S.status === 'left') === SCS[d.sc]?.nghi)
    && scSet.includes(d.sc));

  filteredDays.forEach(d => { grandCong += d.c; });
  const grandTbCong = grandCong > 0 ? (grandAtc / grandCong).toFixed(2).replace('.', ',') : '–';

  // Cập nhật thẻ tóm tắt trên đầu Pivot
  $('pvSummaryAtc').textContent = n0(grandAtc);
  $('pvSummaryHours').textContent = grandHours + ' giờ';
  $('pvSubinfo').textContent = `Đang hiển thị ${scSet.length} người xử lý, ${activeDates.length} ngày | Giá trị: [Tổng số ca (Retailer ID)] / [Thời gian hỗ trợ (giờ)]`;

  // 1. TẠO HEADER TABLE
  let thead = '<thead><tr>';
  thead += '<th class="sc-th">Người xử lý</th>';
  activeDates.forEach(d => {
    const dayNum = parseInt(d.slice(8), 10);
    const dateFormatted = d.slice(8, 10) + '/' + d.slice(5, 7);
    thead += `<th><div>Ngày ${dayNum}</div><div class="mut sm" style="font-weight:normal">${dateFormatted}</div></th>`;
  });
  thead += '<th style="min-width:110px">Tổng cộng</th>';
  thead += '<th style="min-width:110px">TB ca/Ngày công</th>';
  thead += '</tr></thead>';

  // 2. TẠO BODY TABLE
  let tbody = '<tbody>';
  if (scSet.length === 0) {
    tbody += `<tr><td colspan="${activeDates.length + 3}" class="mut" style="padding:24px">Không tìm thấy dữ liệu nhân sự nào phù hợp với bộ lọc hiện tại.</td></tr>`;
  } else {
    scSet.forEach(sc => {
      const meta = SCS[sc] || scMeta(sc);
      const scRecs = recs.filter(r => r.sc === sc);
      const scTotalAtc = scRecs.length;
      const scTotalDurMin = scRecs.reduce((sum, r) => sum + r.durMin, 0);
      const scTotalHours = (scTotalDurMin / 60).toFixed(1);

      // Tính tổng công của SC này trong kỳ
      let scCong = 0;
      activeDates.forEach(d => {
        scCong += (congMap[sc + '|' + d] || 0);
      });
      const scTbCong = scCong > 0 ? (scTotalAtc / scCong).toFixed(2).replace('.', ',') : '–';

      tbody += '<tr>';
      tbody += `<td class="sc-td" title="${esc(sc)}">
        <span class="dot" style="background:${COLOR[scRecs[0]?.coach] || '#60a5fa'};margin-right:6px"></span>
        <b>${esc(meta.name)}</b>${meta.nghi ? ' <span class="mut sm">(nghỉ)</span>' : ''}
      </td>`;

      // Các cột ngày
      activeDates.forEach(d => {
        const list = cellMap[sc + '|' + d] || [];
        if (!list.length) {
          tbody += '<td class="mut" style="color:#2a3a55">–</td>';
        } else {
          const atc = list.length;
          const hrs = (list.reduce((sum, r) => sum + r.durMin, 0) / 60).toFixed(1);
          tbody += `<td class="pv-cell" onclick="openCellModal('${esc(sc)}', '${d}')" title="Bấm xem ${atc} ca của ${esc(meta.name)} ngày ${d}">
            <span class="pv-num">${atc}</span>
            <span class="pv-slash">/</span>
            <span class="pv-hrs">${hrs}</span>
          </td>`;
        }
      });

      // Cột Tổng cộng của SC
      tbody += `<td class="pv-tot pv-cell" onclick="openCellModal('${esc(sc)}', 'all')" title="Bấm xem tất cả ${scTotalAtc} ca của ${esc(meta.name)}">
        <span class="pv-num">${scTotalAtc}</span>
        <span class="pv-slash">/</span>
        <span class="pv-hrs">${scTotalHours}</span>
      </td>`;

      // Cột TB ca/Ngày công
      tbody += `<td class="pv-avg" title="TB ${scTotalAtc} ca / ${scCong} ngày công">${scTbCong}</td>`;

      tbody += '</tr>';
    });
  }
  tbody += '</tbody>';

  // 3. TẠO FOOTER TABLE (Grand Total)
  let tfoot = '<tfoot><tr>';
  tfoot += '<td class="sc-td">Grand Total</td>';
  activeDates.forEach(d => {
    const dayRecs = recs.filter(r => r.date === d);
    const dayAtc = dayRecs.length;
    const dayHrs = (dayRecs.reduce((sum, r) => sum + r.durMin, 0) / 60).toFixed(1);
    tfoot += `<td class="pv-cell" onclick="openCellModal('all', '${d}')" title="Bấm xem toàn bộ ${dayAtc} ca ngày ${d}">
      <span class="pv-num">${dayAtc}</span>
      <span class="pv-slash">/</span>
      <span class="pv-hrs">${dayHrs}</span>
    </td>`;
  });

  // Grand Total Tổng cộng
  tfoot += `<td class="pv-tot pv-cell" onclick="openCellModal('all', 'all')" title="Bấm xem toàn bộ ${grandAtc} ca">
    <span class="pv-num">${grandAtc}</span>
    <span class="pv-slash">/</span>
    <span class="pv-hrs">${grandHours}</span>
  </td>`;

  // Grand Total TB ca / Ngày công
  tfoot += `<td style="color:#f87171;font-weight:800;font-size:14px" title="Tổng ${grandAtc} ca / ${grandCong} ngày công">${grandTbCong}</td>`;
  tfoot += '</tr></tfoot>';

  $('pivotTbl').innerHTML = thead + tbody + tfoot;
  window._pivotState = { activeDates, scSet, recs };
}

/**
 * MODAL 1: Mở danh sách chi tiết các ca
 */
function openCellModal(sc, date) {
  let list = [];
  let sub = '';

  if (sc !== 'all' && date !== 'all') {
    list = RAW_RECORDS.filter(r => r.sc === sc && r.date === date);
    const meta = SCS[sc] || scMeta(sc);
    sub = `${meta.name} • Ngày ${date.split('-').reverse().join('/')}`;
  } else if (sc !== 'all' && date === 'all') {
    list = RAW_RECORDS.filter(r => r.sc === sc && r.date >= S.from && r.date <= S.to);
    const meta = SCS[sc] || scMeta(sc);
    sub = `${meta.name} • Toàn bộ kỳ báo cáo (${S.from.split('-').reverse().join('/')} đến ${S.to.split('-').reverse().join('/')})`;
  } else if (sc === 'all' && date !== 'all') {
    list = RAW_RECORDS.filter(r => S.coach.has(r.coach) && r.date === date);
    sub = `Tất cả nhân sự • Ngày ${date.split('-').reverse().join('/')}`;
  } else {
    list = getFilteredRawRecords();
    sub = `Toàn bộ record theo bộ lọc hiện tại`;
  }

  if (!list.length) return;

  CURRENT_MODAL_LIST = list;
  $('mTitle').innerHTML = `Danh sách chi tiết (${list.length} dòng)`;
  $('mSubtitle').textContent = sub;

  let html = '';
  list.forEach(rec => {
    const meta = SCS[rec.sc] || scMeta(rec.sc);
    const hrs = (rec.durMin / 60).toFixed(2);
    html += `
    <div class="atc-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="color:#38bdf8;font-weight:800;font-size:14px">Retailer ID: ${esc(rec.retailerId || '–')}</span>
        <button class="link-btn" onclick="openRecordDetail(${rec.idx})">Xem chi tiết ➔</button>
      </div>
      <div style="font-size:12px;color:#cbd5e1;line-height:1.6">
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div><b>Nhân sự:</b> ${esc(meta.name)}</div>
          <div><b>Giờ hỗ trợ:</b> <span style="color:var(--ok);font-weight:700">${hrs} giờ</span> <span class="mut sm">(${rec.durMin} phút)</span></div>
        </div>
        <div style="display:flex;justify-content:space-between;color:var(--mut);font-size:11px;margin-top:2px">
          <div><b>Checkin:</b> <span style="font-family:monospace;color:#f1f5f9">${rec.ciTime}</span></div>
          <div><b>Checkout:</b> <span style="font-family:monospace;color:#f1f5f9">${rec.coTime}</span></div>
        </div>
        <div style="margin-top:4px;color:#94a3b8">
          <b>Địa điểm:</b> <span style="color:#e2e8f0">${esc(rec.address || '–')}</span>
        </div>
        ${rec.task ? `<div style="margin-top:2px;color:#94a3b8"><b>Công việc:</b> <span style="color:#e2e8f0">${esc(rec.task)}</span></div>` : ''}
      </div>
    </div>`;
  });

  $('mCardList').innerHTML = html;
  $('cardListModal').style.display = 'flex';
}

/**
 * MODAL 2: Chi tiết đầy đủ 24 trường của 1 Record
 */
function openRecordDetail(idx) {
  const rec = RAW_RECORDS.find(r => r.idx === idx);
  if (!rec) return;
  CURRENT_RECORD = rec;

  $('cardListModal').style.display = 'none';
  $('rRetailerId').textContent = rec.retailerId || '–';

  const h = {};
  ALL_HEADERS.forEach((c, i) => h[c] = i);
  const raw = rec.raw;
  const getV = col => raw[h[col]] != null && raw[h[col]] !== '' ? raw[h[col]] : '–';

  const meta = SCS[rec.sc] || scMeta(rec.sc);
  const hrs = (rec.durMin / 60).toFixed(2);
  const imp = rec.impact === 1;

  let body = `
  <!-- 1. THÔNG TIN CHUNG -->
  <div class="record-sec">
    <h4>🏢 Thông tin chung & Hợp đồng</h4>
    <div class="record-grid">
      <div class="record-item"><span class="record-label">Retailer ID</span><span class="record-val" style="color:#38bdf8;font-size:14px">${esc(rec.retailerId)}</span></div>
      <div class="record-item"><span class="record-label">Người xử lý</span><span class="record-val">${esc(meta.name)} <span class="mut sm">(${esc(rec.sc)})</span></span></div>
      <div class="record-item"><span class="record-label">Coacher</span><span class="record-val"><span class="dot" style="background:${COLOR[rec.coach] || '#60a5fa'}"></span> <b>${esc(rec.coach)}</b></span></div>
      <div class="record-item"><span class="record-label">Ngày</span><span class="record-val" style="font-family:monospace">${esc(rec.date)}</span></div>
      <div class="record-item"><span class="record-label">Nguồn data</span><span class="record-val"><span class="badge b-load">${esc(getV('Nguồn data'))}</span></span></div>
      <div class="record-item"><span class="record-label">Gói hợp đồng</span><span class="record-val">${esc(getV('Gói hợp đồng'))}</span></div>
      <div class="record-item"><span class="record-label">Product</span><span class="record-val">${esc(getV('Product'))}</span></div>
    </div>
  </div>

  <!-- 2. THỜI GIAN & ĐỊA ĐIỂM -->
  <div class="record-sec">
    <h4>⏱️ Thời gian Checkin / Checkout & Địa điểm</h4>
    <div class="record-grid">
      <div class="record-item"><span class="record-label">Thời gian checkin</span><span class="record-val" style="color:#34d399;font-family:monospace">${rec.ciTime}</span></div>
      <div class="record-item"><span class="record-label">Thời gian checkout</span><span class="record-val" style="color:#f59e0b;font-family:monospace">${rec.coTime}</span></div>
      <div class="record-item"><span class="record-label">Thời lượng hỗ trợ</span><span class="record-val" style="color:var(--ok)">${hrs} giờ (${rec.durMin} phút)</span></div>
      <div class="record-item"><span class="record-label">Thực trạng khi đến</span><span class="record-val">${esc(getV('Thực trạng khi đến'))}</span></div>
    </div>
    <div style="margin-top:8px" class="record-item">
      <span class="record-label">Địa điểm thực tế cửa hàng</span>
      <span class="record-val" style="color:#e2e8f0">${esc(getV('Địa điểm thực tế cửa hàng'))}</span>
    </div>
  </div>

  <!-- 3. NỘI DUNG HỖ TRỢ & TRAO ĐỔI -->
  <div class="record-sec">
    <h4>📝 Nội dung hỗ trợ & Trao đổi khách hàng</h4>
    <div class="record-item" style="margin-bottom:8px">
      <span class="record-label">Công việc hỗ trợ KH</span>
      <span class="record-val" style="color:#60a5fa">${esc(getV('Công việc hỗ trợ KH'))}</span>
    </div>
    <div class="record-item" style="margin-bottom:8px">
      <span class="record-label">Mô tả chi tiết</span>
      <div style="background:#0b1220;padding:8px 10px;border-radius:6px;border:1px solid #1c273e;line-height:1.5;color:#e2e8f0;white-space:pre-wrap">${esc(getV('Mô tả'))}</div>
    </div>
    <div class="record-grid">
      <div class="record-item"><span class="record-label">Thực trạng trao đổi</span><span class="record-val">${esc(getV('Thực trạng trao đổi'))}</span></div>
      <div class="record-item"><span class="record-label">Tính năng</span><span class="record-val">${esc(getV('Tính năng'))}</span></div>
    </div>
  </div>

  <!-- 4. ĐÁNH GIÁ & KẾT QUẢ -->
  <div class="record-sec">
    <h4>🎯 Kết quả & Đánh giá hiệu quả</h4>
    <div class="record-grid">
      <div class="record-item"><span class="record-label">Số KH tư vấn (Impact)</span><span class="record-val"><span class="badge ${imp ? 'b-live' : 'b-snap'}">${imp ? '1 - Có Impact' : '0 - Không có Impact'}</span></span></div>
      <div class="record-item"><span class="record-label">Addon</span><span class="record-val"><b>${esc(getV('Addon'))}</b></span></div>
      <div class="record-item"><span class="record-label">KH tiếp cận</span><span class="record-val">${esc(getV('KH tiếp cận'))}</span></div>
      <div class="record-item"><span class="record-label">Tình trạng xử lý</span><span class="record-val">${esc(getV('Tình trạng xử lý'))}</span></div>
      <div class="record-item"><span class="record-label">Tình trạng liên hệ</span><span class="record-val">${esc(getV('Tình trạng liên hệ'))}</span></div>
      <div class="record-item"><span class="record-label">Tình trạng sử dụng PM</span><span class="record-val">${esc(getV('Tình trạng sử dụng phần mềm'))}</span></div>
    </div>
  </div>

  <!-- 5. DẤU VẾT HỆ THỐNG -->
  <div class="record-sec" style="margin-bottom:0">
    <h4>🕒 Dấu vết hệ thống CRM</h4>
    <div class="record-grid">
      <div class="record-item"><span class="record-label">Thời gian tạo</span><span class="record-val mut sm">${esc(getV('Thời gian tạo'))}</span></div>
      <div class="record-item"><span class="record-label">Thời gian chỉnh sửa</span><span class="record-val mut sm">${esc(getV('Thời gian chỉnh sửa'))}</span></div>
    </div>
  </div>
  `;

  $('rDetailBody').innerHTML = body;
  $('recordDetailModal').style.display = 'flex';
}

function backToCardList() {
  $('recordDetailModal').style.display = 'none';
  $('cardListModal').style.display = 'flex';
}

function closeModals() {
  $('cardListModal').style.display = 'none';
  $('recordDetailModal').style.display = 'none';
}

function handleBackdropClick(e, modalId) {
  if (e.target.id === modalId) {
    closeModals();
  }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if ($('recordDetailModal').style.display === 'flex') {
      backToCardList();
    } else {
      closeModals();
    }
  }
});

function copyRecordData() {
  if (!CURRENT_RECORD) return;
  const h = {};
  ALL_HEADERS.forEach((c, i) => h[c] = i);
  const out = {};
  ALL_HEADERS.forEach(col => { out[col] = CURRENT_RECORD.raw[h[col]]; });
  navigator.clipboard.writeText(JSON.stringify(out, null, 2)).then(() => {
    alert('Đã sao chép toàn bộ dữ liệu 24 trường của Record vào Clipboard!');
  });
}

function exportPivotCsv() {
  const pState = window._pivotState;
  if (!pState || !pState.activeDates.length) return;
  const { activeDates, scSet, recs } = pState;

  const congMap = {};
  DAYS.forEach(d => { congMap[d.sc + '|' + d.d] = d.c; });

  const cellMap = {};
  recs.forEach(r => {
    const k = r.sc + '|' + r.date;
    if (!cellMap[k]) cellMap[k] = [];
    cellMap[k].push(r);
  });

  const head = ['Người xử lý', 'Coacher'].concat(activeDates.map(d => `Ngày ${parseInt(d.slice(8))} (${d.slice(8, 10)}/${d.slice(5, 7)})`)).concat(['Tổng cộng (Ca / Giờ)', 'TB ca/Ngày công']);

  const rows = scSet.map(sc => {
    const meta = SCS[sc] || scMeta(sc);
    const scRecs = recs.filter(r => r.sc === sc);
    const scTotalAtc = scRecs.length;
    const scTotalHours = (scRecs.reduce((sum, r) => sum + r.durMin, 0) / 60).toFixed(1);

    let scCong = 0;
    activeDates.forEach(d => { scCong += (congMap[sc + '|' + d] || 0); });
    const scTbCong = scCong > 0 ? (scTotalAtc / scCong).toFixed(2) : '';

    const row = [meta.name, scRecs[0]?.coach || ''];
    activeDates.forEach(d => {
      const list = cellMap[sc + '|' + d] || [];
      if (!list.length) {
        row.push('');
      } else {
        const hrs = (list.reduce((sum, r) => sum + r.durMin, 0) / 60).toFixed(1);
        row.push(`${list.length} / ${hrs}`);
      }
    });
    row.push(`${scTotalAtc} / ${scTotalHours}`);
    row.push(scTbCong);
    return row;
  });

  // Dòng Grand Total
  const grandAtc = recs.length;
  const grandHours = (recs.reduce((sum, r) => sum + r.durMin, 0) / 60).toFixed(1);
  let grandCong = 0;
  const filteredDays = DAYS.filter(d => S.coach.has(d.coach) && d.d >= S.from && d.d <= S.to
    && (S.sc === 'all' || d.sc === S.sc)
    && (S.lead || !SCS[d.sc]?.lead)
    && (S.status === 'all' || (S.status === 'left') === SCS[d.sc]?.nghi)
    && scSet.includes(d.sc));
  filteredDays.forEach(d => { grandCong += d.c; });
  const grandTbCong = grandCong > 0 ? (grandAtc / grandCong).toFixed(2) : '';

  const grandRow = ['Grand Total', ''];
  activeDates.forEach(d => {
    const dayRecs = recs.filter(r => r.date === d);
    const dayHrs = (dayRecs.reduce((sum, r) => sum + r.durMin, 0) / 60).toFixed(1);
    grandRow.push(`${dayRecs.length} / ${dayHrs}`);
  });
  grandRow.push(`${grandAtc} / ${grandHours}`);
  grandRow.push(grandTbCong);
  rows.push(grandRow);

  const csv = '\ufeff' + [head].concat(rows).map(l => l.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `chi_tiet_atc_ngay_${S.from}_${S.to}.csv`;
  a.click();
}
