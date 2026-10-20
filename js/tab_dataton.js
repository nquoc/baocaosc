/**
 * tab_dataton.js - Logic xử lý dữ liệu và giao diện Tab 8: DATA TỒN
 * Nguồn: Sheet 'ton online' & 'ton offline' từ Google Apps Script API
 *
 * 1. Online Tồn (Sheet: ton online):
 *    - 1.1: Thống kê theo Người xử lý (SL tồn & %)
 *    - 1.2: Thống kê theo Loại công việc (SL tồn & %)
 *    -> 2 bảng nằm ngang (side-by-side)
 *
 * 2. Offline Tồn (Sheet: ton offline):
 *    - 2.1: Thống kê theo Người xử lý (SL tồn & %)
 *    - 2.2: Thống kê theo Tỉnh thành (SL tồn & %)
 *    -> 2 bảng nằm ngang (side-by-side)
 */

/* ==========================================================================
   1. CHUẨN HÓA DỮ LIỆU DATA TỒN
   ========================================================================== */

/**
 * Chuẩn hóa dữ liệu thô từ sheet 'ton online'
 */
function normalizeDataTonOnline(rawData) {
  if (!Array.isArray(rawData) || rawData.length < 2) return null;

  const headers = rawData[0].map(h => String(h || '').trim());
  const findCol = (...keywords) => {
    for (let c = 0; c < headers.length; c++) {
      const h = headers[c].toLowerCase();
      if (keywords.some(k => h.includes(k.toLowerCase()))) return c;
    }
    return -1;
  };

  const colRetId = findCol('retailer id', 'retailer', 'mã gian hàng');
  const colTime = findCol('thời gian tạo', 'ngày tạo', 'created');
  const colIndustry = findCol('ngành hàng', 'nganh hang');
  const colProduct = findCol('product', 'sản phẩm');
  const colActive = findCol('active status', 'trạng thái active');
  const colSource = findCol('nguồn data', 'nguon data');
  const colPriority = findCol('độ ưu tiên', 'do uu tien');
  const colProvince = findCol('tỉnh/thành phố', 'tỉnh', 'thành phố');
  const colDistrict = findCol('xã/phường', 'quận/huyện');
  const colAddress = findCol('địa điểm', 'địa chỉ');
  const colJob = findCol('loại công việc', 'loai cong viec', 'công việc');
  const colUser = findCol('người xử lý', 'nguoi xu ly', 'sc xử lý', 'người phụ trách', 'nhân sự');
  const colStatus = findCol('tình trạng xử lý', 'trạng thái xử lý', 'trạng thái', 'tình trạng');

  const records = [];
  const userMap = new Map();
  const jobMap = new Map();

  for (let r = 1; r < rawData.length; r++) {
    const row = rawData[r];
    if (!row || !row.length) continue;

    const retId = String(colRetId >= 0 ? row[colRetId] : row[0] || '').trim();
    if (!retId) continue;

    const userName = String(colUser >= 0 ? row[colUser] : '').trim() || '(Chưa phân bổ)';
    const jobName = String(colJob >= 0 ? row[colJob] : '').trim() || '(Chưa phân loại)';
    const timeStr = String(colTime >= 0 ? row[colTime] : '').trim();
    const industry = String(colIndustry >= 0 ? row[colIndustry] : '').trim();
    const product = String(colProduct >= 0 ? row[colProduct] : '').trim();
    const province = String(colProvince >= 0 ? row[colProvince] : '').trim();
    const address = String(colAddress >= 0 ? row[colAddress] : '').trim();
    const status = String(colStatus >= 0 ? row[colStatus] : '').trim() || 'Chưa làm';
    const priority = String(colPriority >= 0 ? row[colPriority] : '').trim();

    const rec = {
      retId,
      time: timeStr,
      industry,
      product,
      priority,
      province,
      address,
      job: jobName,
      user: userName,
      status
    };
    records.push(rec);

    // Group by User
    if (!userMap.has(userName)) {
      userMap.set(userName, []);
    }
    userMap.get(userName).push(rec);

    // Group by Job
    if (!jobMap.has(jobName)) {
      jobMap.set(jobName, []);
    }
    jobMap.get(jobName).push(rec);
  }

  const totalCount = records.length;

  const users = Array.from(userMap.entries()).map(([name, list]) => ({
    name,
    count: list.length,
    pct: totalCount > 0 ? (list.length / totalCount) * 100 : 0,
    records: list
  })).sort((a, b) => b.count - a.count);

  const jobs = Array.from(jobMap.entries()).map(([name, list]) => ({
    name,
    count: list.length,
    pct: totalCount > 0 ? (list.length / totalCount) * 100 : 0,
    records: list
  })).sort((a, b) => b.count - a.count);

  return {
    totalCount,
    users,
    jobs,
    records
  };
}

/**
 * Chuẩn hóa dữ liệu thô từ sheet 'ton offline'
 */
function normalizeDataTonOffline(rawData) {
  if (!Array.isArray(rawData) || rawData.length < 2) return null;

  const headers = rawData[0].map(h => String(h || '').trim());
  const findCol = (...keywords) => {
    for (let c = 0; c < headers.length; c++) {
      const h = headers[c].toLowerCase();
      if (keywords.some(k => h.includes(k.toLowerCase()))) return c;
    }
    return -1;
  };

  const colRetId = findCol('retailer id', 'retailer', 'mã gian hàng');
  const colTime = findCol('thời gian tạo', 'ngày tạo', 'created');
  const colIndustry = findCol('ngành hàng', 'nganh hang');
  const colAddress = findCol('địa điểm', 'địa chỉ');
  const colProvince = findCol('tỉnh/thành phố', 'tỉnh', 'thành phố');
  const colDistrict = findCol('xã/phường', 'quận/huyện');
  const colJob = findCol('công việc hỗ trợ kh', 'loại công việc', 'công việc');
  const colContract = findCol('gói hợp đồng', 'hợp đồng');
  const colProduct = findCol('product', 'sản phẩm');
  const colDesc = findCol('mô tả', 'thực trạng trao đổi');
  const colUser = findCol('người xử lý', 'nguoi xu ly', 'sc xử lý', 'người phụ trách', 'nhân sự');
  const colStatus = findCol('tình trạng xử lý', 'trạng thái xử lý', 'trạng thái', 'tình trạng');

  const records = [];
  const userMap = new Map();
  const provinceMap = new Map();

  for (let r = 1; r < rawData.length; r++) {
    const row = rawData[r];
    if (!row || !row.length) continue;

    const retId = String(colRetId >= 0 ? row[colRetId] : row[0] || '').trim();
    if (!retId) continue;

    const userName = String(colUser >= 0 ? row[colUser] : '').trim() || '(Chưa phân bổ)';
    let provinceName = String(colProvince >= 0 ? row[colProvince] : '').trim() || '(Chưa xác định)';
    // Chuẩn hóa tên tỉnh thành gọn đẹp
    provinceName = provinceName.replace(/^Tỉnh\s+/i, '').replace(/^Thành phố\s+/i, '').trim();

    const timeStr = String(colTime >= 0 ? row[colTime] : '').trim();
    const industry = String(colIndustry >= 0 ? row[colIndustry] : '').trim();
    const product = String(colProduct >= 0 ? row[colProduct] : '').trim();
    const address = String(colAddress >= 0 ? row[colAddress] : '').trim();
    const job = String(colJob >= 0 ? row[colJob] : '').trim() || 'Hỗ trợ offline';
    const status = String(colStatus >= 0 ? row[colStatus] : '').trim() || 'Chưa làm';
    const desc = String(colDesc >= 0 ? row[colDesc] : '').trim();
    const contract = String(colContract >= 0 ? row[colContract] : '').trim();

    const rec = {
      retId,
      time: timeStr,
      industry,
      product,
      contract,
      province: provinceName,
      address,
      job,
      desc,
      user: userName,
      status
    };
    records.push(rec);

    // Group by User
    if (!userMap.has(userName)) {
      userMap.set(userName, []);
    }
    userMap.get(userName).push(rec);

    // Group by Province
    if (!provinceMap.has(provinceName)) {
      provinceMap.set(provinceName, []);
    }
    provinceMap.get(provinceName).push(rec);
  }

  const totalCount = records.length;

  const users = Array.from(userMap.entries()).map(([name, list]) => ({
    name,
    count: list.length,
    pct: totalCount > 0 ? (list.length / totalCount) * 100 : 0,
    records: list
  })).sort((a, b) => b.count - a.count);

  const provinces = Array.from(provinceMap.entries()).map(([name, list]) => ({
    name,
    count: list.length,
    pct: totalCount > 0 ? (list.length / totalCount) * 100 : 0,
    records: list
  })).sort((a, b) => b.count - a.count);

  // Lọc riêng các ticket treo ngoài thuộc pool "Chăm sóc khách hàng hỗ trợ trực tiếp"
  const poolRecords = records.filter(r => {
    const u = r.user.toLowerCase();
    return u.includes('hỗ trợ trực tiếp') || u.includes('ho tro truc tiep');
  });

  const poolProvinceMap = new Map();
  poolRecords.forEach(r => {
    const p = r.province || '(Chưa xác định)';
    if (!poolProvinceMap.has(p)) {
      poolProvinceMap.set(p, []);
    }
    poolProvinceMap.get(p).push(r);
  });

  const totalPoolCount = poolRecords.length;

  const poolProvinces = Array.from(poolProvinceMap.entries()).map(([name, list]) => {
    const totalProv = provinceMap.has(name) ? provinceMap.get(name).length : list.length;
    return {
      name,
      count: list.length,
      pct: totalPoolCount > 0 ? (list.length / totalPoolCount) * 100 : 0,
      pctOfProvince: totalProv > 0 ? (list.length / totalProv) * 100 : 0,
      totalProv,
      records: list
    };
  }).sort((a, b) => b.count - a.count);

  return {
    totalCount,
    users,
    provinces,
    poolProvinces,
    totalPoolCount,
    poolRecords,
    records
  };
}

/* ==========================================================================
   2. RENDER GIAO DIỆN TAB DATA TỒN
   ========================================================================== */

/**
 * Hiển thị 4 thẻ KPI tóm tắt đầu Tab Data Tồn
 */
function renderDataTonSummaryCards(parsedOnline, parsedOffline) {
  const box = $('datatonSummaryCards');
  if (!box) return;

  const onCount = parsedOnline ? parsedOnline.totalCount : 0;
  const offCount = parsedOffline ? parsedOffline.totalCount : 0;
  const poolCount = parsedOffline ? parsedOffline.totalPoolCount : 0;
  const grandTotal = onCount + offCount;

  const topJob = parsedOnline && parsedOnline.jobs && parsedOnline.jobs.length ? parsedOnline.jobs[0] : null;
  const topPoolProv = parsedOffline && parsedOffline.poolProvinces && parsedOffline.poolProvinces.length ? parsedOffline.poolProvinces[0] : null;

  const K = (label, val, sub, color = '') => `
    <div class="card kpi">
      <div class="l">${label}</div>
      <div class="v" style="${color}">${val}</div>
      <div class="s">${sub}</div>
    </div>`;

  const onPct = grandTotal > 0 ? ((onCount / grandTotal) * 100).toFixed(1) : '0';
  const offPct = grandTotal > 0 ? ((offCount / grandTotal) * 100).toFixed(1) : '0';
  const poolPctOfOff = offCount > 0 ? ((poolCount / offCount) * 100).toFixed(1) : '0';

  box.innerHTML =
    K('🌐 Tổng Tồn Online', `${n0(onCount)} <span style="font-size:13px;font-weight:400;color:var(--mut)">ticket</span>`, `Chiếm ${onPct}% tổng data tồn toàn hệ thống`, 'color:#38bdf8') +
    K('📋 Phân Loại CV Online', `${parsedOnline ? parsedOnline.jobs.length : 0} <span style="font-size:13px;font-weight:400;color:var(--mut)">nhóm</span>`, topJob ? `Lớn nhất: <b>${esc(topJob.name)}</b> (${n0(topJob.count)})` : 'Chưa có phân loại', 'color:#0ea5e9') +
    K('🏢 Tổng Tồn Offline', `${n0(offCount)} <span style="font-size:13px;font-weight:400;color:var(--mut)">ticket</span>`, `Đã gán SC: <b>${n0(offCount - poolCount)}</b> (${(100 - parseFloat(poolPctOfOff)).toFixed(1)}%)`, 'color:#f59e0b') +
    K('🚨 Tồn Treo Ngoài Offline', `${n0(poolCount)} <span style="font-size:13px;font-weight:400;color:var(--mut)">ticket</span>`, topPoolProv ? `Chiếm ${poolPctOfOff}% tồn Offline · Top: <b>${esc(topPoolProv.name)}</b> (${n0(topPoolProv.count)})` : 'Không có ticket treo ngoài', 'color:#ef4444');
}

/**
 * Điều khiển sắp xếp các bảng trong Data Tồn
 */
function onDataTonSort(type, col) {
  if (!DATATON_SORT[type]) return;
  if (DATATON_SORT[type].k === col) {
    DATATON_SORT[type].dir *= -1;
  } else {
    DATATON_SORT[type] = { k: col, dir: col === 'name' ? 1 : -1 };
  }
  renderDataTon();
}

/**
 * Lọc tìm kiếm realtime
 */
function onDataTonSearch(type, val) {
  if (DATATON_SEARCH[type] !== undefined) {
    DATATON_SEARCH[type] = (val || '').trim().toLowerCase();
    renderDataTon();
  }
}

/**
 * Sắp xếp danh sách mục theo sort state
 */
function sortDataTonItems(items, sortCfg) {
  const list = [...items];
  const { k, dir } = sortCfg;
  list.sort((a, b) => {
    if (k === 'name') {
      return dir * a.name.localeCompare(b.name, 'vi');
    }
    if (k === 'count' || k === 'pct') {
      return dir * (a.count - b.count);
    }
    if (k === 'totalProv') {
      return dir * ((a.totalProv || 0) - (b.totalProv || 0));
    }
    if (k === 'pctOfProvince') {
      return dir * ((a.pctOfProvince || 0) - (b.pctOfProvince || 0));
    }
    return 0;
  });
  return list;
}

/**
 * BẢNG 1.1: Online Tồn Theo Người Xử Lý
 */
function renderOnlineUserTable(parsedOnline) {
  const tbl = $('tblDataTonOnlineUser');
  if (!tbl || !parsedOnline) return;

  let items = parsedOnline.users;
  const q = DATATON_SEARCH.onlineUser;
  if (q) {
    items = items.filter(it => it.name.toLowerCase().includes(q));
  }
  items = sortDataTonItems(items, DATATON_SORT.onlineUser);

  const getArrow = col => {
    if (DATATON_SORT.onlineUser.k !== col) return ' ⇅';
    return DATATON_SORT.onlineUser.dir === 1 ? ' ▲' : ' ▼';
  };

  let thead = `
    <thead>
      <tr>
        <th style="width:45px;text-align:center">STT</th>
        <th style="text-align:left;cursor:pointer" onclick="onDataTonSort('onlineUser', 'name')">Người Xử Lý${getArrow('name')}</th>
        <th style="text-align:right;cursor:pointer;width:110px" onclick="onDataTonSort('onlineUser', 'count')">SL Tồn${getArrow('count')}</th>
        <th style="text-align:right;cursor:pointer;width:95px" onclick="onDataTonSort('onlineUser', 'pct')">Tỷ Trọng${getArrow('pct')}</th>
      </tr>
    </thead>`;

  let tbody = '<tbody>';
  if (items.length === 0) {
    tbody += '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--mut)">Không tìm thấy người xử lý phù hợp</td></tr>';
  } else {
    items.forEach((it, idx) => {
      const isUnassigned = it.name.includes('(Chưa phân bổ)');
      const nameColor = isUnassigned ? 'color:#ef4444;font-style:italic' : 'color:var(--tx-heading);font-weight:600';
      tbody += `
        <tr style="cursor:pointer" onclick="openDataTonDrilldownModal('online', 'Người xử lý', '${esc(it.name)}', 'user')" title="Nhấp để xem danh sách chi tiết data tồn của nhân sự này">
          <td style="text-align:center;color:var(--mut)">${idx + 1}</td>
          <td style="text-align:left;${nameColor}">${esc(it.name)}</td>
          <td style="text-align:right;font-weight:700;color:#38bdf8">${n0(it.count)}</td>
          <td style="text-align:right;color:var(--mut);font-weight:600">${it.pct.toFixed(1)}%</td>
        </tr>`;
    });
  }
  tbody += '</tbody>';

  const tfoot = `
    <tfoot>
      <tr style="font-weight:800;background:var(--card-sub, var(--card))">
        <td style="text-align:center;color:var(--mut)">★</td>
        <td style="text-align:left;color:var(--tx-heading)">TỔNG TOÀN BỘ (${items.length} người)</td>
        <td style="text-align:right;color:#38bdf8;font-size:14px">${n0(parsedOnline.totalCount)}</td>
        <td style="text-align:right;color:var(--tx-heading)">100%</td>
      </tr>
    </tfoot>`;

  tbl.innerHTML = thead + tbody + tfoot;
}

/**
 * BẢNG 1.2: Online Tồn Theo Loại Công Việc
 */
function renderOnlineJobTable(parsedOnline) {
  const tbl = $('tblDataTonOnlineJob');
  if (!tbl || !parsedOnline) return;

  let items = parsedOnline.jobs;
  const q = DATATON_SEARCH.onlineJob;
  if (q) {
    items = items.filter(it => it.name.toLowerCase().includes(q));
  }
  items = sortDataTonItems(items, DATATON_SORT.onlineJob);

  const getArrow = col => {
    if (DATATON_SORT.onlineJob.k !== col) return ' ⇅';
    return DATATON_SORT.onlineJob.dir === 1 ? ' ▲' : ' ▼';
  };

  let thead = `
    <thead>
      <tr>
        <th style="width:45px;text-align:center">STT</th>
        <th style="text-align:left;cursor:pointer" onclick="onDataTonSort('onlineJob', 'name')">Loại Công Việc${getArrow('name')}</th>
        <th style="text-align:right;cursor:pointer;width:110px" onclick="onDataTonSort('onlineJob', 'count')">SL Tồn${getArrow('count')}</th>
        <th style="text-align:right;cursor:pointer;width:95px" onclick="onDataTonSort('onlineJob', 'pct')">Tỷ Trọng${getArrow('pct')}</th>
      </tr>
    </thead>`;

  let tbody = '<tbody>';
  if (items.length === 0) {
    tbody += '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--mut)">Không tìm thấy loại công việc phù hợp</td></tr>';
  } else {
    items.forEach((it, idx) => {
      tbody += `
        <tr style="cursor:pointer" onclick="openDataTonDrilldownModal('online', 'Loại công việc', '${esc(it.name)}', 'job')" title="Nhấp để xem danh sách chi tiết data tồn của loại công việc này">
          <td style="text-align:center;color:var(--mut)">${idx + 1}</td>
          <td style="text-align:left;font-weight:600;color:#0ea5e9">${esc(it.name)}</td>
          <td style="text-align:right;font-weight:700;color:#0ea5e9">${n0(it.count)}</td>
          <td style="text-align:right;color:var(--mut);font-weight:600">${it.pct.toFixed(1)}%</td>
        </tr>`;
    });
  }
  tbody += '</tbody>';

  const tfoot = `
    <tfoot>
      <tr style="font-weight:800;background:var(--card-sub, var(--card))">
        <td style="text-align:center;color:var(--mut)">★</td>
        <td style="text-align:left;color:var(--tx-heading)">TỔNG TOÀN BỘ (${items.length} loại)</td>
        <td style="text-align:right;color:#0ea5e9;font-size:14px">${n0(parsedOnline.totalCount)}</td>
        <td style="text-align:right;color:var(--tx-heading)">100%</td>
      </tr>
    </tfoot>`;

  tbl.innerHTML = thead + tbody + tfoot;
}

/**
 * BẢNG 2.1: Offline Tồn Theo Người Xử Lý
 */
function renderOfflineUserTable(parsedOffline) {
  const tbl = $('tblDataTonOfflineUser');
  if (!tbl || !parsedOffline) return;

  let items = parsedOffline.users;
  const q = DATATON_SEARCH.offlineUser;
  if (q) {
    items = items.filter(it => it.name.toLowerCase().includes(q));
  }
  items = sortDataTonItems(items, DATATON_SORT.offlineUser);

  const getArrow = col => {
    if (DATATON_SORT.offlineUser.k !== col) return ' ⇅';
    return DATATON_SORT.offlineUser.dir === 1 ? ' ▲' : ' ▼';
  };

  let thead = `
    <thead>
      <tr>
        <th style="width:45px;text-align:center">STT</th>
        <th style="text-align:left;cursor:pointer" onclick="onDataTonSort('offlineUser', 'name')">Người Xử Lý${getArrow('name')}</th>
        <th style="text-align:right;cursor:pointer;width:110px" onclick="onDataTonSort('offlineUser', 'count')">SL Tồn${getArrow('count')}</th>
        <th style="text-align:right;cursor:pointer;width:95px" onclick="onDataTonSort('offlineUser', 'pct')">Tỷ Trọng${getArrow('pct')}</th>
      </tr>
    </thead>`;

  let tbody = '<tbody>';
  if (items.length === 0) {
    tbody += '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--mut)">Không tìm thấy người xử lý phù hợp</td></tr>';
  } else {
    items.forEach((it, idx) => {
      const isUnassigned = it.name.includes('(Chưa phân bổ)') || it.name.includes('trực tiếp');
      const nameColor = isUnassigned ? 'color:#f59e0b;font-weight:700' : 'color:var(--tx-heading);font-weight:600';
      tbody += `
        <tr style="cursor:pointer" onclick="openDataTonDrilldownModal('offline', 'Người xử lý', '${esc(it.name)}', 'user')" title="Nhấp để xem danh sách chi tiết data tồn của nhân sự này">
          <td style="text-align:center;color:var(--mut)">${idx + 1}</td>
          <td style="text-align:left;${nameColor}">${esc(it.name)}</td>
          <td style="text-align:right;font-weight:700;color:#f59e0b">${n0(it.count)}</td>
          <td style="text-align:right;color:var(--mut);font-weight:600">${it.pct.toFixed(1)}%</td>
        </tr>`;
    });
  }
  tbody += '</tbody>';

  const tfoot = `
    <tfoot>
      <tr style="font-weight:800;background:var(--card-sub, var(--card))">
        <td style="text-align:center;color:var(--mut)">★</td>
        <td style="text-align:left;color:var(--tx-heading)">TỔNG TOÀN BỘ (${items.length} người)</td>
        <td style="text-align:right;color:#f59e0b;font-size:14px">${n0(parsedOffline.totalCount)}</td>
        <td style="text-align:right;color:var(--tx-heading)">100%</td>
      </tr>
    </tfoot>`;

  tbl.innerHTML = thead + tbody + tfoot;
}

/**
 * BẢNG 2.2: Offline Tồn Theo Tỉnh Thành
 */
function renderOfflineProvinceTable(parsedOffline) {
  const tbl = $('tblDataTonOfflineProvince');
  if (!tbl || !parsedOffline) return;

  let items = parsedOffline.provinces;
  const q = DATATON_SEARCH.offlineProvince;
  if (q) {
    items = items.filter(it => it.name.toLowerCase().includes(q));
  }
  items = sortDataTonItems(items, DATATON_SORT.offlineProvince);

  const getArrow = col => {
    if (DATATON_SORT.offlineProvince.k !== col) return ' ⇅';
    return DATATON_SORT.offlineProvince.dir === 1 ? ' ▲' : ' ▼';
  };

  let thead = `
    <thead>
      <tr>
        <th style="width:45px;text-align:center">STT</th>
        <th style="text-align:left;cursor:pointer" onclick="onDataTonSort('offlineProvince', 'name')">Tỉnh / Thành Phố${getArrow('name')}</th>
        <th style="text-align:right;cursor:pointer;width:110px" onclick="onDataTonSort('offlineProvince', 'count')">SL Tồn${getArrow('count')}</th>
        <th style="text-align:right;cursor:pointer;width:95px" onclick="onDataTonSort('offlineProvince', 'pct')">Tỷ Trọng${getArrow('pct')}</th>
      </tr>
    </thead>`;

  let tbody = '<tbody>';
  if (items.length === 0) {
    tbody += '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--mut)">Không tìm thấy tỉnh thành phù hợp</td></tr>';
  } else {
    items.forEach((it, idx) => {
      tbody += `
        <tr style="cursor:pointer" onclick="openDataTonDrilldownModal('offline', 'Tỉnh thành', '${esc(it.name)}', 'province')" title="Nhấp để xem danh sách chi tiết data tồn của tỉnh thành này">
          <td style="text-align:center;color:var(--mut)">${idx + 1}</td>
          <td style="text-align:left;font-weight:600;color:var(--tx-heading)">${esc(it.name)}</td>
          <td style="text-align:right;font-weight:700;color:#d97706">${n0(it.count)}</td>
          <td style="text-align:right;color:var(--mut);font-weight:600">${it.pct.toFixed(1)}%</td>
        </tr>`;
    });
  }
  tbody += '</tbody>';

  const tfoot = `
    <tfoot>
      <tr style="font-weight:800;background:var(--card-sub, var(--card))">
        <td style="text-align:center;color:var(--mut)">★</td>
        <td style="text-align:left;color:var(--tx-heading)">TỔNG TOÀN BỘ (${items.length} tỉnh thành)</td>
        <td style="text-align:right;color:#d97706;font-size:14px">${n0(parsedOffline.totalCount)}</td>
        <td style="text-align:right;color:var(--tx-heading)">100%</td>
      </tr>
    </tfoot>`;

  tbl.innerHTML = thead + tbody + tfoot;
}

/**
 * BẢNG 2.3: Offline Tồn Treo Ngoài Theo Tỉnh / Thành Phố (Pool: Chăm sóc khách hàng hỗ trợ trực tiếp)
 */
function renderOfflinePoolProvinceTable(parsedOffline) {
  const tbl = $('tblDataTonOfflinePoolProvince');
  if (!tbl || !parsedOffline) return;

  let items = parsedOffline.poolProvinces || [];
  const q = DATATON_SEARCH.offlinePoolProvince;
  if (q) {
    items = items.filter(it => it.name.toLowerCase().includes(q));
  }
  items = sortDataTonItems(items, DATATON_SORT.offlinePoolProvince);

  const getArrow = col => {
    if (DATATON_SORT.offlinePoolProvince.k !== col) return ' ⇅';
    return DATATON_SORT.offlinePoolProvince.dir === 1 ? ' ▲' : ' ▼';
  };

  let thead = `
    <thead>
      <tr>
        <th style="width:45px;text-align:center">STT</th>
        <th style="text-align:left;cursor:pointer" onclick="onDataTonSort('offlinePoolProvince', 'name')">Tỉnh / Thành Phố${getArrow('name')}</th>
        <th style="text-align:right;cursor:pointer;width:120px" onclick="onDataTonSort('offlinePoolProvince', 'count')">SL Treo Ngoài${getArrow('count')}</th>
        <th style="text-align:right;cursor:pointer;width:115px" onclick="onDataTonSort('offlinePoolProvince', 'pct')">% / Tổng Treo${getArrow('pct')}</th>
        <th style="text-align:right;cursor:pointer;width:115px" onclick="onDataTonSort('offlinePoolProvince', 'totalProv')">Tổng Tồn Tỉnh${getArrow('totalProv')}</th>
        <th style="text-align:right;cursor:pointer;width:135px" onclick="onDataTonSort('offlinePoolProvince', 'pctOfProvince')">% Treo / Tồn Tỉnh${getArrow('pctOfProvince')}</th>
      </tr>
    </thead>`;

  let tbody = '<tbody>';
  if (items.length === 0) {
    tbody += '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--mut)">Không tìm thấy tỉnh thành treo ngoài phù hợp</td></tr>';
  } else {
    items.forEach((it, idx) => {
      const pctProvVal = it.pctOfProvince || 0;
      let badgeStyle = 'background:rgba(16,185,129,0.15);color:#10b981;padding:3px 8px;border-radius:6px;font-weight:700'; // xanh <35%
      if (pctProvVal >= 60) {
        badgeStyle = 'background:rgba(239,68,68,0.18);color:#ef4444;padding:3px 8px;border-radius:6px;font-weight:700'; // đỏ >=60%
      } else if (pctProvVal >= 35) {
        badgeStyle = 'background:rgba(245,158,11,0.18);color:#f59e0b;padding:3px 8px;border-radius:6px;font-weight:700'; // cam 35-60%
      }

      tbody += `
        <tr style="cursor:pointer" onclick="openDataTonDrilldownModal('offline', 'Tỉnh thành (Treo ngoài)', '${esc(it.name)}', 'poolProvince')" title="Nhấp để xem danh sách ticket treo ngoài của ${esc(it.name)}">
          <td style="text-align:center;color:var(--mut)">${idx + 1}</td>
          <td style="text-align:left;font-weight:600;color:var(--tx-heading)">${esc(it.name)}</td>
          <td style="text-align:right;font-weight:700;color:#ef4444">${n0(it.count)}</td>
          <td style="text-align:right;color:var(--mut);font-weight:600">${it.pct.toFixed(1)}%</td>
          <td style="text-align:right;color:var(--tx);font-weight:600">${n0(it.totalProv)}</td>
          <td style="text-align:right"><span class="badge" style="${badgeStyle}">${pctProvVal.toFixed(1)}%</span></td>
        </tr>`;
    });
  }
  tbody += '</tbody>';

  const overallPct = parsedOffline.totalCount > 0 ? (parsedOffline.totalPoolCount / parsedOffline.totalCount * 100) : 0;
  const tfoot = `
    <tfoot>
      <tr style="font-weight:800;background:var(--card-sub, var(--card))">
        <td style="text-align:center;color:var(--mut)">★</td>
        <td style="text-align:left;color:var(--tx-heading)">TỔNG TOÀN BỘ (${items.length} tỉnh thành có ticket treo)</td>
        <td style="text-align:right;color:#ef4444;font-size:14px">${n0(parsedOffline.totalPoolCount)}</td>
        <td style="text-align:right;color:var(--tx-heading)">100%</td>
        <td style="text-align:right;color:var(--tx-heading)">${n0(parsedOffline.totalCount)}</td>
        <td style="text-align:right;color:#ef4444;font-size:13px">${overallPct.toFixed(1)}%</td>
      </tr>
    </tfoot>`;

  tbl.innerHTML = thead + tbody + tfoot;
}

/**
 * Mở modal danh sách chi tiết data tồn khi nhấp vào dòng bất kỳ
 */
function openDataTonDrilldownModal(mode, filterLabel, filterValue, filterKey) {
  const m = $('cardListModal');
  const t = $('mTitle');
  const s = $('mSubtitle');
  const body = $('mCardList');
  if (!m || !t || !body) return;

  const raw = mode === 'online' ? DATATON_STATE.online : DATATON_STATE.offline;
  if (!raw) return;

  const parsed = mode === 'online' ? normalizeDataTonOnline(raw) : normalizeDataTonOffline(raw);
  if (!parsed) return;

  let filtered = [];
  if (filterKey === 'user') {
    filtered = parsed.records.filter(r => r.user === filterValue);
  } else if (filterKey === 'job') {
    filtered = parsed.records.filter(r => r.job === filterValue);
  } else if (filterKey === 'province') {
    filtered = parsed.records.filter(r => r.province === filterValue);
  } else if (filterKey === 'poolProvince') {
    filtered = (parsed.poolRecords || []).filter(r => r.province === filterValue);
  } else {
    filtered = parsed.records;
  }

  t.textContent = `Danh sách Data Tồn: ${filterValue}`;
  if (s) {
    const poolNote = filterKey === 'poolProvince' ? ' (Treo ngoài - CSKH Hỗ trợ trực tiếp)' : '';
    s.textContent = `${filtered.length} ticket chưa làm${poolNote} · Nguồn: ${mode === 'online' ? 'ton online' : 'ton offline'}`;
  }

  if (filtered.length === 0) {
    body.innerHTML = '<div style="text-align:center;padding:30px;color:var(--mut)">Không có dữ liệu tồn nào.</div>';
  } else {
    body.innerHTML = filtered.map((rec, idx) => {
      const extraInfo = [];
      if (rec.time) extraInfo.push(`📅 Tạo lúc: ${esc(rec.time)}`);
      if (rec.industry) extraInfo.push(`🏷️ Ngành: ${esc(rec.industry)}`);
      if (rec.product) extraInfo.push(`💻 ${esc(rec.product)}`);
      if (rec.job) extraInfo.push(`📋 ${esc(rec.job)}`);
      if (rec.province) extraInfo.push(`📍 ${esc(rec.province)}`);
      if (rec.user) extraInfo.push(`👤 Xử lý: ${esc(rec.user)}`);

      return `
        <div class="card" style="margin-bottom:10px;padding:12px 14px;border:1px solid var(--line);background:var(--card-sub, var(--card));border-radius:8px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:6px">
            <div>
              <div style="font-weight:700;font-size:14px;color:var(--tx-heading)">
                ${idx + 1}. Retailer ID: <span style="color:var(--acc)">${esc(rec.retId)}</span>
                <span class="badge" style="background:#ef4444;color:#fff;font-size:10.5px;margin-left:6px">${esc(rec.status || 'Chưa làm')}</span>
              </div>
              <div class="mut sm" style="margin-top:4px;display:flex;gap:10px;flex-wrap:wrap">
                ${extraInfo.map(info => `<span>${info}</span>`).join(' · ')}
              </div>
            </div>
          </div>
          ${rec.address ? `<div style="font-size:12px;color:var(--tx);margin-top:4px"><span class="mut">Địa chỉ:</span> ${esc(rec.address)}</div>` : ''}
          ${rec.desc ? `<div style="font-size:12px;color:var(--mut);margin-top:6px;padding:6px 8px;background:var(--input-bg);border-radius:6px;max-height:80px;overflow:auto">${esc(rec.desc)}</div>` : ''}
        </div>`;
    }).join('');
  }

  m.style.display = 'flex';
}

/**
 * Điều phối render toàn bộ Tab Data Tồn
 */
function renderDataTon() {
  const parsedOnline = DATATON_STATE.online ? normalizeDataTonOnline(DATATON_STATE.online) : null;
  const parsedOffline = DATATON_STATE.offline ? normalizeDataTonOffline(DATATON_STATE.offline) : null;

  renderDataTonSummaryCards(parsedOnline, parsedOffline);

  if (parsedOnline) {
    renderOnlineUserTable(parsedOnline);
    renderOnlineJobTable(parsedOnline);
  }
  if (parsedOffline) {
    renderOfflineUserTable(parsedOffline);
    renderOfflineProvinceTable(parsedOffline);
    renderOfflinePoolProvinceTable(parsedOffline);
  }
}

/**
 * Tải dữ liệu Data Tồn từ IndexedDB Smart Cache hoặc API song song
 */
async function loadDataTon(forceReload = false) {
  const btn = $('btnReloadDataTon');
  const badge = $('datatonSrcBadge');

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
        const req = tx.objectStore(STORE_NAME).get(CACHE_KEY_DATATON);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });

      if (cached && cached.online && Array.isArray(cached.online) && cached.offline && Array.isArray(cached.offline)) {
        const ageMs = Date.now() - (cached.savedAt || 0);
        const minsAgo = Math.max(0, Math.floor(ageMs / 60000));
        const timeLabel = minsAgo === 0 ? 'vừa xong' : `${minsAgo} phút trước`;

        if (ageMs < CACHE_TTL_MS) {
          DATATON_STATE = cached;
          renderDataTon();
          if (badge) {
            badge.className = 'badge b-cache';
            badge.textContent = `Bộ nhớ đệm (${timeLabel})`;
          }
          if (btn) {
            btn.disabled = false;
            btn.textContent = '⟳ Tải lại Data Tồn';
          }
          showToast(`⚡ Đã tải tức thì Data Tồn từ bộ nhớ đệm (${timeLabel}).`, true);
          return;
        } else {
          DATATON_STATE = cached;
          renderDataTon();
          if (badge) {
            badge.className = 'badge b-load';
            badge.textContent = `Bộ nhớ đệm cũ (${timeLabel}) · Đang cập nhật…`;
          }
        }
      }
    } catch (e) {
      console.warn('Lỗi kiểm tra cache dataton:', e);
    }
  }

  // 2. Tải API trực tiếp song song (Online & Offline)
  const urlOnline = API_DATATON_ONLINE + (API_DATATON_ONLINE.includes('?') ? '&' : '?') + '_t=' + Date.now();
  const urlOffline = API_DATATON_OFFLINE + (API_DATATON_OFFLINE.includes('?') ? '&' : '?') + '_t=' + (Date.now() + 1);

  try {
    const [resOn, resOff] = await Promise.all([
      safeFetchJson(urlOnline, 2),
      safeFetchJson(urlOffline, 2)
    ]);

    if (resOn.status !== 'success' || !Array.isArray(resOn.data) || resOff.status !== 'success' || !Array.isArray(resOff.data)) {
      throw new Error('Dữ liệu Data Tồn từ máy chủ Google không đầy đủ.');
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    DATATON_STATE = {
      online: resOn.data,
      offline: resOff.data,
      savedAt: Date.now(),
      timeStr: timeStr
    };

    // Lưu IndexedDB
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(DATATON_STATE, CACHE_KEY_DATATON);
    } catch (e) {}

    renderDataTon();
    if (badge) {
      badge.className = 'badge b-live';
      badge.textContent = `API trực tiếp ${timeStr}`;
    }
    showToast(`Đã đồng bộ thành công Data Tồn (Online: ${n0(resOn.data.length - 1)}, Offline: ${n0(resOff.data.length - 1)}) lúc ${timeStr}!`, true);
  } catch (err) {
    console.error('Lỗi khi tải Data Tồn:', err);
    if (DATATON_STATE.online && DATATON_STATE.offline) {
      if (badge) {
        badge.className = 'badge b-err';
        badge.textContent = 'API bận — giữ dữ liệu cũ';
      }
      showToast('Máy chủ Google đang bận — vẫn giữ nguyên dữ liệu Data Tồn hiện tại.', false);
    } else {
      if (badge) {
        badge.className = 'badge b-err';
        badge.textContent = 'Lỗi kết nối API';
      }
      showToast('Lỗi khi tải Data Tồn: ' + (err.message || 'Không kết nối được'), false);
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '⟳ Tải lại Data Tồn';
    }
  }
}

/* ==========================================================================
   3. XUẤT FILE CSV
   ========================================================================== */

function exportGenericCsv(title, headers, rows, filename, toastMsg) {
  const lines = [];
  lines.push([title]);
  lines.push(['Xuất ngày: ' + new Date().toLocaleString('vi-VN')]);
  lines.push([]);
  lines.push(headers);
  rows.forEach(r => lines.push(r));

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
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(toastMsg, true);
}

function exportDataTonOnlineUserCsv() {
  if (!DATATON_STATE.online) {
    showToast('Chưa có dữ liệu Online Tồn để xuất CSV!', false);
    return;
  }
  const parsed = normalizeDataTonOnline(DATATON_STATE.online);
  if (!parsed) return;

  const rows = parsed.users.map((it, idx) => [idx + 1, it.name, it.count, it.pct.toFixed(2) + '%']);
  rows.push(['★', 'TỔNG CỘNG', parsed.totalCount, '100.00%']);
  exportGenericCsv(
    'DATA TỒN ONLINE - THỐNG KÊ THEO NGƯỜI XỬ LÝ (SHEET ton online)',
    ['STT', 'Người Xử Lý', 'Số Lượng Tồn', 'Tỷ Trọng (%)'],
    rows,
    'DataTon_Online_TheoNguoiXuLy',
    'Đã xuất file CSV Tồn Online Theo Người Xử Lý thành công!'
  );
}

function exportDataTonOnlineJobCsv() {
  if (!DATATON_STATE.online) {
    showToast('Chưa có dữ liệu Online Tồn để xuất CSV!', false);
    return;
  }
  const parsed = normalizeDataTonOnline(DATATON_STATE.online);
  if (!parsed) return;

  const rows = parsed.jobs.map((it, idx) => [idx + 1, it.name, it.count, it.pct.toFixed(2) + '%']);
  rows.push(['★', 'TỔNG CỘNG', parsed.totalCount, '100.00%']);
  exportGenericCsv(
    'DATA TỒN ONLINE - THỐNG KÊ THEO LOẠI CÔNG VIỆC (SHEET ton online)',
    ['STT', 'Loại Công Việc', 'Số Lượng Tồn', 'Tỷ Trọng (%)'],
    rows,
    'DataTon_Online_TheoLoaiCongViec',
    'Đã xuất file CSV Tồn Online Theo Loại Công Việc thành công!'
  );
}

function exportDataTonOfflineUserCsv() {
  if (!DATATON_STATE.offline) {
    showToast('Chưa có dữ liệu Offline Tồn để xuất CSV!', false);
    return;
  }
  const parsed = normalizeDataTonOffline(DATATON_STATE.offline);
  if (!parsed) return;

  const rows = parsed.users.map((it, idx) => [idx + 1, it.name, it.count, it.pct.toFixed(2) + '%']);
  rows.push(['★', 'TỔNG CỘNG', parsed.totalCount, '100.00%']);
  exportGenericCsv(
    'DATA TỒN OFFLINE - THỐNG KÊ THEO NGƯỜI XỬ LÝ (SHEET ton offline)',
    ['STT', 'Người Xử Lý', 'Số Lượng Tồn', 'Tỷ Trọng (%)'],
    rows,
    'DataTon_Offline_TheoNguoiXuLy',
    'Đã xuất file CSV Tồn Offline Theo Người Xử Lý thành công!'
  );
}

function exportDataTonOfflineProvinceCsv() {
  if (!DATATON_STATE.offline) {
    showToast('Chưa có dữ liệu Offline Tồn để xuất CSV!', false);
    return;
  }
  const parsed = normalizeDataTonOffline(DATATON_STATE.offline);
  if (!parsed) return;

  const rows = parsed.provinces.map((it, idx) => [idx + 1, it.name, it.count, it.pct.toFixed(2) + '%']);
  rows.push(['★', 'TỔNG CỘNG', parsed.totalCount, '100.00%']);
  exportGenericCsv(
    'DATA TỒN OFFLINE - THỐNG KÊ THEO TỈNH THÀNH (SHEET ton offline)',
    ['STT', 'Tỉnh / Thành Phố', 'Số Lượng Tồn', 'Tỷ Trọng (%)'],
    rows,
    'DataTon_Offline_TheoTinhThanh',
    'Đã xuất file CSV Tồn Offline Theo Tỉnh Thành thành công!'
  );
}

function exportDataTonOfflinePoolProvinceCsv() {
  if (!DATATON_STATE.offline) {
    showToast('Chưa có dữ liệu Offline Tồn để xuất CSV!', false);
    return;
  }
  const parsed = normalizeDataTonOffline(DATATON_STATE.offline);
  if (!parsed) return;

  const rows = (parsed.poolProvinces || []).map((it, idx) => [
    idx + 1,
    it.name,
    it.count,
    it.pct.toFixed(2) + '%',
    it.totalProv,
    it.pctOfProvince.toFixed(2) + '%'
  ]);
  const overallPct = parsed.totalCount > 0 ? (parsed.totalPoolCount / parsed.totalCount * 100).toFixed(2) + '%' : '0%';
  rows.push(['★', 'TỔNG CỘNG', parsed.totalPoolCount, '100.00%', parsed.totalCount, overallPct]);

  exportGenericCsv(
    'DATA TỒN OFFLINE - THỐNG KÊ TREO NGOÀI THEO TỈNH THÀNH (CSKH HỖ TRỢ TRỰC TIẾP)',
    ['STT', 'Tỉnh / Thành Phố', 'SL Treo Ngoài', 'Tỷ Trọng / Tổng Treo (%)', 'Tổng Tồn Tỉnh', 'Tỷ Lệ Treo / Tồn Tỉnh (%)'],
    rows,
    'DataTon_Offline_TreoNgoai_TheoTinhThanh',
    'Đã xuất file CSV Tồn Treo Ngoài Offline Theo Tỉnh Thành thành công!'
  );
}

function exportDataTonAllCsv() {
  if (!DATATON_STATE.online && !DATATON_STATE.offline) {
    showToast('Chưa có dữ liệu Data Tồn để xuất CSV!', false);
    return;
  }

  const lines = [];
  lines.push(['BÁO CÁO TỔNG HỢP DATA TỒN (ONLINE & OFFLINE)']);
  lines.push(['Xuất ngày: ' + new Date().toLocaleString('vi-VN')]);
  lines.push([]);

  if (DATATON_STATE.online) {
    const parsedOn = normalizeDataTonOnline(DATATON_STATE.online);
    if (parsedOn) {
      lines.push(['=== 1. DATA TỒN ONLINE (SHEET ton online) ===']);
      lines.push(['--- 1.1: Theo Người Xử Lý ---']);
      lines.push(['STT', 'Người Xử Lý', 'Số Lượng Tồn', 'Tỷ Trọng (%)']);
      parsedOn.users.forEach((it, idx) => {
        lines.push([idx + 1, it.name, it.count, it.pct.toFixed(2) + '%']);
      });
      lines.push(['★', 'TỔNG CỘNG', parsedOn.totalCount, '100.00%']);
      lines.push([]);

      lines.push(['--- 1.2: Theo Loại Công Việc ---']);
      lines.push(['STT', 'Loại Công Việc', 'Số Lượng Tồn', 'Tỷ Trọng (%)']);
      parsedOn.jobs.forEach((it, idx) => {
        lines.push([idx + 1, it.name, it.count, it.pct.toFixed(2) + '%']);
      });
      lines.push(['★', 'TỔNG CỘNG', parsedOn.totalCount, '100.00%']);
      lines.push([]);
    }
  }

  if (DATATON_STATE.offline) {
    const parsedOff = normalizeDataTonOffline(DATATON_STATE.offline);
    if (parsedOff) {
      lines.push(['=== 2. DATA TỒN OFFLINE (SHEET ton offline) ===']);
      lines.push(['--- 2.1: Theo Người Xử Lý ---']);
      lines.push(['STT', 'Người Xử Lý', 'Số Lượng Tồn', 'Tỷ Trọng (%)']);
      parsedOff.users.forEach((it, idx) => {
        lines.push([idx + 1, it.name, it.count, it.pct.toFixed(2) + '%']);
      });
      lines.push(['★', 'TỔNG CỘNG', parsedOff.totalCount, '100.00%']);
      lines.push([]);

      lines.push(['--- 2.2: Theo Tỉnh Thành Phố ---']);
      lines.push(['STT', 'Tỉnh / Thành Phố', 'Số Lượng Tồn', 'Tỷ Trọng (%)']);
      parsedOff.provinces.forEach((it, idx) => {
        lines.push([idx + 1, it.name, it.count, it.pct.toFixed(2) + '%']);
      });
      lines.push(['★', 'TỔNG CỘNG', parsedOff.totalCount, '100.00%']);
      lines.push([]);

      lines.push(['--- 2.3: Tồn Treo Ngoài Theo Tỉnh / Thành Phố (Pool CSKH Hỗ Trợ Trực Tiếp) ---']);
      lines.push(['STT', 'Tỉnh / Thành Phố', 'SL Treo Ngoài', 'Tỷ Trọng / Tổng Treo (%)', 'Tổng Tồn Tỉnh', 'Tỷ Lệ Treo / Tồn Tỉnh (%)']);
      (parsedOff.poolProvinces || []).forEach((it, idx) => {
        lines.push([idx + 1, it.name, it.count, it.pct.toFixed(2) + '%', it.totalProv, it.pctOfProvince.toFixed(2) + '%']);
      });
      const allPoolPct = parsedOff.totalCount > 0 ? (parsedOff.totalPoolCount / parsedOff.totalCount * 100).toFixed(2) + '%' : '0%';
      lines.push(['★', 'TỔNG CỘNG', parsedOff.totalPoolCount, '100.00%', parsedOff.totalCount, allPoolPct]);
      lines.push([]);
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
  a.download = `BaoCao_TongHop_DataTon_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Đã xuất toàn bộ dữ liệu Data Tồn thành công!', true);
}
