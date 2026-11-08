@echo off
rem Double-click to start the bot for Application -> Sync to portal. Leave this window open.
cd /d "%~dp0"
set "PY=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
if not exist "%PY%" set "PY=python"
"%PY%" website_bot.py
pause
