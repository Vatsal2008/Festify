@echo off
REM Double-click this to open the Festify dev panel.
cd /d "%~dp0"
start "" http://127.0.0.1:7777
"..\backend\venv\Scripts\python.exe" panel.py
pause
