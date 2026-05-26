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
import { useColors } from "@/hooks/useColors";

const HELP_TEXT = `
LAZY DEVIL TERMINAL v2.1 — REAL EXECUTION
══════════════════════════════════════════════
Commands run on real Linux (backend) or Termux (your phone).
Toggle server in the BRIDGE tab.

REAL EXECUTION (backend / termux)
  Any shell command     Runs for real and returns output
  ping, curl, dig       Network tools with real results
  python3 -c "..."      Run Python code
  bash -c "..."         Arbitrary bash
  whoami, id, uname     Real system info
  nmap, nc, ss          Security tools (if installed)

BUILT-IN (simulated)
  banner                Show banner
  help                  This help
  clear                 Clear terminal

AI
  ai <query>            Ask AI assistant
  agent <task>          AI agent — runs commands autonomously

HISTORY
  history               Show command history
  ↑ ↓ arrows            Navigate command history
`.trim();

interface TerminalLineProps {
  line: { type: string; content: string };
}

function TLine({ line }: TerminalLineProps) {
  const colors = useColors();
  const color =
    line.type === "command" ? "#cc0000"
    : line.type === "error" ? "#ff4444"
    : line.type === "success" ? "#44ff44"
    : line.type === "info" ? colors.foreground
    : "#bb9900";

  return (
    <Text
      style={{ color, fontFamily: "monospace", fontSize: 12, lineHeight: 18, paddingHorizontal: 8 }}
      selectable
    >
      {line.type === "command" ? `# ${line.content}` : line.content}
    </Text>
  );
}

export default function TerminalScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    terminalLines, addTerminalLine, clearTerminal,
    currentPath, setCurrentPath,
    setActiveScreen, addAiMessage,
    commandHistory, addToHistory, clearHistory,
    setExecuteCommandFromAI,
    execMode, backendUrl, execCommand,
    isAiLoading, setIsAiLoading,
    selectedModel, apiKey,
  } = useApp();

  const [input, setInput] = useState("");
  const [histIdx, setHistIdx] = useState(-1);
  const [isListening, setIsListening] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const recognitionRef = useRef<any>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 50);
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
    if (Platform.OS !== "web") {
      addTerminalLine({ type: "info", content: "[~] Voice available on web version" });
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { addTerminalLine({ type: "error", content: "[!] Voice not supported in this browser" }); return; }
    const rec = new SR();
    rec.lang = "en-US";
    recognitionRef.current = rec;
    setIsListening(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    rec.onresult = (e: any) => { setInput(e.results[0]?.[0]?.transcript ?? ""); setIsListening(false); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);
    rec.start();
  };

  const realExec = useCallback(async (cmd: string) => {
    addTerminalLine({ type: "info", content: `[exec:${execMode}] ${cmd}` });
    setIsRunning(true);
    const result = await execCommand(cmd);
    setIsRunning(false);
    if (result.stdout) {
      for (const line of result.stdout.split("\n")) {
        if (line) addTerminalLine({ type: result.exitCode === 0 ? "output" : "error", content: line });
      }
    }
    if (result.stderr) {
      for (const line of result.stderr.split("\n")) {
        if (line) addTerminalLine({ type: "error", content: line });
      }
    }
    if (!result.stdout && !result.stderr && result.exitCode === 0) {
      addTerminalLine({ type: "success", content: `[+] Done (${result.elapsed}ms)` });
    }
    return result;
  }, [execMode, execCommand, addTerminalLine]);

  const aiAgent = useCallback(async (task: string) => {
    if (isAiLoading) return;
    addTerminalLine({ type: "info", content: `[🤖 AGENT] Task: ${task}` });
    setIsAiLoading(true);
    try {
      const domain = backendUrl;
      const response = await fetch(`${domain}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: `You are an autonomous security agent. The user wants to: "${task}". Generate ONE shell command that makes progress on this task. Reply ONLY with the command, nothing else. No markdown, no explanation. Just the raw command string.` }],
        }),
      });
      const data = await response.json();
      const cmd = (data?.content ?? "").trim().replace(/^```[\w]*\n?/, "").replace(/```$/, "").trim();
      if (!cmd || cmd.includes(" ") === false && cmd.length > 80) {
        addTerminalLine({ type: "error", content: "[!] Agent could not generate a valid command" });
        return;
      }
      addTerminalLine({ type: "success", content: `[🤖] Running: ${cmd}` });
      const result = await realExec(cmd);

      if (result.stdout || result.stderr) {
        const output = (result.stdout + result.stderr).slice(0, 800);
        const interpretResp = await fetch(`${domain}/api/ai/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: `Task: "${task}"\nCommand run: ${cmd}\nOutput:\n${output}\n\nBriefly interpret this output (2-3 lines) and suggest the single best next command. Format: ANALYSIS: <one line>\nNEXT: <exact command>` }],
          }),
        });
        const interpretData = await interpretResp.json();
        const interpretation = interpretData?.content ?? "";
        for (const l of interpretation.split("\n").filter(Boolean)) {
          addTerminalLine({ type: "info", content: `[🤖] ${l}` });
        }
        const nextMatch = interpretation.match(/NEXT:\s*(.+)/);
        if (nextMatch?.[1]) {
          addTerminalLine({ type: "info", content: `[🤖] Run next: ${nextMatch[1].trim()}` });
        }
      }
    } catch (e: any) {
      addTerminalLine({ type: "error", content: `[!] Agent error: ${e?.message}` });
    } finally {
      setIsAiLoading(false);
    }
  }, [isAiLoading, backendUrl, realExec, addTerminalLine, setIsAiLoading]);

  const runCommand = useCallback(async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addToHistory(trimmed);
    setHistIdx(-1);
    addTerminalLine({ type: "command", content: trimmed });

    const parts = trimmed.split(/\s+/);
    const command = parts[0].toLowerCase();

    switch (command) {
      case "clear":
        clearTerminal();
        break;

      case "help":
        for (const line of HELP_TEXT.split("\n")) addTerminalLine({ type: "output", content: line });
        break;

      case "banner":
        for (const l of [
          ` _                        ____             _ _ `,
          `| |    __ _ _____   _   |  _ \\  _____   _(_) |`,
          `| |   / _\` |_  / | | |  | | | |/ _ \\ \\ / / | |`,
          `| |__| (_| |/ /| |_| |  | |_| |  __/\\ V /| | |`,
          `|_____\\__,_/___|\\__, |  |____/ \\___| \\_/ |_|_|`,
          `                |___/  v2.1 · Real Exec · AI Agent`,
        ]) addTerminalLine({ type: "info", content: l });
        break;

      case "history":
        if (!commandHistory.length) {
          addTerminalLine({ type: "output", content: "(no history)" });
        } else {
          commandHistory.slice().reverse().forEach((h, i) => {
            addTerminalLine({ type: "output", content: `  ${String(commandHistory.length - i).padStart(4)}  ${h}` });
          });
        }
        break;

      case "ai": {
        const query = parts.slice(1).join(" ");
        if (!query) { addTerminalLine({ type: "error", content: "Usage: ai <question>" }); break; }
        setActiveScreen("ai");
        addAiMessage({ role: "user", content: query });
        break;
      }

      case "agent": {
        const task = parts.slice(1).join(" ");
        if (!task) { addTerminalLine({ type: "error", content: "Usage: agent <task description>" }); break; }
        await aiAgent(task);
        break;
      }

      case "cd":
        if (!parts[1] || parts[1] === "~") {
          setCurrentPath("/root");
        } else if (parts[1] === "..") {
          const p = currentPath.split("/").filter(Boolean);
          p.pop();
          setCurrentPath("/" + p.join("/") || "/");
        } else {
          setCurrentPath(parts[1].startsWith("/") ? parts[1] : `${currentPath}/${parts[1]}`);
        }
        addTerminalLine({ type: "success", content: `[+] ${parts[1] ?? "/root"}` });
        break;

      default:
        await realExec(trimmed);
        break;
    }
  }, [addTerminalLine, clearTerminal, currentPath, setCurrentPath, setActiveScreen,
      addAiMessage, addToHistory, commandHistory, aiAgent, realExec, isAiLoading, setIsAiLoading]);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.header}>
        <Text style={[styles.headerText, { color: "#cc0000" }]}>root@lazy-devil:{currentPath}</Text>
        <View style={styles.headerRight}>
          <View style={[styles.modeBadge, { backgroundColor: execMode === "termux" ? "#001a00" : "#0a0000", borderColor: execMode === "termux" ? "#44ff44" : "#cc0000" }]}>
            <Text style={[styles.modeText, { color: execMode === "termux" ? "#44ff44" : "#cc0000" }]}>
              {execMode === "termux" ? "TERMUX" : "BACKEND"}
            </Text>
          </View>
          {(isRunning || isAiLoading) && (
            <View style={styles.runIndicator}>
              <Text style={styles.runIndicatorText}>●</Text>
            </View>
          )}
        </View>
      </View>

      <FlatList
        ref={flatRef}
        data={terminalLines}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <TLine line={item} />}
        style={styles.output}
        contentContainerStyle={{ paddingVertical: 4 }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={scrollToBottom}
      />

      <View style={styles.navRow}>
        <TouchableOpacity style={styles.navBtn} onPress={() => navigateHistory("up")}>
          <Text style={styles.navBtnText}>▲</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => navigateHistory("down")}>
          <Text style={styles.navBtnText}>▼</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.agentBtn}
          onPress={() => {
            if (input.trim()) { runCommand(`agent ${input}`); setInput(""); }
            else addTerminalLine({ type: "info", content: "[~] Type a task then tap 🤖 — e.g. 'scan local network'" });
          }}
        >
          <Text style={styles.agentBtnText}>🤖 AGENT</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.micBtn, isListening && styles.micActive]}
          onPress={isListening ? () => { recognitionRef.current?.stop(); setIsListening(false); } : startVoice}
        >
          <Text style={styles.micText}>{isListening ? "◼ STOP" : "🎙"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={clearHistory}>
          <Text style={[styles.navBtnText, { color: "#440000" }]}>HST</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.inputRow, { borderTopColor: "#330000", paddingBottom: insets.bottom + 90 }]}>
        <Text style={[styles.prompt, { color: "#cc0000" }]}># </Text>
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: "#ff3333" }]}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => { runCommand(input); setInput(""); }}
          returnKeyType="send"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          placeholderTextColor="#440000"
          placeholder="enter command or task..."
          blurOnSubmit={false}
          editable={!isRunning && !isAiLoading}
        />
        <TouchableOpacity
          onPress={() => { runCommand(input); setInput(""); }}
          style={[styles.runBtn, { borderColor: isRunning ? "#440000" : "#cc0000", opacity: isRunning ? 0.5 : 1 }]}
          disabled={isRunning || isAiLoading}
        >
          <Text style={[styles.runBtnText, { color: isRunning ? "#440000" : "#cc0000" }]}>
            {isRunning ? "..." : "RUN"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 8, paddingVertical: 5,
    borderBottomWidth: 1, borderBottomColor: "#330000",
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  headerText: { fontFamily: "monospace", fontSize: 11, flex: 1 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  modeBadge: { borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  modeText: { fontFamily: "monospace", fontSize: 8, fontWeight: "bold" },
  runIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#cc0000" },
  runIndicatorText: { color: "#cc0000", fontSize: 10 },
  output: { flex: 1 },
  navRow: { flexDirection: "row", gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderTopWidth: 1, borderTopColor: "#1a0000", alignItems: "center" },
  navBtn: { borderWidth: 1, borderColor: "#330000", paddingHorizontal: 10, paddingVertical: 4 },
  navBtnText: { color: "#880000", fontFamily: "monospace", fontSize: 11 },
  agentBtn: { borderWidth: 1, borderColor: "#550055", paddingHorizontal: 8, paddingVertical: 4, backgroundColor: "#0a0010" },
  agentBtnText: { color: "#cc44cc", fontFamily: "monospace", fontSize: 10, fontWeight: "bold" },
  micBtn: { borderWidth: 1, borderColor: "#330000", paddingHorizontal: 8, paddingVertical: 4, marginLeft: "auto" },
  micActive: { backgroundColor: "#220000", borderColor: "#cc0000" },
  micText: { color: "#cc0000", fontFamily: "monospace", fontSize: 10 },
  inputRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingTop: 6, borderTopWidth: 1 },
  prompt: { fontFamily: "monospace", fontSize: 14, fontWeight: "bold" },
  input: { flex: 1, fontFamily: "monospace", fontSize: 13, paddingVertical: 6 },
  runBtn: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5, marginLeft: 6 },
  runBtnText: { fontFamily: "monospace", fontSize: 11, fontWeight: "bold" },
});
