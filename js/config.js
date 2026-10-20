/**
 * config.js - Các cấu hình chung, API endpoints, hằng số và trạng thái toàn cục
 */

// Google Apps Script API endpoints (Bảo mật bằng Secret Key)
const API_BASE = 'https://script.google.com/macros/s/AKfycbzBneKTnuVmEJD0ra4MVxrbGvH_Wh2labnSOm-rNxIz6TRR2nF2NpunBKXXnU-uMWPguQ/exec';
const API = API_BASE + '?sheet=baocaotong';
const API_MUCTIEU_OFFLINE = API_BASE + '?sheet=muctieu&range=A1:H12';
const API_MUCTIEU_ONLINE = API_BASE + '?sheet=muctieu&range=A14:H26';
const API_KPI = API_BASE + '?sheet=kpi&range=A1:P28';
const API_PHANCUNG = API_BASE + '?sheet=phancung';
const API_PHANCUNG_OCT = API_BASE + '?sheet=opp'; // Endpoint cho Mục 2: Chi Tiết Phần Cứng Tháng 10
const API_PHANCUNG_SOURCE = API_BASE + '?sheet=phancung&range=T1:W9'; // Endpoint cho Mục 3: Bán Hàng Từ Nguồn
const API_BAOCAOSC_ACTIVE_RATE = API_BASE + '?sheet=baocaotuan&range=A2:D14';
const API_BAOCAOSC_CARE_RATE = API_BASE + '?sheet=baocaotuan&range=F2:I6';
const API_BAOCAOSC_FNB_ISSUE = API_BASE + '?sheet=baocaotuan&range=AR2:AS9'; // Mục 3: Triển Khai Tệp FNB Lớn
const API_BAOCAOSC_PROVINCE_IMPACT = API_BASE + '?sheet=baocaotuan&range=K2:Q19'; // Mục 4: Impact Theo Tỉnh Thành Phố
const API_BAOCAOSC_IMPACT_DATA_SOURCE = API_BASE + '?sheet=baocaotuan&range=AD2:AG9'; // Mục 5: Impact theo Nguồn Data
const API_BAOCAOSC_IMPACT_INDUSTRY = API_BASE + '?sheet=baocaotuan&range=AD13:AG17'; // Mục 5: Impact theo Ngành Hàng
const API_BAOCAOSC_HEADCOUNT_REGION = API_BASE + '?sheet=baocaotuan&range=U2:AA5'; // Mục 6: Quân số theo Miền & Vị trí
const API_BAOCAOSC_HEADCOUNT_PROVINCE = API_BASE + '?sheet=baocaotuan&range=U7:V24'; // Mục 6: Quân số theo Tỉnh thành
const API_BAOCAOSC_KPI_ONLINE_T9 = API_BASE + '?sheet=baocaotuan&range=AJ2:AP5'; // Mục 7.1: KPI Team Online Tháng 9
const API_BAOCAOSC_KPI_OFFLINE_T10 = API_BASE + '?sheet=baocaotuan&range=AJ13:AP17'; // Mục 7.2: KPI Team Offline Tháng 10
const API_BAOCAOSC_ADDON_T10 = API_BASE + '?sheet=baocaotuan&range=AJ22:AM29'; // Mục 7.3: Tư Vấn Chuyển Addon Tháng 10
const API_KPI_ONLINE = API_BASE + '?sheet=KPI%20online'; // Endpoint cho Tab 7: KPI Team Online
const API_DATATON_ONLINE = API_BASE + '?sheet=ton%20online'; // Endpoint cho Tab 8: Data Tồn Online
const API_DATATON_OFFLINE = API_BASE + '?sheet=ton%20offline'; // Endpoint cho Tab 8: Data Tồn Offline

// Quản lý Khóa Xác thực (Session Auth Key)
const AUTH_STORAGE_KEY = 'tc_auth_token';
const AUTH_REMEMBER_KEY = 'tc_auth_remember';

function getAuthKey() {
  return sessionStorage.getItem(AUTH_STORAGE_KEY) || localStorage.getItem(AUTH_STORAGE_KEY) || '';
}

function setAuthKey(key, remember = false) {
  sessionStorage.setItem(AUTH_STORAGE_KEY, key);
  if (remember) {
    localStorage.setItem(AUTH_STORAGE_KEY, key);
    localStorage.setItem(AUTH_REMEMBER_KEY, '1');
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(AUTH_REMEMBER_KEY);
  }
}

function clearAuthKey() {
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(AUTH_REMEMBER_KEY);
}

// Cấu hình IndexedDB Smart Cache
const DB_NAME = 'TeamCoacherDB';
const DB_VERSION = 1;
const STORE_NAME = 'cache';
const CACHE_TTL_MS = 20 * 60 * 1000; // 20 phút
const CACHE_KEY = 'baocaotong_data';
const CACHE_KEY_MUCTIEU = 'muctieu_data';
const CACHE_KEY_KPI = 'kpi_offline_data_v3';
const CACHE_KEY_PHANCUNG = 'phancung_data';
const CACHE_KEY_PHANCUNG_OCT = 'phancung_oct_data';
const CACHE_KEY_PHANCUNG_SOURCE = 'phancung_source_data';
const CACHE_KEY_BAOCAOSC = 'baocaosc_data_v2';
const CACHE_KEY_KPI_ONLINE = 'kpi_online_data';
const CACHE_KEY_DATATON = 'dataton_data';

// Hằng số tính ngày công & bảng màu
const SPLIT = 12 * 60 + 30; // 12:30
const AF_CI = 13 * 60;      // 13:00
const AF_CO = 13 * 60 + 30; // 13:30
const MAXDUR = 480;         // 8 tiếng
const PALETTE = ['#60a5fa', '#f59e0b', '#34d399', '#f472b6', '#a78bfa', '#22d3ee', '#fb923c'];
const OPEN_TXT = 'Đúng cửa hàng/cty - Mở cửa';
const PAGE = 25;

// Trạng thái toàn cục (Tab 1 & Tab 2: Báo cáo tổng & Chi tiết ATC/ngày)
let DAYS = [];
let SCS = {};
let COACHES = [];
let COLOR = {};
let DATES = [];
let MONTHS = [];
let RAW_RECORDS = [];
let ALL_HEADERS = [];
let CURRENT_MODAL_LIST = [];
let CURRENT_RECORD = null;
let activeTab = 'overview';
let activeCoachTeam = 'all';
let coachTeamSort = { k: 'atcPerDay', dir: -1 };

// Trạng thái Bảng Chất Lượng SC Theo Tỉnh Thành (Tab 1)
let ALL_RECS = [];
let PROVINCE_QUALITY_MONTH = '2026-10'; // Mặc định tháng 10
let PROVINCE_QUALITY_SEARCH = '';
let PROVINCE_QUALITY_SORT = { k: 'atc', dir: -1 }; // Mặc định sắp xếp theo Tổng atc giảm dần
let EXPANDED_PROVINCES = new Set(); // Lưu vết các dòng tỉnh đang mở chi tiết SC

// Bộ lọc toàn cục
const S = {
  coach: new Set(),
  sc: 'all',
  status: 'all',
  lead: false,
  month: 'all',
  from: '',
  to: '',
  target: 6,
  minDays: 5,
  metric: 'atcPerCong',
  scSort: { k: 'atcPerCong', dir: -1 },
  daySort: { k: 'd', dir: -1 },
  page: 1
};

// Lưu các thực thể Chart.js
const charts = {};

// Trạng thái Tab 3: Mục Tiêu
let MUCTIEU_STATE = { offline: null, online: null, savedAt: 0, timeStr: '' };

// Trạng thái Tab 4: KPI Team Offline
let KPI_RAW_DATA = [];
let KPI_COACHES = [];
let KPI_ACTIVE_COACH = 'all';
let KPI_SEARCH = '';
let KPI_SORT = { k: 'kpiFinal', dir: -1 };

// Trạng thái Tab 5: DS Phần Cứng
let PHANCUNG_STATE = { data: null, savedAt: 0, timeStr: '' };
let PHANCUNG_SEARCH = '';
let PHANCUNG_SORT = { k: 'total', dir: -1 };

// Trạng thái Mục 2: Chi Tiết Phần Cứng Tháng 10
let PHANCUNG_OCT_STATE = { data: null, savedAt: 0, timeStr: '' };
let PHANCUNG_OCT_SEARCH = '';
let PHANCUNG_OCT_SORT = { k: 'total', dir: -1 };

// Trạng thái Mục 3: Bán Hàng Từ Nguồn (Quý 4: T10 - T12)
let PHANCUNG_SOURCE_STATE = { data: null, savedAt: 0, timeStr: '' };
let PHANCUNG_SOURCE_SORT = { k: 't10', dir: -1 };

// Trạng thái Tab 6: BÁO CÁO SC
let BAOCAOSC_STATE = { muctieuOffline: null, muctieuOnline: null, activeRate: null, careRate: null, fnbIssue: null, provinceImpact: null, headcountRegion: null, headcountProvince: null, impactDataSource: null, impactIndustry: null, kpiOnlineT9: null, kpiOfflineT10: null, addonT10: null, savedAt: 0, timeStr: '' };
let BAOCAOSC_SEARCH = '';
let BAOCAOSC_SORT = { k: 'mNum', dir: 1 };
let BAOCAOSC_CARE_SORT = { k: 'kyMoi', dir: -1 };
let BAOCAOSC_FNB_ISSUE_SORT = { k: 'count', dir: -1 };
let BAOCAOSC_PROVINCE_SEARCH = '';
let BAOCAOSC_PROVINCE_SORT = { k: 't10', dir: -1 };
let BAOCAOSC_HEADCOUNT_PROVINCE_SEARCH = '';
let BAOCAOSC_HEADCOUNT_PROVINCE_SORT = { k: 'count', dir: -1 };

// Trạng thái Tab 7: KPI Team Online
let KPI_ONLINE_STATE = { data: null, savedAt: 0, timeStr: '' };
let KPI_ONLINE_SEARCH = '';
let KPI_ONLINE_SHOW_ALL_DAYS = false; // Mặc định thu gọn ngày (chỉ hiện 1..ngày hiện tại)
let KPI_ONLINE_SHOW_ALL_TALK_DAYS = false; // Xem toàn bộ tháng mục 3
let KPI_ONLINE_SHOW_ALL_CALL_DAYS = false; // Xem toàn bộ tháng mục 4
let KPI_ONLINE_TAB1_SORT = { k: 'stt', dir: 1 };
let KPI_ONLINE_TAB2_SORT = { k: 'totalCall', dir: -1 };
let KPI_ONLINE_TAB3_SORT = { k: 'stt', dir: 1 };
let KPI_ONLINE_TAB4_SORT = { k: 'total', dir: -1 };

// Trạng thái Tab 8: DATA TỒN (Online & Offline)
let DATATON_STATE = { online: null, offline: null, savedAt: 0, timeStr: '' };
let DATATON_SEARCH = {
  onlineUser: '',
  onlineJob: '',
  offlineUser: '',
  offlineProvince: '',
  offlinePoolProvince: '',
  offlineOverdueProvince: ''
};
let DATATON_SORT = {
  onlineUser: { k: 'count', dir: -1 },
  onlineJob: { k: 'count', dir: -1 },
  offlineUser: { k: 'count', dir: -1 },
  offlineProvince: { k: 'count', dir: -1 },
  offlinePoolProvince: { k: 'count', dir: -1 },
  offlineOverdueProvince: { k: 'count', dir: -1 }
};
