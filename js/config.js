/**
 * config.js - Các cấu hình chung, API endpoints, hằng số và trạng thái toàn cục
 */

// Google Apps Script API endpoints
const API = 'https://script.google.com/macros/s/AKfycbwfHAYA6-39-yn_HDHHvbYxkBu_HXP29j7lG3vK3XRN6txlJ36kH0EsBCILeqXH2Z1kBw/exec?sheet=baocaotong';
const API_BASE = 'https://script.google.com/macros/s/AKfycbwfHAYA6-39-yn_HDHHvbYxkBu_HXP29j7lG3vK3XRN6txlJ36kH0EsBCILeqXH2Z1kBw/exec';
const API_MUCTIEU_OFFLINE = API_BASE + '?sheet=muctieu&range=A1:H12';
const API_MUCTIEU_ONLINE = API_BASE + '?sheet=muctieu&range=A14:H26';
const API_KPI = API_BASE + '?sheet=kpi';
const API_PHANCUNG = API_BASE + '?sheet=phancung';
const API_PHANCUNG_OCT = API_BASE + '?sheet=opp'; // Endpoint cho Mục 2: Chi Tiết Phần Cứng Tháng 10
const API_BAOCAOSC_ACTIVE_RATE = API_BASE + '?sheet=baocaotuan&range=A2:D14';
const API_BAOCAOSC_CARE_RATE = API_BASE + '?sheet=baocaotuan&range=F2:I6';

// Cấu hình IndexedDB Smart Cache
const DB_NAME = 'TeamCoacherDB';
const DB_VERSION = 1;
const STORE_NAME = 'cache';
const CACHE_TTL_MS = 20 * 60 * 1000; // 20 phút
const CACHE_KEY = 'baocaotong_data';
const CACHE_KEY_MUCTIEU = 'muctieu_data';
const CACHE_KEY_KPI = 'kpi_offline_data';
const CACHE_KEY_PHANCUNG = 'phancung_data';
const CACHE_KEY_PHANCUNG_OCT = 'phancung_oct_data';
const CACHE_KEY_BAOCAOSC = 'baocaosc_data';

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
let activeCoachTeam = null;
let coachTeamSort = { k: 'atcPerDay', dir: -1 };

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

// Trạng thái Tab 6: BÁO CÁO SC
let BAOCAOSC_STATE = { activeRate: null, careRate: null, savedAt: 0, timeStr: '' };
let BAOCAOSC_SEARCH = '';
let BAOCAOSC_SORT = { k: 'mNum', dir: 1 };
let BAOCAOSC_CARE_SORT = { k: 'kyMoi', dir: -1 };
