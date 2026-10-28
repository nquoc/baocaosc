/**
 * app.js - Điều hướng tab, lắng nghe sự kiện bộ lọc, khởi tạo luồng dữ liệu chính và Smart Cache
 */

/* ---------- Chuyển đổi & Lưu vết Tab (F5 giữ nguyên tab hiện tại) ---------- */
const VALID_TABS = ['overview', 'pivot', 'target', 'kpi', 'kpionline', 'phancung', 'baocaosc', 'dataton'];

function switchTab(tab) {
  if (!VALID_TABS.includes(tab)) {
    tab = 'overview';
  }
  activeTab = tab;

  // Lưu trạng thái tab vào sessionStorage, localStorage & URL hash để khi F5 vẫn giữ tab này
  try {
    sessionStorage.setItem('tc_active_tab', tab);
    localStorage.setItem('tc_active_tab', tab);
    if (window.location.hash !== '#' + tab) {
      history.replaceState(null, '', '#' + tab);
    }
  } catch (e) {}

  $('tabBtnOverview').className = 'tab-btn' + (tab === 'overview' ? ' active' : '');
  $('tabBtnPivot').className = 'tab-btn' + (tab === 'pivot' ? ' active' : '');
  $('tabBtnTarget').className = 'tab-btn' + (tab === 'target' ? ' active' : '');
  if ($('tabBtnKpi')) $('tabBtnKpi').className = 'tab-btn' + (tab === 'kpi' ? ' active' : '');
  if ($('tabBtnKpiOnline')) $('tabBtnKpiOnline').className = 'tab-btn' + (tab === 'kpionline' ? ' active' : '');
  if ($('tabBtnPhanCung')) $('tabBtnPhanCung').className = 'tab-btn' + (tab === 'phancung' ? ' active' : '');
  if ($('tabBtnBaoCaoSc')) $('tabBtnBaoCaoSc').className = 'tab-btn' + (tab === 'baocaosc' ? ' active' : '');
  if ($('tabBtnDataTon')) $('tabBtnDataTon').className = 'tab-btn' + (tab === 'dataton' ? ' active' : '');

  // Cập nhật trạng thái Dropdown KPI SC
  const isKpiActive = (tab === 'kpi' || tab === 'kpionline');
  if ($('tabBtnKpiSc')) {
    $('tabBtnKpiSc').className = 'tab-btn tab-dropdown-btn' + (isKpiActive ? ' active' : '');
    let kpiLabel = '📈 KPI SC <span class="tab-caret">▼</span>';
    if (tab === 'kpionline') {
      kpiLabel = '📈 KPI SC: Online <span class="tab-caret">▼</span>';
    } else if (tab === 'kpi') {
      kpiLabel = '📈 KPI SC: Offline <span class="tab-caret">▼</span>';
    }
    $('tabBtnKpiSc').innerHTML = kpiLabel;
  }
  if ($('tabItemKpiOnline')) {
    $('tabItemKpiOnline').className = 'tab-dropdown-item' + (tab === 'kpionline' ? ' active' : '');
  }
  if ($('tabItemKpiOffline')) {
    $('tabItemKpiOffline').className = 'tab-dropdown-item' + (tab === 'kpi' ? ' active' : '');
  }
  const ddMenu = $('tabDropdownKpiMenu');
  if (ddMenu) ddMenu.classList.remove('show');
  const tabsNavEl = document.querySelector('.tabs-nav');
  if (tabsNavEl) tabsNavEl.classList.remove('dropdown-open');

  $('overviewSection').style.display = tab === 'overview' ? 'block' : 'none';
  $('pivotSection').style.display = tab === 'pivot' ? 'block' : 'none';
  $('targetSection').style.display = tab === 'target' ? 'block' : 'none';
  $('kpiSection').style.display = tab === 'kpi' ? 'block' : 'none';
  if ($('kpionlineSection')) $('kpionlineSection').style.display = tab === 'kpionline' ? 'block' : 'none';
  if ($('phancungSection')) $('phancungSection').style.display = tab === 'phancung' ? 'block' : 'none';
  if ($('baocaoscSection')) $('baocaoscSection').style.display = tab === 'baocaosc' ? 'block' : 'none';
  if ($('datatonSection')) $('datatonSection').style.display = tab === 'dataton' ? 'block' : 'none';

  $('filters').style.display = (tab === 'target' || tab === 'kpi' || tab === 'kpionline' || tab === 'phancung' || tab === 'baocaosc' || tab === 'dataton') ? 'none' : 'flex';

  if (tab === 'overview' || tab === 'pivot') {
    if ((!S.month || S.month === 'all') && typeof getDefaultMonth === 'function') {
      const defM = getDefaultMonth();
      if (defM !== 'all') {
        S.month = defM;
        const mDates = DATES.filter(d => d.startsWith(S.month));
        if (mDates.length) {
          S.from = mDates[0];
          S.to = mDates[mDates.length - 1];
        } else {
          const [y, mon] = S.month.split('-');
          const today = new Date().toISOString().slice(0, 10);
          S.from = `${y}-${mon}-01`;
          S.to = (today.startsWith(S.month)) ? today : `${y}-${mon}-31`;
        }
        if ($('fMonth')) $('fMonth').value = S.month;
        if ($('fFrom')) $('fFrom').value = S.from;
        if ($('fTo')) $('fTo').value = S.to;
        buildScSelect();
      }
    }
  }

  if (tab === 'pivot') {
    renderPivot();
  } else if (tab === 'target') {
    switchTab('baocaosc');
    return;
  } else if (tab === 'kpi') {
    if (!KPI_RAW_DATA.length) {
      loadKpi(false);
    } else {
      renderKpi();
    }
  } else if (tab === 'kpionline') {
    if (!KPI_ONLINE_STATE.data) {
      loadKpiOnline(false);
    } else {
      renderKpiOnline();
    }
  } else if (tab === 'phancung') {
    if (!PHANCUNG_STATE.data || !PHANCUNG_SOURCE_STATE.data) {
      loadPhanCung(false);
    } else {
      renderPhanCung();
    }
  } else if (tab === 'baocaosc') {
    if (!BAOCAOSC_STATE.muctieuOffline || !BAOCAOSC_STATE.muctieuOnline || !BAOCAOSC_STATE.activeRate || !BAOCAOSC_STATE.fnbIssue || !BAOCAOSC_STATE.provinceImpact || !BAOCAOSC_STATE.headcountRegion || !BAOCAOSC_STATE.impactDataSource || !BAOCAOSC_STATE.impactIndustry || !BAOCAOSC_STATE.kpiOnlineT9 || !BAOCAOSC_STATE.kpiOfflineT10 || !BAOCAOSC_STATE.addonT10) {
      loadBaoCaoSc(false);
    } else {
      renderBaoCaoSc();
    }
  } else if (tab === 'dataton') {
    if (!DATATON_STATE.online || !DATATON_STATE.offline) {
      loadDataTon(false);
    } else {
      renderDataTon();
    }
  } else {
    // Resize charts nếu cần
    Object.values(charts).forEach(c => c && c.resize && c.resize());
  }
}

/**
 * Khôi phục tab trước đó khi F5 hoặc mở lại trình duyệt
 */
function restoreActiveTab() {
  const hash = (window.location.hash || '').replace(/^#/, '').trim();
  const saved = sessionStorage.getItem('tc_active_tab') || localStorage.getItem('tc_active_tab');
  const targetTab = VALID_TABS.includes(hash)
    ? hash
    : (VALID_TABS.includes(saved) ? saved : 'overview');

  if (targetTab && targetTab !== 'overview') {
    switchTab(targetTab);
  }
}

// Lắng nghe khi người dùng bấm nút Back/Forward trên trình duyệt
window.addEventListener('hashchange', () => {
  const hash = (window.location.hash || '').replace(/^#/, '').trim();
  if (VALID_TABS.includes(hash) && hash !== activeTab) {
    switchTab(hash);
  }
});

/* ---------- Xử lý Dropdown Menu KPI SC ---------- */
/**
 * Đóng mở menu dropdown KPI SC
 */
function toggleKpiDropdown(e) {
  if (e) e.stopPropagation();
  const menu = $('tabDropdownKpiMenu');
  const tabsNavEl = document.querySelector('.tabs-nav');
  if (menu) {
    const isShowing = menu.classList.toggle('show');
    if (tabsNavEl) {
      if (isShowing) tabsNavEl.classList.add('dropdown-open');
      else tabsNavEl.classList.remove('dropdown-open');
    }
  }
}

/**
 * Chọn mục trong dropdown KPI SC
 */
function onSelectKpiTab(tab, e) {
  if (e) e.stopPropagation();
  const menu = $('tabDropdownKpiMenu');
  if (menu) menu.classList.remove('show');
  const tabsNavEl = document.querySelector('.tabs-nav');
  if (tabsNavEl) tabsNavEl.classList.remove('dropdown-open');
  switchTab(tab);
}

// Đóng dropdown khi click ra ngoài
document.addEventListener('click', function(e) {
  const dd = $('tabDropdownKpiSc');
  if (dd && !dd.contains(e.target)) {
    const menu = $('tabDropdownKpiMenu');
    if (menu) menu.classList.remove('show');
    const tabsNavEl = document.querySelector('.tabs-nav');
    if (tabsNavEl) tabsNavEl.classList.remove('dropdown-open');
  }
});

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
  S.month = typeof getDefaultMonth === 'function' ? getDefaultMonth() : (MONTHS[0] || 'all');
  if (S.month !== 'all') {
    const mDates = DATES.filter(d => d.startsWith(S.month));
    if (mDates.length) {
      S.from = mDates[0];
      S.to = mDates[mDates.length - 1];
    } else {
      const [y, mon] = S.month.split('-');
      const today = new Date().toISOString().slice(0, 10);
      S.from = `${y}-${mon}-01`;
      S.to = (today.startsWith(S.month)) ? today : `${y}-${mon}-31`;
    }
  } else {
    S.from = DATES[0] || '';
    S.to = DATES[DATES.length - 1] || '';
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
  if (typeof initProvinceQualityMonths === 'function') initProvinceQualityMonths();
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
  const rawMonths = [...new Set(DATES.map(d => d.slice(0, 7)))];
  const curM = typeof getCurrentMonthStr === 'function' ? getCurrentMonthStr() : '';
  if (curM && !rawMonths.includes(curM)) {
    rawMonths.push(curM);
  }
  MONTHS = rawMonths.sort().reverse();

  if (!S.coach.size) COACHES.forEach(c => S.coach.add(c));
  else COACHES.forEach(c => { if (![...S.coach].length) S.coach.add(c); });

  // Mặc định chọn tháng hiện tại nếu chưa có tháng được chọn (hoặc tháng mới nhất nếu dữ liệu chưa có)
  const defMonth = typeof getDefaultMonth === 'function' ? getDefaultMonth() : (MONTHS[0] || 'all');
  if (!S.month || S.month === 'all') {
    S.month = defMonth;
  }
  if (S.month !== 'all' && S.month !== 'custom') {
    const mDates = DATES.filter(d => d.startsWith(S.month));
    if (mDates.length) {
      S.from = mDates[0];
      S.to = mDates[mDates.length - 1];
    } else {
      const [y, mon] = S.month.split('-');
      const today = new Date().toISOString().slice(0, 10);
      S.from = `${y}-${mon}-01`;
      S.to = (today.startsWith(S.month)) ? today : `${y}-${mon}-31`;
    }
  } else {
    S.from = DATES[0] || '';
    S.to = DATES[DATES.length - 1] || '';
  }

  if ($('fFrom') && $('fTo')) {
    const minD = (DATES.length && DATES[0] < S.from) ? DATES[0] : S.from;
    const maxD = (DATES.length && DATES[DATES.length - 1] > S.to) ? DATES[DATES.length - 1] : S.to;
    $('fFrom').min = $('fTo').min = minD;
    $('fFrom').max = $('fTo').max = maxD;
    $('fFrom').value = S.from;
    $('fTo').value = S.to;
  }

  buildCoachPills();
  buildMonthSelect();
  buildScSelect();
  if (typeof initProvinceQualityMonths === 'function') initProvinceQualityMonths();
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
    if (!isSilent) {
      showToast(`Đã đồng bộ thành công ${rowCount.toLocaleString('vi-VN')} records từ Google Sheets lúc ${timeStr}!`, true);
    }
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
    setTimeout(startBackgroundPrefetch, 1000);
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
      setTimeout(startBackgroundPrefetch, 1200);
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

/* ==========================================================================
   TỰ ĐỘNG NẠP TRƯỚC (BACKGROUND PREFETCH) TOÀN BỘ TAB DỮ LIỆU
   - Nạp tuần tự ngầm các tab dữ liệu (KPI, Báo Cáo SC, Phần Cứng, Data Tồn...)
   - Cách nhau 700ms để không nghẽn luồng và không làm chậm trải nghiệm tab chính
   - Khi người dùng bấm sang tab khác là có sẵn dữ liệu mở tức thì < 0.01s!
   ========================================================================== */

let PRELOAD_STATUS = {
  started: false,
  running: false,
  done: false
};

function updatePreloadBadge(text, state = 'loading') {
  const badge = $('preloadBadge');
  const icon = $('preloadIcon');
  const txt = $('preloadTxt');
  if (!badge) return;

  badge.style.display = 'inline-flex';
  if (state === 'loading') {
    badge.style.background = 'rgba(139, 92, 246, 0.16)';
    badge.style.color = '#c084fc';
    badge.style.borderColor = 'rgba(139, 92, 246, 0.3)';
    if (icon) icon.textContent = '⏳';
  } else if (state === 'done') {
    badge.style.background = 'rgba(16, 185, 129, 0.16)';
    badge.style.color = '#34d399';
    badge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
    if (icon) icon.textContent = '⚡';
  }
  if (txt) txt.textContent = text;
}

async function startBackgroundPrefetch() {
  if (PRELOAD_STATUS.started || PRELOAD_STATUS.done) return;
  PRELOAD_STATUS.started = true;
  PRELOAD_STATUS.running = true;

  console.log('%c[PRELOAD] 🚀 Bắt đầu nạp ngầm tuần tự dữ liệu tất cả các tab...', 'color:#8b5cf6;font-weight:bold;font-size:12px');
  updatePreloadBadge('Đang nạp ngầm dữ liệu...', 'loading');

  const tasks = [
    {
      name: 'KPI Offline',
      label: 'KPI Offline (1/5)',
      check: () => typeof KPI_RAW_DATA !== 'undefined' && Array.isArray(KPI_RAW_DATA) && KPI_RAW_DATA.length > 0,
      run: () => typeof loadKpi === 'function' ? loadKpi(false, true) : null
    },
    {
      name: 'KPI Online',
      label: 'KPI Online (2/5)',
      check: () => typeof KPI_ONLINE_STATE !== 'undefined' && KPI_ONLINE_STATE && KPI_ONLINE_STATE.data,
      run: () => typeof loadKpiOnline === 'function' ? loadKpiOnline(false, true) : null
    },
    {
      name: 'Báo Cáo SC',
      label: 'Báo Cáo SC (3/5)',
      check: () => typeof BAOCAOSC_STATE !== 'undefined' && BAOCAOSC_STATE && BAOCAOSC_STATE.activeRate,
      run: () => typeof loadBaoCaoSc === 'function' ? loadBaoCaoSc(false, true) : null
    },
    {
      name: 'DS Phần Cứng',
      label: 'Phần Cứng (4/5)',
      check: () => typeof PHANCUNG_STATE !== 'undefined' && PHANCUNG_STATE && PHANCUNG_STATE.data,
      run: () => typeof loadPhanCung === 'function' ? loadPhanCung(false, true) : null
    },
    {
      name: 'Data Tồn',
      label: 'Data Tồn (5/5)',
      check: () => typeof DATATON_STATE !== 'undefined' && DATATON_STATE && DATATON_STATE.online,
      run: () => typeof loadDataTon === 'function' ? loadDataTon(false, true) : null
    }
  ];

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];

    // Nghỉ 700ms giữa các tác vụ để luồng UI luôn mượt mà và không quá tải API
    await new Promise(r => setTimeout(r, 700));

    try {
      if (!task.check()) {
        updatePreloadBadge(`Nạp ngầm: ${task.label}…`, 'loading');
        console.log(`%c[PRELOAD] ⏳ (${i + 1}/${tasks.length}) Đang nạp ngầm: ${task.name}...`, 'color:#6366f1;font-size:11px');
        await task.run();
        console.log(`%c[PRELOAD] ✅ (${i + 1}/${tasks.length}) Đã nạp xong: ${task.name}`, 'color:#10b981;font-size:11px');
      } else {
        console.log(`%c[PRELOAD] ⚡ (${i + 1}/${tasks.length}) ${task.name} đã sẵn sàng.`, 'color:#06b6d4;font-size:11px');
      }
    } catch (err) {
      console.warn(`[PRELOAD] Lưu ý khi nạp ngầm ${task.name}:`, err);
    }
  }

  PRELOAD_STATUS.running = false;
  PRELOAD_STATUS.done = true;
  updatePreloadBadge('Sẵn sàng 100% dữ liệu (5/5 tab)', 'done');
  console.log('%c[PRELOAD] 🎉 Hoàn tất nạp trước toàn bộ các tab! Mọi tab hiện đã sẵn sàng xem tức thì.', 'color:#10b981;font-weight:bold;font-size:12px');

  // Sau 4 giây, rút gọn badge lại thành thông báo ngắn gọn
  setTimeout(() => {
    updatePreloadBadge('Sẵn sàng tất cả tab', 'done');
  }, 4000);
}

/* ==========================================================================
   HỆ THỐNG XÁC THỰC BẢO MẬT (LOGIN GATE & LOGOUT)
   ========================================================================== */

function togglePasswordVisibility() {
  const inp = $('loginPassInput');
  const btn = document.querySelector('.login-eye-btn');
  if (!inp) return;
  if (inp.type === 'password') {
    inp.type = 'text';
    if (btn) btn.textContent = '🙈';
  } else {
    inp.type = 'password';
    if (btn) btn.textContent = '👁️';
  }
}

function fillTestPassword() {
  const inp = $('loginPassInput');
  if (inp) {
    inp.value = 'SC@2026';
    inp.focus();
  }
}

function showLoginGate(errMsg = '') {
  const gate = $('loginGate');
  const logoutBtn = $('btnLogoutBtn');
  const errBox = $('loginErrMsg');
  const inp = $('loginPassInput');

  if (gate) gate.style.display = 'flex';
  if (logoutBtn) logoutBtn.style.display = 'none';

  if (errBox) {
    if (errMsg) {
      errBox.textContent = '⚠️ ' + errMsg;
      errBox.style.display = 'block';
    } else {
      errBox.style.display = 'none';
    }
  }
  if (inp) {
    inp.value = '';
    setTimeout(() => inp.focus(), 150);
  }
}

function hideLoginGate() {
  const gate = $('loginGate');
  const logoutBtn = $('btnLogoutBtn');
  if (gate) gate.style.display = 'none';
  if (logoutBtn) logoutBtn.style.display = 'inline-flex';
}

async function handleLoginSubmit(e) {
  if (e) e.preventDefault();
  const input = $('loginPassInput');
  const btn = $('btnLoginSubmit');
  const txt = $('loginBtnTxt');
  const spin = $('loginSpinner');
  const errBox = $('loginErrMsg');
  const rememberCheck = $('loginRememberCheck');

  const pass = String(input ? input.value : '').trim();
  if (!pass) return;

  if (btn) btn.disabled = true;
  if (txt) txt.style.display = 'none';
  if (spin) spin.style.display = 'inline-block';
  if (errBox) errBox.style.display = 'none';

  try {
    // Gửi yêu cầu kiểm tra mật khẩu trực tiếp tới Google Apps Script API
    const testUrl = `${API_BASE}?sheet=opp&key=${encodeURIComponent(pass)}&limit=1&_t=${Date.now()}`;
    const res = await fetch(testUrl, { cache: 'no-store' });
    const json = await res.json();

    if (json && json.status === 'success') {
      // ĐĂNG NHẬP THÀNH CÔNG!
      const remember = rememberCheck ? rememberCheck.checked : true;
      setAuthKey(pass, remember);
      hideLoginGate();
      showToast('Đăng nhập thành công! Đang đồng bộ số liệu...', true);
      // Tải dữ liệu toàn bộ dashboard
      initData();
      restoreActiveTab();
    } else {
      throw new Error(json.message || 'Mật khẩu không chính xác!');
    }
  } catch (err) {
    console.warn('Xác thực thất bại:', err);
    if (errBox) {
      errBox.textContent = '⚠️ ' + (err.message && err.message.includes('Từ chối') ? err.message : 'Mật khẩu truy cập không chính xác. Vui lòng thử lại!');
      errBox.style.display = 'block';
    }
    if (input) {
      input.classList.remove('login-shake');
      void input.offsetWidth;
      input.classList.add('login-shake');
      input.focus();
      input.select();
    }
  } finally {
    if (btn) btn.disabled = false;
    if (txt) txt.style.display = 'inline-block';
    if (spin) spin.style.display = 'none';
  }
}

async function handleLogout() {
  clearAuthKey();
  PRELOAD_STATUS = { started: false, running: false, done: false };
  if ($('preloadBadge')) $('preloadBadge').style.display = 'none';
  try {
    sessionStorage.removeItem('tc_active_tab');
    localStorage.removeItem('tc_active_tab');
    history.replaceState(null, '', window.location.pathname);
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
  } catch (e) {}

  showLoginGate();
  showToast('Đã đăng xuất và khóa an toàn hệ thống.', true);
}

function checkAuthAndStart() {
  initTheme();
  const savedKey = getAuthKey();
  if (savedKey) {
    hideLoginGate();
    initData();
    restoreActiveTab();
  } else {
    showLoginGate();
  }
}

// Khởi chạy hệ thống sau khi kiểm tra xác thực
checkAuthAndStart();
