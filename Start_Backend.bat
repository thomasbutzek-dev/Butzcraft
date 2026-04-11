@echo off
title Butzcraft Balancing-Backend
echo =======================================
echo Starte Butzcraft Balancing-Backend...
echo =======================================
echo.

:: Beende eventuell im Hintergrund haengende alte Backend-Prozesse auf Port 3001
echo Pruefe auf alte Backend-Prozesse...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3003" ^| find "LISTENING"') do (
    echo Beende alten Prozess mit PID %%a...
    taskkill /f /pid %%a >nul 2>&1
)

echo.
echo Oeffne Browser...
start "" "http://localhost:3003"

echo.
echo [Backend laeuft ... Fenster zum Beenden schliessen]
echo.

cd backend
:: Hier starten wir Node ohne ein neues Fenster aufzumachen, damit
:: STRG+C oder der X-Button das Fenster und Node sauber beenden.
node server.js
pause
