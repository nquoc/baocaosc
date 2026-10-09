/**
 * app.js - Điều hướng tab, lắng nghe sự kiện bộ lọc, khởi tạo luồng dữ liệu chính và Smart Cache
 */

/* ---------- Chuyển đổi Tab ---------- */
function switchTab(tab) {
  activeTab = tab;
  $('tabBtnOverview').className = 'tab-btn' + (tab === 'overview' ? ' active' : '');
  $('tabBtnPivot').className = 'tab-btn' + (tab === 'pivot' ? ' active' : '');
  $('tabBtnTarget').className = 'tab-btn' + (tab === 'target' ? ' active' : '');
  $('tabBtnKpi').className = 'tab-btn' + (tab === 'kpi' ? ' active' : '');
  if ($('tabBtnPhanCung')) $('tabBtnPhanCung').className = 'tab-btn' + (tab === 'phancung' ? ' active' : '');

  $('overviewSection').style.display = tab === 'overview' ? 'block' : 'none';
  $('pivotSection').style.display = tab === 'pivot' ? 'block' : 'none';
  $('targetSection').style.display = tab === 'target' ? 'block' : 'none';
  $('kpiSection').style.display = tab === 'kpi' ? 'block' : 'none';
  if ($('phancungSection')) $('phancungSection').style.display = tab === 'phancung' ? 'block' : 'none';

  $('filters').style.display = (tab === 'target' || tab === 'kpi' || tab === 'phancung') ? 'none' : 'flex';

  if (tab === 'pivot') {
    renderPivot();
  } else if (tab === 'target') {
    if (!MUCTIEU_STATE.offline || !MUCTIEU_STATE.online) {
      loadMuctieu(false);
    } else {
      renderMuctieu();
    }
  } else if (tab === 'kpi') {
    if (!KPI_RAW_DATA.length) {
      loadKpi(false);
    } else {
      renderKpi();
    }
  } else if (tab === 'phancung') {
    if (!PHANCUNG_STATE.data) {
      loadPhanCung(false);
    } else {
      renderPhanCung();
    }
  } else {
    // Resize charts nếu cần
    Object.values(charts).forEach(c => c && c.resize && c.resize());
  }
}

/* ---------- Lắng nghe sự kiện bộ lọc ---------- */
if ($('fSc')) $('fSc').onchange = e => { S.sc = e.target.value; render(); };
if ($('fStatus')) $('fStatus').onchange = e => { S.status = e.target.value; render(); };
if ($('fTarget')) $('fTarget').oninput = e => { S.target = parseFloat(e.target.value) || 0; render(); };
if ($('fMin')) $('fMin').oninput = e => { S.minDays = parseInt(e.target.value) || 1; render(); };

if ($('fMonth')) {
  $('fMonth').onchange = e => {
    const m = e.target.value;
    S.month = m;
    if (m === 'all') {
      S.from = DATES[0];
      S.to = DATES[DATES.length - 1];
    } else if (m !== 'custom') {
      const mDates = DATES.filter(d => d.startsWith(m));
      if (mDates.length) {
        S.from = mDates[0];
        S.to = mDates[mDates.length - 1];
      }
    }
    $('fFrom').value = S.from;
    $('fTo').value = S.to;
    buildScSelect();
    render();
  };
}

function onDateChange() {
  const matchingMonth = MONTHS.find(m => {
    const mDates = DATES.filter(d => d.startsWith(m));
    return S.from === mDates[0] && S.to === mDates[mDates.length - 1];
  });
  if (matchingMonth) {
    S.month = matchingMonth;
    $('fMonth').value = matchingMonth;
  } else if (S.from === DATES[0] && S.to === DATES[DATES.length - 1]) {
    S.month = 'all';
    $('fMonth').value = 'all';
  } else {
    S.month = 'custom';
    $('fMonth').value = 'custom';
  }
  buildScSelect();
  render();
}

if ($('fFrom')) $('fFrom').onchange = e => { S.from = e.target.value || DATES[0]; onDateChange(); };
if ($('fTo')) $('fTo').onchange = e => { S.to = e.target.value || DATES[DATES.length - 1]; onDateChange(); };
if ($('fMetric')) $('fMetric').onchange = e => { S.metric = e.target.value; render(); };

function resetFilters() {
  S.coach = new Set(COACHES);
  S.sc = 'all';
  S.status = 'all';
  S.lead = false;
  S.month = MONTHS[0] || 'all';
  if (S.month !== 'all') {
    const mDates = DATES.filter(d => d.startsWith(S.month));
    S.from = mDates[0];
    S.to = mDates[mDates.length - 1];
  } else {
    S.from = DATES[0];
    S.to = DATES[DATES.length - 1];
  }
  S.target = 6;
  S.minDays = 5;
  S.metric = 'atcPerCong';
  if ($('fStatus')) $('fStatus').value = 'all';
  if ($('fMonth')) $('fMonth').value = S.month;
  if ($('fFrom')) $('fFrom').value = S.from;
  if ($('fTo')) $('fTo').value = S.to;
  if ($('fTarget')) $('fTarget').value = 6;
  if ($('fMin')) $('fMin').value = 5;
  if ($('fMetric')) $('fMetric').value = 'atcPerCong';
  if ($('pvSearch')) $('pvSearch').value = '';
  buildCoachPills();
  buildMonthSelect();
  buildScSelect();
  render();
}

/* ---------- Khởi tạo sau khi có dữ liệu (baocaotong) ---------- */
function setData(headers, data, label, cls) {
  ALL_HEADERS = headers;
  const recs = normalize(headers, data);
  DAYS = buildDays(recs);
  SCS = {};
  DAYS.forEach(d => { if (!SCS[d.sc]) SCS[d.sc] = scMeta(d.sc); });
  COACHES = [...new Set(DAYS.map(d => d.coach))].sort((a, b) => a.localeCompare(b, 'vi'));
  COACHES.forEach((c, i) => COLOR[c] = PALETTE[i % PALETTE.length]);
  DATES = [...new Set(DAYS.map(d => d.d))].sort();
  MONTHS = [...new Set(DATES.map(d => d.slice(0, 7)))].sort().reverse();

  if (!S.coach.size) COACHES.forEach(c => S.coach.add(c));
  else COACHES.forEach(c => { if (![...S.coach].length) S.coach.add(c); });

  // Mặc định chọn tháng mới nhất nếu chưa có tháng được chọn
  if (!S.month || S.month === 'all') {
    S.month = MONTHS[0] || 'all';
  }
  if (S.month !== 'all' && S.month !== 'custom') {
    const mDates = DATES.filter(d => d.startsWith(S.month));
    if (mDates.length) {
      S.from = mDates[0];
      S.to = mDates[mDates.length - 1];
    } else {
      S.from = DATES[0];
      S.to = DATES[DATES.length - 1];
    }
  } else {
    S.from = DATES[0];
    S.to = DATES[DATES.length - 1];
  }

  if ($('fFrom') && $('fTo')) {
    $('fFrom').min = $('fTo').min = DATES[0];
    $('fFrom').max = $('fTo').max = DATES[DATES.length - 1];
    $('fFrom').value = S.from;
    $('fTo').value = S.to;
  }

  buildCoachPills();
  buildMonthSelect();
  buildScSelect();
  if ($('src')) {
    $('src').className = 'badge ' + cls;
    $('src').textContent = label + ' · ' + n0(recs.length) + ' record';
  }
  render();
}

/* ---------- Tải dữ liệu: Smart Cache (IndexedDB) -> API trực tiếp ---------- */
async function loadLive(isSilent = false) {
  const btn = $('btnReloadApi');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Đang tải API…';
  }
  if (!isSilent || !DAYS.length) {
    if ($('src')) {
      $('src').className = 'badge b-load';
      $('src').textContent = 'Đang tải API…';
    }
  }

  const cacheBusterUrl = API + (API.includes('?') ? '&' : '?') + '_t=' + Date.now();
  console.log('%c[API CALL] 🚀 Đang gửi yêu cầu tới Google Apps Script API...', 'color:#3b82f6;font-weight:bold;font-size:12px');
  console.log('[API CALL] Endpoint:', cacheBusterUrl);

  try {
    const j = await safeFetchJson(cacheBusterUrl, 2);
    if (j.status !== 'success' || !Array.isArray(j.data)) throw new Error(j.status || 'Dữ liệu không hợp lệ');
    const now = new Date();
    const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const rowCount = j.data.length - 1;

    // Lưu vào IndexedDB để mở tức thì cho các lần mở trang tiếp theo trong 20 phút
    await setCachedData({
      headers: j.data[0],
      data: j.data,
      rowCount: rowCount,
      savedAt: Date.now(),
      timeStr: timeStr
    });
    console.log(`%c[CACHE SAVED] 💾 Đã lưu ${rowCount.toLocaleString('vi-VN')} records vào bộ nhớ đệm IndexedDB lúc ${timeStr}!`, 'color:#06b6d4;font-size:11px');

    console.log(`%c[API SUCCESS] ✅ Tải thành công ${rowCount.toLocaleString('vi-VN')} records từ sheet baocaotong lúc ${timeStr}!`, 'color:#10b981;font-weight:bold;font-size:12px');
    setData(j.data[0], j.data, 'API trực tiếp ' + timeStr, 'b-live');
    showToast(`Đã đồng bộ thành công ${rowCount.toLocaleString('vi-VN')} records từ Google Sheets lúc ${timeStr}!`, true);
  } catch (e) {
    console.error('[API ERROR] Lỗi khi gọi API Google Apps Script:', e);
    if (DAYS.length) {
      if ($('src')) {
        $('src').className = 'badge b-err';
        $('src').textContent = 'API lỗi — giữ dữ liệu hiện tại';
      }
      showToast('Không kết nối được API mới nhất — vẫn giữ dữ liệu hiện tại.', false);
    } else if (window.SNAPSHOT) {
      setData(window.SNAPSHOT.headers, window.SNAPSHOT.data, 'Snapshot ' + window.SNAPSHOT.fetchedAt + ' (API lỗi)', 'b-snap');
      showToast('Không kết nối được API — đang hiển thị dữ liệu từ Snapshot dự phòng.', false);
    } else {
      if ($('src')) {
        $('src').className = 'badge b-err';
        $('src').textContent = 'Lỗi kết nối API';
      }
      showToast('Lỗi khi tải API: ' + (e.message || 'Không kết nối được'), false);
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '⟳ Tải lại API';
    }
  }
}

async function initData() {
  // 1. Kiểm tra IndexedDB Smart Cache
  const cached = await getCachedData();
  if (cached && Array.isArray(cached.data) && cached.data.length > 1) {
    const ageMs = Date.now() - (cached.savedAt || 0);
    const rowCount = cached.rowCount || (cached.data.length - 1);
    const minsAgo = Math.max(0, Math.floor(ageMs / 60000));
    const timeLabel = minsAgo === 0 ? 'vừa xong' : `${minsAgo} phút trước`;

    if (ageMs < CACHE_TTL_MS) {
      // Còn hạn (< 20 phút): Mở tức thì < 0.05s, không gọi mạng
      console.log(`%c[CACHE HIT] ⚡ Dùng dữ liệu bộ nhớ đệm (${timeLabel}, ${rowCount.toLocaleString('vi-VN')} records). Không cần tải mạng.`, 'color:#06b6d4;font-weight:bold;font-size:12px');
      setData(cached.headers, cached.data, `Bộ nhớ đệm (${timeLabel})`, 'b-cache');
      showToast(`⚡ Đã tải tức thì ${rowCount.toLocaleString('vi-VN')} records từ bộ nhớ đệm (${timeLabel}). Bấm "⟳ Tải lại API" để cập nhật mới nhất nếu cần.`, true);
      return;
    } else {
      // Hết hạn (> 20 phút): Hiển thị ngay bộ nhớ đệm cũ để người dùng xem ngay, đồng thời gọi API ngầm
      console.log(`%c[CACHE EXPIRED] ⏳ Dữ liệu bộ nhớ đệm đã cũ (${timeLabel}). Đang tải cập nhật ngầm từ API...`, 'color:#eab308;font-weight:bold;font-size:12px');
      setData(cached.headers, cached.data, `Bộ nhớ đệm cũ (${timeLabel}) · Đang cập nhật…`, 'b-load');
      loadLive(true);
      return;
    }
  }

  // 2. Chưa có cache (lần đầu tiên mở): Dùng snapshot dự phòng nếu có, sau đó tải live
  if (window.SNAPSHOT) {
    setData(window.SNAPSHOT.headers, window.SNAPSHOT.data, 'Snapshot ' + window.SNAPSHOT.fetchedAt + ' (đang tải API…)', 'b-snap');
  }
  loadLive(false);
}

// Khởi chạy giao diện và nạp dữ liệu khi script sẵn sàng
initTheme();
initData();
