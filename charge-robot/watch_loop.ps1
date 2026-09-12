$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot
$env:PYTHONIOENCODING = "utf-8"
Write-Host "Bobby watch. Website Bot Off stops this loop."
while ($true) {
  python "$PSScriptRoot\watch_open.py"
  if ($LASTEXITCODE -eq 3) {
    Write-Host "BOT_OFF — laptop watch stopped"
    break
  }
  Start-Sleep -Seconds 120
}
