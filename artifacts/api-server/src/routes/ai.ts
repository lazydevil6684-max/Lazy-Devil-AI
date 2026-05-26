import { openai } from "@workspace/integrations-openai-ai-server";
import { Router } from "express";

const router = Router();

const DEFAULT_SYSTEM_PROMPT = `You are LazyDevil AI — an elite cybersecurity and penetration testing expert assistant.
Help security researchers with network scanning, recon, Kali Linux tools, CTF challenges,
web application security, Active Directory attacks, privilege escalation, wireless attacks,
USB HID attacks, Rubber Ducky payloads, password cracking, and OSINT.

Be technical, concise, and direct. Format code in triple backtick blocks with language specified.
Always include actual commands, flags, and examples.
After answering, suggest 2-3 logical next steps as "NEXT: command" on separate lines.`;

const DUCK_PROMPT = `You are a Rubber Duck Debugger — a patient, non-judgmental assistant helping the user
work through their security problem or idea by asking clarifying questions and reflecting their thoughts.
Listen carefully. Ask "What have you tried?", "What do you expect?", "What actually happens?".
Help them discover the answer themselves. When you identify the issue, explain it clearly and suggest a fix.`;

router.post("/ai/chat", async (req, res) => {
  try {
    const body = req.body as {
      messages?: { role: string; content: string }[];
      systemPrompt?: string;
    };

    if (!body.messages || !Array.isArray(body.messages)) {
      res.status(400).json({ error: "messages array required" });
      return;
    }

    const sysPrompt = body.systemPrompt || DEFAULT_SYSTEM_PROMPT;

    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: sysPrompt },
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

router.post("/ai/suggest", async (req, res) => {
  try {
    const body = req.body as { command?: string; output?: string };
    if (!body.command) {
      res.status(400).json({ error: "command required" });
      return;
    }

    const prompt = `A security researcher just ran: ${body.command}\n${body.output ? `Output: ${body.output.slice(0,500)}` : ""}\n\nSuggest exactly 3 follow-up commands as a JSON array of strings. Only the commands, no explanation.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 256,
      messages: [
        { role: "system", content: "You are a penetration testing assistant. Return only a JSON array of 3 follow-up command strings." },
        { role: "user", content: prompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "[]";
    let suggestions: string[] = [];
    try {
      suggestions = JSON.parse(raw.match(/\[[\s\S]*\]/)?.[0] ?? "[]");
    } catch {
      suggestions = [];
    }

    res.json({ suggestions });
  } catch (err) {
    req.log.error({ err }, "AI suggest error");
    res.status(500).json({ suggestions: [] });
  }
});

export default router;
