@echo off
title StudyNook Installer Builder
rem ============================================================
rem  One-click: builds the real Windows installer ON YOUR PC
rem  (needs Node.js LTS once) and then launches it.
rem  Use this again for every future version: download the new
rem  project zip, extract, double-click this file. That's all.
rem ============================================================
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   [StudyNook] Node.js was not found.
  echo   Install the free LTS version from https://nodejs.org, then run this again.
  echo.
  pause
  exit /b 1
)
cd /d "%~dp0"
echo   [1/3] Installing build dependencies (first time takes a few minutes)...
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo   [StudyNook] npm install failed. Check your internet and try again.
  pause
  exit /b 1
)
echo   [2/3] Building the installer...
call npm run dist
if errorlevel 1 (
  echo   [StudyNook] Installer build failed.
  pause
  exit /b 1
)
echo   [3/3] Launching the installer wizard...
for %%f in (dist-installer\StudyNook-Setup-*.exe) do start "" "%%f"
exit /b 0
