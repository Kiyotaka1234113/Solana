// capstone/verify_capstone.js
// Simple verification script for the SolFlow capstone server
// Runs the server, performs basic endpoint checks, then shuts it down.

const { spawn } = require('child_process');
const path = require('path');

// Resolve server path relative to this script
const serverPath = path.join(__dirname, 'server.js');

// Start the server as a detached child process
const server = spawn('node', [serverPath], {
  cwd: __dirname,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let stdout = '';
let stderr = '';
server.stdout.on('data', data => { stdout += data.toString(); });
server.stderr.on('data', data => { stderr += data.toString(); });

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  // Wait a moment for the server to start listening
  await sleep(3000);
  const baseUrl = 'http://localhost:3000';

  // Helper for POST requests using fetch (Node >=18)
  async function post(endpoint, body) {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    return { status: res.status, json };
  }

  // 1. AI/ML risk score
  const risk = await post('/api/ml-score', { amountIn: 1000000, aToB: true });
  console.log('🧠 ML risk score response:', risk);

  // 2. RPC proxy – get token accounts for the demo wallet and mUSDC mint
  const rpc = await post('/rpc', {
    owner: 'F8VD2NvjMKSSDqRSDpTYzL2wrVyeDzt3zEDweSqmQqcM',
    mint: 'BZQCLuDX5y9FW5Fd71LjMpTUNHcvK4P2ASgwgyYYPtN7',
  });
  console.log('🔗 RPC proxy response (token accounts):', rpc);

  // 3. Routed swap (small amount)
  const swap = await post('/api/routed-swap', { amountIn: 500000, aToB: true });
  console.log('🔁 Routed swap response:', swap);

  // 4. Create invoice
  const invoice = await post('/api/create-invoice', { invoiceId: Math.floor(Date.now() / 1000), amount: 1000000 });
  console.log('📄 Create invoice response:', invoice);

  // Summarize
  console.log('\n=== Verification Summary ===');
  console.log('ML risk score status:', risk.status);
  console.log('RPC proxy status:', rpc.status);
  console.log('Routed swap status:', swap.status);
  console.log('Create invoice status:', invoice.status);

  // Gracefully stop the server
  server.kill('SIGINT');
}

runTests().catch(err => {
  console.error('Verification error:', err);
  server.kill('SIGINT');
});
