Set ws = CreateObject("Wscript.Shell")

' 1. バックグラウンド（非表示ウィンドウ = 0）で npm run start を実行します。
ws.run "cmd /c npm run start", 0, false

' 2. 起動したことをユーザーに知らせるポップアップメッセージ（数秒後に自動で閉じても良いですし、OKを押すまででもOK）
MsgBox "X Recruitment Assistant サーバーをバックグラウンドで起動しました。" & vbCrLf & _
       "ブラウザで以下のアドレスを開いてください：" & vbCrLf & _
       "http://localhost:3000" & vbCrLf & vbCrLf & _
       "※ 停止したい場合は、同フォルダ内の「stop-background.bat」を実行してください。", _
       vbInformation, "X_Recruitment_Assistant Launcher"
