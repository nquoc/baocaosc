/**
 * tab_kpi.js - Logic xử lý dữ liệu và giao diện Tab 4: KPI Team Offline
 */

function parseKpiNumber(val) {
  if (val == null || val === '') return 0;
  if (typeof val === 'number') return val;
  const s = String(val).replace(/\./g, '').replace(/,/g, '.').trim();
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function parseKpiPct(val) {
  if (val == null || val === '' || val === '-') return 0;
  if (typeof val === 'number') {
    return Math.abs(val) <= 5 ? val * 100 : val;
  }
  let s = String(val).trim();
  const hasPct = s.includes('%');
  s = s.replace('%', '').trim();
  if (s.includes(',') && !s.includes('.')) {
    s = s.replace(',', '.');
  } else {
    s = s.replace(/,/g, '');
  }
  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  if (!hasPct && Math.abs(n) <= 5) return n * 100;
  return n;
}

function normalizeKpiData(headers, data) {
  const rows = [];
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (!row || !row.length || !row[0]) continue;
    const fullName = String(row[0] || '').trim();
    if (!fullName) continue;
    const meta = scMeta(fullName);
    const level = String(row[1] || '').trim();
    const coach = String(row[2] || '').trim();
    const daLam = parseKpiNumber(row[3]);
    const actImpact = parseKpiNumber(row[4]);
    const pctImpact = parseKpiPct(row[5]);
    const kpiActive = parseKpiNumber(row[6]);
    const active = parseKpiNumber(row[7]);
    const pctKpiActive = parseKpiPct(row[8]);
    const kpiDiem = parseKpiNumber(row[9]);
    const tongDiem = parseKpiNumber(row[10]);
    const pctDiemTong = parseKpiPct(row[11]);
    const kpiAddon = parseKpiNumber(row[12]);
    const diemAddon = parseKpiNumber(row[13]);
    const pctDiemAddon = parseKpiPct(row[14]);

    // ⭐ Cột 15: KPI Tổng lấy trực tiếp từ API (đã được tính sẵn từ Google Sheets, không tính lại bằng JS)
    const kpiTong = parseKpiPct(row[15]);

    rows.push({
      fullName,
      name: meta.name,
      ma: meta.ma,
      level,
      coach,
      daLam,
      actImpact,
      pctImpact,
      pctActive: pctImpact, // alias
      kpiActive,
      active,
      pctKpiActive,
      kpiDiem,
      kpiTongCol9: kpiDiem, // alias
      tongDiem,
      pctDiemTong,
      kpiAddon,
      diemAddon,
      pctDiemAddon,
      kpiTong,
      kpiFinal: kpiTong, // Lấy trực tiếp từ API (Cột 15)
      raw: row
    });
  }
  return rows;
}

function getKpiScoreBadge(score) {
  let color = '#ef4444';
  let bg = 'rgba(239, 68, 68, 0.16)';
  if (score >= 90) {
    color = '#10b981';
    bg = 'rgba(16, 185, 129, 0.18)';
  } else if (score >= 80) {
    color = '#0284c7';
    bg = 'rgba(2, 132, 199, 0.18)';
  } else if (score >= 70) {
    color = '#f59e0b';
    bg = 'rgba(245, 158, 11, 0.18)';
  }
  return `<span style="display:inline-block;padding:3px 9px;border-radius:6px;font-weight:800;color:${color};background:${bg}">${score.toFixed(2)}%</span>`;
}

const KPI_TABLE_COLS = [
  { k: 'stt', l: 'STT', a: '' },
  { k: 'name', l: 'Tên SC', a: 'l' },
  { k: 'level', l: 'Level', a: '' },
  { k: 'coach', l: 'Coacher', a: 'l' },
  { k: 'daLam', l: 'Đã làm', a: '' },
  { k: 'actImpact', l: 'Act impact', a: '' },
  { k: 'pctImpact', l: '% impact', a: '' },
  { k: 'kpiActive', l: 'KPI active', a: '' },
  { k: 'active', l: 'active', a: '' },
  { k: 'pctKpiActive', l: '% KPI active', a: '' },
  { k: 'kpiDiem', l: 'KPI Điểm', a: '' },
  { k: 'tongDiem', l: 'Tổng điểm', a: '' },
  { k: 'pctDiemTong', l: '% Điểm tổng', a: '' },
  { k: 'kpiAddon', l: 'KPI addon', a: '' },
  { k: 'diemAddon', l: 'Điểm addon', a: '' },
  { k: 'pctDiemAddon', l: '% Điểm addon', a: '' },
  { k: 'kpiFinal', l: 'KPI Tổng', a: '', isFinal: true }
];

function getFilteredKpiList() {
  const q = ($('kpiSearch') ? $('kpiSearch').value : '').trim().toLowerCase();
  return KPI_RAW_DATA.filter(item => {
    if (KPI_ACTIVE_COACH !== 'all' && item.coach !== KPI_ACTIVE_COACH) return false;
    if (q && !item.name.toLowerCase().includes(q) && !item.fullName.toLowerCase().includes(q)) return false;
    return true;
  });
}

function sortKpi(k) {
  if (KPI_SORT.k === k) {
    KPI_SORT.dir = -KPI_SORT.dir;
  } else {
    KPI_SORT.k = k;
    KPI_SORT.dir = (k === 'name' || k === 'coach' || k === 'level') ? 1 : -1;
  }
  renderKpiTable();
}

function buildKpiCoachPills() {
  const box = $('kpiCoachPills');
  if (!box) return;
  box.innerHTML = '';

  const allBtn = document.createElement('span');
  allBtn.className = 'pill' + (KPI_ACTIVE_COACH === 'all' ? ' on' : '');
  allBtn.textContent = 'Tất cả Coacher';
  allBtn.onclick = () => {
    KPI_ACTIVE_COACH = 'all';
    buildKpiCoachPills();
    renderKpi();
  };
  box.appendChild(allBtn);

  KPI_COACHES.forEach(c => {
    const p = document.createElement('span');
    p.className = 'pill' + (KPI_ACTIVE_COACH === c ? ' on' : '');
    p.style.background = (KPI_ACTIVE_COACH === c ? (COLOR[c] || '#2563eb') : '');
    p.innerHTML = `<span class="dot" style="background:${COLOR[c] || '#60a5fa'}"></span>${esc(c)}`;
    p.onclick = () => {
      KPI_ACTIVE_COACH = c;
      buildKpiCoachPills();
      renderKpi();
    };
    box.appendChild(p);
  });
}

function renderKpi() {
  renderKpiSummary();
  renderKpiTable();
}

function renderKpiSummary() {
  const list = getFilteredKpiList();
  const box = $('kpiSummaryCards');
  if (!box) return;

  if (!list.length) {
    box.innerHTML = '<div class="card" style="padding:16px;color:#94a3b8">Không tìm thấy nhân sự phù hợp với bộ lọc</div>';
    return;
  }

  const n = list.length;
  const avgDiemTong = list.reduce((s, r) => s + r.pctDiemTong, 0) / n;
  const avgDiemAddon = list.reduce((s, r) => s + r.pctDiemAddon, 0) / n;
  const avgKpiFinal = list.reduce((s, r) => s + r.kpiFinal, 0) / n;

  // Level counts
  const lvlMap = {};
  list.forEach(r => { lvlMap[r.level] = (lvlMap[r.level] || 0) + 1; });
  const lvlStr = Object.entries(lvlMap).sort().map(([lv, count]) => `${lv}: ${count}`).join(' · ');

  // Top 1
  const sorted = [...list].sort((a, b) => b.kpiFinal - a.kpiFinal);
  const top1 = sorted[0];

  const K = (l, v, s, c = '') => `<div class="card kpi"><div class="l">${l}</div><div class="v" style="${c}">${v}</div><div class="s">${s}</div></div>`;

  box.innerHTML =
    K('👥 Số Nhân Sự SC', n, lvlStr) +
    K('📊 TB % Điểm Tổng', avgDiemTong.toFixed(2) + '%', 'Tỷ lệ hoàn thành điểm tổng', 'color:#38bdf8') +
    K('⚡ TB % Điểm Addon', avgDiemAddon.toFixed(2) + '%', 'Tỷ lệ hoàn thành addon', 'color:#f59e0b') +
    K('⭐ TB KPI Tổng', avgKpiFinal.toFixed(2) + '%', 'Trung bình KPI Tổng của đội ngũ', 'color:' + (avgKpiFinal >= 80 ? 'var(--ok)' : (avgKpiFinal >= 70 ? 'var(--warn)' : 'var(--bad)'))) +
    K('🏆 Top 1 KPI Team', top1 ? esc(top1.name) : '–', top1 ? `Đạt ${top1.kpiFinal.toFixed(2)}% (${top1.coach})` : '', 'color:var(--ok)');
}

function renderKpiTable() {
  const list = getFilteredKpiList();
  const tbl = $('kpiTable');
  if (!tbl) return;

  $('kpiTableCount').textContent = `Hiển thị ${list.length} / ${KPI_RAW_DATA.length} nhân sự`;

  const { k, dir } = KPI_SORT;
  list.sort((a, b) => {
    if (k === 'stt') return 0;
    const x = a[k], y = b[k];
    if (typeof x === 'string') return dir * x.localeCompare(y, 'vi');
    return dir * ((x ?? -1) - (y ?? -1));
  });

  // 1. THEAD
  let thead = '<thead><tr>';
  KPI_TABLE_COLS.forEach(col => {
    const isCurrent = KPI_SORT.k === col.k;
    const arrow = isCurrent ? (KPI_SORT.dir === 1 ? ' ▲' : ' ▼') : ' ⇅';
    const thCls = col.isFinal ? 'kpi-final-th' : (col.a ? 'l' : '');
    thead += `<th class="${thCls}" onclick="sortKpi('${col.k}')" title="Bấm sắp xếp theo ${col.l}">${esc(col.l)}${arrow}</th>`;
  });
  thead += '</tr></thead>';

  // 2. TBODY
  let tbody = '<tbody>';
  if (!list.length) {
    tbody += `<tr><td colspan="${KPI_TABLE_COLS.length}" style="padding:24px;color:var(--mut)">Không có dữ liệu phù hợp</td></tr>`;
  } else {
    list.forEach((r, idx) => {
      const coachCol = COLOR[r.coach] || '#60a5fa';
      let rankIcon = '';
      if (KPI_SORT.k === 'kpiFinal' && KPI_SORT.dir === -1) {
        if (idx === 0) rankIcon = '🥇 ';
        else if (idx === 1) rankIcon = '🥈 ';
        else if (idx === 2) rankIcon = '🥉 ';
      }
      tbody += `<tr>
        <td style="color:var(--mut);font-weight:600;text-align:center">${rankIcon}${idx + 1}</td>
        <td class="sc-name">${esc(r.name)} <span class="mut sm" style="font-weight:400">(${r.ma})</span></td>
        <td style="text-align:center"><span class="level-badge">${esc(r.level)}</span></td>
        <td style="text-align:left"><span class="dot" style="background:${coachCol}"></span> ${esc(r.coach)}</td>
        <td style="text-align:right">${n0(r.daLam)}</td>
        <td style="text-align:right">${n0(r.actImpact)}</td>
        <td style="text-align:right;font-weight:600">${r.pctImpact.toFixed(2)}%</td>
        <td style="text-align:right">${n0(r.kpiActive)}</td>
        <td style="text-align:right">${n0(r.active)}</td>
        <td style="text-align:right;font-weight:600">${r.pctKpiActive.toFixed(2)}%</td>
        <td style="text-align:right;font-weight:700">${n0(r.kpiDiem)}</td>
        <td style="text-align:right;color:#60a5fa;font-weight:700">${n0(r.tongDiem)}</td>
        <td style="text-align:right;font-weight:700;color:#38bdf8">${r.pctDiemTong.toFixed(2)}%</td>
        <td style="text-align:right">${n0(r.kpiAddon)}</td>
        <td style="text-align:right;color:#f59e0b;font-weight:700">${n0(r.diemAddon)}</td>
        <td style="text-align:right;font-weight:700;color:#fbbf24">${r.pctDiemAddon.toFixed(2)}%</td>
        <td class="kpi-final-col" style="text-align:center">${getKpiScoreBadge(r.kpiFinal)}</td>
      </tr>`;
    });
  }
  tbody += '</tbody>';

  // 3. TFOOT (Trung bình / Tổng cộng)
  let tfoot = '';
  if (list.length) {
    const n = list.length;
    const totDaLam = list.reduce((s, r) => s + r.daLam, 0);
    const totActImp = list.reduce((s, r) => s + r.actImpact, 0);
    const avgPctImpact = list.reduce((s, r) => s + r.pctImpact, 0) / n;
    const avgKpiAct = list.reduce((s, r) => s + r.kpiActive, 0) / n;
    const totActive = list.reduce((s, r) => s + r.active, 0);
    const avgPctKpiAct = list.reduce((s, r) => s + r.pctKpiActive, 0) / n;
    const avgKpiDiem = list.reduce((s, r) => s + r.kpiDiem, 0) / n;
    const avgTongDiem = list.reduce((s, r) => s + r.tongDiem, 0) / n;
    const avgPctDiemTong = list.reduce((s, r) => s + r.pctDiemTong, 0) / n;
    const avgKpiAddon = list.reduce((s, r) => s + r.kpiAddon, 0) / n;
    const avgDiemAddon = list.reduce((s, r) => s + r.diemAddon, 0) / n;
    const avgPctDiemAddon = list.reduce((s, r) => s + r.pctDiemAddon, 0) / n;
    const avgKpiFinal = list.reduce((s, r) => s + r.kpiFinal, 0) / n;

    tfoot = `<tfoot><tr>
      <td colspan="4" style="text-align:left;color:var(--acc);font-weight:800">📊 TỔNG CỘNG / TRUNG BÌNH (${n} SC)</td>
      <td style="text-align:right">${n0(totDaLam)}</td>
      <td style="text-align:right">${n0(totActImp)}</td>
      <td style="text-align:right">${avgPctImpact.toFixed(2)}%</td>
      <td style="text-align:right">${avgKpiAct.toFixed(1)}</td>
      <td style="text-align:right">${n0(totActive)}</td>
      <td style="text-align:right">${avgPctKpiAct.toFixed(2)}%</td>
      <td style="text-align:right">${avgKpiDiem.toFixed(0)}</td>
      <td style="text-align:right;color:#60a5fa">${avgTongDiem.toFixed(1)}</td>
      <td style="text-align:right;color:#38bdf8">${avgPctDiemTong.toFixed(2)}%</td>
      <td style="text-align:right">${avgKpiAddon.toFixed(1)}</td>
      <td style="text-align:right;color:#f59e0b">${avgDiemAddon.toFixed(1)}</td>
      <td style="text-align:right;color:#fbbf24">${avgPctDiemAddon.toFixed(2)}%</td>
      <td class="kpi-final-col" style="text-align:center">${getKpiScoreBadge(avgKpiFinal)}</td>
    </tr></tfoot>`;
  }

  tbl.innerHTML = thead + tbody + tfoot;
}

async function loadKpi(force = false, isSilent = false) {
  const badge = $('kpiSrcBadge');
  const btn = $('btnReloadKpi');
  if (btn && !isSilent) { btn.disabled = true; btn.textContent = '⏳ Đang tải…'; }
  if (badge && !isSilent) { badge.className = 'badge b-load'; badge.textContent = 'Đang tải API…'; }

  // 1. Kiểm tra cache IndexedDB
  if (!force) {
    try {
      const db = await openDB();
      const cached = await new Promise(resolve => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(CACHE_KEY_KPI);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
      if (cached && Array.isArray(cached.data) && cached.data.length > 1) {
        const ageMs = Date.now() - (cached.savedAt || 0);
        if (ageMs < CACHE_TTL_MS) {
          KPI_RAW_DATA = normalizeKpiData(cached.headers, cached.data);
          KPI_COACHES = [...new Set(KPI_RAW_DATA.map(r => r.coach).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
          buildKpiCoachPills();
          renderKpi();
          const minsAgo = Math.max(0, Math.floor(ageMs / 60000));
          const timeLabel = minsAgo === 0 ? 'vừa xong' : `${minsAgo} phút trước`;
          if (badge) { badge.className = 'badge b-cache'; badge.textContent = `Bộ nhớ đệm (${timeLabel})`; }
          if (btn) { btn.disabled = false; btn.textContent = '⟳ Tải lại KPI'; }
          return;
        }
      }
    } catch (e) {
      console.warn('Lỗi đọc cache KPI:', e);
    }
  }

  // 2. Tải API trực tiếp từ Google Apps Script
  try {
    const j = await safeFetchJson(`${API_KPI}&_t=${Date.now()}`, 2);
    if (j.status !== 'success' || !Array.isArray(j.data)) throw new Error('Dữ liệu KPI không hợp lệ');

    const now = new Date();
    const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Lưu vào IndexedDB
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({
        headers: j.data[0],
        data: j.data,
        savedAt: Date.now(),
        timeStr: timeStr
      }, CACHE_KEY_KPI);
    } catch (e) {}

    KPI_RAW_DATA = normalizeKpiData(j.data[0], j.data);
    KPI_COACHES = [...new Set(KPI_RAW_DATA.map(r => r.coach).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
    buildKpiCoachPills();
    renderKpi();

    if (badge) { badge.className = 'badge b-live'; badge.textContent = `API trực tiếp ${timeStr}`; }
    if (!isSilent) {
      showToast(`Đã đồng bộ thành công dữ liệu KPI (${KPI_RAW_DATA.length} SC) lúc ${timeStr}!`, true);
    }
  } catch (e) {
    console.error('Lỗi khi tải KPI:', e);
    if (KPI_RAW_DATA.length) {
      if (badge) { badge.className = 'badge b-err'; badge.textContent = 'API bận — giữ dữ liệu cũ'; }
      if (!isSilent) showToast('Máy chủ Google đang bận — bảng KPI vẫn giữ nguyên dữ liệu hiện tại.', false);
    } else {
      if (badge) { badge.className = 'badge b-err'; badge.textContent = 'Lỗi tải API KPI'; }
      const friendlyMsg = e.message && e.message.includes('trang web thay vì dữ liệu JSON')
        ? 'Máy chủ Google tạm thời bận, vui lòng bấm "⟳ Tải lại KPI" sau giây lát.'
        : (e.message || 'Mất kết nối');
      if (!isSilent) showToast('Lỗi tải API KPI: ' + friendlyMsg, false);
    }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '⟳ Tải lại KPI'; }
  }
}

function exportKpiCsv() {
  const list = getFilteredKpiList();
  if (!list.length) {
    showToast('Chưa có dữ liệu KPI để xuất CSV!', false);
    return;
  }
  const head = ['STT', 'Tên SC', 'Level', 'Coacher', 'Đã làm', 'Act impact', '% impact', 'KPI active', 'active', '% KPI active', 'KPI Điểm', 'Tổng điểm', '% Điểm tổng', 'KPI addon', 'Điểm addon', '% Điểm addon', 'KPI Tổng'];
  const rows = list.map((r, idx) => [
    idx + 1,
    r.name,
    r.level,
    r.coach,
    r.daLam,
    r.actImpact,
    r.pctImpact.toFixed(2) + '%',
    r.kpiActive,
    r.active,
    r.pctKpiActive.toFixed(2) + '%',
    r.kpiDiem,
    r.tongDiem,
    r.pctDiemTong.toFixed(2) + '%',
    r.kpiAddon,
    r.diemAddon,
    r.pctDiemAddon.toFixed(2) + '%',
    r.kpiFinal.toFixed(2) + '%'
  ]);
  const csv = '\ufeff' + [head].concat(rows).map(l => l.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const coachSuffix = KPI_ACTIVE_COACH === 'all' ? 'tat_ca' : KPI_ACTIVE_COACH.replace(/\s+/g, '_');
  a.download = `bao_cao_kpi_team_offline_${coachSuffix}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}
