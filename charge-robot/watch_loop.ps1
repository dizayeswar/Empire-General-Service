$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot
$env:PYTHONIOENCODING = "utf-8"
$others = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
  $_.ProcessId -ne $PID -and $_.CommandLine -and ($_.CommandLine -match 'watch_loop\.ps1')
})
if ($others.Count -gt 0) {
  Write-Host "Bobby watch already running (PID $($others[0].ProcessId)). Not starting a second."
  exit 0
}
Write-Host "Bobby watch (only live entry). Website Bot Off stops this loop."
while ($true) {
  python "$PSScriptRoot\watch_open.py"
  if ($LASTEXITCODE -eq 3) {
    Write-Host "BOT_OFF - laptop watch stopped"
    break
  }
  if ($LASTEXITCODE -eq 10) {
    Start-Sleep -Seconds 8
  } else {
    Start-Sleep -Seconds 3
  }
}
