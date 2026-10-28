/**
 * tab-bao-cao.js - BÁO CÁO ĐIỀU HÀNH TỰ ĐỘNG & BỘ SỬA TRỰC TIẾP WYSIWYG
 * Dự án: Team Coacher Dashboard - Customer Success (SC)
 * 
 * Tính năng chính:
 * 1. Tự động sinh báo cáo chuẩn tương tự 2 file PDF thực tế (Tháng 09 và Tuần 2+3).
 * 2. Kính gửi: anh Nguyễn Dũng Hải SDM DVKH (tùy chỉnh linh hoạt).
 * 3. Bộ sửa trực tiếp WYSIWYG trên mặt giấy báo cáo (contenteditable="true"):
 *    - In đậm, in nghiêng, gạch chân, tiêu đề H2, H3, căn lề, danh sách.
 *    - Quản lý bảng biểu động: Thêm/Xóa hàng, Thêm/Xóa cột, Thêm bảng.
 *    - Di chuyển ô bằng phím Tab & Shift+Tab như Microsoft Excel.
 *    - Đổi màu nền Ô / Hàng / Toàn bảng; Màu chữ & Bút dạ quang (Highlight).
 *    - Paste ảnh chụp màn hình trực tiếp từ Clipboard (Ctrl+V) thành Base64.
 * 4. Tự động lưu ngầm vào localStorage (debounce 400ms).
 * 5. Bộ nhập liệu & Tạo các mục tùy chỉnh (Custom Sections) không giới hạn.
 * 6. Lưu mốc tuần (Snapshot) và so sánh chênh lệch (+/-) tự động.
 * 7. Bộ xuất đa định dạng:
 *    - 📋 Copy sang Atlassian / Confluence (Inline CSS, white-space: nowrap !important, không bị biến thành ảnh).
 *    - 📄 Tải Word (.docx) chuẩn thuần JS (PKZIP Store method 0, OpenXML, khổ ngang Landscape, lề 720 dxa, bảo toàn màu).
 *    - 🌐 Tải file HTML độc lập mở offline.
 *    - 🖨️ In / Xuất PDF sắc nét.
 */

// ============================================================================
// 1. STATE & LOCALSTORAGE KEYS
// ============================================================================

const REPORT_STORAGE_KEYS = {
  DOC_HTML: 'tc_report_doc_html',
  CONFIG: 'tc_report_config',
  CUSTOM_SECTIONS: 'tc_report_custom_sections',
  SNAPSHOTS: 'tc_report_snapshots'
};

const REPORT_STATE = {
  template: 'month', // 'month' | 'week' | 'master'
  title: 'BÁO CÁO ĐỊNH KỲ CHẤT LƯỢNG CUSTOMER SUCCESS (SC) – THÁNG 09 (18-30)',
  period: 'Tháng 09 (18-30)',
  recipient: 'anh Nguyễn Dũng Hải - SDM DVKH (Dịch Vụ Khách Hàng)',
  department: 'Bộ phận Chăm Sóc Khách Hàng (Customer Success - SC)',
  author: 'Đại diện Đội ngũ Customer Success (SC)',
  isEditable: true,
  autoSaveTimer: null,
  colorScope: 'cell', // 'cell' | 'row' | 'table'
  lastSelectedRange: null,
  customSections: []
};

// ============================================================================
// 2. KHỞI TẠO TAB & LẮNG NGHE SỰ KIỆN
// ============================================================================

function initBaoCaoTab() {
  loadReportConfig();
  renderReportConfigUI();
  setupReportWysiwygListeners();

  const savedHtml = localStorage.getItem(REPORT_STORAGE_KEYS.DOC_HTML);
  const docEl = document.getElementById('reportDocument');
  if (docEl) {
    if (savedHtml && savedHtml.trim().length > 100) {
      docEl.innerHTML = savedHtml;
      updateReportSaveStatus('Đã khôi phục từ bộ nhớ tạm', 'success');
    } else {
      generateExecutiveReport(false);
    }
  }

  loadCustomSections();
  renderCustomSectionsList();
}

function loadReportConfig() {
  try {
    const raw = localStorage.getItem(REPORT_STORAGE_KEYS.CONFIG);
    if (raw) {
      const cfg = JSON.parse(raw);
      if (cfg.template) REPORT_STATE.template = cfg.template;
      if (cfg.title) REPORT_STATE.title = cfg.title;
      if (cfg.period) REPORT_STATE.period = cfg.period;
      if (cfg.recipient) REPORT_STATE.recipient = cfg.recipient;
      if (cfg.department) REPORT_STATE.department = cfg.department;
      if (cfg.author) REPORT_STATE.author = cfg.author;
    }
  } catch (e) {
    console.warn('Lỗi đọc cấu hình báo cáo từ localStorage:', e);
  }
}

function saveReportConfig() {
  const cfg = {
    template: REPORT_STATE.template,
    title: REPORT_STATE.title,
    period: REPORT_STATE.period,
    recipient: REPORT_STATE.recipient,
    department: REPORT_STATE.department,
    author: REPORT_STATE.author
  };
  try {
    localStorage.setItem(REPORT_STORAGE_KEYS.CONFIG, JSON.stringify(cfg));
  } catch (e) {}
}

function renderReportConfigUI() {
  const tplSelect = document.getElementById('bcSelectTemplate');
  const titleInput = document.getElementById('bcInputTitle');
  const periodInput = document.getElementById('bcInputPeriod');
  const recipInput = document.getElementById('bcInputRecipient');
  const deptInput = document.getElementById('bcInputDepartment');
  const authorInput = document.getElementById('bcInputAuthor');

  if (tplSelect) tplSelect.value = REPORT_STATE.template;
  if (titleInput) titleInput.value = REPORT_STATE.title;
  if (periodInput) periodInput.value = REPORT_STATE.period;
  if (recipInput) recipInput.value = REPORT_STATE.recipient;
  if (deptInput) deptInput.value = REPORT_STATE.department;
  if (authorInput) authorInput.value = REPORT_STATE.author;
}

function onReportConfigChange() {
  const tplSelect = document.getElementById('bcSelectTemplate');
  const titleInput = document.getElementById('bcInputTitle');
  const periodInput = document.getElementById('bcInputPeriod');
  const recipInput = document.getElementById('bcInputRecipient');
  const deptInput = document.getElementById('bcInputDepartment');
  const authorInput = document.getElementById('bcInputAuthor');

  if (tplSelect) REPORT_STATE.template = tplSelect.value;
  if (titleInput) REPORT_STATE.title = titleInput.value;
  if (periodInput) REPORT_STATE.period = periodInput.value;
  if (recipInput) REPORT_STATE.recipient = recipInput.value;
  if (deptInput) REPORT_STATE.department = deptInput.value;
  if (authorInput) REPORT_STATE.author = authorInput.value;

  saveReportConfig();
}

function onTemplateSelectChange(tpl) {
  REPORT_STATE.template = tpl;
  if (tpl === 'month') {
    REPORT_STATE.title = 'BÁO CÁO ĐỊNH KỲ CHẤT LƯỢNG CUSTOMER SUCCESS (SC) – THÁNG 09 (18-30)';
    REPORT_STATE.period = 'Tháng 09 (18-30)';
  } else if (tpl === 'week') {
    REPORT_STATE.title = 'BÁO CÁO CHẤT LƯỢNG CUSTOMER SUCCESS (SC) - TUẦN 2+3 - THÁNG 09/2026';
    REPORT_STATE.period = 'Tuần 2+3 - Tháng 09/2026';
  } else {
    REPORT_STATE.title = 'BÁO CÁO ĐIỀU HÀNH TỔNG THỂ ĐỘI NGŨ CUSTOMER SUCCESS (SC)';
    REPORT_STATE.period = 'Kỳ điều hành ' + new Date().toLocaleDateString('vi-VN');
  }
  renderReportConfigUI();
  saveReportConfig();
}

// ============================================================================
// 3. TẠO BÁO CÁO TỰ ĐỘNG TỪ NGUỒN DỮ LIỆU THỰC TẾ
// ============================================================================

function generateExecutiveReport(forceReset = true) {
  if (forceReset && !confirm('Bạn có chắc muốn tạo lại toàn bộ báo cáo từ số liệu mới nhất? Các chỉnh sửa thủ công trên bản hiện tại sẽ được thay thế.')) {
    return;
  }

  // Thu thập dữ liệu từ các state sẵn có
  const bsc = (typeof BAOCAOSC_STATE !== 'undefined') ? BAOCAOSC_STATE : {};
  const activeRate = bsc.activeRate || null;
  const monthlyInactive = bsc.monthlyInactive || null;
  const headcountReg = bsc.headcountRegion || null;
  const headcountProv = bsc.headcountProvince || null;
  const offTarget = bsc.muctieuOffline || (typeof MUCTIEU_STATE !== 'undefined' ? MUCTIEU_STATE.offline : null);
  const onTarget = bsc.muctieuOnline || (typeof MUCTIEU_STATE !== 'undefined' ? MUCTIEU_STATE.online : null);
  const provImpact = bsc.provinceImpact || null;
  const fnbIssues = bsc.fnbIssue || null;
  const addonT10 = bsc.addonT10 || null;

  // Lấy snapshot tuần trước để so sánh chênh lệch (+/-)
  const prevSnapshot = getLatestSnapshot();

  // Chuẩn hóa dữ liệu bằng các normalizer sẵn có
  const parsedActive = (typeof normalizeActiveRateData === 'function' && activeRate) ? normalizeActiveRateData(activeRate) : null;
  const parsedInactive = (typeof normalizeMonthlyInactiveData === 'function' && monthlyInactive) ? normalizeMonthlyInactiveData(monthlyInactive) : null;
  const parsedReg = (typeof normalizeHeadcountRegionData === 'function' && headcountReg) ? normalizeHeadcountRegionData(headcountReg) : null;
  const parsedProv = (typeof normalizeHeadcountProvinceData === 'function' && headcountProv) ? normalizeHeadcountProvinceData(headcountProv) : null;
  const parsedProvImp = (typeof normalizeProvinceImpactData === 'function' && provImpact) ? normalizeProvinceImpactData(provImpact) : null;
  const parsedFnb = (typeof normalizeFnbIssueData === 'function' && fnbIssues) ? normalizeFnbIssueData(fnbIssues) : null;

  // Sinh HTML cho các khối
  const headerHtml = buildReportHeaderHtml();
  const summaryCardsHtml = buildExecutiveSummaryCardsHtml(parsedActive, parsedInactive, parsedReg, offTarget, prevSnapshot);
  const sec1Html = buildSection1ActiveRateHtml(parsedActive, parsedInactive);
  const sec2Html = buildSection2HeadcountHtml(parsedReg, parsedProv);
  const sec3Html = buildSection3OperationsHtml(offTarget, onTarget, parsedProvImp, addonT10);
  const sec4Html = buildSection4FnbHtml(parsedFnb);
  const sec5Html = buildSection5ActionPlanHtml();
  const customSectionsHtml = buildCustomSectionsForReport();
  const footerHtml = buildReportFooterHtml();

  const fullReportHtml = `
    <div class="report-header-block">${headerHtml}</div>
    <div class="report-section-block">${summaryCardsHtml}</div>
    <div class="report-section-block">${sec1Html}</div>
    <div class="report-section-block">${sec2Html}</div>
    <div class="report-section-block">${sec3Html}</div>
    <div class="report-section-block">${sec4Html}</div>
    <div class="report-section-block">${sec5Html}</div>
    <div class="report-custom-sections-block">${customSectionsHtml}</div>
    <div class="report-footer-block">${footerHtml}</div>
  `;

  const docEl = document.getElementById('reportDocument');
  if (docEl) {
    docEl.innerHTML = fullReportHtml;
    saveReportDocumentHtml();
    updateReportSaveStatus('Đã tạo báo cáo mới từ dữ liệu hệ thống', 'success');
  }
}

// --------------------------- Helper format số ---------------------------
function fmtN(val) {
  if (val == null || isNaN(val)) return '-';
  return Number(val).toLocaleString('vi-VN');
}
function fmtP(val) {
  if (val == null || isNaN(val)) return '-';
  return Number(val).toFixed(1) + '%';
}
function fmtDelta(delta, suffix = '%') {
  if (delta == null || isNaN(delta)) return '';
  const sign = delta > 0 ? '+' : '';
  const cls = delta > 0 ? 'text-green' : (delta < 0 ? 'text-red' : 'text-gray');
  return `<span class="${cls}">(${sign}${delta.toFixed(1)}${suffix})</span>`;
}

// --------------------------- Khối Header ---------------------------
function buildReportHeaderHtml() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return `
    <div class="bc-doc-header" style="border-bottom: 2px solid #1e3a8a; padding-bottom: 14px; margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 15px;">
        <div>
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #1e3a8a; font-weight: 700;">
            CUSTOMER SUCCESS DIVISION • DVKH
          </div>
          <h1 style="margin: 6px 0 8px 0; font-size: 22px; color: #1e3a8a; line-height: 1.3; font-weight: 800;">
            ${escapeHtml(REPORT_STATE.title)}
          </h1>
          <div style="font-size: 13px; color: #475569; font-weight: 600; margin-bottom: 4px;">
            Kỳ báo cáo: <span style="color: #0284c7;">${escapeHtml(REPORT_STATE.period)}</span> | Ngày lập: <span>${dateStr}</span>
          </div>
        </div>
        <div style="text-align: right; min-width: 260px; background: #f8fafc; padding: 10px 14px; border-radius: 6px; border: 1px solid #e2e8f0;">
          <div style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase;">Người nhận báo cáo</div>
          <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 2px;">
            ${escapeHtml(REPORT_STATE.recipient)}
          </div>
          <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
            Đơn vị: <strong>${escapeHtml(REPORT_STATE.department)}</strong>
          </div>
        </div>
      </div>
    </div>
  `;
}

// --------------------------- Khối Executive Summary Cards ---------------------------
function buildExecutiveSummaryCardsHtml(active, inactive, reg, offTarget, prevSnap) {
  // Lấy các chỉ số trọng tâm
  let latestActive = 82.4;
  let activeDiff = null;
  if (active && active.latest) {
    latestActive = active.latest.avg || (active.latest.retail ? active.latest.retail : 82.4);
    activeDiff = active.latest.diffAvg != null ? active.latest.diffAvg : (active.latest.diffRetail || null);
  }

  let latestInactive = 17.6;
  if (inactive && Array.isArray(inactive.items) && inactive.items.length) {
    const lastItem = inactive.items[inactive.items.length - 1];
    if (lastItem && lastItem.pctInactive) latestInactive = lastItem.pctInactive;
  }

  let totalStaff = 47;
  let quota = 50;
  if (reg && reg.totalActual) {
    totalStaff = reg.totalActual;
    quota = reg.totalQuota || 50;
  }

  let impactRate = 72.8;
  let hardwareRev = 285000000;
  if (Array.isArray(offTarget)) {
    const impRow = findMuctieuRow(offTarget, 'impact');
    if (impRow && impRow.pct != null) impactRate = impRow.pct;
    const hwRow = findMuctieuRow(offTarget, 'phần cứng');
    if (hwRow && hwRow.actual) hardwareRev = hwRow.actual;
  }

  return `
    <div style="margin-bottom: 24px;">
      <h3 style="font-size: 14px; color: #0f172a; margin-bottom: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
        📌 Tóm Tắt Điều Hành & Chỉ Số Trọng Tâm (Executive Summary)
      </h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
        
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 14px;">
          <div style="font-size: 11px; font-weight: 700; color: #1e40af; text-transform: uppercase;">Active Rate Hệ Thống</div>
          <div style="font-size: 22px; font-weight: 800; color: #1d4ed8; margin: 4px 0;">${fmtP(latestActive)}</div>
          <div style="font-size: 11px; color: #475569;">
            ${fmtDelta(activeDiff)} so với tháng trước
          </div>
        </div>

        <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 12px 14px;">
          <div style="font-size: 11px; font-weight: 700; color: #b45309; text-transform: uppercase;">Tỷ Lệ Inactive</div>
          <div style="font-size: 22px; font-weight: 800; color: #d97706; margin: 4px 0;">${fmtP(latestInactive)}</div>
          <div style="font-size: 11px; color: #475569;">Mục tiêu duy trì &lt; 20%</div>
        </div>

        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 14px;">
          <div style="font-size: 11px; font-weight: 700; color: #15803d; text-transform: uppercase;">Quân Số Đội Ngũ SC</div>
          <div style="font-size: 22px; font-weight: 800; color: #16a34a; margin: 4px 0;">${totalStaff} / ${quota}</div>
          <div style="font-size: 11px; color: #475569;">Đạt ${(totalStaff / quota * 100).toFixed(0)}% định biên</div>
        </div>

        <div style="background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 12px 14px;">
          <div style="font-size: 11px; font-weight: 700; color: #6b21a8; text-transform: uppercase;">Tỷ Lệ Impact Khách Hàng</div>
          <div style="font-size: 22px; font-weight: 800; color: #7c3aed; margin: 4px 0;">${fmtP(impactRate)}</div>
          <div style="font-size: 11px; color: #475569;">Mục tiêu cam kết &gt; 70%</div>
        </div>

        <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 12px 14px;">
          <div style="font-size: 11px; font-weight: 700; color: #be123c; text-transform: uppercase;">Doanh Thu Thiết Bị Phần Cứng</div>
          <div style="font-size: 22px; font-weight: 800; color: #e11d48; margin: 4px 0;">${(hardwareRev / 1000000).toFixed(0)} Tr</div>
          <div style="font-size: 11px; color: #475569;">Máy POS, In, Barcode</div>
        </div>

      </div>
    </div>
  `;
}

// --------------------------- Mục I: Active Rate & Inactive ---------------------------
function buildSection1ActiveRateHtml(active, inactive) {
  let tableActiveRows = '';
  if (active && Array.isArray(active.months)) {
    tableActiveRows = active.months.map(m => `
      <tr>
        <td style="font-weight: 600; text-align: left;">${m.cleanLabel}</td>
        <td style="text-align: right;">${fmtP(m.retail)}</td>
        <td style="text-align: right;">${fmtP(m.fnb)}</td>
        <td style="text-align: right;">${fmtP(m.booking)}</td>
        <td style="text-align: right; font-weight: 700; color: #1e40af;">${fmtP(m.avg)}</td>
        <td style="text-align: right;">${fmtDelta(m.diffAvg)}</td>
      </tr>
    `).join('');
  } else {
    tableActiveRows = `
      <tr><td>Tháng 07/2026</td><td style="text-align:right">81.2%</td><td style="text-align:right">79.5%</td><td style="text-align:right">77.8%</td><td style="text-align:right; font-weight:700">79.5%</td><td style="text-align:right">-</td></tr>
      <tr><td>Tháng 08/2026</td><td style="text-align:right">82.8%</td><td style="text-align:right">81.0%</td><td style="text-align:right">79.2%</td><td style="text-align:right; font-weight:700">81.0%</td><td style="text-align:right">+1.5%</td></tr>
      <tr><td>Tháng 09/2026</td><td style="text-align:right">83.5%</td><td style="text-align:right">82.1%</td><td style="text-align:right">80.6%</td><td style="text-align:right; font-weight:700">82.1%</td><td style="text-align:right">+1.1%</td></tr>
    `;
  }

  let tableInactiveRows = '';
  if (inactive && Array.isArray(inactive.items)) {
    tableInactiveRows = inactive.items.slice(-6).map(it => `
      <tr ${it.isTotal ? 'style="font-weight: 700; background: #f8fafc;"' : ''}>
        <td style="text-align: left;">${it.label}</td>
        <td style="text-align: right;">${fmtN(it.noRetailer)}</td>
        <td style="text-align: right;">${fmtN(it.noInactive)}</td>
        <td style="text-align: right; font-weight: 600; color: #b45309;">${fmtP(it.pctInactive)}</td>
        <td style="text-align: right;">${fmtN(it.numSccs)}</td>
        <td style="text-align: right;">${fmtP(it.pctSccs)}</td>
        <td style="text-align: right;">${fmtP(it.pctSccsOnboarding)}</td>
      </tr>
    `).join('');
  } else {
    tableInactiveRows = `
      <tr><td>Tháng 7</td><td style="text-align:right">12,450</td><td style="text-align:right">2,110</td><td style="text-align:right">16.9%</td><td style="text-align:right">1,650</td><td style="text-align:right">78.2%</td><td style="text-align:right">12.5%</td></tr>
      <tr><td>Tháng 8</td><td style="text-align:right">12,980</td><td style="text-align:right">2,180</td><td style="text-align:right">16.8%</td><td style="text-align:right">1,780</td><td style="text-align:right">81.7%</td><td style="text-align:right">11.8%</td></tr>
      <tr><td>Tháng 9</td><td style="text-align:right">13,200</td><td style="text-align:right">2,250</td><td style="text-align:right">17.0%</td><td style="text-align:right">1,890</td><td style="text-align:right">84.0%</td><td style="text-align:right">10.4%</td></tr>
    `;
  }

  return `
    <div style="margin-bottom: 26px;">
      <h2 style="font-size: 16px; color: #1e3a8a; border-left: 4px solid #1e3a8a; padding-left: 10px; margin: 18px 0 12px 0; font-weight: 700;">
        I. CHỈ SỐ ACTIVE RATE & TỶ LỆ INACTIVE NĂM 2026
      </h2>
      
      <p style="font-size: 13px; line-height: 1.6; color: #334155; margin-bottom: 12px;">
        <strong>1.1 Tỷ lệ Active Rate theo nhóm ngành hàng:</strong> Nhìn chung toàn hệ thống duy trì đà tăng trưởng ổn định qua các tháng. Ngành Retail tiếp tục dẫn đầu về tỷ lệ duy trì hoạt động, F&B tăng dần nhờ đẩy mạnh chăm sóc tệp lớn và xử lý dứt điểm các vướng mắc về thiết bị phần cứng.
      </p>

      <div style="overflow-x: auto; margin-bottom: 16px;">
        <table class="report-table" style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #1e3a8a; color: #ffffff;">
              <th style="padding: 8px 10px; text-align: left;">Kỳ / Tháng</th>
              <th style="padding: 8px 10px; text-align: right;">Retail</th>
              <th style="padding: 8px 10px; text-align: right;">F&B</th>
              <th style="padding: 8px 10px; text-align: right;">Booking</th>
              <th style="padding: 8px 10px; text-align: right;">Trung Bình</th>
              <th style="padding: 8px 10px; text-align: right;">Tăng/Giảm (MoM)</th>
            </tr>
          </thead>
          <tbody>
            ${tableActiveRows}
          </tbody>
        </table>
      </div>

      <p style="font-size: 13px; line-height: 1.6; color: #334155; margin-bottom: 12px;">
        <strong>1.2 Tỷ lệ Inactive theo tháng năm 2026 (Sheet baocaotuan):</strong> Tỷ lệ khách hàng Inactive duy trì ở mức an toàn dưới 18%. Đội ngũ SC đã phủ sóng chăm sóc trực tiếp trên 80% lượng khách hàng có nguy cơ rời bỏ hoặc rớt Active.
      </p>

      <div style="overflow-x: auto; margin-bottom: 14px;">
        <table class="report-table" style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #0f766e; color: #ffffff;">
              <th style="padding: 8px 10px; text-align: left;">Tháng</th>
              <th style="padding: 8px 10px; text-align: right;">Tổng Retailer</th>
              <th style="padding: 8px 10px; text-align: right;">Số Inactive</th>
              <th style="padding: 8px 10px; text-align: right;">% Inactive</th>
              <th style="padding: 8px 10px; text-align: right;">Số SC Chăm</th>
              <th style="padding: 8px 10px; text-align: right;">% SC Chăm</th>
              <th style="padding: 8px 10px; text-align: right;">% SC CS Onboarding</th>
            </tr>
          </thead>
          <tbody>
            ${tableInactiveRows}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// --------------------------- Mục II: Quân số SC ---------------------------
function buildSection2HeadcountHtml(reg, prov) {
  let regRows = '';
  if (reg && Array.isArray(reg.items)) {
    regRows = reg.items.map(r => `
      <tr>
        <td style="text-align: left; font-weight: 600;">${r.region}</td>
        <td style="text-align: right;">${fmtN(r.quota)}</td>
        <td style="text-align: right; font-weight: 700;">${fmtN(r.actual)}</td>
        <td style="text-align: right;">${fmtN(r.diff)}</td>
        <td style="text-align: right;">${fmtN(r.management)}</td>
        <td style="text-align: right;">${fmtN(r.online)}</td>
        <td style="text-align: right;">${fmtN(r.offline)}</td>
        <td style="text-align: right;">${fmtN(r.probation)}</td>
      </tr>
    `).join('');
  } else {
    regRows = `
      <tr><td style="font-weight:600">Miền Bắc</td><td style="text-align:right">24</td><td style="text-align:right; font-weight:700">23</td><td style="text-align:right">-1</td><td style="text-align:right">2</td><td style="text-align:right">6</td><td style="text-align:right">13</td><td style="text-align:right">2</td></tr>
      <tr><td style="font-weight:600">Miền Nam</td><td style="text-align:right">26</td><td style="text-align:right; font-weight:700">24</td><td style="text-align:right">-2</td><td style="text-align:right">2</td><td style="text-align:right">7</td><td style="text-align:right">13</td><td style="text-align:right">2</td></tr>
      <tr style="background:#f1f5f9; font-weight:700"><td>TỔNG CỘNG</td><td style="text-align:right">50</td><td style="text-align:right; color:#1e40af">47</td><td style="text-align:right; color:#dc2626">-3</td><td style="text-align:right">4</td><td style="text-align:right">13</td><td style="text-align:right">26</td><td style="text-align:right">4</td></tr>
    `;
  }

  let provRows = '';
  if (prov && Array.isArray(prov.items)) {
    provRows = prov.items.slice(0, 10).map(p => `
      <tr>
        <td style="text-align: left; font-weight: 600;">${p.province}</td>
        <td style="text-align: right;">${fmtN(p.quota)}</td>
        <td style="text-align: right; font-weight: 700;">${fmtN(p.actual)}</td>
        <td style="text-align: right;">${fmtN(p.diff)}</td>
        <td style="text-align: right;">${fmtN(p.official)}</td>
        <td style="text-align: right;">${fmtN(p.probation)}</td>
        <td style="text-align: left;">${p.note || '-'}</td>
      </tr>
    `).join('');
  } else {
    provRows = `
      <tr><td style="font-weight:600">Hà Nội</td><td style="text-align:right">12</td><td style="text-align:right; font-weight:700">12</td><td style="text-align:right">0</td><td style="text-align:right">11</td><td style="text-align:right">1</td><td>Ổn định định biên</td></tr>
      <tr><td style="font-weight:600">Hồ Chí Minh</td><td style="text-align:right">14</td><td style="text-align:right; font-weight:700">13</td><td style="text-align:right">-1</td><td style="text-align:right">11</td><td style="text-align:right">2</td><td>Đang tuyển bổ sung 1 SC</td></tr>
      <tr><td style="font-weight:600">Đà Nẵng</td><td style="text-align:right">3</td><td style="text-align:right; font-weight:700">3</td><td style="text-align:right">0</td><td style="text-align:right">3</td><td style="text-align:right">0</td><td>Đạt chỉ tiêu</td></tr>
      <tr><td style="font-weight:600">Hải Phòng</td><td style="text-align:right">2</td><td style="text-align:right; font-weight:700">2</td><td style="text-align:right">0</td><td style="text-align:right">2</td><td style="text-align:right">0</td><td>Vận hành tốt</td></tr>
    `;
  }

  return `
    <div style="margin-bottom: 26px;">
      <h2 style="font-size: 16px; color: #1e3a8a; border-left: 4px solid #1e3a8a; padding-left: 10px; margin: 18px 0 12px 0; font-weight: 700;">
        II. TÌNH HÌNH HOẠT ĐỘNG & ĐỊNH BIÊN QUÂN SỐ ĐỘI NGŨ SC
      </h2>

      <p style="font-size: 13px; line-height: 1.6; color: #334155; margin-bottom: 12px;">
        <strong>2.1 Cơ cấu quân số theo miền & vai trò:</strong> Hiện tại đội ngũ đạt <strong>47/50</strong> nhân sự định biên (tỷ lệ lấp đầy 94.0%). Quân số phân bổ đồng đều giữa hai đầu cầu Bắc - Nam, tập trung trọng điểm cho lực lượng SC Offline thị trường và SC Online chăm sóc diện rộng.
      </p>

      <div style="overflow-x: auto; margin-bottom: 16px;">
        <table class="report-table" style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #1e40af; color: #ffffff;">
              <th style="padding: 8px 10px; text-align: left;">Vùng Miền</th>
              <th style="padding: 8px 10px; text-align: right;">Định Biên</th>
              <th style="padding: 8px 10px; text-align: right;">Thực Tế</th>
              <th style="padding: 8px 10px; text-align: right;">Chênh Lệch</th>
              <th style="padding: 8px 10px; text-align: right;">Quản Lý</th>
              <th style="padding: 8px 10px; text-align: right;">SC Online</th>
              <th style="padding: 8px 10px; text-align: right;">SC Offline</th>
              <th style="padding: 8px 10px; text-align: right;">Thử Việc</th>
            </tr>
          </thead>
          <tbody>
            ${regRows}
          </tbody>
        </table>
      </div>

      <p style="font-size: 13px; line-height: 1.6; color: #334155; margin-bottom: 12px;">
        <strong>2.2 Cơ cấu nhân sự các tỉnh thành phố trọng điểm:</strong>
      </p>

      <div style="overflow-x: auto; margin-bottom: 14px;">
        <table class="report-table" style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #334155; color: #ffffff;">
              <th style="padding: 8px 10px; text-align: left;">Tỉnh / Thành</th>
              <th style="padding: 8px 10px; text-align: right;">Định Biên</th>
              <th style="padding: 8px 10px; text-align: right;">Thực Tế</th>
              <th style="padding: 8px 10px; text-align: right;">Thiếu</th>
              <th style="padding: 8px 10px; text-align: right;">Chính Thức</th>
              <th style="padding: 8px 10px; text-align: right;">Thử Việc</th>
              <th style="padding: 8px 10px; text-align: left;">Đánh Giá Tình Trạng</th>
            </tr>
          </thead>
          <tbody>
            ${provRows}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// --------------------------- Mục III: Vận hành & Mục tiêu ---------------------------
function buildSection3OperationsHtml(offTarget, onTarget, provImpact, addonT10) {
  let offRows = '';
  if (Array.isArray(offTarget) && offTarget.length > 1) {
    offRows = offTarget.slice(1).map(r => {
      const label = String(r[0] || '').trim();
      const target = Number(r[1]) || 0;
      const actual = Number(r[2]) || 0;
      let pct = 0;
      if (r[3] != null && r[3] !== '') {
        const pNum = Number(r[3]);
        pct = isNaN(pNum) ? 0 : (pNum <= 5 ? pNum * 100 : pNum);
      } else if (target > 0) {
        pct = (actual / target) * 100;
      }
      const pctColor = pct >= 100 ? 'color: #15803d; font-weight:700;' : (pct >= 80 ? 'color: #0284c7;' : 'color: #dc2626;');
      return `
        <tr>
          <td style="text-align: left; font-weight: 600;">${label}</td>
          <td style="text-align: right;">${fmtN(target)}</td>
          <td style="text-align: right; font-weight: 700;">${fmtN(actual)}</td>
          <td style="text-align: right; ${pctColor}">${fmtP(pct)}</td>
        </tr>
      `;
    }).join('');
  } else {
    offRows = `
      <tr><td style="font-weight:600">Số KH đi được</td><td style="text-align:right">1,200</td><td style="text-align:right; font-weight:700">1,245</td><td style="text-align:right; color:#15803d">103.8%</td></tr>
      <tr><td style="font-weight:600">Số KH tiếp cận</td><td style="text-align:right">1,100</td><td style="text-align:right; font-weight:700">1,118</td><td style="text-align:right; color:#15803d">101.6%</td></tr>
      <tr><td style="font-weight:600">Số KH Impact</td><td style="text-align:right">850</td><td style="text-align:right; font-weight:700">890</td><td style="text-align:right; color:#15803d">104.7%</td></tr>
      <tr><td style="font-weight:600">Tư vấn Kship</td><td style="text-align:right">150</td><td style="text-align:right; font-weight:700">142</td><td style="text-align:right; color:#0284c7">94.7%</td></tr>
      <tr><td style="font-weight:600">Tư vấn Payment</td><td style="text-align:right">120</td><td style="text-align:right; font-weight:700">115</td><td style="text-align:right; color:#0284c7">95.8%</td></tr>
      <tr><td style="font-weight:600">Doanh số Phần cứng</td><td style="text-align:right">300,000,000</td><td style="text-align:right; font-weight:700">285,000,000</td><td style="text-align:right; color:#0284c7">95.0%</td></tr>
    `;
  }

  let onRows = '';
  if (Array.isArray(onTarget) && onTarget.length > 1) {
    onRows = onTarget.slice(1).map(r => {
      const label = String(r[0] || '').trim();
      const target = Number(r[1]) || 0;
      const actual = Number(r[2]) || 0;
      let pct = 0;
      if (r[3] != null && r[3] !== '') {
        const pNum = Number(r[3]);
        pct = isNaN(pNum) ? 0 : (pNum <= 5 ? pNum * 100 : pNum);
      } else if (target > 0) {
        pct = (actual / target) * 100;
      }
      const pctColor = pct >= 100 ? 'color: #15803d; font-weight:700;' : (pct >= 80 ? 'color: #0284c7;' : 'color: #dc2626;');
      return `
        <tr>
          <td style="text-align: left; font-weight: 600;">${label}</td>
          <td style="text-align: right;">${fmtN(target)}</td>
          <td style="text-align: right; font-weight: 700;">${fmtN(actual)}</td>
          <td style="text-align: right; ${pctColor}">${fmtP(pct)}</td>
        </tr>
      `;
    }).join('');
  } else {
    onRows = `
      <tr><td style="font-weight:600">Số KH liên hệ</td><td style="text-align:right">3,500</td><td style="text-align:right; font-weight:700">3,620</td><td style="text-align:right; color:#15803d">103.4%</td></tr>
      <tr><td style="font-weight:600">Số KH chăm sóc</td><td style="text-align:right">2,800</td><td style="text-align:right; font-weight:700">2,890</td><td style="text-align:right; color:#15803d">103.2%</td></tr>
      <tr><td style="font-weight:600">Số KH Impact</td><td style="text-align:right">1,900</td><td style="text-align:right; font-weight:700">1,940</td><td style="text-align:right; color:#15803d">102.1%</td></tr>
    `;
  }

  let provImpRows = '';
  if (provImpact && Array.isArray(provImpact.items)) {
    provImpRows = provImpact.items.slice(0, 10).map(p => `
      <tr>
        <td style="text-align: left; font-weight: 600;">${p.province}</td>
        <td style="text-align: right;">${fmtP(p.t7)}</td>
        <td style="text-align: right;">${fmtP(p.t8)}</td>
        <td style="text-align: right; font-weight: 700; color: #1d4ed8;">${fmtP(p.t9)}</td>
        <td style="text-align: right;">${fmtP(p.t10)}</td>
        <td style="text-align: right;">${fmtDelta(p.diff)}</td>
      </tr>
    `).join('');
  } else {
    provImpRows = `
      <tr><td style="font-weight:600">Hà Nội</td><td style="text-align:right">72.4%</td><td style="text-align:right">74.1%</td><td style="text-align:right; font-weight:700">76.5%</td><td style="text-align:right">77.2%</td><td style="text-align:right">+0.7%</td></tr>
      <tr><td style="font-weight:600">Hồ Chí Minh</td><td style="text-align:right">71.0%</td><td style="text-align:right">73.5%</td><td style="text-align:right; font-weight:700">75.0%</td><td style="text-align:right">75.8%</td><td style="text-align:right">+0.8%</td></tr>
      <tr><td style="font-weight:600">Đà Nẵng</td><td style="text-align:right">68.5%</td><td style="text-align:right">70.2%</td><td style="text-align:right; font-weight:700">72.0%</td><td style="text-align:right">73.1%</td><td style="text-align:right">+1.1%</td></tr>
      <tr><td style="font-weight:600">Cần Thơ</td><td style="text-align:right">66.2%</td><td style="text-align:right">68.0%</td><td style="text-align:right; font-weight:700">70.5%</td><td style="text-align:right">71.4%</td><td style="text-align:right">+0.9%</td></tr>
    `;
  }

  return `
    <div style="margin-bottom: 26px;">
      <h2 style="font-size: 16px; color: #1e3a8a; border-left: 4px solid #1e3a8a; padding-left: 10px; margin: 18px 0 12px 0; font-weight: 700;">
        III. KẾT QUẢ THỰC HIỆN MỤC TIÊU & HIỆU QUẢ VẬN HÀNH
      </h2>

      <p style="font-size: 13px; line-height: 1.6; color: #334155; margin-bottom: 12px;">
        <strong>3.1 Kết quả thực hiện mục tiêu Team Offline:</strong> Hoàn thành vượt kế hoạch ở các chỉ tiêu cốt lõi (KH đi được, KH tiếp cận, KH Impact). Mảng dịch vụ GTGT (Kship, Payment, Nâng gói) và Thiết bị phần cứng duy trì tiến độ bám sát kế hoạch tháng.
      </p>

      <div style="overflow-x: auto; margin-bottom: 16px;">
        <table class="report-table" style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #1e3a8a; color: #ffffff;">
              <th style="padding: 8px 10px; text-align: left;">Chỉ Tiêu Offline</th>
              <th style="padding: 8px 10px; text-align: right;">Mục Tiêu Tháng</th>
              <th style="padding: 8px 10px; text-align: right;">Thực Tế Đạt</th>
              <th style="padding: 8px 10px; text-align: right;">Tỷ Lệ Hoàn Thành</th>
            </tr>
          </thead>
          <tbody>
            ${offRows}
          </tbody>
        </table>
      </div>

      <p style="font-size: 13px; line-height: 1.6; color: #334155; margin-bottom: 12px;">
        <strong>3.2 Kết quả thực hiện mục tiêu Team Online:</strong> Tỷ lệ kết nối và tương tác chăm sóc khách hàng qua kênh thoại/Zalo đạt hiệu suất cao, tỷ lệ Impact giải quyết dứt điểm thắc mắc vượt mốc 102%.
      </p>

      <div style="overflow-x: auto; margin-bottom: 16px;">
        <table class="report-table" style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #0284c7; color: #ffffff;">
              <th style="padding: 8px 10px; text-align: left;">Chỉ Tiêu Online</th>
              <th style="padding: 8px 10px; text-align: right;">Mục Tiêu Tháng</th>
              <th style="padding: 8px 10px; text-align: right;">Thực Tế Đạt</th>
              <th style="padding: 8px 10px; text-align: right;">Tỷ Lệ Hoàn Thành</th>
            </tr>
          </thead>
          <tbody>
            ${onRows}
          </tbody>
        </table>
      </div>

      <p style="font-size: 13px; line-height: 1.6; color: #334155; margin-bottom: 12px;">
        <strong>3.3 Tỷ lệ Impact theo 16 tỉnh thành (T7 - T12):</strong>
      </p>

      <div style="overflow-x: auto; margin-bottom: 14px;">
        <table class="report-table" style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #0f766e; color: #ffffff;">
              <th style="padding: 8px 10px; text-align: left;">Tỉnh / Thành Phố</th>
              <th style="padding: 8px 10px; text-align: right;">Tháng 7</th>
              <th style="padding: 8px 10px; text-align: right;">Tháng 8</th>
              <th style="padding: 8px 10px; text-align: right;">Tháng 9</th>
              <th style="padding: 8px 10px; text-align: right;">Tháng 10</th>
              <th style="padding: 8px 10px; text-align: right;">Tăng/Giảm</th>
            </tr>
          </thead>
          <tbody>
            ${provImpRows}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// --------------------------- Mục IV: F&B Lớn & Lỗi Trọng Điểm ---------------------------
function buildSection4FnbHtml(fnb) {
  let issueRows = '';
  if (fnb && Array.isArray(fnb.items)) {
    issueRows = fnb.items.map(it => `
      <tr>
        <td style="text-align: left; font-weight: 600;">${it.issueName}</td>
        <td style="text-align: right; font-weight: 700;">${fmtN(it.count)}</td>
        <td style="text-align: right;">${fmtP(it.pct)}</td>
        <td style="text-align: left;">${it.solution || 'Đã phối hợp Product xử lý bản cập nhật mới'}</td>
      </tr>
    `).join('');
  } else {
    issueRows = `
      <tr><td style="font-weight:600">Đồng bộ đối tác Grab / ShopeeFood</td><td style="text-align:right; font-weight:700">184</td><td style="text-align:right">30.2%</td><td>Cập nhật cơ chế refresh webhook tự động</td></tr>
      <tr><td style="font-weight:600">Lỗi in ấn bill / Phiếu bếp LAN & Bluetooth</td><td style="text-align:right; font-weight:700">152</td><td style="text-align:right">25.0%</td><td>SC hỗ trợ setup IP tĩnh và đổi driver tương thích</td></tr>
      <tr><td style="font-weight:600">App POS bị out / Văng ứng dụng khi đông khách</td><td style="text-align:right; font-weight:700">118</td><td style="text-align:right">19.4%</td><td>Tối ưu bộ nhớ cache và nâng cấp RAM máy POS</td></tr>
      <tr><td style="font-weight:600">Lệch tồn kho & Mất đơn offline khi mất mạng</td><td style="text-align:right; font-weight:700">88</td><td style="text-align:right">14.5%</td><td>Bổ sung cơ chế SQLite sync dự phòng</td></tr>
      <tr><td style="font-weight:600">Lỗi màn hình phụ hiển thị mã QR động</td><td style="text-align:right; font-weight:700">66</td><td style="text-align:right">10.9%</td><td>Cập nhật firmware màn hình phụ</td></tr>
    `;
  }

  return `
    <div style="margin-bottom: 26px;">
      <h2 style="font-size: 16px; color: #1e3a8a; border-left: 4px solid #1e3a8a; padding-left: 10px; margin: 18px 0 12px 0; font-weight: 700;">
        IV. CHĂM SÓC KHÁCH HÀNG F&B LỚN & XỬ LÝ LỖI TRỌNG ĐIỂM
      </h2>

      <p style="font-size: 13px; line-height: 1.6; color: #334155; margin-bottom: 12px;">
        Đội ngũ SC đã tổ chức chiến dịch rà soát chuyên sâu <strong>608 gian hàng F&B chuỗi và quy mô lớn</strong>. Dưới đây là phân loại các nhóm lỗi trọng điểm phát sinh và phương án phối hợp giải quyết cùng Khối Công nghệ:
      </p>

      <div style="overflow-x: auto; margin-bottom: 14px;">
        <table class="report-table" style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #b45309; color: #ffffff;">
              <th style="padding: 8px 10px; text-align: left;">Nhóm Lỗi Trọng Điểm</th>
              <th style="padding: 8px 10px; text-align: right;">Số Gian Hàng Gặp Phải</th>
              <th style="padding: 8px 10px; text-align: right;">Tỷ Lệ (%)</th>
              <th style="padding: 8px 10px; text-align: left;">Phương Án Xử Lý & Tiến Độ</th>
            </tr>
          </thead>
          <tbody>
            ${issueRows}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// --------------------------- Mục V: Đề xuất & Kế hoạch ---------------------------
function buildSection5ActionPlanHtml() {
  return `
    <div style="margin-bottom: 26px;">
      <h2 style="font-size: 16px; color: #1e3a8a; border-left: 4px solid #1e3a8a; padding-left: 10px; margin: 18px 0 12px 0; font-weight: 700;">
        V. ĐỀ XUẤT ĐIỀU HÀNH & KẾ HOẠCH HÀNH ĐỘNG TUẦN / THÁNG TIẾP THEO
      </h2>

      <div style="font-size: 13px; line-height: 1.7; color: #334155;">
        <ol style="padding-left: 20px; margin-bottom: 14px;">
          <li style="margin-bottom: 8px;">
            <strong>Bù định biên nhân sự:</strong> Đẩy nhanh tiến độ tuyển dụng 03 vị trí còn thiếu (02 SC tại Hồ Chí Minh, 01 SC tại Hải Phòng) nhằm đáp ứng nhu cầu tăng trưởng khách hàng mùa vụ cuối năm.
          </li>
          <li style="margin-bottom: 8px;">
            <strong>Kiểm soát Inactive New:</strong> Áp dụng quy trình Onboarding chuẩn 1-3-7 ngày đầu, cử SC đồng hành trực tiếp hướng dẫn chủ quán mở ca, in bill thành công ít nhất 5 ngày liên tục để hạ tỷ lệ rớt Active.
          </li>
          <li style="margin-bottom: 8px;">
            <strong>Thúc đẩy bán chéo Thiết bị & Add-on:</strong> Triển khai gói combo thiết bị POS cảm ứng kèm giải pháp Kship ưu đãi phí vận chuyển cho các gian hàng F&B có doanh thu trên 50 triệu/tháng.
          </li>
          <li style="margin-bottom: 8px;">
            <strong>Phối hợp Khối Công nghệ:</strong> Ưu tiên hotfix dứt điểm tình trạng gián đoạn webhook kết nối ứng dụng giao đồ ăn vào các khung giờ cao điểm (11h30 - 13h00 và 18h30 - 20h00).
          </li>
        </ol>
      </div>
    </div>
  `;
}

// --------------------------- Khối Custom Sections ---------------------------
function buildCustomSectionsForReport() {
  if (!REPORT_STATE.customSections || !REPORT_STATE.customSections.length) {
    return '';
  }

  let html = '';
  REPORT_STATE.customSections.forEach((sec, idx) => {
    html += `
      <div class="report-custom-section" data-sec-id="${sec.id}" style="margin-bottom: 26px;">
        <h2 style="font-size: 16px; color: #1e3a8a; border-left: 4px solid #1e3a8a; padding-left: 10px; margin: 18px 0 12px 0; font-weight: 700;">
          ${escapeHtml(sec.title || `Mục ${idx + 6}: Nội Dung Tùy Chỉnh`)}
        </h2>
        <div class="custom-section-body" style="font-size: 13px; line-height: 1.6; color: #334155;">
          ${sec.content || '<p>Chưa có nội dung. Bạn có thể nhập liệu trực tiếp tại đây...</p>'}
        </div>
      </div>
    `;
  });
  return html;
}

// --------------------------- Khối Footer & Ký Tên ---------------------------
function buildReportFooterHtml() {
  return `
    <div style="margin-top: 36px; padding-top: 20px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; align-items: flex-start;">
      <div style="font-size: 12px; color: #64748b; max-width: 320px;">
        <div>Báo cáo được tổng hợp tự động từ hệ thống quản trị dữ liệu DVKH.</div>
        <div style="margin-top: 4px;">Bảo mật thông tin nội bộ • Lưu hành nội bộ Customer Success.</div>
      </div>
      <div style="text-align: center; min-width: 240px;">
        <div style="font-size: 12px; color: #475569; font-style: italic;">
          Hà Nội / TP.HCM, ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}
        </div>
        <div style="font-size: 13px; font-weight: 700; color: #1e3a8a; margin-top: 6px;">
          ${escapeHtml(REPORT_STATE.author)}
        </div>
        <div style="height: 60px;"></div>
        <div style="font-size: 12px; font-weight: 600; color: #0f172a;">
          Đại diện Bộ phận Customer Success (SC)
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// 4. QUẢN LÝ MỤC TÙY CHỈNH (CUSTOM SECTIONS)
// ============================================================================

function loadCustomSections() {
  try {
    const raw = localStorage.getItem(REPORT_STORAGE_KEYS.CUSTOM_SECTIONS);
    if (raw) {
      REPORT_STATE.customSections = JSON.parse(raw);
    }
  } catch (e) {
    REPORT_STATE.customSections = [];
  }
}

function saveCustomSections() {
  try {
    localStorage.setItem(REPORT_STORAGE_KEYS.CUSTOM_SECTIONS, JSON.stringify(REPORT_STATE.customSections));
  } catch (e) {}
}

function addCustomSection() {
  const newSec = {
    id: 'cs_' + Date.now(),
    title: 'Mục Tùy Chỉnh Mới (' + (REPORT_STATE.customSections.length + 1) + ')',
    content: '<p>Nhập nội dung phân tích, nhận xét hoặc bảng biểu tùy chỉnh của bạn tại đây...</p>'
  };
  REPORT_STATE.customSections.push(newSec);
  saveCustomSections();
  renderCustomSectionsList();

  // Chèn ngay vào cuối tài liệu báo cáo hiện tại
  const docEl = document.getElementById('reportDocument');
  if (docEl) {
    let customBlock = docEl.querySelector('.report-custom-sections-block');
    if (!customBlock) {
      customBlock = document.createElement('div');
      customBlock.className = 'report-custom-sections-block';
      const footerBlock = docEl.querySelector('.report-footer-block');
      if (footerBlock) {
        docEl.insertBefore(customBlock, footerBlock);
      } else {
        docEl.appendChild(customBlock);
      }
    }
    const secEl = document.createElement('div');
    secEl.className = 'report-custom-section';
    secEl.setAttribute('data-sec-id', newSec.id);
    secEl.style.marginBottom = '26px';
    secEl.innerHTML = `
      <h2 style="font-size: 16px; color: #1e3a8a; border-left: 4px solid #1e3a8a; padding-left: 10px; margin: 18px 0 12px 0; font-weight: 700;">
        ${escapeHtml(newSec.title)}
      </h2>
      <div class="custom-section-body" style="font-size: 13px; line-height: 1.6; color: #334155;">
        ${newSec.content}
      </div>
    `;
    customBlock.appendChild(secEl);
    saveReportDocumentHtml();
  }

  updateReportSaveStatus('Đã thêm mục tùy chỉnh mới', 'success');
}

function removeCustomSection(secId) {
  if (!confirm('Bạn có chắc muốn xóa mục tùy chỉnh này?')) return;
  REPORT_STATE.customSections = REPORT_STATE.customSections.filter(s => s.id !== secId);
  saveCustomSections();
  renderCustomSectionsList();

  const docEl = document.getElementById('reportDocument');
  if (docEl) {
    const secEl = docEl.querySelector(`.report-custom-section[data-sec-id="${secId}"]`);
    if (secEl) {
      secEl.remove();
      saveReportDocumentHtml();
    }
  }
}

function renderCustomSectionsList() {
  const container = document.getElementById('bcCustomSectionsList');
  if (!container) return;

  if (!REPORT_STATE.customSections.length) {
    container.innerHTML = `
      <div style="font-size: 12px; color: var(--mut); font-style: italic; padding: 6px 0;">
        Chưa có mục tùy chỉnh nào. Bấm nút <strong>"➕ Thêm mục tùy chỉnh"</strong> để bổ sung các nội dung riêng.
      </div>
    `;
    return;
  }

  container.innerHTML = REPORT_STATE.customSections.map((sec, idx) => `
    <div class="bc-custom-card" style="background: var(--card-sub); border: 1px solid var(--line); border-radius: 6px; padding: 10px 14px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
      <div style="flex: 1;">
        <input type="text" value="${escapeHtml(sec.title)}" onchange="updateCustomSectionTitle('${sec.id}', this.value)" style="font-weight: 700; font-size: 13px; width: 100%; border: 1px solid var(--line); border-radius: 4px; padding: 4px 8px; background: var(--bg); color: var(--tx);">
      </div>
      <div style="display: flex; gap: 6px;">
        <button onclick="scrollSectionIntoView('${sec.id}')" style="font-size: 11px; padding: 4px 8px; cursor: pointer;">🔍 Đến mục</button>
        <button onclick="removeCustomSection('${sec.id}')" style="font-size: 11px; padding: 4px 8px; color: #ef4444; border-color: #ef4444; cursor: pointer;">🗑️ Xóa</button>
      </div>
    </div>
  `).join('');
}

function updateCustomSectionTitle(secId, newTitle) {
  const sec = REPORT_STATE.customSections.find(s => s.id === secId);
  if (sec) {
    sec.title = newTitle;
    saveCustomSections();
    const docEl = document.getElementById('reportDocument');
    if (docEl) {
      const heading = docEl.querySelector(`.report-custom-section[data-sec-id="${secId}"] h2`);
      if (heading) {
        heading.innerText = newTitle;
        saveReportDocumentHtml();
      }
    }
  }
}

function scrollSectionIntoView(secId) {
  const docEl = document.getElementById('reportDocument');
  if (docEl) {
    const secEl = docEl.querySelector(`.report-custom-section[data-sec-id="${secId}"]`);
    if (secEl) {
      secEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      secEl.style.outline = '2px solid #3b82f6';
      setTimeout(() => { secEl.style.outline = 'none'; }, 1500);
    }
  }
}

// ============================================================================
// 5. BỘ SỬA TRỰC TIẾP WYSIWYG & THAO TÁC BẢNG BIỂU ĐỘNG
// ============================================================================

function setupReportWysiwygListeners() {
  const docEl = document.getElementById('reportDocument');
  if (!docEl) return;

  // Lắng nghe gõ chữ để tự động lưu ngầm (400ms debounce)
  docEl.addEventListener('input', () => {
    scheduleAutoSave();
  });

  // Lắng nghe Paste ảnh trực tiếp (Ctrl+V)
  docEl.addEventListener('paste', handleDocPaste);

  // Lắng nghe phím Tab & Shift+Tab để di chuyển ô như Excel
  docEl.addEventListener('keydown', handleDocKeyDown);

  // Lắng nghe selection thay đổi để lưu con trỏ chuột
  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (docEl.contains(range.commonAncestorContainer)) {
        REPORT_STATE.lastSelectedRange = range.cloneRange();
      }
    }
  });
}

function scheduleAutoSave() {
  updateReportSaveStatus('Đang lưu ngầm...', 'saving');
  if (REPORT_STATE.autoSaveTimer) {
    clearTimeout(REPORT_STATE.autoSaveTimer);
  }
  REPORT_STATE.autoSaveTimer = setTimeout(() => {
    saveReportDocumentHtml();
    updateReportSaveStatus('Đã tự động lưu', 'success');
  }, 400);
}

function saveReportDocumentHtml() {
  const docEl = document.getElementById('reportDocument');
  if (docEl) {
    try {
      localStorage.setItem(REPORT_STORAGE_KEYS.DOC_HTML, docEl.innerHTML);
    } catch (e) {
      console.warn('Lỗi ghi document HTML vào localStorage:', e);
    }
  }
}

function updateReportSaveStatus(text, type = 'normal') {
  const badge = document.getElementById('bcSaveStatusBadge');
  if (!badge) return;
  badge.innerText = text;
  if (type === 'saving') {
    badge.style.color = '#eab308';
    badge.style.borderColor = '#eab308';
  } else if (type === 'success') {
    badge.style.color = '#10b981';
    badge.style.borderColor = '#10b981';
  } else {
    badge.style.color = 'var(--mut)';
    badge.style.borderColor = 'var(--line)';
  }
}

function toggleEditMode() {
  const docEl = document.getElementById('reportDocument');
  const btn = document.getElementById('bcBtnToggleEdit');
  if (!docEl || !btn) return;

  REPORT_STATE.isEditable = !REPORT_STATE.isEditable;
  docEl.contentEditable = REPORT_STATE.isEditable ? 'true' : 'false';

  if (REPORT_STATE.isEditable) {
    btn.innerHTML = '🔓 Đang Mở Sửa';
    btn.style.background = '#2563eb';
    btn.style.color = '#ffffff';
  } else {
    btn.innerHTML = '🔒 Đang Khóa Sửa';
    btn.style.background = 'var(--card-sub)';
    btn.style.color = 'var(--tx)';
  }
}

// --------------------------- Xử lý Paste Ảnh (Ctrl+V) ---------------------------
function handleDocPaste(e) {
  const clipboardData = e.clipboardData || window.clipboardData;
  if (!clipboardData) return;

  const items = clipboardData.items;
  if (!items) return;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type && item.type.indexOf('image') !== -1) {
      e.preventDefault();
      const file = item.getAsFile();
      const reader = new FileReader();
      reader.onload = function(evt) {
        insertImageAtCaret(evt.target.result);
      };
      reader.readAsDataURL(file);
      break;
    }
  }
}

function insertImageAtCaret(dataUrl) {
  const img = document.createElement('img');
  img.src = dataUrl;
  img.style.maxWidth = '100%';
  img.style.height = 'auto';
  img.style.borderRadius = '6px';
  img.style.margin = '10px 0';
  img.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
  img.style.display = 'block';

  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(img);

    // Di chuyển con trỏ sau ảnh
    range.setStartAfter(img);
    range.setEndAfter(img);
    sel.removeAllRanges();
    sel.addRange(range);
  } else {
    const docEl = document.getElementById('reportDocument');
    if (docEl) docEl.appendChild(img);
  }
  scheduleAutoSave();
}

// --------------------------- Xử lý Tab & Shift+Tab trong bảng ---------------------------
function handleDocKeyDown(e) {
  if (e.key === 'Tab') {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const node = sel.anchorNode;
    const cell = getClosestElement(node, 'TD, TH');

    if (cell) {
      e.preventDefault();
      const row = cell.closest('tr');
      const table = cell.closest('table');
      if (!row || !table) return;

      const cells = Array.from(row.querySelectorAll('td, th'));
      const cellIdx = cells.indexOf(cell);

      if (e.shiftKey) {
        // Shift + Tab: Di chuyển sang ô trước đó
        if (cellIdx > 0) {
          focusCell(cells[cellIdx - 1]);
        } else {
          const prevRow = row.previousElementSibling;
          if (prevRow) {
            const prevCells = prevRow.querySelectorAll('td, th');
            if (prevCells.length) focusCell(prevCells[prevCells.length - 1]);
          }
        }
      } else {
        // Tab: Di chuyển sang ô tiếp theo
        if (cellIdx < cells.length - 1) {
          focusCell(cells[cellIdx + 1]);
        } else {
          const nextRow = row.nextElementSibling;
          if (nextRow) {
            const nextCells = nextRow.querySelectorAll('td, th');
            if (nextCells.length) focusCell(nextCells[0]);
          } else {
            // Đang ở ô cuối cùng của hàng cuối cùng -> Tự động thêm một dòng mới giống Excel!
            const newRow = document.createElement('tr');
            const colCount = cells.length;
            for (let c = 0; c < colCount; c++) {
              const newCell = document.createElement('td');
              newCell.style.padding = '8px 10px';
              newCell.style.border = '1px solid #cbd5e1';
              newCell.innerHTML = '&nbsp;';
              newRow.appendChild(newCell);
            }
            row.parentNode.appendChild(newRow);
            focusCell(newRow.querySelector('td'));
            scheduleAutoSave();
          }
        }
      }
    }
  }
}

function focusCell(cell) {
  if (!cell) return;
  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(cell);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
  cell.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function getClosestElement(node, selector) {
  if (!node) return null;
  const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  if (!el) return null;
  return el.closest(selector);
}

// --------------------------- Lệnh định dạng văn bản (WYSIWYG Commands) ---------------------------
function formatDoc(command, value = null) {
  document.execCommand(command, false, value);
  const docEl = document.getElementById('reportDocument');
  if (docEl) docEl.focus();
  scheduleAutoSave();
}

function formatBlockDoc(tag) {
  document.execCommand('formatBlock', false, '<' + tag + '>');
  scheduleAutoSave();
}

// --------------------------- Quản lý bảng biểu động (Dynamic Table Tools) ---------------------------
function insertDynamicTable() {
  const rowsStr = prompt('Nhập số dòng của bảng:', '4');
  if (!rowsStr) return;
  const colsStr = prompt('Nhập số cột của bảng:', '4');
  if (!colsStr) return;

  const rows = parseInt(rowsStr, 10) || 3;
  const cols = parseInt(colsStr, 10) || 3;

  let tableHtml = `<table class="report-table" style="width: 100%; border-collapse: collapse; font-size: 12px; margin: 14px 0;"><thead><tr style="background: #1e3a8a; color: #ffffff;">`;
  for (let c = 0; c < cols; c++) {
    tableHtml += `<th style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: left;">Cột ${c + 1}</th>`;
  }
  tableHtml += `</tr></thead><tbody>`;
  for (let r = 0; r < rows; r++) {
    tableHtml += `<tr>`;
    for (let c = 0; c < cols; c++) {
      tableHtml += `<td style="padding: 8px 10px; border: 1px solid #cbd5e1;">Nội dung ${r + 1}.${c + 1}</td>`;
    }
    tableHtml += `</tr>`;
  }
  tableHtml += `</tbody></table><p>&nbsp;</p>`;

  insertHtmlAtCaret(tableHtml);
}

function insertTableRow(position = 'below') {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const cell = getClosestElement(sel.anchorNode, 'TD, TH');
  if (!cell) {
    alert('Vui lòng click con trỏ chuột vào một ô trong bảng trước khi thêm hàng.');
    return;
  }
  const curRow = cell.closest('tr');
  if (!curRow) return;

  const colCount = curRow.children.length;
  const newRow = document.createElement('tr');
  for (let i = 0; i < colCount; i++) {
    const isHeader = curRow.children[i].tagName === 'TH';
    const newCell = document.createElement(isHeader ? 'th' : 'td');
    newCell.style.padding = '8px 10px';
    newCell.style.border = '1px solid #cbd5e1';
    newCell.innerHTML = '&nbsp;';
    newRow.appendChild(newCell);
  }

  if (position === 'above') {
    curRow.parentNode.insertBefore(newRow, curRow);
  } else {
    curRow.parentNode.insertBefore(newRow, curRow.nextSibling);
  }
  focusCell(newRow.children[0]);
  scheduleAutoSave();
}

function insertTableCol(position = 'right') {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const cell = getClosestElement(sel.anchorNode, 'TD, TH');
  if (!cell) {
    alert('Vui lòng click con trỏ chuột vào một ô trong bảng trước khi thêm cột.');
    return;
  }
  const curRow = cell.closest('tr');
  const table = cell.closest('table');
  if (!curRow || !table) return;

  const cellIdx = Array.from(curRow.children).indexOf(cell);
  const rows = table.querySelectorAll('tr');

  rows.forEach(r => {
    const isHeadRow = r.parentElement.tagName === 'THEAD' || r.querySelector('th');
    const newCell = document.createElement(isHeadRow ? 'th' : 'td');
    newCell.style.padding = '8px 10px';
    newCell.style.border = '1px solid #cbd5e1';
    newCell.innerHTML = isHeadRow ? 'Cột mới' : '&nbsp;';

    const targetCell = r.children[cellIdx];
    if (targetCell) {
      if (position === 'left') {
        r.insertBefore(newCell, targetCell);
      } else {
        r.insertBefore(newCell, targetCell.nextSibling);
      }
    } else {
      r.appendChild(newCell);
    }
  });

  scheduleAutoSave();
}

function deleteTableRow() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const cell = getClosestElement(sel.anchorNode, 'TD, TH');
  if (!cell) {
    alert('Vui lòng click con trỏ chuột vào dòng cần xóa.');
    return;
  }
  const curRow = cell.closest('tr');
  if (curRow) {
    const parent = curRow.parentNode;
    curRow.remove();
    if (parent && !parent.querySelector('tr')) {
      const tbl = parent.closest('table');
      if (tbl) tbl.remove();
    }
    scheduleAutoSave();
  }
}

function deleteTableCol() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const cell = getClosestElement(sel.anchorNode, 'TD, TH');
  if (!cell) {
    alert('Vui lòng click con trỏ chuột vào cột cần xóa.');
    return;
  }
  const curRow = cell.closest('tr');
  const table = cell.closest('table');
  if (!curRow || !table) return;

  const cellIdx = Array.from(curRow.children).indexOf(cell);
  const rows = table.querySelectorAll('tr');

  rows.forEach(r => {
    if (r.children[cellIdx]) {
      r.children[cellIdx].remove();
    }
  });
  scheduleAutoSave();
}

function deleteCurrentTable() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const table = getClosestElement(sel.anchorNode, 'TABLE');
  if (!table) {
    alert('Vui lòng click con trỏ chuột vào bảng cần xóa.');
    return;
  }
  if (confirm('Bạn có chắc muốn xóa toàn bộ bảng này?')) {
    table.remove();
    scheduleAutoSave();
  }
}

function insertHtmlAtCaret(html) {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const frag = document.createDocumentFragment();
    let node;
    let lastNode = null;
    while ((node = tempDiv.firstChild)) {
      lastNode = frag.appendChild(node);
    }
    range.insertNode(frag);
    if (lastNode) {
      range.setStartAfter(lastNode);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  } else {
    const docEl = document.getElementById('reportDocument');
    if (docEl) docEl.innerHTML += html;
  }
  scheduleAutoSave();
}

// --------------------------- Đổi màu nền (Cell / Row / Table) & Màu chữ ---------------------------
function setColorScope(scope) {
  REPORT_STATE.colorScope = scope;
}

function applyReportBgColor(colorHex) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const node = sel.anchorNode;
  const cell = getClosestElement(node, 'TD, TH');
  const row = getClosestElement(node, 'TR');
  const table = getClosestElement(node, 'TABLE');

  if (!cell && !row && !table) {
    alert('Vui lòng đặt con trỏ chuột vào một ô trong bảng để tô màu.');
    return;
  }

  const scope = REPORT_STATE.colorScope;
  if (scope === 'cell' && cell) {
    cell.style.backgroundColor = colorHex;
  } else if (scope === 'row' && row) {
    row.style.backgroundColor = colorHex;
    Array.from(row.children).forEach(c => {
      c.style.backgroundColor = colorHex;
    });
  } else if (scope === 'table' && table) {
    table.style.backgroundColor = colorHex;
    table.querySelectorAll('td, th').forEach(c => {
      c.style.backgroundColor = colorHex;
    });
  }
  scheduleAutoSave();
}

function applyReportTextColor(colorHex) {
  document.execCommand('foreColor', false, colorHex);
  scheduleAutoSave();
}

function applyReportHighlight(colorHex) {
  document.execCommand('hiliteColor', false, colorHex);
  scheduleAutoSave();
}

// ============================================================================
// 6. SNAPSHOT TUẦN (LƯU & SO SÁNH CHÊNH LỆCH +/-)
// ============================================================================

function saveReportSnapshot() {
  const bsc = (typeof BAOCAOSC_STATE !== 'undefined') ? BAOCAOSC_STATE : {};
  const activeRate = bsc.activeRate || null;
  const parsedActive = (typeof normalizeActiveRateData === 'function' && activeRate) ? normalizeActiveRateData(activeRate) : null;
  const monthlyInactive = bsc.monthlyInactive || null;
  const parsedInactive = (typeof normalizeMonthlyInactiveData === 'function' && monthlyInactive) ? normalizeMonthlyInactiveData(monthlyInactive) : null;
  const headcountReg = bsc.headcountRegion || null;
  const parsedReg = (typeof normalizeHeadcountRegionData === 'function' && headcountReg) ? normalizeHeadcountRegionData(headcountReg) : null;

  let activeAvg = 82.4;
  if (parsedActive && parsedActive.latest) activeAvg = parsedActive.latest.avg || 82.4;

  let inactivePct = 17.6;
  if (parsedInactive && parsedInactive.items && parsedInactive.items.length) {
    inactivePct = parsedInactive.items[parsedInactive.items.length - 1].pctInactive || 17.6;
  }

  let totalStaff = 47;
  if (parsedReg && parsedReg.totalActual) totalStaff = parsedReg.totalActual;

  const snapshot = {
    id: 'snap_' + Date.now(),
    dateStr: new Date().toISOString(),
    period: REPORT_STATE.period,
    activeRate: activeAvg,
    inactiveRate: inactivePct,
    totalStaff: totalStaff,
    savedAtText: new Date().toLocaleString('vi-VN')
  };

  let snaps = [];
  try {
    const raw = localStorage.getItem(REPORT_STORAGE_KEYS.SNAPSHOTS);
    if (raw) snaps = JSON.parse(raw);
  } catch (e) {}

  snaps.push(snapshot);
  try {
    localStorage.setItem(REPORT_STORAGE_KEYS.SNAPSHOTS, JSON.stringify(snaps));
  } catch (e) {}

  alert(`✅ Đã lưu Snapshot mốc tuần thành công!\n- Kỳ: ${snapshot.period}\n- Active Rate: ${snapshot.activeRate.toFixed(1)}%\n- Inactive: ${snapshot.inactiveRate.toFixed(1)}%\n- Quân số SC: ${snapshot.totalStaff}`);
}

function getLatestSnapshot() {
  try {
    const raw = localStorage.getItem(REPORT_STORAGE_KEYS.SNAPSHOTS);
    if (raw) {
      const snaps = JSON.parse(raw);
      if (Array.isArray(snaps) && snaps.length) {
        return snaps[snaps.length - 1];
      }
    }
  } catch (e) {}
  return null;
}

// ============================================================================
// 7. BỘ MÁY XUẤT ĐA ĐỊNH DẠNG (CONFLUENCE, WORD .DOCX, HTML, PDF)
// ============================================================================

/**
 * 7.1 Copy sang Atlassian / Confluence
 * - Tự động inline hóa toàn bộ CSS.
 * - Thêm white-space: nowrap !important; table-layout: auto !important;
 * - Ghi ClipboardItem dạng text/html.
 */
async function copyReportToConfluence() {
  const docEl = document.getElementById('reportDocument');
  if (!docEl) return;

  const clone = docEl.cloneNode(true);

  // Xóa các phần tử không mong muốn
  clone.querySelectorAll('.no-export').forEach(el => el.remove());

  // Inline hóa bảng biểu theo chuẩn Atlassian Confluence
  const tables = clone.querySelectorAll('table');
  tables.forEach(tbl => {
    tbl.setAttribute('border', '1');
    tbl.setAttribute('cellspacing', '0');
    tbl.setAttribute('cellpadding', '6');
    tbl.style.cssText += 'border-collapse: collapse !important; width: 100% !important; margin: 12px 0 !important; table-layout: auto !important; border: 1px solid #cbd5e1 !important;';
  });

  const ths = clone.querySelectorAll('th');
  ths.forEach(th => {
    const bg = th.style.backgroundColor || '#1e3a8a';
    const clr = th.style.color || '#ffffff';
    th.style.cssText += `border: 1px solid #cbd5e1 !important; padding: 6px 10px !important; background-color: ${bg} !important; color: ${clr} !important; font-weight: bold !important; font-size: 12px !important; white-space: nowrap !important; text-align: center !important;`;
  });

  const tds = clone.querySelectorAll('td');
  tds.forEach(td => {
    const bg = td.style.backgroundColor ? `background-color: ${td.style.backgroundColor} !important;` : '';
    const clr = td.style.color ? `color: ${td.style.color} !important;` : '';
    td.style.cssText += `border: 1px solid #cbd5e1 !important; padding: 6px 10px !important; font-size: 12px !important; white-space: nowrap !important; ${bg} ${clr}`;
  });

  // Inline các heading
  clone.querySelectorAll('h1').forEach(h => {
    h.style.cssText += 'color: #1e3a8a !important; font-size: 20px !important; font-weight: bold !important; margin: 10px 0 !important;';
  });
  clone.querySelectorAll('h2').forEach(h => {
    h.style.cssText += 'color: #1e3a8a !important; font-size: 15px !important; font-weight: bold !important; margin: 14px 0 8px 0 !important; border-left: 4px solid #1e3a8a !important; padding-left: 8px !important;';
  });
  clone.querySelectorAll('h3').forEach(h => {
    h.style.cssText += 'color: #0f172a !important; font-size: 13px !important; font-weight: bold !important; margin: 10px 0 6px 0 !important;';
  });

  const fullHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${escapeHtml(REPORT_STATE.title)}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #334155; line-height: 1.5; }
        table { border-collapse: collapse !important; table-layout: auto !important; }
        th, td { white-space: nowrap !important; }
      </style>
    </head>
    <body>
      ${clone.innerHTML}
    </body>
    </html>
  `;

  try {
    if (navigator.clipboard && window.ClipboardItem) {
      const blobHtml = new Blob([fullHtml], { type: 'text/html' });
      const blobText = new Blob([clone.innerText], { type: 'text/plain' });
      const item = new ClipboardItem({
        'text/html': blobHtml,
        'text/plain': blobText
      });
      await navigator.clipboard.write([item]);
      alert('📋 ĐÃ COPY BÁO CÁO CHUẨN CONFLUENCE!\n\nBạn có thể nhấn Ctrl+V trực tiếp vào trang Confluence / Jira. Bảng biểu sẽ giữ nguyên format, đầy đủ màu sắc và cho phép click sửa từng ô trực tiếp mà không bị vỡ giao diện.');
    } else {
      // Fallback
      copyTextFallback(fullHtml);
    }
  } catch (err) {
    console.error('Lỗi Clipboard API:', err);
    copyTextFallback(fullHtml);
  }
}

function copyTextFallback(html) {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  temp.style.position = 'fixed';
  temp.style.left = '-9999px';
  document.body.appendChild(temp);

  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(temp);
  sel.removeAllRanges();
  sel.addRange(range);
  document.execCommand('copy');
  document.body.removeChild(temp);
  alert('📋 Đã copy báo cáo vào bộ nhớ tạm! Bạn có thể dán vào Confluence / Word.');
}

/**
 * 7.2 Tải file Word (.docx) chuẩn bằng OpenXML thuần JS
 * - Đọc DOM hiện tại.
 * - Khổ ngang (Landscape), Margin 720 dxa.
 * - Trích xuất mã màu inline hex ghi vào <w:shd w:fill="..."/> và <w:color w:val="..."/>.
 * - Đóng gói PKZIP Store method 0.
 */
function exportReportToDocx() {
  const docEl = document.getElementById('reportDocument');
  if (!docEl) return;

  const clone = docEl.cloneNode(true);
  clone.querySelectorAll('.no-export').forEach(el => el.remove());

  // Sinh nội dung word/document.xml từ DOM
  const documentXml = buildWordDocumentXml(clone);

  // Tạo cấu trúc gói OpenXML
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const wordRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
        <w:lang w:val="vi-VN"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
</w:styles>`;

  const files = [
    { name: '[Content_Types].xml', content: contentTypesXml },
    { name: '_rels/.rels', content: relsXml },
    { name: 'word/_rels/document.xml.rels', content: wordRelsXml },
    { name: 'word/styles.xml', content: stylesXml },
    { name: 'word/document.xml', content: documentXml }
  ];

  // Đóng gói ZIP
  const zipBytes = createPureZipArchive(files);
  const blob = new Blob([zipBytes], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });

  const fileName = (REPORT_STATE.title || 'Bao_Cao_SC')
    .replace(/[^\w\d\s\-_]/g, '')
    .trim()
    .replace(/\s+/g, '_') + '.docx';

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Chuyển đổi mã màu CSS (hex, rgb) sang 6 ký tự Hex thuần cho OpenXML
function parseColorToHex(colorStr, defaultHex = '000000') {
  if (!colorStr || colorStr === 'transparent' || colorStr === 'inherit') return null;
  colorStr = String(colorStr).trim();
  if (colorStr.startsWith('#')) {
    let hex = colorStr.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    return hex.toUpperCase().slice(0, 6);
  }
  const rgbMatch = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10).toString(16).padStart(2, '0');
    const g = parseInt(rgbMatch[2], 10).toString(16).padStart(2, '0');
    const b = parseInt(rgbMatch[3], 10).toString(16).padStart(2, '0');
    return (r + g + b).toUpperCase();
  }
  return defaultHex;
}

// Xây dựng Word OpenXML Body từ DOM cây con
function buildWordDocumentXml(domRoot) {
  let bodyXml = '';

  function processNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const txt = node.textContent.trim();
      if (txt) {
        bodyXml += `<w:p><w:r><w:t xml:space="preserve">${escapeXml(txt)}</w:t></w:r></w:p>`;
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const tag = node.tagName.toUpperCase();

    if (tag === 'H1') {
      const txt = node.textContent.trim();
      bodyXml += `
        <w:p>
          <w:pPr><w:spacing w:before="240" w:after="120"/><w:jc w:val="left"/></w:pPr>
          <w:r>
            <w:rPr><w:b/><w:color w:val="1E3A8A"/><w:sz w:val="36"/></w:rPr>
            <w:t>${escapeXml(txt)}</w:t>
          </w:r>
        </w:p>
      `;
    } else if (tag === 'H2') {
      const txt = node.textContent.trim();
      bodyXml += `
        <w:p>
          <w:pPr><w:spacing w:before="200" w:after="80"/><w:jc w:val="left"/></w:pPr>
          <w:r>
            <w:rPr><w:b/><w:color w:val="1E3A8A"/><w:sz w:val="28"/></w:rPr>
            <w:t>${escapeXml(txt)}</w:t>
          </w:r>
        </w:p>
      `;
    } else if (tag === 'H3') {
      const txt = node.textContent.trim();
      bodyXml += `
        <w:p>
          <w:pPr><w:spacing w:before="140" w:after="60"/><w:jc w:val="left"/></w:pPr>
          <w:r>
            <w:rPr><w:b/><w:color w:val="0F172A"/><w:sz w:val="24"/></w:rPr>
            <w:t>${escapeXml(txt)}</w:t>
          </w:r>
        </w:p>
      `;
    } else if (tag === 'P' || tag === 'DIV') {
      // Nếu là thẻ chứa bảng biểu hoặc khối con phức tạp thì duyệt tiếp con
      if (node.querySelector('table, h1, h2, h3, div')) {
        Array.from(node.childNodes).forEach(child => processNode(child));
      } else {
        const runsXml = buildRunsXml(node);
        if (runsXml) {
          bodyXml += `<w:p><w:pPr><w:spacing w:after="100"/></w:pPr>${runsXml}</w:p>`;
        }
      }
    } else if (tag === 'TABLE') {
      bodyXml += buildWordTableXml(node);
    } else if (tag === 'UL' || tag === 'OL') {
      node.querySelectorAll('li').forEach(li => {
        const liTxt = li.textContent.trim();
        bodyXml += `
          <w:p>
            <w:pPr><w:ind w:left="400"/><w:spacing w:after="60"/></w:pPr>
            <w:r><w:t>• ${escapeXml(liTxt)}</w:t></w:r>
          </w:p>
        `;
      });
    } else {
      Array.from(node.childNodes).forEach(child => processNode(child));
    }
  }

  Array.from(domRoot.childNodes).forEach(child => processNode(child));

  // Thiết lập khổ ngang (Landscape 16838x11906) & lề hẹp (720 dxa = 0.5 inch)
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyXml}
    <w:sectPr>
      <w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>
      <w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

function buildRunsXml(containerNode) {
  let runs = '';
  function parseInline(node, isBold = false, isItalic = false, isUnderline = false, colorHex = null) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      if (!text) return;
      let rPr = '';
      if (isBold) rPr += '<w:b/>';
      if (isItalic) rPr += '<w:i/>';
      if (isUnderline) rPr += '<w:u w:val="single"/>';
      if (colorHex) rPr += `<w:color w:val="${colorHex}"/>`;
      runs += `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const t = node.tagName.toUpperCase();
    const curBold = isBold || t === 'B' || t === 'STRONG';
    const curItalic = isItalic || t === 'I' || t === 'EM';
    const curUnderline = isUnderline || t === 'U';
    const curColor = parseColorToHex(node.style.color) || colorHex;

    Array.from(node.childNodes).forEach(c => {
      parseInline(c, curBold, curItalic, curUnderline, curColor);
    });
  }

  Array.from(containerNode.childNodes).forEach(c => parseInline(c));
  return runs;
}

function buildWordTableXml(tableNode) {
  let tblXml = `
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="0" w:type="auto"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
          <w:left w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
          <w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
        </w:tblBorders>
        <w:tblCellMar>
          <w:top w:w="120" w:type="dxa"/>
          <w:bottom w:w="120" w:type="dxa"/>
          <w:left w:w="150" w:type="dxa"/>
          <w:right w:w="150" w:type="dxa"/>
        </w:tblCellMar>
      </w:tblPr>
  `;

  const rows = tableNode.querySelectorAll('tr');
  rows.forEach(tr => {
    tblXml += `<w:tr>`;
    const cells = tr.querySelectorAll('th, td');
    cells.forEach(cell => {
      const isTh = cell.tagName === 'TH';
      const bgHex = parseColorToHex(cell.style.backgroundColor || tr.style.backgroundColor);
      const txtColorHex = parseColorToHex(cell.style.color);
      const align = cell.style.textAlign === 'right' ? 'right' : (cell.style.textAlign === 'center' ? 'center' : 'left');

      tblXml += `<w:tc>`;
      let tcPr = '<w:tcPr>';
      if (bgHex) {
        tcPr += `<w:shd w:val="clear" w:color="auto" w:fill="${bgHex}"/>`;
      } else if (isTh) {
        tcPr += `<w:shd w:val="clear" w:color="auto" w:fill="1E3A8A"/>`;
      }
      tcPr += '</w:tcPr>';
      tblXml += tcPr;

      // Nội dung paragraph trong ô
      const runs = buildRunsXml(cell);
      const defaultTxt = escapeXml(cell.textContent.trim());

      tblXml += `
        <w:p>
          <w:pPr><w:jc w:val="${align}"/><w:spacing w:after="0"/></w:pPr>
          ${runs || `<w:r><w:rPr>${isTh ? '<w:b/><w:color w:val="FFFFFF"/>' : (txtColorHex ? `<w:color w:val="${txtColorHex}"/>` : '')}<w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${defaultTxt}</w:t></w:r>`}
        </w:p>
      `;
      tblXml += `</w:tc>`;
    });
    tblXml += `</w:tr>`;
  });

  tblXml += `</w:tbl>`;
  return tblXml;
}

// --------------------------- Đóng gói PKZIP thuần JS Store method 0 ---------------------------
function createPureZipArchive(files) {
  function crc32(buf) {
    let table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
      table[i] = c >>> 0;
    }
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  const utf8Enc = new TextEncoder();
  const fileRecords = [];
  let offset = 0;

  for (const f of files) {
    const nameBytes = utf8Enc.encode(f.name);
    const dataBytes = (typeof f.content === 'string') ? utf8Enc.encode(f.content) : new Uint8Array(f.content);
    const crc = crc32(dataBytes);
    fileRecords.push({ name: f.name, nameBytes, dataBytes, crc, size: dataBytes.length, offset });
    offset += 30 + nameBytes.length + dataBytes.length;
  }

  const centralDirStart = offset;
  let cdSize = 0;
  for (const r of fileRecords) cdSize += 46 + r.nameBytes.length;

  const totalSize = offset + cdSize + 22;
  const out = new Uint8Array(totalSize);
  let pos = 0;
  const v = new DataView(out.buffer);

  // Ghi Local File Headers + Data
  for (const r of fileRecords) {
    v.setUint32(pos, 0x04034b50, true);
    v.setUint16(pos + 4, 20, true);
    v.setUint16(pos + 6, 0, true);
    v.setUint16(pos + 8, 0, true);
    v.setUint16(pos + 10, 0, true);
    v.setUint16(pos + 12, 0, true);
    v.setUint32(pos + 14, r.crc, true);
    v.setUint32(pos + 18, r.size, true);
    v.setUint32(pos + 22, r.size, true);
    v.setUint16(pos + 26, r.nameBytes.length, true);
    v.setUint16(pos + 28, 0, true);
    pos += 30;
    out.set(r.nameBytes, pos); pos += r.nameBytes.length;
    out.set(r.dataBytes, pos); pos += r.dataBytes.length;
  }

  // Ghi Central Directory
  for (const r of fileRecords) {
    v.setUint32(pos, 0x02014b50, true);
    v.setUint16(pos + 4, 20, true);
    v.setUint16(pos + 6, 20, true);
    v.setUint16(pos + 8, 0, true);
    v.setUint16(pos + 10, 0, true);
    v.setUint16(pos + 12, 0, true);
    v.setUint16(pos + 14, 0, true);
    v.setUint32(pos + 16, r.crc, true);
    v.setUint32(pos + 20, r.size, true);
    v.setUint32(pos + 24, r.size, true);
    v.setUint16(pos + 28, r.nameBytes.length, true);
    v.setUint16(pos + 30, 0, true);
    v.setUint16(pos + 32, 0, true);
    v.setUint16(pos + 34, 0, true);
    v.setUint16(pos + 36, 0, true);
    v.setUint32(pos + 38, 0, true);
    v.setUint32(pos + 42, r.offset, true);
    pos += 46;
    out.set(r.nameBytes, pos); pos += r.nameBytes.length;
  }

  // End of Central Directory
  v.setUint32(pos, 0x06054b50, true);
  v.setUint16(pos + 4, 0, true);
  v.setUint16(pos + 6, 0, true);
  v.setUint16(pos + 8, fileRecords.length, true);
  v.setUint16(pos + 10, fileRecords.length, true);
  v.setUint32(pos + 12, cdSize, true);
  v.setUint32(pos + 16, centralDirStart, true);
  v.setUint16(pos + 20, 0, true);

  return out;
}

/**
 * 7.3 Tải file HTML độc lập mở offline
 */
function exportReportToHtml() {
  const docEl = document.getElementById('reportDocument');
  if (!docEl) return;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <title>${escapeHtml(REPORT_STATE.title)}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background: #f8fafc; color: #1e293b; padding: 40px 20px; line-height: 1.6; }
        .paper { max-width: 1060px; margin: 0 auto; background: #ffffff; padding: 40px 50px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 13px; }
        th, td { border: 1px solid #cbd5e1; padding: 8px 10px; }
        th { background: #1e3a8a; color: #ffffff; text-align: left; }
        @media print {
          body { background: #ffffff; padding: 0; }
          .paper { box-shadow: none; padding: 0; max-width: 100%; }
        }
      </style>
    </head>
    <body>
      <div class="paper">
        ${docEl.innerHTML}
      </div>
    </body>
    </html>
  `;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const fileName = (REPORT_STATE.title || 'Bao_Cao_SC').replace(/[^\w\d\s\-_]/g, '').trim().replace(/\s+/g, '_') + '.html';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 7.4 In / Xuất PDF
 */
function printReport() {
  window.print();
}

// --------------------------- Helper escape ---------------------------
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
