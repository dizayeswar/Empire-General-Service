@echo off
cd /d "%~dp0"
title Bobby watch
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0watch_loop.ps1"
