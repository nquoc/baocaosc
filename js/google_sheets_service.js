/**
 * google_sheets_service.js - Quản lý kết nối Google Sheets API bằng Service Account
 * Tự động tạo JWT ký RS256 bằng WebCrypto thuần trong trình duyệt (Không cần backend/proxy).
 * Đọc trực tiếp sheet 'Các tiệp triển khai' từ Google Spreadsheet ID: 1Wghthkrt0A8QQ08gDVSnQO55ix8CGCZHt87qhRcpKEY
 */

// Cấu hình Service Account & Spreadsheet
const SA_SPREADSHEET_ID = '1Wghthkrt0A8QQ08gDVSnQO55ix8CGCZHt87qhRcpKEY';
const SA_SHEET_NAME = 'Các tiệp triển khai';
const SA_RETAIL_SPREADSHEET_ID = '12nWROazTrZvDR6NCVcCVhzfLr2lmrsctpavm2g_9RyQ';
const SA_RETAIL_SHEET_NAME = 'Report';
const SA_RANGES = [
  `'${SA_SHEET_NAME}'!A1:B50`,  // Mục 8.1: Nhóm FNB lớn / lỗi (cột A:B)
  `'${SA_SHEET_NAME}'!D1:H60`,  // Mục 8.2: Nhóm Booking 3 Hotel sao (cột D:H)
  `'${SA_SHEET_NAME}'!J1:P60`,  // Mục 8.3: Nhóm retail lớn HDDT (cột J:P dự phòng)
  `'${SA_SHEET_NAME}'!Q1:T20`,  // Mục 8.4: Nhóm Hỗ trợ Tái ký (cột Q:T)
  `'Data tồn'!A1:K15`,          // Mục 9: Data tồn Tháng 11 (Offline & Online)
  `'Khách ký mới'!A1:E6`        // Mục 7: Tỷ Lệ Chăm Khách New T11
];

const BOT_API_URL = 'https://script.google.com/macros/s/AKfycbwHmR0xSG4uZrBdyPrv-lypX5qjP1bOC2Ca1_8vY1oRfIAe_LeFnJa7wAWrGzCmPrU/exec?apiKey=my_secret_token_2026';

const CACHE_KEY_TIEPTRIENKHAI = 'tiep_trien_khai_data_v6';

// Bộ nhớ đệm token & cấu hình bot trong phiên (tránh sinh token liên tục)
let _gSaConfig = null;
let _gSaToken = '';
let _gSaTokenExp = 0;

function _clearGoogleBotSessionCache() {
  _gSaConfig = null;
  _gSaToken = '';
  _gSaTokenExp = 0;
  try {
    sessionStorage.removeItem('tc_g_sa_cfg_v3');
    sessionStorage.removeItem('tc_g_sa_token_v3');
    sessionStorage.removeItem('tc_g_sa_token_exp_v3');
    // Xóa luôn cache cũ nếu còn sót
    sessionStorage.removeItem('tc_g_sa_token');
    sessionStorage.removeItem('tc_g_sa_token_exp');
    sessionStorage.removeItem('tc_g_sa_token_v2');
    sessionStorage.removeItem('tc_g_sa_token_exp_v2');
    sessionStorage.removeItem('tc_g_sa_creds_v2');
  } catch (e) {}
}

/**
 * Lấy cấu hình bot động từ Apps Script Web App
 */
async function getGoogleBotConfig(forceRefresh = false) {
  if (!forceRefresh && _gSaConfig && _gSaConfig.private_key) {
    return _gSaConfig;
  }

  if (!forceRefresh) {
    try {
      const cached = sessionStorage.getItem('tc_g_sa_cfg_v3');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.private_key) {
          _gSaConfig = parsed;
          return _gSaConfig;
        }
      }
    } catch (e) {}
  }

  const res = await fetch(BOT_API_URL, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Không thể kết nối Apps Script API (HTTP ${res.status})`);
  }

  const data = await res.json();
  const cfg = data && (data.credentials || data.data || data);
  if (cfg && cfg.private_key && cfg.client_email) {
    _gSaConfig = cfg;
    try {
      sessionStorage.setItem('tc_g_sa_cfg_v3', JSON.stringify(_gSaConfig));
    } catch (e) {}
    return _gSaConfig;
  }

  throw new Error((data && data.message) || 'Phản hồi từ Apps Script API không hợp lệ');
}

/* ==========================================================================
   1. WEBCRYPTO TOKEN GENERATOR (RS256 JWT -> GOOGLE OAUTH2 TOKEN)
   ========================================================================== */

function _base64UrlEncodeStr(str) {
  const b64 = btoa(unescape(encodeURIComponent(str)));
  return b64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function _arrayBufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function _pemToBinary(pem) {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Lấy Access Token từ Service Account thông qua WebCrypto native
 */
async function getGoogleServiceAccountToken(forceRefresh = false) {
  const now = Math.floor(Date.now() / 1000);
  // Kiểm tra token trong cache RAM hoặc sessionStorage
  if (!forceRefresh && !_gSaToken) {
    _gSaToken = sessionStorage.getItem('tc_g_sa_token_v3') || '';
    _gSaTokenExp = parseInt(sessionStorage.getItem('tc_g_sa_token_exp_v3') || '0', 10);
  }

  if (!forceRefresh && _gSaToken && _gSaTokenExp > now + 180) {
    return _gSaToken;
  }

  const cfg = await getGoogleBotConfig(forceRefresh);
  const tokenUri = cfg.token_uri || 'https://oauth2.googleapis.com/token';

  // Tạo JWT assertion
  const binaryDer = _pemToBinary(cfg.private_key);
  const cryptoObj = window.crypto || window.msCrypto;
  if (!cryptoObj || !cryptoObj.subtle) {
    throw new Error('Trình duyệt hiện tại không hỗ trợ WebCrypto API. Vui lòng mở bằng Chrome hoặc Edge mới!');
  }

  const privateKey = await cryptoObj.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const header = _base64UrlEncodeStr(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = _base64UrlEncodeStr(JSON.stringify({
    iss: cfg.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: tokenUri,
    exp: now + 3600,
    iat: now
  }));

  const toSign = new TextEncoder().encode(header + '.' + payload);
  const signature = await cryptoObj.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, toSign);
  const sigB64 = _arrayBufferToBase64Url(signature);
  const jwtAssertion = header + '.' + payload + '.' + sigB64;

  const res = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + encodeURIComponent(jwtAssertion)
  });

  const data = await res.json();
  if (!data.access_token) {
    // Nếu bị lỗi JWT do cache key cũ, tự động xóa cache và thử tải key mới từ Apps Script 1 lần
    if (!forceRefresh) {
      _clearGoogleBotSessionCache();
      return getGoogleServiceAccountToken(true);
    }
    throw new Error(data.error_description || data.error || 'Không thể lấy Access Token từ Google Service Account');
  }

  _gSaToken = data.access_token;
  _gSaTokenExp = now + (data.expires_in || 3600);
  try {
    sessionStorage.setItem('tc_g_sa_token_v3', _gSaToken);
    sessionStorage.setItem('tc_g_sa_token_exp_v3', String(_gSaTokenExp));
  } catch (e) {}

  return _gSaToken;
}

/**
 * Tải đồng thời cả 3 vùng dữ liệu qua batchGet
 * - Nhóm F&B (A:B) và Booking (D:H) lấy từ spreadsheet chính SA_SPREADSHEET_ID
 * - Nhóm Retail Lớn HDDT lấy trực tiếp từ spreadsheet chuyên biệt SA_RETAIL_SPREADSHEET_ID (sheet Report),
 *   hoặc tự động dự phòng sang cột J:P của spreadsheet chính nếu mạng/quyền hạn có sự cố.
 */
async function fetchTiepTrienKhaiFromGoogleSheets(isRetry = false) {
  const token = await getGoogleServiceAccountToken(isRetry);

  // 1. Tải FNB, Booking và cột dự phòng Retail từ spreadsheet chính
  const urlPrimary = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${SA_SPREADSHEET_ID}/values:batchGet`);
  SA_RANGES.forEach(r => urlPrimary.searchParams.append('ranges', r));

  // 2. Tải song song Retail HDDT từ sheet Report (gid 1856000949)
  const urlRetailReport = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${SA_RETAIL_SPREADSHEET_ID}/values/${encodeURIComponent(`'${SA_RETAIL_SHEET_NAME}'!A1:G40`)}`);

  const [resPrimary, resRetailReport] = await Promise.all([
    fetch(urlPrimary.toString(), { headers: { 'Authorization': 'Bearer ' + token } }),
    fetch(urlRetailReport.toString(), { headers: { 'Authorization': 'Bearer ' + token } }).catch(err => {
      console.warn('Lỗi kết nối sheet Report Retail:', err);
      return null;
    })
  ]);

  if (!resPrimary.ok) {
    if ((resPrimary.status === 401 || resPrimary.status === 403) && !isRetry) {
      _clearGoogleBotSessionCache();
      return fetchTiepTrienKhaiFromGoogleSheets(true);
    }
    const errText = await resPrimary.text();
    throw new Error(`Google Sheets API lỗi HTTP ${resPrimary.status}: ${errText}`);
  }

  const primaryJson = await resPrimary.json();
  let retailValueRange = primaryJson.valueRanges[2]; // Mặc định cột J:P của Các tiệp triển khai

  if (resRetailReport && resRetailReport.ok) {
    try {
      const retailJson = await resRetailReport.json();
      if (retailJson && Array.isArray(retailJson.values) && retailJson.values.length >= 5) {
        retailValueRange = {
          range: `'${SA_RETAIL_SHEET_NAME}'!A1:G40`,
          values: retailJson.values
        };
      }
    } catch (parseJsonErr) {
      console.warn('Lỗi đọc JSON sheet Report Retail:', parseJsonErr);
    }
  }

  return {
    valueRanges: [
      primaryJson.valueRanges[0],
      primaryJson.valueRanges[1],
      retailValueRange,
      primaryJson.valueRanges[3],
      primaryJson.valueRanges[4],
      primaryJson.valueRanges[5]
    ]
  };
}

/* ==========================================================================
   2. DATA NORMALIZATION (CHUẨN HÓA DỮ LIỆU ĐỘNG CHO 3 NHÓM)
   ========================================================================== */

function _parseValNumber(str) {
  if (str == null) return 0;
  const s = String(str).trim();
  if (!s || s === '–' || s === '-') return 0;
  const cleaned = s.replace(/\./g, '').replace(/,/g, '.').replace(/%/g, '').trim();
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

/**
 * Chuẩn hóa 5.1: Nhóm FNB lớn / lỗi (cột A:B)
 */
function parseTiepTrienKhaiFnb(rows) {
  if (!Array.isArray(rows) || rows.length < 3) return null;

  const title = (rows[0] && rows[0][0]) || 'Nhóm FNB lớn / lỗi';
  let month = (rows[1] && rows[1][0]) || 'Tháng 11';

  let headerRowIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const r0 = rows[i] && rows[i][0] ? String(rows[i][0]).toLowerCase() : '';
    if (r0.includes('nhóm lỗi') || r0.includes('nhom loi')) {
      headerRowIdx = i;
      break;
    }
  }

  const headers = headerRowIdx >= 0 ? rows[headerRowIdx] : ['Nhóm lỗi', 'Số lượng'];
  const items = [];
  let totalRow = null;
  let errorRateRow = null;

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r.length || !r[0]) continue;
    const name = String(r[0]).trim();
    const countVal = String(r[1] || '0').trim();
    const lower = name.toLowerCase();

    if (lower.includes('tỷ lệ lỗi') || lower.includes('ty le loi')) {
      errorRateRow = { name, value: countVal, pct: _parseValNumber(countVal) };
    } else if (lower.includes('tổng cộng') || lower.includes('tong cong') || lower.includes('tổng')) {
      const num = _parseValNumber(countVal);
      totalRow = { name, count: num, raw: countVal };
    } else {
      const num = _parseValNumber(countVal);
      items.push({
        id: items.length + 1,
        name,
        count: num,
        raw: countVal,
        pct: 0
      });
    }
  }

  const calcTotal = items.reduce((s, it) => s + it.count, 0);
  const grandTotal = totalRow && totalRow.count > 0 ? totalRow.count : calcTotal;
  items.forEach(it => {
    it.pct = grandTotal > 0 ? (it.count / grandTotal) * 100 : 0;
  });

  // Tìm lỗi app/pos và hướng dẫn SD
  const appPosItem = items.find(it => it.name.toLowerCase().includes('app/pos'));
  const guideItem = items.find(it => it.name.toLowerCase().includes('hướng dẫn sử dụng'));
  const nonErrorItem = items.find(it => it.name.toLowerCase().includes('không lỗi') || it.name.toLowerCase().includes('chưa hỗ trợ'));

  return {
    title,
    month,
    headers,
    items,
    totalRow: totalRow || { name: 'Tổng cộng', count: grandTotal, raw: String(grandTotal) },
    errorRateRow: errorRateRow || { name: 'Tỷ lệ lỗi', value: '17,56%', pct: 17.56 },
    grandTotal,
    appPosCount: appPosItem ? appPosItem.count : 0,
    guideCount: guideItem ? guideItem.count : 0,
    nonErrorCount: nonErrorItem ? nonErrorItem.count : 0
  };
}

/**
 * Chuẩn hóa 5.2: Nhóm Booking 3 Hotel sao (cột D:H)
 */
function parseTiepTrienKhaiBooking(rows) {
  if (!Array.isArray(rows) || rows.length < 3) return null;

  const title = (rows[0] && rows[0][0]) || 'Nhóm Booking 3 Hotel sao';
  const month = (rows[1] && rows[1][0]) || 'Tháng 10';

  // Bảng 1: Tình trạng trao đổi & Tỷ lệ Impact
  const tbl1Headers = rows[2] || ['Tình trạng trao đổi', 'Số lượng', 'Tỷ tiếp cận trực tiếp thành công', 'Số khách impact', 'Tỷ lệ impact'];
  const tbl1Rows = [];
  let tbl1Total = null;
  let idx = 3;

  while (idx < rows.length) {
    const r = rows[idx];
    if (!r || !r.length || !r[0]) {
      idx++;
      break;
    }
    const name = String(r[0]).trim();
    if (name.toLowerCase().includes('tổng')) {
      tbl1Total = r;
    } else {
      tbl1Rows.push(r);
    }
    idx++;
  }

  // Bảng 2: Chi tiết nhóm vấn đề & nội dung lỗi
  let tbl2Headers = ['Nhóm vấn đề', 'Nội dung lỗi / hạn chế', 'Số lượng'];
  const tbl2Rows = [];
  let tbl2Total = null;

  while (idx < rows.length) {
    const r = rows[idx];
    if (r && r.length && r.some(c => String(c).toLowerCase().includes('nội dung lỗi') || String(c).toLowerCase().includes('nhóm vấn đề'))) {
      tbl2Headers = r;
      idx++;
      break;
    }
    idx++;
  }

  let currentGroup = '';
  while (idx < rows.length) {
    const r = rows[idx];
    if (!r || !r.length || (!r[0] && !r[1] && !r[2])) {
      if (tbl2Rows.length > 0) {
        idx++;
        break;
      }
    }
    const col0 = String(r[0] || '').trim();
    const col1 = String(r[1] || '').trim();
    const col2 = String(r[2] || '').trim();

    if (col0.toLowerCase().includes('tổng lượt') || col0.toLowerCase().includes('tổng')) {
      tbl2Total = { name: col0, count: col2 };
    } else if (col0.startsWith('2. ') && !col2) {
      break;
    } else {
      if (col0) currentGroup = col0;
      if (col1) {
        tbl2Rows.push({
          group: currentGroup,
          content: col1,
          count: col2
        });
      }
    }
    idx++;
  }

  // Bảng 3: Các nhóm vấn đề chính
  let tbl3Title = '2. Các nhóm vấn đề chính';
  let tbl3Headers = ['Nhóm vấn đề', 'Nội dung ghi nhận'];
  const tbl3Rows = [];

  while (idx < rows.length) {
    const r = rows[idx];
    if (r && r.length) {
      const c0 = String(r[0] || '').trim();
      const c1 = String(r[1] || '').trim();
      if (c0.toLowerCase().includes('các nhóm vấn đề')) {
        tbl3Title = c0;
      } else if (c0.toLowerCase().includes('nhóm vấn đề') && c1.toLowerCase().includes('nội dung ghi nhận')) {
        tbl3Headers = [c0, c1];
      } else if (c0 && c1) {
        tbl3Rows.push({ group: c0, content: c1 });
      }
    }
    idx++;
  }

  return {
    title,
    month,
    tbl1: { headers: tbl1Headers, rows: tbl1Rows, total: tbl1Total },
    tbl2: { headers: tbl2Headers, rows: tbl2Rows, total: tbl2Total },
    tbl3: { title: tbl3Title, headers: tbl3Headers, rows: tbl3Rows }
  };
}

/**
 * Chuẩn hóa 8.3: Nhóm retail lớn HDDT (từ sheet Report hoặc cột J:P)
 */
function parseTiepTrienKhaiRetail(rows) {
  if (!Array.isArray(rows) || rows.length < 3) return null;

  const title = (rows[0] && rows[0][0]) || 'Nhóm retail lớn HDDT';
  const month = (rows[1] && rows[1][0]) || 'Tháng 11';

  // Bảng 1: Thực trạng cửa hàng & Impact
  let tbl1Headers = ['Thực trạng cửa hàng / Công ty', 'Số lượng', 'Tỷ tiếp cận trực tiếp', 'Số khách impact', 'Tỷ lệ impact'];
  const tbl1Rows = [];
  let tbl1Total = null;
  let idx = 2;

  if (rows[idx] && rows[idx].length >= 3) {
    tbl1Headers = rows[idx].slice(0, 5);
    idx++;
  }

  while (idx < rows.length) {
    const r = rows[idx];
    if (!r || !r.length || !r[0]) {
      idx++;
      break;
    }
    const name = String(r[0]).trim();
    if (name.toLowerCase().includes('tổng')) {
      tbl1Total = r.slice(0, 5);
      idx++;
      break;
    } else {
      tbl1Rows.push(r.slice(0, 5));
    }
    idx++;
  }

  // Bảng 2 & Bảng 2b (Tình trạng trao đổi & Tình trạng sử dụng phần mềm)
  let tbl2Headers = ['Hình thức trao đổi', 'Số lượng GH', 'Tỷ lệ tiếp cận (%)'];
  const tbl2Rows = [];
  let tbl2Total = null;

  let tblUsageHeaders = ['Tình trạng sử dụng', 'Số gian hàng', 'Tỷ trọng'];
  const tblUsageRows = [];
  let tblUsageTotal = null;

  while (idx < rows.length) {
    const r = rows[idx];
    if (!r || !r.length) {
      idx++;
      continue;
    }
    const c0 = String(r[0] || '').trim();
    if (c0.toLowerCase().includes('nguyên nhân khách')) {
      break;
    }

    // Cột 0..2: Bảng 2
    if (c0.toLowerCase().includes('tình trạng trao đổi') || c0.toLowerCase().includes('hình thức')) {
      tbl2Headers = [r[0] || 'Hình thức trao đổi', r[1] || 'Số lượng GH', r[2] || 'Tỷ lệ tiếp cận (%)'];
    } else if (c0.toLowerCase().includes('tổng')) {
      tbl2Total = [r[0], r[1], r[2]];
    } else if (c0 && c0 !== 'Tháng 11' && r[1] != null && String(r[1]).trim() !== '') {
      tbl2Rows.push([r[0], r[1], r[2]]);
    }

    // Cột 4..6: Bảng 2b (Tình trạng sử dụng)
    const c4 = String(r[4] || '').trim();
    if (c4) {
      if (c4.toLowerCase().includes('tình trạng sử dụng')) {
        tblUsageHeaders = [r[4] || 'Tình trạng sử dụng', r[5] || 'Số gian hàng', r[6] || 'Tỷ trọng'];
      } else if (c4.toLowerCase().includes('tổng')) {
        tblUsageTotal = [r[4], r[5], r[6]];
      } else if (r[5] != null && String(r[5]).trim() !== '') {
        tblUsageRows.push([r[4], r[5], r[6]]);
      }
    }
    idx++;
  }

  // Bảng 3: 1. Nguyên nhân khách sử dụng song song hoặc chuyển sang nhà cung cấp khác
  let tbl3Title = '1. Nguyên nhân khách sử dụng song song hoặc chuyển sang nhà cung cấp khác';
  let tbl3Headers = ['Nhóm nguyên nhân', 'Phân tích thực tế', 'Số gian hàng'];
  const tbl3Rows = [];

  while (idx < rows.length) {
    const r = rows[idx];
    if (r && r.length) {
      const c0 = String(r[0] || '').trim();
      if (c0.toLowerCase().includes('nguyên nhân khách')) {
        tbl3Title = c0;
        idx++;
        while (idx < rows.length && (!rows[idx] || !rows[idx].length || !rows[idx].some(c => c && String(c).trim() !== ''))) {
          idx++;
        }
        if (idx < rows.length && rows[idx] && rows[idx].length >= 3) {
          const checkHeader = String(rows[idx][0] || '').toLowerCase();
          if (checkHeader.includes('nhóm') || checkHeader.includes('nguyên nhân')) {
            tbl3Headers = rows[idx].slice(0, 3);
            idx++;
          }
        }
        while (idx < rows.length) {
          const rowData = rows[idx];
          if (!rowData || !rowData.length || !rowData[0]) {
            idx++;
            break;
          }
          const checkEnd = String(rowData[0] || '').toLowerCase();
          if (checkEnd.startsWith('2. ') || checkEnd.includes('các vấn đề') || checkEnd.includes('tổng')) {
            break;
          }
          tbl3Rows.push(rowData.slice(0, 3));
          idx++;
        }
        break;
      }
    }
    idx++;
  }

  // Bảng 4: 2. Các vấn đề phát sinh lỗi và đề xuất về HDDT (5 cột: Nhóm, Vấn đề, Số GH, Đề xuất, KAT)
  let tbl4Title = '2. Các vấn đề phát sinh lỗi và đề xuất về HDDT';
  let tbl4Headers = ['Nhóm vấn đề', 'Vấn đề khách hàng phản ánh', 'Số gian hàng', 'Đề xuất', 'Ý kiến / Phản hồi KAT'];
  const tbl4Rows = [];

  while (idx < rows.length) {
    const r = rows[idx];
    if (r && r.length) {
      const c0 = String(r[0] || '').trim();
      const c1 = String(r[1] || '').trim();
      if (c0.toLowerCase().includes('các vấn đề phát sinh') || c0.toLowerCase().includes('đề xuất về hddt')) {
        tbl4Title = c0;
        idx++;
        while (idx < rows.length && (!rows[idx] || !rows[idx].length || !rows[idx].some(c => c && String(c).trim() !== ''))) {
          idx++;
        }
        if (idx < rows.length && rows[idx] && rows[idx].length >= 3) {
          const checkHeader = String(rows[idx][0] || '').toLowerCase();
          if (checkHeader.includes('nhóm') || checkHeader.includes('vấn đề')) {
            tbl4Headers = [
              rows[idx][0] || 'Nhóm vấn đề',
              rows[idx][1] || 'Vấn đề khách hàng phản ánh',
              rows[idx][2] || 'Số gian hàng',
              rows[idx][3] || 'Đề xuất',
              rows[idx][4] || 'Ý kiến / Phản hồi KAT'
            ];
            idx++;
          }
        }
        while (idx < rows.length) {
          const rowData = rows[idx];
          if (!rowData || !rowData.length || !rowData[0]) {
            idx++;
            break;
          }
          tbl4Rows.push([
            rowData[0] || '',
            rowData[1] || '',
            rowData[2] || '',
            rowData[3] || '',
            rowData[4] || ''
          ]);
          idx++;
        }
        break;
      } else if (c0.toLowerCase().includes('nhóm vấn đề') && c1.toLowerCase().includes('vấn đề')) {
        tbl4Headers = [
          r[0] || 'Nhóm vấn đề',
          r[1] || 'Vấn đề khách hàng phản ánh',
          r[2] || 'Số gian hàng',
          r[3] || 'Đề xuất',
          r[4] || 'Ý kiến / Phản hồi KAT'
        ];
        idx++;
        while (idx < rows.length) {
          const rowData = rows[idx];
          if (!rowData || !rowData.length || !rowData[0]) {
            idx++;
            break;
          }
          tbl4Rows.push([
            rowData[0] || '',
            rowData[1] || '',
            rowData[2] || '',
            rowData[3] || '',
            rowData[4] || ''
          ]);
          idx++;
        }
        break;
      }
    }
    idx++;
  }

  return {
    title,
    month,
    tbl1: { headers: tbl1Headers, rows: tbl1Rows, total: tbl1Total },
    tbl2: { headers: tbl2Headers, rows: tbl2Rows, total: tbl2Total },
    tblUsage: { headers: tblUsageHeaders, rows: tblUsageRows, total: tblUsageTotal },
    tbl3: { title: tbl3Title, headers: tbl3Headers, rows: tbl3Rows },
    tbl4: { title: tbl4Title, headers: tbl4Headers, rows: tbl4Rows }
  };
}

/**
 * Chuẩn hóa 8.4: Nhóm Hỗ Trợ Tái Ký (cột Q:T từ sheet Các tiệp triển khai)
 */
function parseTiepTrienKhaiTaiKy(rows) {
  if (!Array.isArray(rows) || rows.length < 3) return null;

  const title = (rows[0] && rows[0][0]) || 'Thống kê kết quả SC hỗ trợ tái Ký';
  let month = 'Tháng 11';

  let headerRowIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const r0 = rows[i] && rows[i][0] ? String(rows[i][0]).toLowerCase() : '';
    if (r0.includes('tình trạng') || r0.includes('trc khi') || r0.includes('trước khi')) {
      headerRowIdx = i;
      break;
    }
  }

  const headers = headerRowIdx >= 0 ? rows[headerRowIdx] : ['Tình trạng gian hàng trc khi SC đi', 'Số lượng', 'Thành công', 'Tỉ lệ '];
  const items = [];
  let totalRow = null;

  for (let i = (headerRowIdx >= 0 ? headerRowIdx + 1 : 2); i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r.length || !r[0]) continue;
    const name = String(r[0]).trim();
    const countVal = String(r[1] || '0').trim();
    const successVal = r[2] != null ? String(r[2]).trim() : '';
    const rateVal = r[3] != null ? String(r[3]).trim() : '';

    if (name.toLowerCase().includes('tổng cộng') || name.toLowerCase().includes('tong cong') || name.toLowerCase().includes('tổng')) {
      totalRow = {
        name,
        count: _parseValNumber(countVal),
        rawCount: countVal,
        success: successVal ? _parseValNumber(successVal) : null,
        rawSuccess: successVal,
        rate: rateVal
      };
    } else {
      items.push({
        id: items.length + 1,
        name,
        count: _parseValNumber(countVal),
        rawCount: countVal,
        success: successVal ? _parseValNumber(successVal) : null,
        rawSuccess: successVal,
        rate: rateVal
      });
    }
  }

  const grandTotal = totalRow ? totalRow.count : items.reduce((s, it) => s + it.count, 0);

  return {
    title,
    month,
    headers,
    items,
    totalRow: totalRow || { name: 'Tổng cộng', count: grandTotal, rawCount: String(grandTotal) },
    grandTotal
  };
}

/**
 * Chuẩn hóa Mục 9: Data tồn Tháng 11 (Offline & Online) từ sheet 'Data tồn' (cột A:E offline & G:K online)
 */
function parseDataTonSheet(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return null;

  // 1. OFFLINE (Cột 0..4: A:E)
  const offlineRows = [];
  let offlineTotal = null;

  // 2. ONLINE (Cột 6..10: G:K)
  const onlineRows = [];
  let onlineTotal = null;

  const headers = ['Tệp', 'Retail', 'F&B', 'Booking', 'Tổng'];
  let month = 'Tháng 11';

  // Lấy tên tháng từ dòng tiêu đề nếu có
  if (rows[0] && rows[0][0]) {
    const t = String(rows[0][0]).trim();
    const mMatch = t.match(/tháng\s*\d+/i);
    if (mMatch) month = mMatch[0].charAt(0).toUpperCase() + mMatch[0].slice(1);
  }

  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r.length) continue;

    // Phân tích bảng Offline (Cột 0..4)
    const nameOff = String(r[0] || '').trim();
    if (nameOff) {
      const ret = _parseValNumber(r[1]);
      const fnb = _parseValNumber(r[2]);
      const book = _parseValNumber(r[3]);
      const tot = _parseValNumber(r[4]) || (ret + fnb + book);

      const item = {
        name: nameOff,
        retail: ret,
        fnb: fnb,
        booking: book,
        total: tot
      };

      if (nameOff.toLowerCase().includes('tổng')) {
        offlineTotal = item;
      } else {
        offlineRows.push(item);
      }
    }

    // Phân tích bảng Online (Cột 6..10)
    const nameOnl = String(r[6] || '').trim();
    if (nameOnl) {
      const ret = _parseValNumber(r[7]);
      const fnb = _parseValNumber(r[8]);
      const book = _parseValNumber(r[9]);
      const tot = _parseValNumber(r[10]) || (ret + fnb + book);

      const item = {
        name: nameOnl,
        retail: ret,
        fnb: fnb,
        booking: book,
        total: tot
      };

      if (nameOnl.toLowerCase().includes('tổng')) {
        onlineTotal = item;
      } else {
        onlineRows.push(item);
      }
    }
  }

  // Nếu chưa có dòng tổng thì tự tính
  if (!offlineTotal) {
    offlineTotal = {
      name: 'Tổng',
      retail: offlineRows.reduce((s, it) => s + it.retail, 0),
      fnb: offlineRows.reduce((s, it) => s + it.fnb, 0),
      booking: offlineRows.reduce((s, it) => s + it.booking, 0),
      total: offlineRows.reduce((s, it) => s + it.total, 0)
    };
  }

  if (!onlineTotal) {
    onlineTotal = {
      name: 'Tổng',
      retail: onlineRows.reduce((s, it) => s + it.retail, 0),
      fnb: onlineRows.reduce((s, it) => s + it.fnb, 0),
      booking: onlineRows.reduce((s, it) => s + it.booking, 0),
      total: onlineRows.reduce((s, it) => s + it.total, 0)
    };
  }

  // Tính tỷ trọng % cho từng dòng
  offlineRows.forEach(it => {
    it.pct = offlineTotal.total > 0 ? (it.total / offlineTotal.total) * 100 : 0;
  });
  onlineRows.forEach(it => {
    it.pct = onlineTotal.total > 0 ? (it.total / onlineTotal.total) * 100 : 0;
  });

  // Tổng hợp toàn bộ (Offline + Online)
  const combined = {
    total: offlineTotal.total + onlineTotal.total,
    retail: offlineTotal.retail + onlineTotal.retail,
    fnb: offlineTotal.fnb + onlineTotal.fnb,
    booking: offlineTotal.booking + onlineTotal.booking
  };
  combined.retailPct = combined.total > 0 ? (combined.retail / combined.total) * 100 : 0;
  combined.fnbPct = combined.total > 0 ? (combined.fnb / combined.total) * 100 : 0;
  combined.bookingPct = combined.total > 0 ? (combined.booking / combined.total) * 100 : 0;

  return {
    month,
    headers,
    offline: {
      title: `Data tồn ${month} offline`,
      items: offlineRows,
      total: offlineTotal
    },
    online: {
      title: `Data tồn ${month} online`,
      items: onlineRows,
      total: onlineTotal
    },
    combined
  };
}

/* ==========================================================================
   3. GLOBAL STATE & SMART CACHE MANAGEMENT
   ========================================================================== */

let TIEP_TRIEN_KHAI_STATE = {
  fnb: null,
  booking: null,
  retail: null,
  taiky: null,
  dataTon: null,
  careRate: null,
  activeTab: 'all', // 'all' | 'fnb' | 'booking' | 'retail' | 'taiky'
  activeDataTonTab: 'all', // 'all' | 'offline' | 'online'
  savedAt: 0,
  timeStr: '',
  source: 'none'
};

let _isFetchingTiep = false;

// Trạng thái tìm kiếm và sắp xếp cho từng nhóm
const TIEP_SEARCH_SORT = {
  fnbQuery: '',
  fnbSort: { k: 'id', dir: 1 },
  bookingQuery: '',
  retailQuery: ''
};

/**
 * Khởi động và nạp dữ liệu Tệp Triển Khai
 */
async function loadTiepTrienKhaiData(forceReload = false, isSilent = false) {
  const badge = $('bscTiepStatusBadge');
  const btn = $('btnReloadTiepTrienKhai');

  if (btn && !isSilent) {
    btn.disabled = true;
    btn.textContent = '⏳ Đang đồng bộ…';
  }
  if (badge && !isSilent) {
    badge.className = 'badge b-load';
    badge.textContent = 'Đang đồng bộ Google Sheets…';
  }

  // 1. Kiểm tra IndexedDB Cache (mở tức thì < 0.05s)
  if (!forceReload) {
    try {
      const db = await openDB();
      const cached = await new Promise(resolve => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(CACHE_KEY_TIEPTRIENKHAI);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });

      if (cached && cached.fnb && cached.booking && cached.retail) {
        const ageMs = Date.now() - (cached.savedAt || 0);
        const minsAgo = Math.max(0, Math.floor(ageMs / 60000));
        const timeLabel = minsAgo === 0 ? 'vừa xong' : `${minsAgo} phút trước`;

        TIEP_TRIEN_KHAI_STATE = {
          ...cached,
          activeTab: TIEP_TRIEN_KHAI_STATE.activeTab || 'all',
          activeDataTonTab: TIEP_TRIEN_KHAI_STATE.activeDataTonTab || 'all',
          source: 'cache'
        };

        // Đồng bộ ngược cho BAOCAOSC_STATE để các phần khác nếu dùng vẫn có data
        if (typeof BAOCAOSC_STATE !== 'undefined') {
          if (cached.rawFnb) BAOCAOSC_STATE.fnbIssue = cached.rawFnb;
          if (cached.dataTon) BAOCAOSC_STATE.dataTon = cached.dataTon;
          if (cached.careRate) {
            BAOCAOSC_STATE.careRate = cached.careRate;
            if (typeof normalizeCareRateData === 'function') {
              const parsedCare = normalizeCareRateData(cached.careRate);
              if (parsedCare) {
                if (typeof renderBaoCaoScCareSummaryCards === 'function') renderBaoCaoScCareSummaryCards(parsedCare);
                if (typeof renderBaoCaoScCareTable === 'function') renderBaoCaoScCareTable(parsedCare);
              }
            }
          }
        }

        renderTiepTrienKhai();
        if (badge) {
          badge.className = 'badge';
          badge.style.background = 'rgba(59,130,246,0.15)';
          badge.style.color = '#60a5fa';
          badge.style.border = '1px solid rgba(59,130,246,0.3)';
          badge.textContent = `Bộ nhớ đệm (${timeLabel}) · Google Sheets`;
        }
      } else if (typeof SNAPSHOT_TIEP_TRIEN_KHAI !== 'undefined' && SNAPSHOT_TIEP_TRIEN_KHAI.valueRanges) {
        // Nạp từ snapshot nếu chưa có cache
        _applyRawRanges(SNAPSHOT_TIEP_TRIEN_KHAI.valueRanges, 'snapshot');
        renderTiepTrienKhai();
        if (badge) {
          badge.className = 'badge';
          badge.textContent = 'Snapshot tĩnh';
        }
      }
    } catch (e) {
      console.warn('Lỗi đọc cache tiep_trien_khai:', e);
    }
  }

  if (_isFetchingTiep) return;
  _isFetchingTiep = true;

  // 2. Kéo API Google Sheets qua Service Account
  try {
    const batchData = await fetchTiepTrienKhaiFromGoogleSheets();
    if (batchData && Array.isArray(batchData.valueRanges) && batchData.valueRanges.length >= 3) {
      _applyRawRanges(batchData.valueRanges, 'live');

      // Lưu IndexedDB
      try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put({
          fnb: TIEP_TRIEN_KHAI_STATE.fnb,
          booking: TIEP_TRIEN_KHAI_STATE.booking,
          retail: TIEP_TRIEN_KHAI_STATE.retail,
          taiky: TIEP_TRIEN_KHAI_STATE.taiky,
          dataTon: TIEP_TRIEN_KHAI_STATE.dataTon,
          careRate: TIEP_TRIEN_KHAI_STATE.careRate,
          rawFnb: batchData.valueRanges[0].values,
          savedAt: Date.now(),
          timeStr: TIEP_TRIEN_KHAI_STATE.timeStr
        }, CACHE_KEY_TIEPTRIENKHAI);
      } catch (saveErr) {
        console.warn('Lỗi lưu cache tiep_trien_khai:', saveErr);
      }

      renderTiepTrienKhai();

      if (badge) {
        badge.className = 'badge b-live';
        badge.style.background = 'rgba(16,185,129,0.15)';
        badge.style.color = '#10b981';
        badge.style.border = '1px solid rgba(16,185,129,0.3)';
        badge.textContent = `Google Sheets API (${TIEP_TRIEN_KHAI_STATE.timeStr})`;
      }

      if (forceReload && typeof showToast === 'function') {
        showToast('Đã đồng bộ trực tiếp các tệp triển khai mới nhất từ Google Sheets!', true);
      }
    }
  } catch (err) {
    console.error('Lỗi nạp Google Sheets API Các tệp triển khai:', err);
    if (badge) {
      badge.className = 'badge b-err';
      badge.textContent = 'Lỗi đồng bộ Google Sheets';
    }
    if (forceReload && typeof showToast === 'function') {
      showToast('Không thể kết nối Google Sheets: ' + (err.message || 'Lỗi mạng'), false);
    }
  } finally {
    _isFetchingTiep = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🔄 Tải lại tệp';
    }
  }
}

function _applyRawRanges(valueRanges, source) {
  const fnbRows = valueRanges[0]?.values || [];
  const bookingRows = valueRanges[1]?.values || [];
  const retailRows = valueRanges[2]?.values || [];
  const taiKyRows = valueRanges[3]?.values || [];
  const dataTonRows = valueRanges[4]?.values || [];
  const careRows = valueRanges[5]?.values || [];

  const parsedFnb = parseTiepTrienKhaiFnb(fnbRows);
  const parsedBooking = parseTiepTrienKhaiBooking(bookingRows);
  const parsedRetail = parseTiepTrienKhaiRetail(retailRows);
  const parsedTaiKy = parseTiepTrienKhaiTaiKy(taiKyRows);
  const parsedDataTon = parseDataTonSheet(dataTonRows);

  const now = new Date();
  const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  TIEP_TRIEN_KHAI_STATE = {
    fnb: parsedFnb,
    booking: parsedBooking,
    retail: parsedRetail,
    taiky: parsedTaiKy,
    dataTon: parsedDataTon,
    careRate: careRows.length ? careRows : (TIEP_TRIEN_KHAI_STATE?.careRate || null),
    activeTab: TIEP_TRIEN_KHAI_STATE.activeTab || 'all',
    activeDataTonTab: TIEP_TRIEN_KHAI_STATE.activeDataTonTab || 'all',
    savedAt: Date.now(),
    timeStr,
    source
  };

  // Đồng bộ sang BAOCAOSC_STATE
  if (typeof BAOCAOSC_STATE !== 'undefined') {
    BAOCAOSC_STATE.fnbIssue = fnbRows;
    BAOCAOSC_STATE.dataTon = parsedDataTon;
    if (careRows.length) {
      BAOCAOSC_STATE.careRate = careRows;
      if (typeof normalizeCareRateData === 'function') {
        const parsedCare = normalizeCareRateData(careRows);
        if (parsedCare) {
          if (typeof renderBaoCaoScCareSummaryCards === 'function') renderBaoCaoScCareSummaryCards(parsedCare);
          if (typeof renderBaoCaoScCareTable === 'function') renderBaoCaoScCareTable(parsedCare);
        }
      }
    }
  }
}

/**
 * Nạp lại khi người dùng bấm nút
 */
function reloadTiepTrienKhai(force = true) {
  loadTiepTrienKhaiData(force, false);
}

/* ==========================================================================
   4. USER INTERACTIONS & NAVIGATION (DROPDOWN & PILLS)
   ========================================================================== */

/**
 * Sự kiện chọn Dropdown "Các tệp triển khai"
 */
function onBscTiepTrienKhaiChange(val) {
  selectBscTiepTab(val);
}

/**
 * Chuyển đổi tab tệp triển khai (đồng bộ cả Dropdown lẫn Pills)
 */
function selectBscTiepTab(val) {
  if (!['all', 'fnb', 'booking', 'retail', 'taiky'].includes(val)) val = 'all';
  TIEP_TRIEN_KHAI_STATE.activeTab = val;

  // Đồng bộ Dropdown
  const select = $('bscSelectTiepTrienKhai');
  if (select && select.value !== val) {
    select.value = val;
  }

  // Đồng bộ Pill Buttons
  const pillMap = {
    all: 'pillTiepAll',
    fnb: 'pillTiepFnb',
    booking: 'pillTiepBooking',
    retail: 'pillTiepRetail',
    taiky: 'pillTiepTaiKy'
  };

  Object.entries(pillMap).forEach(([k, id]) => {
    const el = $(id);
    if (el) {
      if (k === val) el.classList.add('on');
      else el.classList.remove('on');
    }
  });

  // Hiển thị / Ẩn các khối tương ứng
  const secFnb = $('bscSecTiepFnb');
  const secBooking = $('bscSecTiepBooking');
  const secRetail = $('bscSecTiepRetail');
  const secTaiKy = $('bscSecTiepTaiKy');

  if (secFnb) secFnb.style.display = (val === 'all' || val === 'fnb') ? 'block' : 'none';
  if (secBooking) secBooking.style.display = (val === 'all' || val === 'booking') ? 'block' : 'none';
  if (secRetail) secRetail.style.display = (val === 'all' || val === 'retail') ? 'block' : 'none';
  if (secTaiKy) secTaiKy.style.display = (val === 'all' || val === 'taiky') ? 'block' : 'none';
}

/* ==========================================================================
   5. UI RENDERING (CARD KPIS & BẢNG EXCEL ĐẸP MẮT)
   ========================================================================== */

function renderTiepTrienKhai() {
  const container = $('bscTiepContainer');
  if (container) {
    renderFnbGroupUI(TIEP_TRIEN_KHAI_STATE.fnb);
    renderBookingGroupUI(TIEP_TRIEN_KHAI_STATE.booking);
    renderRetailGroupUI(TIEP_TRIEN_KHAI_STATE.retail);
    renderTaiKyGroupUI(TIEP_TRIEN_KHAI_STATE.taiky);

    // Áp dụng trạng thái lọc tab hiện tại
    selectBscTiepTab(TIEP_TRIEN_KHAI_STATE.activeTab || 'all');
  }

  // Render Mục 9: Báo Cáo Data Tồn
  if (typeof renderDataTonMuc9UI === 'function') {
    renderDataTonMuc9UI(TIEP_TRIEN_KHAI_STATE.dataTon);
  }
}

/**
 * 5.1: Giao diện Nhóm FNB lớn / lỗi (cột A:B)
 */
function renderFnbGroupUI(parsed) {
  const boxCards = $('bscTiepFnbCards');
  const boxTbl = $('bscTiepFnbTableWrap');
  if (!parsed) return;

  const K = (label, val, sub, color = '') => `
    <div class="card kpi">
      <div class="l">${label}</div>
      <div class="v" style="${color}">${val}</div>
      <div class="s">${sub}</div>
    </div>`;

  if (boxCards) {
    boxCards.innerHTML =
      K('🍔 Tổng Case F&B Rà Soát', `${n0(parsed.grandTotal)} case`, `Ghi nhận qua ${parsed.items.length} nhóm vấn đề (${esc(parsed.month)})`, 'color:#ea580c') +
      K('⚠️ Tỷ Lệ Lỗi Vận Hành', `${parsed.errorRateRow.value}`, `Nhóm lỗi kỹ thuật & thiết bị in bếp`, 'color:#ef4444') +
      K('📖 Hướng Dẫn SD & Cài Đặt', `${n0(parsed.guideCount)} case`, `Chiếm tỷ trọng cao nhất: <b style="color:#10b981">${((parsed.guideCount / parsed.grandTotal) * 100).toFixed(1)}%</b>`, 'color:#10b981') +
      K('💻 Lỗi App/POS & Treo Lag', `${n0(parsed.appPosCount)} case`, `Chiếm: <b style="color:#f59e0b">${((parsed.appPosCount / parsed.grandTotal) * 100).toFixed(1)}%</b> tổng tệp`, 'color:#f59e0b');
  }

  if (boxTbl) {
    let items = [...parsed.items];
    const q = (TIEP_SEARCH_SORT.fnbQuery || '').trim().toLowerCase();
    if (q) {
      items = items.filter(it => it.name.toLowerCase().includes(q));
    }

    const { k, dir } = TIEP_SEARCH_SORT.fnbSort;
    items.sort((a, b) => {
      if (k === 'id') return dir * (a.id - b.id);
      if (k === 'name') return dir * a.name.localeCompare(b.name, 'vi');
      if (k === 'count' || k === 'pct') return dir * (a.count - b.count);
      return 0;
    });

    const sortArrow = col => (k === col ? (dir === 1 ? ' ▲' : ' ▼') : ' ⇅');

    let html = `<table class="kpi-table" style="width:100%">
      <thead>
        <tr>
          <th onclick="sortTiepFnb('id')" style="width:55px;text-align:center;cursor:pointer">STT${sortArrow('id')}</th>
          <th onclick="sortTiepFnb('name')" style="text-align:left;cursor:pointer">Nhóm Lỗi / Vấn Đề Phát Sinh${sortArrow('name')}</th>
          <th onclick="sortTiepFnb('count')" style="width:140px;text-align:center;cursor:pointer">Số Lượng Case${sortArrow('count')}</th>
          <th onclick="sortTiepFnb('pct')" style="width:200px;text-align:center;cursor:pointer">Tỷ Trọng Đóng Góp${sortArrow('pct')}</th>
        </tr>
      </thead>
      <tbody>`;

    if (!items.length) {
      html += `<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--mut)">Không có dữ liệu phù hợp với tìm kiếm</td></tr>`;
    } else {
      items.forEach(it => {
        const isError = it.name.toLowerCase().includes('lỗi') || it.name.toLowerCase().includes('chậm') || it.name.toLowerCase().includes('treo');
        const colorBar = isError ? '#ef4444' : '#10b981';

        html += `<tr>
          <td style="text-align:center;font-weight:600;color:var(--mut)">${it.id}</td>
          <td style="text-align:left;font-weight:600">
            <span style="display:inline-block;margin-right:6px">${isError ? '⚠️' : '📘'}</span>
            <span>${esc(it.name)}</span>
          </td>
          <td style="text-align:center;font-weight:700;color:var(--tx-heading);font-size:14px">${n0(it.count)}</td>
          <td style="text-align:center">
            <div style="display:flex;align-items:center;gap:8px;justify-content:center">
              <div style="flex:1;max-width:110px;height:7px;background:rgba(255,255,255,0.08);border-radius:4px;overflow:hidden">
                <div style="width:${Math.min(100, it.pct)}%;height:100%;background:${colorBar};border-radius:4px"></div>
              </div>
              <span style="font-weight:700;font-size:12px;color:var(--tx-heading);width:50px;text-align:right">${it.pct.toFixed(2)}%</span>
            </div>
          </td>
        </tr>`;
      });
    }

    // Dòng tổng cộng và tỷ lệ lỗi
    html += `</tbody>
      <tfoot>
        <tr style="background:var(--card-sub);font-weight:800;border-top:2px solid var(--line)">
          <td style="text-align:center">∑</td>
          <td style="text-align:left;text-transform:uppercase;color:var(--tx-heading)">${esc(parsed.totalRow.name)}</td>
          <td style="text-align:center;font-size:14px;color:#f59e0b">${n0(parsed.grandTotal)}</td>
          <td style="text-align:center;color:#f59e0b;font-size:13px">100.00%</td>
        </tr>
        <tr style="background:rgba(239,68,68,0.08);font-weight:800">
          <td style="text-align:center;color:#ef4444">⚠️</td>
          <td style="text-align:left;color:#ef4444">${esc(parsed.errorRateRow.name)}</td>
          <td colspan="2" style="text-align:center;font-size:14.5px;color:#ef4444">${esc(parsed.errorRateRow.value)}</td>
        </tr>
      </tfoot>
    </table>`;

    boxTbl.innerHTML = html;
  }
}

function onFnbSearch(q) {
  TIEP_SEARCH_SORT.fnbQuery = q;
  renderFnbGroupUI(TIEP_TRIEN_KHAI_STATE.fnb);
}

function sortTiepFnb(col) {
  if (TIEP_SEARCH_SORT.fnbSort.k === col) {
    TIEP_SEARCH_SORT.fnbSort.dir = -TIEP_SEARCH_SORT.fnbSort.dir;
  } else {
    TIEP_SEARCH_SORT.fnbSort.k = col;
    TIEP_SEARCH_SORT.fnbSort.dir = (col === 'name' || col === 'id') ? 1 : -1;
  }
  renderFnbGroupUI(TIEP_TRIEN_KHAI_STATE.fnb);
}

/**
 * 5.2: Giao diện Nhóm Booking 3 Hotel sao (cột D:H)
 */
function renderBookingGroupUI(parsed) {
  const boxCards = $('bscTiepBookingCards');
  const boxTbl1 = $('bscTiepBookingTbl1');
  const boxTbl2 = $('bscTiepBookingTbl2');
  const boxTbl3 = $('bscTiepBookingTbl3');
  if (!parsed) return;

  const K = (label, val, sub, color = '') => `
    <div class="card kpi">
      <div class="l">${label}</div>
      <div class="v" style="${color}">${val}</div>
      <div class="s">${sub}</div>
    </div>`;

  const t1Tot = parsed.tbl1.total || [];
  const totCustomer = t1Tot[1] ? n0(_parseValNumber(t1Tot[1])) : '75';
  const totImpact = t1Tot[3] ? n0(_parseValNumber(t1Tot[3])) : '36';
  const totImpactPct = t1Tot[4] || '48.00%';

  const t2Tot = parsed.tbl2.total ? parsed.tbl2.total.count : '18';

  if (boxCards) {
    boxCards.innerHTML =
      K('🏨 Tổng Khách Booking 3 Sao', `${totCustomer} khách`, `Rà soát toàn bộ tệp (${esc(parsed.month)})`, 'color:#0284c7') +
      K('🎯 Tiếp Cận Trực Tiếp', `25 khách (33.3%)`, `Trao đổi qua call: 39 khách (52.0%)`, 'color:#38bdf8') +
      K('⚡ Số Lượng Khách Impact', `${totImpact} khách`, `Tỷ lệ Impact toàn tệp: <b style="color:#10b981">${totImpactPct}</b>`, 'color:#10b981') +
      K('📋 Lượt Ghi Nhận Lỗi / Nhu Cầu', `${t2Tot} lượt`, `Phân bổ qua 3 nhóm vấn đề chính`, 'color:#f59e0b');
  }

  // Bảng 1: Tình trạng trao đổi & impact
  if (boxTbl1) {
    let html = `<table class="kpi-table" style="width:100%">
      <thead>
        <tr>
          <th style="width:50px;text-align:center">STT</th>
          <th style="text-align:left">Tình Trạng Trao Đổi</th>
          <th style="text-align:center">Số Lượng</th>
          <th style="text-align:center">Tỷ Lệ Tiếp Cận Trực Tiếp</th>
          <th style="text-align:center">Số Khách Impact</th>
          <th style="text-align:center">Tỷ Lệ Impact</th>
        </tr>
      </thead>
      <tbody>`;

    parsed.tbl1.rows.forEach((r, i) => {
      html += `<tr>
        <td style="text-align:center;font-weight:600;color:var(--mut)">${i + 1}</td>
        <td style="text-align:left;font-weight:600;color:var(--tx-heading)">${esc(r[0])}</td>
        <td style="text-align:center;font-weight:700">${n0(_parseValNumber(r[1]))}</td>
        <td style="text-align:center;font-weight:600;color:#38bdf8">${esc(r[2])}</td>
        <td style="text-align:center;font-weight:700;color:#10b981">${n0(_parseValNumber(r[3]))}</td>
        <td style="text-align:center;font-weight:700;color:#10b981">${esc(r[4])}</td>
      </tr>`;
    });

    if (parsed.tbl1.total) {
      html += `</tbody>
      <tfoot>
        <tr style="background:var(--card-sub);font-weight:800;border-top:2px solid var(--line)">
          <td style="text-align:center">∑</td>
          <td style="text-align:left;color:var(--tx-heading);text-transform:uppercase">${esc(parsed.tbl1.total[0])}</td>
          <td style="text-align:center;font-size:14px;color:#f59e0b">${n0(_parseValNumber(parsed.tbl1.total[1]))}</td>
          <td style="text-align:center;color:#38bdf8">${esc(parsed.tbl1.total[2])}</td>
          <td style="text-align:center;color:#10b981">${n0(_parseValNumber(parsed.tbl1.total[3]))}</td>
          <td style="text-align:center;color:#10b981;font-size:14px">${esc(parsed.tbl1.total[4])}</td>
        </tr>
      </tfoot>`;
    } else {
      html += `</tbody>`;
    }
    html += `</table>`;
    boxTbl1.innerHTML = html;
  }

  // Bảng 2: Chi tiết nhóm vấn đề & nội dung lỗi
  if (boxTbl2) {
    let html = `<table class="kpi-table" style="width:100%">
      <thead>
        <tr>
          <th style="width:50px;text-align:center">STT</th>
          <th style="text-align:left;min-width:200px">Nhóm Vấn Đề</th>
          <th style="text-align:left;min-width:320px">Nội Dung Lỗi / Hạn Chế</th>
          <th style="width:120px;text-align:center">Số Lượng Ghi Nhận</th>
        </tr>
      </thead>
      <tbody>`;

    parsed.tbl2.rows.forEach((r, i) => {
      const isNewGroup = i === 0 || r.group !== parsed.tbl2.rows[i - 1].group;
      html += `<tr>
        <td style="text-align:center;font-weight:600;color:var(--mut)">${i + 1}</td>
        <td style="text-align:left;font-weight:700;color:#38bdf8">${isNewGroup ? esc(r.group) : '<span style="color:var(--mut)">〃</span>'}</td>
        <td style="text-align:left;font-weight:500;color:var(--tx)">${esc(r.content)}</td>
        <td style="text-align:center;font-weight:700;color:var(--tx-heading)">${esc(r.count)}</td>
      </tr>`;
    });

    if (parsed.tbl2.total) {
      html += `</tbody>
      <tfoot>
        <tr style="background:var(--card-sub);font-weight:800;border-top:2px solid var(--line)">
          <td style="text-align:center">∑</td>
          <td colspan="2" style="text-align:left;color:var(--tx-heading);text-transform:uppercase">${esc(parsed.tbl2.total.name)}</td>
          <td style="text-align:center;font-size:14px;color:#f59e0b">${esc(parsed.tbl2.total.count)}</td>
        </tr>
      </tfoot>`;
    } else {
      html += `</tbody>`;
    }
    html += `</table>`;
    boxTbl2.innerHTML = html;
  }

  // Bảng 3: Các nhóm vấn đề chính
  if (boxTbl3) {
    let html = `<table class="kpi-table" style="width:100%">
      <thead>
        <tr>
          <th style="width:50px;text-align:center">STT</th>
          <th style="text-align:left;min-width:220px">${esc(parsed.tbl3.headers[0] || 'Nhóm Vấn Đề')}</th>
          <th style="text-align:left">${esc(parsed.tbl3.headers[1] || 'Nội Dung Ghi Nhận')}</th>
        </tr>
      </thead>
      <tbody>`;

    parsed.tbl3.rows.forEach((r, i) => {
      html += `<tr>
        <td style="text-align:center;font-weight:600;color:var(--mut)">${i + 1}</td>
        <td style="text-align:left;font-weight:700;color:#f59e0b">${esc(r.group)}</td>
        <td style="text-align:left;color:var(--tx)">${esc(r.content)}</td>
      </tr>`;
    });

    html += `</tbody></table>`;
    boxTbl3.innerHTML = html;
  }
}

/**
 * 8.3: Giao diện Nhóm retail lớn HDDT (cột J:P hoặc sheet Report)
 */
function renderRetailGroupUI(parsed) {
  const boxCards = $('bscTiepRetailCards');
  const boxTbl1 = $('bscTiepRetailTbl1');
  const boxTbl2 = $('bscTiepRetailTbl2');
  const boxTblUsage = $('bscTiepRetailTblUsage');
  const boxTbl3 = $('bscTiepRetailTbl3');
  const boxTbl4 = $('bscTiepRetailTbl4');
  if (!parsed) return;

  const K = (label, val, sub, color = '') => `
    <div class="card kpi">
      <div class="l">${label}</div>
      <div class="v" style="${color}">${val}</div>
      <div class="s">${sub}</div>
    </div>`;

  const t1Tot = parsed.tbl1.total || [];
  const totGH = t1Tot[1] ? n0(_parseValNumber(t1Tot[1])) : '108';
  const totImpact = t1Tot[3] ? n0(_parseValNumber(t1Tot[3])) : '20';
  const totImpactPct = t1Tot[4] || '18.52%';

  // Cửa hàng đang mở / đóng cửa từ tbl1.rows
  let moCuaVal = '57 GH (52.8%)';
  let dongCuaSub = 'Đóng cửa: 33 GH (30.6%) · Không có CH/KTT: 18 GH';
  if (parsed.tbl1 && Array.isArray(parsed.tbl1.rows)) {
    const rMo = parsed.tbl1.rows.find(r => String(r[0] || '').toLowerCase().includes('mở cửa'));
    const rDong = parsed.tbl1.rows.find(r => String(r[0] || '').toLowerCase().includes('đóng cửa'));
    const rKoCH = parsed.tbl1.rows.find(r => String(r[0] || '').toLowerCase().includes('không có'));
    const rOpt = parsed.tbl1.rows.find(r => String(r[0] || '').toLowerCase().includes('không tồn tại'));
    if (rMo) {
      moCuaVal = `${rMo[1]} GH (${rMo[2] || ''})`;
    }
    const dCount = rDong ? rDong[1] : '33';
    const dPct = rDong ? rDong[2] : '30.6%';
    const kCount = rKoCH ? parseInt(rKoCH[1] || 0) : 16;
    const optCount = rOpt ? parseInt(rOpt[1] || 0) : 2;
    dongCuaSub = `Đóng cửa: ${dCount} GH (${dPct}) · Không có CH/KTT: ${kCount + optCount} GH`;
  }

  // Tình trạng dùng bên khác từ tblUsage hoặc tbl3
  let useKhacVal = '35 GH (34.0%)';
  let useKhacSub = 'Dùng 100% bên khác: 29 GH · Dùng song song: 6 GH';
  if (parsed.tblUsage && Array.isArray(parsed.tblUsage.rows)) {
    const r100 = parsed.tblUsage.rows.find(r => String(r[0] || '').toLowerCase().includes('100% bên khác'));
    const rSongSong = parsed.tblUsage.rows.find(r => String(r[0] || '').toLowerCase().includes('song song'));
    if (r100 && rSongSong) {
      const c100 = _parseValNumber(r100[1]);
      const cSS = _parseValNumber(rSongSong[1]);
      const totU = _parseValNumber(parsed.tblUsage.total ? parsed.tblUsage.total[1] : 103);
      const sum = c100 + cSS;
      const pct = totU > 0 ? ((sum / totU) * 100).toFixed(1) + '%' : '34.0%';
      useKhacVal = `${sum} GH (${pct})`;
      useKhacSub = `Dùng 100% bên khác: ${c100} GH · Song song: ${cSS} GH`;
    }
  }

  if (boxCards) {
    boxCards.innerHTML =
      K('🛒 Tổng Gian Hàng HĐĐT', `${totGH} GH`, `Rà soát gian hàng Retail lớn (${esc(parsed.month)})`, 'color:#8b5cf6') +
      K('🏪 Cửa Hàng Đang Mở', moCuaVal, dongCuaSub, 'color:#a78bfa') +
      K('⚡ Số Lượng Khách Impact', `${totImpact} GH`, `Tỷ lệ Impact toàn tệp: <b style="color:#10b981">${totImpactPct}</b>`, 'color:#10b981') +
      K('📑 Dùng Bên Khác / Song Song', useKhacVal, useKhacSub, 'color:#f59e0b');
  }

  // Bảng 1: Thực trạng cửa hàng & Impact
  if (boxTbl1) {
    let html = `<table class="kpi-table" style="width:100%">
      <thead>
        <tr>
          <th style="width:50px;text-align:center">STT</th>
          <th style="text-align:left">Thực Trạng Cửa Hàng / Công Ty</th>
          <th style="text-align:center">Số Lượng</th>
          <th style="text-align:center">Tỷ Lệ Tiếp Cận Trực Tiếp</th>
          <th style="text-align:center">Số Khách Impact</th>
          <th style="text-align:center">Tỷ Lệ Impact</th>
        </tr>
      </thead>
      <tbody>`;

    parsed.tbl1.rows.forEach((r, i) => {
      html += `<tr>
        <td style="text-align:center;font-weight:600;color:var(--mut)">${i + 1}</td>
        <td style="text-align:left;font-weight:600;color:var(--tx-heading)">${esc(r[0])}</td>
        <td style="text-align:center;font-weight:700">${n0(_parseValNumber(r[1]))}</td>
        <td style="text-align:center;font-weight:600;color:#a78bfa">${esc(r[2])}</td>
        <td style="text-align:center;font-weight:700;color:#10b981">${n0(_parseValNumber(r[3]))}</td>
        <td style="text-align:center;font-weight:700;color:#10b981">${esc(r[4])}</td>
      </tr>`;
    });

    if (parsed.tbl1.total) {
      html += `</tbody>
      <tfoot>
        <tr style="background:var(--card-sub);font-weight:800;border-top:2px solid var(--line)">
          <td style="text-align:center">∑</td>
          <td style="text-align:left;color:var(--tx-heading);text-transform:uppercase">${esc(parsed.tbl1.total[0])}</td>
          <td style="text-align:center;font-size:14px;color:#f59e0b">${n0(_parseValNumber(parsed.tbl1.total[1]))}</td>
          <td style="text-align:center;color:#a78bfa">${esc(parsed.tbl1.total[2])}</td>
          <td style="text-align:center;color:#10b981">${n0(_parseValNumber(parsed.tbl1.total[3]))}</td>
          <td style="text-align:center;color:#10b981;font-size:14px">${esc(parsed.tbl1.total[4])}</td>
        </tr>
      </tfoot>`;
    } else {
      html += `</tbody>`;
    }
    html += `</table>`;
    boxTbl1.innerHTML = html;
  }

  // Bảng 2: Tình trạng trao đổi
  if (boxTbl2) {
    let html = `<table class="kpi-table" style="width:100%">
      <thead>
        <tr>
          <th style="width:50px;text-align:center">STT</th>
          <th style="text-align:left">Hình Thức Trao Đổi</th>
          <th style="text-align:center">Số Lượng GH</th>
          <th style="text-align:center">Tỷ Lệ Tiếp Cận (%)</th>
        </tr>
      </thead>
      <tbody>`;

    parsed.tbl2.rows.forEach((r, i) => {
      html += `<tr>
        <td style="text-align:center;font-weight:600;color:var(--mut)">${i + 1}</td>
        <td style="text-align:left;font-weight:600;color:var(--tx-heading)">${esc(r[0])}</td>
        <td style="text-align:center;font-weight:700">${n0(_parseValNumber(r[1]))}</td>
        <td style="text-align:center;font-weight:600;color:#38bdf8">${esc(r[2])}</td>
      </tr>`;
    });

    if (parsed.tbl2.total) {
      html += `</tbody>
      <tfoot>
        <tr style="background:var(--card-sub);font-weight:800;border-top:2px solid var(--line)">
          <td style="text-align:center">∑</td>
          <td style="text-align:left;color:var(--tx-heading);text-transform:uppercase">${esc(parsed.tbl2.total[0])}</td>
          <td style="text-align:center;font-size:14px;color:#f59e0b">${n0(_parseValNumber(parsed.tbl2.total[1]))}</td>
          <td style="text-align:center;color:#38bdf8">${esc(parsed.tbl2.total[2])}</td>
        </tr>
      </tfoot>`;
    } else {
      html += `</tbody>`;
    }
    html += `</table>`;
    boxTbl2.innerHTML = html;
  }

  // Bảng 2b: Tình trạng sử dụng phần mềm HĐĐT
  if (boxTblUsage) {
    if (parsed.tblUsage && Array.isArray(parsed.tblUsage.rows) && parsed.tblUsage.rows.length) {
      let html = `<table class="kpi-table" style="width:100%">
        <thead>
          <tr>
            <th style="width:45px;text-align:center">STT</th>
            <th style="text-align:left">${esc(parsed.tblUsage.headers[0] || 'Tình Trạng Sử Dụng')}</th>
            <th style="text-align:center;width:110px">${esc(parsed.tblUsage.headers[1] || 'Số Gian Hàng')}</th>
            <th style="text-align:center;width:95px">${esc(parsed.tblUsage.headers[2] || 'Tỷ Trọng')}</th>
          </tr>
        </thead>
        <tbody>`;

      parsed.tblUsage.rows.forEach((r, i) => {
        html += `<tr>
          <td style="text-align:center;font-weight:600;color:var(--mut)">${i + 1}</td>
          <td style="text-align:left;font-weight:600;color:var(--tx-heading)">${esc(r[0])}</td>
          <td style="text-align:center;font-weight:700">${n0(_parseValNumber(r[1]))}</td>
          <td style="text-align:center;font-weight:600;color:#38bdf8">${esc(r[2])}</td>
        </tr>`;
      });

      if (parsed.tblUsage.total) {
        html += `</tbody>
        <tfoot>
          <tr style="background:var(--card-sub);font-weight:800;border-top:2px solid var(--line)">
            <td style="text-align:center">∑</td>
            <td style="text-align:left;color:var(--tx-heading);text-transform:uppercase">${esc(parsed.tblUsage.total[0])}</td>
            <td style="text-align:center;font-size:14px;color:#f59e0b">${n0(_parseValNumber(parsed.tblUsage.total[1]))}</td>
            <td style="text-align:center;color:#38bdf8">${esc(parsed.tblUsage.total[2])}</td>
          </tr>
        </tfoot>`;
      } else {
        html += `</tbody>`;
      }
      html += `</table>`;
      boxTblUsage.innerHTML = html;
    } else {
      boxTblUsage.innerHTML = `<div style="padding:14px;text-align:center;color:var(--mut)">Chưa có dữ liệu tình trạng sử dụng</div>`;
    }
  }

  // Bảng 3: Nguyên nhân khách sử dụng song song
  if (boxTbl3) {
    let html = `<table class="kpi-table" style="width:100%">
      <thead>
        <tr>
          <th style="width:50px;text-align:center">STT</th>
          <th style="text-align:left;min-width:220px">${esc(parsed.tbl3.headers[0] || 'Nhóm Nguyên Nhân')}</th>
          <th style="text-align:left">${esc(parsed.tbl3.headers[1] || 'Phân Tích Thực Tế')}</th>
          <th style="width:120px;text-align:center">${esc(parsed.tbl3.headers[2] || 'Số Gian Hàng')}</th>
        </tr>
      </thead>
      <tbody>`;

    parsed.tbl3.rows.forEach((r, i) => {
      html += `<tr>
        <td style="text-align:center;font-weight:600;color:var(--mut)">${i + 1}</td>
        <td style="text-align:left;font-weight:700;color:#f43f5e">${esc(r[0])}</td>
        <td style="text-align:left;color:var(--tx)">${esc(r[1])}</td>
        <td style="text-align:center;font-weight:700;font-size:14px;color:var(--tx-heading)">${esc(r[2])}</td>
      </tr>`;
    });

    html += `</tbody></table>`;
    boxTbl3.innerHTML = html;
  }

  // Bảng 4: Vấn đề phát sinh và đề xuất HDDT (5 cột)
  if (boxTbl4) {
    const hasKat = parsed.tbl4.rows.some(r => r[4] && String(r[4]).trim() !== '');
    let html = `<table class="kpi-table" style="width:100%">
      <thead>
        <tr>
          <th style="width:45px;text-align:center">STT</th>
          <th style="text-align:left;width:170px">${esc(parsed.tbl4.headers[0] || 'Nhóm Vấn Đề')}</th>
          <th style="text-align:left;min-width:220px">${esc(parsed.tbl4.headers[1] || 'Vấn Đề Khách Hàng Phản Ánh')}</th>
          <th style="width:75px;text-align:center">${esc(parsed.tbl4.headers[2] || 'Số GH')}</th>
          <th style="text-align:left;min-width:220px">${esc(parsed.tbl4.headers[3] || 'Đề Xuất')}</th>
          ${hasKat ? `<th style="text-align:left;min-width:260px">${esc(parsed.tbl4.headers[4] || 'Ý Kiến / Phản Hồi KAT')}</th>` : ''}
        </tr>
      </thead>
      <tbody>`;

    parsed.tbl4.rows.forEach((r, i) => {
      const katText = r[4] ? esc(r[4]).replace(/\n/g, '<br>') : '-';
      html += `<tr>
        <td style="text-align:center;font-weight:600;color:var(--mut)">${i + 1}</td>
        <td style="text-align:left;font-weight:700;color:#0ea5e9">${esc(r[0])}</td>
        <td style="text-align:left;color:var(--tx)">${esc(r[1])}</td>
        <td style="text-align:center;font-weight:700;font-size:14px;color:var(--tx-heading)">${esc(r[2])}</td>
        <td style="text-align:left;color:var(--tx);font-size:12.5px">${esc(r[3] || '-')}</td>
        ${hasKat ? `<td style="text-align:left;font-size:12px;color:var(--tx);background:rgba(14,165,233,0.04);border-left:2px solid rgba(14,165,233,0.3);line-height:1.4">${katText}</td>` : ''}
      </tr>`;
    });

    html += `</tbody></table>`;
    boxTbl4.innerHTML = html;
  }
}

/**
 * 8.4: Giao diện Nhóm Hỗ Trợ Tái Ký (cột Q:T)
 */
function renderTaiKyGroupUI(parsed) {
  const boxCards = $('bscTiepTaiKyCards');
  const boxTbl = $('bscTiepTaiKyTbl');
  if (!parsed) return;

  const K = (label, val, sub, color = '') => `
    <div class="card kpi">
      <div class="l">${label}</div>
      <div class="v" style="${color}">${val}</div>
      <div class="s">${sub}</div>
    </div>`;

  const itBanHang = (parsed.items || []).find(it => it.name.toLowerCase().includes('bán hàng'));
  const itThanhCong = (parsed.items || []).find(it => it.name.toLowerCase().includes('thành công'));
  const grand = parsed.grandTotal || 36;
  const cBanHang = itBanHang ? itBanHang.count : 18;
  const sBanHang = itBanHang && itBanHang.success != null ? itBanHang.success : 11;
  const rateBanHang = itBanHang && itBanHang.rate ? itBanHang.rate : '61,11%';
  const cThanhCong = itThanhCong ? itThanhCong.count : 18;

  if (boxCards) {
    boxCards.innerHTML =
      K('🔄 Tổng Gian Hàng Tái Ký', `${n0(grand)} GH`, `Rà soát toàn bộ tệp (${esc(parsed.month || 'Tháng 11')})`, 'color:#10b981') +
      K('🛒 Nhóm Đang Bán Hàng', `${n0(cBanHang)} GH (${((cBanHang / grand) * 100).toFixed(1)}%)`, `Phát sinh giao dịch trước khi SC đến`, 'color:#38bdf8') +
      K('🎯 Tái Ký Thành Công (Bán Hàng)', `${n0(sBanHang)} GH`, `Tỷ lệ thành công: <b style="color:#10b981">${esc(rateBanHang)}</b>`, 'color:#10b981') +
      K('✅ Nhóm Đã Thành Công', `${n0(cThanhCong)} GH (${((cThanhCong / grand) * 100).toFixed(1)}%)`, `Khách hàng chốt tái ký thành công`, 'color:#f59e0b');
  }

  if (boxTbl) {
    let html = `<table class="kpi-table" style="width:100%">
      <thead>
        <tr>
          <th style="width:55px;text-align:center">STT</th>
          <th style="text-align:left">Tình Trạng Gian Hàng Trước Khi SC Đi</th>
          <th style="width:140px;text-align:center">Số Lượng GH</th>
          <th style="width:150px;text-align:center">Hỗ Trợ Thành Công</th>
          <th style="width:180px;text-align:center">Tỷ Lệ Thành Công</th>
        </tr>
      </thead>
      <tbody>`;

    (parsed.items || []).forEach((it, i) => {
      const isSuccess = it.name.toLowerCase().includes('thành công');
      const badgeIcon = isSuccess ? '✅' : '🛒';
      const pctVal = _parseValNumber(it.rate);

      html += `<tr>
        <td style="text-align:center;font-weight:600;color:var(--mut)">${i + 1}</td>
        <td style="text-align:left;font-weight:700;color:var(--tx-heading)">
          <span style="margin-right:6px">${badgeIcon}</span>
          <span>${esc(it.name)}</span>
        </td>
        <td style="text-align:center;font-weight:700;font-size:14px;color:var(--tx-heading)">${n0(it.count)}</td>
        <td style="text-align:center;font-weight:700;color:#10b981;font-size:14px">
          ${it.success != null ? n0(it.success) : (it.rawSuccess || (isSuccess ? n0(it.count) : '–'))}
        </td>
        <td style="text-align:center">
          ${it.rate ? `
            <div style="display:flex;align-items:center;gap:8px;justify-content:center">
              <div style="flex:1;max-width:90px;height:7px;background:rgba(255,255,255,0.08);border-radius:4px;overflow:hidden">
                <div style="width:${Math.min(100, pctVal)}%;height:100%;background:#10b981;border-radius:4px"></div>
              </div>
              <span style="font-weight:700;font-size:12px;color:#10b981;width:55px;text-align:right">${esc(it.rate)}</span>
            </div>
          ` : (isSuccess ? '<span style="color:#10b981;font-weight:700">100.00%</span>' : '–')}
        </td>
      </tr>`;
    });

    const totCount = parsed.totalRow ? parsed.totalRow.count : grand;
    const totSuccess = parsed.totalRow && parsed.totalRow.success != null ? parsed.totalRow.success : (sBanHang + cThanhCong);
    const totRate = parsed.totalRow && parsed.totalRow.rate ? parsed.totalRow.rate : `${((totSuccess / totCount) * 100).toFixed(2)}%`;

    html += `</tbody>
      <tfoot>
        <tr style="background:var(--card-sub);font-weight:800;border-top:2px solid var(--line)">
          <td style="text-align:center">∑</td>
          <td style="text-align:left;text-transform:uppercase;color:var(--tx-heading)">${esc(parsed.totalRow ? parsed.totalRow.name : 'TỔNG CỘNG')}</td>
          <td style="text-align:center;font-size:14px;color:#f59e0b">${n0(totCount)}</td>
          <td style="text-align:center;font-size:14px;color:#10b981">${n0(totSuccess)}</td>
          <td style="text-align:center;font-size:13.5px;color:#10b981">${esc(totRate)}</td>
        </tr>
      </tfoot>
    </table>`;

    boxTbl.innerHTML = html;
  }
}

/* ==========================================================================
   6. CSV EXPORT UTILITIES (CHUẨN UTF-8 VỚI BOM)
   ========================================================================== */

function exportCurrentTiepCsv() {
  const tab = TIEP_TRIEN_KHAI_STATE.activeTab || 'all';
  if (tab === 'fnb') exportTiepFnbCsv();
  else if (tab === 'booking') exportTiepBookingCsv();
  else if (tab === 'retail') exportTiepRetailCsv();
  else if (tab === 'taiky') exportTiepTaiKyCsv();
  else exportAllTiepTrienKhaiCsv();
}

function _downloadCsvFile(filename, csvContent) {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportTiepFnbCsv() {
  const p = TIEP_TRIEN_KHAI_STATE.fnb;
  if (!p) return showToast('Chưa có dữ liệu F&B để xuất CSV', false);

  const lines = [
    ['BÁO CÁO CÁC TỆP TRIỂN KHAI - MỤC 8.1: NHÓM FNB LỚN / LỖI (' + p.month + ')'],
    ['STT', 'Nhóm Lỗi / Vấn Đề', 'Số Lượng Case', 'Tỷ Trọng (%)']
  ];

  p.items.forEach(it => {
    lines.push([it.id, it.name, it.count, it.pct.toFixed(2) + '%']);
  });
  lines.push(['TỔNG CỘNG', '', p.grandTotal, '100.00%']);
  lines.push(['TỶ LỆ LỖI', '', p.errorRateRow.value, '']);

  const csv = lines.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  _downloadCsvFile(`BaoCao_TiepTrienKhai_FNB_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  showToast('Đã xuất file CSV Nhóm FNB lớn thành công!', true);
}

function exportTiepBookingCsv() {
  const p = TIEP_TRIEN_KHAI_STATE.booking;
  if (!p) return showToast('Chưa có dữ liệu Booking để xuất CSV', false);

  const lines = [
    ['BÁO CÁO CÁC TỆP TRIỂN KHAI - MỤC 8.2: NHÓM BOOKING 3 HOTEL SAO (' + p.month + ')'],
    [],
    ['--- BẢNG 1: TÌNH TRẠNG TRAO ĐỔI & IMPACT ---'],
    p.tbl1.headers
  ];

  p.tbl1.rows.forEach((r, i) => lines.push([i + 1, ...r]));
  if (p.tbl1.total) lines.push(['TỔNG CỘNG', ...p.tbl1.total.slice(1)]);

  lines.push([]);
  lines.push(['--- BẢNG 2: CHI TIẾT NHÓM VẤN ĐỀ & LỖI / HẠN CHẾ ---']);
  lines.push(['STT', 'Nhóm Vấn Đề', 'Nội Dung Lỗi / Hạn Chế', 'Số Lượng Ghi Nhận']);
  p.tbl2.rows.forEach((r, i) => lines.push([i + 1, r.group, r.content, r.count]));
  if (p.tbl2.total) lines.push(['TỔNG LƯỢT GHI NHẬN', '', '', p.tbl2.total.count]);

  lines.push([]);
  lines.push(['--- BẢNG 3: CÁC NHÓM VẤN ĐỀ CHÍNH ---']);
  lines.push(['STT', 'Nhóm Vấn Đề', 'Nội Dung Ghi Nhận']);
  p.tbl3.rows.forEach((r, i) => lines.push([i + 1, r.group, r.content]));

  const csv = lines.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  _downloadCsvFile(`BaoCao_TiepTrienKhai_Booking_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  showToast('Đã xuất file CSV Nhóm Booking 3 sao thành công!', true);
}

function exportTiepRetailCsv() {
  const p = TIEP_TRIEN_KHAI_STATE.retail;
  if (!p) return showToast('Chưa có dữ liệu Retail để xuất CSV', false);

  const lines = [
    ['BÁO CÁO CÁC TỆP TRIỂN KHAI - MỤC 8.3: NHÓM RETAIL LỚN HDDT (' + (p.month || 'Tháng 11') + ')'],
    ['Thời gian xuất: ' + new Date().toLocaleString('vi-VN')],
    [],
    ['--- BẢNG 1: THỰC TRẠNG CỬA HÀNG & IMPACT ---'],
    ['STT', ...p.tbl1.headers]
  ];

  p.tbl1.rows.forEach((r, i) => lines.push([i + 1, ...r]));
  if (p.tbl1.total) lines.push(['TỔNG CỘNG', ...p.tbl1.total.slice(1)]);

  lines.push([]);
  lines.push(['--- BẢNG 2: TÌNH TRẠNG TRAO ĐỔI ---']);
  lines.push(['STT', ...p.tbl2.headers]);
  p.tbl2.rows.forEach((r, i) => lines.push([i + 1, ...r]));
  if (p.tbl2.total) lines.push(['TỔNG CỘNG', ...p.tbl2.total.slice(1)]);

  if (p.tblUsage && p.tblUsage.rows && p.tblUsage.rows.length) {
    lines.push([]);
    lines.push(['--- BẢNG 2b: TÌNH TRẠNG SỬ DỤNG PHẦN MỀM HĐĐT ---']);
    lines.push(['STT', ...p.tblUsage.headers]);
    p.tblUsage.rows.forEach((r, i) => lines.push([i + 1, ...r]));
    if (p.tblUsage.total) lines.push(['TỔNG CỘNG', ...p.tblUsage.total.slice(1)]);
  }

  lines.push([]);
  lines.push(['--- BẢNG 3: NGUYÊN NHÂN KHÁCH SỬ DỤNG SONG SONG HOẶC CHUYỂN NCC KHÁC ---']);
  lines.push(['STT', ...p.tbl3.headers]);
  p.tbl3.rows.forEach((r, i) => lines.push([i + 1, ...r]));

  lines.push([]);
  lines.push(['--- BẢNG 4: CÁC VẤN ĐỀ PHÁT SINH VÀ ĐỀ XUẤT LIÊN QUAN HDDT ---']);
  lines.push(['STT', ...p.tbl4.headers]);
  p.tbl4.rows.forEach((r, i) => lines.push([i + 1, ...r]));

  const csv = lines.map(r => r.map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  _downloadCsvFile(`BaoCao_TiepTrienKhai_Retail_HDDT_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  showToast('Đã xuất file CSV Nhóm Retail lớn HDDT thành công!', true);
}

function exportTiepTaiKyCsv() {
  const p = TIEP_TRIEN_KHAI_STATE.taiky;
  if (!p) return showToast('Chưa có dữ liệu Tái ký để xuất CSV', false);

  const lines = [
    ['BÁO CÁO CÁC TỆP TRIỂN KHAI - MỤC 8.4: NHÓM HỖ TRỢ TÁI KÝ (' + (p.month || 'Tháng 11') + ')'],
    ['Thời gian xuất: ' + new Date().toLocaleString('vi-VN')],
    [],
    ['STT', 'Tình Trạng Gian Hàng Trước Khi SC Đi', 'Số Lượng GH', 'Hỗ Trợ Thành Công', 'Tỷ Lệ Thành Công']
  ];

  (p.items || []).forEach((it, i) => {
    lines.push([i + 1, it.name, it.count, it.success != null ? it.success : (it.rawSuccess || ''), it.rate || '']);
  });

  const totCount = p.totalRow ? p.totalRow.count : p.grandTotal;
  const totSuccess = p.totalRow && p.totalRow.success != null ? p.totalRow.success : '';
  const totRate = p.totalRow && p.totalRow.rate ? p.totalRow.rate : '';
  lines.push(['TỔNG CỘNG', '', totCount, totSuccess, totRate]);

  const csv = lines.map(r => r.map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  _downloadCsvFile(`BaoCao_TiepTrienKhai_TaiKy_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  showToast('Đã xuất file CSV Nhóm Tái ký thành công!', true);
}

function exportAllTiepTrienKhaiCsv() {
  const lines = [
    ['BÁO CÁO TỔNG HỢP CÁC TỆP TRIỂN KHAI (F&B LỚN - BOOKING 3 SAO - RETAIL LỚN HĐĐT - TÁI KÝ)'],
    ['Thời gian xuất: ' + new Date().toLocaleString('vi-VN')],
    []
  ];

  const pfnb = TIEP_TRIEN_KHAI_STATE.fnb;
  if (pfnb) {
    lines.push(['============================== 8.1: NHÓM FNB LỚN / LỖI ==============================']);
    lines.push(['STT', 'Nhóm Lỗi / Vấn Đề', 'Số Lượng Case', 'Tỷ Trọng (%)']);
    pfnb.items.forEach(it => lines.push([it.id, it.name, it.count, it.pct.toFixed(2) + '%']));
    lines.push(['TỔNG CỘNG', '', pfnb.grandTotal, '100.00%']);
    lines.push(['TỶ LỆ LỖI', '', pfnb.errorRateRow.value, '']);
    lines.push([]);
  }

  const pbook = TIEP_TRIEN_KHAI_STATE.booking;
  if (pbook) {
    lines.push(['============================== 8.2: NHÓM BOOKING 3 HOTEL SAO ==============================']);
    lines.push(pbook.tbl1.headers);
    pbook.tbl1.rows.forEach((r, i) => lines.push([i + 1, ...r]));
    if (pbook.tbl1.total) lines.push(['TỔNG CỘNG', ...pbook.tbl1.total.slice(1)]);
    lines.push([]);
    lines.push(['Chi Tiết Nhóm Vấn Đề / Lỗi / Hạn Chế']);
    lines.push(['STT', 'Nhóm Vấn Đề', 'Nội Dung Lỗi / Hạn Chế', 'Số Lượng Ghi Nhận']);
    pbook.tbl2.rows.forEach((r, i) => lines.push([i + 1, r.group, r.content, r.count]));
    lines.push([]);
  }

  const pret = TIEP_TRIEN_KHAI_STATE.retail;
  if (pret) {
    lines.push(['============================== 8.3: NHÓM RETAIL LỚN HDDT ==============================']);
    lines.push(pret.tbl1.headers);
    pret.tbl1.rows.forEach((r, i) => lines.push([i + 1, ...r]));
    if (pret.tbl1.total) lines.push(['TỔNG CỘNG', ...pret.tbl1.total.slice(1)]);
    lines.push([]);
    lines.push(['Tình Trạng Trao Đổi']);
    pret.tbl2.rows.forEach((r, i) => lines.push([i + 1, ...r]));
    if (pret.tblUsage && pret.tblUsage.rows && pret.tblUsage.rows.length) {
      lines.push([]);
      lines.push(['Tình Trạng Sử Dụng']);
      pret.tblUsage.rows.forEach((r, i) => lines.push([i + 1, ...r]));
    }
    lines.push([]);
    lines.push(['Nguyên Nhân Dùng Song Song / Chuyển NCC Khác']);
    pret.tbl3.rows.forEach((r, i) => lines.push([i + 1, ...r]));
    lines.push([]);
    lines.push(['Vấn Đề Phát Sinh & Đề Xuất HĐĐT']);
    pret.tbl4.rows.forEach((r, i) => lines.push([i + 1, ...r]));
    lines.push([]);
  }

  const ptaiky = TIEP_TRIEN_KHAI_STATE.taiky;
  if (ptaiky) {
    lines.push(['============================== 8.4: NHÓM HỖ TRỢ TÁI KÝ ==============================']);
    lines.push(['STT', 'Tình Trạng Gian Hàng Trước Khi SC Đi', 'Số Lượng GH', 'Hỗ Trợ Thành Công', 'Tỷ Lệ Thành Công']);
    (ptaiky.items || []).forEach((it, i) => lines.push([i + 1, it.name, it.count, it.success != null ? it.success : (it.rawSuccess || ''), it.rate || '']));
    const totCount = ptaiky.totalRow ? ptaiky.totalRow.count : ptaiky.grandTotal;
    const totSuccess = ptaiky.totalRow && ptaiky.totalRow.success != null ? ptaiky.totalRow.success : '';
    const totRate = ptaiky.totalRow && ptaiky.totalRow.rate ? ptaiky.totalRow.rate : '';
    lines.push(['TỔNG CỘNG', '', totCount, totSuccess, totRate]);
    lines.push([]);
  }

  const pdataton = TIEP_TRIEN_KHAI_STATE.dataTon;
  if (pdataton) {
    lines.push(['============================== MỤC 9: DATA TỒN (THÁNG 11 OFFLINE & ONLINE) ==============================']);
    lines.push(['--- 9.1 Data tồn offline ---']);
    lines.push(['STT', 'Tệp Data Tồn', 'Retail', 'F&B', 'Booking', 'Tổng']);
    (pdataton.offline.items || []).forEach((it, i) => lines.push([i + 1, it.name, it.retail, it.fnb, it.booking, it.total]));
    if (pdataton.offline.total) lines.push(['TỔNG OFFLINE', '', pdataton.offline.total.retail, pdataton.offline.total.fnb, pdataton.offline.total.booking, pdataton.offline.total.total]);
    lines.push([]);
    lines.push(['--- 9.2 Data tồn online ---']);
    lines.push(['STT', 'Tệp Data Tồn', 'Retail', 'F&B', 'Booking', 'Tổng']);
    (pdataton.online.items || []).forEach((it, i) => lines.push([i + 1, it.name, it.retail, it.fnb, it.booking, it.total]));
    if (pdataton.online.total) lines.push(['TỔNG ONLINE', '', pdataton.online.total.retail, pdataton.online.total.fnb, pdataton.online.total.booking, pdataton.online.total.total]);
    lines.push([]);
  }

  const csv = lines.map(r => r.map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  _downloadCsvFile(`BaoCao_TatCa_TiepTrienKhai_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  showToast('Đã xuất toàn bộ báo cáo tệp triển khai và data tồn ra CSV thành công!', true);
}

/* ==========================================================================
   7. UI RENDERING & CSV CHO MỤC 9: BÁO CÁO DATA TỒN (THÁNG 11 OFFLINE & ONLINE)
   ========================================================================== */

function onBscDataTonChange(val) {
  selectBscDataTonTab(val);
}

function selectBscDataTonTab(val) {
  if (!['all', 'offline', 'online'].includes(val)) val = 'all';
  if (typeof TIEP_TRIEN_KHAI_STATE !== 'undefined') {
    TIEP_TRIEN_KHAI_STATE.activeDataTonTab = val;
  }

  // Đồng bộ Dropdown
  const select = $('bscSelectDataTon');
  if (select && select.value !== val) {
    select.value = val;
  }

  // Đồng bộ Pill Buttons
  const pillMap = {
    all: 'pillDataTonAll',
    offline: 'pillDataTonOffline',
    online: 'pillDataTonOnline'
  };

  Object.entries(pillMap).forEach(([k, id]) => {
    const el = $(id);
    if (el) {
      if (k === val) el.classList.add('on');
      else el.classList.remove('on');
    }
  });

  // Hiển thị / Ẩn khối tương ứng
  const secOffline = $('bscSecDataTonOffline');
  const secOnline = $('bscSecDataTonOnline');

  if (secOffline) secOffline.style.display = (val === 'all' || val === 'offline') ? 'block' : 'none';
  if (secOnline) secOnline.style.display = (val === 'all' || val === 'online') ? 'block' : 'none';
}

function renderDataTonMuc9UI(parsed) {
  const boxCards = $('bscDataTonCards');
  const boxOffline = $('bscDataTonOfflineTbl');
  const boxOnline = $('bscDataTonOnlineTbl');
  const badge = $('bscDataTonStatusBadge');

  if (!parsed) return;

  if (badge) {
    badge.className = 'badge b-live';
    badge.style.background = 'rgba(14,165,233,0.15)';
    badge.style.color = '#0ea5e9';
    badge.style.border = '1px solid rgba(14,165,233,0.3)';
    badge.textContent = `Google Sheets API (${TIEP_TRIEN_KHAI_STATE?.timeStr || 'live'})`;
  }

  const K = (label, val, sub, color = '') => `
    <div class="card kpi">
      <div class="l">${label}</div>
      <div class="v" style="${color}">${val}</div>
      <div class="s">${sub}</div>
    </div>`;

  const offTot = parsed.offline.total.total;
  const onlTot = parsed.online.total.total;
  const combTot = parsed.combined.total;

  const itLargeFnb = (parsed.offline.items || []).find(it => it.name.toLowerCase().includes('large'));
  const itT15Off = (parsed.offline.items || []).find(it => it.name.toLowerCase().includes('t15'));
  const itT15Onl = (parsed.online.items || []).find(it => it.name.toLowerCase().includes('t15'));
  const itOi = (parsed.online.items || []).find(it => it.name.toLowerCase().includes('oi'));

  if (boxCards) {
    boxCards.innerHTML =
      K('📦 Tổng Data Tồn Toàn Khối', `${n0(combTot)} GH`, `Toàn bộ tệp tồn chuyển tiếp (${esc(parsed.month || 'Tháng 11')})`, 'color:#0ea5e9') +
      K('🏢 Data Tồn Offline', `${n0(offTot)} GH (${combTot > 0 ? ((offTot / combTot) * 100).toFixed(1) : 0}%)`, `Large FnB (${itLargeFnb ? n0(itLargeFnb.total) : 640}), T15 (${itT15Off ? n0(itT15Off.total) : 373})`, 'color:#38bdf8') +
      K('🌐 Data Tồn Online', `${n0(onlTot)} GH (${combTot > 0 ? ((onlTot / combTot) * 100).toFixed(1) : 0}%)`, `CSKH T15 (${itT15Onl ? n0(itT15Onl.total) : 1495}), CSKH OI (${itOi ? n0(itOi.total) : 694})`, 'color:#10b981') +
      K('🛒 Cơ Cấu Ngành Hàng', `Retail: ${parsed.combined.retailPct.toFixed(1)}% · FnB: ${parsed.combined.fnbPct.toFixed(1)}%`, `Retail (${n0(parsed.combined.retail)}) · FnB (${n0(parsed.combined.fnb)}) · Booking (${n0(parsed.combined.booking)})`, 'color:#f59e0b');
  }

  // Helper render bảng Data tồn
  const renderTable = (groupData, isOnline) => {
    const total = groupData.total || {};
    const items = groupData.items || [];
    const colorBar = isOnline ? '#10b981' : '#38bdf8';
    const icon = isOnline ? '🌐' : '🏢';

    let html = `<table class="kpi-table" style="width:100%">
      <thead>
        <tr>
          <th style="width:50px;text-align:center">STT</th>
          <th style="text-align:left">Tệp Data Tồn</th>
          <th style="width:110px;text-align:center">Retail</th>
          <th style="width:110px;text-align:center">F&amp;B</th>
          <th style="width:110px;text-align:center">Booking</th>
          <th style="width:130px;text-align:center">Tổng Gian Hàng</th>
          <th style="width:160px;text-align:center">Tỷ Trọng (%)</th>
        </tr>
      </thead>
      <tbody>`;

    if (!items.length) {
      html += `<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--mut)">Không có dữ liệu data tồn</td></tr>`;
    } else {
      items.forEach((it, i) => {
        html += `<tr>
          <td style="text-align:center;font-weight:600;color:var(--mut)">${i + 1}</td>
          <td style="text-align:left;font-weight:700;color:var(--tx-heading)">
            <span style="display:inline-block;margin-right:6px">${icon}</span>
            <span>${esc(it.name)}</span>
          </td>
          <td style="text-align:center;font-weight:600;color:#38bdf8">${it.retail > 0 ? n0(it.retail) : '–'}</td>
          <td style="text-align:center;font-weight:600;color:#ea580c">${it.fnb > 0 ? n0(it.fnb) : '–'}</td>
          <td style="text-align:center;font-weight:600;color:#a855f7">${it.booking > 0 ? n0(it.booking) : '–'}</td>
          <td style="text-align:center;font-weight:800;color:var(--tx-heading);font-size:14px">${n0(it.total)}</td>
          <td style="text-align:center">
            <div style="display:flex;align-items:center;gap:8px;justify-content:center">
              <div style="flex:1;max-width:85px;height:7px;background:rgba(255,255,255,0.08);border-radius:4px;overflow:hidden">
                <div style="width:${Math.min(100, it.pct)}%;height:100%;background:${colorBar};border-radius:4px"></div>
              </div>
              <span style="font-weight:700;font-size:12px;color:var(--tx-heading);width:48px;text-align:right">${it.pct.toFixed(2)}%</span>
            </div>
          </td>
        </tr>`;
      });
    }

    html += `</tbody>
      <tfoot>
        <tr style="background:var(--card-sub);font-weight:800;border-top:2px solid var(--line)">
          <td style="text-align:center">∑</td>
          <td style="text-align:left;text-transform:uppercase;color:var(--tx-heading)">${esc(total.name || 'TỔNG CỘNG')}</td>
          <td style="text-align:center;font-size:14px;color:#38bdf8">${n0(total.retail)}</td>
          <td style="text-align:center;font-size:14px;color:#ea580c">${n0(total.fnb)}</td>
          <td style="text-align:center;font-size:14px;color:#a855f7">${n0(total.booking)}</td>
          <td style="text-align:center;font-size:15px;color:#10b981">${n0(total.total)}</td>
          <td style="text-align:center;font-size:13px;color:#10b981">100.00%</td>
        </tr>
      </tfoot>
    </table>`;

    return html;
  };

  if (boxOffline) {
    boxOffline.innerHTML = renderTable(parsed.offline, false);
  }

  if (boxOnline) {
    boxOnline.innerHTML = renderTable(parsed.online, true);
  }

  // Giữ trạng thái tab lọc hiện tại
  selectBscDataTonTab(TIEP_TRIEN_KHAI_STATE?.activeDataTonTab || 'all');
}

function exportDataTonMuc9Csv(mode = 'all') {
  const p = TIEP_TRIEN_KHAI_STATE?.dataTon;
  if (!p) return showToast('Chưa có dữ liệu Data Tồn để xuất CSV', false);

  const lines = [];

  const addGroupCsv = (groupData, title) => {
    lines.push([`============================== ${title} ==============================`]);
    lines.push(['STT', 'Tệp Data Tồn', 'Retail', 'F&B', 'Booking', 'Tổng Gian Hàng', 'Tỷ Trọng (%)']);
    (groupData.items || []).forEach((it, i) => {
      lines.push([i + 1, it.name, it.retail, it.fnb, it.booking, it.total, it.pct.toFixed(2) + '%']);
    });
    if (groupData.total) {
      lines.push(['TỔNG CỘNG', groupData.total.name || 'Tổng', groupData.total.retail, groupData.total.fnb, groupData.total.booking, groupData.total.total, '100.00%']);
    }
    lines.push([]);
  };

  if (mode === 'offline') {
    lines.push([`BÁO CÁO MỤC 9.1: DATA TỒN ${p.month || 'THÁNG 11'} OFFLINE`]);
    lines.push(['Thời gian xuất: ' + new Date().toLocaleString('vi-VN')]);
    lines.push([]);
    addGroupCsv(p.offline, `DATA TỒN ${p.month || 'THÁNG 11'} OFFLINE`);
    const csv = lines.map(r => r.map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    _downloadCsvFile(`BaoCao_DataTon_Offline_${new Date().toISOString().slice(0, 10)}.csv`, csv);
    return showToast('Đã xuất file CSV Data tồn Offline thành công!', true);
  }

  if (mode === 'online') {
    lines.push([`BÁO CÁO MỤC 9.2: DATA TỒN ${p.month || 'THÁNG 11'} ONLINE`]);
    lines.push(['Thời gian xuất: ' + new Date().toLocaleString('vi-VN')]);
    lines.push([]);
    addGroupCsv(p.online, `DATA TỒN ${p.month || 'THÁNG 11'} ONLINE`);
    const csv = lines.map(r => r.map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    _downloadCsvFile(`BaoCao_DataTon_Online_${new Date().toISOString().slice(0, 10)}.csv`, csv);
    return showToast('Đã xuất file CSV Data tồn Online thành công!', true);
  }

  // Toàn bộ Mục 9 (Offline & Online)
  lines.push([`BÁO CÁO MỤC 9: BÁO CÁO DATA TỒN (${p.month || 'THÁNG 11'} OFFLINE & ONLINE)`]);
  lines.push(['Thời gian xuất: ' + new Date().toLocaleString('vi-VN')]);
  lines.push(['Tổng gian hàng toàn khối: ' + p.combined.total + ' (Retail: ' + p.combined.retail + ', FnB: ' + p.combined.fnb + ', Booking: ' + p.combined.booking + ')']);
  lines.push([]);
  addGroupCsv(p.offline, `9.1 DATA TỒN ${p.month || 'THÁNG 11'} OFFLINE`);
  addGroupCsv(p.online, `9.2 DATA TỒN ${p.month || 'THÁNG 11'} ONLINE`);

  lines.push(['============================== TỔNG HỢP TOÀN KHỐI (OFFLINE + ONLINE) ==============================']);
  lines.push(['Ngành Hàng', 'Số Lượng Gian Hàng', 'Tỷ Trọng (%)']);
  lines.push(['Retail', p.combined.retail, p.combined.retailPct.toFixed(2) + '%']);
  lines.push(['F&B', p.combined.fnb, p.combined.fnbPct.toFixed(2) + '%']);
  lines.push(['Booking', p.combined.booking, p.combined.bookingPct.toFixed(2) + '%']);
  lines.push(['TỔNG CỘNG TOÀN KHỐI', p.combined.total, '100.00%']);

  const csv = lines.map(r => r.map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  _downloadCsvFile(`BaoCao_DataTon_TatCa_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  showToast('Đã xuất file CSV Data tồn toàn khối thành công!', true);
}
