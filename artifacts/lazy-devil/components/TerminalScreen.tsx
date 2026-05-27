import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";

const AGENT_SYSTEM = `You are an autonomous penetration testing agent operating at a real Linux terminal.
You have access to real command execution. Your job: complete the user's security task by running commands one at a time.

Rules:
1. ALWAYS respond with EXACTLY this format:
   THOUGHT: <one line — what you're doing and why>
   CMD: <single shell command to execute>
   
2. When the task is fully complete, respond:
   THOUGHT: Task complete.
   CMD: DONE

3. Keep commands simple and non-destructive by default.
4. Use output from previous commands to inform the next step.
5. Be aggressive and thorough — enumerate deeply, chain exploits logically.
6. If a tool isn't found, try an alternative.`;

interface TLine { id: string; type: string; content: string; timestamp: number; }

function TermLine({ line }: { line: TLine }) {
  const color =
    line.type === "command"  ? "#ff3333"
    : line.type === "error"  ? "#ff5555"
    : line.type === "success"? "#44ff44"
    : line.type === "info"   ? "#aaaaaa"
    : line.type === "agent"  ? "#cc44ff"
    : line.type === "thought"? "#ffaa00"
    : "#cc6600";

  return (
    <Text
      style={{ color, fontFamily: "monospace", fontSize: 12, lineHeight: 18, paddingHorizontal: 8 }}
      selectable
    >
      {line.type === "command" ? `# ${line.content}` : line.content}
    </Text>
  );
}

const HELP = `LAZY DEVIL TERMINAL v2.1 — AUTONOMOUS AI AGENT
══════════════════════════════════════════════════
COMMANDS
  <any shell>         Real execution (backend/Termux)
  agent <goal>        AI runs tests autonomously until done
  ai <question>       Quick AI question → switch to AI tab
  clear               Clear terminal
  banner              Show banner
  history             Show command history
  cd <path>           Change directory

AGENT EXAMPLES
  agent scan 192.168.1.1 for vulnerabilities
  agent enumerate http://example.com and find all dirs
  agent crack the hash 5f4dcc3b5aa765d61d8327deb882cf99
  agent find all live hosts on 192.168.1.0/24

KEYS
  ↑ ↓       Command history navigation
  🤖 btn    Run current input as agent task
  🎙 btn    Voice input (web)`;

export default function TerminalScreen() {
  const insets = useSafeAreaInsets();
  const {
    terminalLines, addTerminalLine, clearTerminal,
    currentPath, setCurrentPath,
    setActiveScreen, addAiMessage,
    commandHistory, addToHistory, clearHistory,
    setExecuteCommandFromAI,
    execMode, backendUrl, execCommand,
    isAiLoading, setIsAiLoading,
  } = useApp();

  const [input, setInput] = useState("");
  const [histIdx, setHistIdx] = useState(-1);
  const [isListening, setIsListening] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [agentRunning, setAgentRunning] = useState(false);
  const agentStopRef = useRef(false);
  const flatRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const recognitionRef = useRef<any>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 60);
  }, []);

  useEffect(() => { scrollToBottom(); }, [terminalLines.length]);

  useEffect(() => {
    setExecuteCommandFromAI(() => (cmd: string) => {
      setActiveScreen("terminal");
      runCommand(cmd);
    });
    return () => setExecuteCommandFromAI(null);
  }, []);

  const navigateHistory = (dir: "up" | "down") => {
    if (!commandHistory.length) return;
    Haptics.selectionAsync();
    if (dir === "up") {
      const idx = Math.min(histIdx + 1, commandHistory.length - 1);
      setHistIdx(idx);
      setInput(commandHistory[idx] ?? "");
    } else {
      const idx = Math.max(histIdx - 1, -1);
      setHistIdx(idx);
      setInput(idx === -1 ? "" : (commandHistory[idx] ?? ""));
    }
  };

  const startVoice = () => {
    if (Platform.OS !== "web") { addTerminalLine({ type: "info", content: "[~] Voice on web only" }); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { addTerminalLine({ type: "error", content: "[!] Voice not supported" }); return; }
    const rec = new SR(); rec.lang = "en-US";
    recognitionRef.current = rec;
    setIsListening(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    rec.onresult = (e: any) => { setInput(e.results[0]?.[0]?.transcript ?? ""); setIsListening(false); };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);
    rec.start();
  };

  const realExec = useCallback(async (cmd: string, quiet = false): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
    if (!quiet) addTerminalLine({ type: "info", content: `[${execMode}] ${cmd.length > 80 ? cmd.slice(0,80)+"…" : cmd}` });
    setIsRunning(true);
    const result = await execCommand(cmd);
    setIsRunning(false);
    if (!quiet) {
      const out = ((result.stdout || "") + (result.stderr || "")).trim();
      if (out) {
        out.split("\n").slice(0, 200).forEach(l => {
          if (l.trim()) addTerminalLine({ type: result.exitCode === 0 ? "output" : "error", content: l });
        });
        if (out.split("\n").length > 200) addTerminalLine({ type: "info", content: `[… ${out.split("\n").length - 200} more lines truncated]` });
      } else if (result.exitCode === 0) {
        addTerminalLine({ type: "success", content: `[+] Done` });
      }
    }
    return result;
  }, [execMode, execCommand, addTerminalLine]);

  // ─── AUTONOMOUS AI AGENT LOOP ─────────────────────────────────────────────
  const runAgent = useCallback(async (task: string) => {
    if (agentRunning) return;
    agentStopRef.current = false;
    setAgentRunning(true);
    setIsAiLoading(true);

    addTerminalLine({ type: "agent", content: `╔══════════════════════════════════════════` });
    addTerminalLine({ type: "agent", content: `║ 🤖 AGENT STARTED` });
    addTerminalLine({ type: "agent", content: `║ Task: ${task}` });
    addTerminalLine({ type: "agent", content: `║ Execution: ${execMode.toUpperCase()}` });
    addTerminalLine({ type: "agent", content: `╚══════════════════════════════════════════` });

    const conversation: { role: "user" | "assistant"; content: string }[] = [
      { role: "user", content: `Task: ${task}\n\nStart now. Reply with THOUGHT and CMD.` },
    ];

    let iteration = 0;
    const MAX_ITER = 20;
    let sessionContext = `Task: ${task}\n\nExecution log:\n`;

    while (iteration < MAX_ITER && !agentStopRef.current) {
      iteration++;
      addTerminalLine({ type: "agent", content: `─── Step ${iteration}/${MAX_ITER} ───────────────────────` });

      // Ask AI for next command
      try {
        const resp = await fetch(`${backendUrl}/api/ai/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: conversation,
            systemPrompt: AGENT_SYSTEM,
          }),
        });
        if (!resp.ok) throw new Error(`AI API error: ${resp.status}`);
        const data = await resp.json();
        const reply = (data?.content ?? "").trim();

        // Parse THOUGHT and CMD
        const thoughtMatch = reply.match(/THOUGHT:\s*(.+)/);
        const cmdMatch = reply.match(/CMD:\s*(.+)/s);
        const thought = thoughtMatch?.[1]?.trim() ?? reply.slice(0, 120);
        const cmd = cmdMatch?.[1]?.trim() ?? "";

        if (thought) addTerminalLine({ type: "thought", content: `💭 ${thought}` });

        if (!cmd || cmd === "DONE") {
          addTerminalLine({ type: "success", content: "✓ Agent task complete." });
          break;
        }

        // Execute the command
        addTerminalLine({ type: "command", content: cmd });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const execResult = await realExec(cmd, true);

        const rawOut = ((execResult.stdout || "") + (execResult.stderr || "")).trim();
        const outLines = rawOut.split("\n").slice(0, 80);
        outLines.forEach(l => {
          if (l.trim()) addTerminalLine({ type: execResult.exitCode === 0 ? "output" : "error", content: l });
        });
        if (rawOut.split("\n").length > 80) {
          addTerminalLine({ type: "info", content: `[… ${rawOut.split("\n").length - 80} more lines]` });
        }
        if (!rawOut) addTerminalLine({ type: "info", content: "[no output]" });

        // Feed result back to AI
        const summary = rawOut.slice(0, 2000) || "[no output]";
        sessionContext += `\n$ ${cmd}\n${summary}\n`;
        conversation.push({ role: "assistant", content: reply });
        conversation.push({
          role: "user",
          content: `Command output (exit code ${execResult.exitCode}):\n\`\`\`\n${summary}\n\`\`\`\n\nContinue. What is the next step? Reply with THOUGHT and CMD, or CMD: DONE if finished.`,
        });

        // Keep conversation manageable
        if (conversation.length > 24) {
          conversation.splice(1, 2); // remove oldest assistant+user pair
        }

      } catch (err: any) {
        addTerminalLine({ type: "error", content: `[!] Agent error: ${err?.message ?? "Unknown"}` });
        await new Promise(r => setTimeout(r, 2000));
      }

      if (agentStopRef.current) break;
      // Small pause between steps
      await new Promise(r => setTimeout(r, 300));
    }

    if (iteration >= MAX_ITER) {
      addTerminalLine({ type: "info", content: `[~] Agent hit ${MAX_ITER}-step limit. Type 'agent <continue>' to resume.` });
    }

    addTerminalLine({ type: "agent", content: `╔══════════════════════════════════════════` });
    addTerminalLine({ type: "agent", content: `║ 🤖 AGENT STOPPED — ${iteration} steps` });
    addTerminalLine({ type: "agent", content: `╚══════════════════════════════════════════` });

    setAgentRunning(false);
    setIsAiLoading(false);
  }, [agentRunning, execMode, backendUrl, realExec, addTerminalLine, setIsAiLoading]);

  const stopAgent = () => {
    agentStopRef.current = true;
    addTerminalLine({ type: "info", content: "[~] Stopping agent after current command..." });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const runCommand = useCallback(async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addToHistory(trimmed);
    setHistIdx(-1);
    addTerminalLine({ type: "command", content: trimmed });
    const parts = trimmed.split(/\s+/);

    switch (parts[0].toLowerCase()) {
      case "clear":  clearTerminal(); break;

      case "help":
        HELP.split("\n").forEach(l => addTerminalLine({ type: "output", content: l }));
        break;

      case "banner":
        [" _                        ____             _ _ ",
         "| |    __ _ _____   _   |  _ \\  _____   _(_) |",
         "| |   / _` |_  / | | |  | | | |/ _ \\ \\ / / | |",
         "| |__| (_| |/ /| |_| |  | |_| |  __/\\ V /| | |",
         "|_____\\__,_/___|\\__, |  |____/ \\___| \\_/ |_|_|",
         "                |___/  v2.1 · Real Exec · AI Agent"].forEach(l => addTerminalLine({ type: "info", content: l }));
        break;

      case "history":
        commandHistory.slice().reverse().slice(0, 50).forEach((h, i) => {
          addTerminalLine({ type: "output", content: `  ${String(commandHistory.length - i).padStart(4)}  ${h}` });
        });
        if (!commandHistory.length) addTerminalLine({ type: "output", content: "(empty)" });
        break;

      case "ai": {
        const q = parts.slice(1).join(" ");
        if (!q) { addTerminalLine({ type: "error", content: "Usage: ai <question>" }); break; }
        setActiveScreen("ai");
        addAiMessage({ role: "user", content: q });
        break;
      }

      case "agent": {
        const task = parts.slice(1).join(" ");
        if (!task) { addTerminalLine({ type: "error", content: 'Usage: agent <task> — e.g. "agent scan 10.0.0.1 for vulns"' }); break; }
        await runAgent(task);
        break;
      }

      case "cd":
        if (!parts[1] || parts[1] === "~") setCurrentPath("/root");
        else if (parts[1] === "..") { const p = currentPath.split("/").filter(Boolean); p.pop(); setCurrentPath("/" + p.join("/") || "/"); }
        else setCurrentPath(parts[1].startsWith("/") ? parts[1] : `${currentPath}/${parts[1]}`);
        addTerminalLine({ type: "success", content: `[+] ${currentPath}` });
        break;

      default:
        await realExec(trimmed);
        break;
    }
  }, [addTerminalLine, clearTerminal, currentPath, setCurrentPath, setActiveScreen,
      addAiMessage, addToHistory, commandHistory, realExec, runAgent]);

  const isBusy = isRunning || agentRunning || isAiLoading;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerPath} numberOfLines={1}>root@lazy-devil:{currentPath}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={[styles.modeBadge, { borderColor: execMode === "termux" ? "#44ff44" : "#cc0000" }]}>
            <Text style={[styles.modeText, { color: execMode === "termux" ? "#44ff44" : "#cc0000" }]}>
              {execMode === "termux" ? "TERMUX" : "BACKEND"}
            </Text>
          </View>
          {isBusy && <View style={styles.busyDot} />}
        </View>
      </View>

      <FlatList
        ref={flatRef}
        data={terminalLines}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <TermLine line={item} />}
        style={styles.output}
        contentContainerStyle={{ paddingVertical: 6 }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={scrollToBottom}
      />

      {/* Control row */}
      <View style={styles.ctrlRow}>
        <TouchableOpacity style={styles.ctrlBtn} onPress={() => navigateHistory("up")}><Text style={styles.ctrlTxt}>▲</Text></TouchableOpacity>
        <TouchableOpacity style={styles.ctrlBtn} onPress={() => navigateHistory("down")}><Text style={styles.ctrlTxt}>▼</Text></TouchableOpacity>

        {agentRunning ? (
          <TouchableOpacity style={styles.stopBtn} onPress={stopAgent}>
            <Text style={styles.stopTxt}>◼ STOP AGENT</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.agentBtn}
            onPress={() => {
              if (input.trim()) { runCommand(`agent ${input.trim()}`); setInput(""); }
              else addTerminalLine({ type: "info", content: '[~] Type a goal then tap 🤖 — e.g. "scan 10.0.0.1 for vulns"' });
            }}
          >
            <Text style={styles.agentTxt}>🤖 AGENT</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.micBtn, isListening && styles.micActive]}
          onPress={isListening ? () => { recognitionRef.current?.stop(); setIsListening(false); } : startVoice}
        >
          <Text style={styles.micTxt}>{isListening ? "◼" : "🎙"}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.ctrlBtn} onPress={clearHistory}>
          <Text style={[styles.ctrlTxt, { color: "#330000" }]}>HST</Text>
        </TouchableOpacity>
      </View>

      {/* Input row */}
      <View style={[styles.inputRow, { paddingBottom: insets.bottom + 90 }]}>
        <Text style={styles.prompt}>#</Text>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => { if (!isBusy) { runCommand(input); setInput(""); } }}
          returnKeyType="send"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          placeholder={agentRunning ? "agent running…" : "command or agent goal…"}
          placeholderTextColor="#330000"
          blurOnSubmit={false}
          editable={!agentRunning}
        />
        <TouchableOpacity
          style={[styles.runBtn, isBusy && { borderColor: "#220000" }]}
          onPress={() => { if (!isBusy) { runCommand(input); setInput(""); } }}
          disabled={isBusy}
        >
          <Text style={[styles.runTxt, { color: isBusy ? "#220000" : "#cc0000" }]}>
            {agentRunning ? "..." : isRunning ? "…" : "RUN"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 8, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: "#1a0000" },
  headerPath: { fontFamily: "monospace", fontSize: 10, color: "#cc0000", flex: 1 },
  modeBadge: { borderWidth: 1, paddingHorizontal: 5, paddingVertical: 2 },
  modeText: { fontFamily: "monospace", fontSize: 8, fontWeight: "bold" },
  busyDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#cc0000" },
  output: { flex: 1 },
  ctrlRow: { flexDirection: "row", gap: 4, paddingHorizontal: 6, paddingVertical: 4, borderTopWidth: 1, borderTopColor: "#110000", alignItems: "center" },
  ctrlBtn: { borderWidth: 1, borderColor: "#220000", paddingHorizontal: 9, paddingVertical: 5 },
  ctrlTxt: { color: "#660000", fontFamily: "monospace", fontSize: 11 },
  agentBtn: { borderWidth: 1, borderColor: "#550055", paddingHorizontal: 9, paddingVertical: 5, backgroundColor: "#080010" },
  agentTxt: { color: "#cc44cc", fontFamily: "monospace", fontSize: 10, fontWeight: "bold" },
  stopBtn: { borderWidth: 1, borderColor: "#cc0000", paddingHorizontal: 9, paddingVertical: 5, backgroundColor: "#1a0000" },
  stopTxt: { color: "#ff4444", fontFamily: "monospace", fontSize: 10, fontWeight: "bold" },
  micBtn: { borderWidth: 1, borderColor: "#220000", paddingHorizontal: 8, paddingVertical: 5, marginLeft: "auto" },
  micActive: { backgroundColor: "#200000", borderColor: "#cc0000" },
  micTxt: { color: "#cc0000", fontFamily: "monospace", fontSize: 10 },
  inputRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: "#110000", gap: 6 },
  prompt: { fontFamily: "monospace", fontSize: 16, color: "#cc0000", fontWeight: "bold" },
  input: { flex: 1, fontFamily: "monospace", fontSize: 13, color: "#ff3333", paddingVertical: 6 },
  runBtn: { borderWidth: 1, borderColor: "#cc0000", paddingHorizontal: 10, paddingVertical: 6 },
  runTxt: { fontFamily: "monospace", fontSize: 11, fontWeight: "bold" },
});
