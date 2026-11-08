@echo off
rem Double-click to stop the Sync to portal bot. An apartment already in SAP is finished first.
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='pythonw.exe' or Name='python.exe'\" | Where-Object { $_.CommandLine -like '*website_bot.py*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
echo Bot stopped. This window closes by itself.
timeout /t 4 >nul
