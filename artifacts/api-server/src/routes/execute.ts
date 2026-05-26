import { exec } from "child_process";
import { Router } from "express";

const router = Router();

const BANNED_PATTERNS = [
  /rm\s+-rf\s+\//,
  /mkfs/,
  /dd\s+if=.*of=\/dev\/(sd|hd|nvme|disk)/,
  /:(){ :|:& };:/,
  /chmod\s+777\s+\//,
  /curl.*\|\s*bash/,
  /wget.*\|\s*sh/,
];

function sanitize(cmd: string): { ok: boolean; reason?: string } {
  for (const pat of BANNED_PATTERNS) {
    if (pat.test(cmd)) return { ok: false, reason: "Destructive command blocked" };
  }
  return { ok: true };
}

router.post("/execute", (req, res) => {
  const body = req.body as { command?: string; timeout?: number };
  const command = (body.command ?? "").trim();

  if (!command) {
    res.status(400).json({ error: "command required" });
    return;
  }

  const check = sanitize(command);
  if (!check.ok) {
    res.status(403).json({ error: check.reason, stdout: "", stderr: check.reason ?? "", exitCode: 1 });
    return;
  }

  const timeoutMs = Math.min(body.timeout ?? 10000, 30000);
  const start = Date.now();

  req.log.info({ command }, "Execute command");

  exec(command, {
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024,
    shell: "/bin/bash",
    env: { ...process.env, PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" },
  }, (err, stdout, stderr) => {
    const elapsed = Date.now() - start;
    const exitCode = (err as NodeJS.ErrnoException & { code?: number })?.code ?? 0;
    res.json({
      stdout: stdout.slice(0, 50000),
      stderr: stderr.slice(0, 10000),
      exitCode,
      elapsed,
      command,
    });
  });
});

export default router;
