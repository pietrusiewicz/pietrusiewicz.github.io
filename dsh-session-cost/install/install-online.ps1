# Download and install dsh-session-cost without keeping a local clone.
#
# Usage (PowerShell):
#   irm https://raw.githubusercontent.com/pietrusiewicz/pietrusiewicz.github.io/main/dsh-session-cost/install/install-online.ps1 | iex
#
# The profile defaults to "web". For another profile:
#   $env:DSH_PROFILE = "tui"; irm ... | iex
#
# Set DSH_HOME for a non-default DSH home, or DSH_SESSION_COST_REF for another
# branch or tag. Written without a param block so it also works through iex.

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Profile = if ([string]::IsNullOrWhiteSpace($env:DSH_PROFILE)) { "web" } else { $env:DSH_PROFILE }
$Repo = "pietrusiewicz/pietrusiewicz.github.io"
$Ref = if ([string]::IsNullOrWhiteSpace($env:DSH_SESSION_COST_REF)) { "main" } else { $env:DSH_SESSION_COST_REF }
$Url = "https://github.com/$Repo/archive/refs/heads/$Ref.zip"

$Root = Join-Path ([System.IO.Path]::GetTempPath()) ("dsh-session-cost-" + [guid]::NewGuid().ToString("N"))
$Zip = Join-Path $Root "source.zip"
$Dir = Join-Path $Root "source"

function Stop-WithError([string]$Message) {
    Write-Host "error: $Message" -ForegroundColor Red
    exit 1
}

try {
    New-Item -ItemType Directory -Force -Path $Root | Out-Null
    Invoke-WebRequest -Uri $Url -OutFile $Zip -UseBasicParsing
    Expand-Archive -LiteralPath $Zip -DestinationPath $Dir -Force

    $Src = Get-ChildItem -LiteralPath $Dir -Directory |
        ForEach-Object { Join-Path $_.FullName "dsh-session-cost" } |
        Where-Object { Test-Path (Join-Path $_ "install\install-windows.ps1") } |
        Select-Object -First 1

    if ([string]::IsNullOrWhiteSpace($Src)) {
        Stop-WithError "dsh-session-cost not found in the downloaded archive."
    }

    & (Join-Path $Src "install\install-windows.ps1") -Profile $Profile
    if ($LASTEXITCODE -ne 0 -and $null -ne $LASTEXITCODE) { exit $LASTEXITCODE }
}
finally {
    Remove-Item -LiteralPath $Root -Recurse -Force -ErrorAction SilentlyContinue
}
