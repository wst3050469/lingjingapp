$files = @(
    "desktop\electron\package.json",
    "desktop\core\package.json", 
    "mobile\package.json",
    "mobile\app.json"
)

foreach ($f in $files) {
    $path = Join-Path "D:\lingjing-ide" $f
    $j = Get-Content $path -Raw | ConvertFrom-Json
    Write-Host "$f : $($j.version)"
}
