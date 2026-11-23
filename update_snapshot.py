# -*- coding: utf-8 -*-
"""
Cap nhat snapshot.js va js/snapshot_tiep_trien_khai.js tu API Google Apps Script & Google Sheets Service Account.
Chay:  python update_snapshot.py
"""
import json
import os
import sys
import urllib.request
from datetime import datetime

API = ('https://script.google.com/macros/s/AKfycbwfHAYA6-39-yn_HDHHvbYxkBu_HXP29j7lG3vK3XRN6txlJ36kH0EsBCILeqXH2Z1kBw/exec'
       '?sheet=baocaotong')

BOT_API_URL = (
    'https://script.google.com/macros/s/AKfycbwHmR0xSG4uZrBdyPrv-lypX5qjP1bOC2Ca1_8vY1oRfIAe_LeFnJa7wAWrGzCmPrU/exec'
    '?apiKey=my_secret_token_2026'
)

def get_bot_config():
    req = urllib.request.urlopen(BOT_API_URL, timeout=30)
    data = json.loads(req.read().decode('utf-8'))
    cfg = data.get('credentials') or data.get('data') or data
    if isinstance(cfg, dict) and 'private_key' in cfg and 'client_email' in cfg:
        cfg.setdefault('token_uri', 'https://oauth2.googleapis.com/token')
        return cfg
    raise ValueError('Khong the lay cau hinh bot tu Apps Script API: ' + str(data))

SPREADSHEET_ID = "1Wghthkrt0A8QQ08gDVSnQO55ix8CGCZHt87qhRcpKEY"
RETAIL_SPREADSHEET_ID = "12nWROazTrZvDR6NCVcCVhzfLr2lmrsctpavm2g_9RyQ"


def update_baocaotong(here):
    print('[1/2] Dang goi API baocaotong (co the mat 10-60 giay)...')
    raw = urllib.request.urlopen(API, timeout=180).read()
    d = json.loads(raw.decode('utf-8'))
    head = d['data'][0]
    rows = d['data']
    keep_headers = head
    sc_idx = head.index('Người xử lý')
    co_idx = head.index('Coacher')
    
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


def update_tiep_trien_khai(here):
    print('[2/2] Dang dong bo sheet "Cac tiep trien khai" qua Google Service Account...')
    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build
        bot_cfg = get_bot_config()
        creds = service_account.Credentials.from_service_account_info(
            bot_cfg,
            scopes=['https://www.googleapis.com/auth/spreadsheets.readonly']
        )
        service = build('sheets', 'v4', credentials=creds)
        ranges = [
            "'Các tiệp triển khai'!A1:B50",
            "'Các tiệp triển khai'!D1:H60",
            "'Các tiệp triển khai'!J1:P60",
            "'Các tiệp triển khai'!Q1:T20",
            "'Data tồn'!A1:K15",
            "'Khách ký mới'!A1:E6",
            "'Các tiệp triển khai'!V1:X20"
        ]
        res = service.spreadsheets().values().batchGet(
            spreadsheetId=SPREADSHEET_ID,
            ranges=ranges
        ).execute()

        # Lay truc tiep Nhom Retail Lon HDDT tu sheet Report rieng (gid 1856000949)
        try:
            retail_res = service.spreadsheets().values().get(
                spreadsheetId=RETAIL_SPREADSHEET_ID,
                range="'Report'!A1:G40"
            ).execute()
            if retail_res and isinstance(retail_res.get('values'), list) and len(retail_res['values']) >= 5:
                res['retailSpreadsheetId'] = RETAIL_SPREADSHEET_ID
                res['valueRanges'][2] = {
                    'range': "'Report'!A1:G40",
                    'majorDimension': 'ROWS',
                    'values': retail_res['values']
                }
        except Exception as retail_err:
            print('Canh bao: khong doc duoc sheet Report Retail rieng, dung du phong J:P:', retail_err)

        res['updatedAt'] = datetime.now().isoformat()
        
        target_file = os.path.join(here, 'js', 'snapshot_tiep_trien_khai.js')
        with open(target_file, 'w', encoding='utf-8') as f:
            f.write('window.SNAPSHOT_TIEP_TRIEN_KHAI = ' + json.dumps(res, ensure_ascii=False) + ';\n')
        print('Da ghi js/snapshot_tiep_trien_khai.js thanh cong voi 3 tiep trien khai!')
    except Exception as e:
        print('Loi khi dong bo tiep trien khai:', e)


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    update_tiep_trien_khai(here)
    update_baocaotong(here)


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print('Loi:', e)
        sys.exit(1)
