@echo off
chcp 65001 >nul

echo =======================================================
echo   X Recruitment Reply Assistant - Windows Build Script
echo =======================================================
echo.

where npm >nul 2>nul
if %errorlevel% neq 0 goto NO_NPM

echo [1/4] Installing packaging dependencies (electron, electron-packager)...
call npm install electron electron-packager --save-dev
if %errorlevel% neq 0 goto FAIL_INSTALL

echo.
echo [2/4] Building the React Web assets...
call npm run build:all
if %errorlevel% neq 0 goto FAIL_BUILD

echo.
echo [3/4] Copying launcher configs...
if not exist dist mkdir dist
copy package.json dist\package.json /Y >nul
if %errorlevel% neq 0 goto FAIL_COPY

echo.
echo [4/4] Packaging the Windows Native Desktop Application (.exe)...
call npx electron-packager . "X_Recruitment_Assistant" --platform=win32 --arch=x64 --out=dist-windows --overwrite --ignore="node_modules"
if %errorlevel% neq 0 goto FAIL_PACKAGE

echo.
echo =======================================================
echo   SUCCESS! Windows App (.exe) is compiled successfully!
echo.
echo   Saved Directory:
echo   .\dist-windows\X_Recruitment_Assistant-win32-x64\
echo =======================================================
pause
exit /b 0

:NO_NPM
echo [ERROR] npm is not found on your system.
echo Please install Node.js:
echo 1. Download and install LTS version from https://nodejs.org/
echo 2. Crucial: After installation, CLOSE this black window and open it again.
echo.
pause
exit /b 1

:FAIL_INSTALL
echo [ERROR] Failed to install dependencies.
pause
exit /b 1

:FAIL_BUILD
echo [ERROR] Failed to build application assets.
pause
exit /b 1

:FAIL_COPY
echo [ERROR] Failed to copy configuration file.
pause
exit /b 1

:FAIL_PACKAGE
echo [ERROR] Failed to package native application.
pause
exit /b 1
