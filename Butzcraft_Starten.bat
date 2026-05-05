@echo off
title Butzcraft Starter
echo Starte Butzcraft-Server (Node.js)...
echo.

:: Pruefe ob Port 3000 schon belegt ist (typischer Crash-Grund)
netstat -ano | findstr :3000 | findstr LISTENING > nul
if %ERRORLEVEL% EQU 0 (
    echo [WARNUNG] Port 3000 ist bereits belegt!
    echo Vermutlich laeuft schon ein Server. Ich oeffne nur den Browser.
    echo.
    timeout /t 2 /nobreak > nul
    goto OPEN_BROWSER
)

:: Server-Log loeschen, damit wir Fehler frisch sehen
if exist server.log del server.log

:: Server starten — Fenster bleibt SICHTBAR, damit Fehler erkennbar sind.
:: Output zusaetzlich in server.log umleiten.
start /min "Butzcraft Server" cmd /c "cd /d "%~dp0" && node server.js > server.log 2>&1"

:: Warte aktiv bis Server auf Port 3000 hoert (max 15 Sekunden)
echo Warte auf Server-Start...
set RETRIES=0
:WAIT_LOOP
timeout /t 1 /nobreak > nul
netstat -ano | findstr :3000 | findstr LISTENING > nul
if %ERRORLEVEL% EQU 0 goto SERVER_READY
set /a RETRIES+=1
if %RETRIES% GEQ 15 goto SERVER_FAILED
goto WAIT_LOOP

:SERVER_FAILED
echo.
echo [FEHLER] Server konnte nicht gestartet werden!
echo Inhalt von server.log:
echo ---------------------------------------
if exist server.log type server.log
echo ---------------------------------------
echo.
echo Druecke eine Taste zum Beenden...
pause > nul
exit /b 1

:SERVER_READY
echo Server ist bereit.

:OPEN_BROWSER
echo Oeffne Spiel im Browser...
start http://localhost:3000/?bust=%RANDOM%%RANDOM%

echo.
echo Viel Spass beim Spielen!
echo (Server-Stop: Butzcraft_Stoppen.bat oder Task-Manager - node.exe beenden)
echo Dieses Fenster schliesst sich in 5 Sekunden...
timeout /t 5 /nobreak > nul
exit
