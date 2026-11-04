@echo off
rem Double-click to start. Change --dry-run to --confirm, later to --auto.
cd /d "%~dp0"
python main.py --dry-run
pause
