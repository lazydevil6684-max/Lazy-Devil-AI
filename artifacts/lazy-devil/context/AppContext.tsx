import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type Screen = "terminal" | "ai" | "files" | "tools" | "ducky" | "bridge" | "netmap";
export type ExecMode = "backend" | "termux";

export interface TerminalLine {
  id: string;
  type: "command" | "output" | "error" | "info" | "success" | "agent" | "thought";
  content: string;
  timestamp: number;
}

export interface AiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface AiModel {
  id: string;
  name: string;
  provider: string;
  endpoint: string;
  free: boolean;
  usesBackend?: boolean;
}

export const AI_MODELS: AiModel[] = [
  { id: "replit-ai", name: "LazyDevil AI", provider: "Replit (Free)", endpoint: "/api/ai/chat", free: true, usesBackend: true },
  { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", provider: "Groq", endpoint: "https://api.groq.com/openai/v1", free: true },
  { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B", provider: "Groq", endpoint: "https://api.groq.com/openai/v1", free: true },
  { id: "meta-llama/llama-4-maverick:free", name: "Llama 4 Maverick", provider: "OpenRouter", endpoint: "https://openrouter.ai/api/v1", free: true },
  { id: "mistralai/mistral-7b-instruct:free", name: "Mistral 7B", provider: "OpenRouter", endpoint: "https://openrouter.ai/api/v1", free: true },
  { id: "deepseek/deepseek-r1:free", name: "DeepSeek R1", provider: "OpenRouter", endpoint: "https://openrouter.ai/api/v1", free: true },
];

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  elapsed: number;
  command: string;
}

interface AppContextType {
  activeScreen: Screen;
  setActiveScreen: (screen: Screen) => void;
  terminalLines: TerminalLine[];
  addTerminalLine: (line: Omit<TerminalLine, "id" | "timestamp">) => void;
  clearTerminal: () => void;
  aiMessages: AiMessage[];
  addAiMessage: (msg: Omit<AiMessage, "id" | "timestamp">) => void;
  clearAiMessages: () => void;
  selectedModel: AiModel;
  setSelectedModel: (model: AiModel) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  currentPath: string;
  setCurrentPath: (path: string) => void;
  isAiLoading: boolean;
  setIsAiLoading: (v: boolean) => void;
  commandHistory: string[];
  addToHistory: (cmd: string) => void;
  clearHistory: () => void;
  executeCommandFromAI: ((cmd: string) => void) | null;
  setExecuteCommandFromAI: (fn: ((cmd: string) => void) | null) => void;
  execMode: ExecMode;
  setExecMode: (m: ExecMode) => void;
  termuxUrl: string;
  setTermuxUrl: (url: string) => void;
  backendUrl: string;
  execCommand: (cmd: string) => Promise<ExecResult>;
}

const AppContext = createContext<AppContextType | null>(null);

const SK_MODEL = "lazy_devil_model_id";
const SK_APIKEY = "lazy_devil_api_key";
const SK_HISTORY = "lazy_devil_cmd_history";
const SK_EXECMODE = "lazy_devil_exec_mode";
const SK_TERMUXURL = "lazy_devil_termux_url";

const BOOT_LINES: TerminalLine[] = [
  { id: "b1", type: "info", content: "╔════════════════════════════════════════════╗", timestamp: 0 },
  { id: "b2", type: "info", content: "║      LAZY DEVIL TERMINAL  v2.1              ║", timestamp: 0 },
  { id: "b3", type: "info", content: "║   Real Execution · AI Agent · NetHunter    ║", timestamp: 0 },
  { id: "b4", type: "info", content: "╚════════════════════════════════════════════╝", timestamp: 0 },
  { id: "b5", type: "success", content: "[+] Root access granted", timestamp: 0 },
  { id: "b6", type: "success", content: "[+] Backend execution: ONLINE (real Linux)", timestamp: 0 },
  { id: "b7", type: "success", content: "[+] AI Agent mode ready", timestamp: 0 },
  { id: "b8", type: "output", content: 'Type "help" | Tap 🤖 for AI Agent | DUCKY tab for payloads', timestamp: 0 },
];

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [activeScreen, setActiveScreen] = useState<Screen>("terminal");
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>(BOOT_LINES);
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const [selectedModel, setSelectedModelState] = useState<AiModel>(AI_MODELS[0]);
  const [apiKey, setApiKeyState] = useState<string>("");
  const [currentPath, setCurrentPath] = useState<string>("/root");
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [executeCommandFromAI, setExecuteCommandFromAI] = useState<((cmd: string) => void) | null>(null);
  const [execMode, setExecModeState] = useState<ExecMode>("backend");
  const [termuxUrl, setTermuxUrlState] = useState<string>("http://192.168.1.100:8765");

  const backendUrl = (() => {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    return domain ? `https://${domain}` : "";
  })();

  useEffect(() => {
    (async () => {
      const [savedModel, savedKey, savedHistory, savedMode, savedTermux] = await Promise.all([
        AsyncStorage.getItem(SK_MODEL),
        AsyncStorage.getItem(SK_APIKEY),
        AsyncStorage.getItem(SK_HISTORY),
        AsyncStorage.getItem(SK_EXECMODE),
        AsyncStorage.getItem(SK_TERMUXURL),
      ]);
      if (savedModel) { const f = AI_MODELS.find(m => m.id === savedModel); if (f) setSelectedModelState(f); }
      if (savedKey) setApiKeyState(savedKey);
      if (savedHistory) { try { setCommandHistory(JSON.parse(savedHistory)); } catch {} }
      if (savedMode) setExecModeState(savedMode as ExecMode);
      if (savedTermux) setTermuxUrlState(savedTermux);
    })();
  }, []);

  const execCommand = useCallback(async (cmd: string): Promise<ExecResult> => {
    try {
      let url: string;
      if (execMode === "termux") {
        url = `${termuxUrl}/exec`;
      } else {
        url = `${backendUrl}/api/execute`;
      }
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd }),
      });
      const data = await resp.json();
      return data as ExecResult;
    } catch (e: any) {
      return { stdout: "", stderr: `[!] Execution failed: ${e?.message ?? "Connection error"}`, exitCode: 1, elapsed: 0, command: cmd };
    }
  }, [execMode, termuxUrl, backendUrl]);

  const addTerminalLine = useCallback((line: Omit<TerminalLine, "id" | "timestamp">) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    setTerminalLines(prev => [...prev, { ...line, id, timestamp: Date.now() }]);
  }, []);

  const clearTerminal = useCallback(() => setTerminalLines([]), []);

  const addAiMessage = useCallback((msg: Omit<AiMessage, "id" | "timestamp">) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    setAiMessages(prev => [...prev, { ...msg, id, timestamp: Date.now() }]);
  }, []);

  const clearAiMessages = useCallback(() => setAiMessages([]), []);

  const setSelectedModel = useCallback((model: AiModel) => {
    setSelectedModelState(model);
    AsyncStorage.setItem(SK_MODEL, model.id);
  }, []);

  const setApiKey = useCallback((key: string) => {
    setApiKeyState(key);
    AsyncStorage.setItem(SK_APIKEY, key);
  }, []);

  const addToHistory = useCallback((cmd: string) => {
    setCommandHistory(prev => {
      const filtered = prev.filter(c => c !== cmd);
      const updated = [cmd, ...filtered].slice(0, 200);
      AsyncStorage.setItem(SK_HISTORY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setCommandHistory([]);
    AsyncStorage.removeItem(SK_HISTORY);
  }, []);

  const setExecMode = useCallback((m: ExecMode) => {
    setExecModeState(m);
    AsyncStorage.setItem(SK_EXECMODE, m);
  }, []);

  const setTermuxUrl = useCallback((url: string) => {
    setTermuxUrlState(url);
    AsyncStorage.setItem(SK_TERMUXURL, url);
  }, []);

  return (
    <AppContext.Provider value={{
      activeScreen, setActiveScreen,
      terminalLines, addTerminalLine, clearTerminal,
      aiMessages, addAiMessage, clearAiMessages,
      selectedModel, setSelectedModel,
      apiKey, setApiKey,
      currentPath, setCurrentPath,
      isAiLoading, setIsAiLoading,
      commandHistory, addToHistory, clearHistory,
      executeCommandFromAI, setExecuteCommandFromAI,
      execMode, setExecMode,
      termuxUrl, setTermuxUrl,
      backendUrl,
      execCommand,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
