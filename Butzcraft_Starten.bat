@echo off
title Butzcraft Starter
echo Starte Butzcraft-Server (Node.js)...
echo.

:: Startet den Node.js Backend & Frontend-Server
start "Butzcraft Node Server" cmd /c "node server.js"

:: Warte 2 Sekunden, damit der Server bereit ist
timeout /t 2 /nobreak > nul

echo Server laeuft! Oeffne Spiel im Browser...
start http://localhost:3000/?bust=%RANDOM%%RANDOM%

echo.
echo Viel Spass beim Spielen!
echo Dieses Fenster schliesst sich in 5 Sekunden...
timeout /t 5 /nobreak > nul
exit
