const { URL } = require("node:url");
const { ethers } = require("ethers");

const RSK_REGTEST_CHAIN_ID = 33;
const RPC_WAIT_TIMEOUT_MS = 5 * 60 * 1000;
const POST_RPC_READY_DELAY_MS = 3000;
const RETRY_ATTEMPTS = 5;
const RETRY_DELAY_MS = 2000;
const POLL_MS = 2000;
const WAIT_LOG_INTERVAL_MS = 30000;

/**
 * rsk-dev.json genesis allocates RBTC to 0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826.
 * This is the standard pyethereum demo key (regtest / local dev only).
 */
const DEFAULT_FAUCET_PRIVATE_KEY =
  "0xc85ef7d79691fe79573b1a7064c19c1a9819ebdbd1faaab1a8ec92344438aaf4";

const rawRpc = process.env.RSK_RPC_URL || "http://rootstock-node:4444";
/** Origin without trailing slash (for logs / ethers). */
const RPC_ORIGIN = rawRpc.replace(/\/+$/, "");
/**
 * RSKj examples use POST to `http://host:4444/` — explicit `/` avoids clients sending
 * a malformed path that returns HTTP 400.
 */
const RPC_HTTP_URL = `${RPC_ORIGIN}/`;

/**
 * RSKj only allows Host localhost / 127.0.0.1 / ::1. Docker DNS uses the service name
 * as Host, which returns HTTP 400 unless we override.
 */
function rskVirtualHostHeader() {
  const override = process.env.RSK_RPC_HOST_HEADER?.trim();
  if (override) {
    return override;
  }
  const u = new URL(RPC_HTTP_URL);
  const port = u.port || (u.protocol === "https:" ? "443" : "80");
  return `127.0.0.1:${port}`;
}

const RSK_HOST_HEADER = rskVirtualHostHeader();

const managerKey = process.env.MANAGER_PRIVATE_KEY;
const workerKey = process.env.WORKER_PRIVATE_KEY;

if (!managerKey?.trim() || !workerKey?.trim()) {
  console.error(
    "Missing MANAGER_PRIVATE_KEY or WORKER_PRIVATE_KEY. Copy .env-example to .env and set both keys."
  );
  process.exit(1);
}

const connection = new ethers.FetchRequest(RPC_HTTP_URL);
connection.setHeader("accept-encoding", "identity");
connection.setHeader("Host", RSK_HOST_HEADER);

const provider = new ethers.JsonRpcProvider(
  connection,
  RSK_REGTEST_CHAIN_ID,
  { staticNetwork: true, batchMaxCount: 1 }
);

const faucetKey =
  process.env.FAUCET_PRIVATE_KEY?.trim() || DEFAULT_FAUCET_PRIVATE_KEY;
const faucet = new ethers.Wallet(faucetKey, provider);

const accounts = [
  { role: "manager", privateKey: managerKey.trim() },
  { role: "worker", privateKey: workerKey.trim() },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Poll eth_getTransactionReceipt via the same JsonRpcProvider (custom Host header).
 * Raw JSON-RPC result avoids ethers high-level receipt / block parsing; RSK can omit
 * full ECDSA fields on txs, which breaks tx.wait() / some block walks.
 */
async function waitForReceipt(txHash, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const receipt = await provider.send("eth_getTransactionReceipt", [txHash]);
    if (receipt && receipt.blockNumber) {
      return receipt;
    }
    await sleep(2000);
  }
  throw new Error("Timed out waiting for transaction receipt");
}

async function waitForJsonRpc(timeoutMs = RPC_WAIT_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  let nextLogAt = 0;
  let loggedFirst = false;

  while (Date.now() < deadline) {
    try {
      const block = await provider.getBlockNumber();
      console.log(`RPC ready (block ${block})`);
      return;
    } catch (err) {
      const now = Date.now();
      const msg = err?.message || String(err);
      if (!loggedFirst) {
        console.log("Waiting for JSON-RPC (node may still be starting)…");
        loggedFirst = true;
        nextLogAt = now + WAIT_LOG_INTERVAL_MS;
      } else if (now >= nextLogAt) {
        console.log(`Still waiting for JSON-RPC: ${msg}`);
        nextLogAt = now + WAIT_LOG_INTERVAL_MS;
      }
    }
    await sleep(POLL_MS);
  }

  throw new Error("Timed out waiting for JSON-RPC");
}

async function sendWithRetry(fn, retries = RETRY_ATTEMPTS) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      console.log(`Retry ${i + 1}/${retries} after error: ${err?.message || err}`);
      await sleep(RETRY_DELAY_MS);
    }
  }
  throw lastErr;
}

async function main() {
  console.log("Initializing accounts...");
  console.log(`   RPC: ${RPC_HTTP_URL.replace(/\/\/.*@/, "//***@")}`);
  console.log(`   Faucet: ${faucet.address}`);

  await waitForJsonRpc();
  await sleep(POST_RPC_READY_DELAY_MS);

  for (const acc of accounts) {
    const wallet = new ethers.Wallet(acc.privateKey, provider);

    await sendWithRetry(async () => {
      const tx = await faucet.sendTransaction({
        to: wallet.address,
        value: ethers.parseEther("10"),
      });
      await waitForReceipt(tx.hash);
    });

    console.log(`Funded ${acc.role}: ${wallet.address}`);
  }

  console.log("Initialization complete");
}

main().catch(console.error);
