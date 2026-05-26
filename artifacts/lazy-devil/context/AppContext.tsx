import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type Screen = "terminal" | "ai" | "files" | "tools";

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
}

const AppContext = createContext<AppContextType | null>(null);

const STORAGE_KEY_MODEL = "lazy_devil_model_id";
const STORAGE_KEY_APIKEY = "lazy_devil_api_key";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [activeScreen, setActiveScreen] = useState<Screen>("terminal");
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([
    {
      id: "boot-1",
      type: "info",
      content: "╔════════════════════════════════════╗",
      timestamp: Date.now(),
    },
    {
      id: "boot-2",
      type: "info",
      content: "║       LAZY DEVIL TERMINAL v1.0      ║",
      timestamp: Date.now(),
    },
    {
      id: "boot-3",
      type: "info",
      content: "║    Pen Test Suite | AI Powered      ║",
      timestamp: Date.now(),
    },
    {
      id: "boot-4",
      type: "info",
      content: "╚════════════════════════════════════╝",
      timestamp: Date.now(),
    },
    {
      id: "boot-5",
      type: "success",
      content: "[+] Root access granted",
      timestamp: Date.now(),
    },
    {
      id: "boot-6",
      type: "success",
      content: "[+] Kali modules loaded",
      timestamp: Date.now(),
    },
    {
      id: "boot-7",
      type: "output",
      content: 'Type "help" for available commands',
      timestamp: Date.now(),
    },
  ]);
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const [selectedModel, setSelectedModelState] = useState<AiModel>(
    AI_MODELS[0]
  );
  const [apiKey, setApiKeyState] = useState<string>("");
  const [currentPath, setCurrentPath] = useState<string>("/root");
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      const savedModelId = await AsyncStorage.getItem(STORAGE_KEY_MODEL);
      const savedApiKey = await AsyncStorage.getItem(STORAGE_KEY_APIKEY);
      if (savedModelId) {
        const found = AI_MODELS.find((m) => m.id === savedModelId);
        if (found) setSelectedModelState(found);
      }
      if (savedApiKey) setApiKeyState(savedApiKey);
    })();
  }, []);

  const addTerminalLine = useCallback(
    (line: Omit<TerminalLine, "id" | "timestamp">) => {
      const id =
        Date.now().toString() + Math.random().toString(36).substring(2, 9);
      setTerminalLines((prev) => [
        ...prev,
        { ...line, id, timestamp: Date.now() },
      ]);
    },
    []
  );

  const clearTerminal = useCallback(() => setTerminalLines([]), []);

  const addAiMessage = useCallback(
    (msg: Omit<AiMessage, "id" | "timestamp">) => {
      const id =
        Date.now().toString() + Math.random().toString(36).substring(2, 9);
      setAiMessages((prev) => [...prev, { ...msg, id, timestamp: Date.now() }]);
    },
    []
  );

  const clearAiMessages = useCallback(() => setAiMessages([]), []);

  const setSelectedModel = useCallback((model: AiModel) => {
    setSelectedModelState(model);
    AsyncStorage.setItem(STORAGE_KEY_MODEL, model.id);
  }, []);

  const setApiKey = useCallback((key: string) => {
    setApiKeyState(key);
    AsyncStorage.setItem(STORAGE_KEY_APIKEY, key);
  }, []);

  return (
    <AppContext.Provider
      value={{
        activeScreen,
        setActiveScreen,
        terminalLines,
        addTerminalLine,
        clearTerminal,
        aiMessages,
        addAiMessage,
        clearAiMessages,
        selectedModel,
        setSelectedModel,
        apiKey,
        setApiKey,
        currentPath,
        setCurrentPath,
        isAiLoading,
        setIsAiLoading,
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
