@echo off
rem Double-click to start the bot for Application -> Sync to portal.
rem It runs hidden (no window). Check "Bot online" on the website; details in log.txt.
cd /d "%~dp0"
set "PYW=%LOCALAPPDATA%\Programs\Python\Python312\pythonw.exe"
if not exist "%PYW%" set "PYW=pythonw"
start "" "%PYW%" "%~dp0website_bot.py"
echo Bot started in the background. This window closes by itself.
timeout /t 4 >nul
