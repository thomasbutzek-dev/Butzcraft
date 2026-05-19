@echo off
title Butzcraft Vorschau Starter
echo Starte Butzcraft-Vorschau (Node.js)...
echo.

:: Pruefe ob Port 3000 schon belegt ist.
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }" > nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [WARNUNG] Port 3000 ist bereits belegt!
    echo Vermutlich laeuft schon ein Butzcraft-Server. Ich oeffne nur die Vorschau.
    echo.
    timeout /t 2 /nobreak > nul
    goto OPEN_BROWSER
)

if exist server.preview.log del server.preview.log

:: Server starten - minimiert, Log bleibt fuer Fehler sichtbar.
start /min "Butzcraft Vorschau Server" cmd /c "cd /d "%~dp0" && node server.js > server.preview.log 2>&1"

echo Warte auf Server-Start...
set RETRIES=0
:WAIT_LOOP
timeout /t 1 /nobreak > nul
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }" > nul 2>&1
if %ERRORLEVEL% EQU 0 goto SERVER_READY
if exist server.preview.log (
    findstr "127.0.0.1 localhost 3000" server.preview.log > nul 2>&1
    if %ERRORLEVEL% EQU 0 goto SERVER_READY
)
set /a RETRIES+=1
if %RETRIES% GEQ 30 goto SERVER_FAILED
goto WAIT_LOOP

:SERVER_FAILED
echo.
echo [FEHLER] Server konnte nicht gestartet werden!
echo Inhalt von server.preview.log:
echo ---------------------------------------
if exist server.preview.log type server.preview.log
echo ---------------------------------------
echo.
echo Druecke eine Taste zum Beenden...
pause > nul
exit /b 1

:SERVER_READY
echo Server ist bereit.

:OPEN_BROWSER
echo Oeffne Butzcraft-Vorschau im Browser...
set "PREVIEW_URL=http://localhost:3000/butzcraft-preview.html?bust=%RANDOM%%RANDOM%"
call :FIND_BROWSER
if defined BROWSER_EXE (
    start "Butzcraft Vorschau" "%BROWSER_EXE%" --new-window "%PREVIEW_URL%"
) else (
    echo [HINWEIS] Chrome/Edge/Firefox nicht gefunden. Oeffne Standardbrowser.
    start "" "%PREVIEW_URL%"
)

echo.
echo Vorschau gestartet.
echo (Server-Stop: Butzcraft_Stoppen.bat oder Task-Manager - node.exe beenden)
echo Dieses Fenster schliesst sich in 5 Sekunden...
timeout /t 5 /nobreak > nul
exit

:FIND_BROWSER
set "BROWSER_EXE="
for %%B in ("%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%LocalAppData%\Google\Chrome\Application\chrome.exe" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" "%ProgramFiles%\Mozilla Firefox\firefox.exe" "%ProgramFiles(x86)%\Mozilla Firefox\firefox.exe" "%LocalAppData%\Mozilla Firefox\firefox.exe") do (
    if exist "%%~B" (
        set "BROWSER_EXE=%%~B"
        exit /b 0
    )
)
exit /b 0
