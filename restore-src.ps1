# Reverse-engineer: copy dist/*.js to src/*.ts for all stub modules
# This eliminates the src->dist dependency antipattern
$ErrorActionPreference = "Continue"
$srcRoot = Join-Path $PSScriptRoot "packages\core\src"
$distRoot = Join-Path $PSScriptRoot "packages\core\dist"
$count = 0
$skipped = 0
$errors = @()

$files = Get-ChildItem -Path $srcRoot -Recurse -File
foreach ($f in $files) {
    if ($f.Name -match '\.d\.ts$' -and $f.Name -notmatch '\.d\.d\.ts$') {
        $content = Get-Content $f.FullName -Raw
        if ($content -match 'from\s+[`"''](.+?\.js)[`"'']') {
            $distRel = $Matches[1]
            # Resolve the dist/ path
            $stubDir = Split-Path $f.FullName -Parent
            $distAbs = Join-Path $stubDir $distRel | Resolve-Path -ErrorAction SilentlyContinue
            
            if (-not $distAbs) {
                Write-Host "MISSING dist: $distRel (from $($f.FullName))"
                $errors += "MISSING: $distRel"
                continue
            }
            
            # Build the target .ts path (same dir as stub, .ts extension)
            $tsName = $f.Name -replace '\.d\.ts$', '.ts'
            $tsPath = Join-Path $stubDir $tsName
            
            if (Test-Path $tsPath) {
                Write-Host "SKIP (exists): $tsPath"
                $skipped++
                continue
            }
            
            # Copy JS content as .ts (JS is valid TypeScript)
            $jsContent = Get-Content $distAbs -Raw
            # Add a header comment
            $header = "// Restored from compiled output — original TypeScript source was lost.`n// This file is valid TypeScript; type annotations can be added incrementally.`n`n"
            Set-Content -Path $tsPath -Value ($header + $jsContent) -Encoding UTF8
            
            # Delete the stub
            Remove-Item $f.FullName -Force
            
            Write-Host "RESTORED: $($f.Name) -> $tsName"
            $count++
        }
    }
}

# Handle builtin/index.ts specially — it's a barrel file that re-exports other stubs
# It needs to be renamed back from .d.ts to .ts and point to local files
$builtinIndex = Join-Path $srcRoot "tools\builtin\index.d.ts"
if (Test-Path $builtinIndex) {
    $biContent = Get-Content $builtinIndex -Raw
    $biTs = $builtinIndex -replace '\.d\.ts$', '.ts'
    # Fix paths: remove ../../../dist/tools/builtin/ prefix, keep just ./
    $biContent = $biContent -replace "from '\.\.\/\.\.\/\.\.\/dist\/tools\/builtin\/(.+?)\.js'", "from './`$1.js'"
    Set-Content -Path $biTs -Value $biContent -Encoding UTF8
    Remove-Item $builtinIndex -Force
    Write-Host "FIXED: tools/builtin/index.d.ts -> index.ts (paths fixed)"
    $count++
}

Write-Host ""
Write-Host "=== Summary ==="
Write-Host "Restored: $count files"
Write-Host "Skipped: $skipped files"
if ($errors.Count -gt 0) {
    Write-Host "Errors:"
    foreach ($e in $errors) { Write-Host "  $e" }
}
