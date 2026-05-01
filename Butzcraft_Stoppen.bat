@echo off
title Butzcraft Stopper
echo Stoppe alle laufenden Butzcraft-Server (node.exe)...

:: Killt alle node.exe-Prozesse die auf Port 3000 lauschen.
:: Wir suchen ueber netstat den PID des Listeners auf 3000 und taskkillen ihn.
:: Vorteil ggue. "taskkill /IM node.exe": andere Node-Apps des Users bleiben unberuehrt.
:: Hinweis: Deutsches Windows zeigt "ABH?REN" statt "LISTENING" — daher matchen wir nur auf ":3000"
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr /V "TIME_WAIT CLOSE_WAIT"') do (
    echo Beende node-Process mit PID %%a
    taskkill /F /PID %%a > nul 2>&1
)

echo.
echo Fertig. Falls noch ein Server laeuft, bitte manuell ueber Task-Manager beenden.
timeout /t 3 /nobreak > nul
exit
