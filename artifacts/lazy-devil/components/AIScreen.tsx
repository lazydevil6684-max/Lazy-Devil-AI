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

const SYSTEM_PROMPT = `You are LazyDevil AI — an elite cybersecurity and penetration testing expert.
You help security researchers with:
- Network scanning, reconnaissance, enumeration, and OSINT
- Vulnerability assessment, exploitation, and post-exploitation
- Kali Linux / NetHunter tools and commands
- CTF challenges, write-ups, and walkthroughs
- Web application security (OWASP Top 10, bug bounty)
- Active Directory attacks, lateral movement, privilege escalation
- Wireless attacks: WPA cracking, KARMA, evil twin, BLE attacks
- Malware analysis, reverse engineering, forensics
- USB HID attacks, Rubber Ducky payloads, BadUSB scripts
- Password cracking, hash identification, wordlist generation

Be technical, concise, and direct. Always include actual commands with flags and examples.
Format code in triple backtick blocks with the language specified.
After answering, suggest 2-3 logical next steps as "NEXT: command" on separate lines.`;

const DUCK_PROMPT = `You are a Rubber Duck Debugger — a patient, non-judgmental assistant helping the user work through their security problem or idea by asking clarifying questions and reflecting their thoughts back to them.
Listen carefully, ask "What have you tried so far?", "What do you expect to happen?", "What actually happens?".
Help them discover the answer themselves. Be warm, curious, and methodical.
When you identify the issue, explain it clearly and suggest a fix.`;

function parseCodeBlocks(content: string): { text: string; code: string | null; lang: string }[] {
  const parts: { text: string; code: string | null; lang: string }[] = [];
  const regex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: content.slice(lastIndex, match.index), code: null, lang: "" });
    }
    parts.push({ text: "", code: match[2].trim(), lang: match[1] || "bash" });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    parts.push({ text: content.slice(lastIndex), code: null, lang: "" });
  }
  return parts;
}

function extractNextSteps(content: string): string[] {
  const lines = content.split("\n");
  return lines
    .filter(l => l.trim().startsWith("NEXT:"))
    .map(l => l.replace(/^NEXT:\s*/,"").trim())
    .filter(Boolean)
    .slice(0, 3);
}

interface MessageBubbleProps {
  item: { id: string; role: string; content: string };
  modelName: string;
  onExecute: (cmd: string) => void;
  colors: ReturnType<typeof useColors>;
}

function MessageBubble({ item, modelName, onExecute, colors }: MessageBubbleProps) {
  const parts = parseCodeBlocks(item.content);
  const nextSteps = item.role === "assistant" ? extractNextSteps(item.content) : [];

  return (
    <View style={[
      styles.bubble,
      item.role === "user" ? styles.userBubble : styles.assistantBubble,
      { backgroundColor: item.role === "user" ? "#100000" : "#050000", borderColor: item.role === "user" ? colors.primary : "#330000" },
    ]}>
      <Text style={[styles.bubbleLabel, { color: item.role === "user" ? colors.primary : "#880000" }]}>
        {item.role === "user" ? "▶ YOU" : `◀ ${modelName.toUpperCase()}`}
      </Text>

      {parts.map((part, i) =>
        part.code ? (
          <View key={i} style={styles.codeBlock}>
            <View style={styles.codeHeader}>
              <Text style={styles.codeLang}>{part.lang.toUpperCase() || "BASH"}</Text>
              <TouchableOpacity
                style={styles.execBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                  onExecute(part.code!);
                }}
              >
                <Feather name="play" size={10} color="#000" />
                <Text style={styles.execBtnText}>EXECUTE</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.codeText} selectable>{part.code}</Text>
          </View>
        ) : (
          <Text key={i} style={[styles.bubbleText, { color: part.text.includes("NEXT:") ? "#440000" : colors.foreground }]} selectable>
            {part.text.replace(/^NEXT:.*$/gm, "").trim()}
          </Text>
        )
      )}

      {nextSteps.length > 0 && (
        <View style={styles.nextStepsBox}>
          <Text style={styles.nextLabel}>NEXT MOVES:</Text>
          {nextSteps.map((s, i) => (
            <TouchableOpacity
              key={i}
              style={styles.nextStep}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onExecute(s);
              }}
            >
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
    executeCommandFromAI,
  } = useApp();

  const [input, setInput] = useState("");
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(apiKey);
  const [duckMode, setDuckMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (aiMessages.length > 0) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [aiMessages.length]);

  const handleExecute = (cmd: string) => {
    addTerminalLine({ type: "info", content: `[AI] Executing: ${cmd.slice(0, 60)}${cmd.length > 60 ? "..." : ""}` });
    setActiveScreen("terminal");
    if (executeCommandFromAI) {
      setTimeout(() => executeCommandFromAI(cmd.split("\n")[0]), 300);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const startVoice = () => {
    if (Platform.OS !== "web") {
      addAiMessage({ role: "assistant", content: "[~] Voice input is available in the web version. On mobile, type your message or use the terminal mic button." });
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      addAiMessage({ role: "assistant", content: "[!] Voice recognition not available in this browser. Try Chrome or Edge." });
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    recognitionRef.current = rec;
    setIsListening(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    rec.onresult = (e: any) => {
      const transcript = e.results[0]?.[0]?.transcript ?? "";
      setInput(transcript);
      setIsListening(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);
    rec.start();
  };

  const stopVoice = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || isAiLoading) return;

    if (!selectedModel.usesBackend && !apiKey) {
      setShowApiKeyInput(true);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addAiMessage({ role: "user", content: content.trim() });
    setInput("");
    setIsAiLoading(true);

    const messages = aiMessages.map((m) => ({ role: m.role, content: m.content }));
    messages.push({ role: "user", content: content.trim() });

    const sysPrompt = duckMode ? DUCK_PROMPT : SYSTEM_PROMPT;

    try {
      let reply: string;

      if (selectedModel.usesBackend) {
        const domain = process.env.EXPO_PUBLIC_DOMAIN;
        const baseUrl = domain ? `https://${domain}` : "";
        const response = await fetch(`${baseUrl}/api/ai/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages, systemPrompt: duckMode ? DUCK_PROMPT : undefined }),
        });
        const data = await response.json();
        reply = data?.content ?? "Error: No response from server.";
      } else {
        const response = await fetch(`${selectedModel.endpoint}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "HTTP-Referer": "https://lazy-devil.app",
            "X-Title": "Lazy Devil Terminal",
          },
          body: JSON.stringify({
            model: selectedModel.id,
            messages: [{ role: "system", content: sysPrompt }, ...messages],
            max_tokens: 2048,
          }),
        });
        const data = await response.json();
        reply = data?.choices?.[0]?.message?.content ?? "Error: No response from model.";
      }

      addAiMessage({ role: "assistant", content: reply });
    } catch {
      addAiMessage({
        role: "assistant",
        content: `[ERROR] Failed to connect to ${selectedModel.provider}. Check your connection or API key.`,
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  const paddingBottom = Platform.OS === "web" ? 34 : insets.bottom;
  const needsApiKey = !selectedModel.usesBackend && !apiKey;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.modelBtn, { borderColor: duckMode ? "#ffaa00" : colors.primary }]}
          onPress={() => setShowModelPicker(true)}
        >
          <Text style={[styles.modelLabel, { color: colors.terminalDim }]}>MODEL</Text>
          <Text style={[styles.modelName, { color: duckMode ? "#ffaa00" : colors.terminalHead }]} numberOfLines={1}>
            {duckMode ? "🦆 RUBBER DUCK" : selectedModel.name}
          </Text>
          <Text style={[styles.providerTag, { color: selectedModel.usesBackend ? "#44ff44" : colors.terminalDim }]}>
            [{selectedModel.provider}]
          </Text>
        </TouchableOpacity>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.iconBtn, duckMode && styles.duckActive]}
            onPress={() => {
              setDuckMode(!duckMode);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              if (!duckMode) {
                addAiMessage({ role: "assistant", content: "🦆 **RUBBER DUCK MODE ACTIVATED**\n\nHello! I'm your rubber duck. Tell me what you're trying to do — explain it step by step, and I'll help you figure it out.\n\nWhat are you working on today?" });
              }
            }}
          >
            <Text style={{ fontSize: 16 }}>🦆</Text>
          </TouchableOpacity>
          {!selectedModel.usesBackend && (
            <TouchableOpacity style={styles.iconBtn} onPress={() => { setTempApiKey(apiKey); setShowApiKeyInput(true); }}>
              <Feather name="key" size={16} color={apiKey ? colors.primary : colors.navInactive} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.iconBtn} onPress={clearAiMessages}>
            <Feather name="trash-2" size={16} color={colors.navInactive} />
          </TouchableOpacity>
        </View>
      </View>

      {aiMessages.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: colors.primary }]}>
            {duckMode ? "🦆 RUBBER DUCK" : "LAZY DEVIL AI"}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.terminalDim }]}>
            {duckMode
              ? "Explain your problem — I'll help you think it through"
              : selectedModel.usesBackend
                ? `Free AI ready\n${selectedModel.name} via Replit\nCode blocks → tap EXECUTE to run`
                : apiKey
                  ? `Connected: ${selectedModel.name}\nCode blocks → tap EXECUTE to run`
                  : `${selectedModel.provider} requires an API key\nGroq.com / OpenRouter.ai (free tier)`}
          </Text>
          <View style={styles.quickPrompts}>
            {(duckMode
              ? ["I'm stuck on privilege escalation", "Explain SSRF to me", "Help me think through a CTF"]
              : ["How do I enumerate SMB shares?", "Generate a reverse shell payload", "Explain SQL injection"]
            ).map((q) => (
              <TouchableOpacity
                key={q}
                style={[styles.quickChip, { borderColor: "#330000" }]}
                onPress={() => sendMessage(q)}
              >
                <Text style={[styles.quickText, { color: "#880000" }]}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {needsApiKey && (
            <TouchableOpacity
              style={[styles.setupBtn, { borderColor: colors.primary }]}
              onPress={() => { setTempApiKey(""); setShowApiKeyInput(true); }}
            >
              <Text style={[styles.setupBtnText, { color: colors.primary }]}>SET API KEY</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <FlatList
        ref={flatRef}
        data={aiMessages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MessageBubble
            item={item}
            modelName={duckMode ? "DUCK" : selectedModel.name}
            onExecute={handleExecute}
            colors={colors}
          />
        )}
        contentContainerStyle={{ padding: 8, paddingBottom: 8 }}
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
      />

      {isAiLoading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.terminalDim }]}>
            {duckMode ? "🦆 Thinking..." : `${selectedModel.name} processing...`}
          </Text>
        </View>
      )}

      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={0}>
        <View style={[styles.inputRow, { borderTopColor: colors.border, paddingBottom: paddingBottom + 90 }]}>
          <TouchableOpacity
            style={[styles.micBtn, isListening && styles.micActive]}
            onPress={isListening ? stopVoice : startVoice}
          >
            <Feather name="mic" size={16} color={isListening ? "#ff0000" : colors.navInactive} />
          </TouchableOpacity>
          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: duckMode ? "#553300" : colors.border }]}
            value={input}
            onChangeText={setInput}
            placeholder={duckMode ? "Explain your problem..." : "Ask about pen testing, exploits, tools..."}
            placeholderTextColor={colors.terminalDim}
            multiline
            onSubmitEditing={() => sendMessage(input)}
            autoCapitalize="none"
            autoCorrect={false}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: isAiLoading ? colors.muted : duckMode ? "#553300" : colors.primary }]}
            onPress={() => sendMessage(input)}
            disabled={isAiLoading}
          >
            <Feather name="send" size={18} color="#000" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Model picker */}
      <Modal visible={showModelPicker} transparent animationType="slide" onRequestClose={() => setShowModelPicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowModelPicker(false)} activeOpacity={1}>
          <View style={[styles.modalSheet, { backgroundColor: "#0a0000", borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.terminalHead }]}>SELECT AI MODEL</Text>
            <ScrollView>
              {AI_MODELS.map((model) => (
                <TouchableOpacity
                  key={model.id}
                  style={[styles.modelItem, {
                    borderColor: selectedModel.id === model.id ? colors.primary : colors.border,
                    backgroundColor: selectedModel.id === model.id ? "#1a0000" : "transparent",
                  }]}
                  onPress={() => { setSelectedModel(model); setShowModelPicker(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modelItemName, { color: colors.foreground }]}>{model.name}</Text>
                    <Text style={[styles.modelItemProvider, { color: model.usesBackend ? "#44ff44" : colors.terminalDim }]}>
                      {model.provider} · {model.free ? "FREE" : "PAID"}{model.usesBackend ? " · NO KEY" : ""}
                    </Text>
                  </View>
                  {selectedModel.id === model.id && <Feather name="check" size={16} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* API Key */}
      <Modal visible={showApiKeyInput} transparent animationType="slide" onRequestClose={() => setShowApiKeyInput(false)}>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowApiKeyInput(false)} activeOpacity={1}>
          <View style={[styles.modalSheet, { backgroundColor: "#0a0000", borderColor: colors.border }]} onStartShouldSetResponder={() => true}>
            <Text style={[styles.modalTitle, { color: colors.terminalHead }]}>API KEY SETUP</Text>
            <Text style={[styles.modalSubtitle, { color: colors.terminalDim }]}>
              Free keys at groq.com or openrouter.ai{"\n"}Stored locally on device only.
            </Text>
            <TextInput
              style={[styles.apiKeyInput, { color: colors.foreground, borderColor: colors.border }]}
              value={tempApiKey}
              onChangeText={setTempApiKey}
              placeholder="Paste API key here..."
              placeholderTextColor={colors.terminalDim}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.primary }]}
              onPress={() => { setApiKey(tempApiKey.trim()); setShowApiKeyInput(false); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }}
            >
              <Text style={styles.saveBtnText}>SAVE KEY</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1,
  },
  modelBtn: { flex: 1, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, marginRight: 8, flexDirection: "row", alignItems: "center", gap: 6 },
  modelLabel: { fontFamily: "monospace", fontSize: 9 },
  modelName: { fontFamily: "monospace", fontSize: 12, fontWeight: "bold", flex: 1 },
  providerTag: { fontFamily: "monospace", fontSize: 9 },
  headerRight: { flexDirection: "row", gap: 6 },
  iconBtn: { padding: 6 },
  duckActive: { backgroundColor: "#2a1800" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 20 },
  emptyTitle: { fontFamily: "monospace", fontSize: 22, fontWeight: "bold", letterSpacing: 4 },
  emptySubtitle: { fontFamily: "monospace", fontSize: 12, textAlign: "center", lineHeight: 20 },
  quickPrompts: { gap: 6, width: "100%" },
  quickChip: { borderWidth: 1, padding: 8 },
  quickText: { fontFamily: "monospace", fontSize: 11 },
  setupBtn: { borderWidth: 1, paddingHorizontal: 24, paddingVertical: 10, marginTop: 8 },
  setupBtnText: { fontFamily: "monospace", fontSize: 13, fontWeight: "bold" },
  bubble: { marginVertical: 3, padding: 10, borderWidth: 1, marginHorizontal: 4 },
  userBubble: { marginLeft: 20 },
  assistantBubble: { marginRight: 20 },
  bubbleLabel: { fontFamily: "monospace", fontSize: 9, marginBottom: 5, letterSpacing: 1 },
  bubbleText: { fontFamily: "monospace", fontSize: 12, lineHeight: 18 },
  codeBlock: { marginVertical: 6, backgroundColor: "#000", borderWidth: 1, borderColor: "#330000" },
  codeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "#1a0000" },
  codeLang: { fontFamily: "monospace", fontSize: 9, color: "#880000", letterSpacing: 1 },
  execBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#cc0000", paddingHorizontal: 8, paddingVertical: 3 },
  execBtnText: { fontFamily: "monospace", fontSize: 9, fontWeight: "bold", color: "#000" },
  codeText: { fontFamily: "monospace", fontSize: 11, color: "#44ff44", padding: 8, lineHeight: 17 },
  nextStepsBox: { marginTop: 8, borderTopWidth: 1, borderTopColor: "#1a0000", paddingTop: 6 },
  nextLabel: { fontFamily: "monospace", fontSize: 9, color: "#880000", letterSpacing: 1, marginBottom: 4 },
  nextStep: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 3 },
  nextStepText: { fontFamily: "monospace", fontSize: 11, color: "#cc4400" },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 6 },
  loadingText: { fontFamily: "monospace", fontSize: 11 },
  inputRow: {
    flexDirection: "row", alignItems: "flex-end",
    paddingHorizontal: 8, paddingTop: 8, borderTopWidth: 1, gap: 6,
  },
  micBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#330000" },
  micActive: { backgroundColor: "#220000", borderColor: "#cc0000" },
  input: { flex: 1, fontFamily: "monospace", fontSize: 13, borderWidth: 1, padding: 9, maxHeight: 100, lineHeight: 18 },
  sendBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.88)", justifyContent: "flex-end" },
  modalSheet: { borderTopWidth: 2, padding: 20, maxHeight: "72%" },
  modalTitle: { fontFamily: "monospace", fontSize: 14, fontWeight: "bold", letterSpacing: 3, marginBottom: 14 },
  modalSubtitle: { fontFamily: "monospace", fontSize: 11, lineHeight: 18, marginBottom: 14 },
  modelItem: { borderWidth: 1, padding: 12, marginBottom: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modelItemName: { fontFamily: "monospace", fontSize: 13, fontWeight: "bold" },
  modelItemProvider: { fontFamily: "monospace", fontSize: 10, marginTop: 2 },
  apiKeyInput: { fontFamily: "monospace", fontSize: 12, borderWidth: 1, padding: 12, marginBottom: 12 },
  saveBtn: { padding: 14, alignItems: "center" },
  saveBtnText: { fontFamily: "monospace", fontSize: 14, fontWeight: "bold", color: "#000" },
});
