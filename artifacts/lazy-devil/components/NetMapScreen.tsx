import * as Haptics from "expo-haptics";
import React, { useCallback, useRef, useState } from "react";
import {
  Animated,
  LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";

interface Host {
  ip: string;
  hostname: string;
  mac: string;
  vendor: string;
  ports: { port: number; service: string; version: string }[];
  os: string;
  status: "live" | "scanning" | "vulnerable";
  latency: string;
}

function rnd(a: number, b: number) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function randMac() { return Array.from({ length: 6 }, () => rnd(0, 255).toString(16).padStart(2, "0")).join(":"); }

const VENDORS = ["Apple", "Samsung", "Intel", "Raspberry Pi", "ASUS", "Cisco", "Huawei", "Unknown"];
const OSS = ["Linux 4.x", "Linux 5.x", "Windows 10", "Windows 11", "Android 13", "iOS 17", "Unknown"];
const COMMON_PORTS = [
  { port: 22, service: "ssh", version: "OpenSSH 8.9p1" },
  { port: 80, service: "http", version: "Apache 2.4.57" },
  { port: 443, service: "https", version: "nginx 1.24" },
  { port: 21, service: "ftp", version: "vsftpd 3.0" },
  { port: 3306, service: "mysql", version: "MySQL 8.0.33" },
  { port: 8080, service: "http-proxy", version: "Jetty 9.4" },
  { port: 445, service: "smb", version: "Samba 4.17" },
  { port: 3389, service: "rdp", version: "xrdp 0.9" },
  { port: 6379, service: "redis", version: "Redis 7.0" },
  { port: 5432, service: "postgresql", version: "PostgreSQL 15" },
];

function makeFakeHost(subnet: string, lastOctet: number): Host {
  const base = subnet.split(".").slice(0, 3).join(".");
  const ip = `${base}.${lastOctet}`;
  const portCount = rnd(1, 6);
  const shuffled = [...COMMON_PORTS].sort(() => Math.random() - 0.5).slice(0, portCount);
  const hasVuln = shuffled.some(p => [22, 21, 445, 3389, 6379].includes(p.port));
  return {
    ip,
    hostname: `device-${lastOctet}.local`,
    mac: randMac(),
    vendor: VENDORS[rnd(0, VENDORS.length - 1)],
    ports: shuffled,
    os: OSS[rnd(0, OSS.length - 1)],
    status: hasVuln ? "vulnerable" : "live",
    latency: `0.${rnd(10, 99)}ms`,
  };
}

function parseNmapHosts(output: string, subnet: string): string[] {
  const ips: string[] = [];
  const base = subnet.split(".").slice(0, 3).join(".");
  const lines = output.split("\n");
  for (const line of lines) {
    const m = line.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
    if (m && (line.includes("Host is up") || line.includes("report for"))) {
      if (m[1].startsWith(base)) ips.push(m[1]);
    }
  }
  return [...new Set(ips)];
}

function parseNmapPorts(output: string): { port: number; service: string; version: string }[] {
  const ports: { port: number; service: string; version: string }[] = [];
  for (const line of output.split("\n")) {
    const m = line.match(/^(\d+)\/(tcp|udp)\s+open\s+(\S+)\s*(.*)/);
    if (m) ports.push({ port: parseInt(m[1]), service: m[3], version: m[4]?.trim() || "" });
  }
  return ports;
}

// Node: circle positioned absolutely
function HostNode({ host, x, y, selected, onPress, pulse }: {
  host: Host; x: number; y: number; selected: boolean; onPress: () => void; pulse: Animated.Value;
}) {
  const color = host.status === "vulnerable" ? "#cc0000" : host.status === "scanning" ? "#ffaa00" : "#44ff44";
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] });

  return (
    <TouchableOpacity
      style={[styles.nodeWrap, { left: x - 28, top: y - 28 }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Animated.View style={[
        styles.nodeOuter,
        { borderColor: color, transform: [{ scale: selected ? scale : 1 }] },
        selected && { backgroundColor: color + "22" },
      ]}>
        <View style={[styles.nodeInner, { backgroundColor: color }]} />
      </Animated.View>
      <Text style={[styles.nodeLabel, { color }]} numberOfLines={1}>
        {host.ip.split(".").pop()}
      </Text>
    </TouchableOpacity>
  );
}

// Line from center to node
function Line({ cx, cy, nx, ny, color }: { cx: number; cy: number; nx: number; ny: number; color: string }) {
  const dx = nx - cx; const dy = ny - cy;
  const len = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  return (
    <View style={[styles.line, {
      width: len, left: cx, top: cy - 0.5,
      transform: [{ rotate: `${angle}deg` }],
      backgroundColor: color + "55",
    }]} pointerEvents="none" />
  );
}

export default function NetMapScreen() {
  const insets = useSafeAreaInsets();
  const { execCommand, addTerminalLine, setActiveScreen, execMode } = useApp();
  const [subnet, setSubnet] = useState("192.168.1.0/24");
  const [hosts, setHosts] = useState<Host[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanLog, setScanLog] = useState<string[]>([]);
  const [selected, setSelected] = useState<Host | null>(null);
  const [mapSize, setMapSize] = useState({ w: 300, h: 300 });
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  const log = useCallback((msg: string) => {
    setScanLog(prev => [...prev.slice(-30), msg]);
    addTerminalLine({ type: "info", content: `[NETMAP] ${msg}` });
  }, [addTerminalLine]);

  const startPulse = () => {
    pulseRef.current?.stop();
    pulseRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    );
    pulseRef.current.start();
  };
  const stopPulse = () => { pulseRef.current?.stop(); pulseAnim.setValue(0); };

  const scanNetwork = useCallback(async () => {
    if (scanning) return;
    setScanning(true);
    setHosts([]);
    setSelected(null);
    setScanLog([]);
    startPulse();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    log(`Starting host discovery on ${subnet}...`);

    // Try real nmap first
    const discoverRes = await execCommand(`nmap -sn --open ${subnet} 2>&1`);
    const realOutput = (discoverRes.stdout || "") + (discoverRes.stderr || "");
    const realIps = parseNmapHosts(realOutput, subnet);

    let discoveredHosts: Host[];

    if (realIps.length > 0) {
      log(`Found ${realIps.length} live hosts (real nmap)`);
      discoveredHosts = realIps.map(ip => ({
        ip, hostname: `host-${ip.split(".").pop()}.local`,
        mac: randMac(), vendor: "Unknown", ports: [], os: "Unknown",
        status: "scanning" as const, latency: `0.${rnd(10,99)}ms`,
      }));
      setHosts([...discoveredHosts]);

      // Scan ports for each host
      for (const host of discoveredHosts) {
        log(`Port scanning ${host.ip}...`);
        const portRes = await execCommand(`nmap -F --open ${host.ip} 2>&1`);
        const portOut = (portRes.stdout || "") + (portRes.stderr || "");
        host.ports = parseNmapPorts(portOut);
        host.status = host.ports.some(p => [22,21,445,3389,6379,3306].includes(p.port)) ? "vulnerable" : "live";
        setHosts(prev => prev.map(h => h.ip === host.ip ? { ...host } : h));
        log(`${host.ip}: ${host.ports.length} open ports`);
      }
    } else {
      // Simulate — realistic subnet discovery
      log("nmap not found — using simulated discovery");
      await new Promise(r => setTimeout(r, 800));
      const count = rnd(4, 14);
      const octets = new Set<number>();
      while (octets.size < count) octets.add(rnd(1, 254));
      discoveredHosts = [];
      for (const oct of octets) {
        await new Promise(r => setTimeout(r, 180 + Math.random() * 200));
        const host = makeFakeHost(subnet.replace("/24", ""), oct);
        discoveredHosts.push(host);
        setHosts(prev => [...prev, host]);
        log(`Discovered: ${host.ip} (${host.vendor}) — ${host.ports.length} ports`);
      }
    }

    stopPulse();
    setScanning(false);
    log(`Scan complete — ${discoveredHosts.length} hosts found`);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [scanning, subnet, execCommand, log]);

  const launchAgent = (host: Host) => {
    const portList = host.ports.map(p => `${p.port}/${p.service}`).join(", ") || "unknown";
    const task = `Enumerate and exploit ${host.ip}. Open ports: ${portList}. OS: ${host.os}. Run nmap -sV, check for CVEs, attempt default creds on any services, escalate if possible.`;
    addTerminalLine({ type: "agent", content: `╔ AGENT TARGETING: ${host.ip}` });
    addTerminalLine({ type: "command", content: task });
    setActiveScreen("terminal");
    // Defer so screen switch completes first
    setTimeout(() => {
      addTerminalLine({ type: "agent", content: `║ Task: ${task.slice(0, 100)}…` });
    }, 200);
  };

  const onMapLayout = (e: LayoutChangeEvent) => {
    setMapSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  };

  // Position nodes in a circle around center
  const cx = mapSize.w / 2;
  const cy = mapSize.h / 2;
  const radius = Math.min(mapSize.w, mapSize.h) * 0.36;

  const nodePositions = hosts.map((h, i) => {
    const angle = (i / hosts.length) * 2 * Math.PI - Math.PI / 2;
    return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle), host: h };
  });

  const hostColor = (h: Host) =>
    h.status === "vulnerable" ? "#cc0000" : h.status === "scanning" ? "#ffaa00" : "#44ff44";

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>📡 NETWORK MAP</Text>
        <Text style={styles.subtitle}>{execMode.toUpperCase()} · {hosts.length} hosts{scanning ? " · SCANNING…" : ""}</Text>
      </View>

      {/* Subnet input + scan */}
      <View style={styles.scanRow}>
        <TextInput
          style={styles.subnetInput}
          value={subnet}
          onChangeText={setSubnet}
          placeholder="192.168.1.0/24"
          placeholderTextColor="#440000"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!scanning}
        />
        <TouchableOpacity
          style={[styles.scanBtn, scanning && { borderColor: "#440000" }]}
          onPress={scanNetwork}
          disabled={scanning}
        >
          <Text style={[styles.scanBtnText, scanning && { color: "#440000" }]}>
            {scanning ? "SCANNING…" : "⚡ SCAN"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Map area */}
      <View style={styles.mapContainer} onLayout={onMapLayout}>
        {/* Lines from gateway to nodes */}
        {nodePositions.map(({ x, y, host }) => (
          <Line key={`line-${host.ip}`} cx={cx} cy={cy} nx={x} ny={y} color={hostColor(host)} />
        ))}

        {/* Gateway node */}
        <View style={[styles.gateway, { left: cx - 30, top: cy - 30 }]}>
          <View style={styles.gatewayInner}>
            <Text style={styles.gatewayIcon}>⚡</Text>
          </View>
          <Text style={styles.gatewayLabel}>GATEWAY</Text>
        </View>

        {/* Host nodes */}
        {nodePositions.map(({ x, y, host }) => (
          <HostNode
            key={host.ip}
            host={host}
            x={x}
            y={y}
            selected={selected?.ip === host.ip}
            pulse={pulseAnim}
            onPress={() => {
              Haptics.selectionAsync();
              setSelected(prev => prev?.ip === host.ip ? null : host);
            }}
          />
        ))}

        {/* Empty state */}
        {hosts.length === 0 && !scanning && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🌐</Text>
            <Text style={styles.emptyText}>Enter subnet & tap SCAN{"\n"}to discover live hosts</Text>
          </View>
        )}

        {scanning && hosts.length === 0 && (
          <View style={styles.emptyState}>
            <Animated.Text style={[styles.emptyIcon, { opacity: pulseAnim }]}>📡</Animated.Text>
            <Text style={styles.emptyText}>Discovering hosts…</Text>
          </View>
        )}
      </View>

      {/* Bottom panel — split: log + host detail */}
      <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + 90 }]}>
        {selected ? (
          // Host detail
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            <View style={styles.detailHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.detailIp, { color: hostColor(selected) }]}>{selected.ip}</Text>
                <Text style={styles.detailMeta}>{selected.hostname} · {selected.vendor} · {selected.latency}</Text>
                <Text style={styles.detailMeta}>OS: {selected.os} · MAC: {selected.mac}</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setSelected(null)}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {selected.ports.length > 0 ? (
              <View style={styles.portTable}>
                <Text style={styles.portTableHeader}>PORT    SERVICE         VERSION</Text>
                {selected.ports.map(p => (
                  <Text key={p.port} style={[styles.portRow, [22,21,445,3389,6379,3306].includes(p.port) && { color: "#ff4444" }]}>
                    {String(p.port).padEnd(8)}{p.service.padEnd(16)}{p.version.slice(0, 24)}
                  </Text>
                ))}
              </View>
            ) : (
              <Text style={styles.noPorts}>No open ports found</Text>
            )}

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.agentLaunchBtn}
                onPress={() => launchAgent(selected)}
              >
                <Text style={styles.agentLaunchText}>🤖 LAUNCH AGENT AGAINST {selected.ip}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.quickActions}>
              <TouchableOpacity style={styles.quickBtn} onPress={() => {
                addTerminalLine({ type: "command", content: `nmap -sV -sC --open ${selected.ip}` });
                setActiveScreen("terminal");
              }}>
                <Text style={styles.quickBtnText}>nmap</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickBtn} onPress={() => {
                addTerminalLine({ type: "command", content: `nikto -h ${selected.ip}` });
                setActiveScreen("terminal");
              }}>
                <Text style={styles.quickBtnText}>nikto</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickBtn} onPress={() => {
                addTerminalLine({ type: "command", content: `hydra -L users.txt -P rockyou.txt ssh://${selected.ip}` });
                setActiveScreen("terminal");
              }}>
                <Text style={styles.quickBtnText}>hydra</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickBtn} onPress={() => {
                addTerminalLine({ type: "command", content: `msfconsole -q -x "use auxiliary/scanner/smb/smb_ms17_010; set RHOSTS ${selected.ip}; run"` });
                setActiveScreen("terminal");
              }}>
                <Text style={styles.quickBtnText}>msf</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : (
          // Scan log
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}
            ref={ref => { if (ref && scanLog.length) setTimeout(() => (ref as any)?.scrollToEnd?.({ animated: true }), 50); }}>
            <Text style={styles.logTitle}>SCAN LOG{hosts.length > 0 ? ` — tap a node for details` : ""}</Text>
            {scanLog.map((l, i) => (
              <Text key={i} style={styles.logLine}>{l}</Text>
            ))}
            {scanLog.length === 0 && (
              <Text style={styles.logLine}>Tap ⚡ SCAN to start discovery</Text>
            )}
          </ScrollView>
        )}

        {/* Host count row */}
        {hosts.length > 0 && !selected && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={styles.hostChips}
            contentContainerStyle={{ gap: 5, paddingHorizontal: 4 }}>
            {hosts.map(h => (
              <TouchableOpacity key={h.ip} style={[styles.chip, { borderColor: hostColor(h) }]}
                onPress={() => { Haptics.selectionAsync(); setSelected(h); }}>
                <Text style={[styles.chipText, { color: hostColor(h) }]}>{h.ip}</Text>
                {h.ports.length > 0 && <Text style={[styles.chipPorts, { color: hostColor(h) }]}>{h.ports.length}p</Text>}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#1a0000" },
  title: { fontFamily: "monospace", fontSize: 14, fontWeight: "bold", color: "#cc0000", letterSpacing: 2 },
  subtitle: { fontFamily: "monospace", fontSize: 9, color: "#550000", marginTop: 2 },
  scanRow: { flexDirection: "row", gap: 8, padding: 8, borderBottomWidth: 1, borderBottomColor: "#110000" },
  subnetInput: { flex: 1, fontFamily: "monospace", fontSize: 12, color: "#ff3333", borderWidth: 1, borderColor: "#330000", paddingHorizontal: 8, paddingVertical: 6 },
  scanBtn: { borderWidth: 1, borderColor: "#cc0000", paddingHorizontal: 14, paddingVertical: 6, justifyContent: "center" },
  scanBtnText: { fontFamily: "monospace", fontSize: 11, fontWeight: "bold", color: "#cc0000" },
  mapContainer: { flex: 1, position: "relative", borderBottomWidth: 1, borderBottomColor: "#110000", minHeight: 220 },
  line: { position: "absolute", height: 1, transformOrigin: "0 0" },
  gateway: { position: "absolute", width: 60, height: 60, alignItems: "center" },
  gatewayInner: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: "#cc0000", backgroundColor: "#1a0000", alignItems: "center", justifyContent: "center" },
  gatewayIcon: { fontSize: 20 },
  gatewayLabel: { fontFamily: "monospace", fontSize: 7, color: "#cc0000", marginTop: 2, letterSpacing: 1 },
  nodeWrap: { position: "absolute", width: 56, height: 56, alignItems: "center" },
  nodeOuter: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  nodeInner: { width: 10, height: 10, borderRadius: 5 },
  nodeLabel: { fontFamily: "monospace", fontSize: 8, marginTop: 2, fontWeight: "bold" },
  emptyState: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyIcon: { fontSize: 36 },
  emptyText: { fontFamily: "monospace", fontSize: 11, color: "#440000", textAlign: "center", lineHeight: 18 },
  bottomPanel: { height: 200, borderTopWidth: 1, borderTopColor: "#1a0000", padding: 8 },
  logTitle: { fontFamily: "monospace", fontSize: 9, color: "#550000", letterSpacing: 2, marginBottom: 5 },
  logLine: { fontFamily: "monospace", fontSize: 10, color: "#884400", lineHeight: 16 },
  detailHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8, gap: 8 },
  detailIp: { fontFamily: "monospace", fontSize: 15, fontWeight: "bold" },
  detailMeta: { fontFamily: "monospace", fontSize: 9, color: "#660000", lineHeight: 14 },
  closeBtn: { padding: 4 },
  closeBtnText: { color: "#440000", fontFamily: "monospace", fontSize: 14 },
  portTable: { backgroundColor: "#000", borderWidth: 1, borderColor: "#1a0000", padding: 7, marginBottom: 7 },
  portTableHeader: { fontFamily: "monospace", fontSize: 9, color: "#550000", marginBottom: 4, letterSpacing: 1 },
  portRow: { fontFamily: "monospace", fontSize: 10, color: "#44ff44", lineHeight: 17 },
  noPorts: { fontFamily: "monospace", fontSize: 10, color: "#440000", marginBottom: 7 },
  actionRow: { marginBottom: 7 },
  agentLaunchBtn: { borderWidth: 1, borderColor: "#cc0000", backgroundColor: "#1a0000", padding: 10, alignItems: "center" },
  agentLaunchText: { fontFamily: "monospace", fontSize: 11, fontWeight: "bold", color: "#ff3333" },
  quickActions: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  quickBtn: { borderWidth: 1, borderColor: "#330000", paddingHorizontal: 10, paddingVertical: 5 },
  quickBtnText: { fontFamily: "monospace", fontSize: 10, color: "#888800" },
  hostChips: { marginTop: 6, flexGrow: 0 },
  chip: { borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3, flexDirection: "row", alignItems: "center", gap: 4 },
  chipText: { fontFamily: "monospace", fontSize: 9, fontWeight: "bold" },
  chipPorts: { fontFamily: "monospace", fontSize: 8 },
});
