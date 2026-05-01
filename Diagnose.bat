@echo off
title Butzcraft Diagnose
cd /d "%~dp0"

set OUT=diagnose.txt
echo Butzcraft Diagnose > %OUT%
echo Datum: %DATE% %TIME% >> %OUT%
echo. >> %OUT%

echo === 1. Aktueller Ordner === >> %OUT%
cd >> %OUT%
echo. >> %OUT%

echo === 2. Node.js Version === >> %OUT%
node --version >> %OUT% 2>&1
echo. >> %OUT%

echo === 3. server.js vorhanden? === >> %OUT%
if exist server.js (echo JA >> %OUT%) else (echo NEIN >> %OUT%)
echo. >> %OUT%

echo === 4. node_modules vorhanden? === >> %OUT%
if exist node_modules\express (echo express JA >> %OUT%) else (echo express NEIN - npm install fehlt! >> %OUT%)
if exist node_modules\cors (echo cors JA >> %OUT%) else (echo cors NEIN >> %OUT%)
if exist node_modules\body-parser (echo body-parser JA >> %OUT%) else (echo body-parser NEIN >> %OUT%)
echo. >> %OUT%

echo === 5. Port 3000 belegt? === >> %OUT%
netstat -ano | findstr :3000 >> %OUT% 2>&1
echo. >> %OUT%

echo === 6. Server-Test (10 Sekunden) === >> %OUT%
echo Starte Server jetzt - Output folgt: >> %OUT%
echo --------------------------------- >> %OUT%
start /B cmd /c "node server.js > server_test.log 2>&1"
timeout /t 5 /nobreak > nul

echo --- server_test.log Inhalt: --- >> %OUT%
if exist server_test.log type server_test.log >> %OUT%
echo. >> %OUT%
echo --------------------------------- >> %OUT%

echo === 7. Connect-Test === >> %OUT%
curl -s -o nul -w "HTTP-Status: %%{http_code}\n" http://127.0.0.1:3000/ >> %OUT% 2>&1
echo. >> %OUT%

echo === 8. Server beenden === >> %OUT%
taskkill /F /IM node.exe >> %OUT% 2>&1

echo.
echo ===========================================
echo Diagnose abgeschlossen.
echo Ergebnis in: diagnose.txt
echo ===========================================
echo.
notepad diagnose.txt
pause
