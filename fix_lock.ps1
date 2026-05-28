Write-Host "Stopping Node.js and Electron processes..."
Get-Process | Where-Object { $_.ProcessName -eq "node" -or $_.ProcessName -eq "electron" -or $_.ProcessName -eq "lingjing" } | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host "Waiting 3 seconds..."
Start-Sleep -Seconds 3
Write-Host "Cleaning win-unpacked..."
$target = "D:\lingjing\lingjing\packages\electron\release\win-unpacked"
if (Test-Path $target) {
    Remove-Item -Path $target -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path $target) {
        Write-Host "STILL LOCKED - cannot remove"
    } else {
        Write-Host "CLEANED OK"
    }
} else {
    Write-Host "Already cleaned"
}
