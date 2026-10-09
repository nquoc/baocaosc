@echo off
chcp 65001 >nul
echo ===================================================
echo     DONG BO DU LIEU GOOGLE APPS SCRIPT API
echo ===================================================
echo Dang goi API Google Apps Script de cap nhat snapshot moi nhat...
python "%~dp0update_snapshot.py"
if %ERRORLEVEL% EQU 0 (
    echo.
    echo [THANH CONG] Da cap nhat snapshot.js thanh cong!
) else (
    echo.
    echo [LOI] Co loi khi goi API. Vui long kiem tra ket noi mang.
)
echo.
pause
