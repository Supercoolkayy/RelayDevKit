import { execa } from "execa";
import { dockerComposeEnvArgs, getInfraPath } from "../project-env.js";

export const down = async () => {
  const infraPath = getInfraPath();

  console.log("Shutting down RelayDevKit...");

  await execa("docker", ["compose", ...dockerComposeEnvArgs(), "down", "-v"], {
    cwd: infraPath,
    stdio: "inherit",
  });

  console.log("Cleanup complete");
};
