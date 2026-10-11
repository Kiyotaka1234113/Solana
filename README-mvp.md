# Assignment 8: Profile Rewards MVP

An Anchor program and a TypeScript CLI client on Solana Devnet.

## Contract

- Source: `programs/profile_rewards/src/lib.rs`.
- `initialize_user(name)` creates the PDA `["user_profile", user]`, with the
  owner's address, a name of up to 32 UTF-8 bytes, reputation `0`, and the bump.
- `complete_task()` checks the signer, profile PDA, configured reward mint, mint
  authority, and the user's ATA. It mints `10_000_000` base units (10 tokens with
  6 decimals) using a signed CPI to the classic SPL Token Program, and adds 10
  reputation. Both changes are in the same atomic Solana transaction.
- Mint authority: PDA `["reward_authority"]`. No wallet holds its private key.
- The configured mint is fixed in the contract to prevent substituting another
  token while earning reputation. It has no freeze authority.

This educational MVP treats each signed `complete_task` invocation as a task.
It intentionally allows repeated tasks. Proving an external action or limiting
rewards to one claim per task would require task IDs and an authorized verifier.

The CPI follows the [Anchor minting documentation](https://www.anchor-lang.com/docs/tokens/basics/mint-tokens).

## Build and Deploy on This Windows Machine

The local `.tools` directory contains Anchor CLI 0.30.1, Agave 4.3.0, and portable
Microsoft compiler/SDK components. `scripts/mvp-env.ps1` adds them to the current
PowerShell process. Build caches are outside OneDrive in
`%LOCALAPPDATA%/profile-rewards-build`. No global default Rust toolchain is changed.

```powershell
./scripts/build-mvp.ps1
./scripts/deploy-mvp.ps1
npx ts-node tests/mvp.ts
```

The build script invokes `cargo-build-sbf` and `anchor idl build`; the deploy
script invokes `anchor deploy --program-name profile_rewards` on Devnet using
the wallet configured in `Anchor.toml`. The initial deployment needs enough
test SOL for the program account, upload buffer, and transaction fees.

With an existing compatible Anchor installation, the equivalent commands are:

```text
anchor build --program-name profile_rewards
anchor deploy --program-name profile_rewards
npx ts-node tests/mvp.ts
```

Program ID: `Cf2wLYFB3PQKJKDBuszFoAjdvKE8vjaziFLM2TkGZ62T`.

Configured reward mint: `ER68vjbbokgZpF8JDvFgHqMD1RUUzDUjrLg3ChgacDD2`.

## Integration Test

`tests/mvp.ts` loads the compiler-generated IDL from `target/idl`. It checks the
Devnet genesis hash and that the program is executable before sending transactions.
The fee payer defaults to `devnet-keypair.json`; `ANCHOR_WALLET` and
`ANCHOR_PROVIDER_URL` can override the wallet and Devnet RPC endpoint.

The client creates the configured mint on its first run. Later runs reuse it
after verifying its decimals and authorities. Each run saves a new user keypair,
funds it with 0.01 test SOL, and creates its reward ATA. It then:

1. Rejects an empty name and a name longer than 32 bytes using on-chain simulation.
2. Calls `initialize_user` and reads the actual PDA to assert reputation `0`.
3. Verifies rejection of a wrong profile owner, another user's ATA, and another mint.
4. Calls `complete_task` and reads the actual PDA, ATA, and mint supply from Devnet.
5. Uses `assert.strictEqual` to check reputation `10`, ATA amount `10_000_000`,
   and a mint supply increase of exactly 10 tokens.
6. Fetches the confirmed transaction and checks the SPL Token `MintTo` CPI log.

The latest public results are saved to `.local/profile-rewards/latest-result.json`.
Each run's full log, results, and user keypair are in
`.local/profile-rewards/runs/<timestamp>/`. A rerun uses a new user so the initial
reputation and balance checks remain meaningful.

```powershell
. ./scripts/mvp-env.ps1
cargo test -p profile_rewards --lib
npm run typecheck
npm run test:mvp
```

## Local Keys

Private keys are excluded from version control. Preserve the deployment key in
`target/deploy/profile_rewards-keypair.json`, the fee payer wallet, and the files
under `.local/profile-rewards`. User keys are retained so rewards can be spent.

`scripts/setup-mvp.cjs` was used once to generate the deployment, reward mint, and
buffer keys. It does not overwrite existing files. For a new independent
deployment, synchronize the generated program/mint addresses in the Rust source,
`Anchor.toml`, and `tests/mvp.ts` before building. A replacement key cannot control
an existing address.

The local Anchor CLI source lock uses `time` 0.3.36, a build compatibility update
for the installed Rust compiler; the program itself stays on Anchor 0.30.1.
