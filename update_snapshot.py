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

SERVICE_ACCOUNT_INFO = {
  "type": "service_account",
  "project_id": "confident-slice-495215-s4",
  "private_key_id": "a91850800e57eb6767cfeed42a58707704e878ea",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDQ6aB5FBai/aNX\n9Qs5YbIO6RSZth/o6aCAzn+MN+RTiCaM5mtx/d+vp8Hta30YOiB8NmeR1APlCO90\nhAEUvSeWRltqxNIzho9QZYJKCOedr+kezYMiwMguffwbFs3V1BOUION33C4peuKO\nVqDnVoa03QwsiKlB6csLLvcbbm6w1T/I9UxHINC5x8AFJ7AjEMPKV4sMXcCY10QS\nPEMHsM5G8wL7lq6KTPjrn7/8NAQmW2aRo0wCKEVEol99Sa6Q18hShPqWrWMloHVs\nQT50FOTQ/h7VGDqhFHp9w1Yes/E5OV0HfBHB2dYqBE5KWASBKk41lNjx2gS3uQgA\n7p3F7QJpAgMBAAECggEAGUoMv1dxkY+5XiCHWC4FwVURBbX0qSvd3nXQ3hsWeE+p\nFgGfJFSOh0ucF8bdJOmFbO/ji/VBtvAk14KSxG1M7V2tO5ChnvPlJZ7yHY70JcQp\niM1pOFPkr68XzXouVtoGODZeftAQJPyPkBo3vmVcp2iCTKJK9fQMnJkV9/O/cceY\nshT0kGDhbIF6LArPNvq2knEwb58BgD7k50F6bcHeDumop6wcO1UhA37OBstKrTvY\nexRdHxCnwcsbAxtdyHGKhyxKeiA0pO2EvHLk3Xhl4oAXMnRfgI9/HNYT5XjzySO5\n+6U+XARoYFrPhWp4it6gkPgm72yIG52n/DiwpHb6EQKBgQDzSxXLFi/US33nZbih\nbmWYfvXqyP4ABJx2IM/AT+6bvsEdhMPsnFKg3DWN9M2fG05sfraE+EmrrTmVt332\nMj710+px0agXj1TJjAFL2CVav/CmYjvFZWH9lq/+w0gULujvLmBfSuyghvB1RdNb\nZyTvbysMwUZH7SRPMEmXyLP8WQKBgQDb0twqBs3gQHQzg991EalQ6B9SXU/ZEBi9\ncNpX6e5SoV+nv2EIk2ZnpFpe9b4kdNrpvYO7c8yC0cablMaCILxDJl/pytPDGR6y\nEY9vhZGqilG/slPVYEH7PHHFsLyYdEOfXVN5Nh5KJ88XUTaTWX8FeezfTXBC0JUd\nLLvj42E0kQKBgQDMfCBuGFDNA0JoOePrsukrOhKhapuqEjYbR0q2Hbi0KKkRkWRH\nO8BrOYq9rLMidoX8xKfNrQ3mgGr0/kudoO+wGJRlY8z/OFYQLF9uitYip06x2cDZ\nEXRB+uQjoai0ZhUb6wPPNB8ccS4rsyuJGHE/2VT6nHvgul2ZPUGtlGBKyQKBgFXE\nRYZYNUdDnpLi5vKkO22Hw4C9S4QjVaPEPkyCxyuSLuIiN1fDOvdBFslqFA/hT/BW\nsukWWzrHYjgdqf3ni8yfUljDfC/owyMy2sXmVVk2soKarz7XWacOhE1fkZXh9uhc\n306xoMvKEHDGjQacqoSWd6cAbcaD30oMxBo8AxchAoGAAYmAbwBC+biiJtVb8DqG\nJ1MYRX9QRd8rePDUdf57NHHAHTl0HnHv0xaH1y4IBUkhpIeL0ADHwSm41PIeqP1W\nSbfAbY7d8povK1L/nEubRA24eTLs9VxMvVwY14xd/Ghg3bdxrdII32vjo14EGc5B\ne8DF5V/VQsbYewYXkYfw8oU=\n-----END PRIVATE KEY-----\n",
  "client_email": "bot-sheet@confident-slice-495215-s4.iam.gserviceaccount.com",
  "token_uri": "https://oauth2.googleapis.com/token"
}

SPREADSHEET_ID = "1Wghthkrt0A8QQ08gDVSnQO55ix8CGCZHt87qhRcpKEY"


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
        creds = service_account.Credentials.from_service_account_info(
            SERVICE_ACCOUNT_INFO,
            scopes=['https://www.googleapis.com/auth/spreadsheets.readonly']
        )
        service = build('sheets', 'v4', credentials=creds)
        ranges = [
            "'Các tiệp triển khai'!A1:B50",
            "'Các tiệp triển khai'!D1:H60",
            "'Các tiệp triển khai'!J1:N60"
        ]
        res = service.spreadsheets().values().batchGet(
            spreadsheetId=SPREADSHEET_ID,
            ranges=ranges
        ).execute()
        
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
