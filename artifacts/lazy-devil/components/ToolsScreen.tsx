import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Modal,
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

interface Tool {
  id: string;
  name: string;
  category: string;
  icon: keyof typeof Feather.glyphMap;
  description: string;
  usageHint: string;
  simulate: (target: string) => string;
}

const TOOLS: Tool[] = [
  {
    id: "nmap",
    name: "Nmap",
    category: "RECON",
    icon: "radio",
    description: "Network exploration & security auditing",
    usageHint: "Target: IP or hostname",
    simulate: (t) => {
      const ports = [
        { port: 22, svc: "ssh", state: "open" },
        { port: 80, svc: "http", state: "open" },
        { port: 443, svc: "https", state: "open" },
        { port: 8080, svc: "http-proxy", state: "closed" },
        { port: 3306, svc: "mysql", state: "filtered" },
        { port: 21, svc: "ftp", state: "closed" },
      ];
      let out = `Starting Nmap 7.94\n`;
      out += `Nmap scan report for ${t}\n`;
      out += `Host is up (0.${Math.floor(Math.random() * 90 + 10)}s latency).\n\n`;
      out += `PORT      STATE     SERVICE\n`;
      for (const p of ports) {
        out += `${String(p.port).padEnd(9)}${p.state.padEnd(10)}${p.svc}\n`;
      }
      out += `\nNmap done: 1 IP scanned in ${(Math.random() * 4 + 0.5).toFixed(2)}s`;
      return out;
    },
  },
  {
    id: "hydra",
    name: "Hydra",
    category: "EXPLOIT",
    icon: "zap",
    description: "Fast network login cracker",
    usageHint: "Target: IP:port (e.g. 192.168.1.1:22)",
    simulate: (t) => {
      const words = Math.floor(Math.random() * 5000 + 1000);
      return `Hydra v9.4 starting...\n[DATA] 16 tasks, 1 server, ${words} login tries\n[DATA] attacking ssh://${t}/\n[STATUS] ${Math.floor(words * 0.3)} of ${words} done\n[22][ssh] host: ${t.split(":")[0]}   login: admin   password: admin123\n[STATUS] attack finished for ${t}\n1 valid password found`;
    },
  },
  {
    id: "sqlmap",
    name: "SQLMap",
    category: "EXPLOIT",
    icon: "database",
    description: "Automatic SQL injection tool",
    usageHint: "Target: Full URL with parameter",
    simulate: (t) => {
      return `[*] testing connection to ${t}\n[*] testing if the target URL content is stable\n[+] target URL content is stable\n[*] testing if GET parameter 'id' is dynamic\n[+] GET parameter 'id' appears to be dynamic\n[+] heuristic detects that target is injectable\n[!] heuristic (basic) test shows possible SQLi at '${t}'\n[*] testing for SQL injection\n[+] MySQL >= 5.0 AND error-based\n[*] fetching database names\navailable databases [3]:\n[*] information_schema\n[*] mysql\n[*] target_db`;
    },
  },
  {
    id: "hashcat",
    name: "Hashcat",
    category: "PASSWORD",
    icon: "lock",
    description: "World's fastest password recovery",
    usageHint: "Target: Hash value to crack",
    simulate: (t) => {
      const cracked = Math.random() > 0.3;
      return `hashcat (v6.2.6) starting...\n\nOpenCL API (OpenCL 3.0)\nDevice #1: NVIDIA GPU\n\nDictionary cache hit:\n* Filename..: rockyou.txt\n* Passwords.: 14,344,391\n\n${t}:${cracked ? "password123" : "[NOT FOUND]"}\n\nSession..........: hashcat\nStatus...........: ${cracked ? "Cracked" : "Exhausted"}\nHash.Mode........: 0 (MD5)\nTime.Estimated...: ${(Math.random() * 30 + 1).toFixed(0)} secs\nSpeed.#1.........: ${Math.floor(Math.random() * 5000 + 500)} MH/s`;
    },
  },
  {
    id: "metasploit",
    name: "MSFconsole",
    category: "EXPLOIT",
    icon: "terminal",
    description: "Metasploit Framework console",
    usageHint: "Target: IP address",
    simulate: (t) => {
      return `       =[ metasploit v6.3.44-dev\n+ -- --=[ 2376 exploits - 1232 auxiliary\n\nmsf6 > use exploit/multi/handler\nmsf6 exploit(multi/handler) > set RHOST ${t}\nRHOST => ${t}\nmsf6 exploit(multi/handler) > set PAYLOAD windows/x64/meterpreter/reverse_tcp\nPAYLOAD => windows/x64/meterpreter/reverse_tcp\nmsf6 exploit(multi/handler) > run\n\n[*] Started reverse TCP handler on 0.0.0.0:4444\n[*] Sending stage (200774 bytes) to ${t}\n[*] Meterpreter session 1 opened\n\nmeterpreter > getuid\nServer username: NT AUTHORITY\\SYSTEM`;
    },
  },
  {
    id: "aircrack",
    name: "Aircrack-ng",
    category: "WIRELESS",
    icon: "wifi",
    description: "WiFi network security auditing",
    usageHint: "Target: BSSID (e.g. AA:BB:CC:DD:EE:FF)",
    simulate: (t) => {
      const key = ["RedDevil2024", "admin123", "password!", "hack3rz"][Math.floor(Math.random() * 4)];
      return `Aircrack-ng 1.7\n\n[00:03:42] 25238/14344391 keys tested (1829.93 k/s)\n\nTime left: 2 hours, 10 minutes, 21 seconds          0.18%\n\n                   KEY FOUND! [ ${key} ]\n\nMaster Key     : A3 B7 C2 D9 E4 F1 2A 3B\nTransient Key  : 11 22 33 44 55 66 77 88\nMAC: ${t}\nEAPOL HMAC    : 9F 8E 7D 6C 5B 4A 3F 2E`;
    },
  },
  {
    id: "nikto",
    name: "Nikto",
    category: "WEB",
    icon: "globe",
    description: "Web server vulnerability scanner",
    usageHint: "Target: URL or IP",
    simulate: (t) => {
      return `- Nikto v2.1.6\n---------------------------------------------------------------------------\n+ Target IP:          ${t}\n+ Target Hostname:    ${t}\n+ Target Port:        80\n---------------------------------------------------------------------------\n+ Server: Apache/2.4.29\n+ Retrieved x-powered-by header: PHP/7.2.24\n+ The anti-clickjacking X-Frame-Options header is not present.\n+ Allowed HTTP Methods: GET, POST, OPTIONS, HEAD\n+ OSVDB-3268: /admin/: Directory indexing found.\n+ /wp-login.php: WordPress login page found.\n+ OSVDB-3233: /icons/README: Apache default file found.\n+ 7914 requests: 0 error(s) and 8 item(s) reported`;
    },
  },
  {
    id: "gobuster",
    name: "GoBuster",
    category: "WEB",
    icon: "search",
    description: "Directory and DNS busting tool",
    usageHint: "Target: Base URL",
    simulate: (t) => {
      const dirs = ["/admin", "/login", "/api", "/backup", "/wp-content", "/.git", "/uploads", "/config", "/dashboard", "/secret"];
      let out = `===============================================================\nGobuster v3.6\n===============================================================\n[+] URL: ${t}\n[+] Wordlist: /usr/share/dirb/wordlists/common.txt\n===============================================================\n`;
      for (const d of dirs.slice(0, 7)) {
        out += `/${d.slice(1).padEnd(20)} (Status: ${Math.random() > 0.3 ? "200" : "403"}) [Size: ${Math.floor(Math.random() * 9000 + 200)}]\n`;
      }
      out += `===============================================================\nDone: 4614 requests in 12.345s`;
      return out;
    },
  },
];

const CATEGORIES = ["ALL", ...Array.from(new Set(TOOLS.map((t) => t.category)))];

export default function ToolsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addTerminalLine, setActiveScreen } = useApp();
  const [category, setCategory] = useState("ALL");
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [target, setTarget] = useState("");
  const [output, setOutput] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const filtered = TOOLS.filter((t) => category === "ALL" || t.category === category);

  const runTool = async () => {
    if (!selectedTool || !target.trim() || running) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setRunning(true);
    setOutput(null);

    await new Promise((r) => setTimeout(r, 800 + Math.random() * 1200));
    const result = selectedTool.simulate(target.trim());
    setOutput(result);
    setRunning(false);

    addTerminalLine({
      type: "success",
      content: `[+] ${selectedTool.name} completed against ${target.trim()}`,
    });
  };

  const sendToTerminal = () => {
    if (!output || !selectedTool) return;
    for (const line of output.split("\n")) {
      addTerminalLine({ type: "output", content: line });
    }
    setActiveScreen("terminal");
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.catRow, { borderBottomColor: colors.border }]}
        contentContainerStyle={{ gap: 6, paddingHorizontal: 10, paddingVertical: 8 }}
      >
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.catBtn,
              { borderColor: category === cat ? colors.primary : colors.border },
              category === cat && { backgroundColor: "#1a0000" },
            ]}
            onPress={() => setCategory(cat)}
          >
            <Text
              style={[
                styles.catBtnText,
                { color: category === cat ? colors.terminalHead : colors.terminalDim },
              ]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{
          padding: 10,
          paddingBottom: insets.bottom + 100,
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        {filtered.map((tool) => (
          <TouchableOpacity
            key={tool.id}
            style={[
              styles.toolCard,
              {
                borderColor:
                  selectedTool?.id === tool.id ? colors.primary : colors.border,
                backgroundColor:
                  selectedTool?.id === tool.id ? "#1a0000" : "#080000",
                width: "47%",
              },
            ]}
            onPress={() => {
              setSelectedTool(tool);
              setOutput(null);
              setTarget("");
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <View style={[styles.toolIconRow]}>
              <Feather name={tool.icon} size={20} color={colors.primary} />
              <Text style={[styles.toolCategory, { color: colors.terminalDim }]}>
                {tool.category}
              </Text>
            </View>
            <Text style={[styles.toolName, { color: colors.terminalHead }]}>{tool.name}</Text>
            <Text style={[styles.toolDesc, { color: colors.terminalDim }]} numberOfLines={2}>
              {tool.description}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal
        visible={!!selectedTool}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedTool(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: "#050000", borderColor: colors.primary }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.terminalHead }]}>
                  {selectedTool?.name}
                </Text>
                <Text style={[styles.modalDesc, { color: colors.terminalDim }]}>
                  {selectedTool?.description}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setSelectedTool(null);
                  setOutput(null);
                }}
              >
                <Feather name="x" size={20} color={colors.terminalDim} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: colors.terminalDim }]}>
              {selectedTool?.usageHint}
            </Text>
            <TextInput
              style={[styles.targetInput, { color: colors.foreground, borderColor: colors.border }]}
              value={target}
              onChangeText={setTarget}
              placeholder="Enter target..."
              placeholderTextColor={colors.terminalDim}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={[
                styles.runBtn,
                { backgroundColor: running ? colors.muted : colors.primary },
              ]}
              onPress={runTool}
              disabled={running || !target.trim()}
            >
              <Feather name={running ? "loader" : "play"} size={14} color="#000" />
              <Text style={styles.runBtnText}>
                {running ? "RUNNING..." : `LAUNCH ${selectedTool?.name.toUpperCase()}`}
              </Text>
            </TouchableOpacity>

            {output && (
              <>
                <ScrollView
                  style={[styles.outputBox, { borderColor: colors.border }]}
                  nestedScrollEnabled
                >
                  <Text style={[styles.outputText, { color: colors.foreground }]} selectable>
                    {output}
                  </Text>
                </ScrollView>
                <TouchableOpacity
                  style={[styles.sendBtn, { borderColor: colors.border }]}
                  onPress={sendToTerminal}
                >
                  <Feather name="terminal" size={13} color={colors.primary} />
                  <Text style={[styles.sendBtnText, { color: colors.primary }]}>
                    SEND TO TERMINAL
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  catRow: { borderBottomWidth: 1, flexGrow: 0 },
  catBtn: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  catBtnText: { fontFamily: "monospace", fontSize: 10, fontWeight: "bold" },
  toolCard: {
    borderWidth: 1,
    padding: 12,
    minHeight: 100,
  },
  toolIconRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  toolCategory: { fontFamily: "monospace", fontSize: 9, letterSpacing: 1 },
  toolName: { fontFamily: "monospace", fontSize: 14, fontWeight: "bold", marginBottom: 4 },
  toolDesc: { fontFamily: "monospace", fontSize: 10, lineHeight: 14 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopWidth: 2,
    padding: 20,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  modalTitle: { fontFamily: "monospace", fontSize: 18, fontWeight: "bold", letterSpacing: 2 },
  modalDesc: { fontFamily: "monospace", fontSize: 11, marginTop: 4 },
  label: { fontFamily: "monospace", fontSize: 10, marginBottom: 6 },
  targetInput: {
    fontFamily: "monospace",
    fontSize: 13,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  runBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    marginBottom: 12,
  },
  runBtnText: { fontFamily: "monospace", fontSize: 13, fontWeight: "bold", color: "#000" },
  outputBox: { maxHeight: 200, borderWidth: 1, padding: 10, marginBottom: 10 },
  outputText: { fontFamily: "monospace", fontSize: 10, lineHeight: 16 },
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    padding: 10,
  },
  sendBtnText: { fontFamily: "monospace", fontSize: 11, fontWeight: "bold" },
});
