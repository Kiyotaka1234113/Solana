// capstone/server.js
const http = require('http');
const url = require('url');
const { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction } = require('@solana/web3.js');
const { getTokenAccountBalance, getAccount, getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const crypto = require("crypto");
const fs = require('fs');

const PORT = 3000;
const DEVNET_URL = 'https://api.devnet.solana.com';
const connection = new Connection(DEVNET_URL, 'confirmed');
const DEVNET_KEYPAIR_PATH = 'C:\\Users\\janto\\OneDrive\\Рабочий стол\\Solana 3\\devnet-keypair.json';
const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(DEVNET_KEYPAIR_PATH, 'utf-8'))));

// Program IDs (already deployed)
const DEFIB_SWAP_PID = new PublicKey('9tXLf1ZEbjycpb3E2vcBqbfe6DAnLYuxpWjtYBDaLZtM');
const COMPOSABLE_ROUTER_PID = new PublicKey('9t56Ysmdii2T2fk6cnXihjW5Q1k7WCCspD7wsMFQzrB4');
const SECURITY_VAULT_PID = new PublicKey('CnBm8DNdWJ5WfTj92czXWm9PHad8fseYeWgBZ3535qkP');
const STABLECOIN_PAY_PID = new PublicKey('8xSmfQW68bK4GzSfMk2iELyyVuPzdWEokpBHKCtrYjd9');

// Helper: read request body
function getRequestBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', err => reject(err));
  });
}

// AI/ML Risk scoring (simplified logistic function)
function computeRisk({ amountIn, aToB, reserveA, reserveB }) {
  const fee = 0.003; // 0.30%
  // expected out using constant product AMM
  const amountInNum = Number(amountIn);
  const reserveIn = aToB ? reserveA : reserveB;
  const reserveOut = aToB ? reserveB : reserveA;
  const amountOut = (amountInNum * reserveOut) / (reserveIn + amountInNum);
  const expectedOut = Math.floor(amountOut * (1 - fee));
  const spotPrice = Number(reserveOut) / Number(reserveIn);
    const executionPrice = Number(expectedOut) / Number(amountIn);
    const priceImpactPct = Math.max(0, (1 - executionPrice / spotPrice) * 100);
  const liquidityUtilPct = (amountInNum / reserveIn) * 100;
  const poolImbalanceRatio = reserveA / reserveB;
  // Logistic risk score (calibrated)
  const imbalanceDev = Math.abs(poolImbalanceRatio - 1);
  const z = -2.2 + 0.30 * priceImpactPct + 0.20 * liquidityUtilPct + 1.5 * imbalanceDev;
  const riskScore = Math.round(100 / (1 + Math.exp(-z)));
  const verdict = riskScore < 35 ? 'LOW' : riskScore < 65 ? 'MEDIUM' : 'HIGH';
  return { expectedOut, priceImpactPct, liquidityUtilPct, poolImbalanceRatio, riskScore, verdict };
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  // CORS headers for simplicity
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  if (req.method === 'GET' && parsedUrl.pathname === '/') {
    // serve index.html
    const indexPath = __dirname + '/index.html';
    fs.readFile(indexPath, (err, data) => {
      if (err) { res.writeHead(500); res.end('Missing index.html'); }
      else { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(data); }
    });
    return;
  }

  if (req.method === 'POST' && parsedUrl.pathname === '/rpc') {
    try {
      const body = JSON.parse(await getRequestBody(req));
      const { owner, mint } = body; // expecting both as base58 strings
      const accounts = await connection.getTokenAccountsByOwner(new PublicKey(owner), { programId: TOKEN_PROGRAM_ID, mint: new PublicKey(mint), encoding: 'jsonParsed' });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(accounts));
    } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  if (req.method === 'POST' && parsedUrl.pathname === '/api/ml-score') {
    try {
      const { amountIn, aToB } = JSON.parse(await getRequestBody(req));
      // Read on‑chain vault token balances (spl token accounts)
      const vaultAPda = new PublicKey('BESX1w1g9doqwXP6rPpyDFk5v8V4b7sD72bLCSurfM4F');
      const vaultBPda = new PublicKey('H3RQb293vviJsYmfbvjJGxe1DNpUaz88qnNdkMSJgkcp');
      const balAInfo = await connection.getTokenAccountBalance(vaultAPda);
      const balBInfo = await connection.getTokenAccountBalance(vaultBPda);
      const reserveA = Number(balAInfo.value.amount);
      const reserveB = Number(balBInfo.value.amount);
      const result = computeRisk({ amountIn: Number(amountIn), aToB, reserveA, reserveB });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  if (req.method === 'POST' && parsedUrl.pathname === '/api/routed-swap') {
    try {
      const { amountIn, aToB } = JSON.parse(await getRequestBody(req));
      const memoText = 'Capstone routed swap';
      const memoBytes = Buffer.from(memoText, 'utf-8');
      const data = Buffer.alloc(8 + 8 + 8 + 1 + 4 + memoBytes.length);
      // discriminator for execute_routed_swap
      const crypto = require('crypto');
      crypto.createHash('sha256').update('global:execute_routed_swap').digest().subarray(0, 8).copy(data, 0);
      data.writeBigUInt64LE(BigInt(amountIn), 8);
      data.writeBigUInt64LE(1n, 16); // min_out placeholder
      data.writeUInt8(aToB ? 1 : 0, 24);
      data.writeUInt32LE(memoBytes.length, 25);
      memoBytes.copy(data, 29);

      // Derive pool & vault PDAs (same as earlier)
      const POOL_PDA = new PublicKey('BqAKfyF2K61DxvfBLMi9WPjYuem6Ni53YMPm2j11bbvE');
      const USER_ATA_A = await getOrCreateAssociatedTokenAccount(connection, payer, new PublicKey('6frqPxC5jtzSk1P3eS6xqFvTq6yY5b2ujDwtw5w2g6A1'), payer.publicKey);
      const USER_ATA_B = await getOrCreateAssociatedTokenAccount(connection, payer, new PublicKey('3bgrYo7V5QzKiWHuwZuEnUrLpaoXaPR3FdKZR65gXKeF'), payer.publicKey);
      const VAULT_A = new PublicKey('BESX1w1g9doqwXP6rPpyDFk5v8V4b7sD72bLCSurfM4F');
      const VAULT_B = new PublicKey('H3RQb293vviJsYmfbvjJGxe1DNpUaz88qnNdkMSJgkcp');

      const ix = new TransactionInstruction({
        programId: COMPOSABLE_ROUTER_PID,
        keys: [
          { pubkey: POOL_PDA, isSigner: false, isWritable: false },
          { pubkey: payer.publicKey, isSigner: true, isWritable: false },
          { pubkey: USER_ATA_A.address, isSigner: false, isWritable: true },
          { pubkey: USER_ATA_B.address, isSigner: false, isWritable: true },
          { pubkey: VAULT_A, isSigner: false, isWritable: true },
          { pubkey: VAULT_B, isSigner: false, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: DEFIB_SWAP_PID, isSigner: false, isWritable: false },
          { pubkey: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'), isSigner: false, isWritable: false },
        ],
        data,
      });

      const tx = new Transaction().add(ix);
      const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
      const txInfo = await connection.getTransaction(sig, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
      const logs = txInfo?.meta?.logMessages || [];
      const beforeA = (await connection.getTokenAccountBalance(USER_ATA_A.address)).value.amount;
      const beforeB = (await connection.getTokenAccountBalance(USER_ATA_B.address)).value.amount;
      const afterA = (await connection.getTokenAccountBalance(USER_ATA_A.address)).value.amount;
      const afterB = (await connection.getTokenAccountBalance(USER_ATA_B.address)).value.amount;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ signature: sig, explorerUrl: `https://explorer.solana.com/tx/${sig}?cluster=devnet`, beforeA, afterA, beforeB, afterB, logs }));
    } catch (e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  if (req.method === 'POST' && parsedUrl.pathname === '/api/create-invoice') {
    try {
      const { invoiceId, amount } = JSON.parse(await getRequestBody(req)); // amount in mUSDC lamports
      const merchant = payer; // devnet keypair acts as merchant
      const mint = new PublicKey('BZQCLuDX5y9FW5Fd71LjMpTUNHcvK4P2ASgwgyYYPtN7');
      const [invoicePda] = await PublicKey.findProgramAddress([
        Buffer.from('invoice'),
        merchant.publicKey.toBuffer(),
        Buffer.alloc(8, 0), // placeholder, will be overwritten below
      ], STABLECOIN_PAY_PID);
      // Compute correct PDA with proper invoice_id bytes
      const invoiceIdBuf = Buffer.alloc(8);
      invoiceIdBuf.writeBigUInt64LE(BigInt(invoiceId));
      const [finalPda] = await PublicKey.findProgramAddress([
        Buffer.from('invoice'),
        merchant.publicKey.toBuffer(),
        invoiceIdBuf,
      ], STABLECOIN_PAY_PID);

      const data = Buffer.alloc(8 + 8 + 8);
      crypto.createHash('sha256').update('global:create_invoice').digest().subarray(0, 8).copy(data, 0);
      data.writeBigUInt64LE(BigInt(invoiceId), 8);
      data.writeBigUInt64LE(BigInt(amount), 16);

      const ix = new TransactionInstruction({
        programId: STABLECOIN_PAY_PID,
        keys: [
          { pubkey: merchant.publicKey, isSigner: true, isWritable: true },
          { pubkey: mint, isSigner: false, isWritable: false },
          { pubkey: finalPda, isSigner: false, isWritable: true },
          { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false }, // system program placeholder
        ],
        data,
      });
      const tx = new Transaction().add(ix);
      const sig = await sendAndConfirmTransaction(connection, tx, [merchant]);
      const uri = `solana:${merchant.publicKey.toBase58()}?amount=${Number(amount)/1e6}&spl-token=${mint.toBase58()}&reference=${finalPda.toBase58()}&label=SolFlow%20Invoice&message=Invoice%20%23${invoiceId}`;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ signature: sig, explorerUrl: `https://explorer.solana.com/tx/${sig}?cluster=devnet`, invoicePda: finalPda.toBase58(), solanaPayUri: uri }));
    } catch (e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // Not found
  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`SolFlow capstone server listening on http://localhost:${PORT}`);
});
