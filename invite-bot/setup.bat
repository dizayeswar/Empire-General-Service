@echo off
rem One-time setup on a new PC. Needs Python 3.12+ and Microsoft Edge.
cd /d "%~dp0"
python --version || (echo Install Python from python.org first, tick "Add python to PATH". & pause & exit /b 1)
python -m pip install -r requirements.txt
if not exist config.local.json copy config.example.json config.local.json
python -m unittest discover -s tests
echo.
echo Setup done. Double-click start-invite-bot.bat to start.
pause
