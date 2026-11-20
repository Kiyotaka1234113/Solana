const fetch = require('node-fetch');
// If node version >=18, global fetch is available; fallback to node-fetch for older.
(async () => {
  const RPC = 'https://api.devnet.solana.com';
  const wallet = 'F8VD2NvjMKSSDqRSDpTYzL2wrVyeDzt3zEDweSqmQqcM';
  const programId = '9tXLf1ZEbjycpb3E2vcBqbfe6DAnLYuxpWjtYBDaLZtM';
  const POOL_A = 'BESX1w1g9doqwXP6rPpyDFk5v8V4b7sD72bLCSurfM4F';
  const POOL_B = 'H3RQb293vviJsYmfbvjJGxe1DNpUaz88qnNdkMSJgkcp';
  const rpc = async (method, params) => {
    const res = await fetch(RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    return res.json();
  };
  try {
    const bal = await rpc('getBalance', [wallet]);
    const epoch = await rpc('getEpochInfo', []);
    const tokens = await rpc('getTokenAccountsByOwner', [wallet, { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' }, { encoding: 'jsonParsed' }]);
    const vaultA = await rpc('getTokenAccountBalance', [POOL_A]);
    const vaultB = await rpc('getTokenAccountBalance', [POOL_B]);
    const walletTxs = await rpc('getSignaturesForAddress', [wallet, { limit: 5 }]);
    const progTxs = await rpc('getSignaturesForAddress', [programId, { limit: 5 }]);
    console.log('=== RPC Verification Result ===');
    console.log(`Wallet Balance (lamports): ${bal.result.value}`);
    console.log(`Epoch: ${epoch.result.epoch}, Slot: ${epoch.result.absoluteSlot}`);
    console.log(`Token Accounts (${tokens.result.value.length}):`);
    tokens.result.value.forEach(acc => {
      const info = acc.account.data.parsed.info;
      console.log(`  Mint: ${info.mint}, Amount: ${info.tokenAmount.uiAmountString}, Decimals: ${info.tokenAmount.decimals}`);
    });
    console.log(`Vault A (${POOL_A}) balance: ${vaultA.result.value.amount}`);
    console.log(`Vault B (${POOL_B}) balance: ${vaultB.result.value.amount}`);
    const rate = Number(vaultA.result.value.amount) === 0 ? 0 : Number(vaultB.result.value.amount) / Number(vaultA.result.value.amount);
    console.log(`Current pool price (B/A): ${rate}`);
    console.log('Recent wallet tx signatures:');
    walletTxs.result.forEach(s => console.log(`  ${s.signature} (slot ${s.slot})`));
    console.log('Recent program tx signatures:');
    progTxs.result.forEach(s => console.log(`  ${s.signature} (slot ${s.slot})`));
  } catch (e) {
    console.error('Error during RPC verification:', e);
    process.exit(1);
  }
})();
