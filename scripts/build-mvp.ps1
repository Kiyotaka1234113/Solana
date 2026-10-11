$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/mvp-env.ps1"
Push-Location $mvpRoot
try {
    cargo-build-sbf --manifest-path programs/profile_rewards/Cargo.toml --sbf-out-dir target/deploy --optimize-size
    if ($LASTEXITCODE -ne 0) { throw 'SBF compilation failed.' }
    New-Item -ItemType Directory -Path target/idl,target/types -Force | Out-Null
    anchor idl build --program-name profile_rewards --out target/idl/profile_rewards.json --out-ts target/types/profile_rewards.ts
    if ($LASTEXITCODE -ne 0) { throw 'IDL generation failed.' }
} finally {
    Pop-Location
}
