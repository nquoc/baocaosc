# -*- coding: utf-8 -*-
"""
Cap nhat snapshot.js tu API Google Apps Script (chay khi muon lam moi du lieu offline).
Web (index.html) van tu goi API truc tiep khi mo; snapshot.js chi la du phong/hien thi tuc thi.
Chay:  python update_snapshot.py
"""
import json
import os
import sys
import urllib.request
from datetime import datetime

API = ('https://script.google.com/macros/s/AKfycbwfHAYA6-39-yn_HDHHvbYxkBu_HXP29j7lG3vK3XRN6txlJ36kH0EsBCILeqXH2Z1kBw/exec'
       '?sheet=baocaotong')
# Cac cot dashboard can (bo cot Mo ta... de file nhe)
KEEP = ['Retailer ID', 'Product', 'Nguồn data', 'Gói hợp đồng', 'Thời gian checkin', 'Thời gian checkout',
        'Thực trạng khi đến', 'Công việc hỗ trợ KH', 'Người xử lý', 'Tình trạng xử lý', 'Tình trạng liên hệ',
        'số KH tư vấn', 'Addon', 'Coacher', 'Thời lượng hỗ trợ (phút)']


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    print('Dang goi API (co the mat 10-60 giay)...')
    raw = urllib.request.urlopen(API, timeout=180).read()
    d = json.loads(raw.decode('utf-8'))
    head = d['data'][0]
    rows = d['data']
    # Giu day du tat ca cac cot de phuc vu popup xem chi tiet toan bo record
    keep_headers = head
    sc_idx = head.index('Người xử lý')
    co_idx = head.index('Coacher')
    
    # Xây dựng bảng tra cứu SC -> Coacher từ các dòng có sẵn
    sc_to_coach = {
        '8464 - Lê Minh - Customer Success - VTU': 'Nguyễn Ái Quốc',
        '8464 - Lê Minh - Customer Success - VTU - Đã nghỉ': 'Nguyễn Ái Quốc',
    }
    for r in rows[1:]:
        if len(r) > sc_idx and len(r) > co_idx:
            sc = str(r[sc_idx] or '').strip()
            co = str(r[co_idx] or '').strip()
            if sc and co and co not in ('', '#N/A'):
                sc_to_coach[sc] = co

    out = []
    for r in rows[1:]:
        if len(r) > sc_idx and r[sc_idx]:
            sc = str(r[sc_idx] or '').strip()
            co = str(r[co_idx] or '').strip() if len(r) > co_idx else ''
            if not co or co in ('', '#N/A'):
                co = sc_to_coach.get(sc, 'Khác / Chưa phân team')
                if len(r) > co_idx:
                    r[co_idx] = co
                else:
                    while len(r) < co_idx:
                        r.append('')
                    r.append(co)
            out.append(r)
    snap = {'fetchedAt': datetime.now().strftime('%Y-%m-%d %H:%M'), 'headers': keep_headers, 'data': out}
    with open(os.path.join(here, 'snapshot.js'), 'w', encoding='utf-8') as f:
        f.write('window.SNAPSHOT=' + json.dumps(snap, ensure_ascii=False, separators=(',', ':')) + ';')
    print('Da ghi snapshot.js:', len(out), 'record (full', len(keep_headers), 'cot)')


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print('Loi:', e)
        sys.exit(1)
