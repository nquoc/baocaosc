/**
 * utils.js - Các hàm tiện ích dùng chung (DOM, định dạng số, ngày giờ, IndexedDB, Toast, Theme & Safe API Fetch)
 */

// Tiện ích DOM & Định dạng dữ liệu
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nf = (n, d = 1) => (n == null || isNaN(n)) ? '–' : Number(n).toLocaleString('vi-VN', { minimumFractionDigits: d, maximumFractionDigits: d });
const n0 = n => Number(n).toLocaleString('vi-VN');
const hhmm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(Math.round(m % 60)).padStart(2, '0');
const groupBy = (arr, f) => {
  const m = {};
  arr.forEach(x => (m[f(x)] = m[f(x)] || []).push(x));
  return m;
};

/**
 * Xử lý thời gian (chuyển đổi UTC sang múi giờ Việt Nam GMT+7)
 */
function parseTime(iso) {
  if (!iso) return null;
  const s = String(iso).trim();
  const pad = n => String(n).padStart(2, '0');

  // Chuỗi ISO có đuôi UTC 'Z' từ Google Apps Script API (VD: "2026-09-30T10:39:00.000Z")
  // Google Apps Script serialize ngày giờ thành UTC (giờ VN trừ 7 tiếng), ta quy đổi sang giờ Việt Nam (+7 tiếng)
  if (s.endsWith('Z') || s.includes('+00')) {
    const ms = Date.parse(s);
    if (!isNaN(ms)) {
      const vn = new Date(ms + 7 * 3600 * 1000);
      return {
        date: vn.toISOString().slice(0, 10),
        min: vn.getUTCHours() * 60 + vn.getUTCMinutes(),
        timeStr: pad(vn.getUTCHours()) + ':' + pad(vn.getUTCMinutes()) + ':' + pad(vn.getUTCSeconds())
      };
    }
  }

  // Chuỗi giờ cục bộ đã là giờ VN (VD: "2026-09-30 17:39:39" hoặc "2026-09-30T17:39:39")
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    const date = m[1];
    const hours = parseInt(m[2], 10);
    const min = parseInt(m[3], 10);
    const sec = parseInt(m[4] || '0', 10);
    return {
      date,
      min: hours * 60 + min,
      timeStr: pad(hours) + ':' + pad(min) + ':' + pad(sec)
    };
  }

  const ms = Date.parse(s);
  if (isNaN(ms)) return null;
  const d = new Date(ms);
  return {
    date: d.toISOString().slice(0, 10),
    min: d.getUTCHours() * 60 + d.getUTCMinutes(),
    timeStr: pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds())
  };
}

/**
 * Hiển thị thông báo Toast góc dưới màn hình
 */
function showToast(msg, isSuccess = true) {
  let t = $('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  t.className = 'toast ' + (isSuccess ? 'toast-success' : 'toast-error');
  t.style.opacity = '1';
  t.style.display = 'flex';
  t.innerHTML = (isSuccess ? '✅ ' : '⚠️ ') + msg;
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => {
    t.style.opacity = '0';
    setTimeout(() => { t.style.display = 'none'; }, 300);
  }, 4500);
}

/**
 * IndexedDB Helpers
 */
function openDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      return reject(new Error('IndexedDB không được hỗ trợ trên trình duyệt này.'));
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getCachedData() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(CACHE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    console.warn('[CACHE] Không đọc được IndexedDB:', e);
    return null;
  }
}

async function setCachedData(data) {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(data, CACHE_KEY);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (e) {
    console.warn('[CACHE] Không ghi được IndexedDB:', e);
    return false;
  }
}

/**
 * Tự động gắn Khóa bảo mật (Secret Key) vào URL API nếu chưa có
 */
function appendAuthKey(url) {
  if (!url) return url;
  const key = typeof getAuthKey === 'function' ? getAuthKey() : '';
  if (!key) return url;
  if (url.includes('key=') || url.includes('token=')) return url;
  const sep = url.includes('?') ? '&' : '?';
  return url + sep + 'key=' + encodeURIComponent(key);
}

/**
 * Tải JSON an toàn từ Google Apps Script, tự động nhận diện trang lỗi HTML và thử lại (Chống lỗi Unexpected token '<')
 */
async function safeFetchJson(url, maxRetries = 2) {
  const authedUrl = appendAuthKey(url);
  let lastErr = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(authedUrl, { cache: 'no-store' });
      const text = await res.text();
      const trimmed = text.trim();

      // Nếu Google trả về trang lỗi HTML (chứa <!DOCTYPE hoặc <html>)
      if (trimmed.startsWith('<') || trimmed.startsWith('<!DOCTYPE') || trimmed.toLowerCase().includes('<html')) {
        throw new Error('Máy chủ Google Apps Script tạm thời trả về trang web thay vì dữ liệu JSON.');
      }

      const json = JSON.parse(text);

      // Nếu server trả về lỗi từ chối truy cập (403 / sai mật khẩu)
      if (json && json.status === 'error' && (json.code === 403 || String(json.message).includes('Từ chối truy cập'))) {
        if (typeof showLoginGate === 'function') {
          showLoginGate('Mật khẩu bảo mật đã bị thay đổi hoặc không hợp lệ. Vui lòng đăng nhập lại!');
        }
        if (typeof clearAuthKey === 'function') {
          clearAuthKey();
        }
        throw new Error(json.message || 'Từ chối truy cập: Sai mật khẩu bảo mật.');
      }

      return json;
    } catch (err) {
      lastErr = err;
      if (err.message && err.message.includes('Từ chối truy cập')) {
        throw err;
      }
      if (attempt < maxRetries) {
        // Chờ 1.2s rồi tự động thử lại
        await new Promise(r => setTimeout(r, 1200));
      }
    }
  }
  throw lastErr;
}

/**
 * Quản lý giao diện Sáng / Tối (Dark / Light Theme)
 */
function initTheme() {
  const saved = localStorage.getItem('tc_theme') || 'dark';
  setTheme(saved);
}

function setTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  localStorage.setItem('tc_theme', theme);

  const btn = $('themeToggleBtn');
  if (btn) {
    btn.innerHTML = theme === 'dark' ? '🌙 Tối' : '☀️ Sáng';
    btn.title = theme === 'dark' ? 'Đang ở chế độ Tối (Bấm để chuyển sang Sáng)' : 'Đang ở chế độ Sáng (Bấm để chuyển sang Tối)';
  }

  // Cập nhật màu chữ và đường lưới của Chart.js theo theme
  if (window.Chart) {
    Chart.defaults.color = theme === 'dark' ? '#8899b0' : '#64748b';
    Chart.defaults.borderColor = theme === 'dark' ? 'rgba(148,163,184,.12)' : 'rgba(0,0,0,.08)';

    // Nếu đang ở Tab Overview và có sẵn tham số vẽ chart, vẽ lại chart ngay
    if (typeof window.renderCharts === 'function' && window._lastChartArgs) {
      window.renderCharts(...window._lastChartArgs);
    }
    // Nếu đang ở Tab DS Phần Cứng và có sẵn tham số vẽ chart, vẽ lại chart ngay
    if (typeof window.renderPhanCungCharts === 'function' && window._lastPcChartArgs) {
      window.renderPhanCungCharts(...window._lastPcChartArgs);
    }
    // Nếu đang ở Tab Báo Cáo SC và có sẵn tham số vẽ chart, vẽ lại chart ngay
    if (typeof window.renderBaoCaoScCharts === 'function' && window._lastBscChartArgs) {
      window.renderBaoCaoScCharts(...window._lastBscChartArgs);
    }
  }
}

function toggleTheme() {
  const cur = document.body.getAttribute('data-theme') || 'dark';
  const next = cur === 'dark' ? 'light' : 'dark';
  setTheme(next);
  showToast(next === 'dark' ? 'Đã chuyển sang giao diện Tối' : 'Đã chuyển sang giao diện Sáng', true);
}
