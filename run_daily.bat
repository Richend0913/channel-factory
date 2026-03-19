@echo off
chcp 65001 >/dev/null
echo [%date% %time%] CHANNEL FACTORY starting... >> C:\factory\logs\daily.log

cd /d C:\factory

REM Ensure MT5 is running
start "" "C:\Program Files\MetaTrader 5\terminal64.exe"
timeout /t 10 /nobreak >/dev/null

REM Run factory for 3 channels
python engine/factory.py --channel agent_zero --lang en >> C:\factory\logs\daily.log 2>&1
python engine/factory.py --channel gold_data_lab --lang en >> C:\factory\logs\daily.log 2>&1
python engine/factory.py --channel myth_breaker --lang en >> C:\factory\logs\daily.log 2>&1

echo [%date% %time%] CHANNEL FACTORY done. >> C:\factory\logs\daily.log
