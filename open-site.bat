@echo off
setlocal
cd /d "%~dp0"

where python >nul 2>nul
if not errorlevel 1 goto run_python

where py >nul 2>nul
if not errorlevel 1 goto run_py

echo.
echo Python was not found. Install Python 3 from https://www.python.org/downloads/
echo and tick "Add python.exe to PATH", then run this file again.
echo.
pause
exit /b 1

:run_python
start "Academic Blog Server" cmd /k python -m http.server 8000 --bind 127.0.0.1
goto open_browser

:run_py
start "Academic Blog Server" cmd /k py -m http.server 8000 --bind 127.0.0.1
goto open_browser

:open_browser
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8000/"
exit /b 0
