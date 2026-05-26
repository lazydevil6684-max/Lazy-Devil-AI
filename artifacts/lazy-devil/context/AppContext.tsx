import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type Screen = "terminal" | "ai" | "files" | "tools" | "ducky";

export interface TerminalLine {
  id: string;
  type: "command" | "output" | "error" | "info" | "success";
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
  {
    id: "replit-ai",
    name: "LazyDevil AI",
    provider: "Replit (Free)",
    endpoint: "/api/ai/chat",
    free: true,
    usesBackend: true,
  },
  {
    id: "llama-3.3-70b-versatile",
    name: "Llama 3.3 70B",
    provider: "Groq",
    endpoint: "https://api.groq.com/openai/v1",
    free: true,
  },
  {
    id: "mixtral-8x7b-32768",
    name: "Mixtral 8x7B",
    provider: "Groq",
    endpoint: "https://api.groq.com/openai/v1",
    free: true,
  },
  {
    id: "meta-llama/llama-4-maverick:free",
    name: "Llama 4 Maverick",
    provider: "OpenRouter",
    endpoint: "https://openrouter.ai/api/v1",
    free: true,
  },
  {
    id: "mistralai/mistral-7b-instruct:free",
    name: "Mistral 7B",
    provider: "OpenRouter",
    endpoint: "https://openrouter.ai/api/v1",
    free: true,
  },
  {
    id: "deepseek/deepseek-r1:free",
    name: "DeepSeek R1",
    provider: "OpenRouter",
    endpoint: "https://openrouter.ai/api/v1",
    free: true,
  },
];

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
}

const AppContext = createContext<AppContextType | null>(null);

const STORAGE_KEY_MODEL = "lazy_devil_model_id";
const STORAGE_KEY_APIKEY = "lazy_devil_api_key";
const STORAGE_KEY_HISTORY = "lazy_devil_cmd_history";

const BOOT_LINES: TerminalLine[] = [
  { id: "b1", type: "info", content: "╔════════════════════════════════════════╗", timestamp: 0 },
  { id: "b2", type: "info", content: "║      LAZY DEVIL TERMINAL  v2.0         ║", timestamp: 0 },
  { id: "b3", type: "info", content: "║   Pen Test Suite · AI · NetHunter      ║", timestamp: 0 },
  { id: "b4", type: "info", content: "╚════════════════════════════════════════╝", timestamp: 0 },
  { id: "b5", type: "success", content: "[+] Root access granted", timestamp: 0 },
  { id: "b6", type: "success", content: "[+] Kali modules loaded (28 tools)", timestamp: 0 },
  { id: "b7", type: "success", content: "[+] NetHunter framework initialized", timestamp: 0 },
  { id: "b8", type: "output", content: 'Type "help" for available commands | Voice: tap mic', timestamp: 0 },
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

  useEffect(() => {
    (async () => {
      const [savedModelId, savedApiKey, savedHistory] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY_MODEL),
        AsyncStorage.getItem(STORAGE_KEY_APIKEY),
        AsyncStorage.getItem(STORAGE_KEY_HISTORY),
      ]);
      if (savedModelId) {
        const found = AI_MODELS.find((m) => m.id === savedModelId);
        if (found) setSelectedModelState(found);
      }
      if (savedApiKey) setApiKeyState(savedApiKey);
      if (savedHistory) {
        try { setCommandHistory(JSON.parse(savedHistory)); } catch {}
      }
    })();
  }, []);

  const addTerminalLine = useCallback((line: Omit<TerminalLine, "id" | "timestamp">) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    setTerminalLines((prev) => [...prev, { ...line, id, timestamp: Date.now() }]);
  }, []);

  const clearTerminal = useCallback(() => setTerminalLines([]), []);

  const addAiMessage = useCallback((msg: Omit<AiMessage, "id" | "timestamp">) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    setAiMessages((prev) => [...prev, { ...msg, id, timestamp: Date.now() }]);
  }, []);

  const clearAiMessages = useCallback(() => setAiMessages([]), []);

  const setSelectedModel = useCallback((model: AiModel) => {
    setSelectedModelState(model);
    AsyncStorage.setItem(STORAGE_KEY_MODEL, model.id);
  }, []);

  const setApiKey = useCallback((key: string) => {
    setApiKeyState(key);
    AsyncStorage.setItem(STORAGE_KEY_APIKEY, key);
  }, []);

  const addToHistory = useCallback((cmd: string) => {
    setCommandHistory((prev) => {
      const filtered = prev.filter((c) => c !== cmd);
      const updated = [cmd, ...filtered].slice(0, 200);
      AsyncStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setCommandHistory([]);
    AsyncStorage.removeItem(STORAGE_KEY_HISTORY);
  }, []);

  return (
    <AppContext.Provider
      value={{
        activeScreen, setActiveScreen,
        terminalLines, addTerminalLine, clearTerminal,
        aiMessages, addAiMessage, clearAiMessages,
        selectedModel, setSelectedModel,
        apiKey, setApiKey,
        currentPath, setCurrentPath,
        isAiLoading, setIsAiLoading,
        commandHistory, addToHistory, clearHistory,
        executeCommandFromAI, setExecuteCommandFromAI,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
