import { spawnSync } from "node:child_process";

const configuredDeployment = process.env.PLAYWRIGHT_BASE_URL
  ?? "https://takfornyelse-staging.vercel.app";
const deploymentUrl = new URL(configuredDeployment);
if (deploymentUrl.protocol !== "https:" || !deploymentUrl.hostname.endsWith(".vercel.app")) {
  throw new Error("Preview smoke only accepts an HTTPS vercel.app deployment URL");
}
const deployment = deploymentUrl.origin;
const vercelArgs = ["vercel", "curl", "/no", "--deployment", deployment, "--", "--head"];
const command = process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : "npx";
const args = process.platform === "win32"
  ? ["/d", "/s", "/c", `npx ${vercelArgs.join(" ")}`]
  : vercelArgs;
const result = spawnSync(
  command,
  args,
  { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
);
const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;

if (result.status !== 0 || !/HTTP\/\d(?:\.\d)? 200 OK/i.test(output)) {
  process.stderr.write(output);
  if (result.error) process.stderr.write(`\n${result.error.message}\n`);
  throw new Error("Protected Preview smoke did not return HTTP 200");
}

console.log(`Protected Preview authorised smoke: PASS (${deployment}/no)`);
