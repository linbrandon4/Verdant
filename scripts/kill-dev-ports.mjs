import { execSync } from "node:child_process";

const ports = [5173, 5174, 5175];

for (const port of ports) {
  try {
    const out = execSync(`lsof -ti :${port}`, { encoding: "utf8" }).trim();
    if (!out) continue;
    for (const pid of out.split("\n")) {
      if (pid) process.kill(Number(pid), "SIGKILL");
    }
    console.log(`Cleared port ${port}`);
  } catch {
    // port already free
  }
}
