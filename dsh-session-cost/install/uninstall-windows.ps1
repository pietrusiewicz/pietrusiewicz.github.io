# Remove dsh-session-cost from a DSH profile on Windows.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\install\uninstall-windows.ps1 [profile]

param(
    [string]$Profile = "web"
)

$ErrorActionPreference = "Stop"

$PluginName = "dsh-session-cost"
$DshHome = if ([string]::IsNullOrWhiteSpace($env:DSH_HOME)) {
    Join-Path $HOME ".dsh"
} else {
    $env:DSH_HOME
}
$ProfileDir = Join-Path (Join-Path $DshHome "profiles") $Profile
$Patch = Join-Path $ProfileDir "cordis.patch.yml"
$Dest = Join-Path (Join-Path $DshHome "plugins") $PluginName
$MarkBegin = "# >>> dsh-session-cost (managed) >>>"
$MarkEnd = "# <<< dsh-session-cost (managed) <<<"

function Stop-WithError([string]$Message) {
    Write-Host "error: $Message" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $Patch)) {
    Stop-WithError "Patch file not found: $Patch"
}

$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
Copy-Item -LiteralPath $Patch -Destination "$Patch.bak.$Stamp"

$Text = [System.IO.File]::ReadAllText($Patch)
$Pattern = "(?ms)^" + [regex]::Escape($MarkBegin) + "\r?\n.*?^" + [regex]::Escape($MarkEnd) + "\r?\n?"
if (-not [regex]::IsMatch($Text, $Pattern)) {
    Write-Host "No managed dsh-session-cost block found in $Patch"
    exit 0
}
$Text = [regex]::Replace($Text, $Pattern, "")

$Content = ($Text -split "`r?`n" | Where-Object {
    $line = ($_ -replace "#.*$", "") -replace "\s", ""
    $line -ne ""
}) -join ""
if ([string]::IsNullOrEmpty($Content) -or $Content -eq "[]") {
    $Text = "[]`r`n"
} elseif (-not $Text.EndsWith("`n")) {
    $Text += "`r`n"
}

[System.IO.File]::WriteAllText($Patch, $Text, [System.Text.UTF8Encoding]::new($false))

if (Test-Path $Dest) {
    $pkg = $null
    try { $pkg = Get-Content -LiteralPath (Join-Path $Dest "package.json") -Raw | ConvertFrom-Json } catch { }
    if ($null -ne $pkg -and $pkg.name -eq $PluginName) {
        Remove-Item -LiteralPath $Dest -Recurse -Force
        Write-Host "Removed $Dest"
    } else {
        Write-Host "Left $Dest untouched: it is not $PluginName"
    }
}

Write-Host "Removed the dsh-session-cost entry from $Patch"
Write-Host "  backup: $Patch.bak.$Stamp"
Write-Host "Restart DSH, then refresh the browser tab."
