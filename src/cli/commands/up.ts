import { execa } from "execa";
import {
  dockerComposeEnvArgs,
  getInfraPath,
  resolveProjectDotenvPath,
} from "../project-env.js";

export const up = async () => {
  console.log("Starting RelayDevKit...");
  const infraPath = getInfraPath();
  if (!resolveProjectDotenvPath()) {
    console.warn(
      "No .env found (searched from cwd upward); copy .env-example to .env and set keys."
    );
  }

  const composeArgs = ["compose", ...dockerComposeEnvArgs(), "up", "-d"];

  try {
    await execa("docker", composeArgs, {
      cwd: infraPath,
      stdio: "inherit",
    });

    console.log("Waiting for services...");
    console.log("RelayDevKit is up");
  } catch (err) {
    console.error("Failed to start:", err);
  }
};
