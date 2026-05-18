@echo off
title Butzcraft Starter
echo Starte Butzcraft-Server (Node.js)...
echo.

:: Pruefe ob Port 3000 schon belegt ist (typischer Crash-Grund)
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }" > nul 2>&1
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

:: Warte aktiv bis Server auf Port 3000 hoert (max 30 Sekunden)
:: Pruefe netstat ODER server.log — je nachdem was zuerst anschlaegt
echo Warte auf Server-Start...
set RETRIES=0
:WAIT_LOOP
timeout /t 1 /nobreak > nul
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }" > nul 2>&1
if %ERRORLEVEL% EQU 0 goto SERVER_READY
if exist server.log (
    findstr "127.0.0.1" server.log > nul 2>&1
    if %ERRORLEVEL% EQU 0 goto SERVER_READY
)
set /a RETRIES+=1
if %RETRIES% GEQ 30 goto SERVER_FAILED
goto WAIT_LOOP

:SERVER_FAILED
:: Letzte Chance: Server hat moeglicherweise gestartet, aber netstat hat es verpasst
if exist server.log (
    findstr "127.0.0.1" server.log > nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo [HINWEIS] Server hat gestartet (laut Log). Oeffne Browser...
        goto OPEN_BROWSER
    )
)
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
set "GAME_URL=http://localhost:3000/?bust=%RANDOM%%RANDOM%"
call :FIND_FIREFOX
if defined FIREFOX_BROWSER (
    echo Starte Firefox. GPU-Auswahl fuer Firefox bitte in Windows auf "Hohe Leistung" setzen.
    start "Butzcraft Firefox" "%FIREFOX_BROWSER%" -new-window "%GAME_URL%"
) else (
    call :FIND_GPU_BROWSER
    if defined GPU_BROWSER (
        echo Starte Chrome/Edge mit dedizierter-GPU-Praeferenz...
        start "Butzcraft GPU Browser" "%GPU_BROWSER%" --new-window --user-data-dir="%TEMP%\Butzcraft-GPU-Browser" --force-high-performance-gpu --use-angle=d3d11 --enable-gpu-rasterization --ignore-gpu-blocklist "%GAME_URL%"
    ) else (
        echo [HINWEIS] Firefox/Chrome/Edge nicht gefunden. Oeffne Standardbrowser ohne GPU-Flags.
        start "" "%GAME_URL%"
    )
)

echo.
echo Viel Spass beim Spielen!
echo (Server-Stop: Butzcraft_Stoppen.bat oder Task-Manager - node.exe beenden)
echo Dieses Fenster schliesst sich in 5 Sekunden...
timeout /t 5 /nobreak > nul
exit

:FIND_FIREFOX
set "FIREFOX_BROWSER="
for %%B in ("%ProgramFiles%\Mozilla Firefox\firefox.exe" "%ProgramFiles(x86)%\Mozilla Firefox\firefox.exe" "%LocalAppData%\Mozilla Firefox\firefox.exe") do (
    if exist "%%~B" (
        set "FIREFOX_BROWSER=%%~B"
        exit /b 0
    )
)
exit /b 0

:FIND_GPU_BROWSER
set "GPU_BROWSER="
for %%B in ("%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%LocalAppData%\Google\Chrome\Application\chrome.exe" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe") do (
    if exist "%%~B" (
        set "GPU_BROWSER=%%~B"
        exit /b 0
    )
)
exit /b 0
