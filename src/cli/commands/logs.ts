import { execa } from "execa";
import { dockerComposeEnvArgs, getInfraPath } from "../project-env.js";

export const logs = async () => {
  const infraPath = getInfraPath();

  console.log("Streaming logs...\n");

  await execa("docker", ["compose", ...dockerComposeEnvArgs(), "logs", "-f"], {
    cwd: infraPath,
    stdio: "inherit",
  });
};
