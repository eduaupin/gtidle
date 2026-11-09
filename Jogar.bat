@echo off
REM Clique duas vezes neste arquivo para rodar o Grand Trade Idle.
cd /d "%~dp0"
echo Conferindo dependencias (na primeira vez ou depois de atualizar demora 1 a 2 minutos)...
call npm install --no-audit --no-fund
start "" cmd /c "timeout /t 10 >nul & start http://localhost:5173"
call npm run dev
pause
