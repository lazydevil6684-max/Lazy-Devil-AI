import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
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
LAZY DEVIL TERMINAL - Available Commands:
─────────────────────────────────────────
NAVIGATION
  ls [dir]        List directory contents
  cd <dir>        Change directory
  pwd             Print working directory
  cat <file>      Display file contents

NETWORK TOOLS
  ping <host>     Ping a host
  nmap <target>   Port scan (simulated)
  whois <domain>  WHOIS lookup (simulated)
  curl <url>      HTTP request (simulated)
  traceroute <h>  Trace route (simulated)

SYSTEM
  whoami          Current user
  uname -a        System info
  ps aux          Running processes
  ifconfig        Network interfaces
  id              User/group IDs

AI
  ai <query>      Ask AI assistant

MISC
  clear           Clear terminal
  help            Show this help
  banner          Show banner
`.trim();

const BANNER = `
 _                        ____             _ _
| |    __ _ _____   _   |  _ \\  _____   _(_) |
| |   / _\` |_  / | | |  | | | |/ _ \\ \\ / / | |
| |__| (_| |/ /| |_| |  | |_| |  __/\\ V /| | |
|_____\\__,_/___|\\__, |  |____/ \\___| \\_/ |_|_|
                |___/
`.trim();

function simulateNmap(target: string): string[] {
  const ports = [
    { port: 22, service: "ssh", state: "open" },
    { port: 80, service: "http", state: "open" },
    { port: 443, service: "https", state: "open" },
    { port: 3306, service: "mysql", state: "filtered" },
    { port: 8080, service: "http-proxy", state: "closed" },
    { port: 21, service: "ftp", state: "closed" },
    { port: 25, service: "smtp", state: "filtered" },
    { port: 3389, service: "rdp", state: "filtered" },
  ];
  const lines = [
    `Starting Nmap 7.94 ( https://nmap.org )`,
    `Nmap scan report for ${target}`,
    `Host is up (0.${Math.floor(Math.random() * 90 + 10)}s latency).`,
    `Not shown: 992 closed tcp ports`,
    `PORT      STATE     SERVICE     VERSION`,
  ];
  for (const p of ports) {
    lines.push(
      `${String(p.port).padEnd(9)}${p.state.padEnd(10)}${p.service}`
    );
  }
  lines.push(`Nmap done: 1 IP address (1 host up) scanned in ${(Math.random() * 3 + 0.5).toFixed(2)} seconds`);
  return lines;
}

function simulatePing(host: string): string[] {
  const ip = `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  return [
    `PING ${host} (${ip}) 56(84) bytes of data.`,
    `64 bytes from ${ip}: icmp_seq=1 ttl=55 time=${(Math.random() * 50 + 5).toFixed(1)} ms`,
    `64 bytes from ${ip}: icmp_seq=2 ttl=55 time=${(Math.random() * 50 + 5).toFixed(1)} ms`,
    `64 bytes from ${ip}: icmp_seq=3 ttl=55 time=${(Math.random() * 50 + 5).toFixed(1)} ms`,
    ``,
    `--- ${host} ping statistics ---`,
    `3 packets transmitted, 3 received, 0% packet loss`,
  ];
}

function simulateWhois(domain: string): string[] {
  return [
    `Domain Name: ${domain.toUpperCase()}`,
    `Registry Domain ID: D${Math.floor(Math.random() * 999999999)}`,
    `Registrar: GoDaddy.com, LLC`,
    `Updated Date: 2024-01-${Math.floor(Math.random() * 28 + 1).toString().padStart(2, "0")}`,
    `Creation Date: ${2000 + Math.floor(Math.random() * 20)}-06-15`,
    `Registry Expiry Date: 2026-06-15`,
    `Name Server: NS1.CLOUDFLARE.COM`,
    `Name Server: NS2.CLOUDFLARE.COM`,
    `DNSSEC: unsigned`,
  ];
}

function simulateTraceroute(host: string): string[] {
  const hops = Math.floor(Math.random() * 8 + 6);
  const lines = [`traceroute to ${host}, 30 hops max, 60 byte packets`];
  for (let i = 1; i <= hops; i++) {
    const ip = `10.${i}.${Math.floor(Math.random() * 254)}.${Math.floor(Math.random() * 254)}`;
    const ms = (i * 3 + Math.random() * 10).toFixed(3);
    lines.push(` ${String(i).padStart(2)}  ${ip}  ${ms} ms`);
  }
  return lines;
}

interface TerminalLineProps {
  line: { type: string; content: string };
}

function TLine({ line }: TerminalLineProps) {
  const colors = useColors();
  const color =
    line.type === "command"
      ? colors.terminalHead
      : line.type === "error"
        ? "#ff4444"
        : line.type === "success"
          ? "#44ff44"
          : line.type === "info"
            ? colors.foreground
            : colors.terminalBody;

  return (
    <Text
      style={{
        color,
        fontFamily: "monospace",
        fontSize: 12,
        lineHeight: 18,
        paddingHorizontal: 8,
      }}
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
    terminalLines,
    addTerminalLine,
    clearTerminal,
    currentPath,
    setCurrentPath,
    setActiveScreen,
    addAiMessage,
    selectedModel,
    apiKey,
    isAiLoading,
    setIsAiLoading,
  } = useApp();

  const [input, setInput] = useState("");
  const flatRef = useRef<FlatList>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatRef.current?.scrollToEnd({ animated: true });
    }, 50);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [terminalLines.length]);

  const runCommand = useCallback(
    async (cmd: string) => {
      const trimmed = cmd.trim();
      if (!trimmed) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      addTerminalLine({ type: "command", content: trimmed });
      const parts = trimmed.split(/\s+/);
      const command = parts[0].toLowerCase();
      const args = parts.slice(1);

      switch (command) {
        case "clear":
          clearTerminal();
          break;

        case "help":
          for (const line of HELP_TEXT.split("\n")) {
            addTerminalLine({ type: "output", content: line });
          }
          break;

        case "banner":
          for (const line of BANNER.split("\n")) {
            addTerminalLine({ type: "info", content: line });
          }
          break;

        case "whoami":
          addTerminalLine({ type: "output", content: "root" });
          break;

        case "id":
          addTerminalLine({ type: "output", content: "uid=0(root) gid=0(root) groups=0(root)" });
          break;

        case "pwd":
          addTerminalLine({ type: "output", content: currentPath });
          break;

        case "uname":
          addTerminalLine({
            type: "output",
            content: "Linux LazyDevil 5.15.0-kali3-amd64 #1 SMP Debian 5.15.15-2kali1 x86_64 GNU/Linux",
          });
          break;

        case "ifconfig":
          addTerminalLine({ type: "output", content: "eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>" });
          addTerminalLine({ type: "output", content: "        inet 192.168.1.100  netmask 255.255.255.0" });
          addTerminalLine({ type: "output", content: "        inet6 fe80::1  prefixlen 64" });
          addTerminalLine({ type: "output", content: "lo: flags=73<UP,LOOPBACK,RUNNING>" });
          addTerminalLine({ type: "output", content: "        inet 127.0.0.1  netmask 255.0.0.0" });
          break;

        case "ps": {
          addTerminalLine({ type: "output", content: "USER       PID %CPU %MEM COMMAND" });
          const procs = ["sshd", "bash", "python3", "metasploit", "nmap", "burpsuite"];
          for (const p of procs) {
            addTerminalLine({
              type: "output",
              content: `root      ${Math.floor(Math.random() * 9000 + 1000)}  ${(Math.random() * 5).toFixed(1)}  ${(Math.random() * 2).toFixed(1)} ${p}`,
            });
          }
          break;
        }

        case "ping":
          if (!args[0]) {
            addTerminalLine({ type: "error", content: "ping: usage: ping <host>" });
          } else {
            for (const line of simulatePing(args[0])) {
              addTerminalLine({ type: "output", content: line });
            }
          }
          break;

        case "nmap":
          if (!args[0]) {
            addTerminalLine({ type: "error", content: "nmap: usage: nmap <target>" });
          } else {
            addTerminalLine({ type: "info", content: `[*] Scanning ${args[0]}...` });
            for (const line of simulateNmap(args[0])) {
              addTerminalLine({ type: "output", content: line });
            }
          }
          break;

        case "whois":
          if (!args[0]) {
            addTerminalLine({ type: "error", content: "whois: usage: whois <domain>" });
          } else {
            for (const line of simulateWhois(args[0])) {
              addTerminalLine({ type: "output", content: line });
            }
          }
          break;

        case "traceroute":
          if (!args[0]) {
            addTerminalLine({ type: "error", content: "traceroute: usage: traceroute <host>" });
          } else {
            for (const line of simulateTraceroute(args[0])) {
              addTerminalLine({ type: "output", content: line });
            }
          }
          break;

        case "curl":
          addTerminalLine({ type: "output", content: `> GET ${args[0] || "/"} HTTP/1.1` });
          addTerminalLine({ type: "output", content: `< HTTP/1.1 200 OK` });
          addTerminalLine({ type: "output", content: `< Content-Type: text/html; charset=UTF-8` });
          addTerminalLine({ type: "output", content: `< Server: nginx/1.22.0` });
          break;

        case "ls": {
          const targetPath = args[0] || currentPath;
          try {
            const info = await FileSystem.getInfoAsync(targetPath);
            if (info.exists && info.isDirectory) {
              const items = await FileSystem.readDirectoryAsync(targetPath);
              if (items.length === 0) {
                addTerminalLine({ type: "output", content: "(empty)" });
              } else {
                addTerminalLine({ type: "output", content: items.join("  ") });
              }
            } else {
              const defaultDirs = ["bin", "dev", "etc", "home", "lib", "proc", "root", "sys", "tmp", "usr", "var"];
              addTerminalLine({ type: "output", content: defaultDirs.join("  ") });
            }
          } catch {
            const defaultDirs = ["bin", "dev", "etc", "home", "lib", "proc", "root", "sys", "tmp", "usr", "var"];
            addTerminalLine({ type: "output", content: defaultDirs.join("  ") });
          }
          break;
        }

        case "cd":
          if (!args[0] || args[0] === "~") {
            setCurrentPath("/root");
            addTerminalLine({ type: "success", content: "[+] Changed to /root" });
          } else if (args[0] === "..") {
            const parts2 = currentPath.split("/").filter(Boolean);
            parts2.pop();
            const newPath = "/" + parts2.join("/") || "/";
            setCurrentPath(newPath);
          } else {
            const newPath = args[0].startsWith("/")
              ? args[0]
              : `${currentPath}/${args[0]}`;
            setCurrentPath(newPath);
          }
          break;

        case "cat":
          if (!args[0]) {
            addTerminalLine({ type: "error", content: "cat: usage: cat <file>" });
          } else {
            try {
              const content = await FileSystem.readAsStringAsync(args[0]);
              for (const line of content.split("\n").slice(0, 50)) {
                addTerminalLine({ type: "output", content: line });
              }
            } catch {
              addTerminalLine({ type: "error", content: `cat: ${args[0]}: No such file or directory` });
            }
          }
          break;

        case "ai": {
          const query = args.join(" ");
          if (!query) {
            addTerminalLine({ type: "error", content: "Usage: ai <your question>" });
          } else if (!apiKey) {
            addTerminalLine({ type: "error", content: "[!] No API key set. Go to AI tab > Settings." });
          } else {
            setActiveScreen("ai");
            addAiMessage({ role: "user", content: query });
          }
          break;
        }

        default:
          addTerminalLine({
            type: "error",
            content: `bash: ${command}: command not found`,
          });
      }
    },
    [addTerminalLine, clearTerminal, currentPath, setCurrentPath, setActiveScreen, addAiMessage, apiKey, setIsAiLoading, selectedModel]
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <Text style={[styles.headerText, { color: colors.terminalHead }]}>
          root@lazy-devil:{currentPath}
        </Text>
      </View>

      <FlatList
        ref={flatRef}
        data={terminalLines}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TLine line={item} />}
        style={styles.output}
        contentContainerStyle={{ paddingVertical: 4 }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={scrollToBottom}
      />

      <View
        style={[
          styles.inputRow,
          {
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + 90,
          },
        ]}
      >
        <Text style={[styles.prompt, { color: colors.terminalHead }]}>
          # {" "}
        </Text>
        <TextInput
          style={[styles.input, { color: colors.foreground }]}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => {
            runCommand(input);
            setInput("");
          }}
          returnKeyType="send"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          placeholderTextColor={colors.terminalDim}
          placeholder="enter command..."
          blurOnSubmit={false}
        />
        <TouchableOpacity
          onPress={() => {
            runCommand(input);
            setInput("");
          }}
          style={[styles.runBtn, { borderColor: colors.primary }]}
        >
          <Text style={[styles.runBtnText, { color: colors.primary }]}>RUN</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#330000",
  },
  headerText: { fontFamily: "monospace", fontSize: 11 },
  output: { flex: 1 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  prompt: { fontFamily: "monospace", fontSize: 14, fontWeight: "bold" },
  input: {
    flex: 1,
    fontFamily: "monospace",
    fontSize: 13,
    paddingVertical: 6,
  },
  runBtn: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginLeft: 6,
  },
  runBtnText: { fontFamily: "monospace", fontSize: 11, fontWeight: "bold" },
});
