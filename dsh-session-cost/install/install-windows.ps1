# Install dsh-session-cost into a DSH profile on Windows.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\install\install-windows.ps1 [profile]
#
# The profile defaults to "web". Set DSH_HOME to use a non-default DSH home.

param(
    [string]$Profile = "web"
)

$ErrorActionPreference = "Stop"

$PluginName = "dsh-session-cost"
$PluginSrc = Split-Path -Parent $PSScriptRoot
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

if (-not (Test-Path (Join-Path $PluginSrc "lib\client.js"))) {
    Stop-WithError "Plugin files not found next to this script: $PluginSrc"
}
if (-not (Test-Path $ProfileDir)) {
    Stop-WithError "Profile '$Profile' not found at $ProfileDir. Start DSH once with that profile (for example: dsh web), then run this script again."
}
if (-not (Test-Path $Patch)) {
    [System.IO.File]::WriteAllText($Patch, "[]`r`n", [System.Text.UTF8Encoding]::new($false))
}

$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
Copy-Item -LiteralPath $Patch -Destination "$Patch.bak.$Stamp"

New-Item -ItemType Directory -Force -Path (Join-Path $DshHome "plugins") | Out-Null
if (Test-Path $Dest) {
    $pkg = $null
    try { $pkg = Get-Content -LiteralPath (Join-Path $Dest "package.json") -Raw | ConvertFrom-Json } catch { }
    if ($null -eq $pkg -or $pkg.name -ne $PluginName) {
        Stop-WithError "Refusing to replace $Dest`: it is not $PluginName"
    }
    Remove-Item -LiteralPath $Dest -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $Dest | Out-Null
Copy-Item -LiteralPath (Join-Path $PluginSrc "lib") -Destination $Dest -Recurse
Copy-Item -LiteralPath (Join-Path $PluginSrc "package.json") -Destination $Dest
$Readme = Join-Path $PluginSrc "README.md"
if (Test-Path $Readme) { Copy-Item -LiteralPath $Readme -Destination $Dest }

$Entry = ([System.Uri]::new((Join-Path $Dest "lib\index.js"))).AbsoluteUri

$Text = [System.IO.File]::ReadAllText($Patch)
$Pattern = "(?ms)^" + [regex]::Escape($MarkBegin) + "\r?\n.*?^" + [regex]::Escape($MarkEnd) + "\r?\n?"
$Text = [regex]::Replace($Text, $Pattern, "")

# Drop a bare empty list, but keep the user's comments.
$Text = [regex]::Replace($Text, "(?m)^[ \t]*\[[ \t]*\][ \t]*\r?\n?", "")
if ($Text.Length -gt 0 -and -not $Text.EndsWith("`n")) { $Text += "`r`n" }
if ($Text.Length -gt 0 -and -not $Text.EndsWith("`r`n")) { $Text += "`r`n" }

$Block = @(
    $MarkBegin
    "- insert:"
    "    - id: session-cost"
    "      name: $Entry"
    $MarkEnd
) -join "`r`n"

[System.IO.File]::WriteAllText($Patch, $Text + $Block + "`r`n", [System.Text.UTF8Encoding]::new($false))

Write-Host ""
Write-Host "Installed $PluginName"
Write-Host "  plugin:  $Dest"
Write-Host "  profile: $Profile"
Write-Host "  patch:   $Patch"
Write-Host "  backup:  $Patch.bak.$Stamp"
Write-Host ""
Write-Host "Restart DSH (or wait for the live profile reload), then refresh the browser tab."
