# Installs ARENA Watchdog into Windows Startup folder
$Root = Split-Path $PSScriptRoot -Parent
$VbsPath = Join-Path $Root 'run-silent.vbs'
$StartupDir = [System.Environment]::GetFolderPath('Startup')
$ShortcutPath = Join-Path $StartupDir 'ARENA-Production.lnk'

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "wscript.exe"
$Shortcut.Arguments = "`"$VbsPath`""
$Shortcut.WorkingDirectory = $Root
$Shortcut.Description = "ARENA 24/7 Production Self-Healing Watchdog"
$Shortcut.Save()

Write-Host "SUCCESS: ARENA 24/7 Watchdog shortcut installed to Windows Startup:" -ForegroundColor Green
Write-Host "  $ShortcutPath" -ForegroundColor Cyan
Write-Host "ARENA will now start automatically whenever your computer powers on!" -ForegroundColor Yellow
