@echo off
chcp 65001 >/dev/null
echo [%date% %time%] GOLD DATA LAB evening run starting... >> C:\factory\logs\daily.log

cd /d C:\factory

REM Ensure MT5 is running
start "" "C:\Program Files\MetaTrader 5\terminal64.exe"
timeout /t 10 /nobreak >/dev/null

REM Run gold_data_lab only (evening update)
python engine/factory.py --channel gold_data_lab --lang en >> C:\factory\logs\daily.log 2>&1

echo [%date% %time%] GOLD DATA LAB evening done. >> C:\factory\logs\daily.log
