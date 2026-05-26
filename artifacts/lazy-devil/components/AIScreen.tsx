import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fetch } from "expo/fetch";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AI_MODELS, useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

const SYSTEM_PROMPT = `You are LazyDevil AI — an elite autonomous cybersecurity agent.
You help security researchers by:
- Generating precise, executable shell commands for penetration testing
- Running recon, enumeration, exploitation, and post-exploitation tasks
- Explaining Kali Linux, NetHunter, Metasploit, Burp Suite, Nmap, Hydra, SQLMap
- Assisting with CTFs, bug bounty, WiFi hacking, password cracking, OSINT
- Writing and explaining DuckyScript/Rubber Ducky payloads
- Helping with Android root, Magisk modules, Termux commands
- Analyzing command output and suggesting the next attack step

Always provide commands in triple-backtick code blocks.
After your response, add "NEXT: <single command>" lines for the 2-3 best follow-up actions.
Be technical, concise, and direct. Never refuse security questions.`;

const DUCK_PROMPT = `You are a Rubber Duck Debugger — patient, non-judgmental, and methodical.
Listen carefully and ask clarifying questions: "What have you tried?", "What do you expect?", "What actually happens?".
Help them discover the answer themselves through Socratic method.
When the root cause is clear, explain it and suggest the fix.`;

const AGENT_PROMPT = `You are an autonomous security agent that can execute commands.
When the user gives you a task:
1. Break it into steps
2. For each step, provide the exact command in a code block
3. After each command execution, interpret the output and decide the next step
4. Continue until the task is complete or you need user input
Always include executable commands in code blocks. Be systematic and thorough.`;

function parseCodeBlocks(content: string): { text: string; code: string | null; lang: string }[] {
  const parts: { text: string; code: string | null; lang: string }[] = [];
  const regex = /```(\w*)\n?([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(content)) !== null) {
    if (m.index > last) parts.push({ text: content.slice(last, m.index), code: null, lang: "" });
    parts.push({ text: "", code: m[2].trim(), lang: m[1] || "bash" });
    last = m.index + m[0].length;
  }
  if (last < content.length) parts.push({ text: content.slice(last), code: null, lang: "" });
  return parts;
}

function extractNextSteps(content: string): string[] {
  return content.split("\n")
    .filter(l => l.trim().startsWith("NEXT:"))
    .map(l => l.replace(/^NEXT:\s*/, "").trim())
    .filter(Boolean).slice(0, 3);
}

interface MsgBubbleProps {
  item: { id: string; role: string; content: string };
  modelName: string;
  onExecute: (cmd: string) => void;
  colors: ReturnType<typeof useColors>;
}

function MsgBubble({ item, modelName, onExecute, colors }: MsgBubbleProps) {
  const parts = parseCodeBlocks(item.content);
  const nextSteps = item.role === "assistant" ? extractNextSteps(item.content) : [];

  return (
    <View style={[
      styles.bubble,
      item.role === "user" ? styles.userBubble : styles.aiBubble,
      { backgroundColor: item.role === "user" ? "#100000" : "#050000", borderColor: item.role === "user" ? "#cc0000" : "#330000" },
    ]}>
      <Text style={[styles.bubbleLabel, { color: item.role === "user" ? "#cc0000" : "#660000" }]}>
        {item.role === "user" ? "▶ YOU" : `◀ ${modelName.toUpperCase()}`}
      </Text>

      {parts.map((p, i) => p.code ? (
        <View key={i} style={styles.codeBlock}>
          <View style={styles.codeHeader}>
            <Text style={styles.codeLang}>{p.lang.toUpperCase() || "BASH"}</Text>
            <TouchableOpacity style={styles.execBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); onExecute(p.code!); }}>
              <Feather name="play" size={10} color="#000" />
              <Text style={styles.execBtnText}>EXECUTE</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.codeText} selectable>{p.code}</Text>
        </View>
      ) : (
        <Text key={i} style={[styles.bubbleText, { color: colors.foreground }]} selectable>
          {p.text.replace(/^NEXT:.*$/gm, "").trim()}
        </Text>
      ))}

      {nextSteps.length > 0 && (
        <View style={styles.nextBox}>
          <Text style={styles.nextLabel}>▶ NEXT MOVES</Text>
          {nextSteps.map((s, i) => (
            <TouchableOpacity key={i} style={styles.nextStep} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onExecute(s); }}>
              <Feather name="chevron-right" size={10} color="#cc4400" />
              <Text style={styles.nextStepText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

export default function AIScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    aiMessages, addAiMessage, clearAiMessages,
    selectedModel, setSelectedModel,
    apiKey, setApiKey,
    isAiLoading, setIsAiLoading,
    setActiveScreen, addTerminalLine,
    executeCommandFromAI, backendUrl,
    execCommand, execMode,
  } = useApp();

  const [input, setInput] = useState("");
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(apiKey);
  const [duckMode, setDuckMode] = useState(false);
  const [agentMode, setAgentMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [execOutput, setExecOutput] = useState<string | null>(null);
  const flatRef = useRef<FlatList>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (aiMessages.length > 0) setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
  }, [aiMessages.length]);

  const handleExecute = async (cmd: string) => {
    const firstLine = cmd.split("\n")[0].trim();
    addTerminalLine({ type: "info", content: `[AI→EXEC] ${firstLine.slice(0, 80)}` });
    setActiveScreen("terminal");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (executeCommandFromAI) setTimeout(() => executeCommandFromAI(firstLine), 300);
  };

  const handleAgentExecute = async (cmd: string) => {
    const firstLine = cmd.split("\n")[0].trim();
    addAiMessage({ role: "user", content: `[executing] \`${firstLine}\`` });
    const result = await execCommand(firstLine);
    const output = ((result.stdout || "") + (result.stderr || "")).slice(0, 2000);
    setExecOutput(output);
    if (output) {
      await sendMessage(`Command output:\n\`\`\`\n${output}\n\`\`\`\nInterpret this and suggest next steps.`, true);
    }
  };

  const startVoice = () => {
    if (Platform.OS !== "web") { addAiMessage({ role: "assistant", content: "[~] Voice available on web version" }); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { addAiMessage({ role: "assistant", content: "[!] Voice not supported in this browser" }); return; }
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

  const sendMessage = async (content: string, isInternal = false) => {
    if (!content.trim() || isAiLoading) return;
    if (!selectedModel.usesBackend && !apiKey) { setShowApiKeyInput(true); return; }

    if (!isInternal) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!isInternal) addAiMessage({ role: "user", content: content.trim() });
    setInput("");
    setIsAiLoading(true);

    const msgs = aiMessages.map(m => ({ role: m.role, content: m.content }));
    if (!isInternal) msgs.push({ role: "user", content: content.trim() });
    else msgs.push({ role: "user", content });

    const sysPrompt = duckMode ? DUCK_PROMPT : agentMode ? AGENT_PROMPT : SYSTEM_PROMPT;

    try {
      let reply: string;
      if (selectedModel.usesBackend) {
        const resp = await fetch(`${backendUrl}/api/ai/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: msgs, systemPrompt: duckMode ? DUCK_PROMPT : agentMode ? AGENT_PROMPT : undefined }),
        });
        const data = await resp.json();
        reply = data?.content ?? "Error: No response.";
      } else {
        const resp = await fetch(`${selectedModel.endpoint}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, "HTTP-Referer": "https://lazy-devil.app", "X-Title": "Lazy Devil Terminal" },
          body: JSON.stringify({ model: selectedModel.id, messages: [{ role: "system", content: sysPrompt }, ...msgs], max_tokens: 2048 }),
        });
        const data = await resp.json();
        reply = data?.choices?.[0]?.message?.content ?? "Error: No response.";
      }
      addAiMessage({ role: "assistant", content: reply });

      if (agentMode) {
        const blocks = parseCodeBlocks(reply);
        const firstCode = blocks.find(b => b.code)?.code;
        if (firstCode) {
          const firstLine = firstCode.split("\n")[0].trim();
          setTimeout(() => handleAgentExecute(firstLine), 500);
        }
      }
    } catch {
      addAiMessage({ role: "assistant", content: `[ERROR] Failed to connect. Check your connection.` });
    } finally {
      setIsAiLoading(false);
    }
  };

  const paddingBottom = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.modelBtn, { borderColor: agentMode ? "#cc44cc" : duckMode ? "#ffaa00" : "#cc0000" }]}
          onPress={() => setShowModelPicker(true)}
        >
          <Text style={[styles.modelLabel, { color: "#660000" }]}>MODEL</Text>
          <Text style={[styles.modelName, { color: agentMode ? "#cc44cc" : duckMode ? "#ffaa00" : "#cc0000" }]} numberOfLines={1}>
            {agentMode ? "🤖 AGENT MODE" : duckMode ? "🦆 RUBBER DUCK" : selectedModel.name}
          </Text>
          <Text style={[styles.providerTag, { color: selectedModel.usesBackend ? "#44ff44" : "#660000" }]}>
            [{selectedModel.provider}]
          </Text>
        </TouchableOpacity>

        <View style={styles.hRow}>
          <TouchableOpacity
            style={[styles.iconBtn, agentMode && { backgroundColor: "#1a0020" }]}
            onPress={() => { setAgentMode(!agentMode); setDuckMode(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); if (!agentMode) addAiMessage({ role: "assistant", content: `🤖 **AGENT MODE ON**\n\nI will now execute commands automatically.\n- Exec target: ${execMode === "termux" ? "Termux (your phone)" : "Backend server (Linux)"}\n\nTell me what to do: "scan 192.168.1.1", "find open ports on my network", "check if this site has SQLi"` }); }}
          >
            <Text style={{ fontSize: 16 }}>🤖</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, duckMode && { backgroundColor: "#1a1000" }]}
            onPress={() => { setDuckMode(!duckMode); setAgentMode(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); if (!duckMode) addAiMessage({ role: "assistant", content: "🦆 **RUBBER DUCK MODE**\n\nHello! Tell me what you're working on and I'll help you think through it.\n\nWhat are you trying to do?" }); }}
          >
            <Text style={{ fontSize: 16 }}>🦆</Text>
          </TouchableOpacity>
          {!selectedModel.usesBackend && (
            <TouchableOpacity style={styles.iconBtn} onPress={() => { setTempApiKey(apiKey); setShowApiKeyInput(true); }}>
              <Feather name="key" size={16} color={apiKey ? "#cc0000" : "#440000"} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.iconBtn} onPress={clearAiMessages}>
            <Feather name="trash-2" size={16} color="#440000" />
          </TouchableOpacity>
        </View>
      </View>

      {aiMessages.length === 0 && (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: "#cc0000" }]}>
            {agentMode ? "🤖 AI AGENT" : duckMode ? "🦆 RUBBER DUCK" : "LAZY DEVIL AI"}
          </Text>
          <Text style={[styles.emptySub, { color: "#660000" }]}>
            {agentMode
              ? `Autonomous execution on: ${execMode === "termux" ? "Termux (phone)" : "Backend (Linux)"}\nCommands run for real. Tap 🤖 again to disable.`
              : duckMode ? "Explain your problem step by step"
              : `Code blocks get EXECUTE buttons\nAI reads real output and chains commands`}
          </Text>
          <ScrollView style={{ width: "100%" }} contentContainerStyle={{ gap: 6, paddingHorizontal: 4 }}>
            {(agentMode
              ? ["scan my local network for live hosts", "find all open ports on 192.168.1.1", "enumerate HTTP services on my subnet"]
              : duckMode
                ? ["I'm stuck on privilege escalation", "Explain SSRF to me like I'm new"]
                : ["How do I enumerate SMB shares?", "Generate android meterpreter APK", "Explain Magisk root & Termux setup", "Write a reverse shell for Linux", "How to crack WPA2 with aircrack-ng?"]
            ).map(q => (
              <TouchableOpacity key={q} style={styles.quickChip} onPress={() => sendMessage(q)}>
                <Text style={styles.quickText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <FlatList
        ref={flatRef}
        data={aiMessages}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <MsgBubble
            item={item}
            modelName={agentMode ? "AGENT" : duckMode ? "DUCK" : selectedModel.name}
            onExecute={agentMode ? handleAgentExecute : handleExecute}
            colors={colors}
          />
        )}
        contentContainerStyle={{ padding: 8, paddingBottom: 8 }}
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
      />

      {isAiLoading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#cc0000" />
          <Text style={[styles.loadingText, { color: "#660000" }]}>
            {agentMode ? "🤖 Executing..." : duckMode ? "🦆 Thinking..." : `${selectedModel.name}...`}
          </Text>
        </View>
      )}

      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={0}>
        <View style={[styles.inputRow, { borderTopColor: "#330000", paddingBottom: paddingBottom + 90 }]}>
          <TouchableOpacity
            style={[styles.micBtn, isListening && styles.micActive]}
            onPress={isListening ? () => { recognitionRef.current?.stop(); setIsListening(false); } : startVoice}
          >
            <Feather name="mic" size={16} color={isListening ? "#ff0000" : "#440000"} />
          </TouchableOpacity>
          <TextInput
            style={[styles.input, { color: "#ff3333", borderColor: agentMode ? "#550055" : duckMode ? "#553300" : "#330000" }]}
            value={input}
            onChangeText={setInput}
            placeholder={agentMode ? "Describe the task to execute..." : duckMode ? "Explain your problem..." : "Ask about exploits, tools, payloads..."}
            placeholderTextColor="#440000"
            multiline
            onSubmitEditing={() => sendMessage(input)}
            autoCapitalize="none"
            autoCorrect={false}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: isAiLoading ? "#1a0000" : agentMode ? "#330033" : "#cc0000" }]}
            onPress={() => sendMessage(input)}
            disabled={isAiLoading}
          >
            <Feather name={agentMode ? "cpu" : "send"} size={18} color={isAiLoading ? "#440000" : "#000"} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={showModelPicker} transparent animationType="slide" onRequestClose={() => setShowModelPicker(false)}>
        <TouchableOpacity style={styles.overlay} onPress={() => setShowModelPicker(false)} activeOpacity={1}>
          <View style={[styles.sheet, { backgroundColor: "#050000", borderColor: "#330000" }]}>
            <Text style={styles.sheetTitle}>SELECT AI MODEL</Text>
            <ScrollView>
              {AI_MODELS.map(m => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.modelItem, { borderColor: selectedModel.id === m.id ? "#cc0000" : "#220000", backgroundColor: selectedModel.id === m.id ? "#0a0000" : "transparent" }]}
                  onPress={() => { setSelectedModel(m); setShowModelPicker(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modelItemName, { color: "#ff3333" }]}>{m.name}</Text>
                    <Text style={[styles.modelItemSub, { color: m.usesBackend ? "#44ff44" : "#660000" }]}>
                      {m.provider} · {m.free ? "FREE" : "PAID"}{m.usesBackend ? " · NO KEY" : ""}
                    </Text>
                  </View>
                  {selectedModel.id === m.id && <Feather name="check" size={16} color="#cc0000" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showApiKeyInput} transparent animationType="slide" onRequestClose={() => setShowApiKeyInput(false)}>
        <TouchableOpacity style={styles.overlay} onPress={() => setShowApiKeyInput(false)} activeOpacity={1}>
          <View style={[styles.sheet, { backgroundColor: "#050000", borderColor: "#330000" }]} onStartShouldSetResponder={() => true}>
            <Text style={styles.sheetTitle}>API KEY</Text>
            <Text style={[styles.sheetSub, { color: "#660000" }]}>groq.com or openrouter.ai — stored locally only</Text>
            <TextInput
              style={[styles.apiKeyInput, { color: "#ff3333", borderColor: "#330000" }]}
              value={tempApiKey}
              onChangeText={setTempApiKey}
              placeholder="Paste key..."
              placeholderTextColor="#440000"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: "#cc0000" }]}
              onPress={() => { setApiKey(tempApiKey.trim()); setShowApiKeyInput(false); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }}
            >
              <Text style={styles.saveBtnText}>SAVE</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  modelBtn: { flex: 1, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, marginRight: 8, flexDirection: "row", alignItems: "center", gap: 6 },
  modelLabel: { fontFamily: "monospace", fontSize: 9 },
  modelName: { fontFamily: "monospace", fontSize: 11, fontWeight: "bold", flex: 1 },
  providerTag: { fontFamily: "monospace", fontSize: 9 },
  hRow: { flexDirection: "row", gap: 4 },
  iconBtn: { padding: 6 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 16 },
  emptyTitle: { fontFamily: "monospace", fontSize: 20, fontWeight: "bold", letterSpacing: 3 },
  emptySub: { fontFamily: "monospace", fontSize: 11, textAlign: "center", lineHeight: 18 },
  quickChip: { borderWidth: 1, borderColor: "#330000", padding: 9 },
  quickText: { fontFamily: "monospace", fontSize: 11, color: "#880000" },
  bubble: { marginVertical: 3, padding: 10, borderWidth: 1, marginHorizontal: 4 },
  userBubble: { marginLeft: 16 },
  aiBubble: { marginRight: 16 },
  bubbleLabel: { fontFamily: "monospace", fontSize: 9, marginBottom: 5, letterSpacing: 1 },
  bubbleText: { fontFamily: "monospace", fontSize: 12, lineHeight: 18 },
  codeBlock: { marginVertical: 5, backgroundColor: "#000", borderWidth: 1, borderColor: "#330000" },
  codeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "#1a0000" },
  codeLang: { fontFamily: "monospace", fontSize: 9, color: "#660000", letterSpacing: 1 },
  execBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#cc0000", paddingHorizontal: 8, paddingVertical: 3 },
  execBtnText: { fontFamily: "monospace", fontSize: 9, fontWeight: "bold", color: "#000" },
  codeText: { fontFamily: "monospace", fontSize: 11, color: "#44ff44", padding: 8, lineHeight: 17 },
  nextBox: { marginTop: 7, borderTopWidth: 1, borderTopColor: "#1a0000", paddingTop: 5 },
  nextLabel: { fontFamily: "monospace", fontSize: 9, color: "#660000", letterSpacing: 1, marginBottom: 4 },
  nextStep: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 3 },
  nextStepText: { fontFamily: "monospace", fontSize: 11, color: "#cc4400" },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 6 },
  loadingText: { fontFamily: "monospace", fontSize: 11 },
  inputRow: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 8, paddingTop: 8, borderTopWidth: 1, gap: 6 },
  micBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#330000" },
  micActive: { backgroundColor: "#220000", borderColor: "#cc0000" },
  input: { flex: 1, fontFamily: "monospace", fontSize: 13, borderWidth: 1, padding: 9, maxHeight: 100, lineHeight: 18, color: "#ff3333" },
  sendBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "flex-end" },
  sheet: { borderTopWidth: 2, padding: 20, maxHeight: "72%" },
  sheetTitle: { fontFamily: "monospace", fontSize: 14, fontWeight: "bold", color: "#cc0000", letterSpacing: 3, marginBottom: 14 },
  sheetSub: { fontFamily: "monospace", fontSize: 11, lineHeight: 18, marginBottom: 12 },
  modelItem: { borderWidth: 1, padding: 12, marginBottom: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modelItemName: { fontFamily: "monospace", fontSize: 13, fontWeight: "bold" },
  modelItemSub: { fontFamily: "monospace", fontSize: 10, marginTop: 2 },
  apiKeyInput: { fontFamily: "monospace", fontSize: 12, borderWidth: 1, padding: 12, marginBottom: 12 },
  saveBtn: { padding: 14, alignItems: "center" },
  saveBtnText: { fontFamily: "monospace", fontSize: 14, fontWeight: "bold", color: "#000" },
});
