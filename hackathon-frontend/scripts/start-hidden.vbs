' Pit Wall Console - chay "npm run electron:dev" hoan toan an, khong hien
' cua so terminal/cmd nao ca - chi hien giao dien Electron khi san sang.
' Dung: double-click file nay, hoac chay `npm run electron:dev:hidden`.
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectDir = fso.GetParentFolderName(scriptDir)

Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = projectDir
' 0 = cua so an hoan toan; False = khong doi lenh chay xong (chay ngam)
WshShell.Run "cmd /c npm run electron:dev", 0, False
