/**
 * google_sheets_service.js - Quản lý kết nối Google Sheets API bằng Service Account
 * Tự động tạo JWT ký RS256 bằng WebCrypto thuần trong trình duyệt (Không cần backend/proxy).
 * Đọc trực tiếp sheet 'Các tiệp triển khai' từ Google Spreadsheet ID: 1Wghthkrt0A8QQ08gDVSnQO55ix8CGCZHt87qhRcpKEY
 */

// Cấu hình Service Account & Spreadsheet
const SA_SPREADSHEET_ID = '1Wghthkrt0A8QQ08gDVSnQO55ix8CGCZHt87qhRcpKEY';
const SA_SHEET_NAME = 'Các tiệp triển khai';
const SA_RANGES = [
  `'${SA_SHEET_NAME}'!A1:B50`,  // Mục 7.1: Nhóm FNB lớn / lỗi (cột A:B)
  `'${SA_SHEET_NAME}'!D1:H60`,  // Mục 7.2: Nhóm Booking 3 Hotel sao (cột D:H)
  `'${SA_SHEET_NAME}'!J1:N60`   // Mục 7.3: Nhóm retail lớn HDDT (cột J:N)
];

const SA_CREDENTIALS = {
  type: "service_account",
  project_id: "confident-slice-495215-s4",
  private_key_id: "a91850800e57eb6767cfeed42a58707704e878ea",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDQ6aB5FBai/aNX\n9Qs5YbIO6RSZth/o6aCAzn+MN+RTiCaM5mtx/d+vp8Hta30YOiB8NmeR1APlCO90\nhAEUvSeWRltqxNIzho9QZYJKCOedr+kezYMiwMguffwbFs3V1BOUION33C4peuKO\nVqDnVoa03QwsiKlB6csLLvcbbm6w1T/I9UxHINC5x8AFJ7AjEMPKV4sMXcCY10QS\nPEMHsM5G8wL7lq6KTPjrn7/8NAQmW2aRo0wCKEVEol99Sa6Q18hShPqWrWMloHVs\nQT50FOTQ/h7VGDqhFHp9w1Yes/E5OV0HfBHB2dYqBE5KWASBKk41lNjx2gS3uQgA\n7p3F7QJpAgMBAAECggEAGUoMv1dxkY+5XiCHWC4FwVURBbX0qSvd3nXQ3hsWeE+p\nFgGfJFSOh0ucF8bdJOmFbO/ji/VBtvAk14KSxG1M7V2tO5ChnvPlJZ7yHY70JcQp\niM1pOFPkr68XzXouVtoGODZeftAQJPyPkBo3vmVcp2iCTKJK9fQMnJkV9/O/cceY\nshT0kGDhbIF6LArPNvq2knEwb58BgD7k50F6bcHeDumop6wcO1UhA37OBstKrTvY\nexRdHxCnwcsbAxtdyHGKhyxKeiA0pO2EvHLk3Xhl4oAXMnRfgI9/HNYT5XjzySO5\n+6U+XARoYFrPhWp4it6gkPgm72yIG52n/DiwpHb6EQKBgQDzSxXLFi/US33nZbih\nbmWYfvXqyP4ABJx2IM/AT+6bvsEdhMPsnFKg3DWN9M2fG05sfraE+EmrrTmVt332\nMj710+px0agXj1TJjAFL2CVav/CmYjvFZWH9lq/+w0gULujvLmBfSuyghvB1RdNb\nZyTvbysMwUZH7SRPMEmXyLP8WQKBgQDb0twqBs3gQHQzg991EalQ6B9SXU/ZEBi9\ncNpX6e5SoV+nv2EIk2ZnpFpe9b4kdNrpvYO7c8yC0cablMaCILxDJl/pytPDGR6y\nEY9vhZGqilG/slPVYEH7PHHFsLyYdEOfXVN5Nh5KJ88XUTaTWX8FeezfTXBC0JUd\nLLvj42E0kQKBgQDMfCBuGFDNA0JoOePrsukrOhKhapuqEjYbR0q2Hbi0KKkRkWRH\nO8BrOYq9rLMidoX8xKfNrQ3mgGr0/kudoO+wGJRlY8z/OFYQLF9uitYip06x2cDZ\nEXRB+uQjoai0ZhUb6wPPNB8ccS4rsyuJGHE/2VT6nHvgul2ZPUGtlGBKyQKBgFXE\nRYZYNUdDnpLi5vKkO22Hw4C9S4QjVaPEPkyCxyuSLuIiN1fDOvdBFslqFA/hT/BW\nsukWWzrHYjgdqf3ni8yfUljDfC/owyMy2sXmVVk2soKarz7XWacOhE1fkZXh9uhc\n306xoMvKEHDGjQacqoSWd6cAbcaD30oMxBo8AxchAoGAAYmAbwBC+biiJtVb8DqG\nJ1MYRX9QRd8rePDUdf57NHHAHTl0HnHv0xaH1y4IBUkhpIeL0ADHwSm41PIeqP1W\nSbfAbY7d8povK1L/nEubRA24eTLs9VxMvVwY14xd/Ghg3bdxrdII32vjo14EGc5B\ne8DF5V/VQsbYewYXkYfw8oU=\n-----END PRIVATE KEY-----\n",
  client_email: "bot-sheet@confident-slice-495215-s4.iam.gserviceaccount.com",
  token_uri: "https://oauth2.googleapis.com/token"
};

const CACHE_KEY_TIEPTRIENKHAI = 'tiep_trien_khai_data_v1';

// Bộ nhớ đệm token trong phiên (tránh sinh token liên tục)
let _gSaToken = '';
let _gSaTokenExp = 0;

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
async function getGoogleServiceAccountToken() {
  const now = Math.floor(Date.now() / 1000);
  // Kiểm tra token trong cache RAM hoặc sessionStorage
  if (!_gSaToken) {
    _gSaToken = sessionStorage.getItem('tc_g_sa_token') || '';
    _gSaTokenExp = parseInt(sessionStorage.getItem('tc_g_sa_token_exp') || '0', 10);
  }

  if (_gSaToken && _gSaTokenExp > now + 180) {
    return _gSaToken;
  }

  // Tạo JWT assertion
  const binaryDer = _pemToBinary(SA_CREDENTIALS.private_key);
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
    iss: SA_CREDENTIALS.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: SA_CREDENTIALS.token_uri,
    exp: now + 3600,
    iat: now
  }));

  const toSign = new TextEncoder().encode(header + '.' + payload);
  const signature = await cryptoObj.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, toSign);
  const sigB64 = _arrayBufferToBase64Url(signature);
  const jwtAssertion = header + '.' + payload + '.' + sigB64;

  const res = await fetch(SA_CREDENTIALS.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + encodeURIComponent(jwtAssertion)
  });

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(data.error_description || data.error || 'Không thể lấy Access Token từ Google Service Account');
  }

  _gSaToken = data.access_token;
  _gSaTokenExp = now + (data.expires_in || 3600);
  sessionStorage.setItem('tc_g_sa_token', _gSaToken);
  sessionStorage.setItem('tc_g_sa_token_exp', String(_gSaTokenExp));

  return _gSaToken;
}

/**
 * Tải đồng thời cả 3 vùng dữ liệu qua batchGet
 */
async function fetchTiepTrienKhaiFromGoogleSheets() {
  const token = await getGoogleServiceAccountToken();
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${SA_SPREADSHEET_ID}/values:batchGet`);
  SA_RANGES.forEach(r => url.searchParams.append('ranges', r));

  const res = await fetch(url.toString(), {
    headers: { 'Authorization': 'Bearer ' + token }
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Sheets API lỗi HTTP ${res.status}: ${errText}`);
  }

  const json = await res.json();
  return json;
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
 * Chuẩn hóa 5.3: Nhóm retail lớn HDDT (cột J:N)
 */
function parseTiepTrienKhaiRetail(rows) {
  if (!Array.isArray(rows) || rows.length < 3) return null;

  const title = (rows[0] && rows[0][0]) || 'Nhóm retail lớn HDDT';
  const month = (rows[1] && rows[1][0]) || 'Tháng 11';

  // Bảng 1: Thực trạng cửa hàng & Impact
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

  // Bỏ qua hàng trống
  while (idx < rows.length && (!rows[idx] || !rows[idx].length || !rows[idx][1])) {
    idx++;
  }

  // Bảng 2: Tình trạng trao đổi
  let tbl2Headers = ['Tình trạng trao đổi', 'Số lượng', 'Tỷ tiếp cận trực tiếp thành công'];
  const tbl2Rows = [];
  let tbl2Total = null;

  if (idx < rows.length && rows[idx][0] && rows[idx][0].toLowerCase().includes('tình trạng')) {
    tbl2Headers = rows[idx];
    idx++;
    while (idx < rows.length) {
      const r = rows[idx];
      if (!r || !r.length || !r[0]) {
        idx++;
        break;
      }
      const name = String(r[0]).trim();
      if (name.toLowerCase().includes('tổng')) {
        tbl2Total = r;
      } else {
        tbl2Rows.push(r);
      }
      idx++;
    }
  }

  // Bảng 3: Nguyên nhân khách sử dụng song song
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
        if (idx < rows.length) tbl3Headers = rows[idx];
        idx++;
        while (idx < rows.length) {
          const rowData = rows[idx];
          if (!rowData || !rowData.length || !rowData[0]) {
            idx++;
            break;
          }
          if (String(rowData[0]).startsWith('2. ')) {
            break;
          }
          tbl3Rows.push(rowData);
          idx++;
        }
        break;
      }
    }
    idx++;
  }

  // Bảng 4: Các vấn đề phát sinh và đề xuất liên quan HDDT
  let tbl4Title = '2. Các vấn đề phát sinh và đề xuất liên quan đến HDDT';
  let tbl4Headers = ['Nhóm vấn đề', 'Thực tế ghi nhận', 'Số gian hàng'];
  const tbl4Rows = [];

  while (idx < rows.length) {
    const r = rows[idx];
    if (r && r.length) {
      const c0 = String(r[0] || '').trim();
      if (c0.toLowerCase().includes('các vấn đề phát sinh') || c0.toLowerCase().includes('đề xuất')) {
        tbl4Title = c0;
        idx++;
        if (idx < rows.length) tbl4Headers = rows[idx];
        idx++;
        while (idx < rows.length) {
          const rowData = rows[idx];
          if (!rowData || !rowData.length || !rowData[0]) {
            idx++;
            break;
          }
          tbl4Rows.push(rowData);
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
    tbl3: { title: tbl3Title, headers: tbl3Headers, rows: tbl3Rows },
    tbl4: { title: tbl4Title, headers: tbl4Headers, rows: tbl4Rows }
  };
}

/* ==========================================================================
   3. GLOBAL STATE & SMART CACHE MANAGEMENT
   ========================================================================== */

let TIEP_TRIEN_KHAI_STATE = {
  fnb: null,
  booking: null,
  retail: null,
  activeTab: 'all', // 'all' | 'fnb' | 'booking' | 'retail'
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
          source: 'cache'
        };

        // Đồng bộ ngược cho BAOCAOSC_STATE.fnbIssue để các phần khác nếu dùng vẫn có data
        if (typeof BAOCAOSC_STATE !== 'undefined' && cached.rawFnb) {
          BAOCAOSC_STATE.fnbIssue = cached.rawFnb;
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
        showToast('Đã đồng bộ trực tiếp 3 tệp triển khai mới nhất từ Google Sheets!', true);
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

  const parsedFnb = parseTiepTrienKhaiFnb(fnbRows);
  const parsedBooking = parseTiepTrienKhaiBooking(bookingRows);
  const parsedRetail = parseTiepTrienKhaiRetail(retailRows);

  const now = new Date();
  const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  TIEP_TRIEN_KHAI_STATE = {
    fnb: parsedFnb,
    booking: parsedBooking,
    retail: parsedRetail,
    activeTab: TIEP_TRIEN_KHAI_STATE.activeTab || 'all',
    savedAt: Date.now(),
    timeStr,
    source
  };

  // Đồng bộ sang BAOCAOSC_STATE.fnbIssue
  if (typeof BAOCAOSC_STATE !== 'undefined') {
    BAOCAOSC_STATE.fnbIssue = fnbRows;
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
  if (!['all', 'fnb', 'booking', 'retail'].includes(val)) val = 'all';
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
    retail: 'pillTiepRetail'
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

  if (secFnb) secFnb.style.display = (val === 'all' || val === 'fnb') ? 'block' : 'none';
  if (secBooking) secBooking.style.display = (val === 'all' || val === 'booking') ? 'block' : 'none';
  if (secRetail) secRetail.style.display = (val === 'all' || val === 'retail') ? 'block' : 'none';
}

/* ==========================================================================
   5. UI RENDERING (CARD KPIS & BẢNG EXCEL ĐẸP MẮT)
   ========================================================================== */

function renderTiepTrienKhai() {
  const container = $('bscTiepContainer');
  if (!container) return;

  renderFnbGroupUI(TIEP_TRIEN_KHAI_STATE.fnb);
  renderBookingGroupUI(TIEP_TRIEN_KHAI_STATE.booking);
  renderRetailGroupUI(TIEP_TRIEN_KHAI_STATE.retail);

  // Áp dụng trạng thái lọc tab hiện tại
  selectBscTiepTab(TIEP_TRIEN_KHAI_STATE.activeTab || 'all');
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
 * 5.3: Giao diện Nhóm retail lớn HDDT (cột J:N)
 */
function renderRetailGroupUI(parsed) {
  const boxCards = $('bscTiepRetailCards');
  const boxTbl1 = $('bscTiepRetailTbl1');
  const boxTbl2 = $('bscTiepRetailTbl2');
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
  const totGH = t1Tot[1] ? n0(_parseValNumber(t1Tot[1])) : '33';
  const totImpact = t1Tot[3] ? n0(_parseValNumber(t1Tot[3])) : '12';
  const totImpactPct = t1Tot[4] || '36.36%';

  if (boxCards) {
    boxCards.innerHTML =
      K('🛒 Tổng Gian Hàng HĐĐT', `${totGH} GH`, `Rà soát gian hàng Retail lớn (${esc(parsed.month)})`, 'color:#8b5cf6') +
      K('🏪 Cửa Hàng Đang Mở', `19 GH (57.6%)`, `Đóng cửa: 11 GH (33.3%) · Không có CH: 3 GH`, 'color:#a78bfa') +
      K('⚡ Số Lượng Khách Impact', `${totImpact} GH`, `Tỷ lệ Impact toàn tệp: <b style="color:#10b981">${totImpactPct}</b>`, 'color:#10b981') +
      K('📑 Lý Do Dùng Song Song', `10 GH (30.3%)`, `Kế toán đã quen dùng phần mềm riêng (MISA, Viettel)`, 'color:#f59e0b');
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

  // Bảng 4: Vấn đề phát sinh và đề xuất HDDT
  if (boxTbl4) {
    let html = `<table class="kpi-table" style="width:100%">
      <thead>
        <tr>
          <th style="width:50px;text-align:center">STT</th>
          <th style="text-align:left;min-width:200px">${esc(parsed.tbl4.headers[0] || 'Nhóm Vấn Đề')}</th>
          <th style="text-align:left">${esc(parsed.tbl4.headers[1] || 'Thực Tế Ghi Nhận')}</th>
          <th style="width:120px;text-align:center">${esc(parsed.tbl4.headers[2] || 'Số Gian Hàng')}</th>
        </tr>
      </thead>
      <tbody>`;

    parsed.tbl4.rows.forEach((r, i) => {
      html += `<tr>
        <td style="text-align:center;font-weight:600;color:var(--mut)">${i + 1}</td>
        <td style="text-align:left;font-weight:700;color:#0ea5e9">${esc(r[0])}</td>
        <td style="text-align:left;color:var(--tx)">${esc(r[1])}</td>
        <td style="text-align:center;font-weight:700;font-size:14px;color:var(--tx-heading)">${esc(r[2])}</td>
      </tr>`;
    });

    html += `</tbody></table>`;
    boxTbl4.innerHTML = html;
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
    ['BÁO CÁO CÁC TỆP TRIỂN KHAI - MỤC 7.1: NHÓM FNB LỚN / LỖI (' + p.month + ')'],
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
    ['BÁO CÁO CÁC TỆP TRIỂN KHAI - MỤC 7.2: NHÓM BOOKING 3 HOTEL SAO (' + p.month + ')'],
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
    ['BÁO CÁO CÁC TỆP TRIỂN KHAI - MỤC 7.3: NHÓM RETAIL LỚN HDDT (' + p.month + ')'],
    [],
    ['--- BẢNG 1: THỰC TRẠNG CỬA HÀNG & IMPACT ---'],
    p.tbl1.headers
  ];

  p.tbl1.rows.forEach((r, i) => lines.push([i + 1, ...r]));
  if (p.tbl1.total) lines.push(['TỔNG CỘNG', ...p.tbl1.total.slice(1)]);

  lines.push([]);
  lines.push(['--- BẢNG 2: TÌNH TRẠNG TRAO ĐỔI ---']);
  lines.push(p.tbl2.headers);
  p.tbl2.rows.forEach((r, i) => lines.push([i + 1, ...r]));
  if (p.tbl2.total) lines.push(['TỔNG CỘNG', ...p.tbl2.total.slice(1)]);

  lines.push([]);
  lines.push(['--- BẢNG 3: NGUYÊN NHÂN KHÁCH SỬ DỤNG SONG SONG HOẶC CHUYỂN NCC KHÁC ---']);
  lines.push(p.tbl3.headers);
  p.tbl3.rows.forEach((r, i) => lines.push([i + 1, ...r]));

  lines.push([]);
  lines.push(['--- BẢNG 4: CÁC VẤN ĐỀ PHÁT SINH VÀ ĐỀ XUẤT LIÊN QUAN HDDT ---']);
  lines.push(p.tbl4.headers);
  p.tbl4.rows.forEach((r, i) => lines.push([i + 1, ...r]));

  const csv = lines.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  _downloadCsvFile(`BaoCao_TiepTrienKhai_Retail_HDDT_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  showToast('Đã xuất file CSV Nhóm Retail lớn HDDT thành công!', true);
}

function exportAllTiepTrienKhaiCsv() {
  const lines = [
    ['BÁO CÁO TỔNG HỢP CÁC TỆP TRIỂN KHAI (F&B LỚN - BOOKING 3 SAO - RETAIL LỚN HĐĐT)'],
    ['Thời gian xuất: ' + new Date().toLocaleString('vi-VN')],
    []
  ];

  const pfnb = TIEP_TRIEN_KHAI_STATE.fnb;
  if (pfnb) {
    lines.push(['============================== 7.1: NHÓM FNB LỚN / LỖI ==============================']);
    lines.push(['STT', 'Nhóm Lỗi / Vấn Đề', 'Số Lượng Case', 'Tỷ Trọng (%)']);
    pfnb.items.forEach(it => lines.push([it.id, it.name, it.count, it.pct.toFixed(2) + '%']));
    lines.push(['TỔNG CỘNG', '', pfnb.grandTotal, '100.00%']);
    lines.push(['TỶ LỆ LỖI', '', pfnb.errorRateRow.value, '']);
    lines.push([]);
  }

  const pbook = TIEP_TRIEN_KHAI_STATE.booking;
  if (pbook) {
    lines.push(['============================== 7.2: NHÓM BOOKING 3 HOTEL SAO ==============================']);
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
    lines.push(['============================== 7.3: NHÓM RETAIL LỚN HDDT ==============================']);
    lines.push(pret.tbl1.headers);
    pret.tbl1.rows.forEach((r, i) => lines.push([i + 1, ...r]));
    if (pret.tbl1.total) lines.push(['TỔNG CỘNG', ...pret.tbl1.total.slice(1)]);
    lines.push([]);
    lines.push(['Nguyên Nhân Dùng Song Song / Chuyển NCC Khác']);
    pret.tbl3.rows.forEach((r, i) => lines.push([i + 1, ...r]));
    lines.push([]);
    lines.push(['Vấn Đề Phát Sinh & Đề Xuất HĐĐT']);
    pret.tbl4.rows.forEach((r, i) => lines.push([i + 1, ...r]));
  }

  const csv = lines.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  _downloadCsvFile(`BaoCao_TatCa_TiepTrienKhai_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  showToast('Đã xuất toàn bộ 3 tệp triển khai ra CSV thành công!', true);
}
