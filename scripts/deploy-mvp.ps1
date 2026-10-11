$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/mvp-env.ps1"
Push-Location $mvpRoot
try {
    $binary = Get-Item -LiteralPath 'target/deploy/profile_rewards.so'
    if (-not (Test-Path -LiteralPath '.local/profile-rewards/deploy-buffer-keypair.json')) {
        node scripts/setup-mvp.cjs
        if ($LASTEXITCODE -ne 0) { throw 'Deployment key setup failed.' }
    }
    anchor deploy --program-name profile_rewards -- --use-rpc --max-len $binary.Length --buffer .local/profile-rewards/deploy-buffer-keypair.json
    if ($LASTEXITCODE -ne 0) { throw 'Devnet deployment failed.' }
} finally {
    Pop-Location
}
