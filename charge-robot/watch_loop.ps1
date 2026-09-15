$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot
$env:PYTHONIOENCODING = "utf-8"
Write-Host "Bobby watch. Website Bot Off stops this loop."
while ($true) {
  python "$PSScriptRoot\watch_open.py"
  if ($LASTEXITCODE -eq 3) {
    Write-Host "BOT_OFF - laptop watch stopped"
    break
  }
  if ($LASTEXITCODE -eq 10) {
    Start-Sleep -Seconds 8
  } else {
    Start-Sleep -Seconds 25
  }
}
