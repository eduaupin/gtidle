@echo off
REM Clique duas vezes neste arquivo para rodar o Grand Trade Idle.
cd /d "%~dp0"
if not exist node_modules\gifenc (
  echo Instalando dependencias, so na primeira vez ou depois de atualizar...
  call npm install
)
start "" cmd /c "timeout /t 10 >nul & start http://localhost:5173"
call npm run dev
pause
