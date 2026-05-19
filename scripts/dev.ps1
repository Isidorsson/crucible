# Local dev helper for Crucible on Windows + standard Go (no TinyGo, no make).
#
# Usage:
#   .\scripts\dev.ps1 build      # compile sim.wasm + copy wasm_exec.js
#   .\scripts\dev.ps1 install    # bun install in apps/web
#   .\scripts\dev.ps1 dev        # build + start the SvelteKit dev server
#   .\scripts\dev.ps1 typecheck  # bun run typecheck
#
# Run from the repo root: C:\...\crucible

param(
  [Parameter(Position = 0)]
  [ValidateSet('install', 'build', 'dev', 'typecheck', 'clean')]
  [string]$cmd = 'dev'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$web = Join-Path $root 'apps\web'
$sim = Join-Path $root 'sim'
$static = Join-Path $web 'static'
$wasmOut = Join-Path $static 'sim.wasm'
$wasmExecOut = Join-Path $static 'wasm_exec.js'

function Build-Sim {
  Write-Host "==> building sim.wasm with standard Go" -ForegroundColor Cyan
  Push-Location $sim
  try {
    $env:GOOS = 'js'
    $env:GOARCH = 'wasm'
    & go build -o $wasmOut .
    if ($LASTEXITCODE -ne 0) { throw "go build failed" }
  }
  finally {
    Remove-Item Env:GOOS, Env:GOARCH -ErrorAction SilentlyContinue
    Pop-Location
  }

  $goroot = (& go env GOROOT).Trim()
  $wasmExecSrc = Join-Path $goroot 'lib\wasm\wasm_exec.js'
  if (-not (Test-Path $wasmExecSrc)) {
    # Older Go layout
    $wasmExecSrc = Join-Path $goroot 'misc\wasm\wasm_exec.js'
  }
  if (-not (Test-Path $wasmExecSrc)) {
    throw "wasm_exec.js not found under $goroot"
  }
  Copy-Item $wasmExecSrc $wasmExecOut -Force
  Write-Host "==> wrote $wasmOut" -ForegroundColor Green
  Write-Host "==> wrote $wasmExecOut" -ForegroundColor Green
}

function Install-Deps {
  Write-Host "==> bun install" -ForegroundColor Cyan
  Push-Location $web
  try { & bun install }
  finally { Pop-Location }
}

function Start-Dev {
  Build-Sim
  Write-Host "==> bun run dev" -ForegroundColor Cyan
  Push-Location $web
  try { & bun run dev }
  finally { Pop-Location }
}

function Run-Typecheck {
  Push-Location $web
  try { & bun run typecheck }
  finally { Pop-Location }
}

function Clean {
  Remove-Item $wasmOut, $wasmExecOut -ErrorAction SilentlyContinue
  Write-Host "==> cleaned wasm artifacts" -ForegroundColor Green
}

switch ($cmd) {
  'install'   { Install-Deps }
  'build'     { Build-Sim }
  'dev'       { Start-Dev }
  'typecheck' { Run-Typecheck }
  'clean'     { Clean }
}
