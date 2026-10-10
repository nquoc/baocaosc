# TÀI LIỆU TOÀN DIỆN BÁO CÁO TỔNG HỢP SC (TEAM COACHER DASHBOARD)

> **Dành cho Developer & Trợ lý AI**: Tài liệu này mô tả toàn bộ kiến trúc, logic nghiệp vụ, cấu trúc dữ liệu, cách tính công, các hàm cốt lõi và hướng dẫn mở rộng tính năng cho dự án **Báo cáo tổng hợp SC**.

---

## 1. TỔNG QUAN DỰ ÁN

* **Mục tiêu**: Hệ thống Dashboard phân tích, theo dõi và so sánh hiệu suất hỗ trợ khách hàng của đội ngũ **Customer Success (SC)** trực thuộc các **Team Coacher**.
* **Công nghệ**: Single Page Application (SPA) viết bằng **HTML5 / CSS3 / Vanilla JavaScript** thuần, thư viện đồ họa **Chart.js (v4.4.1 UMD offline)**.
* **Môi trường chạy**: Chạy trực tiếp trên trình duyệt bằng cách mở file `index.html` hoặc click `Mo_Dashboard.bat`. Không phụ thuộc vào NodeJS server hay Python backend khi xem.
* **Cơ chế Smart Cache với IndexedDB (Mở tức thì < 0.05s & Tiết kiệm 11MB băng thông/lần F5)**:
  * **Lưu trữ IndexedDB (`TeamCoacherDB`)**: Trình duyệt lưu toàn bộ phản hồi API JSON (~11.3 MB, hơn 11.400 records) vào IndexedDB của trình duyệt. Không bị giới hạn 5MB như `localStorage`.
  * **Bộ đệm thông minh (TTL 20 phút)**: Khi mở dashboard hoặc ấn F5:
    * Nếu trong vòng 20 phút: Dữ liệu tải tức thì từ IndexedDB trong **< 0.05s**, hiển thị badge xanh lơ `Bộ nhớ đệm (X phút trước)` và hoàn toàn **không tốn băng thông gọi mạng**.
    * Nếu quá 20 phút: Hiển thị ngay bộ nhớ đệm cũ để người dùng không phải chờ màn hình trắng, đồng thời tự động cập nhật ngầm phiên bản mới từ Google Sheets.
    * Khi cần lấy số liệu mới nhất ngay lập tức: Bấm nút `⟳ Tải lại API` trên thanh tiêu đề để tải trực tiếp từ Google Sheets và ghi đè bộ nhớ đệm.
  * **Dự phòng Offline (`snapshot.js`)**: Lần đầu tiên truy cập nếu chưa có bộ nhớ đệm hoặc khi mất mạng, file snapshot tĩnh sẽ lập tức hiển thị.

---

## 2. CẤU TRÚC THƯ MỤC DỰ ÁN

Thư mục: `C:\Users\DELL\Downloads\TeamCoacherDashboard\`

```text
TeamCoacherDashboard/
├── css/
│   └── style.css           # Toàn bộ giao diện Dark Mode, Responsive, Modals, Bảng Excel & Bảng KPI
├── js/
│   ├── config.js           # API endpoints, cấu hình IndexedDB, hằng số và trạng thái toàn cục
│   ├── utils.js            # Hàm tiện ích DOM, định dạng số, ngày giờ (GMT+7), IndexedDB, Toast
│   ├── tab_overview.js     # Logic Tab 1: Báo Cáo Hiệu Suất & Team Coacher (Bảng, Charts, Export)
│   ├── tab_pivot.js        # Logic Tab 2: Chi tiết ATC/ngày (Ma trận Pivot, Modals chi tiết, Export)
│   ├── tab_muctieu.js      # Logic Tab 3: Mục Tiêu & Tiến Độ Tháng (Bảng Offline/Online kiểu Excel, Export)
│   ├── tab_kpi.js          # Logic Tab 4: KPI Team Offline (Công thức 70/30, xếp hạng, lọc Coacher, Export)
│   ├── tab_phancung.js     # Logic Tab 5: DS Phần Cứng (KPI & Quý, Doanh số Sale/Kênh, Charts, Export)
│   ├── tab_baocaosc.js     # Logic Tab 6: BÁO CÁO SC (Mục 1: Active Rate 2026, MoM Delta xanh/đỏ, Charts, Export)
│   └── app.js              # Điều hướng tab, sự kiện bộ lọc, khởi tạo luồng dữ liệu & Smart Cache
├── index.html              # Bộ khung HTML tinh gọn (~225 dòng) liên kết CSS và các module JS
├── snapshot.js             # Bộ nhớ đệm dữ liệu tĩnh (~10.289 records, dùng offline/khởi động nhanh)
├── chart.umd.min.js        # Thư viện Chart.js chạy offline
├── update_snapshot.py      # Script Python kéo data từ API và làm mới file snapshot.js
├── Mo_Dashboard.bat        # Phím tắt mở nhanh index.html trên Windows
├── Cap_Nhat_Du_Lieu.bat    # Phím tắt chạy update_snapshot.py trên Windows
└── README.md               # Toàn bộ tài liệu kỹ thuật & nghiệp vụ hệ thống (file này)
```

---

## 3. NGUỒN DỮ LIỆU & API

* **Google Apps Script API Endpoint**:
  ```text
  https://script.google.com/macros/s/AKfycbwfHAYA6-39-yn_HDHHvbYxkBu_HXP29j7lG3vK3XRN6txlJ36kH0EsBCILeqXH2Z1kBw/exec?sheet=baocaotong
  ```
* **Cấu trúc phản hồi JSON**:
  ```json
  {
    "status": "success",
    "data": [
      ["Retailer ID", "Thời gian checkin", "Thời gian checkout", "Người xử lý", "Coacher", "số KH tư vấn", "Addon", ...],
      [501194999, "2026-09-30T10:39:00.000Z", "2026-09-30T11:20:00.000Z", "8458 - Đặng Duy Khương...", "Nguyễn Ái Quốc", "1", 0, ...],
      ...
    ]
  }
  ```
* **24 trường dữ liệu đầy đủ của mỗi record**:
  1. `Retailer ID` (Mã gian hàng)
  2. `Thời gian tạo`
  3. `Thời gian chỉnh sửa`
  4. `Địa điểm thực tế cửa hàng`
  5. `Thời gian checkin`
  6. `Thời gian checkout`
  7. `Mô tả` (Nội dung chi tiết quá trình hỗ trợ)
  8. `Công việc hỗ trợ KH`
  9. `Nguồn data` (T15, OI model, Large Fnb, Khác...)
  10. `Thời lượng hỗ trợ (phút)`
  11. `Người tạo`
  12. `Tỉnh/Thành phố`
  13. `Xã/Phường/Thị trấn`
  14. `Product` (Retail, FnB, Booking...)
  15. `Ngày dự kiến làm`
  16. `Gói hợp đồng` (Chuyên nghiệp, Hỗ trợ, Cao cấp...)
  17. `Loại công việc`
  18. `Người xử lý` (Mã nhân sự - Tên - Bộ phận)
  19. `Tình trạng xử lý` (Đã làm, Hủy...)
  20. `Tính năng`
  21. `SLA`
  22. `Thực trạng khi đến` (Mở cửa / Đóng cửa)
  23. `Tình trạng liên hệ`
  24. `Coacher`

---

## 4. QUY TẮC NGHIỆP VỤ CỐT LÕI (CORE BUSINESS RULES)

### 4.1. Quy tắc tính Ngày công (0.5 công hay 1 công)
Theo yêu cầu quản lý của Manager:
* **Buổi sáng**: Có record checkin **trước 12:30**.
* **Buổi chiều**: Có record checkin **từ 13:00 trở đi** *(Khoảng thời gian từ 12:30 đến 13:00 là giờ nghỉ trưa, làm lố không tính sang buổi chiều)*.
* **Cách xếp loại ngày công (`c`)**:
  * **1 công**:
    * **Trường hợp A**: Có checkin sáng (< 12:30) VÀ có checkin chiều (≥ 13:00).
    * **Trường hợp C**: Nhân sự có 1 ca hỗ trợ đặc biệt kéo dài liên tục từ sáng sang chiều (checkin < 12:30 và checkout cuối cùng từ **13:30 trở đi** do hỗ trợ ca khó).
  * **0.5 công**:
    * **Trường hợp B**: Sáng làm lố vào giờ nghỉ trưa (checkin 12:30–13:00, không có ca chiều).
    * **Trường hợp D**: Chỉ làm sáng, checkout qua 12:30 nhưng trước 13:30.
    * **Trường hợp E**: Chỉ có ca làm việc buổi sáng.
    * **Trường hợp F**: Chỉ có ca làm việc buổi chiều.
* **Record Hủy**: Bị loại bỏ khỏi báo cáo.

### 4.2. Xử lý Múi giờ (UTC vs GMT+7) - BÀI HỌC THEN CHỐT
> ⚠️ **ĐẶC BIỆT LƯU Ý KHI CODE TIẾP**:
* Khi Google Apps Script xuất các ô Date của Google Sheet sang JSON, hàm `.toJSON()` tự động chuyển ngày giờ sang chuẩn quốc tế **UTC** (chuỗi kết thúc bằng đuôi `.000Z`, ví dụ `2026-09-30T10:39:00.000Z`).
* Giờ này bị **chậm 7 tiếng** so với giờ thực tế ở Việt Nam (`10:39 UTC` thực tế là `17:39 chiều Việt Nam`).
* Do đó, trong hàm `parseTime(iso)`:
  * Nếu chuỗi kết thúc bằng `'Z'` hoặc chứa `'+00'`: BẮT BUỘC phải quy đổi cộng thêm 7 tiếng (`ms + 7 * 3600 * 1000`) để trả về giờ thực tế tại Việt Nam.
  * Nếu chuỗi không có đuôi `Z` (giờ định dạng cục bộ của Excel): Lấy giờ trực tiếp, không cộng thêm 7 tiếng.
* **Hậu quả nếu làm sai**: Nếu không cộng 7 tiếng cho chuỗi UTC, các ca chiều (13h-18h) sẽ biến thành ca sáng (6h-11h), khiến hệ thống tưởng nhân sự chỉ làm buổi sáng và chấm 0.5 công cho toàn bộ nhân sự (làm sai lệch gấp đôi toàn bộ chỉ số ATC/công và Giờ/công!).

### 4.3. Các chỉ số hiệu suất chính
* **1 ATC**: 1 record hỗ trợ khách hàng thành công.
* **Chỉ số Impact (Tư vấn)**: Lấy từ cột `số KH tư vấn` (giá trị `1` = có Impact, `0` = không có Impact).
* **Chỉ số Addon**: Lấy từ cột `Addon` (số lượng tính năng/dịch vụ bán thêm).
* **Thời gian làm việc thực tế (`w`)**:
  * Tính bằng khoảng cách từ `Checkin` đến `Checkout` của các record trong ngày.
  * Nếu các record bị trùng thời gian nhau: Hệ thống tự động gộp (merge intervals) để không tính chồng thời gian.
  * Ca lỗi (checkout sang ngày hôm sau hoặc thời lượng ca > 8 tiếng = 480 phút): Vẫn ghi nhận 1 ATC nhưng loại bỏ phần thời gian bất thường.
* **Thừa kế Coacher tự động**:
  * Với các dòng dữ liệu mới (ví dụ Tháng 9) mà cột `Coacher` bị bỏ trống hoặc `#N/A`, hàm `normalize()` tự động tra cứu từ điển lịch sử `Người xử lý -> Coacher` để gán nhân sự về đúng team Coacher quản lý.

---

## 5. CẤU TRÚC GIAO DIỆN & TÍNH NĂNG ĐÃ TRIỂN KHAI

Giao diện được chia thành 2 Tab chính:

### TAB 1: BÁO CÁO HIỆU SUẤT & TEAM COACHER
1. **Bộ lọc toàn cục (Global Filters)**:
   * **Coacher Pills**: Bấm lọc 1 hoặc nhiều Coacher (`Tất cả Team`, `Đặng Quốc Tiến`, `Nguyễn Ái Quốc`, `Trần Việt Anh`).
   * **Tháng Dropdown**: Chọn nhanh tháng (VD: `Tháng 09/2026`, `Tháng 08/2026`, `Tất cả các tháng`), tự động đồng bộ sang ô input Ngày bắt đầu và Ngày kết thúc.
   * **Bộ lọc Ngày (`Từ ngày` - `Đến ngày`)**: Tùy chỉnh khoảng thời gian bất kỳ.
   * **SC Dropdown**: Lọc theo từng nhân viên cụ thể.
   * **Trạng thái**: Tất cả / Đang làm / Đã nghỉ.
   * *(Dữ liệu Coacher/Manager đã được lọc trước từ phía API Google Apps Script)*.
   * **Mục tiêu ATC/công** (mặc định 6) & **Số ngày tối thiểu** (mặc định 5).
2. **Hàng thẻ KPIs tổng quan**:
   * Số SC (kèm số team)
   * Tổng ngày công (kèm số ngày có mặt)
   * Tổng ATC
   * **ATC / công** (highlight màu xanh nếu đạt mục tiêu, đỏ nếu chưa đạt)
   * **Giờ làm / công** (thời gian thực tế tại khách hàng)
   * **Tổng Impact** (kèm tỷ lệ % tổng ATC)
   * **Addon** (kèm trung bình Addon/công)
3. **Bảng so sánh các Team Coacher**:
   * So sánh ngang giữa các team: Số SC, Tổng công, Công/SC, Tổng ATC, ATC/SC, **ATC/công**, **Giờ/công**, Phút/ATC, % Ngày đủ công, % KH có Impact, Addon/công, % Cửa hàng mở.
   * Tự động highlight màu xanh cho team cao nhất và màu đỏ cho team thấp nhất.
   * Bấm vào tên Coacher sẽ chuyển sang xem chi tiết team đó.
4. **Bảng chi tiết team của từng Coacher**:
   * Có các Tab pills để chuyển nhanh giữa các team.
   * Hiển thị bảng danh sách từng SC trong team: STT, Tên NS, Tổng công, Tổng ATC, Tổng Impact, Tổng giờ SP, TB ATC/Ngày, TB Time/Ngày.
5. **Hệ thống 4 Biểu đồ phân tích (Chart.js)**:
   * Biểu đồ cột: ATC / công theo team (so sánh với đường mục tiêu đỏ).
   * Biểu đồ Radar: So sánh đa trục năng lực các team.
   * Biểu đồ đường: Xu hướng ATC/công theo ngày.
   * Biểu đồ cột chồng: Cơ cấu nguồn data theo team (% ATC).
6. **Bảng chi tiết từng SC**:
   * Danh sách toàn bộ nhân sự kèm số liệu chi tiết, có thể click vào tiêu đề bất kỳ cột nào để sắp xếp tăng/giảm (⇅).

---

### TAB 2: CHI TIẾT ATC/NGÀY (MA TRẬN NGƯỜI XỬ LÝ × NGÀY)
1. **Thiết kế Ma trận 2 chiều**:
   * **Cột cố định bên trái (Sticky Left)**: Tên nhân sự ("Người xử lý").
   * **Hàng tiêu đề cố định phía trên (Sticky Top)**: Danh sách các ngày trong khoảng thời gian lọc (được đánh số ngày: `Ngày 1`, `Ngày 2`...).
   * **Các ô ma trận (Cells)**: Hiển thị định dạng `[Số ATC] / [Số Giờ]` (Ví dụ: `8 / 3.9`). Ô trống hiển thị dấu gạch ngang mờ `·`.
   * **2 Cột tổng kết**:
     * `Tổng cộng (Ca / Giờ)`: Tổng ATC và Tổng giờ hỗ trợ trong kỳ.
     * `TB ca / Ngày công`: Hiệu suất trung bình trên mỗi ngày công.
   * **Dòng Grand Total (Sticky Bottom)**: Tổng số ca và tổng số giờ của cả team theo từng ngày.
2. **Thanh công cụ nhanh của Pivot**:
   * Ô tìm kiếm nhanh nhân sự theo tên `🔍 Tìm tên nhân sự...`.
   * Nút chọn khoảng thời gian nhanh: `Cả tháng`, `7 ngày gần nhất`, `Tất cả ngày`.
   * Nút `⬇ Xuất CSV Chi tiết ATC/ngày` (xuất file CSV UTF-8 có BOM tương thích Excel).
3. **Tính năng Drilldown đa cấp độ (Modal)**:
   * **Level 1 (Danh sách ca)**: Click vào ô bất kỳ trên ma trận -> Mở popup danh sách các thẻ ca hỗ trợ của nhân sự trong ngày đó (Retailer ID, Quãng đường, Giờ hỗ trợ, Checkin, Checkout, Địa điểm).
   * **Level 2 (Chi tiết 24 trường)**: Bấm "Xem chi tiết ➔" trên bất kỳ thẻ nào -> Mở popup hiển thị toàn bộ 24 trường dữ liệu của ticket đó (chia thành các nhóm thông tin rõ ràng, có nút `📋 Copy JSON` và nút `⬅ Quay lại danh sách`).

---

### TAB 3: MỤC TIÊU (BÁO CÁO TEAM OFFLINE & ONLINE)
1. **Mục tiêu & Nguồn dữ liệu**:
   * Đồng bộ trực tiếp từ sheet `muctieu` trên Google Sheets thông qua 2 API:
     * **Team Offline**: `sheet=muctieu&range=A1:H12` (12 dòng: Tiêu đề + 11 chỉ tiêu).
     * **Team Online**: `sheet=muctieu&range=A14:H26` (13 dòng: Tiêu đề + 12 chỉ tiêu).
2. **Thiết kế Giao diện theo phong cách Spreadsheet (Chuẩn 100% Excel)**:
   * **Tiêu đề cột**: Màu vàng sáng (`#ffff00`), chữ đậm màu đen.
   * **Highlight màu sắc theo phân loại nghiệp vụ**:
     * **Hàng Impact & Addon**: Tô màu cam đào (`#fed7aa`), in đậm.
     * **Cột Mục tiêu tháng (Team Online)**: Tô màu hồng phấn (`#fce7f3`).
     * **Chỉ tiêu chính Team Online (Liên hệ, Chăm sóc...)**: Tô màu xanh lơ nhẹ (`#e0f2fe`).
     * **Các dịch vụ con (Kship, Payment, Lending, Nâng gói...)**: Thụt lề và canh phải thẳng hàng.
   * **Định dạng số liệu**:
     * Số lượng mục tiêu & thực đạt: Làm tròn số nguyên (VD: `5360`, `4914`).
     * Tỷ lệ đạt & Tiến độ Tuần 1-4: Định dạng phần trăm 2 chữ số thập phân (VD: `91.68%`, `100.11%`).
3. **Tính năng tiện ích**:
   * **Smart Cache với IndexedDB**: Lưu vào `TeamCoacherDB -> cache -> muctieu_data` (TTL 20 phút), mở lại tức thì < 0.05s.
   * **Nút `⟳ Tải lại Mục Tiêu`**: Bắt buộc kéo dữ liệu mới nhất từ Google Sheets bất cứ lúc nào.
   * **Xuất CSV độc lập**: Hỗ trợ 2 nút `⬇ Xuất CSV Offline` và `⬇ Xuất CSV Online` chuẩn UTF-8 BOM.

---

### TAB 4: KPI TEAM OFFLINE (`sheet=kpi`)
1. **Mục tiêu & Nguồn dữ liệu**:
   * API endpoint: `sheet=kpi` (đồng bộ toàn bộ 27 nhân sự SC Team Offline từ Google Sheets).
2. **Công thức tính KPI Tổng**:
   * $$\text{KPI Tổng (70/30)} = (70\% \times \text{\% Điểm tổng}) + (30\% \times \text{\% Điểm addon})$$
   * Tự động chuẩn hóa chuỗi phần trăm và xếp hạng từ cao xuống thấp.
   * Đánh dấu màu sắc trực quan: Xanh lá ($\ge 40\%$), Vàng ($25\% - 40\%$), Đỏ ($< 25\%$).
3. **Bộ lọc theo Coacher & Tìm kiếm**:
   * Nút bấm dạng pill lọc nhanh theo từng Coacher: `Tất cả Coacher`, `Đặng Quốc Tiến`, `Nguyễn Ái Quốc`, `Trần Việt Anh`.
   * Ô tìm kiếm nhân sự theo tên hoặc mã SC.
4. **Hàng thẻ tóm tắt KPIs**:
   * Số nhân sự SC (kèm cơ cấu theo Level).
   * TB % Điểm Tổng, TB % Điểm Addon, TB KPI Tổng (70/30).
   * Top 1 KPI Team (tôn vinh nhân sự dẫn đầu).
5. **Tiện ích**:
   * Click tiêu đề cột để sắp xếp ⇅.
   * Smart Cache IndexedDB (`kpi_offline_data`, 20 phút).
   * Nút `⟳ Tải lại KPI` và `⬇ Xuất CSV KPI` (UTF-8 BOM).

---

### TAB 5: DS PHẦN CỨNG (`sheet=phancung`)
1. **Mục tiêu & Nguồn dữ liệu**:
   * API endpoint: `sheet=phancung` (đồng bộ toàn bộ dữ liệu KPI và Doanh số Phần Cứng năm 2026 từ Google Sheets).
2. **Cấu trúc dữ liệu & Giao diện**:
   * **Hàng thẻ tóm tắt KPIs**:
     * Tổng Doanh Số Đạt Được (6,68 tỷ ₫ - 52.52% toàn năm).
     * Tổng Chỉ Tiêu KPI Năm 2026 (12,72 tỷ ₫ - TB 1,06 tỷ/tháng).
     * Top 1 Sale Xuất Sắc (Nguyễn Văn Phú: 1,91 tỷ ₫ - 28.57% tổng).
     * Kênh SC Đóng Góp (SC Toàn Quốc, MB, MN: 1,14 tỷ ₫ - 17.12%).
     * Tiến Độ Quý 3/2026 (Đạt 1,73 tỷ ₫ / KPI 3,60 tỷ ₫ - 47.99%).
   * **Hệ thống 2 Biểu đồ phân tích (Chart.js)**:
     * Biểu đồ cột kết hợp đường (Combo): Thực Đạt vs Chỉ Tiêu KPI theo 12 tháng (tooltip format VNĐ & % hoàn thành).
     * Biểu đồ tròn (Doughnut): Tỷ trọng cơ cấu doanh số theo từng nhân sự Sale và kênh SC.
   * **Bảng 1: Bảng Tổng Hợp KPI & Thực Đạt (Tháng & Quý)**:
     * Thiết kế phong cách Excel với tiêu đề vàng sáng `#ffff00`.
     * Tích hợp đồng bộ 14 cột: 12 tháng kết hợp 4 Quý (colspan 3 cho từng quý) và cột Tổng Cả Năm.
     * Highlight trực quan % đạt: Xanh lá ($\ge 80\%$), Vàng cam ($50\% - 79.9\%$), Đỏ ($< 50\%$).
   * **Bảng 2: Chi Tiết Doanh Số Theo Nhân Sự Sale & Kênh SC**:
     * Danh sách 6 nhân sự Sale & 3 kênh SC (SC Toàn Quốc, SC MB, SC MN) và dòng TỔNG.
     * Ô tìm kiếm nhanh nhân sự / kênh: `🔍 Tìm nhân sự hoặc kênh...`.
     * Click tiêu đề bất kỳ cột nào để sắp xếp tăng/giảm (STT, Tên, Tháng 1..12, Tổng doanh số, Tỷ trọng).
3. **Tiện ích & Smart Cache**:
   * Smart Cache IndexedDB (`phancung_data`, TTL 20 phút), mở lại tức thì < 0.05s.
   * Nút `⟳ Tải lại DS Phần Cứng` để đồng bộ dữ liệu mới nhất từ Google Sheets.
   * Nút `⬇ Xuất CSV Mục 1` và `⬇ Xuất CSV Mục 2 (T10)`.

---

### TAB 6: BÁO CÁO SC (`sheet=baocaotuan`)
1. **Mục tiêu & Nguồn dữ liệu**:
   * API endpoints:
     * **Mục 1**: `sheet=baocaotuan&range=A2:D14` (Active Rate năm 2026: Retail, F&B, Booking qua các tháng).
     * **Mục 2**: `sheet=baocaotuan&range=F2:I6` (Tỷ lệ chăm khách New T10: Ký mới, Inactive, SC chăm).
     * **Mục 3**: `sheet=baocaotuan&range=K2:Q19` (Tỷ lệ Impact theo 16 Tỉnh/Thành phố từ T7 đến T12, so sánh MoM từng tháng).
2. **Cấu trúc dữ liệu & Giao diện**:
   * **Bố cục chuẩn**: Khối hiển thị căn giữa 70% màn hình trang nhã (`.bsc-centered-block`).
   * **Kiểu dáng bảng**: Header màu đen, chữ in đậm sắc nét, tất cả ô số liệu căn giữa đồng bộ.
   * **Mục 1 (Active Rate 2026)**:
     * 3 thẻ KPI tóm tắt (Retail, F&B, Booking) kèm biến động tháng liền kề.
     * Bảng chi tiết 10 tháng có số liệu, chỉ báo MoM delta (▲ xanh lá / ▼ đỏ).
     * Đánh giá xu hướng và dòng TRUNG BÌNH CẢ NĂM.
   * **Mục 2 (Tỷ lệ chăm khách New T10)**:
     * 4 thẻ KPI tóm tắt, bảng chi tiết theo từng ngành hàng và dòng TỔNG TOÀN BỘ.
   * **Mục 3 (Impact Theo Tỉnh / Thành Phố)**:
     * 4 thẻ KPI tóm tắt: Toàn quốc T10, Top 1 Impact T10, Tăng trưởng tốt nhất, Giảm sâu nhất.
     * Bảng chi tiết 16 tỉnh/thành phố chuẩn 8 cột (STT, Tỉnh, T7..T12) hiển thị tỷ lệ % kèm icon trực quan so sánh với tháng trước (▲ xanh lá = Tăng, ▼ đỏ = Giảm).
     * Sắp xếp theo cột bất kỳ (STT, Tên tỉnh, các tháng T7..T12).
     * Tìm kiếm nhanh theo tên tỉnh (`🔍 Tìm tỉnh thành...`).
     * Dòng chân bảng `TOÀN QUỐC (TOTAL)` tóm tắt trung bình cả nước.
    * **Mục 4 (Quân Số Đội Ngũ SC)**:
      * API: `sheet=baocaotuan&range=U2:AA5` (Bảng 1: Quân số theo Miền & Vị trí) và `sheet=baocaotuan&range=U7:V24` (Bảng 2: Quân số theo Tỉnh thành).
      * 4 thẻ KPI tóm tắt: Tổng Quân Số Toàn Quốc (50 nhân sự), Lực Lượng Offline (30), Lực Lượng Online (13), Hỗ Trợ & Thử Việc (4 Thử việc · 4 QL · 3 Sale PC).
      * Bảng 1: Phân bổ 2 Miền (Bắc, Nam) và Toàn quốc theo từng vị trí (Online, Offline, Sale PC, QL, Tổng, Thử việc).
      * Bảng 2: Phân bổ 16 Tỉnh thành / Khu vực kèm thanh tiến độ mini và tỷ trọng % trực quan, hỗ trợ tìm kiếm và sắp xếp.
3. **Tiện ích**:
   * Smart Cache IndexedDB (`baocaosc_data`, TTL 20 phút), mở tức thì < 0.05s.
   * Hỗ trợ 4 nút xuất CSV độc lập: `⬇ Xuất CSV Mục 1`, `⬇ Xuất CSV Mục 2`, `⬇ Xuất CSV Mục 3`, `⬇ Xuất CSV Mục 4` (chuẩn UTF-8 BOM).

---

## 6. CÁC BIẾN & HÀM CỐT LÕI TRONG DỰ ÁN

### 6.1. Biến dữ liệu toàn cục
* `API`: Hằng số chứa URL của Google Apps Script API.
* `RAW_RECORDS`: Mảng chứa toàn bộ các record sau khi chuẩn hóa (mỗi phần tử có đầy đủ 24 trường và các trường tính toán `durMin`, `ciTime`, `impact`...).
* `DAYS`: Mảng các đối tượng đã gộp theo cặp `(SC, Ngày)`, đã tính sẵn ngày công (`c = 0.5` hoặc `1`), trường hợp (`cs = 'A'|'B'|'C'|'D'|'E'|'F'`), tổng thời gian làm việc (`w`).
* `COACHES`: Danh sách tên các Coacher có trong dữ liệu.
* `SCS`: Object map chứa metadata của từng SC (`name`, `ma`, `nghi`, `lead`).
* `S`: Object chứa trạng thái bộ lọc hiện tại:
  ```javascript
  const S = {
    coach: new Set(), // Tập hợp tên coacher đang chọn
    sc: 'all',        // Mã SC đang chọn
    status: 'all',    // 'all' | 'active' | 'left'
    lead: false,      // true: gồm cả leader/manager
    month: 'all',     // '2026-09' | '2026-08' | 'all' | 'custom'
    from: '',         // YYYY-MM-DD
    to: '',           // YYYY-MM-DD
    target: 6,        // Mục tiêu ATC/công
    minDays: 5,       // Số ngày có mặt tối thiểu để xếp hạng
    scSort: { k: 'atcPerCong', dir: -1 },
    page: 1
  };
  ```

### 6.2. Các hàm quan trọng
* `openDB()`, `getCachedData()`, `setCachedData(data)`: Quản lý cơ sở dữ liệu `TeamCoacherDB` trong IndexedDB của trình duyệt để lưu trữ ~11.3 MB JSON với cơ chế bất đồng bộ, không làm nghẽn main thread.
* `initData()`: Hàm khởi động chính khi mở dashboard. Kiểm tra IndexedDB xem có dữ liệu còn hạn (< 20 phút) hay không:
  * Nếu còn hạn: Gọi `setData()` ngay lập tức (< 0.05s) với nhãn `Bộ nhớ đệm (X phút trước)`. Không gọi API mạng.
  * Nếu quá hạn: Hiển thị tạm cache cũ và kích hoạt `loadLive(true)` chạy ngầm để lấy số liệu mới.
  * Nếu lần đầu mở: Hiển thị `snapshot.js` và gọi `loadLive(false)`.
* `loadLive(isSilent = false)`: Gửi HTTP request (kèm `&_t=timestamp` chống cache mạng) đến Google Apps Script API, lưu kết quả vào IndexedDB, cập nhật badge `API trực tiếp HH:mm:ss` và gọi `setData()`.
* `parseTime(iso)`: Nhận diện chuỗi thời gian, tự động chuyển đổi múi giờ UTC (`.000Z`) sang múi giờ Việt Nam (`UTC+7`), trả về `{ date, min, timeStr }`.
* `normalize(headers, data)`: Duyệt dữ liệu mảng 2 chiều thô, ánh xạ header sang index, kế thừa team Coacher, lọc dòng tiêu đề lặp, sinh ra mảng `RAW_RECORDS`.
* `buildDays(recs)`: Thuật toán gộp các ca làm theo từng ngày của mỗi nhân viên, áp dụng quy tắc tính 0.5 công hoặc 1 công, merge các khoảng thời gian bị trùng để tính tổng giờ làm việc thực tế.
* `setData(headers, data, label, cls)`: Khởi tạo lại toàn bộ danh sách ngày, tháng, coacher, cập nhật badge trạng thái và gọi `render()`.
* `render()`: Hàm điều phối chính, lọc dữ liệu theo `S`, tổng hợp số liệu KPIs, vẽ lại bảng Coacher, bảng chi tiết team, biểu đồ Chart.js, bảng chi tiết SC và tab Pivot.
* `renderPivot()`: Tính toán ma trận pivot 2 chiều, vẽ bảng ma trận với sticky header/column và gắn sự kiện click drilldown.
* `showCardListModal(sc, date, list)`: Mở modal hiển thị danh sách các ca trong ngày.
* `showRecordDetailModal(record)`: Mở modal hiển thị toàn bộ 24 trường thông tin chi tiết của 1 record.

---

## 7. HƯỚNG DẪN DÀNH CHO AI & DEVELOPER MỞ RỘNG TÍNH NĂNG MỚI

Dự án đã được phân tách module rõ ràng, không còn dồn trong 1 file monolithic:

* **Muốn đổi kiểu dáng / giao diện**: Sửa `css/style.css`.
* **Muốn thêm API endpoint, hằng số, đổi thời gian cache TTL**: Sửa `js/config.js`.
* **Muốn thêm hàm tiện ích ngày giờ, chuỗi, IndexedDB**: Sửa `js/utils.js`.
* **Muốn sửa Tab 1 (Báo cáo hiệu suất, biểu đồ, bảng team coacher)**: Sửa `js/tab_overview.js`.
* **Muốn sửa Tab 2 (Chi tiết ATC/ngày, modal xem ca, chi tiết 24 trường)**: Sửa `js/tab_pivot.js`.
* **Muốn sửa Tab 3 (Mục Tiêu Offline & Online)**: Sửa `js/tab_muctieu.js`.
* **Muốn sửa Tab 4 (KPI Team Offline, công thức 70/30, xếp hạng)**: Sửa `js/tab_kpi.js`.
* **Muốn sửa điều hướng tab, sự kiện bộ lọc toàn cục, luồng nạp dữ liệu**: Sửa `js/app.js`.

### Các nguyên tắc quan trọng cần tuân thủ:
1. **Chạy hoàn toàn trên giao thức `file:///`**:
   * **KHÔNG** sử dụng ES Modules (`<script type="module">` hay `import`/`export`) vì trình duyệt sẽ chặn CORS khi mở trực tiếp file HTML offline.
   * Tất cả file JS được nạp bằng thẻ `<script src="...">` thông thường theo đúng thứ tự phụ thuộc.
2. **Không sửa đổi logic `parseTime` làm mất múi giờ**: Bất kỳ tính toán thời gian nào liên quan đến checkin/checkout từ Google API đều phải bảo toàn việc chuyển đổi UTC (`.000Z`) về giờ Việt Nam (+7 tiếng).
3. **Thêm tab mới**:
   * Thêm button trên thanh `.tabs-nav` trong `index.html`.
   * Thêm container `div id="tenTabSection" style="display:none">` trong `index.html`.
   * Tạo file module mới `js/tab_tentab.js` và nhúng vào `index.html` trước `js/app.js`.
   * Cập nhật hàm `switchTab(tab)` trong `js/app.js` để ẩn/hiện section và kích hoạt nạp/render (tự động đồng bộ URL hash `#tab` và `localStorage`/`sessionStorage` để khi F5 luôn giữ nguyên tab hiện tại).
4. **Cập nhật dữ liệu mẫu offline**:
   * Khi thêm cột hoặc thay đổi cấu trúc dữ liệu trên Google Sheets, chạy file `update_snapshot.py` (hoặc click đúp `Cap_Nhat_Du_Lieu.bat`) để tự động đồng bộ lại mảng dữ liệu vào `snapshot.js`.

---
*Tài liệu được cập nhật hoàn chỉnh sau khi module hóa toàn bộ dự án (08/10/2026).*
