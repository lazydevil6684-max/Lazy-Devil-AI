import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
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
# ========================================
# Install deps first:
#   pkg update && pkg install nodejs python
#   pip install flask

cat > /tmp/lazy_bridge.py << 'EOF'
from flask import Flask, request, jsonify
import subprocess, threading, os

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
            text=True, timeout=30,
            env={**os.environ}
        )
        return jsonify({
            'stdout': result.stdout[:50000],
            'stderr': result.stderr[:5000],
            'exitCode': result.returncode,
            'elapsed': 0,
            'command': cmd
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
    import socket
    hostname = socket.gethostname()
    try:
        ip = socket.gethostbyname(hostname)
    except:
        ip = '0.0.0.0'
    print(f"\\n[+] Lazy Devil Bridge running!")
    print(f"[+] Connect from app: http://{ip}:8765")
    print(f"[+] Set this URL in the DUCKY > BRIDGE tab")
    print(f"[+] Press Ctrl+C to stop\\n")
    app.run(host='0.0.0.0', port=8765)
EOF

python /tmp/lazy_bridge.py`;

const MAGISK_STEPS = [
  { step: "1", title: "Root Your Phone", desc: "Unlock bootloader → flash TWRP → install Magisk ZIP.\nOr use Magisk App to patch boot.img and flash via fastboot." },
  { step: "2", title: "Install Termux", desc: "Install from F-Droid (not Play Store — Play version is outdated).\nhttps://f-droid.org/en/packages/com.termux/" },
  { step: "3", title: "Install Termux:API", desc: "Install Termux:API from F-Droid.\nIn Termux: pkg install termux-api\nGrants SMS, Camera, Location, WiFi access." },
  { step: "4", title: "Grant Root to Termux", desc: "Open Magisk → Superuser tab → grant root to Termux.\nNow: tsu (or su) in Termux gives full root shell." },
  { step: "5", title: "Install Kali NetHunter", desc: "Install NetHunter Store APK → install NetHunter App.\nOr install via Magisk module for full integration.\nhttps://nethunter.com" },
  { step: "6", title: "Run Lazy Devil Bridge", desc: "Copy & run the bridge script above in Termux.\nSet the IP in this screen, switch to TERMUX mode." },
];

const TERMUX_APIS = [
  { name: "termux-battery-status", desc: "Battery level, health, status" },
  { name: "termux-camera-photo -c 0", desc: "Take a photo (camera 0=back)" },
  { name: "termux-clipboard-get", desc: "Get clipboard content" },
  { name: "termux-location", desc: "GPS location (lat/lng)" },
  { name: "termux-microphone-record", desc: "Record from microphone" },
  { name: "termux-notification", desc: "Send system notification" },
  { name: "termux-sms-list", desc: "List SMS messages" },
  { name: "termux-sms-send -n NUM msg", desc: "Send SMS" },
  { name: "termux-telephony-call NUM", desc: "Make a phone call" },
  { name: "termux-torch --on", desc: "Toggle flashlight" },
  { name: "termux-vibrate -d 1000", desc: "Vibrate phone (ms)" },
  { name: "termux-wifi-connectioninfo", desc: "Current WiFi info" },
  { name: "termux-wifi-scaninfo", desc: "Scan all WiFi networks" },
  { name: "termux-contact-list", desc: "Get contact list" },
  { name: "termux-fingerprint", desc: "Fingerprint authentication" },
  { name: "termux-share -a send file.txt", desc: "Share a file" },
];

export default function BridgeScreen() {
  const insets = useSafeAreaInsets();
  const { execMode, setExecMode, termuxUrl, setTermuxUrl, execCommand, addTerminalLine, setActiveScreen, backendUrl } = useApp();
  const [editUrl, setEditUrl] = useState(termuxUrl);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"setup" | "apis" | "magisk">("setup");

  const testConnection = async (mode: typeof execMode) => {
    setTesting(true);
    setTestResult(null);
    try {
      let url: string;
      if (mode === "termux") {
        url = `${editUrl}/exec`;
      } else {
        url = `${backendUrl}/api/execute`;
      }
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: "id && uname -a && whoami" }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const out = (data.stdout || data.error || "").slice(0, 200);
      setTestResult(`✓ Connected!\n${out}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setTestResult(`✗ Failed: ${e?.message}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setTesting(false);
    }
  };

  const copyScript = async () => {
    await Clipboard.setStringAsync(TERMUX_BRIDGE_SCRIPT);
    setCopied(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>⚡ EXECUTION BRIDGE</Text>
        <Text style={styles.subtitle}>Real command execution · Termux · NetHunter</Text>
      </View>

      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeBtn, execMode === "backend" && styles.modeBtnActive]}
          onPress={() => { setExecMode("backend"); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
        >
          <Feather name="server" size={14} color={execMode === "backend" ? "#000" : "#cc0000"} />
          <Text style={[styles.modeBtnText, execMode === "backend" && styles.modeBtnTextActive]}>BACKEND SERVER</Text>
          <Text style={[styles.modeBtnSub, { color: execMode === "backend" ? "#000" : "#660000" }]}>Real Linux (Replit)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, execMode === "termux" && styles.modeBtnActive, execMode === "termux" && { borderColor: "#44ff44" }]}
          onPress={() => { setExecMode("termux"); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
        >
          <Feather name="smartphone" size={14} color={execMode === "termux" ? "#000" : "#44ff44"} />
          <Text style={[styles.modeBtnText, execMode === "termux" && styles.modeBtnTextActive]}>TERMUX BRIDGE</Text>
          <Text style={[styles.modeBtnSub, { color: execMode === "termux" ? "#000" : "#004400" }]}>Your rooted phone</Text>
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
          <TouchableOpacity
            style={styles.saveUrlBtn}
            onPress={() => { setTermuxUrl(editUrl); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }}
          >
            <Text style={styles.saveUrlText}>SAVE</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={[styles.testBtn, testing && { opacity: 0.5 }]}
        onPress={() => testConnection(execMode)}
        disabled={testing}
      >
        <Feather name={testing ? "loader" : "activity"} size={14} color="#000" />
        <Text style={styles.testBtnText}>{testing ? "TESTING..." : `TEST ${execMode.toUpperCase()} CONNECTION`}</Text>
      </TouchableOpacity>

      {testResult && (
        <View style={[styles.testResult, { borderColor: testResult.startsWith("✓") ? "#44ff44" : "#cc0000" }]}>
          <Text style={[styles.testResultText, { color: testResult.startsWith("✓") ? "#44ff44" : "#ff4444" }]} selectable>
            {testResult}
          </Text>
        </View>
      )}

      <View style={styles.tabRow}>
        {(["setup", "apis", "magisk"] as const).map(t => (
          <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 110, gap: 12 }}>
        {tab === "setup" && (
          <>
            <Text style={styles.sectionTitle}>TERMUX BRIDGE SETUP</Text>
            <Text style={styles.bodyText}>
              Run this script in Termux to enable real command execution on your phone.{"\n"}
              Requires: Python + Flask in Termux.
            </Text>
            <View style={styles.codeBox}>
              <Text style={styles.codeText} selectable>{`# 1. Install deps in Termux:\npkg install python\npip install flask\n\n# 2. Copy & run the bridge:\n# (tap COPY below, paste in Termux)`}</Text>
            </View>
            <TouchableOpacity style={[styles.copyBtn, copied && styles.copiedBtn]} onPress={copyScript}>
              <Feather name={copied ? "check" : "copy"} size={14} color="#000" />
              <Text style={styles.copyBtnText}>{copied ? "COPIED! Paste in Termux" : "COPY BRIDGE SCRIPT"}</Text>
            </TouchableOpacity>
            <Text style={styles.bodyText}>
              3. After running, the bridge shows your phone's IP.{"\n"}
              4. Enter that IP above and tap SAVE.{"\n"}
              5. Switch mode to TERMUX BRIDGE.{"\n"}
              6. All terminal commands now run on your phone!
            </Text>
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>⚡ BACKEND SERVER (default)</Text>
              <Text style={styles.infoText}>
                Commands run on real Linux with: curl, dig, ping, python3, bash, ssh, nc, git, and more.{"\n"}
                No setup needed — works immediately.
              </Text>
            </View>
          </>
        )}

        {tab === "apis" && (
          <>
            <Text style={styles.sectionTitle}>TERMUX API COMMANDS</Text>
            <Text style={styles.bodyText}>
              With Termux bridge active, these commands access real phone hardware.{"\n"}
              Requires: pkg install termux-api
            </Text>
            {TERMUX_APIS.map(api => (
              <TouchableOpacity
                key={api.name}
                style={styles.apiCard}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActiveScreen("terminal");
                  addTerminalLine({ type: "info", content: `[TERMUX API] ${api.name}` });
                }}
              >
                <Text style={styles.apiName}>{api.name}</Text>
                <Text style={styles.apiDesc}>{api.desc}</Text>
              </TouchableOpacity>
            ))}
          </>
        )}

        {tab === "magisk" && (
          <>
            <Text style={styles.sectionTitle}>ROOT WITH MAGISK</Text>
            <Text style={styles.bodyText}>
              Full root access unlocks Lazy Devil's maximum capability.
            </Text>
            {MAGISK_STEPS.map(step => (
              <View key={step.step} style={styles.stepCard}>
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
              <Text style={[styles.infoTitle, { color: "#44ff44" }]}>ROOT CAPABILITIES</Text>
              <Text style={styles.infoText}>
                With Magisk root + Termux bridge:{"\n"}
                • Execute commands as root (su -c "..."){"  "}• Read /data partition (passwords, keys){"  "}
                • Access all system files{"  "}• Run NetHunter attacks{"  "}
                • USB HID injection via NetHunter{"  "}• Bluetooth low energy attacks{"  "}
                • Full packet capture (tcpdump){"  "}• Mount filesystems
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
  title: { fontFamily: "monospace", fontSize: 15, fontWeight: "bold", color: "#cc0000", letterSpacing: 2 },
  subtitle: { fontFamily: "monospace", fontSize: 10, color: "#660000", marginTop: 2 },
  modeRow: { flexDirection: "row", gap: 8, padding: 12 },
  modeBtn: { flex: 1, borderWidth: 1, borderColor: "#330000", padding: 10, alignItems: "center", gap: 4 },
  modeBtnActive: { backgroundColor: "#cc0000", borderColor: "#cc0000" },
  modeBtnText: { fontFamily: "monospace", fontSize: 10, fontWeight: "bold", color: "#cc0000" },
  modeBtnTextActive: { color: "#000" },
  modeBtnSub: { fontFamily: "monospace", fontSize: 9 },
  urlRow: { flexDirection: "row", paddingHorizontal: 12, paddingBottom: 10, gap: 8 },
  urlInput: { flex: 1, fontFamily: "monospace", fontSize: 12, color: "#44ff44", borderWidth: 1, borderColor: "#004400", padding: 8 },
  saveUrlBtn: { borderWidth: 1, borderColor: "#44ff44", paddingHorizontal: 12, paddingVertical: 8 },
  saveUrlText: { fontFamily: "monospace", fontSize: 11, color: "#44ff44", fontWeight: "bold" },
  testBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginHorizontal: 12, marginBottom: 10, backgroundColor: "#cc0000", padding: 12 },
  testBtnText: { fontFamily: "monospace", fontSize: 12, fontWeight: "bold", color: "#000" },
  testResult: { marginHorizontal: 12, marginBottom: 10, borderWidth: 1, padding: 10, backgroundColor: "#000" },
  testResultText: { fontFamily: "monospace", fontSize: 11, lineHeight: 17 },
  tabRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#220000" },
  tabBtn: { flex: 1, padding: 10, alignItems: "center" },
  tabActive: { borderBottomWidth: 2, borderBottomColor: "#cc0000" },
  tabText: { fontFamily: "monospace", fontSize: 10, color: "#440000" },
  tabTextActive: { color: "#cc0000", fontWeight: "bold" },
  sectionTitle: { fontFamily: "monospace", fontSize: 12, fontWeight: "bold", color: "#cc0000", letterSpacing: 2 },
  bodyText: { fontFamily: "monospace", fontSize: 11, color: "#880000", lineHeight: 18 },
  codeBox: { backgroundColor: "#000", borderWidth: 1, borderColor: "#330000", padding: 10 },
  codeText: { fontFamily: "monospace", fontSize: 10, color: "#44ff44", lineHeight: 17 },
  copyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#cc0000", padding: 12 },
  copiedBtn: { backgroundColor: "#004400" },
  copyBtnText: { fontFamily: "monospace", fontSize: 12, fontWeight: "bold", color: "#000" },
  infoBox: { borderWidth: 1, borderColor: "#330000", padding: 12, backgroundColor: "#050000" },
  infoTitle: { fontFamily: "monospace", fontSize: 11, fontWeight: "bold", color: "#cc0000", marginBottom: 6 },
  infoText: { fontFamily: "monospace", fontSize: 10, color: "#880000", lineHeight: 17 },
  apiCard: { borderWidth: 1, borderColor: "#220000", padding: 10, backgroundColor: "#030000" },
  apiName: { fontFamily: "monospace", fontSize: 12, color: "#44ff44", fontWeight: "bold" },
  apiDesc: { fontFamily: "monospace", fontSize: 10, color: "#660000", marginTop: 2 },
  stepCard: { flexDirection: "row", gap: 12, borderWidth: 1, borderColor: "#220000", padding: 12 },
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#cc0000", alignItems: "center", justifyContent: "center" },
  stepNumText: { fontFamily: "monospace", fontSize: 13, fontWeight: "bold", color: "#000" },
  stepTitle: { fontFamily: "monospace", fontSize: 12, fontWeight: "bold", color: "#ff3333", marginBottom: 4 },
  stepDesc: { fontFamily: "monospace", fontSize: 10, color: "#880000", lineHeight: 16 },
});
