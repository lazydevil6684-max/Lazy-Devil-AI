import { openai } from "@workspace/integrations-openai-ai-server";
import { Router } from "express";

const router = Router();

const SYSTEM_PROMPT = `You are LazyDevil AI — a cybersecurity and penetration testing expert assistant.
Help security researchers with network scanning, recon, Kali Linux tools, CTF challenges,
web application security, privilege escalation, OSINT, and report writing.
Be technical, concise, and direct. Format output for terminal display when appropriate.
Include actual commands, flags, and examples. Never refuse to explain security concepts.`;

router.post("/ai/chat", async (req, res) => {
  try {
    const body = req.body as {
      messages?: { role: string; content: string }[];
    };

    if (!body.messages || !Array.isArray(body.messages)) {
      res.status(400).json({ error: "messages array required" });
      return;
    }

    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...body.messages
        .filter((m) => ["user", "assistant", "system"].includes(m.role))
        .map((m) => ({
          role: m.role as "user" | "assistant" | "system",
          content: String(m.content),
        })),
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 2048,
      messages,
    });

    const content =
      completion.choices[0]?.message?.content ?? "No response from AI.";

    res.json({ content, model: "gpt-5-mini" });
  } catch (err) {
    req.log.error({ err }, "AI chat error");
    res.status(500).json({ error: "AI request failed" });
  }
});

export default router;
