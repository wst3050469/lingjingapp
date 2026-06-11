# Map all .d.ts stubs to their dist/ counterparts
$ErrorActionPreference = "Continue"
$srcRoot = Join-Path $PSScriptRoot "packages\core\src"

$files = Get-ChildItem -Path $srcRoot -Recurse -File
foreach ($f in $files) {
    if ($f.Name -match '\.d\.ts$' -and $f.Name -notmatch '\.d\.d\.ts$') {
        $content = Get-Content $f.FullName -Raw
        if ($content -match 'from\s+[`"''](.+?\.js)[`"'']') {
            $distRel = $Matches[1]
            Write-Host "$($f.FullName)|$distRel"
        }
    }
}
