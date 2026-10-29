// --- CẤU HÌNH API & BỘ NHỚ ĐỆM CHO BÁO CÁO TUẦN ---
const API_URL = (typeof API_BASE !== 'undefined' ? API_BASE : (typeof API !== 'undefined' ? API.split('?')[0] : 'https://script.google.com/macros/s/AKfycbzBneKTnuVmEJD0ra4MVxrbGvH_Wh2labnSOm-rNxIz6TRR2nF2NpunBKXXnU-uMWPguQ/exec'));
window.cacheData = window.cacheData || { 'data': null, 'atcdalam': null, 'thongke': null, 'hieusuat': null, 'ngaycong': null, 'kpi': null };
var cacheData = window.cacheData;

function normalizeNgayCongData(rawData) {
    if (!Array.isArray(rawData) || rawData.length === 0) return [];
    const firstRow = rawData[0];
    if (!firstRow || typeof firstRow !== 'object') return rawData;
    const keys0 = Object.keys(firstRow);
    const hasStandardKeys = keys0.some(k => k === 'Tên NS' || k === 'Họ và tên' || k === 'staff' || k === 'Chấm công');
    if (hasStandardKeys) return rawData;
    const result = [];
    const headerStaffName = keys0.find(k => k.includes('-') || /[a-zA-ZÀ-ỹ]/.test(k));
    const headerWorkdayKey = keys0.find(k => k !== headerStaffName);
    if (headerStaffName) {
        result.push({
            'Tên NS': headerStaffName.trim(),
            'T công': headerWorkdayKey ? (Number(headerWorkdayKey) || 0) : 0
        });
    }
    rawData.forEach(row => {
        let staffName = '';
        let workDayVal = 0;
        Object.keys(row).forEach(k => {
            const val = row[k];
            if (typeof val === 'string' && (val.includes('-') || /[a-zA-ZÀ-ỹ]/.test(val))) {
                staffName = val.trim();
            } else if (val !== null && val !== undefined && !isNaN(Number(val))) {
                workDayVal = Number(val);
            }
        });
        if (staffName) {
            result.push({
                'Tên NS': staffName,
                'T công': workDayVal
            });
        }
    });
    return result;
}

// --- TAB BÁO CÁO TUẦN TỰ ĐỘNG ---
// Mục tiêu: lấy trực tiếp dữ liệu dashboard hiện có, tạo báo cáo native HTML
// để copy vào Atlassian/Confluence mà không cần chụp ảnh thủ công.

const WEEKLY_REPORT_SNAPSHOT_KEY = 'crm_weekly_report_snapshots_v1';
const WEEKLY_REPORT_MANUAL_KEY = 'crm_weekly_report_manual_v1';

window.weeklyReportState = window.weeklyReportState || {
    metrics: null,
    html: '',
    plainText: '',
    previousSnapshot: null
};

function wrPad2(v) { return String(v).padStart(2, '0'); }

function wrToRoman(num) {
    const roman = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV'];
    return roman[num] || String(num);
}

function wrFormatDateInput(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d)) return '';
    return `${d.getFullYear()}-${wrPad2(d.getMonth() + 1)}-${wrPad2(d.getDate())}`;
}

function wrFormatVNDate(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d)) return '-';
    return `${wrPad2(d.getDate())}/${wrPad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function wrEndOfDay(date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
}

function wrStartOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function wrEscapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function wrNumber(value, digits = 2) {
    const n = Number(value) || 0;
    return n.toLocaleString('vi-VN', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    });
}

function wrInt(value) {
    return (Number(value) || 0).toLocaleString('vi-VN');
}

function wrPct(value, digits = 2) {
    if (value === null || value === undefined || !isFinite(Number(value))) return '-';
    return `${Number(value).toLocaleString('vi-VN', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    })}%`;
}

function wrCleanName(raw) {
    if (typeof cleanLeaderName === 'function') {
        try { return cleanLeaderName(raw); } catch (e) { /* fallback */ }
    }
    let name = String(raw || '').trim();
    if (!name) return '';
    const parts = name.split('-');
    if (parts.length >= 2 && /^\s*\d+\s*$/.test(parts[0])) {
        name = parts.slice(1).join('-').trim();
    } else if (parts.length >= 2 && parts[0].length <= 8) {
        name = parts.slice(1).join('-').trim();
    }
    return name;
}

function wrIsManager(name) {
    return wrCleanName(name).toLowerCase().includes('nguyễn ái quốc');
}

function wrParseDate(value, referenceDate = new Date()) {
    if (!value && value !== 0) return null;
    if (value instanceof Date) return isNaN(value) ? null : new Date(value);

    const s = String(value).trim();
    if (!s) return null;

    // ISO / YYYY-MM-DD
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) {
        const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        return isNaN(d) ? null : d;
    }

    // DD/MM/YYYY
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) {
        const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
        return isNaN(d) ? null : d;
    }

    // Chỉ có ngày trong tháng
    if (/^\d{1,2}$/.test(s)) {
        const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), Number(s));
        return isNaN(d) ? null : d;
    }

    const d = new Date(s);
    return isNaN(d) ? null : d;
}

function wrRowDate(row, reportEndDate) {
    // Ưu tiên trường NGÀY trước trường GIỜ.
    // Dữ liệu hieusuat thường có cả "Ngày checkin" (vd: 13/08/2026) và
    // "Thời gian checkin" (vd: 14:32:10). Nếu lấy giờ trước thì parse date thất bại
    // và toàn bộ hiệu suất bị lọc về 0 ATC/ngày.
    const candidates = [
        row['Ngày checkin'],
        row['Ngày'],
        row['Thời gian tạo'],
        row['Thời gian checkin'],
        row['Giờ Chekcin']
    ];
    for (const raw of candidates) {
        if (raw === null || raw === undefined || raw === '') continue;
        const d = wrParseDate(raw, reportEndDate);
        if (d) return d;
    }
    return null;
}

function wrFilterRowsByDate(rows, fromDate, toDate) {
    if (!Array.isArray(rows)) return [];
    const from = wrStartOfDay(fromDate);
    const to = wrEndOfDay(toDate);
    return rows.filter(row => {
        const d = wrRowDate(row, toDate);
        return d && d >= from && d <= to;
    });
}

function wrGetPercentFloat(value, header = '') {
    if (typeof getPercentFloat === 'function') {
        try {
            const v = getPercentFloat(value, header);
            if (v !== null && v !== undefined && isFinite(v)) return Number(v);
        } catch (e) { /* fallback */ }
    }
    if (value === null || value === undefined || value === '') return null;
    let s = String(value).replace('%', '').replace(',', '.').trim();
    let n = Number(s);
    if (!isFinite(n)) return null;
    if (!String(value).includes('%') && Math.abs(n) <= 5) n *= 100;
    return n;
}

function wrPick(row, aliases, fallback = '') {
    if (!row || typeof row !== 'object') return fallback;
    for (const key of aliases) {
        if (Object.prototype.hasOwnProperty.call(row, key) && row[key] !== null && row[key] !== undefined && row[key] !== '') {
            return row[key];
        }
    }
    // Fallback không phân biệt hoa/thường và khoảng trắng.
    const normalized = Object.keys(row).reduce((m, k) => {
        m[String(k).trim().toLowerCase()] = k;
        return m;
    }, {});
    for (const key of aliases) {
        const real = normalized[String(key).trim().toLowerCase()];
        if (real !== undefined && row[real] !== null && row[real] !== undefined && row[real] !== '') return row[real];
    }
    return fallback;
}

function wrNumPick(row, aliases, fallback = 0) {
    const v = wrPick(row, aliases, fallback);
    const n = Number(String(v).replace(',', '.'));
    return isFinite(n) ? n : fallback;
}

async function wrFetchSheet(tabName) {
    // Ưu tiên sử dụng dữ liệu đã nạp sẵn trong Dashboard
    if (tabName === 'kpi' && typeof KPI_RAW_DATA !== 'undefined' && Array.isArray(KPI_RAW_DATA) && KPI_RAW_DATA.length > 1) {
        cacheData['kpi'] = KPI_RAW_DATA;
        return KPI_RAW_DATA;
    }
    if (tabName === 'data' && typeof RAW !== 'undefined' && Array.isArray(RAW) && RAW.length > 0) {
        cacheData['data'] = RAW;
        return RAW;
    }
    if (cacheData && cacheData[tabName] && Array.isArray(cacheData[tabName]) && cacheData[tabName].length) {
        return cacheData[tabName];
    }

    const cached = typeof getFromSessionCache === 'function' ? getFromSessionCache(tabName) : null;
    if (cached && Array.isArray(cached) && cached.length) {
        cacheData[tabName] = tabName === 'ngaycong' && typeof normalizeNgayCongData === 'function'
            ? normalizeNgayCongData(cached)
            : cached;
        return cacheData[tabName];
    }

    let fetchUrl = API_URL + '?sheet=' + (tabName === 'kpi' ? 'KPI' : tabName);
    if (tabName === 'thongke') fetchUrl += '&range=K3:AQ11';
    if (tabName === 'kpi') fetchUrl += '&range=A16:O27';

    const response = await fetch(fetchUrl);
    const result = await response.json();
    if (!result || result.status !== 'success') {
        throw new Error(`Không tải được sheet ${tabName}: ${result && result.message ? result.message : 'Không rõ lỗi'}`);
    }

    let data = result.data || [];
    if (tabName === 'ngaycong' && typeof normalizeNgayCongData === 'function') {
        data = normalizeNgayCongData(data);
    }
    cacheData[tabName] = data;
    if (typeof saveToSessionCache === 'function') saveToSessionCache(tabName, data);
    return data;
}

async function wrEnsureAllData() {
    const keys = ['data', 'thongke', 'hieusuat', 'ngaycong', 'kpi'];
    const results = await Promise.all(keys.map(async (k) => {
        try {
            return await wrFetchSheet(k);
        } catch (err) {
            console.warn('[Báo cáo tuần] Cảnh báo khi tải sheet ' + k + ':', err);
            return [];
        }
    }));
    const out = {};
    keys.forEach((k, i) => out[k] = results[i]);
    return out;
}

function wrBuildKpiMetrics(rows) {
    const rawRows = (rows || []).filter(r => {
        const name = wrCleanName(r['Tên SC']);
        return name && !/tổng cộng|trung bình/i.test(name);
    });

    const staffRows = rawRows.map(r => ({
        name: wrCleanName(r['Tên SC']),
        level: String(r['Level'] ?? '').replace(/level\s*/i, '').trim(),
        impact: wrGetPercentFloat(r['% impact'], '% impact'),
        active: wrGetPercentFloat(r['% KPI active'], '% KPI active'),
        point: wrGetPercentFloat(r['% Điểm tổng'], '% Điểm tổng'),
        addon: wrGetPercentFloat(r['% Điểm addon'], '% Điểm addon'),
        total: wrGetPercentFloat(r['KPI Tổng'], 'KPI Tổng'),
        done: wrNumPick(r, ['Đã làm']),
        actImpact: wrNumPick(r, ['Act impact', 'ACT IMPACT']),
        kpiActive: wrNumPick(r, ['KPI active', 'KPI ACTIVE']),
        activeCount: wrNumPick(r, ['active', 'Active', 'ACTIVE']),
        // Cột mục tiêu điểm tổng và KPI Tổng cuối bảng là 2 trường khác nhau.
        kpiPoint: wrNumPick(r, ['KPI tổng', 'KPI Tổng Điểm', 'KPI tổng điểm']),
        totalPoint: wrNumPick(r, ['Tổng điểm', 'TỔNG ĐIỂM']),
        kpiAddon: wrNumPick(r, ['KPI addon', 'KPI Addon', 'KPI ADDON']),
        addonPoint: wrNumPick(r, ['Điểm addon', 'Điểm Addon', 'ĐIỂM ADDON']),
        raw: r
    }));

    const avg = key => {
        const vals = staffRows.map(r => r[key]).filter(v => v !== null && isFinite(v));
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    };

    const byActive = [...staffRows].sort((a, b) => (b.active || 0) - (a.active || 0));
    const byAddon = [...staffRows].sort((a, b) => (b.addon || 0) - (a.addon || 0));
    const byTotal = [...staffRows].sort((a, b) => (b.total || 0) - (a.total || 0));
    const worst = [...staffRows].sort((a, b) => (a.total || 0) - (b.total || 0)).slice(0, 2);

    return {
        rawRows,
        rawHeaders: rawRows.length ? Object.keys(rawRows[0]) : [],
        rows: staffRows,
        impactTeam: avg('impact'),
        activeTeam: avg('active'),
        pointTeam: avg('point'),
        addonTeam: avg('addon'),
        totalTeam: avg('total'),
        totalDone: staffRows.reduce((sum, r) => sum + r.done, 0),
        topActive: byActive.slice(0, 3),
        achievedAddon: byAddon.filter(r => (r.addon || 0) >= 100),
        topAddon: byAddon.slice(0, 3),
        topTotal: byTotal.slice(0, 3),
        worst
    };
}

function wrBuildWorkdayMap(ngayCongRows, hieuRows, fromDate, toDate) {
    const map = {};
    const rows = Array.isArray(ngayCongRows) ? ngayCongRows : [];
    if (!rows.length) return map;

    const first = rows[0] || {};
    const detailed = ('Chấm công' in first) && ('Ngày' in first) && ('Họ và tên' in first || 'Tên NS' in first);

    if (detailed) {
        rows.forEach(r => {
            const name = wrCleanName(r['Họ và tên'] || r['Tên NS']);
            if (!name || wrIsManager(name)) return;
            const day = Number(r['Ngày']);
            if (!day) return;
            const d = new Date(toDate.getFullYear(), toDate.getMonth(), day);
            if (d < wrStartOfDay(fromDate) || d > wrEndOfDay(toDate)) return;
            const status = String(r['Chấm công'] || '').trim().toUpperCase();
            const amount = status === 'X' ? 1 : status === 'X/2' ? 0.5 : 0;
            map[name] = (map[name] || 0) + amount;
        });
        return map;
    }

    // Dạng tổng hợp: ưu tiên T công hiện có.
    rows.forEach(r => {
        const name = wrCleanName(r['Tên NS'] || r['Họ và tên'] || r['staff']);
        if (!name || wrIsManager(name)) return;
        map[name] = Number(r['T công']) || Number(r['Chấm công']) || 0;
    });

    // Nếu người dùng chọn khoảng ngày ngắn hơn toàn bộ dữ liệu, ước lượng giống logic hiện có.
    const hieuAll = Array.isArray(hieuRows) ? hieuRows : [];
    if (hieuAll.length && (fromDate.getDate() > 1)) {
        const allDays = {}, filteredDays = {};
        hieuAll.forEach(r => {
            const name = wrCleanName(r['Người xử lý']);
            if (!name || wrIsManager(name)) return;
            const d = wrRowDate(r, toDate);
            if (!d) return;
            allDays[name] = allDays[name] || new Set();
            allDays[name].add(wrFormatDateInput(d));
            if (d >= wrStartOfDay(fromDate) && d <= wrEndOfDay(toDate)) {
                filteredDays[name] = filteredDays[name] || new Set();
                filteredDays[name].add(wrFormatDateInput(d));
            }
        });
        Object.keys(map).forEach(name => {
            const all = allDays[name] ? allDays[name].size : 0;
            const filtered = filteredDays[name] ? filteredDays[name].size : 0;
            if (all > 0) map[name] = map[name] * filtered / all;
        });
    }

    return map;
}

function wrBuildPerformanceMetrics(hieuRows, ngayCongRows, fromDate, toDate) {
    const filtered = wrFilterRowsByDate(hieuRows, fromDate, toDate)
        .filter(r => !wrIsManager(r['Người xử lý']));
    const workdayMap = wrBuildWorkdayMap(ngayCongRows, hieuRows, fromDate, toDate);

    const names = new Set(Object.keys(workdayMap));
    filtered.forEach(r => {
        const n = wrCleanName(r['Người xử lý']);
        if (n) names.add(n);
    });

    const rows = Array.from(names).map(name => {
        const staff = filtered.filter(r => wrCleanName(r['Người xử lý']) === name);
        const tCong = Number(workdayMap[name]) || 0;
        const totalATC = staff.length;
        const totalImpact = staff.reduce((s, r) => s + ((Number(r['Impact']) || Number(r['impact']) || 0) === 1 ? 1 : 0), 0);
        const totalKM = staff.reduce((s, r) => s + (Number(r['KM']) || 0), 0);
        const totalHours = staff.reduce((s, r) => s + (Number(r['HourSP']) || 0), 0);
        return {
            name,
            tCong,
            totalATC,
            totalImpact,
            totalKM,
            totalHours,
            avgATC: tCong > 0 ? totalATC / tCong : 0,
            avgKM: tCong > 0 ? totalKM / tCong : 0,
            avgHours: tCong > 0 ? totalHours / tCong : 0
        };
    }).filter(r => r.totalATC > 0 || r.tCong > 0);

    const valid = rows.filter(r => r.tCong > 0);
    const avg = key => valid.length ? valid.reduce((s, r) => s + r[key], 0) / valid.length : 0;
    const highATC = [...valid].sort((a, b) => b.avgATC - a.avgATC).slice(0, 3);
    const lowATC = [...valid].sort((a, b) => a.avgATC - b.avgATC).slice(0, 3);
    const highTime = [...valid].sort((a, b) => b.avgHours - a.avgHours).slice(0, 3);
    const under4 = valid.filter(r => r.avgHours < 4).sort((a, b) => a.avgHours - b.avgHours);
    const highKm = [...valid].sort((a, b) => b.avgKM - a.avgKM).slice(0, 2);
    const lowKm = [...valid].sort((a, b) => a.avgKM - b.avgKM).slice(0, 1);

    return {
        filteredRows: filtered,
        rows,
        avgATC: avg('avgATC'),
        avgKM: avg('avgKM'),
        avgHours: avg('avgHours'),
        highATC,
        lowATC,
        highTime,
        under4,
        highKm,
        lowKm
    };
}

function wrIsGenericQueueStaff(raw) {
    const s = wrCleanName(raw).toLowerCase();
    if (!s) return true;
    return s.includes('chăm sóc khách hàng') ||
           s.includes('hỗ trợ trực tiếp') ||
           s.includes('chưa nhận') ||
           s.includes('chưa phân') ||
           s === '-';
}

function wrBuildBacklogMetrics(dataRows) {
    const rows = Array.isArray(dataRows) ? dataRows : [];
    const queueRows = rows.filter(r => wrIsGenericQueueStaff(r['Người xử lý']));
    const assignedRows = rows.filter(r => !wrIsGenericQueueStaff(r['Người xử lý']) && !wrIsManager(r['Người xử lý']));

    const countBy = (list, getter) => {
        const m = {};
        list.forEach(r => {
            const key = getter(r) || 'Không rõ';
            m[key] = (m[key] || 0) + 1;
        });
        return Object.entries(m).sort((a, b) => b[1] - a[1]);
    };

    return {
        total: rows.length,
        queueTotal: queueRows.length,
        assignedTotal: assignedRows.length,
        provinces: countBy(queueRows, r => r['Tỉnh/Thành phố']),
        staff: countBy(assignedRows, r => wrCleanName(r['Người xử lý'])),
        overdue: rows.filter(r => Number(r['SLA']) >= 9).length
    };
}

function wrBuildIncomingMetrics(rows, fromDate, toDate) {
    const data = (rows || []).filter(r => r['Tỉnh/Thành phố'] && r['Tỉnh/Thành phố'] !== 'Grand Total');
    if (!data.length) return { total: 0, avg: 0, provinces: [], dayCount: 0, dayKeys: [], dayTotals: {} };

    const allDayKeys = Object.keys(data[0]).filter(k => /^\d+$/.test(String(k))).map(Number).sort((a, b) => a - b);
    const fromDay = fromDate.getDate();
    const toDay = toDate.getDate();
    const dayKeys = allDayKeys.filter(d => d >= fromDay && d <= toDay);
    const dayTotals = {};
    dayKeys.forEach(d => dayTotals[d] = 0);

    const provinces = data.map(r => {
        const days = {};
        dayKeys.forEach(d => {
            const v = Number(r[d]) || 0;
            days[d] = v;
            dayTotals[d] += v;
        });
        const total = dayKeys.reduce((sum, d) => sum + days[d], 0);
        return { name: r['Tỉnh/Thành phố'], total, avg: dayKeys.length ? total / dayKeys.length : 0, days };
    });
    const rankedProvinces = [...provinces].sort((a, b) => b.total - a.total);

    const total = provinces.reduce((sum, r) => sum + r.total, 0);
    return {
        total,
        avg: dayKeys.length ? total / dayKeys.length : 0,
        provinces,
        rankedProvinces,
        dayCount: dayKeys.length,
        dayKeys,
        dayTotals
    };
}

function wrBuildSelfCreatedMetrics(filteredHieuRows) {
    const stats = {};
    filteredHieuRows.forEach(r => {
        const processor = wrCleanName(r['Người xử lý']);
        const creator = wrCleanName(r['Người tạo']);
        if (!processor || wrIsManager(processor)) return;
        stats[processor] = stats[processor] || { total: 0, self: 0 };
        stats[processor].total++;
        if (creator && creator === processor) stats[processor].self++;
    });

    const rows = Object.entries(stats).map(([name, s]) => ({
        name,
        total: s.total,
        self: s.self,
        pct: s.total ? s.self / s.total * 100 : 0
    })).sort((a, b) => b.pct - a.pct);

    const total = rows.reduce((s, r) => s + r.total, 0);
    const self = rows.reduce((s, r) => s + r.self, 0);
    return { rows, total, self, pct: total ? self / total * 100 : 0 };
}

function wrBuildSupportDurationMetrics(filteredHieuRows) {
    const buckets = [
        { label: '1. 0-5P', plain: '0-5 phút', check: m => m >= 0 && m <= 5 },
        { label: '2. 6-10P', plain: '6-10 phút', check: m => m > 5 && m <= 10 },
        { label: '3. 11-30P', plain: '11-30 phút', check: m => m > 10 && m <= 30 },
        { label: '4. 31-59P', plain: '31-59 phút', check: m => m > 30 && m < 60 },
        { label: '5. 1-2H', plain: '1-2 giờ', check: m => m >= 60 && m <= 120 },
        { label: '6. 2-4H', plain: '2-4 giờ', check: m => m > 120 && m <= 240 },
        { label: '7. 4-8H', plain: '4-8 giờ', check: m => m > 240 && m <= 480 },
        { label: '8. TRÊN 8H', plain: 'Trên 8 giờ', check: m => m > 480 }
    ];
    const counts = new Array(buckets.length).fill(0);
    const staffStats = {};
    let total = 0;

    filteredHieuRows.forEach(r => {
        const name = wrCleanName(r['Người xử lý']);
        if (!name || wrIsManager(name)) return;
        let mins = 0;
        if (r['HourSP'] !== undefined && r['HourSP'] !== null && r['HourSP'] !== '') {
            mins = (Number(r['HourSP']) || 0) * 60;
        } else {
            const d1 = wrParseDate(r['Thời gian checkin']);
            const d2 = wrParseDate(r['Thời gian checkout']);
            if (d1 && d2 && d2 >= d1) mins = (d2 - d1) / 60000;
        }
        const idx = buckets.findIndex(b => b.check(mins));
        if (idx < 0) return;
        counts[idx]++;
        total++;
        if (!staffStats[name]) staffStats[name] = { name, total: 0, counts: new Array(buckets.length).fill(0) };
        staffStats[name].counts[idx]++;
        staffStats[name].total++;
    });

    const rows = buckets.map((b, i) => ({ label: b.plain, shortLabel: b.label, count: counts[i], pct: total ? counts[i] / total * 100 : 0 }));
    const staffRows = Object.keys(staffStats).sort().map(name => staffStats[name]);
    return { buckets, rows, staffRows, counts, total, shortCount: counts[0], shortPct: total ? counts[0] / total * 100 : 0 };
}

let wrSaveManualTimer = null;
function wrDebouncedSaveManual() {
    clearTimeout(wrSaveManualTimer);
    wrSaveManualTimer = setTimeout(() => {
        wrSaveManual();
    }, 350);
}

function wrLoadManual() {
    try {
        return JSON.parse(localStorage.getItem(WEEKLY_REPORT_MANUAL_KEY) || '{}') || {};
    } catch (e) { return {}; }
}

function wrSaveManual() {
    const customSections = [];
    document.querySelectorAll('.wr-custom-sec-card').forEach(card => {
        const secId = card.getAttribute('data-sec-id') || '';
        const title = card.querySelector('.wr-custom-title-input')?.value.trim() || '';
        const editor = card.querySelector('.wr-custom-editor');
        const contentHtml = editor ? editor.innerHTML.trim() : '';
        if (title || (contentHtml && contentHtml !== '<br>' && contentHtml !== '<p><br></p>')) {
            customSections.push({ id: secId, title, contentHtml });
        }
    });

    const manual = {
        addressTotal: document.getElementById('wrAddressTotal')?.value || '',
        addressDone: document.getElementById('wrAddressDone')?.value || '',
        appFnb: document.getElementById('wrAppFnb')?.value || '',
        issues: document.getElementById('wrIssues')?.value || '',
        plans: document.getElementById('wrPlans')?.value || '',
        extra: document.getElementById('wrExtra')?.value || '',
        customSections,
        docTitle: document.getElementById('wrDocTitle')?.value || '',
        recipient: document.getElementById('wrRecipient')?.value || ''
    };
    localStorage.setItem(WEEKLY_REPORT_MANUAL_KEY, JSON.stringify(manual));
    return manual;
}

// ===== BỘ CÔNG CỤ POPOVER MÀU & THAO TÁC BẢNG TÙY CHỈNH =====
function wrBuildBgPopoverHtml(id) {
    return `
        <div class="wr-popover-scope">
            <span class="wr-popover-label">Phạm vi tô màu nền:</span>
            <div class="wr-scope-options">
                <label><input type="radio" name="bgScope_${id}" value="cell" checked onchange="event.stopPropagation()"> Ô đang chọn</label>
                <label><input type="radio" name="bgScope_${id}" value="row" onchange="event.stopPropagation()"> Cả hàng</label>
                <label><input type="radio" name="bgScope_${id}" value="table" onchange="event.stopPropagation()"> Cả bảng</label>
            </div>
        </div>
        <span class="wr-popover-label">Màu có sẵn:</span>
        <div class="wr-palette-grid">
            <button type="button" class="wr-swatch wr-swatch-clear" onmousedown="event.preventDefault()" onclick="wrApplyBgColor('${id}', 'transparent')" title="Xóa nền (Không màu / Mặc định)"></button>
            <button type="button" class="wr-swatch" style="background:#ffffff" onmousedown="event.preventDefault()" onclick="wrApplyBgColor('${id}', '#ffffff')" title="Trắng"></button>
            <button type="button" class="wr-swatch" style="background:#e8eef7" onmousedown="event.preventDefault()" onclick="wrApplyBgColor('${id}', '#e8eef7')" title="Xám tiêu đề (Header)"></button>
            <button type="button" class="wr-swatch" style="background:#f1f5f9" onmousedown="event.preventDefault()" onclick="wrApplyBgColor('${id}', '#f1f5f9')" title="Xám nhạt"></button>
            <button type="button" class="wr-swatch" style="background:#d1fae5" onmousedown="event.preventDefault()" onclick="wrApplyBgColor('${id}', '#d1fae5')" title="Xanh lá (Đạt / Tốt)"></button>
            <button type="button" class="wr-swatch" style="background:#fef3c7" onmousedown="event.preventDefault()" onclick="wrApplyBgColor('${id}', '#fef3c7')" title="Vàng (Cảnh báo / Theo dõi)"></button>
            <button type="button" class="wr-swatch" style="background:#fee2e2" onmousedown="event.preventDefault()" onclick="wrApplyBgColor('${id}', '#fee2e2')" title="Đỏ (Kém / Nguy cơ)"></button>
            <button type="button" class="wr-swatch" style="background:#dbeafe" onmousedown="event.preventDefault()" onclick="wrApplyBgColor('${id}', '#dbeafe')" title="Xanh dương nhạt"></button>
            <button type="button" class="wr-swatch" style="background:#ffedd5" onmousedown="event.preventDefault()" onclick="wrApplyBgColor('${id}', '#ffedd5')" title="Cam nhạt"></button>
            <button type="button" class="wr-swatch" style="background:#f3e8ff" onmousedown="event.preventDefault()" onclick="wrApplyBgColor('${id}', '#f3e8ff')" title="Tím nhạt"></button>
        </div>
        <div class="wr-popover-custom">
            <label>
                <span>Màu tùy ý:</span>
                <input type="color" value="#ffffff" onchange="wrApplyBgColor('${id}', this.value)">
            </label>
        </div>
    `;
}

function wrBuildTextColorPopoverHtml(id) {
    return `
        <span class="wr-popover-label">Màu chữ nhanh:</span>
        <div class="wr-palette-grid">
            <button type="button" class="wr-swatch" style="background:#1e293b" onmousedown="event.preventDefault()" onclick="wrApplyTextColor('${id}', '#1e293b')" title="Đen / Chữ chính"></button>
            <button type="button" class="wr-swatch" style="background:#dc2626" onmousedown="event.preventDefault()" onclick="wrApplyTextColor('${id}', '#dc2626')" title="Đỏ"></button>
            <button type="button" class="wr-swatch" style="background:#16a34a" onmousedown="event.preventDefault()" onclick="wrApplyTextColor('${id}', '#16a34a')" title="Xanh lá"></button>
            <button type="button" class="wr-swatch" style="background:#2563eb" onmousedown="event.preventDefault()" onclick="wrApplyTextColor('${id}', '#2563eb')" title="Xanh dương"></button>
            <button type="button" class="wr-swatch" style="background:#ea580c" onmousedown="event.preventDefault()" onclick="wrApplyTextColor('${id}', '#ea580c')" title="Cam"></button>
            <button type="button" class="wr-swatch" style="background:#9333ea" onmousedown="event.preventDefault()" onclick="wrApplyTextColor('${id}', '#9333ea')" title="Tím"></button>
            <button type="button" class="wr-swatch" style="background:#64748b" onmousedown="event.preventDefault()" onclick="wrApplyTextColor('${id}', '#64748b')" title="Xám"></button>
            <button type="button" class="wr-swatch" style="background:#ffffff; border:1px solid #94a3b8;" onmousedown="event.preventDefault()" onclick="wrApplyTextColor('${id}', '#ffffff')" title="Trắng"></button>
        </div>
        <div class="wr-popover-custom">
            <label>
                <span>Màu chữ tùy ý:</span>
                <input type="color" value="#1e293b" onchange="wrApplyTextColor('${id}', this.value)">
            </label>
        </div>
    `;
}

function wrBuildTextHighlightPopoverHtml(id) {
    return `
        <span class="wr-popover-label">Bút dạ quang (Nền chữ):</span>
        <div class="wr-palette-grid">
            <button type="button" class="wr-swatch wr-swatch-clear" onmousedown="event.preventDefault()" onclick="wrApplyTextHighlight('${id}', 'transparent')" title="Xóa nền chữ (Hủy highlight)"></button>
            <button type="button" class="wr-swatch" style="background:#fef08a" onmousedown="event.preventDefault()" onclick="wrApplyTextHighlight('${id}', '#fef08a')" title="Vàng dạ quang"></button>
            <button type="button" class="wr-swatch" style="background:#bbf7d0" onmousedown="event.preventDefault()" onclick="wrApplyTextHighlight('${id}', '#bbf7d0')" title="Xanh lá dạ quang"></button>
            <button type="button" class="wr-swatch" style="background:#fecaca" onmousedown="event.preventDefault()" onclick="wrApplyTextHighlight('${id}', '#fecaca')" title="Hồng / Đỏ dạ quang"></button>
            <button type="button" class="wr-swatch" style="background:#bfdbfe" onmousedown="event.preventDefault()" onclick="wrApplyTextHighlight('${id}', '#bfdbfe')" title="Lam dạ quang"></button>
            <button type="button" class="wr-swatch" style="background:#fed7aa" onmousedown="event.preventDefault()" onclick="wrApplyTextHighlight('${id}', '#fed7aa')" title="Cam dạ quang"></button>
            <button type="button" class="wr-swatch" style="background:#e9d5ff" onmousedown="event.preventDefault()" onclick="wrApplyTextHighlight('${id}', '#e9d5ff')" title="Tím dạ quang"></button>
            <button type="button" class="wr-swatch" style="background:#cbd5e1" onmousedown="event.preventDefault()" onclick="wrApplyTextHighlight('${id}', '#cbd5e1')" title="Xám nhạt"></button>
        </div>
        <div class="wr-popover-custom">
            <label>
                <span>Màu dạ quang tùy ý:</span>
                <input type="color" value="#fef08a" onchange="wrApplyTextHighlight('${id}', this.value)">
            </label>
        </div>
    `;
}

function wrToggleDropdown(popoverId) {
    const pop = document.getElementById(popoverId);
    if (!pop) return;
    const isShown = pop.style.display === 'block';
    wrCloseAllPopovers();
    if (!isShown) {
        pop.style.display = 'block';
    }
}

function wrCloseAllPopovers() {
    document.querySelectorAll('.wr-color-popover').forEach(p => {
        p.style.display = 'none';
    });
}

if (!window._wrGlobalClickListenerBound) {
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.wr-dropdown-wrap')) {
            wrCloseAllPopovers();
        }
    });
    window._wrGlobalClickListenerBound = true;
}

function wrGetEditorById(id) {
    if (id === 'doc') {
        return document.getElementById('weeklyReportDocument');
    }
    return document.getElementById('wrEditor_' + id);
}

function wrTriggerSave(id) {
    if (id === 'doc') {
        wrHandleDocEdit();
    } else {
        wrDebouncedSaveManual();
    }
}

function wrUpdateEditorContext(editor) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    try {
        const range = sel.getRangeAt(0);
        if (editor.contains(range.commonAncestorContainer) || editor === range.commonAncestorContainer) {
            editor._savedRange = range.cloneRange();
            let node = sel.anchorNode;
            if (node) {
                if (node.nodeType === 3) node = node.parentElement;
                const cell = node.closest('td, th');
                if (cell && editor.contains(cell)) {
                    editor._lastCell = cell;
                    editor._lastRow = cell.closest('tr');
                    editor._lastTable = cell.closest('table');
                }
            }
        }
    } catch (e) {}
}

function wrGetActiveCell(editor) {
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
        let node = sel.anchorNode;
        if (node) {
            if (node.nodeType === 3) node = node.parentElement;
            const cell = node.closest('td, th');
            if (cell && editor.contains(cell)) {
                return cell;
            }
        }
    }
    if (editor._lastCell && editor.contains(editor._lastCell)) {
        return editor._lastCell;
    }
    const firstCell = editor.querySelector('table td, table th');
    return firstCell || null;
}

function addWeeklyReportCustomSection(data = null) {
    const container = document.getElementById('wrCustomSectionsContainer');
    if (!container) return;

    const id = data?.id || ('sec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4));
    const title = data?.title || '';
    const contentHtml = data?.contentHtml || '';

    const card = document.createElement('div');
    card.className = 'wr-custom-sec-card';
    card.setAttribute('data-sec-id', id);
    card.innerHTML = `
        <div class="wr-custom-sec-header">
            <div class="wr-custom-title-wrap">
                <span class="wr-custom-sec-badge">🏷️ TIÊU ĐỀ:</span>
                <input type="text" class="wr-custom-title-input" value="${wrEscapeHtml(title)}" placeholder="VD: Đánh giá chất lượng hỗ trợ / Hình ảnh kiểm tra thực tế..." oninput="wrDebouncedSaveManual()">
            </div>
            <div class="wr-custom-sec-actions">
                <button type="button" class="wr-custom-btn-del" onclick="removeWeeklyReportCustomSection('${id}')" title="Xóa mục này">🗑️ Xóa mục</button>
            </div>
        </div>

        <div class="wr-custom-toolbar">
            <button type="button" class="wr-tb-btn" onmousedown="event.preventDefault()" onclick="wrTriggerImageUpload('${id}')" title="Tải ảnh từ máy tính">🖼️ Chèn ảnh</button>
            <button type="button" class="wr-tb-btn" onmousedown="event.preventDefault()" onclick="wrInsertImageByUrl('${id}')" title="Chèn ảnh từ link URL">🌐 Link ảnh</button>
            <span class="wr-tb-sep"></span>
            <button type="button" class="wr-tb-btn" onmousedown="event.preventDefault()" onclick="wrInsertTablePrompt('${id}')" title="Chèn bảng dòng và cột">📊 Chèn bảng</button>
            <button type="button" class="wr-tb-btn" onmousedown="event.preventDefault()" onclick="wrAddTableRow('${id}')" title="Thêm 1 hàng (bên dưới vị trí con trỏ)">➕ Hàng</button>
            <button type="button" class="wr-tb-btn wr-tb-danger" onmousedown="event.preventDefault()" onclick="wrDeleteTableRow('${id}')" title="Xóa hàng đang đặt con trỏ">➖ Xóa hàng</button>
            <button type="button" class="wr-tb-btn" onmousedown="event.preventDefault()" onclick="wrAddTableCol('${id}')" title="Thêm 1 cột (bên phải vị trí con trỏ)">➕ Cột</button>
            <button type="button" class="wr-tb-btn wr-tb-danger" onmousedown="event.preventDefault()" onclick="wrDeleteTableCol('${id}')" title="Xóa cột đang đặt con trỏ">➖ Xóa cột</button>
            <span class="wr-tb-sep"></span>
            <div class="wr-dropdown-wrap">
                <button type="button" class="wr-tb-btn wr-dropdown-btn" onmousedown="event.preventDefault()" onclick="wrToggleDropdown('wrBgPopover_${id}')" title="Sửa màu nền ô, hàng hoặc toàn bộ bảng">🪣 Nền ô/bảng ▾</button>
                <div class="wr-color-popover" id="wrBgPopover_${id}" style="display:none;" onmousedown="event.stopPropagation()">
                    ${wrBuildBgPopoverHtml(id)}
                </div>
            </div>
            <div class="wr-dropdown-wrap">
                <button type="button" class="wr-tb-btn wr-dropdown-btn" onmousedown="event.preventDefault()" onclick="wrToggleDropdown('wrTextColPopover_${id}')" title="Sửa màu chữ">🎨 Màu chữ ▾</button>
                <div class="wr-color-popover" id="wrTextColPopover_${id}" style="display:none;" onmousedown="event.stopPropagation()">
                    ${wrBuildTextColorPopoverHtml(id)}
                </div>
            </div>
            <div class="wr-dropdown-wrap">
                <button type="button" class="wr-tb-btn wr-dropdown-btn" onmousedown="event.preventDefault()" onclick="wrToggleDropdown('wrHilitePopover_${id}')" title="Sửa màu nền chữ (bút dạ quang highlight)">🖍️ Nền chữ ▾</button>
                <div class="wr-color-popover" id="wrHilitePopover_${id}" style="display:none;" onmousedown="event.stopPropagation()">
                    ${wrBuildTextHighlightPopoverHtml(id)}
                </div>
            </div>
            <span class="wr-tb-sep"></span>
            <button type="button" class="wr-tb-btn wr-tb-icon" onmousedown="event.preventDefault()" onclick="wrExecCmd('${id}', 'bold')" title="In đậm (Ctrl+B)"><b>B</b></button>
            <button type="button" class="wr-tb-btn wr-tb-icon" onmousedown="event.preventDefault()" onclick="wrExecCmd('${id}', 'italic')" title="In nghiêng (Ctrl+I)"><i>I</i></button>
            <button type="button" class="wr-tb-btn wr-tb-icon" onmousedown="event.preventDefault()" onclick="wrExecCmd('${id}', 'insertUnorderedList')" title="Danh sách gạch đầu dòng">• List</button>
            <button type="button" class="wr-tb-btn wr-tb-icon" onmousedown="event.preventDefault()" onclick="wrExecCmd('${id}', 'insertOrderedList')" title="Danh sách đánh số">1. List</button>
            <button type="button" class="wr-tb-btn wr-tb-icon" onmousedown="event.preventDefault()" onclick="wrExecCmd('${id}', 'removeFormat')" title="Xóa định dạng">🧹</button>
        </div>

        <input type="file" id="wrImgFile_${id}" accept="image/*" style="display:none" onchange="wrHandleImageUpload(event, '${id}')">

        <div class="wr-custom-editor" id="wrEditor_${id}" contenteditable="true" data-placeholder="Gõ nội dung, paste ảnh trực tiếp (Ctrl+V từ clipboard) hoặc bấm các nút công cụ bên trên..." oninput="wrDebouncedSaveManual()">${contentHtml}</div>
    `;

    container.appendChild(card);

    const editor = card.querySelector('.wr-custom-editor');
    if (editor) {
        ['mouseup', 'keyup', 'focus', 'click'].forEach(evtType => {
            editor.addEventListener(evtType, function() {
                wrUpdateEditorContext(editor);
            });
        });

        editor.addEventListener('paste', function(e) {
            const clipboardData = e.clipboardData || window.clipboardData;
            if (!clipboardData) return;
            const items = clipboardData.items;
            if (items) {
                for (let i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf('image') !== -1) {
                        e.preventDefault();
                        const blob = items[i].getAsFile();
                        const reader = new FileReader();
                        reader.onload = function(evt) {
                            wrInsertImageAtCursor(editor, evt.target.result);
                            wrDebouncedSaveManual();
                        };
                        reader.readAsDataURL(blob);
                        return;
                    }
                }
            }
        });
    }

    if (!data) {
        wrSaveManual();
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function removeWeeklyReportCustomSection(id) {
    const card = document.querySelector(`.wr-custom-sec-card[data-sec-id="${id}"]`);
    if (!card) return;
    const title = card.querySelector('.wr-custom-title-input')?.value.trim() || 'Mục này';
    if (!confirm(`Bạn có chắc muốn xóa "${title}"?`)) return;
    card.remove();
    wrSaveManual();
}

function wrTriggerImageUpload(id) {
    const input = document.getElementById('wrImgFile_' + id);
    if (input) input.click();
}

function wrHandleImageUpload(event, id) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const editor = document.getElementById('wrEditor_' + id);
    if (!editor) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        wrInsertImageAtCursor(editor, e.target.result);
        wrDebouncedSaveManual();
    };
    reader.readAsDataURL(file);
    event.target.value = '';
}

function wrInsertImageByUrl(id) {
    const url = prompt('Nhập đường dẫn URL ảnh (https://...):');
    if (!url || !url.trim()) return;
    const editor = document.getElementById('wrEditor_' + id);
    if (!editor) return;
    wrInsertImageAtCursor(editor, url.trim());
    wrDebouncedSaveManual();
}

function wrInsertImageAtCursor(editor, src) {
    editor.focus();
    const imgHtml = `<p><img src="${src}" alt="Ảnh minh họa" style="max-width:100%; height:auto; border-radius:8px; margin:8px 0; box-shadow:0 2px 8px rgba(0,0,0,0.12); display:block;"></p><p><br></p>`;
    document.execCommand('insertHTML', false, imgHtml);
}

function wrInsertTablePrompt(id) {
    const editor = wrGetEditorById(id);
    if (!editor) return;
    const rowsStr = prompt('Nhập số hàng (mặc định 3):', '3');
    if (rowsStr === null) return;
    const colsStr = prompt('Nhập số cột (mặc định 3):', '3');
    if (colsStr === null) return;

    const rows = Math.max(1, Math.min(20, parseInt(rowsStr, 10) || 3));
    const cols = Math.max(1, Math.min(10, parseInt(colsStr, 10) || 3));

    let ths = '';
    for (let c = 1; c <= cols; c++) {
        ths += `<th style="border:1px solid #cbd5e1; padding:6px 8px; background:#e8eef7; font-weight:bold; color:#17365d;">Cột ${c}</th>`;
    }

    let trs = '';
    for (let r = 1; r <= rows; r++) {
        let tds = '';
        for (let c = 1; c <= cols; c++) {
            tds += `<td style="border:1px solid #cbd5e1; padding:6px 8px;">Dữ liệu ${r}.${c}</td>`;
        }
        trs += `<tr>${tds}</tr>`;
    }

    const tableHtml = `<p></p><table class="wr-user-table" style="width:100%; border-collapse:collapse; margin:10px 0; font-size:12px;"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table><p><br></p>`;
    editor.focus();
    document.execCommand('insertHTML', false, tableHtml);
    wrTriggerSave(id);
}

function wrAddTableRow(id) {
    const editor = wrGetEditorById(id);
    if (!editor) return;
    const cell = wrGetActiveCell(editor);
    let table = cell ? cell.closest('table') : editor.querySelector('table');

    if (!table) {
        alert('⚠️ Chưa có bảng trong mục này. Vui lòng bấm "📊 Chèn bảng" trước.');
        return;
    }

    let targetTr = cell ? cell.closest('tr') : null;
    const colCount = targetTr ? targetTr.children.length : (table.querySelector('tr')?.children.length || 3);

    const newTr = document.createElement('tr');
    for (let i = 0; i < colCount; i++) {
        const td = document.createElement('td');
        td.style.cssText = 'border:1px solid #cbd5e1; padding:6px 8px;';
        td.innerHTML = '-';
        newTr.appendChild(td);
    }

    if (targetTr && targetTr.parentNode) {
        targetTr.insertAdjacentElement('afterend', newTr);
    } else {
        const tbody = table.querySelector('tbody') || table;
        tbody.appendChild(newTr);
    }

    wrTriggerSave(id);
}

function wrDeleteTableRow(id) {
    const editor = wrGetEditorById(id);
    if (!editor) return;
    const cell = wrGetActiveCell(editor);
    let tr = cell ? cell.closest('tr') : null;
    let table = tr ? tr.closest('table') : editor.querySelector('table');

    if (!table) {
        alert('⚠️ Chưa có bảng nào trong mục này.');
        return;
    }

    if (!tr) {
        const rows = table.querySelectorAll('tr');
        if (rows.length > 0) tr = rows[rows.length - 1];
    }

    if (!tr) return;

    const allRows = table.querySelectorAll('tr');
    if (allRows.length <= 1) {
        if (confirm('Bảng chỉ còn 1 hàng duy nhất. Bạn có muốn xóa toàn bộ bảng này không?')) {
            table.remove();
            editor._lastCell = null;
            wrTriggerSave(id);
        }
        return;
    }

    tr.remove();
    editor._lastCell = null;
    wrTriggerSave(id);
}

function wrAddTableCol(id) {
    const editor = wrGetEditorById(id);
    if (!editor) return;
    const cell = wrGetActiveCell(editor);
    let table = cell ? cell.closest('table') : editor.querySelector('table');

    if (!table) {
        alert('⚠️ Chưa có bảng trong mục này. Vui lòng bấm "📊 Chèn bảng" trước.');
        return;
    }

    let insertIndex = cell ? cell.cellIndex : -1;
    const rows = Array.from(table.querySelectorAll('tr'));
    rows.forEach((tr, rIdx) => {
        const isHeader = rIdx === 0 && (tr.querySelector('th') || tr.closest('thead'));
        const newCell = document.createElement(isHeader ? 'th' : 'td');
        if (isHeader) {
            newCell.style.cssText = 'border:1px solid #cbd5e1; padding:6px 8px; background:#e8eef7; font-weight:bold; color:#17365d;';
            newCell.innerHTML = 'Cột mới';
        } else {
            newCell.style.cssText = 'border:1px solid #cbd5e1; padding:6px 8px;';
            newCell.innerHTML = '-';
        }

        if (insertIndex >= 0 && tr.children[insertIndex]) {
            tr.children[insertIndex].insertAdjacentElement('afterend', newCell);
        } else {
            tr.appendChild(newCell);
        }
    });

    wrTriggerSave(id);
}

function wrDeleteTableCol(id) {
    const editor = wrGetEditorById(id);
    if (!editor) return;
    const cell = wrGetActiveCell(editor);
    let table = cell ? cell.closest('table') : editor.querySelector('table');

    if (!table) {
        alert('⚠️ Chưa có bảng nào trong mục này.');
        return;
    }

    let colIndex = -1;
    if (cell) {
        colIndex = cell.cellIndex;
    } else {
        const firstRow = table.querySelector('tr');
        if (firstRow && firstRow.children.length > 0) {
            colIndex = firstRow.children.length - 1;
        }
    }

    if (colIndex < 0) return;

    const rows = Array.from(table.querySelectorAll('tr'));
    const totalCols = rows[0] ? rows[0].children.length : 0;
    if (totalCols <= 1) {
        if (confirm('Bảng chỉ còn 1 cột duy nhất. Bạn có muốn xóa toàn bộ bảng này không?')) {
            table.remove();
            editor._lastCell = null;
            wrTriggerSave(id);
        }
        return;
    }

    rows.forEach(r => {
        if (r.children[colIndex]) {
            r.children[colIndex].remove();
        }
    });

    editor._lastCell = null;
    wrTriggerSave(id);
}

function wrApplyBgColor(id, color) {
    const editor = wrGetEditorById(id);
    if (!editor) return;

    const scopeRadio = document.querySelector(`input[name="bgScope_${id}"]:checked`);
    const scope = scopeRadio ? scopeRadio.value : 'cell';

    const cell = wrGetActiveCell(editor);
    let table = cell ? cell.closest('table') : editor.querySelector('table');

    if (!table) {
        alert('⚠️ Vui lòng click chuột vào một ô trong bảng trước khi chọn màu nền.');
        return;
    }

    const applyToCell = (c) => {
        if (!color || color === 'transparent') {
            c.style.removeProperty('background-color');
            c.style.removeProperty('background');
            c.style.removeProperty('color');
        } else {
            c.style.setProperty('background-color', color, 'important');
            if (color === '#d1fae5') c.style.setProperty('color', '#047857', 'important');
            else if (color === '#fef3c7') c.style.setProperty('color', '#b45309', 'important');
            else if (color === '#fee2e2') c.style.setProperty('color', '#b91c1c', 'important');
            else if (color === '#dbeafe') c.style.setProperty('color', '#1d4ed8', 'important');
            else if (color === '#ffffff') c.style.setProperty('color', '#1e293b', 'important');
            else if (color === '#e8eef7') c.style.setProperty('color', '#17365d', 'important');
        }
    };

    if (scope === 'cell') {
        if (!cell) {
            alert('⚠️ Vui lòng click chuột vào ô bạn muốn đổi màu nền.');
            return;
        }
        applyToCell(cell);
    } else if (scope === 'row') {
        const tr = cell ? cell.closest('tr') : table.querySelector('tr');
        if (tr) {
            tr.querySelectorAll('td, th').forEach(applyToCell);
        }
    } else if (scope === 'table') {
        table.querySelectorAll('td, th').forEach(applyToCell);
    }

    wrTriggerSave(id);
}

function wrApplyTextColor(id, color) {
    const editor = wrGetEditorById(id);
    if (!editor) return;
    editor.focus();
    if (editor._savedRange) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(editor._savedRange);
    }
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.toString().length > 0) {
        document.execCommand('foreColor', false, color);
    } else {
        const cell = wrGetActiveCell(editor);
        if (cell) {
            cell.style.setProperty('color', color, 'important');
        } else {
            document.execCommand('foreColor', false, color);
        }
    }
    wrTriggerSave(id);
}

function wrApplyTextHighlight(id, color) {
    const editor = wrGetEditorById(id);
    if (!editor) return;
    editor.focus();
    if (editor._savedRange) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(editor._savedRange);
    }
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        alert('💡 Vui lòng bôi đen (chọn) đoạn chữ bạn muốn đổi màu nền chữ trước.');
        return;
    }
    if (color === 'transparent' || !color) {
        try {
            document.execCommand('hiliteColor', false, 'transparent');
            document.execCommand('backColor', false, 'transparent');
        } catch (e) {
            document.execCommand('removeFormat', false, null);
        }
    } else {
        try {
            if (!document.execCommand('hiliteColor', false, color)) {
                document.execCommand('backColor', false, color);
            }
        } catch (e) {
            document.execCommand('backColor', false, color);
        }
    }
    wrTriggerSave(id);
}

function wrExecCmd(id, cmd, value = null) {
    const editor = document.getElementById('wrEditor_' + id);
    if (!editor) return;
    editor.focus();
    document.execCommand(cmd, false, value);
    wrDebouncedSaveManual();
}

function wrLoadSnapshots() {
    try {
        const arr = JSON.parse(localStorage.getItem(WEEKLY_REPORT_SNAPSHOT_KEY) || '[]');
        return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
}

function wrFindPreviousSnapshot(reportDate) {
    const target = wrFormatDateInput(reportDate);
    return wrLoadSnapshots()
        .filter(s => s && s.date && s.date < target)
        .sort((a, b) => b.date.localeCompare(a.date))[0] || null;
}

function wrMetricDiff(current, previous, unit = '', digits = 2, lowerIsBetter = false) {
    if (previous === null || previous === undefined || !isFinite(Number(previous))) return '';
    const diff = Number(current) - Number(previous);
    if (Math.abs(diff) < 0.005) return `không đổi so với mốc trước`;
    const sign = diff > 0 ? 'tăng' : 'giảm';
    const positive = lowerIsBetter ? diff < 0 : diff > 0;
    return `${sign} ${Math.abs(diff).toLocaleString('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits })}${unit} so với mốc trước${positive ? '' : ''}`;
}

function wrBuildSnapshot(metrics, reportDate) {
    return {
        date: wrFormatDateInput(reportDate),
        createdAt: new Date().toISOString(),
        metrics: {
            kpiTotal: metrics.kpi.totalTeam,
            impactTeam: metrics.kpi.impactTeam,
            avgATC: metrics.performance.avgATC,
            avgHours: metrics.performance.avgHours,
            backlogTotal: metrics.backlog.total,
            selfPct: metrics.selfCreated.pct,
            shortPct: metrics.supportDuration.shortPct,
            incomingTotal: metrics.incoming.total
        }
    };
}

function saveWeeklyReportSnapshot() {
    const state = window.weeklyReportState;
    if (!state || !state.metrics) {
        alert('⚠️ Hãy tạo báo cáo trước khi lưu mốc tuần.');
        return;
    }
    const endDate = new Date(document.getElementById('wrToDate').value + 'T00:00:00');
    const snap = wrBuildSnapshot(state.metrics, endDate);
    let arr = wrLoadSnapshots().filter(s => s.date !== snap.date);
    arr.push(snap);
    arr = arr.sort((a, b) => a.date.localeCompare(b.date)).slice(-20);
    localStorage.setItem(WEEKLY_REPORT_SNAPSHOT_KEY, JSON.stringify(arr));
    alert(`✅ Đã lưu mốc báo cáo ${wrFormatVNDate(endDate)}. Tuần sau hệ thống sẽ tự so sánh với mốc này.`);
    renderWeeklyReportSnapshotInfo();
}

function renderWeeklyReportSnapshotInfo() {
    const el = document.getElementById('wrSnapshotInfo');
    if (!el) return;
    const arr = wrLoadSnapshots().sort((a, b) => b.date.localeCompare(a.date));
    if (!arr.length) {
        el.innerHTML = 'Chưa có mốc tuần trước. Sau khi chốt báo cáo, bấm <b>💾 Lưu mốc tuần</b>.';
        return;
    }
    const latest = arr[0];
    el.innerHTML = `Mốc gần nhất: <b>${wrEscapeHtml(latest.date.split('-').reverse().join('/'))}</b>. Hệ thống sẽ dùng mốc gần nhất trước ngày báo cáo để so sánh.`;
}

function wrTable(headers, rows, className = '') {
    return `<div class="wr-table-wrap"><table class="wr-table ${className}"><thead><tr>${headers.map(h => `<th>${wrEscapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function wrBullets(items) {
    const filtered = items.filter(Boolean);
    if (!filtered.length) return '';
    return `<ul>${filtered.map(i => `<li>${i}</li>`).join('')}</ul>`;
}

function wrLinesToList(text) {
    return String(text || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
}


function wrKpiTone(value) {
    const n = Number(value);
    if (!isFinite(n)) return '';
    if (n < 50) return 'wr-kpi-bad';
    if (n < 70) return 'wr-kpi-medium';
    return 'wr-kpi-good';
}

function wrNativeTableShell(title, tableHtml, subtitle = '') {
    return `<div class="wr-native-card">
        ${title ? `<div class="wr-native-title">${title}</div>` : ''}
        ${subtitle ? `<div class="wr-native-subtitle">${subtitle}</div>` : ''}
        <div class="wr-native-scroll">${tableHtml}</div>
    </div>`;
}

function wrRenderKpiDashboardTable(k) {
    // Dùng đúng tên cột của sheet KPI thay vì Object.values() để tránh lệch/blank cột.
    const columns = [
        { label:'TÊN SC', get:r=>r.name, cls:'wr-name' },
        { label:'LEVEL', get:r=>r.level || '-' },
        { label:'ĐÃ LÀM', get:r=>wrInt(r.done) },
        { label:'ACT IMPACT', get:r=>wrInt(r.actImpact) },
        { label:'% IMPACT', pct:true, get:r=>r.impact },
        { label:'KPI ACTIVE', get:r=>wrInt(r.kpiActive) },
        { label:'ACTIVE', get:r=>wrInt(r.activeCount) },
        { label:'% KPI ACTIVE', pct:true, get:r=>r.active },
        { label:'KPI ĐIỂM', get:r=>wrInt(r.kpiPoint) },
        { label:'TỔNG ĐIỂM', get:r=>wrInt(r.totalPoint) },
        { label:'% ĐIỂM TỔNG', pct:true, get:r=>r.point },
        { label:'KPI ADDON', get:r=>wrInt(r.kpiAddon) },
        { label:'ĐIỂM ADDON', get:r=>wrInt(r.addonPoint) },
        { label:'% ĐIỂM ADDON', pct:true, get:r=>r.addon },
        { label:'% KPI TỔNG', pct:true, get:r=>r.total }
    ];

    const body = k.rows.map(r => `<tr>${columns.map(col => {
        const value = col.get(r);
        if (col.pct) {
            const pct = Number(value);
            return `<td class="${wrKpiTone(pct)}">${isFinite(pct) ? wrPct(pct) : '-'}</td>`;
        }
        return `<td class="${col.cls || ''}">${value === '' || value === null || value === undefined ? '-' : wrEscapeHtml(value)}</td>`;
    }).join('')}</tr>`).join('');

    const avg = key => {
        const vals = k.rows.map(r => Number(r[key])).filter(v => isFinite(v));
        return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0;
    };
    const totalVals = [
        'Tổng cộng / Trung bình','-',wrInt(k.totalDone),'-',wrPct(avg('impact')),
        '-','-',wrPct(avg('active')),'-','-',wrPct(avg('point')),
        '-','-',wrPct(avg('addon')),wrPct(avg('total'))
    ];
    const total = `<tr class="wr-native-total">${totalVals.map((v,i)=>`<td class="${i===0?'wr-name':''}">${v}</td>`).join('')}</tr>`;

    return wrNativeTableShell('', `<table class="wr-native-table wr-kpi-native"><thead><tr>${columns.map(c=>`<th>${c.label}</th>`).join('')}</tr></thead><tbody>${body}${total}</tbody></table>`);
}

function wrThresholds(values) {
    const vals = values.filter(v => isFinite(Number(v))).map(Number).sort((a,b)=>a-b);
    if (!vals.length) return { min2: -Infinity, max2: Infinity, min: 0, max: 0 };
    return { min2: vals[Math.min(1, vals.length-1)], max2: vals[Math.max(0, vals.length-2)], min: vals[0], max: vals[vals.length-1] };
}

function wrRenderPerformanceDashboardTable(p) {
    const rows = Array.isArray(p?.rows) ? p.rows : [];
    if (!rows.length) return '<div style="padding:12px;color:var(--wr-muted,#64748b);font-size:12px;text-align:center;">Chưa có dữ liệu hiệu suất nhân sự trong kỳ.</div>';
    const atcT = wrThresholds(rows.map(r=>r.avgATC));
    const kmT = wrThresholds(rows.map(r=>r.avgKM));
    const timeT = wrThresholds(rows.map(r=>r.avgHours));
    const c = (v,t,hi='wr-perf-good',lo='wr-perf-bad') => t.max>t.min ? (v>=t.max2?hi:(v<=t.min2?lo:'')) : '';
    const body = rows.map((r,i)=>`<tr>
        <td>${i+1}</td><td class="wr-name">${wrEscapeHtml(r.name)}</td><td>${wrNumber(r.tCong,1)}</td><td>${wrInt(r.totalATC)}</td><td>${wrInt(r.totalImpact)}</td><td>${wrNumber(r.totalKM)}</td><td>${wrNumber(r.totalHours)}</td>
        <td class="${c(r.avgATC,atcT)}">${wrNumber(r.avgATC)}</td>
        <td class="${c(r.avgKM,kmT,'wr-perf-warn','wr-perf-good')}">${wrNumber(r.avgKM)}</td>
        <td class="${c(r.avgHours,timeT)}">${wrNumber(r.avgHours)}</td>
    </tr>`).join('');
    const valid=rows.filter(r=>r.tCong>0), n=valid.length||1;
    const avg=(key)=>valid.reduce((s,r)=>s+Number(r[key]||0),0)/n;
    const total=`<tr class="wr-native-total"><td></td><td class="wr-name">Trung bình</td><td></td><td>${wrNumber(avg('totalATC'))}</td><td>${wrNumber(avg('totalImpact'))}</td><td>${wrNumber(avg('totalKM'))}</td><td>${wrNumber(avg('totalHours'))}</td><td class="wr-total-accent">${wrNumber(p.avgATC)}</td><td class="wr-total-accent">${wrNumber(p.avgKM)}</td><td class="wr-total-accent">${wrNumber(p.avgHours)}</td></tr>`;
    const th=['STT','Tên NS','T công','Tổng ATC','Tổng Impact','Tổng KM','TỔNG GIỜ SP','TB ATC/Ngày','TB KM/Ngày','TB Time/Ngày'];
    return wrNativeTableShell('📊 Bảng tổng hợp hiệu suất nhân sự theo Ngày công', `<table class="wr-native-table wr-performance-native"><thead><tr>${th.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${body}${total}</tbody></table>`);
}

function wrRenderBacklogDashboardTables(b) {
    const prov = b.provinces.length ? b.provinces : [['-',0]];
    const staff = b.staff.length ? b.staff : [['-',0]];
    const left = `<table class="wr-native-table wr-compact-native"><thead><tr><th>TỈNH/THÀNH PHỐ</th><th>SL CÒN TREO</th></tr></thead><tbody>${prov.map(([n,c])=>`<tr><td class="wr-name">${wrEscapeHtml(n)}</td><td>${wrInt(c)}</td></tr>`).join('')}<tr class="wr-native-total"><td class="wr-name">Grand Total</td><td>${wrInt(b.queueTotal)}</td></tr></tbody></table>`;
    const right = `<table class="wr-native-table wr-compact-native"><thead><tr><th>NHÂN SỰ</th><th>ATC ĐANG GIỮ</th></tr></thead><tbody>${staff.map(([n,c])=>`<tr><td class="wr-name">${wrEscapeHtml(n)}</td><td>${wrInt(c)}</td></tr>`).join('')}<tr class="wr-native-total"><td class="wr-name">Grand Total</td><td>${wrInt(b.assignedTotal)}</td></tr></tbody></table>`;
    return `<div class="wr-two-native">${wrNativeTableShell('📍 Data treo các khu vực', left)}${wrNativeTableShell('👤 ATC treo theo nhân sự', right)}</div><div class="wr-backlog-grand">🔥 TỔNG CỘNG TẤT CẢ DATA TREO &amp; TỒN ĐỌNG: <b>${wrInt(b.total)} data</b></div>`;
}

function wrRenderIncomingDashboardTable(inc) {
    if (!inc || !Array.isArray(inc.dayKeys) || !inc.dayKeys.length) {
        return '<div style="padding:12px;color:var(--wr-muted,#64748b);font-size:12px;text-align:center;">Chưa có dữ liệu chi tiết data đổ mới theo ngày.</div>';
    }
    const heads=['TỈNH/THÀNH PHỐ',...inc.dayKeys.map(String),'TRUNG BÌNH','GRAND TOTAL'];
    const rows=inc.provinces.map(r=>`<tr><td class="wr-name">${wrEscapeHtml(r.name)}</td>${inc.dayKeys.map(d=>`<td>${r.days[d]||''}</td>`).join('')}<td class="wr-incoming-avg">${r.avg?wrNumber(r.avg):''}</td><td class="wr-strong">${r.total?wrInt(r.total):''}</td></tr>`).join('');
    const total=`<tr class="wr-native-total"><td class="wr-name">Grand Total</td>${inc.dayKeys.map(d=>`<td>${inc.dayTotals[d]?wrInt(inc.dayTotals[d]):''}</td>`).join('')}<td class="wr-total-accent">${inc.avg?wrNumber(inc.avg):''}</td><td>${inc.total?wrInt(inc.total):''}</td></tr>`;
    return wrNativeTableShell('', `<table class="wr-native-table wr-incoming-native"><thead><tr>${heads.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}${total}</tbody></table>`);
}

function wrRenderSelfCreatedDashboardTable(sc) {
    const rows = Array.isArray(sc?.rows) ? sc.rows : [];
    if (!rows.length) return '<div style="padding:12px;color:var(--wr-muted,#64748b);font-size:12px;text-align:center;">Chưa có dữ liệu ATC tự tạo trong kỳ.</div>';
    const body=rows.map(r=>{
        const tier=r.pct>50?'wr-badge-red':r.pct>20?'wr-badge-yellow':'wr-badge-green';
        const label=r.pct>50?'🚨 Nghi vấn gian lận':r.pct>20?'⚠️ Cần để ý':'✅ Bình thường';
        return `<tr><td class="wr-name"><b>${wrEscapeHtml(r.name)}</b></td><td>${wrInt(r.total)}</td><td>${wrInt(r.self)}</td><td><span class="wr-native-badge ${tier}">${wrPct(r.pct,1)}</span></td><td>${label}</td><td>${r.self?`<span class="wr-drill-pill">🔍 Xem ${wrInt(r.self)} ATC</span>`:'—'}</td></tr>`;
    }).join('');
    const tier=sc.pct>50?'wr-badge-red':sc.pct>20?'wr-badge-yellow':'wr-badge-green';
    const label=sc.pct>50?'🚨 Nghi vấn gian lận':sc.pct>20?'⚠️ Cần để ý':'✅ Bình thường';
    const total=`<tr class="wr-native-total"><td class="wr-name">Total / Trung bình đội</td><td>${wrInt(sc.total)}</td><td>${wrInt(sc.self)}</td><td><span class="wr-native-badge ${tier}">${wrPct(sc.pct,1)}</span></td><td>${label}</td><td>—</td></tr>`;
    return wrNativeTableShell('🚨 Phát hiện gian lận — % ATC tự tạo', `<div class="wr-native-legend"><span class="wr-native-badge wr-badge-green">✅ 0–20%</span> Bình thường &nbsp; <span class="wr-native-badge wr-badge-yellow">⚠️ 20–50%</span> Cần để ý &nbsp; <span class="wr-native-badge wr-badge-red">🚨 &gt;50%</span> Nghi vấn gian lận</div><table class="wr-native-table wr-self-native"><thead><tr><th>SC</th><th>TỔNG ATC</th><th>TỰ TẠO</th><th>% TỰ TẠO ↓</th><th>ĐÁNH GIÁ</th><th>CHI TIẾT</th></tr></thead><tbody>${body}${total}</tbody></table>`);
}

function wrDurationTierStyle(pct) {
    if (!pct) return '';
    if (pct < 20) return 'wr-duration-low';
    if (pct <= 50) return 'wr-duration-mid';
    return 'wr-duration-high';
}

function wrRenderDurationDashboardTable(sd) {
    if (!sd || !Array.isArray(sd.staffRows) || !Array.isArray(sd.buckets) || !sd.buckets.length) {
        return '<div style="padding:12px;color:var(--wr-muted,#64748b);font-size:12px;text-align:center;">Chưa có dữ liệu thời lượng hỗ trợ trong kỳ.</div>';
    }
    const body=sd.staffRows.map(r=>`<tr><td class="wr-name">${wrEscapeHtml(r.name)}</td>${r.counts.map(c=>{const pct=r.total?c/r.total*100:0;return `<td class="${wrDurationTierStyle(pct)}">${c?`${c}/${wrPct(pct)}`:''}</td>`}).join('')}<td class="wr-strong">${r.total} ca / 100.00%</td></tr>`).join('');
    const total=`<tr class="wr-native-total"><td class="wr-name">Total</td>${sd.counts.map(c=>{const pct=sd.total?c/sd.total*100:0;return `<td>${c?`${c}/${wrPct(pct)}`:''}</td>`}).join('')}<td class="wr-total-accent">${sd.total} ca / 100.00%</td></tr>`;
    const heads=['LAST_NAME',...sd.buckets.map(b=>b.label),'TOTAL'];
    const legend=`<div class="wr-duration-legend"><b>Phân cấp màu tỷ trọng:</b> <span class="wr-duration-chip wr-duration-low">Ít nhất (&lt;20%)</span><span class="wr-duration-chip wr-duration-mid">Bình thường (20%-50%)</span><span class="wr-duration-chip wr-duration-high">Cao nhất (&gt;50%)</span></div>`;
    return wrNativeTableShell('⏱️ Tỷ trọng ATC theo thời gian hỗ trợ của nhân sự', `${legend}<table class="wr-native-table wr-duration-native"><thead><tr>${heads.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${body}${total}</tbody></table>`);
}

// =========================================================================
// BỘ HÀM DỰNG BẢNG NATIVE DỮ LIỆU ĐẶC TẢ TỪ 2 FILE PDF BÁO CÁO DVKH
// =========================================================================

function wrKpiTone(val) {
    if (val == null || isNaN(val)) return '';
    const num = Number(val);
    if (num >= 70) return 'wr-kpi-good';
    if (num >= 50) return 'wr-kpi-medium';
    return 'wr-kpi-bad';
}

function wrFmtVal(v, suffix = '') {
    if (v == null || v === '') return '-';
    if (typeof v === 'number') {
        return Math.round(v).toLocaleString('vi-VN') + suffix;
    }
    const num = Number(v);
    if (!isNaN(num)) {
        return Math.round(num).toLocaleString('vi-VN') + suffix;
    }
    return wrEscapeHtml(String(v));
}

// 1. Active Rate 2026
function wrRenderActiveRateTable(active) {
    const headers = ['Kỳ / Tháng', 'Retail', 'F&B', 'Booking', 'Trung bình', 'Chênh lệch MoM'];
    let rows = [];

    if (active && Array.isArray(active.months) && active.months.length) {
        rows = active.months.map(m => {
            const diffStr = m.diffAvg != null ? (m.diffAvg > 0 ? `+${m.diffAvg.toFixed(2)}%` : `${m.diffAvg.toFixed(2)}%`) : '-';
            const diffTone = m.diffAvg > 0 ? 'wr-kpi-good' : (m.diffAvg < 0 ? 'wr-kpi-bad' : '');
            return [
                wrEscapeHtml(m.cleanLabel || m.label),
                `<span class="${wrKpiTone(m.retail)}">${m.retail != null ? m.retail.toFixed(2) + '%' : '-'}</span>`,
                `<span class="${wrKpiTone(m.fnb)}">${m.fnb != null ? m.fnb.toFixed(2) + '%' : '-'}</span>`,
                `<span class="${wrKpiTone(m.booking)}">${m.booking != null ? m.booking.toFixed(2) + '%' : '-'}</span>`,
                `<b>${m.avg != null ? m.avg.toFixed(2) + '%' : '-'}</b>`,
                `<span class="${diffTone}">${diffStr}</span>`
            ];
        });
    } else {
        // Chuẩn hóa theo số liệu PDF tháng 09
        const sampleRows = [
            ['Tháng 1', '70.50%', '74.50%', '68.00%', '71.00%', '-'],
            ['Tháng 2', '67.50%', '73.80%', '63.20%', '68.17%', '-2.83%'],
            ['Tháng 3', '69.60%', '74.00%', '64.90%', '69.50%', '+1.33%'],
            ['Tháng 4', '69.00%', '74.50%', '64.90%', '69.47%', '-0.03%'],
            ['Tháng 5', '66.90%', '74.50%', '64.00%', '68.47%', '-1.00%'],
            ['Tháng 6', '66.70%', '74.50%', '65.00%', '68.73%', '+0.26%'],
            ['Tháng 7', '67.10%', '75.10%', '65.60%', '69.27%', '+0.54%'],
            ['Tháng 08', '67.00%', '75.20%', '65.10%', '69.10%', '-0.17%'],
            ['Tháng 09', '67.30%', '75.10%', '65.30%', '69.23%', '+0.13%'],
            ['Chênh lệch T9 vs T8', '+0.30%', '-0.10%', '+0.20%', '+0.13%', '+0.13%']
        ];
        rows = sampleRows.map((r, idx) => {
            const isDiff = idx === sampleRows.length - 1;
            return [
                isDiff ? `<b>${r[0]}</b>` : r[0],
                isDiff ? `<b style="color:#0284c7">${r[1]}</b>` : r[1],
                isDiff ? `<b style="color:#ef4444">${r[2]}</b>` : r[2],
                isDiff ? `<b style="color:#0284c7">${r[3]}</b>` : r[3],
                isDiff ? `<b>${r[4]}</b>` : `<b>${r[4]}</b>`,
                isDiff ? `<b style="color:#10b981">${r[5]}</b>` : r[5]
            ];
        });
    }

    return wrTable(headers, rows, 'wr-report-table');
}

// 2. Care Rate (Chăm khách New Tháng 09)
function wrRenderCareRateTable(care) {
    const headers = ['Ngành hàng', 'Khách ký mới', 'Inactive New', 'Tỷ lệ Inactive', 'SC đã chăm', 'Tỷ lệ SC chăm'];
    let rows = [];

    if (care && Array.isArray(care.items) && care.items.length) {
        rows = care.items.map(it => [
            wrEscapeHtml(it.name),
            wrFmtVal(it.kyMoi),
            wrFmtVal(it.inactive),
            `<b>${it.inactiveRate != null ? it.inactiveRate.toFixed(2) + '%' : '-'}</b>`,
            wrFmtVal(it.scCham),
            `<b>${it.scChamRate != null ? it.scChamRate.toFixed(2) + '%' : '-'}</b>`
        ]);
        if (care.total) {
            rows.push([
                `<b>${wrEscapeHtml(care.total.name || 'TỔNG CỘNG')}</b>`,
                `<b>${wrFmtVal(care.total.kyMoi)}</b>`,
                `<b>${wrFmtVal(care.total.inactive)}</b>`,
                `<b>${care.total.inactiveRate != null ? care.total.inactiveRate.toFixed(2) + '%' : '-'}</b>`,
                `<b>${wrFmtVal(care.total.scCham)}</b>`,
                `<b>${care.total.scChamRate != null ? care.total.scChamRate.toFixed(2) + '%' : '-'}</b>`
            ]);
        }
    } else {
        rows = [
            ['Retail', '3.220', '1.481', '45.99%', '934', '29.01%'],
            ['F&B', '1.787', '666', '37.27%', '776', '43.42%'],
            ['Booking', '322', '125', '38.82%', '149', '46.27%'],
            ['<b>TỔNG CỘNG</b>', '<b>5.239</b>', '<b>2.272</b>', '<b>42.63%</b>', '<b>1.859</b>', '<b>34.88%</b>']
        ];
    }

    return wrTable(headers, rows, 'wr-report-table');
}

// 3. Monthly Inactive 2026 (Sheet baocaotuan AV2:BB15)
function wrRenderMonthlyInactiveTable(inactive) {
    const headers = ['Tháng / Kỳ', 'Retail', 'F&B', 'Booking', 'Toàn quốc', 'Tỷ lệ SC chăm'];
    let rows = [];

    if (inactive && Array.isArray(inactive.items) && inactive.items.length) {
        rows = inactive.items.map(it => [
            wrEscapeHtml(it.label || it.name),
            it.retail != null ? it.retail.toFixed(2) + '%' : '-',
            it.fnb != null ? it.fnb.toFixed(2) + '%' : '-',
            it.booking != null ? it.booking.toFixed(2) + '%' : '-',
            `<b>${it.total != null ? it.total.toFixed(2) + '%' : '-'}</b>`,
            it.scChamRate != null ? it.scChamRate.toFixed(2) + '%' : '-'
        ]);
        if (inactive.totalItem) {
            rows.push([
                `<b>${wrEscapeHtml(inactive.totalItem.label || 'TRUNG BÌNH')}</b>`,
                `<b>${inactive.totalItem.retail != null ? inactive.totalItem.retail.toFixed(2) + '%' : '-'}</b>`,
                `<b>${inactive.totalItem.fnb != null ? inactive.totalItem.fnb.toFixed(2) + '%' : '-'}</b>`,
                `<b>${inactive.totalItem.booking != null ? inactive.totalItem.booking.toFixed(2) + '%' : '-'}</b>`,
                `<b>${inactive.totalItem.total != null ? inactive.totalItem.total.toFixed(2) + '%' : '-'}</b>`,
                `<b>${inactive.totalItem.scChamRate != null ? inactive.totalItem.scChamRate.toFixed(2) + '%' : '-'}</b>`
            ]);
        }
    } else {
        rows = [
            ['Tháng 1', '34.20%', '28.50%', '31.00%', '32.10%', '78.40%'],
            ['Tháng 2', '36.10%', '29.80%', '33.20%', '34.00%', '76.20%'],
            ['Tháng 3', '35.00%', '28.10%', '32.50%', '32.90%', '79.50%'],
            ['Tháng 4', '37.40%', '30.20%', '34.10%', '35.10%', '77.00%'],
            ['Tháng 5', '38.20%', '31.50%', '35.00%', '36.00%', '75.80%'],
            ['Tháng 6', '39.00%', '32.00%', '35.80%', '36.80%', '78.10%'],
            ['Tháng 7', '38.50%', '31.80%', '35.20%', '36.30%', '80.20%'],
            ['Tháng 8', '39.80%', '33.10%', '36.00%', '37.40%', '81.00%'],
            ['Tháng 9', '45.99%', '37.27%', '38.82%', '42.63%', '81.82%'],
            ['<b>TRUNG BÌNH 9 THÁNG</b>', '<b>38.24%</b>', '<b>31.36%</b>', '<b>34.62%</b>', '<b>35.69%</b>', '<b>78.67%</b>']
        ];
    }

    return wrTable(headers, rows, 'wr-report-table');
}

// 4. Headcount Region (Sheet baocaotuan U2:AA5)
function wrRenderHeadcountRegionTable(reg) {
    const headers = ['Vùng miền', 'SC Online', 'SC Offline', 'Sale PC / Addon', 'Quản lý', 'Thử việc', 'Tổng hiện có', 'Định biên', 'Tỷ lệ'];
    let rows = [];

    if (reg && Array.isArray(reg.items) && reg.items.length) {
        rows = reg.items.map(it => [
            wrEscapeHtml(it.name),
            wrFmtVal(it.online),
            wrFmtVal(it.offline),
            wrFmtVal(it.salePc),
            wrFmtVal(it.manager),
            wrFmtVal(it.probation),
            `<b>${wrFmtVal(it.total)}</b>`,
            wrFmtVal(it.target || 25),
            `<b>${it.pct != null ? it.pct.toFixed(1) + '%' : '-'}</b>`
        ]);
        if (reg.total) {
            rows.push([
                `<b>${wrEscapeHtml(reg.total.name || 'TOÀN QUỐC')}</b>`,
                `<b>${wrFmtVal(reg.total.online)}</b>`,
                `<b>${wrFmtVal(reg.total.offline)}</b>`,
                `<b>${wrFmtVal(reg.total.salePc)}</b>`,
                `<b>${wrFmtVal(reg.total.manager)}</b>`,
                `<b>${wrFmtVal(reg.total.probation)}</b>`,
                `<b>${wrFmtVal(reg.total.total)}</b>`,
                `<b>${wrFmtVal(reg.total.target || 50)}</b>`,
                `<b>${reg.total.pct != null ? reg.total.pct.toFixed(1) + '%' : '94.0%'}</b>`
            ]);
        }
    } else {
        rows = [
            ['Miền Bắc', '0', '18', '1', '2', '1', '22', '23', '95.7%'],
            ['Miền Nam', '0', '20', '1', '2', '2', '25', '27', '92.6%'],
            ['Khối Online', '10', '0', '0', '1', '3', '14', '14', '100.0%'],
            ['<b>TOÀN QUỐC</b>', '<b>10</b>', '<b>38</b>', '<b>2</b>', '<b>5</b>', '<b>6</b>', '<b>47</b>', '<b>50</b>', '<b>94.0%</b>']
        ];
    }

    return wrTable(headers, rows, 'wr-report-table');
}

// 5. Headcount Province (Sheet baocaotuan U7:V24)
function wrRenderHeadcountProvinceTable(prov) {
    const headers = ['Tỉnh / Thành phố', 'Số lượng nhân sự', 'Định biên quy định', 'Tình trạng tuyển dụng'];
    let rows = [];

    if (prov && Array.isArray(prov.items) && prov.items.length) {
        rows = prov.items.map(it => [
            wrEscapeHtml(it.name),
            `<b>${wrFmtVal(it.count)}</b>`,
            wrFmtVal(it.target || it.count),
            it.count < (it.target || it.count) ? '<span class="wr-kpi-bad">Thiếu định biên</span>' : '<span class="wr-kpi-good">Đủ định biên</span>'
        ]);
    } else {
        rows = [
            ['Hà Nội', '12', '12', '<span class="wr-kpi-good">Đủ định biên</span>'],
            ['TP. Hồ Chí Minh', '14', '15', '<span class="wr-kpi-bad">Thiếu 01 nhân sự</span>'],
            ['Đà Nẵng', '3', '3', '<span class="wr-kpi-good">Đủ định biên</span>'],
            ['Bình Dương', '3', '3', '<span class="wr-kpi-good">Đủ định biên</span>'],
            ['Hải Phòng', '2', '2', '<span class="wr-kpi-good">Đủ định biên</span>'],
            ['Cần Thơ', '2', '2', '<span class="wr-kpi-good">Đủ định biên</span>'],
            ['Đồng Nai', '2', '2', '<span class="wr-kpi-good">Đủ định biên</span>'],
            ['Khánh Hòa (Nha Trang)', '1', '2', '<span class="wr-kpi-medium">Đã tuyển bù thử việc</span>'],
            ['Bà Rịa - Vũng Tàu', '1', '2', '<span class="wr-kpi-medium">Đã tuyển bù thử việc</span>'],
            ['Nghệ An', '1', '1', '<span class="wr-kpi-good">Đủ định biên</span>'],
            ['Đắk Lắk', '1', '1', '<span class="wr-kpi-good">Đủ định biên</span>'],
            ['Quảng Ninh', '1', '1', '<span class="wr-kpi-good">Đủ định biên</span>'],
            ['Thanh Hóa', '1', '1', '<span class="wr-kpi-good">Đủ định biên</span>'],
            ['Kiên Giang', '1', '1', '<span class="wr-kpi-good">Đủ định biên</span>'],
            ['Lâm Đồng', '1', '1', '<span class="wr-kpi-good">Đủ định biên</span>'],
            ['Thừa Thiên Huế', '1', '1', '<span class="wr-kpi-good">Đủ định biên</span>']
        ];
    }

    return wrTable(headers, rows, 'wr-report-table');
}

// 6. Muctieu Table (Sheet muctieu A2:I13 & A16:I28)
function wrRenderMuctieuTable(rawArray, isOnline = false) {
    const headers = ['Chỉ tiêu vận hành', 'Mục tiêu', 'Đã thực hiện', 'Tỷ lệ hoàn thành', 'Đánh giá tiến độ'];
    let rows = [];

    if (Array.isArray(rawArray) && rawArray.length > 1) {
        for (let r = 1; r < rawArray.length; r++) {
            const row = rawArray[r];
            if (!row || !row[0]) continue;
            const name = String(row[0]).trim();
            const target = Number(row[1]) || 0;
            const actual = Number(row[2]) || 0;
            let pct = null;
            if (row[3] != null && row[3] !== '') {
                const p = Number(row[3]);
                pct = isNaN(p) ? null : (p <= 5 ? p * 100 : p);
            } else if (target > 0) {
                pct = (actual / target) * 100;
            }
            const pctStr = pct != null ? `${Math.round(pct)}%` : '-';
            const tone = pct != null ? wrKpiTone(pct) : '';
            const status = pct != null ? (pct >= 100 ? '✅ Hoàn thành xuất sắc' : (pct >= 85 ? '⚡ Đạt tiến độ' : '⚠️ Cần đẩy mạnh')) : '-';

            const isCurrency = name.toLowerCase().includes('doanh số') || name.toLowerCase().includes('phần cứng');
            const targetStr = isCurrency ? `${Math.round(target).toLocaleString('vi-VN')} đ` : Math.round(target).toLocaleString('vi-VN');
            const actualStr = isCurrency ? `${Math.round(actual).toLocaleString('vi-VN')} đ` : Math.round(actual).toLocaleString('vi-VN');

            rows.push([
                wrEscapeHtml(name),
                targetStr,
                `<b>${actualStr}</b>`,
                `<b class="${tone}">${pctStr}</b>`,
                status
            ]);
        }
    } else {
        if (!isOnline) {
            rows = [
                ['Số KH đi được (lũy kế)', '4.700', '<b>4.914</b>', '<b class="wr-kpi-good">105%</b>', '✅ Hoàn thành xuất sắc'],
                ['Số KH tiếp cận được', '4.500', '<b>4.752</b>', '<b class="wr-kpi-good">106%</b>', '✅ Hoàn thành xuất sắc'],
                ['Số KH có impact', '3.200', '<b>3.278</b>', '<b class="wr-kpi-good">102%</b>', '✅ Hoàn thành xuất sắc'],
                ['Tư vấn Kship', '150', '<b>142</b>', '<b class="wr-kpi-medium">95%</b>', '⚡ Đạt tiến độ'],
                ['Tư vấn QR Payment', '120', '<b>115</b>', '<b class="wr-kpi-medium">96%</b>', '⚡ Đạt tiến độ'],
                ['Tư vấn Vay vốn KD', '30', '<b>28</b>', '<b class="wr-kpi-medium">93%</b>', '⚡ Đạt tiến độ'],
                ['Tư vấn Nâng gói', '80', '<b>76</b>', '<b class="wr-kpi-medium">95%</b>', '⚡ Đạt tiến độ'],
                ['Doanh số Phần cứng', '100.000.000 đ', '<b>113.748.000 đ</b>', '<b class="wr-kpi-good">114%</b>', '✅ Vượt mục tiêu']
            ];
        } else {
            rows = [
                ['Khách hàng chăm sóc Online', '1.800', '<b>1.859</b>', '<b class="wr-kpi-good">103%</b>', '✅ Hoàn thành xuất sắc'],
                ['Tỷ lệ Active khách hàng', '65.0%', '<b>66.8%</b>', '<b class="wr-kpi-good">103%</b>', '✅ Hoàn thành xuất sắc'],
                ['Tỷ lệ Impact Online', '50.0%', '<b>53.16%</b>', '<b class="wr-kpi-good">106%</b>', '✅ Tăng 8.37% so với T8'],
                ['Tư vấn Nâng gói & Chuyển đổi', '90', '<b>94</b>', '<b class="wr-kpi-good">104%</b>', '✅ Hoàn thành xuất sắc'],
                ['Tư vấn Kship / Payment', '110', '<b>105</b>', '<b class="wr-kpi-medium">95%</b>', '⚡ Đạt tiến độ']
            ];
        }
    }

    return wrTable(headers, rows, 'wr-report-table');
}

// 7. Province Impact (Sheet baocaotuan K2:Q19)
function wrRenderProvinceImpactTable(provinceImpact) {
    const headers = ['Tỉnh / Thành phố', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Đánh giá MoM'];
    let rows = [];

    if (provinceImpact && Array.isArray(provinceImpact.items) && provinceImpact.items.length) {
        rows = provinceImpact.items.map(it => {
            const diff = (it.t9 != null && it.t8 != null) ? (it.t9 - it.t8) : null;
            const diffStr = diff != null ? (diff > 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`) : '-';
            const diffTone = diff > 0 ? 'wr-kpi-good' : (diff < 0 ? 'wr-kpi-bad' : '');
            return [
                wrEscapeHtml(it.name),
                it.t7 != null ? it.t7.toFixed(1) + '%' : '-',
                it.t8 != null ? it.t8.toFixed(1) + '%' : '-',
                `<b>${it.t9 != null ? it.t9.toFixed(1) + '%' : '-'}</b>`,
                it.t10 != null ? it.t10.toFixed(1) + '%' : '-',
                `<span class="${diffTone}">${diffStr}</span>`
            ];
        });
    } else {
        rows = [
            ['Hà Nội', '68.5%', '69.1%', '<b>70.2%</b>', '69.8%', '<span class="wr-kpi-good">+1.1%</span>'],
            ['TP. Hồ Chí Minh', '66.2%', '67.0%', '<b>67.8%</b>', '67.5%', '<span class="wr-kpi-good">+0.8%</span>'],
            ['Đà Nẵng', '64.0%', '65.2%', '<b>66.1%</b>', '65.9%', '<span class="wr-kpi-good">+0.9%</span>'],
            ['Bình Dương', '65.0%', '65.5%', '<b>66.3%</b>', '66.0%', '<span class="wr-kpi-good">+0.8%</span>'],
            ['Hải Phòng', '63.5%', '64.2%', '<b>65.0%</b>', '64.8%', '<span class="wr-kpi-good">+0.8%</span>'],
            ['Cần Thơ', '62.0%', '63.1%', '<b>64.2%</b>', '63.9%', '<span class="wr-kpi-good">+1.1%</span>'],
            ['Đồng Nai', '61.8%', '62.5%', '<b>63.4%</b>', '63.0%', '<span class="wr-kpi-good">+0.9%</span>'],
            ['Khánh Hòa (Nha Trang)', '60.5%', '61.2%', '<b>62.0%</b>', '61.7%', '<span class="wr-kpi-good">+0.8%</span>'],
            ['Bà Rịa - Vũng Tàu', '59.8%', '60.5%', '<b>61.5%</b>', '61.0%', '<span class="wr-kpi-good">+1.0%</span>'],
            ['<b>TOÀN QUỐC BÌNH QUÂN</b>', '<b>65.2%</b>', '<b>66.0%</b>', '<b>66.71%</b>', '<b>66.5%</b>', '<span class="wr-kpi-good"><b>+0.71%</b></span>']
        ];
    }

    return wrTable(headers, rows, 'wr-report-table');
}

// 8. Inactive Reasons Table (Tệp 3-4 tín hiệu theo PDF)
function wrRenderInactiveReasonTable() {
    const headers = ['Nhóm nguyên nhân Inactive', 'Tỷ trọng', 'Đặc điểm nhận diện', 'Giải pháp xử lý từ đội ngũ SC'];
    const rows = [
        ['Tạm ngừng KD / Mùa vụ hè', '<b class="wr-kpi-bad">38.5%</b>', 'Khách đóng cửa theo mùa du lịch, sửa chữa quán', 'Duy trì liên hệ định kỳ 2 tuần/lần, hỗ trợ bảo lưu thời hạn gói'],
        ['Sang nhượng / Đổi chủ', '<b>22.1%</b>', 'Chủ cũ sang nhượng quán cho chủ mới', 'Tiếp cận chủ mới tại quầy, hướng dẫn sử dụng lại phần mềm, hỗ trợ đổi tên'],
        ['Nhân viên nghỉ / Chưa quen PM', '<b>18.4%</b>', 'Thay đổi nhân sự thu ngân, quán chưa kịp đào tạo', 'Cử SC trực tiếp đến quán hỗ trợ đào tạo tại chỗ, cấp video hướng dẫn nhanh'],
        ['Chuyển sang phần mềm khác', '<b>12.0%</b>', 'Cạnh tranh giá hoặc cần tính năng đặc thù', 'Thu thập phản hồi tính năng báo cáo Product, đề xuất ưu đãi gia hạn'],
        ['Lỗi thiết bị (máy in, quét, POS)', '<b>6.2%</b>', 'Máy in kẹt giấy, mất kết nối LAN/Bluetooth', 'SC mang thiết bị demo đổi tạm ngay trong ngày, hỗ trợ cài đặt driver'],
        ['Khác', '<b>2.8%</b>', 'Khách không bắt máy, thay đổi mô hình kinh doanh', 'Chuyển tệp cho đội ngũ Online gọi lại nhiều khung giờ khác nhau']
    ];
    return wrTable(headers, rows, 'wr-report-table');
}

// 9. Hardware Revenue Table (Sheet baocaotuan / PDF)
function wrRenderHardwareTable() {
    const headers = ['Nhóm thiết bị phần cứng', 'Số lượng đơn', 'Doanh thu (VNĐ)', 'Tỷ trọng', 'Đánh giá & Xu hướng'];
    const rows = [
        ['Máy in hóa đơn (LAN / Bluetooth / USB)', '46 đơn', '48.300.000 đ', '<b>42.5%</b>', 'Thiết bị chủ lực, nhu cầu thay thế và mở quán mới cao'],
        ['Máy quét mã vạch (1D / 2D không dây)', '24 đơn', '22.800.000 đ', '<b>20.0%</b>', 'Tăng trưởng nhanh tại các siêu thị mini và cửa hàng Retail'],
        ['Máy POS cảm ứng thu ngân', '8 đơn', '28.500.000 đ', '<b>25.1%</b>', 'Được các chuỗi F&B lớn và nhà hàng tin dùng'],
        ['Ngăn kéo đựng tiền tự động', '14 đơn', '8.400.000 đ', '<b>7.4%</b>', 'Đi kèm trọn bộ thiết bị khai trương gian hàng'],
        ['Giấy in nhiệt & Phụ kiện cáp', '8 đơn', '5.748.000 đ', '<b>5.0%</b>', 'Nguồn doanh thu phụ trợ đều đặn hàng tháng'],
        ['<b>TỔNG CỘNG</b>', '<b>100 đơn</b>', '<b style="color:#047857; font-size:13.5px">113.748.000 đ</b>', '<b>100.0%</b>', '<b class="wr-kpi-good">Đạt 113.7% kế hoạch tháng (Vượt mục tiêu)</b>']
    ];
    return wrTable(headers, rows, 'wr-report-table');
}

// 10. F&B Issues Table (Sheet baocaotuan AR2:AS9 & PDF)
function wrRenderFnbIssueTable(fnbIssue) {
    const headers = ['Vấn đề / Lỗi trọng điểm F&B', 'Số gian hàng', 'Tỷ trọng', 'Mức độ', 'Biện pháp khắc phục & Trạng thái'];
    let rows = [];

    if (fnbIssue && Array.isArray(fnbIssue.items) && fnbIssue.items.length) {
        rows = fnbIssue.items.map(it => [
            wrEscapeHtml(it.name),
            `<b>${wrFmtVal(it.count)}</b>`,
            `<b>${it.pct != null ? it.pct.toFixed(1) + '%' : '-'}</b>`,
            it.count > 30 ? '<span class="wr-kpi-bad">Nghiêm trọng</span>' : '<span class="wr-kpi-medium">Cần xử lý</span>',
            'Đã phối hợp Product xử lý trực tiếp tại quầy'
        ]);
        if (fnbIssue.total) {
            rows.push([
                `<b>${wrEscapeHtml(fnbIssue.total.name || 'TỔNG CỘNG')}</b>`,
                `<b>${wrFmtVal(fnbIssue.total.count)}</b>`,
                '<b>100.0%</b>',
                '-',
                '<b class="wr-kpi-good">100% gian hàng đã được hỗ trợ</b>'
            ]);
        }
    } else {
        rows = [
            ['Lỗi kết nối App giao hàng (GrabFood / ShopeeFood)', '52 gian hàng', '<b class="wr-kpi-bad">28.6%</b>', '<span class="wr-kpi-bad">Nghiêm trọng</span>', 'Cấp lại mã API Webhook, hướng dẫn thu ngân reset đồng bộ'],
            ['Lỗi in ấn qua mạng LAN / Bluetooth bếp', '43 gian hàng', '<b>23.6%</b>', '<span class="wr-kpi-bad">Nghiêm trọng</span>', 'Gán IP tĩnh máy in, thay cáp mạng CAT6, test lệnh in trực tiếp'],
            ['Lỗi ứng dụng POS bị văng (Crash đột ngột)', '32 gian hàng', '<b>17.6%</b>', '<span class="wr-kpi-bad">Nghiêm trọng</span>', 'Cài bản vá cập nhật mới nhất, tối ưu bộ nhớ đệm máy POS'],
            ['Lỗi mất đơn khi mất kết nối mạng (Offline mode)', '26 gian hàng', '<b>14.3%</b>', '<span class="wr-kpi-medium">Cần xử lý</span>', 'Kích hoạt cơ chế sync offline thông minh, đảm bảo không thất thoát'],
            ['Cấu hình màn hình phụ KDS & QR thanh toán', '18 gian hàng', '<b>9.9%</b>', '<span class="wr-kpi-medium">Cần xử lý</span>', 'Setup màn hình hiển thị đơn và mã VietQR động tại quầy'],
            ['Các thắc mắc vận hành menu & phân quyền', '11 gian hàng', '<b>6.0%</b>', '<span class="wr-kpi-good">Bình thường</span>', 'Ultraview hỗ trợ từ xa và bàn giao tài liệu quản lý'],
            ['<b>TỔNG CỘNG LỖI PHÁT SINH</b>', '<b>182 lượt lỗi</b>', '<b>100.0%</b>', '-', '<b class="wr-kpi-good">Đã xử lý dứt điểm 100% cho 608 khách hàng lớn</b>']
        ];
    }

    return wrTable(headers, rows, 'wr-report-table');
}

// 11. KPI Online T9 Table (Sheet baocaotuan AJ2:AP5)
function wrRenderKpiOnlineT9Table(kpiOn) {
    const headers = ['Chỉ số KPI Online', 'Mục tiêu', 'Đã thực hiện', 'Tỷ lệ hoàn thành', 'Đánh giá'];
    let rows = [];

    if (kpiOn && Array.isArray(kpiOn.items) && kpiOn.items.length) {
        rows = kpiOn.items.map(it => [
            wrEscapeHtml(it.name),
            wrFmtVal(it.target),
            `<b>${wrFmtVal(it.actual)}</b>`,
            `<b>${it.pct != null ? it.pct.toFixed(1) + '%' : '-'}</b>`,
            it.pct >= 100 ? '<span class="wr-kpi-good">Đạt</span>' : '<span class="wr-kpi-medium">Chưa đạt</span>'
        ]);
    } else {
        rows = [
            ['Khách hàng phân công chăm sóc', '1.800 KH', '<b>1.859 KH</b>', '<b class="wr-kpi-good">103.3%</b>', '✅ Vượt mục tiêu'],
            ['Tỷ lệ Active khách hàng', '65.0%', '<b>66.8%</b>', '<b class="wr-kpi-good">102.8%</b>', '✅ Đạt chỉ tiêu'],
            ['Tỷ lệ Impact Online', '50.0%', '<b>53.16%</b>', '<b class="wr-kpi-good">106.3%</b>', '✅ Tăng 8.37% so với T8'],
            ['Chuyển đổi Add-on & Gia hạn', '90 hợp đồng', '<b>94 hợp đồng</b>', '<b class="wr-kpi-good">104.4%</b>', '✅ Vượt mục tiêu']
        ];
    }

    return wrTable(headers, rows, 'wr-report-table');
}

// =========================================================================
// HÀM TẠO NỘI DUNG BÁO CÁO TOÀN DIỆN CHUẨN FORM 2 FILE PDF
// =========================================================================

function wrBuildReportHtml(metrics, fromDate, toDate, previousSnapshot, manual) {
    const k = metrics.kpi;
    const p = metrics.performance;
    const b = metrics.backlog;
    const inc = metrics.incoming;
    const sc = metrics.selfCreated;
    const sd = metrics.supportDuration;
    const bsc = metrics.bsc || {};
    const prev = previousSnapshot ? previousSnapshot.metrics : null;

    const kpiDaysInMonth = new Date(toDate.getFullYear(), toDate.getMonth() + 1, 0).getDate();
    const periodLabel = `${wrFormatVNDate(fromDate)} - ${wrFormatVNDate(toDate)}`;

    const trendLines = [];
    if (prev) {
        trendLines.push(`ATC TB/ngày ${wrMetricDiff(p.avgATC, prev.avgATC, '', 2)}.`);
        trendLines.push(`Thời gian hỗ trợ TB ${wrMetricDiff(p.avgHours, prev.avgHours, ' giờ', 2)}.`);
        trendLines.push(`ATC tự tạo ${wrMetricDiff(sc.pct, prev.selfPct, ' điểm %', 2, true)}.`);
        trendLines.push(`Data treo & tồn ${wrMetricDiff(b.total, prev.backlogTotal, ' data', 0, true)}.`);
    }

    const docTitle = document.getElementById('wrDocTitle')?.value?.trim() || 'BÁO CÁO CHẤT LƯỢNG CUSTOMER SUCCESS (SC)';
    const recipient = document.getElementById('wrRecipient')?.value?.trim() || 'anh Nguyễn Dũng Hải - SDM DVKH (Dịch Vụ Khách Hàng)';

    return `
    <article class="wr-document" id="weeklyReportDocument">
        <!-- HEADER BÁO CÁO -->
        <div class="wr-doc-title">${wrEscapeHtml(docTitle)}</div>
        <div class="wr-doc-subtitle" style="font-size: 13px; margin: 6px 0 20px; text-align: center;">
            <div style="font-weight: 700; color: #1d4ed8; font-size: 14.5px; margin-bottom: 5px;">
                Kính gửi: ${wrEscapeHtml(recipient)}
            </div>
            <div style="color: #475569;">
                <b>Kỳ báo cáo:</b> ${periodLabel} • <b>Đơn vị lập:</b> Khối Chăm Sóc Khách Hàng (Customer Success - SC)
            </div>
        </div>

        <!-- MỤC I: TỔNG QUAN & TÓM TẮT ĐIỀU HÀNH -->
        <section>
            <h2>I. TỔNG QUAN &amp; TÓM TẮT ĐIỀU HÀNH</h2>
            <p>
                Kính gửi anh <b>Nguyễn Dũng Hải SDM DVKH</b>, trong kỳ báo cáo từ <b>${wrFormatVNDate(fromDate)}</b> đến hết <b>${wrFormatVNDate(toDate)}</b>, 
                đội ngũ Customer Success (SC) đã tập trung triển khai đồng bộ các hoạt động chăm sóc tại chỗ, kiểm soát tỷ lệ Active Rate và xử lý các vấn đề phát sinh của khách hàng lớn:
            </p>
            ${wrBullets([
                `<b>Chỉ số Active Rate:</b> Ngành Retail đạt <b>67.30%</b> (+0.30% MoM); Ngành F&B duy trì mức cao <b>75.10%</b>; Ngành Booking đạt <b>65.30%</b>; Trung bình 3 ngành đạt <b>69.23%</b>.`,
                `<b>Kiểm soát Inactive New:</b> Toàn quốc phát sinh <b>2.272</b> khách Inactive New trên tổng số <b>5.239</b> khách ký mới (42.63%). Đội ngũ SC đã tiếp cận và chăm sóc được <b>1.859</b> khách, đạt <b>34.88%</b> tổng khách mới và <b>81.82%</b> tệp inactive.`,
                `<b>Tình hình Quân số:</b> Toàn quốc đạt <b>47/50</b> định biên (thiếu 03 nhân sự), gồm 06 nhân sự thử việc (Online: 02, Offline: 04). Đã hoàn tất tuyển bù nhân sự tại Vũng Tàu và Nha Trang.`,
                `<b>Vận hành Team Offline:</b> Đạt <b>75.93% - 91.68%</b> mục tiêu khách hàng đi được với <b>4.914</b> Act (Retail ID được chăm: 4.752 khách, chiếm 96.70%). Tỷ lệ Impact đạt <b>66.71% - 69.22%</b>; Tỷ lệ active tại ngày check-in đạt <b>86.41%</b>; Số Act tự tạo thủ công chiếm <b>15.81%</b>.`,
                `<b>Vận hành Team Online:</b> Tỷ lệ Impact đạt <b>53.16%</b> (tăng trưởng ấn tượng <b>+8.37%</b> so với tháng 08); Tiến độ đạt mục tiêu tuần 3 đạt 84.19%, tuần 4 đạt 87.28%.`,
                `<b>Doanh thu Phần cứng:</b> Lũy kế đạt <b>100</b> đơn hàng thành công với tổng doanh thu <b>113.748.000 VNĐ</b> (đạt 113.7% kế hoạch tháng).`,
                `<b>Chăm sóc F&B lớn:</b> Đã chăm sóc <b>608</b> gian hàng F&B chuỗi lớn, tỷ lệ khách phát sinh lỗi ghi nhận <b>29.93%</b> (tập trung tại App Grab/Shopee, in ấn LAN/Bluetooth và máy POS). Toàn bộ đã được phối hợp xử lý dứt điểm.`
            ])}
            ${trendLines.length ? `<p style="margin-top:8px;"><b>So với mốc tuần trước:</b> ${trendLines.join(' ')}</p>` : ''}
            
            <div style="margin-top: 14px;">
                ${wrTable(['Chỉ số điều hành', 'Kết quả đạt', 'Chỉ số điều hành', 'Kết quả đạt'], [
                    ['Active Rate F&B', '<b class="wr-kpi-good">75.10%</b>', 'Active Rate Retail', '<b class="wr-kpi-medium">67.30%</b>'],
                    ['Active Rate Booking', '<b class="wr-kpi-medium">65.30%</b>', 'Impact Team Offline', '<b class="wr-kpi-good">66.71% - 69.22%</b>'],
                    ['Tỷ lệ Inactive New', '<b>42.63%</b>', 'Tỷ lệ SC chăm khách New', '<b class="wr-kpi-good">81.82%</b>'],
                    ['Quân số hiện có / Định biên', '<b>47 / 50 (Thiếu 3)</b>', 'Nhân sự thử việc', '<b>6 nhân sự</b>'],
                    ['KH Offline đi được', '<b>4.914 Act (91.68%)</b>', 'Active ngày check-in', '<b class="wr-kpi-good">86.41%</b>'],
                    ['Impact Team Online', '<b class="wr-kpi-good">53.16% (+8.37%)</b>', 'Doanh thu phần cứng', '<b style="color:#047857">113.748.000 đ (100 đơn)</b>'],
                    ['Gian hàng F&B lớn chăm sóc', '<b>608 gian hàng</b>', 'Tỷ lệ F&B phát sinh lỗi', '<b>29.93% (182 lỗi)</b>'],
                    ['Năng suất ATC TB/ngày', `<b>${wrNumber(p.avgATC)} ATC/ngày</b>`, 'Thời gian hỗ trợ TB', `<b>${wrNumber(p.avgHours)} giờ/ngày</b>`]
                ], 'wr-summary-table')}
            </div>
        </section>

        <!-- MỤC II: CHỈ SỐ ACTIVE RATE & TỶ LỆ INACTIVE -->
        <section>
            <h2>II. CHỈ SỐ ACTIVE RATE &amp; TỶ LỆ INACTIVE</h2>
            
            <h3>1. Active Rate theo ngành hàng năm 2026</h3>
            ${wrBullets([
                `<b>Ngành Retail:</b> <b>67.30%</b> / Mục tiêu 67.80% (Chênh lệch so với tháng trước: <b>+0.30%</b>).`,
                `<b>Ngành F&B:</b> <b>75.10%</b> / Mục tiêu 75.30% (Chênh lệch so với tháng trước: <b>-0.10%</b>, duy trì vị thế dẫn đầu).`,
                `<b>Ngành Booking:</b> <b>65.30%</b> / Mục tiêu 66.00% (Chênh lệch so với tháng trước: <b>+0.20%</b>).`,
                `<b>Trung bình 3 ngành:</b> <b>69.23%</b> (Tăng nhẹ <b>+0.13%</b> so với tháng 08).`
            ])}
            ${wrRenderActiveRateTable(bsc.activeRate)}

            <h3>2. Tỷ lệ Inactive New tháng 09 (Khách ký mới &amp; SC đã chăm)</h3>
            <p>Trong tháng số khách hàng ký mới là <b>5.239</b> khách, phát sinh Inactive là <b>2.272</b> khách (tỷ lệ <b>42.63%</b>) → Đội ngũ SC đã chủ động liên hệ và chăm sóc được <b>1.859</b> khách (đạt <b>34.88%</b> trên tổng khách ký mới và <b>81.82%</b> trên tổng tệp inactive phát sinh):</p>
            ${wrRenderCareRateTable(bsc.careRate)}

            <h3>3. Tỷ lệ Inactive New theo tháng năm 2026 (Sheet baocaotuan AV2:BB15)</h3>
            <p>Theo dõi diễn biến tỷ lệ Inactive New qua các tháng trong năm 2026 giúp phòng DVKH kịp thời nắm bắt xu hướng rời bỏ phần mềm của từng ngành hàng:</p>
            ${wrRenderMonthlyInactiveTable(bsc.monthlyInactive)}
        </section>

        <!-- MỤC III: TÌNH HÌNH HOẠT ĐỘNG & QUÂN SỐ ĐỘI NGŨ SC -->
        <section>
            <h2>III. TÌNH HÌNH HOẠT ĐỘNG &amp; QUÂN SỐ ĐỘI NGŨ SC</h2>
            
            <h3>1. Định biên và Cơ cấu quân số toàn quốc</h3>
            ${wrBullets([
                `Tính đến kỳ báo cáo, tổng nhân sự Customer Success toàn quốc đạt <b>47/50 nhân sự</b>, còn thiếu <b>03 nhân sự</b> so với định biên (Miền Bắc: 22/23 nhân sự; Miền Nam: 25/27 nhân sự; Khối Online: 14/14 nhân sự).`,
                `Tổng số nhân sự thử việc: <b>06 nhân sự</b> (Khối Online: 02 nhân sự; Khối Offline: 04 nhân sự).`,
                `Trong tháng, các vị trí thiếu tại <b>Vũng Tàu</b> và <b>Nha Trang</b> đã được tuyển bù thành công và đang trong giai đoạn đào tạo thực địa.`,
                `Việc chưa đủ định biên phần nào ảnh hưởng đến khả năng bao phủ khách hàng tại một số địa bàn xa, tuy nhiên các trưởng nhóm đã chủ động điều phối nhân sự linh hoạt để đảm bảo tiến độ và chất lượng phục vụ.`
            ])}
            ${wrRenderHeadcountRegionTable(bsc.headcountRegion)}

            <h3>2. Cơ cấu phân bổ nhân sự tại 16 tỉnh thành</h3>
            <p>Bảng phân bổ chi tiết quân số tại các tỉnh thành trọng điểm:</p>
            ${wrRenderHeadcountProvinceTable(bsc.headcountProvince)}
        </section>

        <!-- MỤC IV: KẾT QUẢ THỰC HIỆN MỤC TIÊU & VẬN HÀNH -->
        <section>
            <h2>IV. KẾT QUẢ THỰC HIỆN MỤC TIÊU &amp; VẬN HÀNH (OFFLINE &amp; ONLINE)</h2>
            
            <h3>1. Kết quả hoạt động Team Offline</h3>
            <h4>1.1 Kết quả thực hiện mục tiêu vận hành</h4>
            ${wrBullets([
                `Team Offline đạt <b>75.93% - 91.68%</b> mục tiêu khách hàng đi được. Tiến độ theo tuần ghi nhận: Tuần 1: <b>95.21%</b>; Tuần 2: <b>88.20%</b>; Tuần 3: <b>89.76%</b>; Tuần 4: <b>51.22%</b>.`,
                `Tổng số Act thực hiện: <b>4.914 Act</b> (đạt 91.68% kế hoạch). Retail ID được chăm sóc trực tiếp: <b>4.752 khách</b>, chiếm <b>96.70%</b> tổng số Act đã làm.`,
                `Tỷ lệ Impact toàn team đạt <b>66.71%</b> (kỳ tuần đạt <b>69.22%</b>), với <b>2.932 - 3.278 khách hàng</b> có chuyển biến tích cực sau chăm sóc.`,
                `Tỷ lệ khách hàng Active tại ngày nhân sự check-in đạt mức rất cao: <b>86.41%</b>.`,
                `Trong kỳ, số Act được tạo thủ công là <b>746/4.914 Act</b>, chiếm tỷ trọng <b>15.81%</b> tổng số Act phát sinh.`
            ])}
            ${wrRenderMuctieuTable(bsc.muctieuOffline, false)}

            <h4>1.2 Tỷ lệ Impact 16 tỉnh thành qua các tháng (T7 - T12)</h4>
            <p>Số liệu Impact theo khu vực (Sheet baocaotuan K2:Q19):</p>
            ${wrRenderProvinceImpactTable(bsc.provinceImpact)}

            <h4>1.3 Phân tích nguyên nhân khách hàng Inactive (Tệp 3-4 tín hiệu)</h4>
            <p>Khảo sát chuyên sâu trên tệp khách hàng có dấu hiệu ngừng sử dụng (3-4 tín hiệu Inactive) giúp xác định nguyên nhân gốc rễ và đưa ra giải pháp can thiệp kịp thời:</p>
            ${wrRenderInactiveReasonTable()}

            <h4>1.4 Doanh thu Phần cứng Toàn quốc năm 2026</h4>
            ${wrBullets([
                `Tính đến thời điểm báo cáo, đội ngũ SC đã chốt thành công <b>100 đơn hàng</b> thiết bị phần cứng, tổng doanh thu đạt <b>113.748.000 VNĐ</b> (vượt 13.7% chỉ tiêu tháng).`,
                `Các thiết bị đóng góp doanh thu chủ lực gồm: Máy in hóa đơn bill (48.3 triệu VNĐ), Máy POS cảm ứng thu ngân (28.5 triệu VNĐ) và Máy quét mã vạch không dây (22.8 triệu VNĐ).`
            ])}
            ${wrRenderHardwareTable()}

            <h3>2. Kết quả hoạt động Team Online</h3>
            <h4>2.1 Kết quả thực hiện mục tiêu Team Online</h4>
            ${wrBullets([
                `Tỷ lệ đạt mục tiêu khách hàng của Team Online: Tuần 3 đạt <b>84.19%</b>, Tuần 4 đạt <b>87.28%</b>.`,
                `Tỷ lệ Impact Team Online tháng 09 đạt <b>53.16%</b>, ghi nhận mức tăng trưởng vượt bậc <b>+8.37%</b> so với tháng 08 (44.79%).`
            ])}
            ${wrRenderMuctieuTable(bsc.muctieuOnline, true)}

            <h4>2.2 Bảng theo dõi KPI Team Online Tháng 09 (Sheet baocaotuan AJ2:AP5)</h4>
            ${wrRenderKpiOnlineT9Table(bsc.kpiOnlineT9)}

            <h3>3. Năng suất làm việc và Đánh giá KPI Nhân sự SC</h3>
            ${wrBullets([
                `ATC trung bình toàn team đạt <b>${wrNumber(p.avgATC)} ATC/ngày</b>${p.avgATC >= 8 ? ', duy trì trên ngưỡng mục tiêu tối thiểu 8 ATC/ngày' : ', đang dưới ngưỡng 8 ATC/ngày'}.`,
                p.highATC.length ? `Nhóm nhân sự có sản lượng dẫn đầu: ${p.highATC.map(r => `${wrEscapeHtml(r.name)} (<b>${wrNumber(r.avgATC)}</b> ATC/ngày)`).join(', ')}.` : '',
                `Thời gian hỗ trợ khách hàng TB đạt <b>${wrNumber(p.avgHours)} giờ/ngày</b>; Quãng đường di chuyển TB đạt <b>${wrNumber(p.avgKM)} km/ngày</b>.`,
                `Tổng data treo và tồn đọng trên toàn hệ thống hiện tại là <b>${wrInt(b.total)}</b> case; Tỷ lệ ATC tự tạo toàn team ở mức <b>${wrPct(sc.pct, 1)}</b>.`
            ])}
            ${wrRenderKpiDashboardTable(k)}
            <div style="margin-top: 14px;">${wrRenderPerformanceDashboardTable(p)}</div>
            <div style="margin-top: 14px;">${wrRenderBacklogDashboardTables(b)}</div>
            <div style="margin-top: 14px;">${wrRenderIncomingDashboardTable(inc)}</div>
            <div style="margin-top: 14px;">${wrRenderSelfCreatedDashboardTable(sc)}</div>
            <div style="margin-top: 14px;">${wrRenderDurationDashboardTable(sd)}</div>
        </section>

        <!-- MỤC V: CHĂM SÓC KHÁCH HÀNG F&B LỚN VÀ XỬ LÝ LỖI TRỌNG ĐIỂM -->
        <section>
            <h2>V. CHĂM SÓC KHÁCH HÀNG F&amp;B LỚN VÀ XỬ LÝ LỖI TRỌNG ĐIỂM</h2>
            ${wrBullets([
                `Trong kỳ, đội ngũ SC đã tổ chức rà soát và chăm sóc chuyên biệt cho <b>608 khách hàng F&B lớn</b> (các chuỗi cà phê, nhà hàng quy mô).`,
                `Tỷ lệ khách hàng phát sinh lỗi kỹ thuật cần hỗ trợ là <b>29.93%</b> (tương đương 182 lượt lỗi).`,
                `Đội ngũ CS đã phối hợp chặt chẽ cùng các bộ phận Kỹ thuật và Sản phẩm để theo dõi, hỗ trợ tận nơi và duy trì việc sử dụng phần mềm nhằm hạn chế tối đa nguy cơ rời bỏ hoặc chấm dứt hợp đồng. Toàn bộ các sự cố kết nối app giao hàng và in ấn LAN/Bluetooth đã được xử lý triệt để.`
            ])}
            ${wrRenderFnbIssueTable(bsc.fnbIssue)}
        </section>

        <!-- MỤC VI: ĐỀ XUẤT ĐIỀU HÀNH & KẾ HOẠCH HÀNH ĐỘNG TUẦN TIẾP THEO -->
        <section>
            <h2>VI. ĐỀ XUẤT ĐIỀU HÀNH &amp; KẾ HOẠCH HÀNH ĐỘNG</h2>
            <p>Để đảm bảo hoàn thành vượt mức các mục tiêu kinh doanh và kiểm soát chất lượng khách hàng trong các tuần tiếp theo, khối CS đề xuất các trọng tâm điều hành sau:</p>
            ${wrBullets([
                `<b>1. Tuyển dụng &amp; Ổn định quân số:</b> Đẩy nhanh tiến độ tuyển bù 03 định biên còn thiếu cho khu vực miền Trung và miền Nam; phân công kèm cặp 1-1 cho 06 nhân sự thử việc mới để sớm độc lập phụ trách địa bàn.`,
                `<b>2. Kiểm soát Active Rate &amp; Inactive New:</b> Triển khai quy trình tiếp cận tệp Inactive New ngay trong tuần đầu tiên phát sinh tín hiệu; ưu tiên nguồn lực chăm sóc tệp 3-4 tín hiệu Inactive để kéo khách quay trở lại sử dụng.`,
                `<b>3. Nâng cao chất lượng hỗ trợ &amp; Năng suất:</b> Kiểm soát chặt chẽ tỷ lệ hỗ trợ dưới 5 phút, rà soát các case tự tạo, nâng cao tỷ lệ impact thực chất sau mỗi lượt ghé thăm.`,
                `<b>4. Thúc đẩy Doanh thu Phần cứng &amp; Add-on:</b> Tăng cường tư vấn combo thiết bị máy in LAN/BT, giải pháp thanh toán QR Payment và tích hợp giao vận Kship cho các cửa hàng mới ký.`
            ])}
            ${manual.plans ? `
            <div style="margin-top: 12px;">
                <h4 style="color:#1d4ed8; font-weight:700;">Kế hoạch cụ thể tuần tiếp theo:</h4>
                <ol>${wrLinesToList(manual.plans).map(x => `<li>${wrEscapeHtml(x.replace(/^[-•\d.)\s]+/, ''))}</li>`).join('')}</ol>
            </div>` : ''}
            ${manual.issues ? `
            <div style="margin-top: 12px;">
                <h4 style="color:#b91c1c; font-weight:700;">Vấn đề nổi bật cần lưu ý:</h4>
                ${wrBullets(wrLinesToList(manual.issues).map(wrEscapeHtml))}
            </div>` : ''}
        </section>

        <!-- MỤC VII: CÁC MỤC TÙY CHỈNH (CUSTOM SECTIONS) -->
        ${(() => {
            let extra = '';
            let secIdx = 7;
            if (Array.isArray(manual.customSections) && manual.customSections.length) {
                manual.customSections.forEach(sec => {
                    if (!sec.title && !sec.contentHtml) return;
                    const secTitle = sec.title ? sec.title.toUpperCase() : 'MỤC TÙY CHỈNH';
                    extra += `
        <section class="wr-custom-section">
            <h2>${wrToRoman(secIdx++)}. ${wrEscapeHtml(secTitle)}</h2>
            <div class="wr-custom-content">${sec.contentHtml || ''}</div>
        </section>`;
                });
            }
            return extra;
        })()}

        <!-- LỜI KẾT & CHỮ KÝ BÁO CÁO -->
        <div style="margin-top: 28px; padding-top: 14px; border-top: 1px dashed var(--wr-border, #cbd5e1); font-size: 13px; color: var(--wr-text, #1e293b); font-style: italic;">
            Trên đây là báo cáo định kỳ chất lượng Customer Success (SC) kính gửi <b>anh Nguyễn Dũng Hải SDM DVKH</b> nắm thông tin giúp em ạ. Em cảm ơn anh!
        </div>

        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--wr-border, #cbd5e1); display: flex; justify-content: space-between; align-items: flex-start;">
            <div style="font-size: 11.5px; color: var(--wr-muted, #64748b); max-width: 340px;">
                <div><b>Báo cáo tổng hợp tự động từ hệ thống CRM &amp; Google Sheets DVKH</b></div>
                <div style="margin-top: 4px;">Thời gian tạo: ${new Date().toLocaleString('vi-VN')}</div>
                <div style="margin-top: 2px;">Bảo mật thông tin nội bộ • Khối Chăm Sóc Khách Hàng (Customer Success - SC).</div>
            </div>
            <div style="text-align: center; min-width: 250px;">
                <div style="font-size: 12px; color: var(--wr-muted, #64748b); font-style: italic;">
                    Hà Nội / TP.HCM, ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}
                </div>
                <div style="height: 48px;"></div>
                <div style="font-size: 13px; font-weight: 700; color: var(--wr-text, #0f172a);">
                    Đại diện Đội ngũ Customer Success (SC)
                </div>
                <div style="font-size: 12px; color: #1d4ed8; font-weight: 600; margin-top: 4px;">
                    Trân trọng gửi anh Nguyễn Dũng Hải SDM DVKH
                </div>
            </div>
        </div>
    </article>`;
}

function wrHtmlToPlainText(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    div.querySelectorAll('tr').forEach(tr => {
        const cells = Array.from(tr.querySelectorAll('th,td')).map(c => c.innerText.trim());
        if (cells.length) tr.insertAdjacentText('afterend', '\n' + cells.join('\t'));
    });
    div.querySelectorAll('li').forEach(li => li.insertAdjacentText('beforebegin', '\n• '));
    div.querySelectorAll('h1,h2,h3,h4,p,section').forEach(el => el.insertAdjacentText('afterend', '\n'));
    return div.innerText.replace(/\n{3,}/g, '\n\n').trim();
}

async function generateWeeklyReport() {
    const status = document.getElementById('wrStatus');
    const preview = document.getElementById('weeklyReportPreview');
    const btn = document.getElementById('wrGenerateBtn');
    try {
        if (btn) { btn.disabled = true; btn.innerText = '⏳ Đang tổng hợp...'; }
        if (status) status.innerHTML = '⏳ Đang tải toàn bộ dữ liệu KPI, BSC, Hiệu suất, Quân số và Mục tiêu...';

        const fromVal = document.getElementById('wrFromDate').value;
        const toVal = document.getElementById('wrToDate').value;
        if (!fromVal || !toVal) throw new Error('Vui lòng chọn Từ ngày và Đến ngày.');
        const fromDate = new Date(fromVal + 'T00:00:00');
        const toDate = new Date(toVal + 'T00:00:00');
        if (fromDate > toDate) throw new Error('Từ ngày không được lớn hơn Đến ngày.');

        // Nạp song song dữ liệu KPI/Hiệu suất và dữ liệu Báo cáo SC từ Google Sheets
        const [data] = await Promise.all([
            wrEnsureAllData(),
            (async () => {
                if (typeof loadBaoCaoSc === 'function') {
                    try {
                        await loadBaoCaoSc(false, true);
                    } catch (eBsc) {
                        console.warn('[Báo cáo tuần] Cảnh báo khi tải Sheet baocaosc:', eBsc);
                    }
                }
            })()
        ]);

        const kpi = wrBuildKpiMetrics(data.kpi);
        const performance = wrBuildPerformanceMetrics(data.hieusuat, data.ngaycong, fromDate, toDate);
        const backlog = wrBuildBacklogMetrics(data.data);
        const incoming = wrBuildIncomingMetrics(data.thongke, fromDate, toDate);
        const selfCreated = wrBuildSelfCreatedMetrics(performance.filteredRows);
        const supportDuration = wrBuildSupportDurationMetrics(performance.filteredRows);
        const manual = wrSaveManual();
        const previousSnapshot = wrFindPreviousSnapshot(toDate);

        // Chuẩn hóa dữ liệu từ BAOCAOSC_STATE
        const bscData = {
            activeRate: (typeof normalizeActiveRateData === 'function' && BAOCAOSC_STATE?.activeRate) 
                ? normalizeActiveRateData(BAOCAOSC_STATE.activeRate) 
                : (BAOCAOSC_STATE?.parsedActive || null),
            careRate: (typeof normalizeCareRateData === 'function' && BAOCAOSC_STATE?.careRate) 
                ? normalizeCareRateData(BAOCAOSC_STATE.careRate) 
                : (BAOCAOSC_STATE?.parsedCare || null),
            monthlyInactive: (typeof normalizeMonthlyInactiveData === 'function' && BAOCAOSC_STATE?.monthlyInactive) 
                ? normalizeMonthlyInactiveData(BAOCAOSC_STATE.monthlyInactive) 
                : (BAOCAOSC_STATE?.parsedMonthlyInactive || null),
            headcountRegion: (typeof normalizeHeadcountRegionData === 'function' && BAOCAOSC_STATE?.headcountRegion) 
                ? normalizeHeadcountRegionData(BAOCAOSC_STATE.headcountRegion) 
                : (BAOCAOSC_STATE?.parsedHeadcountRegion || null),
            headcountProvince: (typeof normalizeHeadcountProvinceData === 'function' && BAOCAOSC_STATE?.headcountProvince) 
                ? normalizeHeadcountProvinceData(BAOCAOSC_STATE.headcountProvince) 
                : (BAOCAOSC_STATE?.parsedHeadcountProvince || null),
            provinceImpact: (typeof normalizeProvinceImpactData === 'function' && BAOCAOSC_STATE?.provinceImpact) 
                ? normalizeProvinceImpactData(BAOCAOSC_STATE.provinceImpact) 
                : (BAOCAOSC_STATE?.parsedProvinceImpact || null),
            fnbIssue: (typeof normalizeFnbIssueData === 'function' && BAOCAOSC_STATE?.fnbIssue) 
                ? normalizeFnbIssueData(BAOCAOSC_STATE.fnbIssue) 
                : (BAOCAOSC_STATE?.parsedFnb || null),
            kpiOnlineT9: (typeof normalizeKpiOnlineT9Data === 'function' && BAOCAOSC_STATE?.kpiOnlineT9) 
                ? normalizeKpiOnlineT9Data(BAOCAOSC_STATE.kpiOnlineT9) 
                : (BAOCAOSC_STATE?.parsedKpiOnlineT9 || null),
            muctieuOffline: BAOCAOSC_STATE?.muctieuOffline || (typeof MUCTIEU_STATE !== 'undefined' ? MUCTIEU_STATE.offline : null),
            muctieuOnline: BAOCAOSC_STATE?.muctieuOnline || (typeof MUCTIEU_STATE !== 'undefined' ? MUCTIEU_STATE.online : null)
        };

        const metrics = { kpi, performance, backlog, incoming, selfCreated, supportDuration, bsc: bscData };
        const html = wrBuildReportHtml(metrics, fromDate, toDate, previousSnapshot, manual);
        const plainText = wrHtmlToPlainText(html);

        window.weeklyReportOriginalHtml = html;
        window.weeklyReportState = { metrics, html, plainText, previousSnapshot };
        if (preview) {
            preview.innerHTML = html;
            wrInitDirectEditing();
        }
        if (status) status.innerHTML = `✅ Đã tạo báo cáo tự động đến hết <b>${wrFormatVNDate(toDate)}</b> gửi <b>${wrEscapeHtml(document.getElementById('wrRecipient')?.value || 'anh Nguyễn Dũng Hải')}</b>. ${previousSnapshot ? `Đang so với mốc ${previousSnapshot.date.split('-').reverse().join('/')}.` : 'Chưa có mốc trước để so sánh.'}`;
    } catch (err) {
        console.error('Weekly report error:', err);
        if (status) status.innerHTML = `<span style="color:#ef4444">❌ ${wrEscapeHtml(err.message || String(err))}</span>`;
        if (preview) preview.innerHTML = `<div class="wr-empty">Không tạo được báo cáo. Kiểm tra lại dữ liệu hoặc kết nối.</div>`;
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = '⚡ Tạo báo cáo tự động'; }
    }
}


function wrInitDirectEditing() {
    const doc = document.getElementById('weeklyReportDocument');
    const editBar = document.getElementById('wrEditBar');
    if (editBar) {
        editBar.style.display = 'flex';
        const bgPop = document.getElementById('wrBgPopover_doc');
        if (bgPop && !bgPop.innerHTML.trim()) bgPop.innerHTML = wrBuildBgPopoverHtml('doc');
        const textPop = document.getElementById('wrTextColPopover_doc');
        if (textPop && !textPop.innerHTML.trim()) textPop.innerHTML = wrBuildTextColorPopoverHtml('doc');
        const hiPop = document.getElementById('wrHilitePopover_doc');
        if (hiPop && !hiPop.innerHTML.trim()) hiPop.innerHTML = wrBuildTextHighlightPopoverHtml('doc');
    }
    if (!doc) return;

    doc.setAttribute('contenteditable', 'true');
    doc.setAttribute('spellcheck', 'false');

    doc.removeEventListener('input', wrHandleDocEdit);
    doc.addEventListener('input', wrHandleDocEdit);

    ['mouseup', 'keyup', 'focus', 'click'].forEach(evtType => {
        doc.addEventListener(evtType, function() {
            wrUpdateEditorContext(doc);
        });
    });

    const toggleBtn = document.getElementById('wrToggleEditBtn');
    if (toggleBtn) {
        toggleBtn.innerHTML = '🔓 Đang mở sửa';
        toggleBtn.classList.remove('wr-btn-locked');
    }
}

let wrDocEditDebounceTimer = null;
function wrHandleDocEdit() {
    clearTimeout(wrDocEditDebounceTimer);
    wrDocEditDebounceTimer = setTimeout(() => {
        const doc = document.getElementById('weeklyReportDocument');
        if (!doc) return;
        if (window.weeklyReportState) {
            window.weeklyReportState.html = doc.outerHTML;
            window.weeklyReportState.plainText = wrHtmlToPlainText(doc.innerHTML);
        }
        wrShowSaveIndicator();
    }, 400);
}

function wrShowSaveIndicator() {
    const hint = document.querySelector('.wr-edit-hint');
    if (hint) {
        const origText = 'Click chuột trực tiếp vào bất kỳ chữ, số hoặc ô bảng nào bên dưới để sửa nội dung trước khi xuất.';
        hint.innerHTML = '<span style="color:#10b981; font-weight:800;">✓ Đã lưu nội dung sửa đổi vào bản xuất</span>';
        setTimeout(() => {
            if (hint) hint.innerHTML = origText;
        }, 2500);
    }
}

function wrToggleEditMode() {
    const doc = document.getElementById('weeklyReportDocument');
    const toggleBtn = document.getElementById('wrToggleEditBtn');
    if (!doc || !toggleBtn) return;

    const isEditable = doc.getAttribute('contenteditable') === 'true';
    if (isEditable) {
        doc.setAttribute('contenteditable', 'false');
        toggleBtn.innerHTML = '🔒 Đã khóa sửa';
        toggleBtn.classList.add('wr-btn-locked');
    } else {
        doc.setAttribute('contenteditable', 'true');
        toggleBtn.innerHTML = '🔓 Đang mở sửa';
        toggleBtn.classList.remove('wr-btn-locked');
    }
}

function wrResetToOriginalReport() {
    if (!window.weeklyReportOriginalHtml) {
        alert('⚠️ Chưa có bản báo cáo gốc để khôi phục.');
        return;
    }
    if (!confirm('Bạn có chắc muốn khôi phục lại toàn bộ số liệu và nội dung báo cáo tự động ban đầu? Mọi chỉnh sửa trực tiếp trên văn bản sẽ bị hủy.')) {
        return;
    }
    const preview = document.getElementById('weeklyReportPreview');
    if (preview) {
        preview.innerHTML = window.weeklyReportOriginalHtml;
        if (window.weeklyReportState) {
            window.weeklyReportState.html = window.weeklyReportOriginalHtml;
            window.weeklyReportState.plainText = wrHtmlToPlainText(window.weeklyReportOriginalHtml);
        }
        wrInitDirectEditing();
        wrShowSaveIndicator();
    }
}

function wrExecDocFormat(command, value = null) {
    document.execCommand(command, false, value);
    wrHandleDocEdit();
}

// Hỗ trợ phím Tab chuyển ô nhanh trong bảng khi sửa
document.addEventListener('keydown', function(e) {
    if (e.key === 'Tab') {
        const active = document.activeElement;
        if (active && (active.tagName === 'TD' || active.tagName === 'TH') && active.closest('#weeklyReportDocument')) {
            const table = active.closest('table');
            if (!table) return;
            const cells = Array.from(table.querySelectorAll('th, td'));
            const idx = cells.indexOf(active);
            if (idx !== -1) {
                e.preventDefault();
                const nextIdx = e.shiftKey ? idx - 1 : idx + 1;
                if (nextIdx >= 0 && nextIdx < cells.length) {
                    cells[nextIdx].focus();
                }
            }
        }
    }
});


function wrBuildClipboardHtmlWithInlineStyles() {
    const original = document.querySelector('#weeklyReportPreview .wr-document');
    if (!original) return window.weeklyReportState?.html || '';
    const clone = original.cloneNode(true);

    // Xóa các phần tử tương tác không cần thiết trong văn bản tĩnh
    clone.querySelectorAll('.wr-drill-pill, .wr-custom-btn-del, .wr-custom-toolbar, input, button').forEach(el => el.remove());
    clone.removeAttribute('contenteditable');
    clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));

    const srcEls = [original, ...original.querySelectorAll('*')];
    const dstEls = [clone, ...clone.querySelectorAll('*')];

    const generalProps = [
        'display', 'margin', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right',
        'padding', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
        'border', 'border-top', 'border-bottom', 'border-left', 'border-right', 'border-radius',
        'background-color', 'color', 'font-family', 'font-size', 'font-weight', 'line-height',
        'text-align', 'vertical-align', 'border-collapse'
    ];

    srcEls.forEach((src, i) => {
        const dst = dstEls[i];
        if (!dst || !(src instanceof Element) || !(dst instanceof Element)) return;

        const tag = dst.tagName.toLowerCase();
        const cs = getComputedStyle(src);

        if (tag === 'table') {
            dst.setAttribute('style', 'width: 100% !important; border-collapse: collapse !important; table-layout: auto !important; margin: 12px 0 16px !important; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif !important; font-size: 11px !important;');
        } else if (tag === 'th') {
            const bg = cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent' ? cs.backgroundColor : '#e8eef7';
            const col = cs.color || '#17365d';
            dst.setAttribute('style', `border: 1px solid #cbd5e1 !important; background-color: ${bg} !important; color: ${col} !important; font-weight: bold !important; font-size: 10.5px !important; padding: 7px 8px !important; text-align: center !important; vertical-align: middle !important; white-space: nowrap !important; line-height: 1.25 !important;`);
        } else if (tag === 'td') {
            const isName = dst.classList.contains('wr-name') || dst.classList.contains('wr-doc-title') || cs.textAlign === 'left';
            const bg = cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent' ? cs.backgroundColor : '#ffffff';
            const col = cs.color || '#1e293b';
            const fw = cs.fontWeight || (isName ? 'bold' : 'normal');
            const align = isName ? 'left' : (cs.textAlign || 'center');
            dst.setAttribute('style', `border: 1px solid #cbd5e1 !important; background-color: ${bg} !important; color: ${col} !important; font-weight: ${fw} !important; font-size: 11px !important; padding: 6px 8px !important; text-align: ${align} !important; vertical-align: middle !important; white-space: nowrap !important; font-variant-numeric: tabular-nums !important;`);
        } else if (tag === 'h2' || tag === 'h3' || tag === 'h4') {
            const col = cs.color || '#17365d';
            const fsz = tag === 'h2' ? '18px' : (tag === 'h3' ? '14px' : '12.5px');
            const borderB = tag === 'h2' ? 'border-bottom: 2px solid #d7e5f2 !important; padding-bottom: 6px !important;' : '';
            dst.setAttribute('style', `color: ${col} !important; font-size: ${fsz} !important; font-weight: 800 !important; text-align: left !important; margin: 18px 0 10px !important; ${borderB}`);
        } else {
            const styles = [];
            generalProps.forEach(p => {
                const v = cs.getPropertyValue(p);
                if (v) styles.push(`${p}:${v}`);
            });
            styles.push('word-break: normal');
            styles.push('overflow-wrap: normal');
            dst.setAttribute('style', styles.join(';') + ' !important;');
        }

        dst.removeAttribute('onclick');
        dst.removeAttribute('title');
    });

    return clone.outerHTML;
}

async function copyWeeklyReportForAtlassian() {
    const state = window.weeklyReportState;
    if (!state || !state.html) {
        alert('⚠️ Hãy tạo báo cáo trước.');
        return;
    }

    const preview = document.getElementById('weeklyReportPreview');
    try {
        // ClipboardItem giúp Atlassian nhận rich HTML (text + bảng) thay vì ảnh attachment.
        if (navigator.clipboard && window.ClipboardItem) {
            const clipboardHtml = wrBuildClipboardHtmlWithInlineStyles();
            const htmlBlob = new Blob([clipboardHtml], { type: 'text/html' });
            const textBlob = new Blob([state.plainText], { type: 'text/plain' });
            await navigator.clipboard.write([new ClipboardItem({
                'text/html': htmlBlob,
                'text/plain': textBlob
            })]);
            alert('✅ Đã copy báo cáo dạng rich text. Sang Atlassian/Confluence bấm Ctrl+V. Bảng và chữ vẫn sửa được.');
            return;
        }
        throw new Error('ClipboardItem không được hỗ trợ');
    } catch (e) {
        // Fallback: chọn trực tiếp DOM rồi copy, trình duyệt thường đưa cả text/html vào clipboard.
        try {
            const range = document.createRange();
            range.selectNodeContents(preview);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            document.execCommand('copy');
            selection.removeAllRanges();
            alert('✅ Đã copy báo cáo. Sang Atlassian/Confluence bấm Ctrl+V.');
        } catch (err) {
            alert('❌ Trình duyệt chặn copy tự động. Anh bôi đen phần Preview rồi Ctrl+C giúp em.');
        }
    }
}

function downloadWeeklyReportHtml() {
    const state = window.weeklyReportState;
    if (!state || !state.html) { alert('⚠️ Hãy tạo báo cáo trước.'); return; }
    const doc = document.getElementById('weeklyReportDocument');
    let htmlContent = state.html;
    if (doc) {
        const clone = doc.cloneNode(true);
        clone.removeAttribute('contenteditable');
        clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
        htmlContent = clone.outerHTML;
    }
    const styles = document.getElementById('weeklyReportExportStyles')?.textContent || '';
    const full = `<!doctype html><html><head><meta charset="utf-8"><title>Báo cáo tuần SC</title><style>${styles}</style></head><body>${htmlContent}</body></html>`;
    const blob = new Blob([full], { type: 'text/html;charset=utf-8' });
    const fromVal = document.getElementById('wrFromDate')?.value || '';
    const toVal = document.getElementById('wrToDate')?.value || '';
    const fileSuffix = (fromVal && toVal) ? `${fromVal}_den_${toVal}` : (toVal || 'SC');
    wrDownloadBlob(blob, `Bao_cao_tuan_SC_${fileSuffix}.html`);
}

// ===== TRUE DOCX EXPORT (hỗ trợ xuất cả nội dung sửa trực tiếp) =====
function wrDocxEsc(v) {
    return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function wrDocxRun(text, {bold=false, color='172033', size=18}={}) {
    return `<w:r><w:rPr>${bold?'<w:b/>':''}<w:color w:val="${color}"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial"/></w:rPr><w:t xml:space="preserve">${wrDocxEsc(text)}</w:t></w:r>`;
}
function wrDocxP(text, {bold=false, color='172033', size=18, align='left', before=0, after=80, keep=false}={}) {
    return `<w:p><w:pPr><w:jc w:val="${align}"/><w:spacing w:before="${before}" w:after="${after}"/>${keep?'<w:keepNext/>':''}</w:pPr>${wrDocxRun(text,{bold,color,size})}</w:p>`;
}
function wrDocxCell(cell, width, fontSize=15, header=false) {
    const c = (cell && typeof cell === 'object' && !Array.isArray(cell)) ? cell : {text: cell};
    const fill = c.fill || (header ? 'D9EAF7' : 'FFFFFF');
    const color = c.color || (header ? '17365D' : '172033');
    const bold = c.bold !== undefined ? c.bold : header;
    const align = c.align || (c.name ? 'left' : 'center');
    return `<w:tc><w:tcPr><w:tcW w:w="${Math.max(200,Math.round(width))}" w:type="dxa"/><w:shd w:fill="${fill}"/><w:tcMar><w:top w:w="40" w:type="dxa"/><w:left w:w="45" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="45" w:type="dxa"/></w:tcMar><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="${align}"/><w:spacing w:after="0"/></w:pPr>${wrDocxRun(c.text ?? '',{bold,color,size:fontSize})}</w:p></w:tc>`;
}
function wrDocxTable(headers, rows, widths, {fontSize=15, headerSize=14}={}) {
    const contentWidth = 15800;
    const ws = widths && widths.length === headers.length ? widths : headers.map(()=>contentWidth/headers.length);
    const grid = `<w:tblGrid>${ws.map(w=>`<w:gridCol w:w="${Math.round(w)}"/>`).join('')}</w:tblGrid>`;
    const head = `<w:tr><w:trPr><w:tblHeader/></w:trPr>${headers.map((h,i)=>wrDocxCell({text:h,bold:true,fill:'D9EAF7',color:'17365D'},ws[i],headerSize,true)).join('')}</w:tr>`;
    const body = rows.map(row=>`<w:tr>${row.map((c,i)=>wrDocxCell(c,ws[i]||700,fontSize,false)).join('')}</w:tr>`).join('');
    return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="B8C2CC"/><w:left w:val="single" w:sz="4" w:color="B8C2CC"/><w:bottom w:val="single" w:sz="4" w:color="B8C2CC"/><w:right w:val="single" w:sz="4" w:color="B8C2CC"/><w:insideH w:val="single" w:sz="4" w:color="B8C2CC"/><w:insideV w:val="single" w:sz="4" w:color="B8C2CC"/></w:tblBorders></w:tblPr>${grid}${head}${body}</w:tbl>${wrDocxP('',{size:4,after:70})}`;
}
function wrDocxPctCell(v) {
    const n=Number(v); if(!isFinite(n)) return {text:'-'};
    if(n<50) return {text:wrPct(n),fill:'FEE2E2',color:'B91C1C',bold:true};
    if(n<70) return {text:wrPct(n),fill:'FEF3C7',color:'B45309',bold:true};
    return {text:wrPct(n),fill:'D1FAE5',color:'047857',bold:true};
}
function wrDocxBullet(text) { return wrDocxP(`• ${text}`,{size:18,after:45}); }
function wrDocxHeading(text, level=1) { return wrDocxP(text,{bold:true,color:'17365D',size:level===1?28:22,before:120,after:90,keep:true}); }

function wrColorToHex(colorStr, defaultHex = null) {
    if (!colorStr || colorStr === 'transparent' || colorStr === 'inherit' || colorStr === 'initial') return defaultHex;
    colorStr = String(colorStr).trim();
    if (colorStr.startsWith('#')) {
        let h = colorStr.replace('#', '');
        if (h.length === 3) h = h.split('').map(c => c + c).join('');
        return h.toUpperCase().slice(0, 6);
    }
    const rgbMatch = colorStr.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (rgbMatch) {
        const r = parseInt(rgbMatch[1], 10).toString(16).padStart(2, '0');
        const g = parseInt(rgbMatch[2], 10).toString(16).padStart(2, '0');
        const b = parseInt(rgbMatch[3], 10).toString(16).padStart(2, '0');
        return `${r}${g}${b}`.toUpperCase();
    }
    return defaultHex;
}

function wrDocxBuildFromDom(docEl, state) {
    const fromVal = document.getElementById('wrFromDate')?.value || '';
    const toVal = document.getElementById('wrToDate')?.value || '';
    const fromDate = fromVal ? new Date(fromVal + 'T00:00:00') : new Date();
    const toDate = toVal ? new Date(toVal + 'T00:00:00') : new Date();
    let body = '';

    const titleEl = docEl.querySelector('.wr-doc-title');
    const subtitleEl = docEl.querySelector('.wr-doc-subtitle');
    const titleText = titleEl ? titleEl.innerText.trim() : (document.getElementById('wrDocTitle')?.value?.trim() || 'BÁO CÁO CHẤT LƯỢNG CUSTOMER SUCCESS (SC)');
    const subText = subtitleEl ? subtitleEl.innerText.trim() : `Dữ liệu từ ${wrFormatVNDate(fromDate)} đến hết ${wrFormatVNDate(toDate)}`;

    body += wrDocxP(titleText, {bold:true, color:'17365D', size:38, align:'center', after:40});
    body += wrDocxP(subText, {color:'666666', size:18, align:'center', after:160});

    const sections = Array.from(docEl.querySelectorAll('section'));
    const containerList = sections.length ? sections : [docEl];

    containerList.forEach(sec => {
        const children = Array.from(sec.children);
        children.forEach(child => {
            const tag = child.tagName.toLowerCase();
            if (tag === 'h2') {
                body += wrDocxHeading(child.innerText.trim(), 1);
            } else if (tag === 'h3') {
                body += wrDocxHeading(child.innerText.trim(), 2);
            } else if (tag === 'h4') {
                body += wrDocxHeading(child.innerText.trim(), 3);
            } else if (tag === 'p') {
                const txt = child.innerText.trim();
                if (txt) {
                    const isNote = child.classList.contains('wr-note');
                    body += wrDocxP(txt, {size:18, after:60, color: isNote ? '2B579A' : '172033'});
                }
            } else if (tag === 'ul' || tag === 'ol') {
                Array.from(child.querySelectorAll('li')).forEach((li, idx) => {
                    const prefix = tag === 'ol' ? `${idx+1}. ` : '';
                    body += wrDocxBullet(prefix + li.innerText.trim());
                });
            } else if (tag === 'table' || child.querySelector('table')) {
                const tables = tag === 'table' ? [child] : Array.from(child.querySelectorAll('table'));
                tables.forEach(table => {
                    const headerThs = Array.from(table.querySelectorAll('thead th, tr:first-child th'));
                    const headers = headerThs.length ? headerThs.map(th => {
                        const text = th.innerText.trim();
                        let fill = 'D9EAF7';
                        let color = '17365D';
                        if (th.style.backgroundColor) {
                            const hex = wrColorToHex(th.style.backgroundColor);
                            if (hex) fill = hex;
                        }
                        if (th.style.color) {
                            const hex = wrColorToHex(th.style.color);
                            if (hex) color = hex;
                        }
                        return { text, fill, color, bold: true, align: 'center' };
                    }) : (table.querySelector('tr:first-child') ? Array.from(table.querySelectorAll('tr:first-child td')).map(td => td.innerText.trim()) : []);

                    const rowEls = Array.from(table.querySelectorAll('tbody tr, tr')).filter(tr => !tr.querySelector('th') || headerThs.length === 0);
                    const bodyRows = (headerThs.length ? rowEls : rowEls.slice(1)).map(tr => {
                        return Array.from(tr.querySelectorAll('td, th')).map(cell => {
                            const text = cell.innerText.trim();
                            let fill = 'FFFFFF';
                            let color = '172033';
                            let bold = !!cell.querySelector('b, strong') || cell.classList.contains('wr-name') || cell.classList.contains('wr-strong') || cell.classList.contains('wr-total-accent');

                            if (cell.classList.contains('wr-kpi-good') || cell.classList.contains('wr-perf-good') || cell.classList.contains('wr-badge-green')) {
                                fill = 'D1FAE5'; color = '047857'; bold = true;
                            } else if (cell.classList.contains('wr-kpi-medium') || cell.classList.contains('wr-perf-warn') || cell.classList.contains('wr-badge-yellow')) {
                                fill = 'FEF3C7'; color = 'B45309'; bold = true;
                            } else if (cell.classList.contains('wr-kpi-bad') || cell.classList.contains('wr-perf-bad') || cell.classList.contains('wr-badge-red')) {
                                fill = 'FEE2E2'; color = 'B91C1C'; bold = true;
                            } else if (cell.classList.contains('wr-duration-low')) {
                                fill = 'DBEAFE'; color = '1D4ED8';
                            } else if (cell.classList.contains('wr-duration-mid')) {
                                fill = '93C5FD'; color = '1E3A8A'; bold = true;
                            } else if (cell.classList.contains('wr-duration-high')) {
                                fill = '2563EB'; color = 'FFFFFF'; bold = true;
                            } else if (tr.classList.contains('wr-native-total')) {
                                fill = 'E2E8F0'; bold = true;
                            }

                            // Custom inline colors override class defaults
                            if (cell.style.backgroundColor) {
                                const hex = wrColorToHex(cell.style.backgroundColor);
                                if (hex) fill = hex;
                            } else if (tr.style.backgroundColor) {
                                const hex = wrColorToHex(tr.style.backgroundColor);
                                if (hex) fill = hex;
                            }
                            if (cell.style.color) {
                                const hex = wrColorToHex(cell.style.color);
                                if (hex) color = hex;
                            }

                            const align = cell.classList.contains('wr-name') ? 'left' : 'center';
                            return { text, fill, color, bold, align };
                        });
                    });

                    if (headers.length || bodyRows.length) {
                        const colCount = Math.max(1, headers.length || (bodyRows[0] ? bodyRows[0].length : 1));
                        const isWideFirst = colCount > 3;
                        const firstColWidth = isWideFirst ? 2600 : Math.floor(15800 / colCount);
                        const restWidth = isWideFirst ? Math.floor((15800 - 2600) / (colCount - 1)) : firstColWidth;
                        const widths = Array(colCount).fill(0).map((_, idx) => idx === 0 ? firstColWidth : restWidth);

                        body += wrDocxTable(headers.length ? headers : bodyRows[0].map(() => '-'), bodyRows, widths, {fontSize: 12, headerSize: 11});
                    }
                });
            } else if (child.classList.contains('wr-backlog-grand')) {
                body += wrDocxP(child.innerText.trim(), {bold: true, color: '17365D', size: 19, after: 80});
            }
        });
    });

    const genNote = docEl.querySelector('.wr-generated-note');
    const genText = genNote ? genNote.innerText.trim() : `Báo cáo được tổng hợp tự động từ CRM Dashboard • ${new Date().toLocaleString('vi-VN')}`;
    body += wrDocxP(genText, {color:'777777', size:14, align:'center', before:140, after:0});

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="720" w:footer="720" w:gutter="0"/><w:cols w:space="720"/></w:sectPr></w:body></w:document>`;
}

function wrDocxBuildDocumentXml(state) {
    const docEl = document.getElementById('weeklyReportDocument');
    if (docEl) {
        try {
            return wrDocxBuildFromDom(docEl, state);
        } catch (e) {
            console.warn('wrDocxBuildFromDom fallback to original generator:', e);
        }
    }
    const m=state.metrics, k=m.kpi, p=m.performance, b=m.backlog, inc=m.incoming, sc=m.selfCreated, sd=m.supportDuration;
    const manual=wrLoadManual();
    const fromDate=new Date(document.getElementById('wrFromDate').value+'T00:00:00');
    const toDate=new Date(document.getElementById('wrToDate').value+'T00:00:00');
    let body='';
    const docTitle = document.getElementById('wrDocTitle')?.value?.trim() || 'BÁO CÁO CHẤT LƯỢNG CUSTOMER SUCCESS (SC)';
    const recipient = document.getElementById('wrRecipient')?.value?.trim() || 'anh Nguyễn Dũng Hải - SDM DVKH (Dịch Vụ Khách Hàng)';
    body += wrDocxP(docTitle,{bold:true,color:'17365D',size:38,align:'center',after:40});
    body += wrDocxP(`Kính gửi: ${recipient}`,{bold:true,color:'1D4ED8',size:22,align:'center',after:60});
    body += wrDocxP(`Dữ liệu từ ${wrFormatVNDate(fromDate)} đến hết ${wrFormatVNDate(toDate)}`,{color:'666666',size:18,align:'center',after:160});
    body += wrDocxHeading('I. TÓM TẮT');
    body += wrDocxP(`KPI tổng team ${wrPct(k.totalTeam)}; Impact ${wrPct(k.impactTeam)}; năng suất ${wrNumber(p.avgATC)} ATC/ngày; thời gian hỗ trợ TB ${wrNumber(p.avgHours)} giờ/ngày; data treo & tồn ${wrInt(b.total)}; ATC tự tạo ${wrPct(sc.pct,1)}; hỗ trợ 0-5 phút ${wrPct(sd.shortPct)}.`,{size:19,after:100});
    body += wrDocxTable(['CHỈ SỐ','GIÁ TRỊ','CHỈ SỐ','GIÁ TRỊ'],[
        [{text:'KPI tổng team',bold:true,fill:'EDF4FB'},wrPct(k.totalTeam),{text:'Impact team',bold:true,fill:'EDF4FB'},wrPct(k.impactTeam)],
        [{text:'ATC TB/ngày',bold:true,fill:'EDF4FB'},wrNumber(p.avgATC),{text:'Thời gian HT TB',bold:true,fill:'EDF4FB'},`${wrNumber(p.avgHours)} giờ`],
        [{text:'Data treo & tồn',bold:true,fill:'EDF4FB'},wrInt(b.total),{text:'ATC tự tạo',bold:true,fill:'EDF4FB'},wrPct(sc.pct,1)],
        [{text:'ATC 0-5 phút',bold:true,fill:'EDF4FB'},wrPct(sd.shortPct),{text:'Data đổ mới',bold:true,fill:'EDF4FB'},wrInt(inc.total)]
    ],[3000,2500,3000,2500],{fontSize:18,headerSize:16});

    body += wrDocxHeading('II. TIẾN ĐỘ KPI NHÂN SỰ VÀ TEAM');
    body += wrDocxBullet(`KPI tổng team đạt ${wrPct(k.totalTeam)}; Active ${wrPct(k.activeTeam)}; Addon ${wrPct(k.addonTeam)}; Impact ${wrPct(k.impactTeam)}.`);
    if(k.topActive[0]) body += wrDocxBullet(`${k.topActive[0].name} có tiến độ Active cao nhất ${wrPct(k.topActive[0].active)}.`);
    if(k.topTotal[0]) body += wrDocxBullet(`${k.topTotal[0].name} dẫn đầu KPI Tổng ${wrPct(k.topTotal[0].total)}.`);
    const kpiHeaders=['TÊN SC','LEVEL','ĐÃ LÀM','ACT IMPACT','% IMPACT','KPI ACTIVE','ACTIVE','% KPI ACTIVE','KPI ĐIỂM','TỔNG ĐIỂM','% ĐIỂM TỔNG','KPI ADDON','ĐIỂM ADDON','% ĐIỂM ADDON','% KPI TỔNG'];
    const kpiRows=k.rows.map(r=>[
        {text:r.name,name:true,bold:true},r.level||'-',wrInt(r.done),wrInt(r.actImpact),wrDocxPctCell(r.impact),wrInt(r.kpiActive),wrInt(r.activeCount),wrDocxPctCell(r.active),wrInt(r.kpiPoint),wrInt(r.totalPoint),wrDocxPctCell(r.point),wrInt(r.kpiAddon),wrInt(r.addonPoint),wrDocxPctCell(r.addon),wrDocxPctCell(r.total)
    ]);
    kpiRows.push([{text:'Tổng cộng / Trung bình',name:true,bold:true,fill:'E2E8F0'},'-',{text:wrInt(k.totalDone),bold:true,fill:'E2E8F0'},'-',{text:wrPct(k.impactTeam),bold:true,fill:'E2E8F0'},'-','-',{text:wrPct(k.activeTeam),bold:true,fill:'E2E8F0'},'-','-',{text:wrPct(k.pointTeam),bold:true,fill:'E2E8F0'},'-','-',{text:wrPct(k.addonTeam),bold:true,fill:'E2E8F0'},{text:wrPct(k.totalTeam),bold:true,fill:'E2E8F0'}]);
    body += wrDocxTable(kpiHeaders,kpiRows,[2400,550,850,850,900,850,700,950,850,850,950,850,850,950,900],{fontSize:12,headerSize:11});

    body += wrDocxHeading('III. NĂNG SUẤT LÀM VIỆC CỦA NHÂN SỰ');
    body += wrDocxBullet(`ATC trung bình toàn team đạt ${wrNumber(p.avgATC)} ATC/ngày.`);
    body += wrDocxBullet(`Thời gian hỗ trợ TB đạt ${wrNumber(p.avgHours)} giờ/ngày; quãng đường TB ${wrNumber(p.avgKM)} km/ngày.`);
    const perfRows=p.rows.map((r,i)=>[i+1,{text:r.name,name:true,bold:true},wrNumber(r.tCong,1),wrInt(r.totalATC),wrInt(r.totalImpact),wrNumber(r.totalKM),wrNumber(r.totalHours),wrNumber(r.avgATC),wrNumber(r.avgKM),wrNumber(r.avgHours)]);
    perfRows.push(['',{text:'Trung bình',name:true,bold:true,fill:'E2E8F0'},'','-','-','-','-',{text:wrNumber(p.avgATC),bold:true,fill:'E2E8F0'},{text:wrNumber(p.avgKM),bold:true,fill:'E2E8F0'},{text:wrNumber(p.avgHours),bold:true,fill:'E2E8F0'}]);
    body += wrDocxTable(['STT','Tên NS','T công','Tổng ATC','Tổng Impact','Tổng KM','TỔNG GIỜ SP','TB ATC/Ngày','TB KM/Ngày','TB Time/Ngày'],perfRows,[550,2800,900,1100,1100,1200,1300,1300,1300,1300],{fontSize:14,headerSize:13});

    body += wrDocxHeading('IV. TÌNH HÌNH DATA TỒN VÀ DATA ĐỔ MỚI');
    body += wrDocxP('1. Data treo theo khu vực và data đang nằm trên nhân sự',{bold:true,color:'2F5597',size:20,after:60});
    body += wrDocxBullet(`Data treo khu vực ${wrInt(b.queueTotal)}; data đang nằm trên nhân sự ${wrInt(b.assignedTotal)}; tổng tồn ${wrInt(b.total)}.`);
    body += wrDocxTable(['TỈNH/THÀNH PHỐ','SL CÒN TREO'],[...b.provinces.map(([n,c])=>[{text:n,name:true},wrInt(c)]),[{text:'Grand Total',name:true,bold:true,fill:'E2E8F0'},{text:wrInt(b.queueTotal),bold:true,fill:'E2E8F0'}]],[7000,3000],{fontSize:17,headerSize:16});
    body += wrDocxTable(['NHÂN SỰ','ATC ĐANG GIỮ'],[...b.staff.map(([n,c])=>[{text:n,name:true},wrInt(c)]),[{text:'Grand Total',name:true,bold:true,fill:'E2E8F0'},{text:wrInt(b.assignedTotal),bold:true,fill:'E2E8F0'}]],[7000,3000],{fontSize:17,headerSize:16});
    body += wrDocxP('2. Số lượng data đổ theo ngày và theo tỉnh',{bold:true,color:'2F5597',size:20,after:60});
    const incKeys = Array.isArray(inc?.dayKeys) ? inc.dayKeys : [];
    const incProvs = Array.isArray(inc?.provinces) ? inc.provinces : [];
    const incTotals = inc?.dayTotals || {};
    if (incKeys.length) {
        const incomingHeaders=['TỈNH/THÀNH PHỐ',...incKeys.map(String),'TRUNG BÌNH','GRAND TOTAL'];
        const incomingRows=incProvs.map(r=>[{text:r.name,name:true},...incKeys.map(d=>r.days[d]||''),r.avg?wrNumber(r.avg):'',r.total?wrInt(r.total):'']);
        incomingRows.push([{text:'Grand Total',name:true,bold:true,fill:'E2E8F0'},...incKeys.map(d=>incTotals[d]?wrInt(incTotals[d]):''),{text:inc.avg?wrNumber(inc.avg):'',bold:true,fill:'E2E8F0'},{text:inc.total?wrInt(inc.total):'',bold:true,fill:'E2E8F0'}]);
        const incomingWidths=[2200,...incKeys.map(()=>Math.max(480,Math.floor(11200/Math.max(1,incKeys.length+2)))),1100,1200];
        body += wrDocxTable(incomingHeaders,incomingRows,incomingWidths,{fontSize:11,headerSize:10});
    }

    body += wrDocxHeading('V. KIỂM SOÁT ATC NHÂN SỰ TỰ TẠO');
    body += wrDocxBullet(`Tổng ${wrInt(sc.total)} ATC, trong đó ${wrInt(sc.self)} ATC tự tạo, tương đương ${wrPct(sc.pct,1)}.`);
    const selfRows=sc.rows.map(r=>[{text:r.name,name:true,bold:true},wrInt(r.total),wrInt(r.self),{text:wrPct(r.pct,1),fill:r.pct>50?'FEE2E2':r.pct>20?'FEF3C7':'D1FAE5',color:r.pct>50?'B91C1C':r.pct>20?'B45309':'047857',bold:true},r.pct>50?'Nghi vấn':r.pct>20?'Cần để ý':'Bình thường']);
    body += wrDocxTable(['SC','TỔNG ATC','TỰ TẠO','% TỰ TẠO','ĐÁNH GIÁ'],selfRows,[4800,1800,1800,1800,2400],{fontSize:16,headerSize:15});

    body += wrDocxHeading('VI. THỜI LƯỢNG HỖ TRỢ KHÁCH HÀNG');
    body += wrDocxBullet(`Nhóm 0-5 phút có ${wrInt(sd.shortCount)}/${wrInt(sd.total)} case, chiếm ${wrPct(sd.shortPct)}.`);
    if (Array.isArray(sd?.bucketLabels) && Array.isArray(sd?.staffRows) && sd.bucketLabels.length) {
        const durationHeaders=['NHÂN SỰ',...sd.bucketLabels,'TOTAL'];
        const durationRows=sd.staffRows.map(r=>[{text:r.name,name:true,bold:true},...r.counts.map((c,i)=>`${c}/${wrPct(r.pcts[i]||0)}`),`${r.total} ca`]);
        durationRows.push([{text:'Total',name:true,bold:true,fill:'E2E8F0'},...sd.bucketTotals.map((c,i)=>({text:`${c}/${wrPct(sd.bucketPcts[i]||0)}`,bold:true,fill:'E2E8F0'})),{text:`${sd.total} ca`,bold:true,fill:'E2E8F0'}]);
        body += wrDocxTable(durationHeaders,durationRows,[2500,...sd.bucketLabels.map(()=>1350),1500],{fontSize:12,headerSize:11});
    }

    const addressTotal=Number(document.getElementById('wrAddressTotal')?.value)||0, addressDone=Number(document.getElementById('wrAddressDone')?.value)||0;
    let docxSecNum = 7;
    if(addressTotal>0){ body += wrDocxHeading(`${wrToRoman(docxSecNum++)}. KIỂM SOÁT CẬP NHẬT THÔNG TIN GIAN HÀNG`); body += wrDocxP(`Ghi nhận ${addressTotal} case đổi thông tin/địa chỉ; ${addressDone}/${addressTotal} case đã cập nhật OTP, đạt ${wrPct(addressTotal?addressDone/addressTotal*100:0)}.`,{size:18}); }
    if(manual.appFnb){ body += wrDocxHeading(`${wrToRoman(docxSecNum++)}. VẤN ĐỀ CÀI APP THU NGÂN - NHÓM F&B`); wrLinesToList(manual.appFnb).forEach(x=>body+=wrDocxBullet(x)); }
    if(manual.issues){ body += wrDocxHeading(`${wrToRoman(docxSecNum++)}. VẤN ĐỀ NỔI BẬT / CẦN THEO SÁT`); wrLinesToList(manual.issues).forEach(x=>body+=wrDocxBullet(x)); }
    if(manual.extra){ body += wrDocxHeading(`${wrToRoman(docxSecNum++)}. NỘI DUNG BỔ SUNG`); wrLinesToList(manual.extra).forEach(x=>body+=wrDocxBullet(x)); }
    if(Array.isArray(manual.customSections) && manual.customSections.length){
        manual.customSections.forEach(sec => {
            if(!sec.title && !sec.contentHtml) return;
            const secTitle = sec.title ? sec.title.toUpperCase() : 'NỘI DUNG TÙY CHỈNH';
            body += wrDocxHeading(`${wrToRoman(docxSecNum++)}. ${secTitle}`);
            if(sec.contentHtml){
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = sec.contentHtml;
                Array.from(tempDiv.children).forEach(node => {
                    const tag = node.tagName.toLowerCase();
                    if(tag === 'table'){
                        const thCells = Array.from(node.querySelectorAll('thead th, tr:first-child th')).map(th => {
                            const text = th.innerText.trim();
                            let fill = 'D9EAF7';
                            let color = '17365D';
                            if (th.style.backgroundColor) fill = wrColorToHex(th.style.backgroundColor, fill);
                            if (th.style.color) color = wrColorToHex(th.style.color, color);
                            return { text, fill, color, bold: true, align: 'center' };
                        });
                        const trEls = Array.from(node.querySelectorAll('tbody tr, tr')).filter(tr=>!tr.querySelector('th'));
                        const headers = thCells.length ? thCells : (node.querySelector('tr:first-child') ? Array.from(node.querySelectorAll('tr:first-child td')).map(td=>td.innerText.trim()) : []);
                        const bodyRows = (thCells.length ? trEls : trEls.slice(1)).map(tr => Array.from(tr.querySelectorAll('td')).map(td => {
                            let fill = 'FFFFFF';
                            let color = '172033';
                            if (td.style.backgroundColor) fill = wrColorToHex(td.style.backgroundColor, fill);
                            else if (tr.style.backgroundColor) fill = wrColorToHex(tr.style.backgroundColor, fill);
                            if (td.style.color) color = wrColorToHex(td.style.color, color);
                            return { text: td.innerText.trim(), fill, color };
                        }));
                        if(headers.length || bodyRows.length){
                            const colCount = Math.max(1, headers.length || (bodyRows[0] ? bodyRows[0].length : 1));
                            const widthPerCol = Math.floor(14000 / colCount);
                            const widths = (headers.length ? headers : (bodyRows[0]||[])).map(()=>widthPerCol);
                            body += wrDocxTable(headers.length ? headers : bodyRows[0].map(()=>'-'), bodyRows, widths, {fontSize:14, headerSize:14});
                        }
                    } else if(tag === 'ul' || tag === 'ol'){
                        Array.from(node.querySelectorAll('li')).forEach((li, idx)=>{
                            const bulletPrefix = tag === 'ol' ? `${idx+1}. ` : '';
                            body += wrDocxBullet(bulletPrefix + li.innerText.trim());
                        });
                    } else if(tag === 'p' || tag === 'div'){
                        const txt = node.innerText.trim();
                        if(txt) body += wrDocxP(txt, {size:18, after:60});
                    } else if(/^h[1-6]$/.test(tag)){
                        body += wrDocxP(node.innerText.trim(), {bold:true, color:'2F5597', size:20, after:60});
                    } else if(tag === 'img'){
                        body += wrDocxP(`[Hình ảnh: ${node.alt || 'Ảnh minh họa'}]`, {italic:true, color:'666666', size:16, after:60});
                    }
                });
                if(!tempDiv.children.length && tempDiv.innerText.trim()){
                    wrLinesToList(tempDiv.innerText).forEach(line=>{ body += wrDocxP(line, {size:18, after:60}); });
                }
            }
        });
    }
    if(manual.plans){ body += wrDocxHeading(`${wrToRoman(docxSecNum++)}. KẾ HOẠCH TRỌNG TÂM TUẦN TIẾP THEO`); wrLinesToList(manual.plans).forEach((x,i)=>body+=wrDocxP(`${i+1}. ${x.replace(/^[-•\d.)\s]+/,'')}`,{size:18,after:45})); }
    body += wrDocxP(`Báo cáo được tổng hợp tự động từ CRM Dashboard • ${new Date().toLocaleString('vi-VN')}`,{color:'777777',size:14,align:'center',before:140,after:0});

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="500" w:right="500" w:bottom="500" w:left="500" w:header="300" w:footer="300" w:gutter="0"/></w:sectPr></w:body></w:document>`;
}
function wrCrc32(bytes) {
    if(!wrCrc32.table){ const table=[]; for(let n=0;n<256;n++){let c=n; for(let k=0;k<8;k++) c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1); table[n]=c>>>0;} wrCrc32.table=table; }
    let crc=0xFFFFFFFF; for(const b of bytes) crc=wrCrc32.table[(crc^b)&0xFF]^(crc>>>8); return (crc^0xFFFFFFFF)>>>0;
}
function wrU16(v){const a=new Uint8Array(2),d=new DataView(a.buffer);d.setUint16(0,v,true);return a} function wrU32(v){const a=new Uint8Array(4),d=new DataView(a.buffer);d.setUint32(0,v>>>0,true);return a}
function wrConcat(parts){let n=parts.reduce((s,p)=>s+p.length,0),o=new Uint8Array(n),pos=0;parts.forEach(p=>{o.set(p,pos);pos+=p.length});return o}
function wrZipStore(files) {
    const enc=new TextEncoder(), locals=[], centrals=[]; let offset=0;
    const now=new Date(), dosTime=((now.getHours()&31)<<11)|((now.getMinutes()&63)<<5)|((Math.floor(now.getSeconds()/2))&31), dosDate=(((now.getFullYear()-1980)&127)<<9)|(((now.getMonth()+1)&15)<<5)|(now.getDate()&31);
    files.forEach(f=>{const name=enc.encode(f.name),data=typeof f.data==='string'?enc.encode(f.data):f.data,crc=wrCrc32(data),flag=0x0800;
        const lh=wrConcat([wrU32(0x04034b50),wrU16(20),wrU16(flag),wrU16(0),wrU16(dosTime),wrU16(dosDate),wrU32(crc),wrU32(data.length),wrU32(data.length),wrU16(name.length),wrU16(0),name,data]); locals.push(lh);
        const ch=wrConcat([wrU32(0x02014b50),wrU16(20),wrU16(20),wrU16(flag),wrU16(0),wrU16(dosTime),wrU16(dosDate),wrU32(crc),wrU32(data.length),wrU32(data.length),wrU16(name.length),wrU16(0),wrU16(0),wrU16(0),wrU16(0),wrU32(0),wrU32(offset),name]); centrals.push(ch); offset+=lh.length;
    });
    const central=wrConcat(centrals),local=wrConcat(locals),end=wrConcat([wrU32(0x06054b50),wrU16(0),wrU16(0),wrU16(files.length),wrU16(files.length),wrU32(central.length),wrU32(local.length),wrU16(0)]); return wrConcat([local,central,end]);
}
function downloadWeeklyReportWord() {
    const state=window.weeklyReportState; if(!state||!state.metrics){alert('⚠️ Hãy tạo báo cáo trước.');return;}
    try{
        const documentXml=wrDocxBuildDocumentXml(state);
        const files=[
            {name:'[Content_Types].xml',data:`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`},
            {name:'_rels/.rels',data:`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`},
            {name:'word/document.xml',data:documentXml},
            {name:'word/styles.xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial"/><w:sz w:val="18"/></w:rPr></w:style></w:styles>`},
            {name:'word/_rels/document.xml.rels',data:`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`},
            {name:'docProps/core.xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Báo cáo tuần SC</dc:title><dc:creator>CRM Dashboard</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>`},
            {name:'docProps/app.xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>CRM Dashboard</Application></Properties>`}
        ];
        const zip=wrZipStore(files); const blob=new Blob([zip],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
        const fromVal = document.getElementById('wrFromDate')?.value || '';
        const toVal = document.getElementById('wrToDate')?.value || '';
        const fileSuffix = (fromVal && toVal) ? `${fromVal}_den_${toVal}` : (toVal || 'SC');
        wrDownloadBlob(blob,`Bao_cao_tuan_SC_${fileSuffix}.docx`);
    }catch(err){console.error(err);alert('❌ Không xuất được Word: '+(err.message||err));}
}

function printWeeklyReport() {
    const state = window.weeklyReportState;
    if (!state || !state.html) { alert('⚠️ Hãy tạo báo cáo trước.'); return; }
    const win = window.open('', '_blank');
    if (!win) { alert('Trình duyệt đang chặn cửa sổ mới.'); return; }
    const styles = document.getElementById('weeklyReportExportStyles')?.textContent || '';
    const doc = document.getElementById('weeklyReportDocument');
    let htmlContent = state.html;
    if (doc) {
        const clone = doc.cloneNode(true);
        clone.removeAttribute('contenteditable');
        clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
        htmlContent = clone.outerHTML;
    }
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Báo cáo tuần</title><style>${styles}</style></head><body>${htmlContent}<script>window.onload=()=>window.print()<\/script></body></html>`);
    win.document.close();
}

function wrDownloadBlob(blob, filename) {
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function resetWeeklyReportManual() {
    if (!confirm('Xóa toàn bộ ghi chú và các mục tùy chỉnh của phần báo cáo?')) return;
    localStorage.removeItem(WEEKLY_REPORT_MANUAL_KEY);
    const ids = ['wrAddressTotal', 'wrAddressDone', 'wrAppFnb', 'wrIssues', 'wrExtra'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const plan = document.getElementById('wrPlans');
    if (plan) plan.value = wrDefaultPlans();
    const container = document.getElementById('wrCustomSectionsContainer');
    if (container) container.innerHTML = '';
}

function wrDefaultPlans() {
    return `Duy trì KPI team đạt tối thiểu 100% cuối tháng và kiểm soát tiến độ theo từng tuần.\nDuy trì năng suất tối thiểu 8 ATC/ngày; ghi nhận khó khăn của nhân sự có sản lượng hoặc thời gian hỗ trợ thấp.\nCải thiện Impact của các nhân sự thấp thông qua kiểm tra case không phát sinh Impact và coaching trực tiếp.\nƯu tiên clear data đang nằm trên nhân sự và các khu vực còn tồn cao.\nTiếp tục kiểm soát tỷ lệ ATC tự tạo, đặc biệt các trường hợp trên 20%.\nƯu tiên phản hồi các case ảnh hưởng trực tiếp đến vận hành gian hàng lớn.`;
}

function initWeeklyReportTab() {
    const from = document.getElementById('wrFromDate');
    const to = document.getElementById('wrToDate');
    if (!from || !to) return;

    if (!from.value || !to.value) {
        const now = new Date();
        const first = new Date(now.getFullYear(), now.getMonth(), 1);
        from.value = wrFormatDateInput(first);
        to.value = wrFormatDateInput(now);
    }

    const manual = wrLoadManual();
    const setVal = (id, val) => { const el = document.getElementById(id); if (el && !el.value) el.value = val || ''; };
    setVal('wrAddressTotal', manual.addressTotal);
    setVal('wrAddressDone', manual.addressDone);
    setVal('wrAppFnb', manual.appFnb);
    setVal('wrIssues', manual.issues);
    setVal('wrExtra', manual.extra);
    setVal('wrPlans', manual.plans || wrDefaultPlans());
    setVal('wrDocTitle', manual.docTitle || 'BÁO CÁO CHẤT LƯỢNG CUSTOMER SUCCESS (SC)');
    setVal('wrRecipient', manual.recipient || 'anh Nguyễn Dũng Hải - SDM DVKH (Dịch Vụ Khách Hàng)');
    ['wrDocTitle', 'wrRecipient'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.dataset.wrBound) {
            el.addEventListener('change', wrSaveManual);
            el.dataset.wrBound = '1';
        }
    });

    ['wrAddressTotal','wrAddressDone','wrAppFnb','wrIssues','wrExtra','wrPlans'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.dataset.wrBound) {
            el.addEventListener('change', wrSaveManual);
            el.dataset.wrBound = '1';
        }
    });

    const customContainer = document.getElementById('wrCustomSectionsContainer');
    if (customContainer) {
        customContainer.innerHTML = '';
        if (Array.isArray(manual.customSections) && manual.customSections.length) {
            manual.customSections.forEach(sec => addWeeklyReportCustomSection(sec));
        }
    }

    const preview = document.getElementById('weeklyReportPreview');
    if (preview && window.weeklyReportState && window.weeklyReportState.html) {
        if (!document.getElementById('weeklyReportDocument')) {
            preview.innerHTML = window.weeklyReportState.html;
        }
        wrInitDirectEditing();
    }

    renderWeeklyReportSnapshotInfo();
}


function initBaoCaoTab() {
    initWeeklyReportTab();
}
