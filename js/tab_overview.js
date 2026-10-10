/**
 * tab_overview.js - Logic xử lý dữ liệu và giao diện Tab 1: Báo Cáo Hiệu Suất & Team Coacher
 */

function scMeta(full) {
  const m = full.match(/^(\d+)\s*-\s*(.+?)(?:\s+-\s+.*)?$/);
  return {
    full,
    ma: (full.match(/^\d+/) || [''])[0],
    name: m ? m[2] : full,
    nghi: /Đã nghỉ/i.test(full),
    lead: /Coacher|CS Manager/i.test(full),
  };
}

/**
 * Chuẩn hoá dữ liệu thô (từ API hoặc Snapshot)
 */
function normalize(headers, data) {
  const h = {};
  headers.forEach((c, i) => h[c] = i);

  // Bảng tra cứu kế thừa Coacher cho các dòng bị trống Coacher (VD: Tháng 9)
  const scToCoach = {
    '8464 - Lê Minh - Customer Success - VTU': 'Nguyễn Ái Quốc',
    '8464 - Lê Minh - Customer Success - VTU - Đã nghỉ': 'Nguyễn Ái Quốc',
  };
  for (const r of data) {
    const sc = String(r[h['Người xử lý']] || '').trim();
    const coach = String(r[h['Coacher']] || '').trim();
    if (sc && coach && coach !== '#N/A') scToCoach[sc] = coach;
  }

  const recs = [];
  RAW_RECORDS = [];
  for (let idx = 0; idx < data.length; idx++) {
    const r = data[idx];
    if (r[h['Retailer ID']] === 'Retailer ID') continue; // dòng tiêu đề lặp

    // Lọc triệt để dòng trống và dòng lỗi công thức kéo thừa (#N/A, #VALUE!, #REF!, ...)
    const ret = String(r[h['Retailer ID']] || '').trim();
    if (!ret || ret === '#N/A' || ret.startsWith('#')) continue;

    const sc = String(r[h['Người xử lý']] || '').trim();
    if (!sc || sc === '#N/A' || sc.startsWith('#')) continue;

    const ci = parseTime(r[h['Thời gian checkin']]);
    if (!ci) continue;

    let coach = String(r[h['Coacher']] || '').trim();
    if (!coach || coach === '#N/A' || coach.startsWith('#')) coach = scToCoach[sc] || 'Khác / Chưa phân team';

    let khuVuc = String(r[h['Khu Vực']] || '').trim();
    if (!khuVuc || khuVuc === '#N/A' || khuVuc.startsWith('#')) khuVuc = 'Chưa phân khu vực';

    const co = parseTime(r[h['Thời gian checkout']]);
    const dur = co ? (co.min - ci.min) : NaN;
    const valid = !!co && co.date === ci.date && dur >= 0 && dur <= MAXDUR;
    const imp = Number(r[h['số KH tư vấn']]) === 1 || String(r[h['số KH tư vấn']]).trim() === '1' ? 1 : 0;

    recs.push({
      sc,
      coach,
      khuVuc,
      date: ci.date,
      ci: ci.min,
      co: valid ? co.min : ci.min,
      valid,
      src: String(r[h['Nguồn data']] || 'Khác') || 'Khác',
      tv: imp,
      impact: imp,
      addon: Number(r[h['Addon']]) || 0,
      open: r[h['Thực trạng khi đến']] === OPEN_TXT ? 1 : 0,
    });

    RAW_RECORDS.push({
      idx,
      retailerId: ret,
      sc,
      coach,
      khuVuc,
      date: ci.date,
      dayNum: parseInt(ci.date.slice(8), 10),
      ciMin: ci.min,
      coMin: valid ? co.min : ci.min,
      ciTime: ci.timeStr,
      coTime: co ? co.timeStr : '–',
      durMin: valid ? dur : (co ? Math.max(0, co.min - ci.min) : 0),
      valid,
      impact: imp,
      address: r[h['Địa điểm thực tế cửa hàng']] || '',
      task: r[h['Công việc hỗ trợ KH']] || '',
      desc: r[h['Mô tả']] || '',
      raw: r
    });
  }
  ALL_RECS = recs;
  return recs;
}

/**
 * Gộp theo (SC, ngày) và tính công
 */
function buildDays(recs) {
  const map = new Map();
  for (const r of recs) {
    const k = r.sc + '|' + r.date;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  }
  const days = [];
  for (const [k, g] of map) {
    g.sort((a, b) => a.ci - b.ci);
    const first = g[0], sc = first.sc;
    let work = 0, cs = null, ce = null, vMin = Infinity, vMax = -Infinity, nv = 0, lastCo = -1, hasMorning = false, hasAfCi = false, hasLunch = false;
    for (const r of g) {
      if (r.ci < SPLIT) hasMorning = true;
      if (r.ci >= AF_CI) hasAfCi = true;
      if (r.ci >= SPLIT && r.ci < AF_CI) hasLunch = true;
      lastCo = Math.max(lastCo, r.co);
      if (r.valid) {
        nv++;
        vMin = Math.min(vMin, r.ci);
        vMax = Math.max(vMax, r.co);
        if (cs === null) { cs = r.ci; ce = r.co; }
        else if (r.ci <= ce) { ce = Math.max(ce, r.co); }
        else { work += ce - cs; cs = r.ci; ce = r.co; }
      }
    }
    if (cs !== null) work += ce - cs;
    const hasAfCo = lastCo >= AF_CO;
    const cong = (hasMorning && (hasAfCi || hasAfCo)) ? 1 : 0.5;
    let cs_ = 'F';
    if (hasMorning && hasAfCi) cs_ = 'A';
    else if (hasMorning && hasAfCo) cs_ = 'C';
    else if (hasMorning && hasLunch) cs_ = 'B';
    else if (hasMorning && lastCo >= SPLIT) cs_ = 'D';
    else if (hasMorning) cs_ = 'E';
    const srcs = {};
    let tv = 0, addon = 0, open = 0;
    g.forEach(r => {
      srcs[r.src] = (srcs[r.src] || 0) + 1;
      tv += r.tv;
      addon += r.addon;
      open += r.open;
    });
    days.push({
      sc,
      coach: first.coach,
      d: first.date,
      n: g.length,
      nv,
      w: work,
      s: nv ? vMax - vMin : 0,
      fi: g[0].ci,
      lo: lastCo,
      c: cong,
      cs: cs_,
      tv,
      impact: tv,
      addon,
      open,
      srcs
    });
  }
  return days;
}

function buildMonthSelect() {
  const sel = $('fMonth');
  if (!sel) return;
  let html = '<option value="all">Tất cả các tháng</option>';
  MONTHS.forEach(m => {
    const [y, mon] = m.split('-');
    html += `<option value="${m}">Tháng ${mon}/${y}</option>`;
  });
  html += '<option value="custom" style="display:none">Tùy chọn ngày</option>';
  sel.innerHTML = html;
  sel.value = S.month || (MONTHS[0] || 'all');
}

function buildCoachPills() {
  const box = $('coachPills');
  if (!box) return;
  box.innerHTML = '';

  // Nút Tất cả
  const allBtn = document.createElement('span');
  allBtn.className = 'pill' + (S.coach.size === COACHES.length ? ' on' : '');
  allBtn.textContent = 'Tất cả Team';
  allBtn.onclick = () => {
    COACHES.forEach(c => S.coach.add(c));
    S.sc = 'all';
    buildCoachPills();
    buildScSelect();
    render();
  };
  box.appendChild(allBtn);

  COACHES.forEach(c => {
    const p = document.createElement('span');
    p.className = 'pill' + (S.coach.has(c) ? ' on' : '');
    p.style.background = S.coach.has(c) ? COLOR[c] : '';
    p.innerHTML = '<span class="dot" style="background:' + COLOR[c] + '"></span>' + esc(c);
    p.onclick = (e) => {
      if (e.ctrlKey || e.metaKey) {
        S.coach.has(c) ? S.coach.delete(c) : S.coach.add(c);
      } else {
        S.coach.clear();
        S.coach.add(c);
        activeCoachTeam = c;
      }
      S.sc = 'all';
      buildCoachPills();
      buildScSelect();
      render();
    };
    box.appendChild(p);
  });
}

function selectCoachSingle(coachName) {
  S.coach.clear();
  S.coach.add(coachName);
  activeCoachTeam = coachName;
  S.sc = 'all';
  buildCoachPills();
  buildScSelect();
  render();
  const el = $('coachTeamCard');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function buildScSelect() {
  const list = Object.values(SCS).filter(s => DAYS.some(d => d.sc === s.full && S.coach.has(d.coach)))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  $('fSc').innerHTML = '<option value="all">Tất cả SC</option>' + list.map(s => `<option value="${esc(s.full)}">${esc(s.name)}${s.nghi ? ' (đã nghỉ)' : ''}</option>`).join('');
  $('fSc').value = list.some(s => s.full === S.sc) ? S.sc : 'all';
}

function filtered() {
  return DAYS.filter(d => S.coach.has(d.coach) && d.d >= S.from && d.d <= S.to
    && (S.sc === 'all' || d.sc === S.sc)
    && (S.status === 'all' || (S.status === 'left') === SCS[d.sc].nghi));
}

function agg(days) {
  const a = { days: 0, cong: 0, full: 0, half: 0, atc: 0, nv: 0, w: 0, tv: 0, impact: 0, addon: 0, open: 0, scs: new Set() };
  days.forEach(d => {
    a.days++;
    a.cong += d.c;
    d.c === 1 ? a.full++ : a.half++;
    a.atc += d.n;
    a.nv += d.nv;
    a.w += d.w;
    const imp = (d.impact || d.tv || 0);
    a.tv += imp;
    a.impact += imp;
    a.addon += d.addon;
    a.open += d.open;
    a.scs.add(d.sc);
  });
  a.nsc = a.scs.size;
  a.atcPerCong = a.cong ? a.atc / a.cong : null;
  a.hoursPerCong = a.cong ? a.w / 60 / a.cong : null;
  a.minPerAtc = a.nv ? a.w / a.nv : null;
  a.fullPct = a.days ? a.full * 100 / a.days : null;
  a.tvPct = a.atc ? a.tv * 100 / a.atc : null;
  a.impactPct = a.atc ? a.impact * 100 / a.atc : null;
  a.addonPerCong = a.cong ? a.addon / a.cong : null;
  a.openPct = a.atc ? a.open * 100 / a.atc : null;
  a.congPerSc = a.nsc ? a.cong / a.nsc : null;
  a.atcPerSc = a.nsc ? a.atc / a.nsc : null;
  return a;
}

const METRICS = {
  atcPerCong: { l: 'ATC / công', d: 2, hi: true },
  hoursPerCong: { l: 'Giờ làm / công', d: 2, hi: null },
  minPerAtc: { l: 'Phút / ATC', d: 1, hi: null },
  tvPct: { l: '% KH có Impact (tư vấn)', d: 1, hi: true },
  addonPerCong: { l: 'Addon / công', d: 2, hi: true },
  openPct: { l: '% đến đúng cửa hàng mở cửa', d: 1, hi: true },
  fullPct: { l: '% ngày đủ 1 công', d: 1, hi: true },
  cong: { l: 'Tổng ngày công', d: 1, hi: true },
  atc: { l: 'Tổng ATC', d: 0, hi: true }
};
if ($('fMetric')) $('fMetric').innerHTML = Object.entries(METRICS).map(([k, m]) => `<option value="${k}">${m.l}</option>`).join('');

/**
 * Render Tổng Thể Tab 1 (và cập nhật Tab 2 nếu đang mở)
 */
function render() {
  S.page = 1;
  const rows = filtered(), tot = agg(rows);
  const byCoach = COACHES.filter(c => S.coach.has(c)).map(c => ({ coach: c, ...agg(rows.filter(d => d.coach === c)) })).filter(x => x.days > 0);
  const bySc = Object.entries(groupBy(rows, d => d.sc)).map(([sc, ds]) => ({ sc, name: SCS[sc].name, nghi: SCS[sc].nghi, lead: SCS[sc].lead, coach: ds[0].coach, ...agg(ds) }));

  const K = (l, v, s, c = '') => `<div class="card kpi"><div class="l">${l}</div><div class="v" style="${c}">${v}</div><div class="s">${s}</div></div>`;
  $('kpis').innerHTML =
    K('Số SC', n0(tot.nsc), n0(byCoach.length) + ' team') +
    K('Tổng ngày công', nf(tot.cong, 1), n0(tot.days) + ' ngày có mặt') +
    K('Tổng ATC', n0(tot.atc), 'mỗi record = 1 ATC') +
    K('ATC / công', nf(tot.atcPerCong, 2), 'mục tiêu ' + S.target, 'color:' + (tot.atcPerCong >= S.target ? 'var(--ok)' : 'var(--bad)')) +
    K('Giờ làm / công', nf(tot.hoursPerCong, 2) + ' h', 'thực tế tại KH', 'color:var(--warn)') +
    K('Tổng Impact', n0(tot.impact), nf(tot.tvPct, 1) + '% tổng ATC') +
    K('Addon', n0(tot.addon), nf(tot.addonPerCong, 2) + ' / công');

  renderCoachTable(byCoach, tot);
  renderCoachTeamSection(rows, byCoach);
  renderCharts(rows, byCoach, bySc);
  renderScProvinceQuality();
  renderScTable(bySc, tot);
  window._sc = bySc;

  if (activeTab === 'pivot') {
    renderPivot();
  }
}

const COACH_COLS = [
  ['coach', 'Coacher', 'l', null], ['nsc', 'Số SC', '', null], ['cong', 'Tổng công', '', true], ['congPerSc', 'Công / SC', '', true], ['atc', 'Tổng ATC', '', true], ['atcPerSc', 'ATC / SC', '', true],
  ['atcPerCong', 'ATC / công', '', true], ['hoursPerCong', 'Giờ / công', '', null], ['minPerAtc', 'Phút / ATC', '', null], ['fullPct', '% ngày đủ công', '', true],
  ['tvPct', '% KH tư vấn (Impact)', '', true], ['addonPerCong', 'Addon / công', '', true], ['openPct', '% đến cửa hàng mở', '', true]
];
const fmtCol = { nsc: 0, cong: 1, congPerSc: 1, atc: 0, atcPerSc: 1, atcPerCong: 2, hoursPerCong: 2, minPerAtc: 1, fullPct: 0, tvPct: 1, addonPerCong: 2, openPct: 1 };

function renderCoachTable(byCoach, tot) {
  const best = {}, worst = {};
  COACH_COLS.forEach(([k, , , hi]) => {
    if (hi == null || byCoach.length < 2) return;
    const v = byCoach.map(x => x[k]).filter(x => x != null);
    if (!v.length) return;
    best[k] = hi ? Math.max(...v) : Math.min(...v);
    worst[k] = hi ? Math.min(...v) : Math.max(...v);
  });
  let h = '<thead><tr>' + COACH_COLS.map(([, l, a]) => `<th class="${a}">${l}</th>`).join('') + '</tr></thead><tbody>';
  byCoach.forEach(x => {
    h += `<tr style="cursor:pointer" title="Bấm để xem chi tiết team ${esc(x.coach)}" onclick="selectCoachSingle('${esc(x.coach)}')">` + COACH_COLS.map(([k, , a]) => {
      if (k === 'coach') return `<td class="l"><span class="dot" style="background:${COLOR[x.coach]}"></span> <b>${esc(x.coach)}</b> <span class="mut sm" style="margin-left:4px">➔ chi tiết</span></td>`;
      const v = x[k];
      const cls = (best[k] !== undefined && v === best[k] && best[k] !== worst[k]) ? 'best' : (v === worst[k] && best[k] !== worst[k] ? 'worst' : '');
      return `<td><span class="${cls}" style="padding:2px 7px">${k === 'fullPct' || k === 'tvPct' || k === 'openPct' ? nf(v, fmtCol[k]) + '%' : nf(v, fmtCol[k])}</span></td>`;
    }).join('') + '</tr>';
  });
  h += '</tbody><tfoot><tr><td class="l">TỔNG / TB</td>' + COACH_COLS.slice(1).map(([k]) => `<td>${k === 'fullPct' || k === 'tvPct' || k === 'openPct' ? nf(tot[k], fmtCol[k]) + '%' : nf(tot[k], fmtCol[k])}</td>`).join('') + '</tr></tfoot>';
  $('coachTbl').innerHTML = h;
}

/**
 * Bảng chi tiết team Coacher
 */
function renderCoachTeamSection(rows, byCoach) {
  const card = $('coachTeamCard');
  if (!card) return;
  const availableCoaches = COACHES.filter(c => S.coach.has(c));
  if (availableCoaches.length === 0) {
    card.style.display = 'none';
    return;
  }
  card.style.display = 'block';

  if (!activeCoachTeam || !availableCoaches.includes(activeCoachTeam)) {
    activeCoachTeam = availableCoaches[0];
  }

  // Render tabs chuyển nhanh giữa các team
  const tabsBox = $('coachTeamTabs');
  tabsBox.innerHTML = '';
  availableCoaches.forEach(c => {
    const btn = document.createElement('span');
    btn.className = 'pill' + (c === activeCoachTeam ? ' on' : '');
    btn.style.background = (c === activeCoachTeam ? COLOR[c] : '');
    btn.innerHTML = `<span class="dot" style="background:${COLOR[c]}"></span> ${esc(c)}`;
    btn.onclick = () => {
      activeCoachTeam = c;
      renderCoachTeamSection(rows, byCoach);
    };
    tabsBox.appendChild(btn);
  });

  $('coachTeamDot').style.background = COLOR[activeCoachTeam] || 'var(--acc)';
  $('coachTeamTitle').textContent = activeCoachTeam;
  $('coachTeamTitle').style.color = COLOR[activeCoachTeam] || 'var(--acc)';

  const teamDays = rows.filter(d => d.coach === activeCoachTeam);
  const byScMap = groupBy(teamDays, d => d.sc);

  const scList = Object.entries(byScMap).map(([sc, ds]) => {
    const a = agg(ds);
    const meta = SCS[sc] || scMeta(sc);
    return {
      sc,
      name: meta.name,
      full: sc,
      nghi: meta.nghi,
      lead: meta.lead,
      days: a.days,
      cong: a.cong,
      atc: a.atc,
      impact: a.impact || a.tv || 0,
      w: a.w,
      hours: a.w / 60,
      atcPerDay: a.atcPerCong,
      timePerDay: a.hoursPerCong
    };
  });

  const { k, dir } = coachTeamSort;
  scList.sort((a, b) => {
    if (k === 'stt') return 0;
    const x = a[k], y = b[k];
    if (typeof x === 'string') return dir * x.localeCompare(y, 'vi');
    return dir * ((x ?? -1) - (y ?? -1));
  });

  const teamTot = agg(teamDays);
  teamTot.hours = teamTot.w / 60;
  teamTot.atcPerDay = teamTot.atcPerCong;
  teamTot.timePerDay = teamTot.hoursPerCong;
  teamTot.impact = teamTot.impact || teamTot.tv || 0;

  window._currentCoachTeam = {
    coach: activeCoachTeam,
    list: scList,
    tot: teamTot
  };

  const COACH_TEAM_COLS = [
    { k: 'stt', l: 'STT', a: '' },
    { k: 'name', l: 'Tên NS', a: 'l' },
    { k: 'cong', l: 'T công', a: '' },
    { k: 'atc', l: 'Tổng ATC', a: '' },
    { k: 'impact', l: 'Tổng Impact', a: '' },
    { k: 'hours', l: 'TỔNG GIỜ SP', a: '' },
    { k: 'atcPerDay', l: 'TB ATC/Ngày', a: '' },
    { k: 'timePerDay', l: 'TB Time/Ngày', a: '' }
  ];

  let thHtml = '<thead><tr>' + COACH_TEAM_COLS.map(c => `<th class="${c.a}" data-k="${c.k}">${c.l} ⇅</th>`).join('') + '</tr></thead>';

  let tbHtml = '<tbody>' + (scList.length ? scList.map((s, idx) => {
    const isGood = s.atcPerDay >= S.target;
    return `<tr>
      <td style="color:var(--mut);font-weight:600">${idx + 1}</td>
      <td class="l" title="${esc(s.full)}"><b>${esc(s.name)}</b>${s.nghi ? ' <span class="mut sm">(nghỉ)</span>' : ''}${s.lead ? ' <span class="mut sm">[Coacher]</span>' : ''}</td>
      <td><b>${nf(s.cong, 1)}</b></td>
      <td>${n0(s.atc)}</td>
      <td><b style="color:var(--acc)">${n0(s.impact)}</b> <span class="mut sm">(${s.atc ? nf(s.impact * 100 / s.atc, 1) + '%' : '–'})</span></td>
      <td>${nf(s.hours, 1)} h</td>
      <td style="font-weight:700;color:${isGood ? 'var(--ok)' : 'var(--bad)'}">${nf(s.atcPerDay, 2)}</td>
      <td>${nf(s.timePerDay, 2)} h</td>
    </tr>`;
  }).join('') : '<tr><td colspan="8" class="mut" style="padding:18px">Không có nhân sự nào phù hợp bộ lọc.</td></tr>') + '</tbody>';

  let tfHtml = `<tfoot><tr>
    <td>Σ</td>
    <td class="l">TỔNG CỘNG TEAM (${scList.length} NS)</td>
    <td>${nf(teamTot.cong, 1)}</td>
    <td>${n0(teamTot.atc)}</td>
    <td><b style="color:var(--acc)">${n0(teamTot.impact)}</b> <span class="mut sm">(${teamTot.atc ? nf(teamTot.impact * 100 / teamTot.atc, 1) + '%' : '–'})</span></td>
    <td>${nf(teamTot.hours, 1)} h</td>
    <td style="font-weight:800;color:${teamTot.atcPerDay >= S.target ? 'var(--ok)' : 'var(--bad)'}">${nf(teamTot.atcPerDay, 2)}</td>
    <td>${nf(teamTot.timePerDay, 2)} h</td>
  </tr></tfoot>`;

  $('coachTeamTbl').innerHTML = thHtml + tbHtml + tfHtml;

  $('coachTeamTbl').querySelectorAll('th').forEach(th => {
    th.onclick = () => {
      const k = th.dataset.k;
      coachTeamSort = { k, dir: coachTeamSort.k === k ? -coachTeamSort.dir : (k === 'name' ? 1 : -1) };
      renderCoachTeamSection(rows, byCoach);
    };
  });
}

function exportCoachTeamCsv() {
  const cur = window._currentCoachTeam;
  if (!cur || !cur.list) return;
  const head = ['STT', 'Tên NS', 'T công', 'Tổng ATC', 'Tổng Impact', 'TỔNG GIỜ SP (giờ)', 'TB ATC/Ngày', 'TB Time/Ngày (giờ)'];
  const lines = [head].concat(cur.list.map((s, idx) => [
    idx + 1,
    s.name,
    nf(s.cong, 1),
    s.atc,
    s.impact,
    nf(s.hours, 1),
    nf(s.atcPerDay, 2),
    nf(s.timePerDay, 2)
  ]));
  lines.push(['Σ', 'TỔNG CỘNG TEAM (' + cur.list.length + ' NS)', nf(cur.tot.cong, 1), cur.tot.atc, cur.tot.impact, nf(cur.tot.hours, 1), nf(cur.tot.atcPerDay, 2), nf(cur.tot.timePerDay, 2)]);
  const csv = '\ufeff' + lines.map(l => l.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `chi_tiet_team_${cur.coach}.csv`;
  a.click();
}

/**
 * Biểu đồ Chart.js
 */
function mk(id, cfg) {
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart($(id), cfg);
}

function renderCharts(rows, byCoach, bySc) {
  window._lastChartArgs = [rows, byCoach, bySc];
  const isLight = document.body.getAttribute('data-theme') === 'light';
  Chart.defaults.color = isLight ? '#64748b' : '#8899b0';
  Chart.defaults.borderColor = isLight ? 'rgba(0,0,0,.08)' : 'rgba(148,163,184,.12)';
  const names = byCoach.map(x => x.coach), cols = names.map(n => COLOR[n]);

  // 1. ATC/công
  mk('chBar', {
    data: {
      labels: names,
      datasets: [
        { type: 'bar', label: 'ATC / công', data: byCoach.map(x => +(x.atcPerCong || 0).toFixed(2)), backgroundColor: cols, borderRadius: 6 },
        { type: 'line', label: 'Mục tiêu', data: names.map(() => S.target), borderColor: '#f43f5e', borderDash: [6, 4], pointRadius: 0, borderWidth: 2 }
      ]
    },
    options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });

  // 2. Radar
  const RK = ['atcPerCong', 'tvPct', 'addonPerCong', 'openPct', 'fullPct', 'hoursPerCong'];
  const mx = {};
  RK.forEach(k => mx[k] = Math.max(...byCoach.map(x => x[k] || 0), 1e-9));
  mk('chRadar', {
    type: 'radar',
    data: {
      labels: RK.map(k => METRICS[k].l),
      datasets: byCoach.map(x => ({
        label: x.coach,
        data: RK.map(k => +((x[k] || 0) / mx[k] * 100).toFixed(1)),
        borderColor: COLOR[x.coach],
        backgroundColor: COLOR[x.coach] + '33',
        pointBackgroundColor: COLOR[x.coach]
      }))
    },
    options: { maintainAspectRatio: false, scales: { r: { beginAtZero: true, max: 100, ticks: { display: false }, pointLabels: { font: { size: 10 } } } } }
  });

  // 3. Xu hướng ngày
  const dates = [...new Set(rows.map(d => d.d))].sort();
  mk('chTrend', {
    type: 'line',
    data: {
      labels: dates.map(d => d.slice(8) + '/' + d.slice(5, 7)),
      datasets: byCoach.map(x => ({
        label: x.coach,
        borderColor: COLOR[x.coach],
        backgroundColor: COLOR[x.coach],
        tension: .3,
        spanGaps: true,
        pointRadius: 2,
        data: dates.map(dt => {
          const ds = rows.filter(r => r.coach === x.coach && r.d === dt);
          const a = agg(ds);
          return a.atcPerCong == null ? null : +a.atcPerCong.toFixed(2);
        })
      }))
    },
    options: { maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
  });

  // 4. Cơ cấu nguồn
  const total = {};
  rows.forEach(d => Object.entries(d.srcs).forEach(([s, n]) => total[s] = (total[s] || 0) + n));
  const topSrc = Object.entries(total).sort((a, b) => b[1] - a[1]).slice(0, 6).map(x => x[0]);
  const SRC_COL = ['#60a5fa', '#34d399', '#fbbf24', '#f472b6', '#a78bfa', '#22d3ee', '#64748b'];
  const share = (coach, s) => {
    let t = 0, v = 0;
    rows.filter(d => d.coach === coach).forEach(d => {
      Object.entries(d.srcs).forEach(([k, n]) => {
        t += n;
        if (s === 'Khác (còn lại)' ? !topSrc.includes(k) : k === s) v += n;
      });
    });
    return t ? +(v * 100 / t).toFixed(1) : 0;
  };
  mk('chSrc', {
    type: 'bar',
    data: {
      labels: names,
      datasets: [...topSrc, 'Khác (còn lại)'].map((s, i) => ({ label: s, data: names.map(n => share(n, s)), backgroundColor: SRC_COL[i] }))
    },
    options: { maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true, max: 100 } }, plugins: { legend: { labels: { boxWidth: 10, font: { size: 10 } } } } }
  });
}

const SC_COLS = [
  ['name', 'SC', 'l'], ['coach', 'Coacher', 'l'], ['days', 'Ngày có mặt', ''], ['cong', 'Công', ''], ['full', 'Đủ ngày', ''], ['half', 'Nửa buổi', ''], ['atc', 'ATC', ''],
  ['atcPerCong', 'ATC/công', ''], ['hoursPerCong', 'Giờ/công', ''], ['minPerAtc', 'Phút/ATC', ''], ['tvPct', '% tư vấn', ''], ['addonPerCong', 'Addon/công', '']
];

function renderScTable(bySc, tot) {
  const { k, dir } = S.scSort;
  bySc.sort((a, b) => typeof a[k] === 'string' ? dir * a[k].localeCompare(b[k], 'vi') : dir * ((a[k] ?? -1) - (b[k] ?? -1)));
  $('scTbl').innerHTML = '<thead><tr>' + SC_COLS.map(([c, l, a]) => `<th class="${a}" data-k="${c}">${l} ⇅</th>`).join('') + '</tr></thead><tbody>' +
    bySc.map(s => {
      const g = s.atcPerCong >= S.target, small = s.days < S.minDays;
      return `<tr style="${small ? 'opacity:.55' : ''}"><td class="l"><b>${esc(s.name)}</b>${s.nghi ? ' <span class="mut sm">(nghỉ)</span>' : ''}</td>
        <td class="l"><span class="dot" style="background:${COLOR[s.coach]}"></span> ${esc(s.coach)}</td><td>${s.days}</td><td><b>${nf(s.cong, 1)}</b></td>
        <td style="color:var(--ok)">${s.full}</td><td style="color:var(--warn)">${s.half}</td><td>${n0(s.atc)}</td>
        <td style="font-weight:700;color:${g ? 'var(--ok)' : 'var(--bad)'}">${nf(s.atcPerCong, 2)}</td><td>${nf(s.hoursPerCong, 2)}</td><td>${nf(s.minPerAtc, 1)}</td><td>${nf(s.tvPct, 1)}%</td><td>${nf(s.addonPerCong, 2)}</td></tr>`;
    }).join('') + '</tbody><tfoot><tr><td class="l">TỔNG / TB</td><td></td><td>' + n0(tot.days) + '</td><td>' + nf(tot.cong, 1) + '</td><td>' + n0(tot.full) + '</td><td>' + n0(tot.half) + '</td><td>' + n0(tot.atc) + '</td><td>' + nf(tot.atcPerCong, 2) + '</td><td>' + nf(tot.hoursPerCong, 2) + '</td><td>' + nf(tot.minPerAtc, 1) + '</td><td>' + nf(tot.tvPct, 1) + '%</td><td>' + nf(tot.addonPerCong, 2) + '</td></tr></tfoot>';
  $('scTbl').querySelectorAll('th').forEach(th => th.onclick = () => {
    const c = th.dataset.k;
    S.scSort = { k: c, dir: S.scSort.k === c ? -S.scSort.dir : (c === 'name' || c === 'coach' ? 1 : -1) };
    renderScTable(window._sc, tot);
  });
}

function exportCsv() {
  const head = ['SC', 'Coacher', 'Ngày có mặt', 'Công', 'Đủ ngày', 'Nửa buổi', 'ATC', 'ATC/công', 'Giờ/công', 'Phút/ATC', '% tư vấn', 'Addon/công'];
  const lines = [head].concat((window._sc || []).map(s => [s.name, s.coach, s.days, s.cong, s.full, s.half, s.atc, nf(s.atcPerCong, 2), nf(s.hoursPerCong, 2), nf(s.minPerAtc, 1), nf(s.tvPct, 1), nf(s.addonPerCong, 2)]));
  const csv = '\ufeff' + lines.map(l => l.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'so_sanh_sc_coacher.csv';
  a.click();
}

/* ==================== BẢNG CHẤT LƯỢNG SC THEO TỈNH THÀNH ==================== */

function initProvinceQualityMonths() {
  const sel = $('fProvinceQualityMonth');
  if (!sel) return;
  const availMonths = [...new Set(ALL_RECS.map(r => r.date.slice(0, 7)))].filter(Boolean).sort().reverse();
  if (availMonths.length === 0) return;

  if (!PROVINCE_QUALITY_MONTH || (!availMonths.includes(PROVINCE_QUALITY_MONTH) && PROVINCE_QUALITY_MONTH !== 'all')) {
    PROVINCE_QUALITY_MONTH = availMonths.includes('2026-10') ? '2026-10' : availMonths[0];
  }

  let html = '';
  availMonths.forEach(m => {
    const [y, mon] = m.split('-');
    html += `<option value="${m}">Tháng ${mon}/${y}</option>`;
  });
  html += '<option value="all">Tất cả các tháng</option>';
  sel.innerHTML = html;
  sel.value = PROVINCE_QUALITY_MONTH;
}

function onProvinceQualityMonthChange(val) {
  PROVINCE_QUALITY_MONTH = val;
  renderScProvinceQuality();
}

function onProvinceQualitySearch(val) {
  PROVINCE_QUALITY_SEARCH = (val || '').trim().toLowerCase();
  renderScProvinceQuality();
}

function toggleProvinceExpand(key) {
  if (EXPANDED_PROVINCES.has(key)) {
    EXPANDED_PROVINCES.delete(key);
  } else {
    EXPANDED_PROVINCES.add(key);
  }
  renderScProvinceQuality();
}

function renderScProvinceQuality() {
  const tbl = $('scProvinceQualityTbl');
  if (!tbl) return;

  if (!ALL_RECS || ALL_RECS.length === 0) {
    tbl.innerHTML = '<tbody><tr><td class="mut" style="padding:18px">Đang tải dữ liệu chất lượng SC...</td></tr></tbody>';
    return;
  }

  // 1. Lọc theo tháng được chọn
  const filteredRecs = (PROVINCE_QUALITY_MONTH === 'all')
    ? ALL_RECS
    : ALL_RECS.filter(r => r.date.startsWith(PROVINCE_QUALITY_MONTH));

  // 2. Nhóm theo (Tháng, Khu vực) hoặc Khu vực
  const isAllMonths = (PROVINCE_QUALITY_MONTH === 'all');
  const groupMap = new Map();

  for (const r of filteredRecs) {
    const mStr = r.date.slice(0, 7);
    const kv = r.khuVuc || 'Chưa phân khu vực';
    const groupKey = isAllMonths ? (mStr + '|' + kv) : kv;

    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        key: groupKey,
        monthRaw: mStr,
        monthDisplay: mStr ? (mStr.slice(5, 7) + '/' + mStr.slice(0, 4)) : '–',
        khuVuc: kv,
        scMap: new Map(),
        atc: 0,
        impact: 0
      });
    }

    const g = groupMap.get(groupKey);
    g.atc++;
    if (r.impact === 1 || r.tv === 1) g.impact++;

    if (!g.scMap.has(r.sc)) {
      g.scMap.set(r.sc, { sc: r.sc, coach: r.coach, atc: 0, impact: 0 });
    }
    const scEntry = g.scMap.get(r.sc);
    scEntry.atc++;
    if (r.impact === 1 || r.tv === 1) scEntry.impact++;
  }

  // Chuyển sang danh sách hiển thị
  let rows = Array.from(groupMap.values()).map(g => {
    const scList = Array.from(g.scMap.values()).map(s => ({
      ...s,
      pct: s.atc > 0 ? (s.impact * 100 / s.atc) : 0
    })).sort((a, b) => b.atc - a.atc);

    return {
      key: g.key,
      month: g.monthDisplay,
      monthRaw: g.monthRaw,
      khuVuc: g.khuVuc,
      nSc: g.scMap.size,
      scList,
      atc: g.atc,
      impact: g.impact,
      pct: g.atc > 0 ? (g.impact * 100 / g.atc) : 0
    };
  });

  // 3. Lọc theo từ khóa tìm kiếm
  if (PROVINCE_QUALITY_SEARCH) {
    const q = PROVINCE_QUALITY_SEARCH;
    rows = rows.filter(r =>
      r.khuVuc.toLowerCase().includes(q) ||
      r.month.toLowerCase().includes(q) ||
      r.scList.some(s => s.sc.toLowerCase().includes(q))
    );
  }

  // 4. Sắp xếp theo cột
  const { k, dir } = PROVINCE_QUALITY_SORT;
  rows.sort((a, b) => {
    const x = a[k], y = b[k];
    if (typeof x === 'string') return dir * x.localeCompare(y, 'vi');
    return dir * ((x ?? -1) - (y ?? -1));
  });

  // 5. Tính tổng cộng toàn bộ
  const allUniqueScs = new Set();
  let totAtc = 0;
  let totImpact = 0;
  filteredRecs.forEach(r => {
    allUniqueScs.add(r.sc);
    totAtc++;
    if (r.impact === 1 || r.tv === 1) totImpact++;
  });
  const totPct = totAtc > 0 ? (totImpact * 100 / totAtc) : 0;

  // 6. Cấu hình các cột hiển thị: Tháng | Khu vực | SL Nhân sự | Tổng atc | Sl impact | % impact
  const COLS = [
    { k: 'month', l: 'Tháng', a: '' },
    { k: 'khuVuc', l: 'Khu vực', a: 'l' },
    { k: 'nSc', l: 'SL Nhân sự', a: '' },
    { k: 'atc', l: 'Tổng atc', a: '' },
    { k: 'impact', l: 'Sl impact', a: '' },
    { k: 'pct', l: '% impact', a: '' }
  ];

  let thead = '<thead><tr>' + COLS.map(c => {
    const isSorted = PROVINCE_QUALITY_SORT.k === c.k;
    const arrow = isSorted ? (PROVINCE_QUALITY_SORT.dir === 1 ? ' ▲' : ' ▼') : ' ⇅';
    return `<th class="${c.a}" data-k="${c.k}" style="cursor:pointer;user-select:none" title="Bấm để sắp xếp theo ${c.l}">${c.l}${arrow}</th>`;
  }).join('') + '</tr></thead>';

  let tbody = '<tbody>';
  if (rows.length === 0) {
    tbody += '<tr><td colspan="6" class="mut" style="padding:18px">Không có dữ liệu tỉnh thành phù hợp bộ lọc.</td></tr>';
  } else {
    rows.forEach(r => {
      const isExpanded = EXPANDED_PROVINCES.has(r.key);
      const pctCol = r.pct >= 65 ? 'var(--ok)' : (r.pct >= 50 ? 'var(--warn)' : 'var(--bad)');
      const pctBg = r.pct >= 65 ? 'rgba(34, 197, 94, 0.12)' : (r.pct >= 50 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)');

      tbody += `<tr style="cursor:pointer;transition:background .15s" onclick="toggleProvinceExpand('${esc(r.key)}')" title="Bấm để xem danh sách nhân sự tại ${esc(r.khuVuc)}">
        <td><span class="badge" style="background:#0284c718;color:#38bdf8;font-weight:700;border:1px solid #38bdf840">${r.month}</span></td>
        <td class="l">
          <span style="display:inline-flex;align-items:center;gap:6px">
            <span style="color:#60a5fa;font-size:10px">${isExpanded ? '▼' : '▶'}</span>
            <b style="font-size:13px">${esc(r.khuVuc)}</b>
          </span>
        </td>
        <td><span class="badge" style="background:var(--input-bg);color:var(--tx-heading);font-weight:700">${n0(r.nSc)}</span></td>
        <td><b>${n0(r.atc)}</b></td>
        <td><b style="color:var(--acc)">${n0(r.impact)}</b></td>
        <td>
          <span style="background:${pctBg};color:${pctCol};font-weight:800;padding:3px 9px;border-radius:6px;display:inline-block;min-width:54px">
            ${nf(r.pct, 1)}%
          </span>
        </td>
      </tr>`;

      if (isExpanded) {
        tbody += `<tr class="province-detail-row">
          <td colspan="6" style="background:var(--card-sub);padding:10px 14px;border-bottom:2px solid var(--line)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px">
              <div style="font-weight:700;font-size:12px;color:var(--tx-heading)">
                👥 Chi tiết ${r.nSc} nhân sự tại <b>${esc(r.khuVuc)}</b> (${r.month}):
              </div>
              <div class="mut sm">Bấm tiêu đề cột trên để sắp xếp bảng tổng</div>
            </div>
            <div style="overflow-x:auto;border:1px solid var(--line);border-radius:6px;background:var(--card)">
              <table style="width:100%;font-size:12px">
                <thead>
                  <tr style="background:var(--th-bg)">
                    <th style="padding:5px 8px;font-size:11px">STT</th>
                    <th class="l" style="padding:5px 8px;font-size:11px">Tên SC</th>
                    <th class="l" style="padding:5px 8px;font-size:11px">Team Coacher</th>
                    <th style="padding:5px 8px;font-size:11px">Tổng ATC</th>
                    <th style="padding:5px 8px;font-size:11px">SL Impact</th>
                    <th style="padding:5px 8px;font-size:11px">% Impact</th>
                  </tr>
                </thead>
                <tbody>` +
                r.scList.map((s, sIdx) => {
                  const sPctCol = s.pct >= 65 ? 'var(--ok)' : (s.pct >= 50 ? 'var(--warn)' : 'var(--bad)');
                  const meta = scMeta(s.sc);
                  return `<tr>
                    <td style="color:var(--mut);padding:5px 8px">${sIdx + 1}</td>
                    <td class="l" style="padding:5px 8px"><b>${esc(meta.name)}</b>${meta.nghi ? ' <span class="mut sm">(nghỉ)</span>' : ''}</td>
                    <td class="l" style="padding:5px 8px"><span class="dot" style="background:${COLOR[s.coach] || '#888'}"></span> ${esc(s.coach || 'Chưa phân team')}</td>
                    <td style="padding:5px 8px"><b>${n0(s.atc)}</b></td>
                    <td style="padding:5px 8px"><b style="color:var(--acc)">${n0(s.impact)}</b></td>
                    <td style="padding:5px 8px;font-weight:700;color:${sPctCol}">${nf(s.pct, 1)}%</td>
                  </tr>`;
                }).join('') +
                `</tbody>
              </table>
            </div>
          </td>
        </tr>`;
      }
    });
  }
  tbody += '</tbody>';

  const totPctCol = totPct >= 65 ? 'var(--ok)' : (totPct >= 50 ? 'var(--warn)' : 'var(--bad)');
  const totPctBg = totPct >= 65 ? 'rgba(34, 197, 94, 0.15)' : (totPct >= 50 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)');
  let tfoot = `<tfoot><tr>
    <td><span class="badge" style="background:var(--input-bg);color:var(--tx-heading);font-weight:800">TỔNG CỘNG</span></td>
    <td class="l"><b>${rows.length} Khu vực</b></td>
    <td><b style="font-size:13px">${n0(allUniqueScs.size)}</b> NS</td>
    <td><b style="font-size:13px">${n0(totAtc)}</b></td>
    <td><b style="font-size:13px;color:var(--acc)">${n0(totImpact)}</b></td>
    <td>
      <span style="background:${totPctBg};color:${totPctCol};font-weight:800;padding:3px 9px;border-radius:6px;display:inline-block">
        ${nf(totPct, 1)}%
      </span>
    </td>
  </tr></tfoot>`;

  tbl.innerHTML = thead + tbody + tfoot;

  tbl.querySelectorAll('thead th').forEach(th => {
    th.onclick = () => {
      const col = th.dataset.k;
      if (!col) return;
      PROVINCE_QUALITY_SORT = {
        k: col,
        dir: PROVINCE_QUALITY_SORT.k === col ? -PROVINCE_QUALITY_SORT.dir : (col === 'khuVuc' || col === 'month' ? 1 : -1)
      };
      renderScProvinceQuality();
    };
  });
}

function exportProvinceQualityCsv() {
  const filteredRecs = (PROVINCE_QUALITY_MONTH === 'all')
    ? ALL_RECS
    : ALL_RECS.filter(r => r.date.startsWith(PROVINCE_QUALITY_MONTH));

  const isAllMonths = (PROVINCE_QUALITY_MONTH === 'all');
  const groupMap = new Map();
  for (const r of filteredRecs) {
    const mStr = r.date.slice(0, 7);
    const kv = r.khuVuc || 'Chưa phân khu vực';
    const groupKey = isAllMonths ? (mStr + '|' + kv) : kv;

    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        monthDisplay: mStr ? (mStr.slice(5, 7) + '/' + mStr.slice(0, 4)) : '–',
        khuVuc: kv,
        scSet: new Set(),
        atc: 0,
        impact: 0
      });
    }
    const g = groupMap.get(groupKey);
    g.scSet.add(r.sc);
    g.atc++;
    if (r.impact === 1 || r.tv === 1) g.impact++;
  }

  const rows = Array.from(groupMap.values()).map(g => ({
    month: g.monthDisplay,
    khuVuc: g.khuVuc,
    nSc: g.scSet.size,
    atc: g.atc,
    impact: g.impact,
    pct: g.atc > 0 ? (g.impact * 100 / g.atc) : 0
  })).sort((a, b) => b.atc - a.atc);

  const head = ['Tháng', 'Khu vực', 'SL Nhân sự', 'Tổng atc', 'Sl impact', '% impact'];
  const lines = [head].concat(rows.map(r => [
    r.month,
    r.khuVuc,
    r.nSc,
    r.atc,
    r.impact,
    nf(r.pct, 1) + '%'
  ]));

  const allScs = new Set();
  let totAtc = 0, totImp = 0;
  filteredRecs.forEach(r => {
    allScs.add(r.sc);
    totAtc++;
    if (r.impact === 1 || r.tv === 1) totImp++;
  });
  const totPct = totAtc > 0 ? (totImp * 100 / totAtc) : 0;
  lines.push(['TỔNG CỘNG', rows.length + ' Khu vực', allScs.size, totAtc, totImp, nf(totPct, 1) + '%']);

  const csv = '\ufeff' + lines.map(l => l.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `chat_luong_sc_theo_tinh_thanh_${PROVINCE_QUALITY_MONTH}.csv`;
  a.click();
}
