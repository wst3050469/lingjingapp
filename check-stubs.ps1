$srcRoot = Join-Path $PSScriptRoot "packages\core\src"
$count = 0
$files = Get-ChildItem -Path $srcRoot -Recurse -File
foreach ($f in $files) {
    if ($f.Name -match '\.d\.ts$' -and $f.Name -notmatch '\.d\.d\.ts$') {
        Write-Host $f.FullName
        $count++
    }
}
Write-Host "Total .d.ts stubs remaining: $count"
