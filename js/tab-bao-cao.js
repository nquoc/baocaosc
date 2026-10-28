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
    const rows = p.rows;
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
    const heads=['TỈNH/THÀNH PHỐ',...inc.dayKeys.map(String),'TRUNG BÌNH','GRAND TOTAL'];
    const rows=inc.provinces.map(r=>`<tr><td class="wr-name">${wrEscapeHtml(r.name)}</td>${inc.dayKeys.map(d=>`<td>${r.days[d]||''}</td>`).join('')}<td class="wr-incoming-avg">${r.avg?wrNumber(r.avg):''}</td><td class="wr-strong">${r.total?wrInt(r.total):''}</td></tr>`).join('');
    const total=`<tr class="wr-native-total"><td class="wr-name">Grand Total</td>${inc.dayKeys.map(d=>`<td>${inc.dayTotals[d]?wrInt(inc.dayTotals[d]):''}</td>`).join('')}<td class="wr-total-accent">${inc.avg?wrNumber(inc.avg):''}</td><td>${inc.total?wrInt(inc.total):''}</td></tr>`;
    return wrNativeTableShell('', `<table class="wr-native-table wr-incoming-native"><thead><tr>${heads.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}${total}</tbody></table>`);
}

function wrRenderSelfCreatedDashboardTable(sc) {
    const body=sc.rows.map(r=>{
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
    const body=sd.staffRows.map(r=>`<tr><td class="wr-name">${wrEscapeHtml(r.name)}</td>${r.counts.map(c=>{const pct=r.total?c/r.total*100:0;return `<td class="${wrDurationTierStyle(pct)}">${c?`${c}/${wrPct(pct)}`:''}</td>`}).join('')}<td class="wr-strong">${r.total} ca / 100.00%</td></tr>`).join('');
    const total=`<tr class="wr-native-total"><td class="wr-name">Total</td>${sd.counts.map(c=>{const pct=sd.total?c/sd.total*100:0;return `<td>${c?`${c}/${wrPct(pct)}`:''}</td>`}).join('')}<td class="wr-total-accent">${sd.total} ca / 100.00%</td></tr>`;
    const heads=['LAST_NAME',...sd.buckets.map(b=>b.label),'TOTAL'];
    const legend=`<div class="wr-duration-legend"><b>Phân cấp màu tỷ trọng:</b> <span class="wr-duration-chip wr-duration-low">Ít nhất (&lt;20%)</span><span class="wr-duration-chip wr-duration-mid">Bình thường (20%-50%)</span><span class="wr-duration-chip wr-duration-high">Cao nhất (&gt;50%)</span></div>`;
    return wrNativeTableShell('⏱️ Tỷ trọng ATC theo thời gian hỗ trợ của nhân sự', `${legend}<table class="wr-native-table wr-duration-native"><thead><tr>${heads.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${body}${total}</tbody></table>`);
}

function wrBuildReportHtml(metrics, fromDate, toDate, previousSnapshot, manual) {
    const k = metrics.kpi;
    const p = metrics.performance;
    const b = metrics.backlog;
    const inc = metrics.incoming;
    const sc = metrics.selfCreated;
    const sd = metrics.supportDuration;
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

    const focus = [];
    if (k.worst.length) focus.push(`Theo sát KPI của ${k.worst.map(r => `${wrEscapeHtml(r.name)} (${wrPct(r.total)})`).join(' và ')}.`);
    const highSelf = sc.rows.filter(r => r.pct > 20);
    if (highSelf.length) focus.push(`Kiểm tra ATC tự tạo cao: ${highSelf.slice(0, 3).map(r => `${wrEscapeHtml(r.name)} ${wrPct(r.pct, 1)}`).join(', ')}.`);
    if (b.staff.length) focus.push(`Ưu tiên clear ATC đang giữ của ${b.staff.slice(0, 3).map(r => `${wrEscapeHtml(r[0])} (${wrInt(r[1])})`).join(', ')}.`);
    if (sd.shortPct < 10) focus.push(`Tỷ lệ hỗ trợ 0-5 phút ${wrPct(sd.shortPct)} đang dưới ngưỡng kiểm soát 10%.`);

    const summaryCards = [
        ['KPI tổng team', wrPct(k.totalTeam)], ['Impact team', wrPct(k.impactTeam)],
        ['ATC TB/ngày', wrNumber(p.avgATC)], ['Thời gian HT TB', `${wrNumber(p.avgHours)} giờ`],
        ['Data treo & tồn', wrInt(b.total)], ['ATC tự tạo', wrPct(sc.pct, 1)],
        ['ATC 0-5 phút', wrPct(sd.shortPct)], ['Data đổ mới', wrInt(inc.total)]
    ];

    const kpiRows = k.rows.map(r => [
        wrEscapeHtml(r.name), wrPct(r.impact), wrPct(r.active), wrPct(r.addon), `<b>${wrPct(r.total)}</b>`
    ]);

    const perfRows = p.rows.map(r => [
        wrEscapeHtml(r.name), wrNumber(r.tCong, 1), wrInt(r.totalATC), wrNumber(r.avgATC), wrNumber(r.avgKM), wrNumber(r.avgHours)
    ]);

    const backlogProvRows = b.provinces.slice(0, 10).map(([name, count]) => [wrEscapeHtml(name), wrInt(count)]);
    const backlogStaffRows = b.staff.slice(0, 10).map(([name, count]) => [wrEscapeHtml(name), wrInt(count)]);
    const incomingRows = inc.provinces.map(r => [wrEscapeHtml(r.name), wrInt(r.total), wrNumber(r.avg)]);
    const selfRows = sc.rows.map(r => [wrEscapeHtml(r.name), wrInt(r.total), wrInt(r.self), wrPct(r.pct, 1)]);
    const supportRows = sd.rows.map(r => [wrEscapeHtml(r.label), wrInt(r.count), wrPct(r.pct)]);

    const addressTotal = Number(manual.addressTotal) || 0;
    const addressDone = Number(manual.addressDone) || 0;

    return `
    <article class="wr-document" id="weeklyReportDocument">
        ${(() => {
        const docTitle = document.getElementById('wrDocTitle')?.value?.trim() || 'BÁO CÁO CHẤT LƯỢNG CUSTOMER SUCCESS (SC)';
        const recipient = document.getElementById('wrRecipient')?.value?.trim() || 'anh Nguyễn Dũng Hải - SDM DVKH (Dịch Vụ Khách Hàng)';
        return `
        <div class="wr-doc-title">${wrEscapeHtml(docTitle)}</div>
        <div class="wr-doc-subtitle" style="font-size: 13px; margin: 4px 0 16px;">
            <div style="font-weight: 700; color: #1d4ed8; margin-bottom: 4px;">Kính gửi: ${wrEscapeHtml(recipient)}</div>
            <div>Dữ liệu: ${periodLabel} • KPI tháng kết thúc ngày ${kpiDaysInMonth}/${wrPad2(toDate.getMonth() + 1)}/${toDate.getFullYear()}</div>
        </div>
        `;
    })()}

        <section>
            <h2>I. TÓM TẮT ĐIỀU HÀNH</h2>
            <p>Giai đoạn đến hết ngày <b>${wrFormatVNDate(toDate)}</b>, KPI tổng team đạt <b>${wrPct(k.totalTeam)}</b>; năng suất đạt <b>${wrNumber(p.avgATC)} ATC/ngày</b>; Impact toàn team đạt <b>${wrPct(k.impactTeam)}</b>. Data treo và tồn hiện tại là <b>${wrInt(b.total)}</b>; tỷ lệ ATC tự tạo ở mức <b>${wrPct(sc.pct, 1)}</b>; tỷ lệ hỗ trợ 0-5 phút là <b>${wrPct(sd.shortPct)}</b>.</p>
            ${trendLines.length ? `<p><b>So với mốc trước:</b> ${trendLines.join(' ')}</p>` : '<p class="wr-note">Chưa có mốc tuần trước trong trình duyệt. Sau khi chốt báo cáo, bấm “Lưu mốc tuần” để tuần sau tự so sánh.</p>'}
            ${focus.length ? `<p><b>Trọng tâm cần theo sát:</b> ${focus.join(' ')}</p>` : ''}
            ${wrTable(['Chỉ số', 'Kết quả', 'Chỉ số', 'Kết quả'], [
                [summaryCards[0][0], `<b>${summaryCards[0][1]}</b>`, summaryCards[1][0], `<b>${summaryCards[1][1]}</b>`],
                [summaryCards[2][0], `<b>${summaryCards[2][1]}</b>`, summaryCards[3][0], `<b>${summaryCards[3][1]}</b>`],
                [summaryCards[4][0], `<b>${summaryCards[4][1]}</b>`, summaryCards[5][0], `<b>${summaryCards[5][1]}</b>`],
                [summaryCards[6][0], `<b>${summaryCards[6][1]}</b>`, summaryCards[7][0], `<b>${summaryCards[7][1]}</b>`]
            ], 'wr-summary-table')}
        </section>

        <section>
            <h2>II. TIẾN ĐỘ KPI NHÂN SỰ VÀ TEAM</h2>
            ${wrBullets([
                `KPI tổng team đạt <b>${wrPct(k.totalTeam)}</b>; Active đạt <b>${wrPct(k.activeTeam)}</b>; Addon đạt <b>${wrPct(k.addonTeam)}</b>; Impact team đạt <b>${wrPct(k.impactTeam)}</b>.`,
                k.topActive[0] ? `${wrEscapeHtml(k.topActive[0].name)} đang có tiến độ Active cao nhất: <b>${wrPct(k.topActive[0].active)}</b>.` : '',
                k.achievedAddon.length ? `Nhân sự đạt/vượt KPI Addon: ${k.achievedAddon.map(r => `${wrEscapeHtml(r.name)} <b>${wrPct(r.addon)}</b>`).join(', ')}.` : (k.topAddon[0] ? `Addon cao nhất hiện tại: ${wrEscapeHtml(k.topAddon[0].name)} <b>${wrPct(k.topAddon[0].addon)}</b>.` : ''),
                k.topTotal[0] ? `${wrEscapeHtml(k.topTotal[0].name)} dẫn đầu KPI Tổng với <b>${wrPct(k.topTotal[0].total)}</b>.` : '',
                k.worst.length ? `Cần theo sát: ${k.worst.map(r => `${wrEscapeHtml(r.name)} KPI Tổng <b>${wrPct(r.total)}</b>`).join('; ')}.` : ''
            ])}
            ${wrRenderKpiDashboardTable(k)}
        </section>

        <section>
            <h2>III. NĂNG SUẤT LÀM VIỆC CỦA NHÂN SỰ</h2>
            ${wrBullets([
                `ATC trung bình toàn team đạt <b>${wrNumber(p.avgATC)} ATC/ngày</b>${p.avgATC >= 8 ? ', duy trì trên mục tiêu tối thiểu 8 ATC/ngày' : ', đang dưới mục tiêu 8 ATC/ngày'}.`,
                p.highATC.length ? `Sản lượng cao: ${p.highATC.map(r => `${wrEscapeHtml(r.name)} <b>${wrNumber(r.avgATC)}</b>`).join(', ')} ATC/ngày.` : '',
                p.lowATC.length ? `Nhóm thấp cần theo dõi: ${p.lowATC.map(r => `${wrEscapeHtml(r.name)} <b>${wrNumber(r.avgATC)}</b>`).join(', ')} ATC/ngày.` : '',
                `Thời gian hỗ trợ TB đạt <b>${wrNumber(p.avgHours)} giờ/ngày</b>.`,
                p.under4.length ? `Dưới 4 giờ/ngày: ${p.under4.map(r => `${wrEscapeHtml(r.name)} <b>${wrNumber(r.avgHours)}h</b>`).join(', ')}.` : 'Không có nhân sự dưới 4 giờ hỗ trợ/ngày.',
                `Quãng đường TB đạt <b>${wrNumber(p.avgKM)} km/ngày</b>.`
            ])}
            ${wrRenderPerformanceDashboardTable(p)}
        </section>

        <section>
            <h2>IV. TÌNH HÌNH DATA TỒN VÀ DATA ĐỔ MỚI</h2>
            <h3>1. Data treo theo khu vực và data đang nằm trên nhân sự</h3>
            ${wrBullets([
                `Data treo chưa phân/queue theo khu vực: <b>${wrInt(b.queueTotal)}</b>.`,
                `ATC/data đang nằm trên nhân sự: <b>${wrInt(b.assignedTotal)}</b>.`,
                `Tổng data treo và tồn đọng hiện tại: <b>${wrInt(b.total)}</b>.`,
                b.total ? `Tỷ trọng data đang nằm trên nhân sự: <b>${wrPct(b.assignedTotal / b.total * 100)}</b>.` : '',
                b.overdue ? `Có <b>${wrInt(b.overdue)}</b> case SLA ≥ 9 cần theo dõi.` : 'Không ghi nhận case SLA ≥ 9 trong dữ liệu hiện tại.'
            ])}
            ${wrRenderBacklogDashboardTables(b)}
            <h3>2. Số lượng data đổ theo ngày và theo tỉnh</h3>
            ${wrBullets([
                `Tổng data đổ mới trong kỳ: <b>${wrInt(inc.total)}</b>, trung bình <b>${wrNumber(inc.avg)} data/ngày</b>.`,
                (inc.rankedProvinces || inc.provinces).length ? `Data tập trung nhiều tại ${(inc.rankedProvinces || inc.provinces).slice(0, 4).map(r => `${wrEscapeHtml(r.name)} ${wrInt(r.total)}`).join(', ')}.` : ''
            ])}
            ${wrRenderIncomingDashboardTable(inc)}
        </section>

        <section>
            <h2>V. KIỂM SOÁT ATC NHÂN SỰ TỰ TẠO</h2>
            ${wrBullets([
                `Tổng <b>${wrInt(sc.total)}</b> ATC, trong đó <b>${wrInt(sc.self)}</b> ATC tự tạo, tương đương <b>${wrPct(sc.pct, 1)}</b> toàn team.`,
                sc.rows[0] ? `Tỷ lệ cao nhất: ${wrEscapeHtml(sc.rows[0].name)} <b>${wrPct(sc.rows[0].pct, 1)}</b>.` : '',
                prev ? `So với mốc trước ${wrPct(prev.selfPct, 1)}, hiện tại ${wrMetricDiff(sc.pct, prev.selfPct, ' điểm %', 1, true)}.` : ''
            ])}
            ${wrRenderSelfCreatedDashboardTable(sc)}
        </section>

        <section>
            <h2>VI. THỜI LƯỢNG HỖ TRỢ KHÁCH HÀNG</h2>
            ${wrBullets([
                `Nhóm hỗ trợ 0-5 phút có <b>${wrInt(sd.shortCount)}/${wrInt(sd.total)}</b> case, chiếm <b>${wrPct(sd.shortPct)}</b>${sd.shortPct < 10 ? ', thấp hơn ngưỡng kiểm soát 10%' : ', vượt ngưỡng kiểm soát 10%'}.`,
                sd.shortPct < 10 ? 'Chưa ghi nhận dấu hiệu bất thường ở cấp team; tiếp tục kiểm soát theo từng nhân sự.' : 'Cần kiểm tra chi tiết các case dưới 5 phút theo nhân sự và nội dung hỗ trợ.'
            ])}
            ${wrRenderDurationDashboardTable(sd)}
        </section>

        ${(() => {
            let secNum = 7;
            let extraSections = '';
            if (addressTotal > 0) {
                extraSections += `
        <section>
            <h2>${wrToRoman(secNum++)}. KIỂM SOÁT CẬP NHẬT THÔNG TIN GIAN HÀNG</h2>
            <p>Ghi nhận <b>${wrInt(addressTotal)}</b> case có công việc đổi thông tin/địa chỉ gian hàng; <b>${wrInt(addressDone)}/${wrInt(addressTotal)}</b> case đã cập nhật trên OTP, đạt <b>${wrPct(addressTotal ? addressDone / addressTotal * 100 : 0)}</b>.</p>
        </section>`;
            }
            if (manual.appFnb) {
                extraSections += `
        <section>
            <h2>${wrToRoman(secNum++)}. VẤN ĐỀ CÀI APP THU NGÂN - NHÓM F&amp;B</h2>
            ${wrBullets(wrLinesToList(manual.appFnb).map(wrEscapeHtml))}
        </section>`;
            }
            if (manual.issues) {
                extraSections += `
        <section>
            <h2>${wrToRoman(secNum++)}. VẤN ĐỀ NỔI BẬT / CẦN THEO SÁT</h2>
            ${wrBullets(wrLinesToList(manual.issues).map(wrEscapeHtml))}
        </section>`;
            }
            if (manual.extra) {
                extraSections += `
        <section>
            <h2>${wrToRoman(secNum++)}. NỘI DUNG BỔ SUNG</h2>
            ${wrBullets(wrLinesToList(manual.extra).map(wrEscapeHtml))}
        </section>`;
            }
            if (Array.isArray(manual.customSections) && manual.customSections.length) {
                manual.customSections.forEach(sec => {
                    if (!sec.title && !sec.contentHtml) return;
                    const secTitle = sec.title ? sec.title.toUpperCase() : 'NỘI DUNG TÙY CHỈNH';
                    extraSections += `
        <section class="wr-custom-section">
            <h2>${wrToRoman(secNum++)}. ${wrEscapeHtml(secTitle)}</h2>
            <div class="wr-custom-content">${sec.contentHtml || ''}</div>
        </section>`;
                });
            }
            if (manual.plans) {
                extraSections += `
        <section>
            <h2>${wrToRoman(secNum++)}. KẾ HOẠCH TRỌNG TÂM TUẦN TIẾP THEO</h2>
            <ol>${wrLinesToList(manual.plans).map(x => `<li>${wrEscapeHtml(x.replace(/^[-•\d.)\s]+/, ''))}</li>`).join('')}</ol>
        </section>`;
            }
            return extraSections;
        })()}

        
        <div style="margin-top: 36px; padding-top: 18px; border-top: 1px dashed var(--wr-border, #cbd5e1); display: flex; justify-content: space-between; align-items: flex-start;">
            <div style="font-size: 11.5px; color: var(--wr-muted, #64748b); max-width: 320px;">
                <div>Báo cáo được tổng hợp tự động từ dữ liệu CRM Dashboard • ${new Date().toLocaleString('vi-VN')}</div>
                <div style="margin-top: 4px;">Bảo mật thông tin nội bộ • Khối Chăm Sóc Khách Hàng (Customer Success - SC).</div>
            </div>
            <div style="text-align: center; min-width: 240px;">
                <div style="font-size: 12px; color: var(--wr-muted, #64748b); font-style: italic;">
                    Hà Nội / TP.HCM, ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}
                </div>
                <div style="height: 48px;"></div>
                <div style="font-size: 13px; font-weight: 700; color: var(--wr-text, #0f172a);">
                    Đại diện Đội ngũ Customer Success (SC)
                </div>
                <div style="font-size: 11.5px; color: var(--wr-muted, #64748b); margin-top: 2px;">
                    Trân trọng gửi anh Nguyễn Dũng Hải SDM DVKH
                </div>
            </div>
        </div>
        <div class="wr-generated-note">Báo cáo được tổng hợp tự động từ dữ liệu CRM Dashboard • ${new Date().toLocaleString('vi-VN')}</div>
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
        if (status) status.innerHTML = '⏳ Đang tải dữ liệu KPI, hiệu suất, data treo và data đổ mới...';

        const fromVal = document.getElementById('wrFromDate').value;
        const toVal = document.getElementById('wrToDate').value;
        if (!fromVal || !toVal) throw new Error('Vui lòng chọn Từ ngày và Đến ngày.');
        const fromDate = new Date(fromVal + 'T00:00:00');
        const toDate = new Date(toVal + 'T00:00:00');
        if (fromDate > toDate) throw new Error('Từ ngày không được lớn hơn Đến ngày.');

        const data = await wrEnsureAllData();
        const kpi = wrBuildKpiMetrics(data.kpi);
        const performance = wrBuildPerformanceMetrics(data.hieusuat, data.ngaycong, fromDate, toDate);
        const backlog = wrBuildBacklogMetrics(data.data);
        const incoming = wrBuildIncomingMetrics(data.thongke, fromDate, toDate);
        const selfCreated = wrBuildSelfCreatedMetrics(performance.filteredRows);
        const supportDuration = wrBuildSupportDurationMetrics(performance.filteredRows);
        const manual = wrSaveManual();
        const previousSnapshot = wrFindPreviousSnapshot(toDate);

        const metrics = { kpi, performance, backlog, incoming, selfCreated, supportDuration };
        const html = wrBuildReportHtml(metrics, fromDate, toDate, previousSnapshot, manual);
        const plainText = wrHtmlToPlainText(html);

        window.weeklyReportOriginalHtml = html;
        window.weeklyReportState = { metrics, html, plainText, previousSnapshot };
        if (preview) {
            preview.innerHTML = html;
            wrInitDirectEditing();
        }
        if (status) status.innerHTML = `✅ Đã tạo báo cáo tự động đến hết <b>${wrFormatVNDate(toDate)}</b>. ${previousSnapshot ? `Đang so với mốc ${previousSnapshot.date.split('-').reverse().join('/')}.` : 'Chưa có mốc trước để so sánh.'}`;
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
    const titleText = titleEl ? titleEl.innerText.trim() : 'BÁO CÁO TUẦN - TEAM SC MIỀN NAM';
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
    body += wrDocxP('BÁO CÁO TUẦN - TEAM SC MIỀN NAM',{bold:true,color:'17365D',size:38,align:'center',after:40});
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
    const incomingHeaders=['TỈNH/THÀNH PHỐ',...inc.dayKeys.map(String),'TRUNG BÌNH','GRAND TOTAL'];
    const incomingRows=inc.provinces.map(r=>[{text:r.name,name:true},...inc.dayKeys.map(d=>r.days[d]||''),r.avg?wrNumber(r.avg):'',r.total?wrInt(r.total):'']);
    incomingRows.push([{text:'Grand Total',name:true,bold:true,fill:'E2E8F0'},...inc.dayKeys.map(d=>inc.dayTotals[d]?wrInt(inc.dayTotals[d]):''),{text:inc.avg?wrNumber(inc.avg):'',bold:true,fill:'E2E8F0'},{text:inc.total?wrInt(inc.total):'',bold:true,fill:'E2E8F0'}]);
    const incomingWidths=[2200,...inc.dayKeys.map(()=>Math.max(480,Math.floor(11200/Math.max(1,inc.dayKeys.length+2)))),1100,1200];
    body += wrDocxTable(incomingHeaders,incomingRows,incomingWidths,{fontSize:11,headerSize:10});

    body += wrDocxHeading('V. KIỂM SOÁT ATC NHÂN SỰ TỰ TẠO');
    body += wrDocxBullet(`Tổng ${wrInt(sc.total)} ATC, trong đó ${wrInt(sc.self)} ATC tự tạo, tương đương ${wrPct(sc.pct,1)}.`);
    const selfRows=sc.rows.map(r=>[{text:r.name,name:true,bold:true},wrInt(r.total),wrInt(r.self),{text:wrPct(r.pct,1),fill:r.pct>50?'FEE2E2':r.pct>20?'FEF3C7':'D1FAE5',color:r.pct>50?'B91C1C':r.pct>20?'B45309':'047857',bold:true},r.pct>50?'Nghi vấn':r.pct>20?'Cần để ý':'Bình thường']);
    body += wrDocxTable(['SC','TỔNG ATC','TỰ TẠO','% TỰ TẠO','ĐÁNH GIÁ'],selfRows,[4800,1800,1800,1800,2400],{fontSize:16,headerSize:15});

    body += wrDocxHeading('VI. THỜI LƯỢNG HỖ TRỢ KHÁCH HÀNG');
    body += wrDocxBullet(`Nhóm 0-5 phút có ${wrInt(sd.shortCount)}/${wrInt(sd.total)} case, chiếm ${wrPct(sd.shortPct)}.`);
    const durationHeaders=['NHÂN SỰ',...sd.bucketLabels,'TOTAL'];
    const durationRows=sd.staffRows.map(r=>[{text:r.name,name:true,bold:true},...r.counts.map((c,i)=>`${c}/${wrPct(r.pcts[i]||0)}`),`${r.total} ca`]);
    durationRows.push([{text:'Total',name:true,bold:true,fill:'E2E8F0'},...sd.bucketTotals.map((c,i)=>({text:`${c}/${wrPct(sd.bucketPcts[i]||0)}`,bold:true,fill:'E2E8F0'})),{text:`${sd.total} ca`,bold:true,fill:'E2E8F0'}]);
    body += wrDocxTable(durationHeaders,durationRows,[2500,...sd.bucketLabels.map(()=>1350),1500],{fontSize:12,headerSize:11});

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
