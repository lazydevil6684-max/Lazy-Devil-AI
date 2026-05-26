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

const SYSTEM_PROMPT = `You are LazyDevil AI — a cybersecurity and penetration testing expert assistant.
You help security researchers with:
- Network scanning, reconnaissance, and enumeration
- Vulnerability assessment and exploitation techniques
- Kali Linux tools and commands
- CTF challenges and write-ups
- Web application security (OWASP Top 10)
- Privilege escalation techniques
- OSINT gathering methods

Be technical, concise, and direct. Format output for terminal display when appropriate.
Always include actual commands, flags, and examples.`;

export default function AIScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    aiMessages,
    addAiMessage,
    clearAiMessages,
    selectedModel,
    setSelectedModel,
    apiKey,
    setApiKey,
    isAiLoading,
    setIsAiLoading,
  } = useApp();

  const [input, setInput] = useState("");
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(apiKey);
  const flatRef = useRef<FlatList>(null);

  useEffect(() => {
    if (aiMessages.length > 0) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [aiMessages.length]);

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

    try {
      let reply: string;

      if (selectedModel.usesBackend) {
        const domain = process.env.EXPO_PUBLIC_DOMAIN;
        const baseUrl = domain ? `https://${domain}` : "";
        const response = await fetch(`${baseUrl}/api/ai/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages }),
        });
        const data = await response.json();
        reply = data?.content ?? "Error: No response from server.";
      } else {
        const response = await fetch(
          `${selectedModel.endpoint}/chat/completions`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
              "HTTP-Referer": "https://lazy-devil.app",
              "X-Title": "Lazy Devil Terminal",
            },
            body: JSON.stringify({
              model: selectedModel.id,
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                ...messages,
              ],
              max_tokens: 2048,
            }),
          }
        );
        const data = await response.json();
        reply =
          data?.choices?.[0]?.message?.content ??
          "Error: No response from model.";
      }

      addAiMessage({ role: "assistant", content: reply });
    } catch {
      addAiMessage({
        role: "assistant",
        content: `[ERROR] Failed to connect to ${selectedModel.provider}. Check connection.`,
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
          style={[styles.modelBtn, { borderColor: colors.primary }]}
          onPress={() => setShowModelPicker(true)}
        >
          <Text style={[styles.modelLabel, { color: colors.terminalDim }]}>MODEL</Text>
          <Text style={[styles.modelName, { color: colors.terminalHead }]} numberOfLines={1}>
            {selectedModel.name}
          </Text>
          <Text style={[styles.providerTag, { color: selectedModel.usesBackend ? "#44ff44" : colors.terminalDim }]}>
            [{selectedModel.provider}]
          </Text>
        </TouchableOpacity>

        <View style={styles.headerRight}>
          {!selectedModel.usesBackend && (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => {
                setTempApiKey(apiKey);
                setShowApiKeyInput(true);
              }}
            >
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
          <Text style={[styles.emptyTitle, { color: colors.primary }]}>LAZY DEVIL AI</Text>
          <Text style={[styles.emptySubtitle, { color: colors.terminalDim }]}>
            {selectedModel.usesBackend
              ? `Free AI ready\n${selectedModel.name} via Replit`
              : apiKey
                ? `Connected to ${selectedModel.name}`
                : `${selectedModel.provider} requires an API key\nGroq.com / OpenRouter.ai (free tier)`}
          </Text>
          {needsApiKey && (
            <TouchableOpacity
              style={[styles.setupBtn, { borderColor: colors.primary }]}
              onPress={() => {
                setTempApiKey("");
                setShowApiKeyInput(true);
              }}
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
          <View
            style={[
              styles.bubble,
              item.role === "user" ? styles.userBubble : styles.assistantBubble,
              {
                backgroundColor: item.role === "user" ? "#1a0000" : "#080000",
                borderColor: item.role === "user" ? colors.primary : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.bubbleLabel,
                { color: item.role === "user" ? colors.primary : colors.terminalDim },
              ]}
            >
              {item.role === "user" ? "ROOT@YOU" : selectedModel.name.toUpperCase()}
            </Text>
            <Text style={[styles.bubbleText, { color: colors.foreground }]} selectable>
              {item.content}
            </Text>
          </View>
        )}
        contentContainerStyle={{ padding: 8, paddingBottom: 8 }}
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
      />

      {isAiLoading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.terminalDim }]}>
            {selectedModel.name} processing...
          </Text>
        </View>
      )}

      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={0}>
        <View
          style={[
            styles.inputRow,
            { borderTopColor: colors.border, paddingBottom: paddingBottom + 90 },
          ]}
        >
          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about pen testing..."
            placeholderTextColor={colors.terminalDim}
            multiline
            onSubmitEditing={() => sendMessage(input)}
            autoCapitalize="none"
            autoCorrect={false}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: isAiLoading ? colors.muted : colors.primary }]}
            onPress={() => sendMessage(input)}
            disabled={isAiLoading}
          >
            <Feather name="send" size={18} color="#000" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={showModelPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModelPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setShowModelPicker(false)}
          activeOpacity={1}
        >
          <View style={[styles.modalSheet, { backgroundColor: "#0a0000", borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.terminalHead }]}>SELECT AI MODEL</Text>
            <ScrollView>
              {AI_MODELS.map((model) => (
                <TouchableOpacity
                  key={model.id}
                  style={[
                    styles.modelItem,
                    { borderColor: selectedModel.id === model.id ? colors.primary : colors.border },
                    selectedModel.id === model.id && { backgroundColor: "#1a0000" },
                  ]}
                  onPress={() => {
                    setSelectedModel(model);
                    setShowModelPicker(false);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <View style={styles.modelItemLeft}>
                    <Text style={[styles.modelItemName, { color: colors.foreground }]}>
                      {model.name}
                    </Text>
                    <Text style={[styles.modelItemProvider, { color: model.usesBackend ? "#44ff44" : colors.terminalDim }]}>
                      {model.provider} · {model.free ? "FREE" : "PAID"}
                      {model.usesBackend ? " · NO KEY NEEDED" : ""}
                    </Text>
                  </View>
                  {selectedModel.id === model.id && (
                    <Feather name="check" size={16} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showApiKeyInput}
        transparent
        animationType="slide"
        onRequestClose={() => setShowApiKeyInput(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setShowApiKeyInput(false)}
          activeOpacity={1}
        >
          <View
            style={[styles.modalSheet, { backgroundColor: "#0a0000", borderColor: colors.border }]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={[styles.modalTitle, { color: colors.terminalHead }]}>API KEY SETUP</Text>
            <Text style={[styles.modalSubtitle, { color: colors.terminalDim }]}>
              Get a free key from groq.com or openrouter.ai{"\n"}
              Stored locally on your device only.
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
              onPress={() => {
                setApiKey(tempApiKey.trim());
                setShowApiKeyInput(false);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }}
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  modelBtn: {
    flex: 1,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  modelLabel: { fontFamily: "monospace", fontSize: 9 },
  modelName: { fontFamily: "monospace", fontSize: 12, fontWeight: "bold", flex: 1 },
  providerTag: { fontFamily: "monospace", fontSize: 9 },
  headerRight: { flexDirection: "row", gap: 8 },
  iconBtn: { padding: 6 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyTitle: { fontFamily: "monospace", fontSize: 22, fontWeight: "bold", letterSpacing: 4 },
  emptySubtitle: { fontFamily: "monospace", fontSize: 12, textAlign: "center", lineHeight: 20 },
  setupBtn: { borderWidth: 1, paddingHorizontal: 24, paddingVertical: 10, marginTop: 8 },
  setupBtnText: { fontFamily: "monospace", fontSize: 13, fontWeight: "bold" },
  bubble: { marginVertical: 4, padding: 12, borderWidth: 1, marginHorizontal: 4 },
  userBubble: { marginLeft: 24 },
  assistantBubble: { marginRight: 24 },
  bubbleLabel: { fontFamily: "monospace", fontSize: 9, marginBottom: 4, letterSpacing: 1 },
  bubbleText: { fontFamily: "monospace", fontSize: 12, lineHeight: 18 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 6 },
  loadingText: { fontFamily: "monospace", fontSize: 11 },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    gap: 8,
  },
  input: {
    flex: 1,
    fontFamily: "monospace",
    fontSize: 13,
    borderWidth: 1,
    padding: 10,
    maxHeight: 100,
    lineHeight: 18,
  },
  sendBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  modalSheet: { borderTopWidth: 2, padding: 20, maxHeight: "70%" },
  modalTitle: { fontFamily: "monospace", fontSize: 14, fontWeight: "bold", letterSpacing: 3, marginBottom: 16 },
  modalSubtitle: { fontFamily: "monospace", fontSize: 11, lineHeight: 18, marginBottom: 16 },
  modelItem: {
    borderWidth: 1,
    padding: 12,
    marginBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modelItemLeft: { flex: 1 },
  modelItemName: { fontFamily: "monospace", fontSize: 13, fontWeight: "bold" },
  modelItemProvider: { fontFamily: "monospace", fontSize: 10, marginTop: 2 },
  apiKeyInput: { fontFamily: "monospace", fontSize: 12, borderWidth: 1, padding: 12, marginBottom: 12 },
  saveBtn: { padding: 14, alignItems: "center" },
  saveBtnText: { fontFamily: "monospace", fontSize: 14, fontWeight: "bold", color: "#000" },
});
