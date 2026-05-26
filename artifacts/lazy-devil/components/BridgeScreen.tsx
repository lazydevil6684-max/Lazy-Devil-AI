import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";

const TERMUX_BRIDGE_SCRIPT = `#!/data/data/com.termux/files/usr/bin/bash
# Lazy Devil Bridge — run this in Termux
# Install deps: pkg install python && pip install flask

cat > /tmp/lazy_bridge.py << 'PYEOF'
from flask import Flask, request, jsonify
import subprocess, os, socket

app = Flask(__name__)

@app.route('/exec', methods=['POST'])
def execute():
    data = request.json or {}
    cmd = data.get('command', '').strip()
    if not cmd:
        return jsonify({'error': 'no command'}), 400
    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True,
            text=True, timeout=30, env={**os.environ}
        )
        return jsonify({
            'stdout': result.stdout[:50000],
            'stderr': result.stderr[:5000],
            'exitCode': result.returncode,
            'elapsed': 0, 'command': cmd
        })
    except Exception as e:
        return jsonify({'stdout':'','stderr':str(e),'exitCode':1,'elapsed':0,'command':cmd})

@app.route('/termux', methods=['POST'])
def termux_api():
    data = request.json or {}
    cmd = data.get('command', '').strip()
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=15)
        return jsonify({'result': result.stdout, 'error': result.stderr})
    except Exception as e:
        return jsonify({'result': '', 'error': str(e)})

if __name__ == '__main__':
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.connect(("8.8.8.8", 80))
    ip = s.getsockname()[0]
    s.close()
    print(f"\\n[+] Lazy Devil Bridge ONLINE")
    print(f"[+] Phone IP: {ip}")
    print(f"[+] Set bridge URL to: http://{ip}:8765")
    print(f"[+] Ctrl+C to stop\\n")
    app.run(host='0.0.0.0', port=8765)
PYEOF
python /tmp/lazy_bridge.py`;

const BUILD_STEPS = [
  {
    n: "1",
    title: "Create Free Expo Account",
    desc: "Sign up at expo.dev — free, takes 30 seconds.",
    action: "Open expo.dev",
    url: "https://expo.dev/signup",
    cmd: null,
  },
  {
    n: "2",
    title: "Install EAS CLI",
    desc: "Run in your computer terminal:",
    action: "Copy command",
    url: null,
    cmd: "npm install -g eas-cli",
  },
  {
    n: "3",
    title: "Login to EAS",
    desc: "Authenticate with your Expo account:",
    action: "Copy command",
    url: null,
    cmd: "eas login",
  },
  {
    n: "4",
    title: "Clone This Project",
    desc: "Download the project source (from Replit):",
    action: "Copy command",
    url: null,
    cmd: "# Download from Replit → Tools → Download as zip\n# Or: git clone <your-replit-git-url>",
  },
  {
    n: "5",
    title: "Install Dependencies",
    desc: "In the lazy-devil folder:",
    action: "Copy command",
    url: null,
    cmd: "cd artifacts/lazy-devil\npnpm install",
  },
  {
    n: "6",
    title: "Build APK (Cloud Build)",
    desc: "EAS builds the APK in the cloud — takes ~5 min. You get a download link when done:",
    action: "Copy command",
    url: null,
    cmd: "eas build --platform android --profile preview",
  },
  {
    n: "7",
    title: "Install on Phone",
    desc: "Download the APK from the EAS dashboard link. Enable 'Install from unknown sources' in Android settings, then install.",
    action: "Open EAS builds",
    url: "https://expo.dev/accounts/[your-account]/projects/lazy-devil/builds",
    cmd: null,
  },
  {
    n: "8",
    title: "Grant Magisk Root",
    desc: "Open Magisk → Superuser tab → grant root to 'Lazy Devil Terminal'. Now `su` commands work natively inside the app.",
    action: null,
    url: null,
    cmd: null,
  },
];

const MAGISK_STEPS = [
  { step: "1", title: "Unlock Bootloader", desc: "Settings → Developer Options → OEM Unlocking. Then: `adb reboot bootloader && fastboot flashing unlock`" },
  { step: "2", title: "Flash TWRP Recovery", desc: "Download TWRP for your device model. Flash: `fastboot flash recovery twrp.img && fastboot boot twrp.img`" },
  { step: "3", title: "Install Magisk ZIP", desc: "In TWRP: Install → select Magisk.zip. Or patch boot.img via Magisk App and flash with fastboot." },
  { step: "4", title: "Install Termux (F-Droid)", desc: "Install from F-Droid only (not Play Store — outdated).\nhttps://f-droid.org/packages/com.termux/" },
  { step: "5", title: "Install Termux:API", desc: "Also from F-Droid. Then in Termux: `pkg install termux-api`" },
  { step: "6", title: "Grant Termux Root", desc: "Open Magisk → Superuser → grant root to Termux. Then `tsu` gives root shell." },
  { step: "7", title: "Run Lazy Devil Bridge", desc: "In Termux: `pkg install python && pip install flask`\nThen paste the bridge script from the SETUP tab." },
  { step: "8", title: "Install NetHunter (Optional)", desc: "Install NetHunter Store APK for full Kali toolset on device.\nhttps://store.nethunter.com" },
];

const TERMUX_APIS = [
  { name: "termux-battery-status", desc: "Battery level, health, status" },
  { name: "termux-camera-photo -c 0", desc: "Take photo (back camera)" },
  { name: "termux-clipboard-get", desc: "Read clipboard content" },
  { name: "termux-location", desc: "GPS coordinates" },
  { name: "termux-microphone-record", desc: "Record microphone audio" },
  { name: "termux-notification -t 'Title' -c 'Body'", desc: "Send system notification" },
  { name: "termux-sms-list -l 20", desc: "List last 20 SMS messages" },
  { name: "termux-sms-send -n +1234567890 'msg'", desc: "Send SMS message" },
  { name: "termux-telephony-call +1234567890", desc: "Make phone call" },
  { name: "termux-torch --on", desc: "Toggle flashlight on" },
  { name: "termux-vibrate -d 500", desc: "Vibrate 500ms" },
  { name: "termux-wifi-connectioninfo", desc: "Current WiFi SSID, IP, BSSID" },
  { name: "termux-wifi-scaninfo", desc: "Scan all nearby WiFi networks" },
  { name: "termux-contact-list", desc: "Get all phone contacts" },
  { name: "termux-fingerprint", desc: "Prompt fingerprint auth" },
  { name: "termux-share -a send /path/file", desc: "Share file via Android intent" },
  { name: "su -c 'cat /data/data/com.android.providers.telephony/databases/mmssms.db'", desc: "ROOT: Access SMS database" },
  { name: "su -c 'dumpsys wifi | grep SSID'", desc: "ROOT: Get WiFi details" },
  { name: "su -c 'ip neigh show'", desc: "ROOT: ARP table (LAN hosts)" },
  { name: "su -c 'netstat -tulpn'", desc: "ROOT: All listening sockets" },
];

type Tab = "setup" | "build" | "apis" | "magisk";

export default function BridgeScreen() {
  const insets = useSafeAreaInsets();
  const { execMode, setExecMode, termuxUrl, setTermuxUrl, execCommand, addTerminalLine, setActiveScreen, backendUrl } = useApp();
  const [editUrl, setEditUrl] = useState(termuxUrl);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("build");

  const copy = async (text: string, key: string) => {
    await Clipboard.setStringAsync(text);
    setCopied(key);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setCopied(null), 2000);
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const url = execMode === "termux" ? `${editUrl}/exec` : `${backendUrl}/api/execute`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: "id && uname -a" }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const out = (data.stdout || data.error || "").slice(0, 300);
      setTestResult(`✓ Connected!\n${out}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setTestResult(`✗ ${e?.message}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setTesting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>⚡ EXECUTION BRIDGE</Text>
        <Text style={styles.subtitle}>Build APK · Termux · Magisk Root · Real Execution</Text>
      </View>

      {/* Mode Toggle */}
      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeBtn, execMode === "backend" && styles.modeBtnActive]}
          onPress={() => { setExecMode("backend"); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
        >
          <Feather name="server" size={13} color={execMode === "backend" ? "#000" : "#cc0000"} />
          <Text style={[styles.modeBtnText, execMode === "backend" && { color: "#000" }]}>BACKEND</Text>
          <Text style={[styles.modeBtnSub, { color: execMode === "backend" ? "#000" : "#660000" }]}>Real Linux server</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, execMode === "termux" && styles.modeBtnGreen]}
          onPress={() => { setExecMode("termux"); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
        >
          <Feather name="smartphone" size={13} color={execMode === "termux" ? "#000" : "#44ff44"} />
          <Text style={[styles.modeBtnText, execMode === "termux" ? { color: "#000" } : { color: "#44ff44" }]}>TERMUX</Text>
          <Text style={[styles.modeBtnSub, { color: execMode === "termux" ? "#000" : "#004400" }]}>Rooted phone</Text>
        </TouchableOpacity>
      </View>

      {execMode === "termux" && (
        <View style={styles.urlRow}>
          <TextInput
            style={styles.urlInput}
            value={editUrl}
            onChangeText={setEditUrl}
            placeholder="http://192.168.1.x:8765"
            placeholderTextColor="#440000"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.saveUrlBtn} onPress={() => { setTermuxUrl(editUrl); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }}>
            <Text style={styles.saveUrlText}>SAVE</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={[styles.testBtn, testing && { opacity: 0.5 }]} onPress={testConnection} disabled={testing}>
        <Feather name="activity" size={13} color="#000" />
        <Text style={styles.testBtnText}>{testing ? "TESTING..." : `TEST ${execMode.toUpperCase()} CONNECTION`}</Text>
      </TouchableOpacity>

      {testResult && (
        <View style={[styles.testResult, { borderColor: testResult.startsWith("✓") ? "#44ff44" : "#cc0000" }]}>
          <Text style={[styles.testResultText, { color: testResult.startsWith("✓") ? "#44ff44" : "#ff4444" }]} selectable>{testResult}</Text>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(["build", "setup", "apis", "magisk"] as Tab[]).map(t => (
          <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t === "build" ? "📦 BUILD" : t.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 110, gap: 12 }}>

        {/* BUILD APK TAB */}
        {tab === "build" && (
          <>
            <View style={[styles.infoBox, { borderColor: "#cc0000" }]}>
              <Text style={[styles.infoTitle, { color: "#cc0000" }]}>📦 BUILD STANDALONE APK</Text>
              <Text style={styles.infoText}>
                EAS (Expo Application Services) builds your APK in the cloud — free tier available.
                Once installed, the app gets full Android permissions + native Magisk root execution.
              </Text>
            </View>

            {BUILD_STEPS.map(step => (
              <View key={step.n} style={styles.buildStep}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>{step.n}</Text>
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepDesc}>{step.desc}</Text>
                  {step.cmd && (
                    <View style={styles.codeRow}>
                      <Text style={styles.codeText} selectable>{step.cmd}</Text>
                      <TouchableOpacity onPress={() => copy(step.cmd!, `step-${step.n}`)}>
                        <Feather name={copied === `step-${step.n}` ? "check" : "copy"} size={13} color={copied === `step-${step.n}` ? "#44ff44" : "#660000"} />
                      </TouchableOpacity>
                    </View>
                  )}
                  {step.url && (
                    <TouchableOpacity style={styles.linkBtn} onPress={() => Linking.openURL(step.url!)}>
                      <Feather name="external-link" size={11} color="#cc0000" />
                      <Text style={styles.linkText}>{step.action}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}

            <View style={[styles.infoBox, { borderColor: "#44ff44", marginTop: 4 }]}>
              <Text style={[styles.infoTitle, { color: "#44ff44" }]}>✓ WHAT THE APK INCLUDES</Text>
              <Text style={styles.infoText}>
                {`• Native Magisk root execution (su -c command)\n• All 35 Android permissions pre-granted\n• Termux bridge client built-in\n• Connects to local Termux HTTP server\n• Full AI agent + auto-execute mode\n• No Play Store needed — sideload direct`}
              </Text>
            </View>
          </>
        )}

        {/* SETUP TAB */}
        {tab === "setup" && (
          <>
            <Text style={styles.sectionTitle}>TERMUX BRIDGE SETUP</Text>
            <Text style={styles.bodyText}>Run this in Termux to enable phone-side command execution. Requires: python + flask.</Text>
            <View style={styles.codeBox}>
              <Text style={styles.codeText2} selectable>{`# 1. Install deps in Termux:\npkg install python\npip install flask\n\n# 2. Copy bridge script below & paste in Termux`}</Text>
            </View>
            <TouchableOpacity
              style={[styles.copyBtn, copied === "bridge" && styles.copiedBtn]}
              onPress={() => copy(TERMUX_BRIDGE_SCRIPT, "bridge")}
            >
              <Feather name={copied === "bridge" ? "check" : "copy"} size={14} color="#000" />
              <Text style={styles.copyBtnText}>{copied === "bridge" ? "COPIED! Paste in Termux" : "COPY BRIDGE SCRIPT"}</Text>
            </TouchableOpacity>
            <Text style={styles.bodyText}>
              {`3. Bridge prints your phone's IP\n4. Enter IP in the field above → SAVE\n5. Switch to TERMUX mode\n6. All commands now run on your phone`}
            </Text>
          </>
        )}

        {/* APIS TAB */}
        {tab === "apis" && (
          <>
            <Text style={styles.sectionTitle}>TERMUX API + ROOT COMMANDS</Text>
            <Text style={styles.bodyText}>Tap any command to send to terminal. Requires Termux bridge active. Root commands need Magisk.</Text>
            {TERMUX_APIS.map(api => (
              <TouchableOpacity
                key={api.name}
                style={styles.apiCard}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  addTerminalLine({ type: "info", content: `[TERMUX] Sending: ${api.name}` });
                  setActiveScreen("terminal");
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.apiName}>{api.name}</Text>
                  <Text style={styles.apiDesc}>{api.desc}</Text>
                </View>
                {api.name.startsWith("su") && <Text style={{ color: "#ff4444", fontSize: 9, fontFamily: "monospace" }}>ROOT</Text>}
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* MAGISK TAB */}
        {tab === "magisk" && (
          <>
            <Text style={styles.sectionTitle}>ROOT WITH MAGISK</Text>
            {MAGISK_STEPS.map(step => (
              <View key={step.step} style={styles.buildStep}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>{step.step}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepDesc}>{step.desc}</Text>
                </View>
              </View>
            ))}
            <View style={[styles.infoBox, { borderColor: "#44ff44" }]}>
              <Text style={[styles.infoTitle, { color: "#44ff44" }]}>ROOT CAPABILITIES (APK + Magisk)</Text>
              <Text style={styles.infoText}>
                {`• su -c "command" — native root shell\n• Read /data partition (SMS db, app data)\n• Modify system files\n• Full packet capture (tcpdump)\n• USB HID injection via NetHunter\n• Mount encrypted partitions\n• Read other apps' private data`}
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#220000" },
  title: { fontFamily: "monospace", fontSize: 14, fontWeight: "bold", color: "#cc0000", letterSpacing: 2 },
  subtitle: { fontFamily: "monospace", fontSize: 9, color: "#660000", marginTop: 2 },
  modeRow: { flexDirection: "row", gap: 8, padding: 10 },
  modeBtn: { flex: 1, borderWidth: 1, borderColor: "#330000", padding: 9, alignItems: "center", gap: 3 },
  modeBtnActive: { backgroundColor: "#cc0000", borderColor: "#cc0000" },
  modeBtnGreen: { backgroundColor: "#44ff44", borderColor: "#44ff44" },
  modeBtnText: { fontFamily: "monospace", fontSize: 10, fontWeight: "bold", color: "#cc0000" },
  modeBtnSub: { fontFamily: "monospace", fontSize: 8 },
  urlRow: { flexDirection: "row", paddingHorizontal: 10, paddingBottom: 8, gap: 8 },
  urlInput: { flex: 1, fontFamily: "monospace", fontSize: 11, color: "#44ff44", borderWidth: 1, borderColor: "#004400", padding: 7 },
  saveUrlBtn: { borderWidth: 1, borderColor: "#44ff44", paddingHorizontal: 10, paddingVertical: 7 },
  saveUrlText: { fontFamily: "monospace", fontSize: 10, color: "#44ff44", fontWeight: "bold" },
  testBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginHorizontal: 10, marginBottom: 8, backgroundColor: "#cc0000", padding: 11 },
  testBtnText: { fontFamily: "monospace", fontSize: 11, fontWeight: "bold", color: "#000" },
  testResult: { marginHorizontal: 10, marginBottom: 8, borderWidth: 1, padding: 9 },
  testResultText: { fontFamily: "monospace", fontSize: 10, lineHeight: 16 },
  tabRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#220000" },
  tabBtn: { flex: 1, padding: 9, alignItems: "center" },
  tabActive: { borderBottomWidth: 2, borderBottomColor: "#cc0000" },
  tabText: { fontFamily: "monospace", fontSize: 9, color: "#440000" },
  tabTextActive: { color: "#cc0000", fontWeight: "bold" },
  sectionTitle: { fontFamily: "monospace", fontSize: 11, fontWeight: "bold", color: "#cc0000", letterSpacing: 2 },
  bodyText: { fontFamily: "monospace", fontSize: 10, color: "#880000", lineHeight: 17 },
  codeBox: { backgroundColor: "#000", borderWidth: 1, borderColor: "#330000", padding: 9 },
  codeText2: { fontFamily: "monospace", fontSize: 10, color: "#44ff44", lineHeight: 16 },
  copyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#cc0000", padding: 11 },
  copiedBtn: { backgroundColor: "#004400" },
  copyBtnText: { fontFamily: "monospace", fontSize: 11, fontWeight: "bold", color: "#000" },
  infoBox: { borderWidth: 1, borderColor: "#330000", padding: 11, backgroundColor: "#030000" },
  infoTitle: { fontFamily: "monospace", fontSize: 10, fontWeight: "bold", color: "#cc0000", marginBottom: 6 },
  infoText: { fontFamily: "monospace", fontSize: 10, color: "#880000", lineHeight: 16 },
  buildStep: { flexDirection: "row", gap: 11, borderWidth: 1, borderColor: "#1a0000", padding: 11, backgroundColor: "#030000" },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#cc0000", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  stepNumText: { fontFamily: "monospace", fontSize: 12, fontWeight: "bold", color: "#000" },
  stepTitle: { fontFamily: "monospace", fontSize: 11, fontWeight: "bold", color: "#ff3333" },
  stepDesc: { fontFamily: "monospace", fontSize: 10, color: "#880000", lineHeight: 15 },
  codeRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#000", borderWidth: 1, borderColor: "#330000", padding: 7 },
  codeText: { flex: 1, fontFamily: "monospace", fontSize: 10, color: "#44ff44", lineHeight: 15 },
  linkBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  linkText: { fontFamily: "monospace", fontSize: 10, color: "#cc0000", textDecorationLine: "underline" },
  apiCard: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#1a0000", padding: 9, backgroundColor: "#020000", gap: 8 },
  apiName: { fontFamily: "monospace", fontSize: 10, color: "#44ff44", fontWeight: "bold" },
  apiDesc: { fontFamily: "monospace", fontSize: 9, color: "#660000", marginTop: 2 },
});
