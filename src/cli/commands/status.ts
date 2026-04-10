import { execa } from "execa";
import fetch from "node-fetch";
import {
  dockerComposeEnvArgs,
  getInfraPath,
  loadProjectDotenv,
} from "../project-env.js";

interface RpcResponse {
  jsonrpc: string;
  id: number;
  result?: string;
  error?: unknown;
}

export const status = async () => {
  loadProjectDotenv();

  const infraPath = getInfraPath();
  const rpcUrl =
    process.env.RSK_RPC_URL_PUBLIC?.trim() || "http://127.0.0.1:4444";

  console.log("Checking RelayDevKit status...\n");

  try {
    const { stdout } = await execa("docker", ["compose", ...dockerComposeEnvArgs(), "ps"], {
      cwd: infraPath,
    });

    console.log("Containers:\n");
    console.log(stdout);

    try {
      const res = await fetch(rpcUrl.replace(/\/?$/, "/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_blockNumber",
          params: [],
          id: 1,
        }),
      });

      const data = (await res.json()) as RpcResponse;

      if (data.result) {
        console.log("\nRPC: Connected");
        console.log(`Endpoint: ${rpcUrl}`);
        console.log(`Block number: ${data.result}`);
      } else {
        console.log("\nRPC: No response");
      }
    } catch {
      console.log(`\nRPC: Not reachable (${rpcUrl})`);
    }
  } catch {
    console.log("Docker is not running or project not initialized");
  }
};
