@echo off
chcp 65001 >nul

echo =======================================================
6: echo   X Recruitment Assistant - Background Process Stopper
7: echo =======================================================
echo.
echo バックグラウンドで起動している Node.js サーバーを停止しています...

rem node.exe プロセスを強制終了します。
taskkill /f /im node.exe >nul 2>&1

echo.
echo 停止処理が完了しました！これでサーバーは完全に終了しました。
echo.
pause
exit /b 0
