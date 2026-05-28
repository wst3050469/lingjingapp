$lockedFile = "D:\lingjing\lingjing\packages\electron\release\win-unpacked\resources\app.asar"
Write-Host "Looking for processes locking: $lockedFile"

# Use handle64 if available
$handlePath = "C:\Program Files (x86)\Sysinternals\handle64.exe"
if (Test-Path $handlePath) {
    & $handlePath -accepteula -a -u $lockedFile 2>&1
} else {
    Write-Host "Sysinternals handle not found, checking by process modules..."
    Get-Process | ForEach-Object {
        try {
            $modules = $_.Modules
            foreach ($mod in $modules) {
                if ($mod.FileName -like "*app.asar*") {
                    Write-Host ("PID: " + $_.Id + " Process: " + $_.ProcessName + " Module: " + $mod.FileName)
                }
            }
        } catch { }
    }
}

Write-Host "=== Done ==="
