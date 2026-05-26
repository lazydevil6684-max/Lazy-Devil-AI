import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
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

const HELP_TEXT = `
LAZY DEVIL TERMINAL v2.0 - Commands
═════════════════════════════════════════
NAVIGATION
  ls [dir]          List directory
  cd <dir>          Change directory
  pwd               Working directory
  cat <file>        Read file
  find <name>       Search files
  mkdir <dir>       Create directory
  rm <file>         Remove file
  cp <src> <dst>    Copy file
  mv <src> <dst>    Move file

NETWORK RECON
  ping <host>       Ping host
  nmap <target>     Port scan
  nmap -sV <t>      Service version scan
  nmap -O <t>       OS detection
  nmap -A <t>       Aggressive scan
  masscan <ip/24>   Fast port scan
  whois <domain>    WHOIS lookup
  dig <domain>      DNS lookup
  host <domain>     DNS resolve
  arp -a            ARP table
  netstat -tulpn    Active connections
  ss -tulpn         Socket statistics
  traceroute <h>    Trace route
  curl <url>        HTTP request

EXPLOITATION
  hydra <t>         Login bruteforce
  sqlmap -u <url>   SQL injection
  msfvenom          Payload generator
  nc -lvp <port>    Netcat listener
  nc <ip> <port>    Netcat connect

WIRELESS
  airmon-ng         Monitor mode
  airodump-ng       Capture packets
  aircrack-ng       Crack WPA/WEP

PASSWORD
  hashcat -m0       MD5 crack
  john --list       Hash types
  crunch 8 8        Password list
  hashid <hash>     Identify hash

WEB APPLICATION
  nikto -h <url>    Web vuln scan
  gobuster          Dir brute
  wpscan --url      WordPress scan
  ffuf -u <url>     Fuzz URLs
  burpsuite         Intercept proxy

FORENSICS
  strings <file>    Print strings
  xxd <file>        Hex dump
  binwalk <file>    Firmware analysis
  volatility        Memory forensics
  file <name>       File type detect

SYSTEM
  whoami            Current user
  id                UID/GID info
  uname -a          System info
  ps aux            Processes
  ifconfig          Network config
  env               Environment vars
  history           Command history
  clear             Clear screen
  banner            Show banner
  help              This help

AI
  ai <query>        Ask AI assistant
`.trim();

const BANNER = `
 _                        ____             _ _
| |    __ _ _____   _   |  _ \\  _____   _(_) |
| |   / _\` |_  / | | |  | | | |/ _ \\ \\ / / | |
| |__| (_| |/ /| |_| |  | |_| |  __/\\ V /| | |
|_____\\__,_/___|\\__, |  |____/ \\___| \\_/ |_|_|
                |___/  v2.0 | AI-Powered | NetHunter
`.trim();

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function ip() { return `${rand(1,254)}.${rand(1,254)}.${rand(1,254)}.${rand(1,254)}`; }
function mac() { return Array.from({length:6}, () => rand(0,255).toString(16).padStart(2,'0')).join(':'); }

function simNmap(target: string, flags: string): string[] {
  const ports = [
    { port: 22, svc: "ssh", state: "open", ver: "OpenSSH 8.4p1" },
    { port: 80, svc: "http", state: "open", ver: "Apache/2.4.51" },
    { port: 443, svc: "https", state: "open", ver: "nginx/1.21.0" },
    { port: 3306, svc: "mysql", state: "filtered", ver: "MySQL 8.0.27" },
    { port: 8080, svc: "http-proxy", state: "open", ver: "Jetty/9.4.43" },
    { port: 21, svc: "ftp", state: "closed", ver: "" },
    { port: 25, svc: "smtp", state: "filtered", ver: "" },
    { port: 3389, svc: "rdp", state: "filtered", ver: "" },
    { port: 5432, svc: "postgresql", state: "filtered", ver: "" },
    { port: 6379, svc: "redis", state: "open", ver: "Redis 7.0.0" },
  ];
  const aggressive = flags.includes("-A") || flags.includes("-sV");
  const lines = [
    `Starting Nmap 7.94 ( https://nmap.org )`,
    `Nmap scan report for ${target}`,
    `Host is up (0.0${rand(10,99)}s latency).`,
    `Not shown: ${rand(980,995)} closed tcp ports (reset)`,
    aggressive ? `PORT      STATE     SERVICE     VERSION` : `PORT      STATE     SERVICE`,
  ];
  for (const p of ports.filter(p => p.state !== "closed")) {
    const ver = aggressive ? `  ${p.ver}` : "";
    lines.push(`${String(p.port).padEnd(9)}${p.state.padEnd(10)}${p.svc}${ver}`);
  }
  if (flags.includes("-O")) {
    lines.push(``);
    lines.push(`OS detection performed. Please report any incorrect results.`);
    lines.push(`Running: Linux 5.X`);
    lines.push(`OS details: Linux 5.10-5.15, Ubuntu 20.04-22.04`);
  }
  lines.push(`Nmap done: 1 IP address (1 host up) scanned in ${(rand(5,45)/10).toFixed(2)}s`);
  return lines;
}

function simMasscan(target: string): string[] {
  const ports = [80, 443, 22, 8080, 3306, 6379, 5432, 25, 21, 8443];
  const lines = [
    `Starting masscan 1.3.2 (http://bit.ly/14GZzcT)`,
    `Initiating SYN Stealth Scan`,
    `Scanning ${target} [65535 ports]`,
  ];
  for (const p of ports.slice(0, rand(4, 8))) {
    lines.push(`Discovered open port ${p}/tcp on ${target.split('/')[0]}`);
  }
  lines.push(`Done: 1 hosts, ${rand(1,5)} found — rate: ${rand(50000,100000).toLocaleString()} packets/sec`);
  return lines;
}

function simPing(host: string): string[] {
  const resolvedIp = ip();
  return [
    `PING ${host} (${resolvedIp}) 56(84) bytes of data.`,
    `64 bytes from ${resolvedIp}: icmp_seq=1 ttl=55 time=${(rand(50,500)/10).toFixed(1)} ms`,
    `64 bytes from ${resolvedIp}: icmp_seq=2 ttl=55 time=${(rand(50,500)/10).toFixed(1)} ms`,
    `64 bytes from ${resolvedIp}: icmp_seq=3 ttl=55 time=${(rand(50,500)/10).toFixed(1)} ms`,
    ``,
    `--- ${host} ping statistics ---`,
    `3 packets transmitted, 3 received, 0% packet loss`,
    `rtt min/avg/max/mdev = ${rand(5,10)}.0/${rand(10,30)}.0/${rand(30,50)}.0/${rand(1,5)}.0 ms`,
  ];
}

function simDig(domain: string): string[] {
  return [
    `; <<>> DiG 9.18.1 <<>> ${domain}`,
    `; QUESTION SECTION:`,
    `;${domain}.     IN  A`,
    ``,
    `; ANSWER SECTION:`,
    `${domain}. 300 IN A ${ip()}`,
    `${domain}. 300 IN A ${ip()}`,
    ``,
    `; AUTHORITY SECTION:`,
    `${domain}. 172800 IN NS ns1.cloudflare.com.`,
    `${domain}. 172800 IN NS ns2.cloudflare.com.`,
    ``,
    `;; Query time: ${rand(5,80)} msec`,
    `;; SERVER: 8.8.8.8#53(8.8.8.8) (UDP)`,
  ];
}

function simNetstat(): string[] {
  const lines = [`Active Internet connections (only servers)`,
    `Proto Recv-Q Send-Q Local Address           Foreign Address         State`];
  const conns = [
    ["tcp", "0.0.0.0:22", "0.0.0.0:*", "LISTEN"],
    ["tcp", "0.0.0.0:80", "0.0.0.0:*", "LISTEN"],
    ["tcp", "0.0.0.0:443", "0.0.0.0:*", "LISTEN"],
    ["tcp", `${ip()}:22`, `${ip()}:${rand(40000,60000)}`, "ESTABLISHED"],
    ["tcp", "127.0.0.1:3306", "0.0.0.0:*", "LISTEN"],
    ["udp", "0.0.0.0:68", "0.0.0.0:*", ""],
  ];
  for (const c of conns) {
    lines.push(`${c[0].padEnd(5)} 0      0      ${c[1].padEnd(24)}${c[2].padEnd(24)}${c[3]}`);
  }
  return lines;
}

function simArp(): string[] {
  const lines = [`Address                  HWtype  HWaddress           Flags Mask  Iface`];
  for (let i = 0; i < rand(4, 8); i++) {
    lines.push(`192.168.1.${rand(1,254)}            ether   ${mac()}   C           eth0`);
  }
  return lines;
}

function simMsfvenom(args: string[]): string[] {
  const payload = args.find(a => a.startsWith("windows")) || "windows/x64/meterpreter/reverse_tcp";
  const lhost = args[args.indexOf("LHOST")+1] || "10.10.14.1";
  const lport = args[args.indexOf("LPORT")+1] || "4444";
  return [
    `[-] No platform was selected, choosing Msf::Module::Platform::Windows from the payload`,
    `[-] No arch selected, selecting arch: x64 from the payload`,
    `No encoder specified, outputting raw payload`,
    `Payload size: ${rand(400,700)} bytes`,
    `Final size of exe file: ${rand(7000,9000)} bytes`,
    ``,
    `[*] Generating payload: ${payload}`,
    `    LHOST: ${lhost}`,
    `    LPORT: ${lport}`,
    ``,
    `[+] Payload written to shell.exe (${rand(7,9)}KB)`,
    `[*] Use: msfconsole -x "use multi/handler; set PAYLOAD ${payload}; set LHOST ${lhost}; set LPORT ${lport}; run"`,
  ];
}

function simHydra(target: string): string[] {
  const total = rand(1000, 9999);
  const host = target.split(":")[0];
  const port = target.split(":")[1] || "22";
  return [
    `Hydra v9.5 (c) 2023 by van Hauser/THC & David Maciejak`,
    `[DATA] max 16 tasks per 1 server, overall 16 tasks`,
    `[DATA] attacking ssh://${host}:${port}/`,
    `[STATUS] ${rand(100,300)} of ${total} tried`,
    `[${port}][ssh] host: ${host}  login: admin  password: admin123`,
    `[STATUS] attack finished for ${host} (valid pair found)`,
    `1 of 1 target successfully completed, 1 valid password found`,
  ];
}

function simJohn(args: string[]): string[] {
  const hashfile = args[0] || "hashes.txt";
  return [
    `Using default input encoding: UTF-8`,
    `Loaded 1 password hash (md5crypt, crypt(3) $1$ (and variants) [MD5 256/256 AVX2 8x3])`,
    `Press 'q' or Ctrl-C to abort, almost any other key for status`,
    `password123     (root)`,
    `1g 0:00:${rand(0,2).toString().padStart(2,'0')}:${rand(0,59).toString().padStart(2,'0')} DONE 2/3 (ETA: finished)`,
    `${(rand(200,900)/100).toFixed(2)} g/s ${rand(5000,50000)} p/s ${rand(5000,50000)} c/s`,
    `Use the "--show" option to display all of the cracked passwords reliably`,
    `Session completed.`,
  ];
}

function simHashcat(hash: string): string[] {
  const cracked = Math.random() > 0.25;
  return [
    `hashcat (v6.2.6) starting...`,
    `OpenCL API (OpenCL 3.0 CUDA 12.0.0)`,
    `* Device #1: NVIDIA GeForce RTX 4090, 24320/24236 MB, 128MCU`,
    ``,
    `Dictionary cache hit:`,
    `* Filename..: rockyou.txt (14,344,391 passwords)`,
    ``,
    cracked ? `${hash}:password123` : `[!] ${hash}: Not found in dictionary`,
    ``,
    `Session..........: hashcat`,
    `Status...........: ${cracked ? "Cracked" : "Exhausted"}`,
    `Hash.Mode........: 0 (MD5)`,
    `Speed.#1.........: ${rand(5000,15000)} MH/s`,
    `Recovered........: ${cracked ? "1/1" : "0/1"} (${cracked ? "100.00%" : "0.00%"})`,
  ];
}

function simHashid(hash: string): string[] {
  const len = hash.replace(/[^a-f0-9]/gi, '').length;
  const types: Record<number, string[]> = {
    32: ["MD5", "MD4", "NTLM"],
    40: ["SHA-1", "RIPEMD-160", "MySQL 4.1"],
    64: ["SHA-256", "SHA-3-256", "Keccak-256"],
    96: ["SHA-384"],
    128: ["SHA-512", "Whirlpool", "SHA-3-512"],
  };
  const found = types[len] || ["Unknown hash type"];
  const lines = [`Analyzing '${hash.slice(0,32)}...'`, `[+] Possible Hashe(s):`];
  for (const t of found) lines.push(`    [*] ${t}`);
  return lines;
}

function simCrunch(min: string, max: string): string[] {
  return [
    `Crunch will now generate the following amount of data:`,
    `${rand(100,9999)} MB (approximately)`,
    `Crunch will now generate the following number of lines: ${rand(100000,9999999).toLocaleString()}`,
    ``,
    `aaaaaaaa`,
    `aaaaaaab`,
    `aaaaaaac`,
    `...`,
    `[Generating with charset: abcdefghijklmnopqrstuvwxyz0123456789]`,
    `[Min: ${min}, Max: ${max}]`,
    `[+] Writing to stdout — pipe to file with > wordlist.txt`,
  ];
}

function simStrings(file: string): string[] {
  const strings = [
    "GET /api/v1/users HTTP/1.1",
    "Authorization: Bearer",
    "password=admin123",
    "db_host=192.168.1.100",
    "SECRET_KEY=a3b7c2d9e4f1",
    "/bin/sh",
    "root@localhost",
    "AAAA BBBB CCCC DDDD",
    "Linux version 5.15.0",
    "ELF GNU/Linux",
  ];
  return [`strings: ${file}`, `Strings found (min-len 4):`, ...strings];
}

function simXxd(file: string): string[] {
  const lines = [`xxd: ${file}`];
  for (let i = 0; i < 8; i++) {
    const offset = (i * 16).toString(16).padStart(8, '0');
    const hex = Array.from({length:16}, () => rand(0,255).toString(16).padStart(2,'0')).join(' ');
    lines.push(`${offset}: ${hex.slice(0,23)} ${hex.slice(24)}  ................`);
  }
  return lines;
}

function simFfuf(url: string): string[] {
  const found = ["/admin", "/login", "/api/v1", "/backup", "/.env", "/config", "/users"];
  const lines = [
    `        /'___\\  /'___\\           /'___\\`,
    `       /\\ \\__/ /\\ \\__/  __  __  /\\ \\__/`,
    `       \\ \\ ,__\\\\ \\ ,__\\/\\ \\/\\ \\ \\ \\ ,__\\`,
    `        \\ \\ \\_/ \\ \\ \\_/\\ \\ \\_\\ \\ \\ \\ \\_/`,
    `         \\ \\_\\   \\ \\_\\  \\ \\____/  \\ \\_\\`,
    `          \\/_/    \\/_/   \\/___/    \\/_/   ffuf v2.1.0`,
    ``,
    `[*] Target: ${url}/FUZZ`,
    `[*] Wordlist: /usr/share/wordlists/dirb/common.txt`,
    ``,
    `[Status] [Size] [Words] [Lines] [Type]`,
  ];
  for (const f of found.slice(0, rand(3, 6))) {
    lines.push(`[200] [${rand(100,9999)}] [${rand(5,100)}] [${rand(5,50)}] ${f}`);
  }
  lines.push(`\n:: Progress: 4614/4614 :: Done :: Duration: ${rand(5,30)}s`);
  return lines;
}

function simAirmon(iface: string = "wlan0"): string[] {
  return [
    `Found 3 processes that could cause trouble.`,
    `Kill them using 'airmon-ng check kill' before putting`,
    `the card in monitor mode`,
    ``,
    `  PID Name`,
    `  754 NetworkManager`,
    ` 1234 wpa_supplicant`,
    ` 5678 dhclient`,
    ``,
    `PHY Interface  Driver    Chipset`,
    `phy0 ${iface}     ath9k_htc Atheros AR9271`,
    ``,
    `(${iface}) monitor mode enabled on mon0`,
  ];
}

function simWpscan(url: string): string[] {
  return [
    `_______________________________________________________________`,
    `         __          _______   _____`,
    `         \\ \\        / /  __ \\ / ____|`,
    `          \\ \\  /\\  / /| |__) | (___   ___  __ _ _ __ ®`,
    `           \\ \\/  \\/ / |  ___/ \\___ \\ / __|/ _\` | '_ \\`,
    `            \\  /\\  /  | |     ____) | (__| (_| | | | |`,
    `             \\/  \\/   |_|    |_____/ \\___|\\__,_|_| |_|`,
    ``,
    `WordPress Security Scanner by the WPScan Team`,
    `Version 3.8.24`,
    `[i] Target: ${url}`,
    `[!] WordPress Version: 6.3.1`,
    `[+] XML-RPC seems to be enabled: ${url}/xmlrpc.php`,
    `[+] WordPress readme found: ${url}/readme.html`,
    `[!] Upload directory has listing enabled: ${url}/wp-content/uploads/`,
    `[+] User(s) identified: admin, editor, author`,
    `[!] Plugin: contact-form-7 v5.7 - vulnerable (XSS)`,
    `[i] Finished: 0 errors | ${rand(200,500)} queries | ${rand(20,60)} seconds`,
  ];
}

function simNc(args: string[]): string[] {
  const listen = args.includes("-l") || args.includes("-lvp") || args.includes("-lvnp");
  const port = args.find(a => /^\d{2,5}$/.test(a)) || "4444";
  if (listen) {
    return [
      `Listening on [0.0.0.0] (family 0, port ${port})`,
      `Connection from ${ip()} ${rand(40000,60000)} received!`,
      `id`,
      `uid=0(root) gid=0(root) groups=0(root)`,
      `whoami`,
      `root`,
      `hostname`,
      `target-server`,
    ];
  }
  return [`(UNKNOWN) [${args[0] || "10.10.10.10"}] ${port} (?) open`,
    `Connected to ${args[0] || "10.10.10.10"}`];
}

function simVolatility(args: string[]): string[] {
  const plugin = args.find(a => !a.startsWith("-") && a !== "volatility") || "windows.pslist";
  const lines = [
    `Volatility 3 Framework 2.5.2`,
    `Progress: 100.00% PDB scanning finished`,
    ``,
    `PID  PPID  ImageFileName     Offset(V)          Threads Handles SessionId`,
    `4    0     System            0x800048b5...       149     -       -`,
    `88   4     Registry          0x9f0be...          4       -       -`,
    `${rand(1000,9999)} 4 smss.exe 0x9f2be... 2 - -`,
    `${rand(1000,9999)} 688 csrss.exe 0xa3... 9 - 0`,
    `${rand(1000,9999)} 688 winlogon.exe 0xab... 3 - 1`,
    `${rand(1000,9999)} 700 services.exe 0xba... 8 - 0`,
    `${rand(1000,9999)} 700 lsass.exe 0xca... 7 - 0`,
  ];
  lines.push(`\n[*] Plugin: ${plugin}`);
  return lines;
}

function simBinwalk(file: string): string[] {
  return [
    `DECIMAL       HEXADECIMAL     DESCRIPTION`,
    `--------------------------------------------------------------------------------`,
    `0             0x0             ELF, 64-bit LSB executable, AMD x86-64`,
    `${rand(1000,9999)} 0x${rand(100,9999).toString(16)} gzip compressed data`,
    `${rand(10000,99999)} 0x${rand(10000,99999).toString(16)} JFFS2 filesystem, big endian`,
    `${rand(100000,999999)} 0x${rand(100000,999999).toString(16)} Squashfs filesystem`,
    ``,
    `[!] Extraction: use binwalk -e ${file}`,
  ];
}

const CMD_SUGGESTIONS: Record<string, string[]> = {
  nmap: ["nmap -sV TARGET", "nmap -A TARGET", "nmap -p- TARGET"],
  ping: ["traceroute TARGET", "nmap TARGET", "whois TARGET"],
  whois: ["dig TARGET", "nmap TARGET", "curl TARGET"],
  masscan: ["nmap -sV TARGET", "nc -nv TARGET PORT", "ffuf -u TARGET/FUZZ"],
  hydra: ["msfconsole", "nc -lvp 4444", "ssh admin@TARGET"],
  sqlmap: ["sqlmap -u URL --dbs", "sqlmap -u URL --tables", "nikto -h TARGET"],
  hashcat: ["hashid HASH", "john --wordlist=rockyou.txt hash.txt", "crunch 8 8"],
  dig: ["whois DOMAIN", "nmap TARGET", "ffuf -u TARGET/FUZZ"],
  gobuster: ["nikto -h TARGET", "wpscan --url TARGET", "sqlmap -u TARGET"],
  nikto: ["gobuster dir -u TARGET", "wpscan --url TARGET", "sqlmap -u TARGET"],
  airmon: ["airodump-ng mon0", "aircrack-ng capture.cap", "reaver -i mon0 -b BSSID"],
  nc: ["msfvenom -p windows/meterpreter/reverse_tcp", "nc -lvp 9999"],
  wpscan: ["sqlmap -u TARGET/wp-login.php", "hydra TARGET", "gobuster dir -u TARGET"],
};

interface TerminalLineProps {
  line: { type: string; content: string };
}

function TLine({ line }: TerminalLineProps) {
  const colors = useColors();
  const color =
    line.type === "command" ? colors.terminalHead
    : line.type === "error" ? "#ff4444"
    : line.type === "success" ? "#44ff44"
    : line.type === "info" ? colors.foreground
    : colors.terminalBody;

  return (
    <Text
      style={{ color, fontFamily: "monospace", fontSize: 12, lineHeight: 18, paddingHorizontal: 8 }}
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
    terminalLines, addTerminalLine, clearTerminal,
    currentPath, setCurrentPath,
    setActiveScreen, addAiMessage,
    commandHistory, addToHistory, clearHistory,
    setExecuteCommandFromAI,
    selectedModel, apiKey, isAiLoading, setIsAiLoading,
  } = useApp();

  const [input, setInput] = useState("");
  const [histIdx, setHistIdx] = useState(-1);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const recognitionRef = useRef<any>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 50);
  }, []);

  useEffect(() => { scrollToBottom(); }, [terminalLines.length]);

  useEffect(() => {
    setExecuteCommandFromAI(() => (cmd: string) => {
      setActiveScreen("terminal");
      runCommand(cmd);
    });
    return () => setExecuteCommandFromAI(null);
  }, []);

  const navigateHistory = (dir: "up" | "down") => {
    if (commandHistory.length === 0) return;
    Haptics.selectionAsync();
    if (dir === "up") {
      const newIdx = Math.min(histIdx + 1, commandHistory.length - 1);
      setHistIdx(newIdx);
      setInput(commandHistory[newIdx] ?? "");
    } else {
      const newIdx = Math.max(histIdx - 1, -1);
      setHistIdx(newIdx);
      setInput(newIdx === -1 ? "" : (commandHistory[newIdx] ?? ""));
    }
  };

  const startVoice = () => {
    if (Platform.OS !== "web") {
      addTerminalLine({ type: "info", content: "[~] Voice input available on web version" });
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addTerminalLine({ type: "error", content: "[!] Voice not supported in this browser" });
      return;
    }
    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";
    recognitionRef.current = rec;
    setIsListening(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    rec.onresult = (event: any) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      setInput(transcript);
      setIsListening(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);
    rec.start();
  };

  const stopVoice = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  const runCommand = useCallback(async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addToHistory(trimmed);
    setHistIdx(-1);
    setSuggestions([]);

    addTerminalLine({ type: "command", content: trimmed });
    const parts = trimmed.split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);
    const baseCmd = command.split("-")[0];

    const suggest = CMD_SUGGESTIONS[command] || CMD_SUGGESTIONS[baseCmd];
    if (suggest) setTimeout(() => setSuggestions(suggest), 600);

    switch (command) {
      case "clear":
        clearTerminal();
        break;

      case "help":
        for (const line of HELP_TEXT.split("\n")) addTerminalLine({ type: "output", content: line });
        break;

      case "banner":
        for (const line of BANNER.split("\n")) addTerminalLine({ type: "info", content: line });
        break;

      case "whoami":
        addTerminalLine({ type: "output", content: "root" });
        break;

      case "id":
        addTerminalLine({ type: "output", content: "uid=0(root) gid=0(root) groups=0(root),4(adm),27(sudo),999(kali)" });
        break;

      case "pwd":
        addTerminalLine({ type: "output", content: currentPath });
        break;

      case "uname":
        addTerminalLine({ type: "output", content: "Linux LazyDevil 5.15.0-kali3-amd64 #1 SMP Debian 5.15.15-2kali1 x86_64 GNU/Linux" });
        break;

      case "env":
        addTerminalLine({ type: "output", content: "USER=root" });
        addTerminalLine({ type: "output", content: "HOME=/root" });
        addTerminalLine({ type: "output", content: "SHELL=/bin/bash" });
        addTerminalLine({ type: "output", content: "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" });
        addTerminalLine({ type: "output", content: "TERM=xterm-256color" });
        addTerminalLine({ type: "output", content: "DEBIAN_FRONTEND=noninteractive" });
        break;

      case "ifconfig":
        addTerminalLine({ type: "output", content: `eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500` });
        addTerminalLine({ type: "output", content: `        inet 192.168.1.100  netmask 255.255.255.0  broadcast 192.168.1.255` });
        addTerminalLine({ type: "output", content: `        ether ${mac()}  txqueuelen 1000  (Ethernet)` });
        addTerminalLine({ type: "output", content: `wlan0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500` });
        addTerminalLine({ type: "output", content: `        inet 192.168.1.101  netmask 255.255.255.0` });
        addTerminalLine({ type: "output", content: `        ether ${mac()}  txqueuelen 1000  (Ethernet)` });
        addTerminalLine({ type: "output", content: `lo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536` });
        addTerminalLine({ type: "output", content: `        inet 127.0.0.1  netmask 255.0.0.0` });
        break;

      case "ps":
        addTerminalLine({ type: "output", content: "USER       PID  %CPU  %MEM  COMMAND" });
        for (const p of ["sshd","bash","python3","metasploit","nmap","burpsuite","wireshark","zsh"]) {
          addTerminalLine({ type: "output", content: `root    ${rand(1000,9999)}   ${(Math.random()*5).toFixed(1)}   ${(Math.random()*2).toFixed(1)}  ${p}` });
        }
        break;

      case "history":
        if (commandHistory.length === 0) {
          addTerminalLine({ type: "output", content: "(no history)" });
        } else {
          commandHistory.slice().reverse().forEach((h, i) => {
            addTerminalLine({ type: "output", content: `  ${String(commandHistory.length - i).padStart(4)}  ${h}` });
          });
        }
        break;

      case "ping":
        if (!args[0]) {
          addTerminalLine({ type: "error", content: "ping: usage: ping <host>" });
        } else {
          for (const l of simPing(args[0])) addTerminalLine({ type: "output", content: l });
        }
        break;

      case "nmap":
        if (!args[0]) {
          addTerminalLine({ type: "error", content: "nmap: usage: nmap [flags] <target>" });
        } else {
          const target = args[args.length - 1];
          const flags = args.slice(0, -1).join(" ");
          addTerminalLine({ type: "info", content: `[*] Scanning ${target}...` });
          for (const l of simNmap(target, flags)) addTerminalLine({ type: "output", content: l });
        }
        break;

      case "masscan":
        if (!args[0]) {
          addTerminalLine({ type: "error", content: "masscan: usage: masscan <ip/cidr> -p1-65535" });
        } else {
          for (const l of simMasscan(args[0])) addTerminalLine({ type: "output", content: l });
        }
        break;

      case "whois":
        if (!args[0]) {
          addTerminalLine({ type: "error", content: "whois: usage: whois <domain>" });
        } else {
          addTerminalLine({ type: "output", content: `Domain Name: ${args[0].toUpperCase()}` });
          addTerminalLine({ type: "output", content: `Registrar: GoDaddy.com, LLC` });
          addTerminalLine({ type: "output", content: `Updated Date: 2024-01-${rand(1,28).toString().padStart(2,'0')}` });
          addTerminalLine({ type: "output", content: `Creation Date: ${rand(2000,2020)}-06-15` });
          addTerminalLine({ type: "output", content: `Name Server: NS1.CLOUDFLARE.COM` });
          addTerminalLine({ type: "output", content: `DNSSEC: unsigned` });
        }
        break;

      case "dig":
        if (!args[0]) {
          addTerminalLine({ type: "error", content: "dig: usage: dig <domain> [type]" });
        } else {
          for (const l of simDig(args[0])) addTerminalLine({ type: "output", content: l });
        }
        break;

      case "host":
        if (!args[0]) {
          addTerminalLine({ type: "error", content: "host: usage: host <domain>" });
        } else {
          addTerminalLine({ type: "output", content: `${args[0]} has address ${ip()}` });
          addTerminalLine({ type: "output", content: `${args[0]} mail is handled by 10 mail.${args[0]}.` });
        }
        break;

      case "netstat":
        for (const l of simNetstat()) addTerminalLine({ type: "output", content: l });
        break;

      case "ss":
        for (const l of simNetstat()) addTerminalLine({ type: "output", content: l });
        break;

      case "arp":
        for (const l of simArp()) addTerminalLine({ type: "output", content: l });
        break;

      case "traceroute":
        if (!args[0]) {
          addTerminalLine({ type: "error", content: "traceroute: usage: traceroute <host>" });
        } else {
          addTerminalLine({ type: "output", content: `traceroute to ${args[0]}, 30 hops max, 60 byte packets` });
          for (let i = 1; i <= rand(6, 14); i++) {
            addTerminalLine({ type: "output", content: ` ${String(i).padStart(2)}  ${ip()}  ${(i * 3 + Math.random() * 10).toFixed(3)} ms` });
          }
        }
        break;

      case "curl":
        addTerminalLine({ type: "output", content: `> GET ${args[0] || "/"} HTTP/1.1` });
        addTerminalLine({ type: "output", content: `< HTTP/1.1 200 OK` });
        addTerminalLine({ type: "output", content: `< Server: nginx/1.22.0` });
        addTerminalLine({ type: "output", content: `< Content-Type: text/html; charset=UTF-8` });
        addTerminalLine({ type: "output", content: `< X-Powered-By: PHP/8.1.0` });
        break;

      case "hydra":
        if (!args[0]) {
          addTerminalLine({ type: "error", content: "hydra: usage: hydra -l admin -P wordlist.txt ssh://TARGET" });
        } else {
          const t = args[args.length-1].replace("ssh://","").replace("ftp://","");
          for (const l of simHydra(t)) addTerminalLine({ type: "output", content: l });
        }
        break;

      case "sqlmap":
        addTerminalLine({ type: "info", content: "[*] Checking connection..." });
        addTerminalLine({ type: "output", content: `[+] Target: ${args.find(a=>a.startsWith("http"))||"http://target.com/?id=1"}` });
        addTerminalLine({ type: "output", content: `[+] GET parameter 'id' is injectable (MySQL >= 5.0)` });
        addTerminalLine({ type: "output", content: `[*] Fetching databases: information_schema, mysql, target_db` });
        break;

      case "msfvenom":
        for (const l of simMsfvenom(args)) addTerminalLine({ type: "output", content: l });
        break;

      case "nc":
        for (const l of simNc(args)) addTerminalLine({ type: "output", content: l });
        break;

      case "hashcat":
        if (!args[0]) {
          addTerminalLine({ type: "error", content: "hashcat: usage: hashcat -m0 <hash> rockyou.txt" });
        } else {
          const hash = args.find(a => !a.startsWith("-") && a !== "rockyou.txt") || args[0];
          for (const l of simHashcat(hash)) addTerminalLine({ type: "output", content: l });
        }
        break;

      case "john":
        for (const l of simJohn(args)) addTerminalLine({ type: "output", content: l });
        break;

      case "crunch":
        for (const l of simCrunch(args[0]||"8", args[1]||"8")) addTerminalLine({ type: "output", content: l });
        break;

      case "hashid":
        if (!args[0]) {
          addTerminalLine({ type: "error", content: "hashid: usage: hashid <hash>" });
        } else {
          for (const l of simHashid(args[0])) addTerminalLine({ type: "output", content: l });
        }
        break;

      case "nikto":
        addTerminalLine({ type: "output", content: `- Nikto v2.1.6` });
        addTerminalLine({ type: "output", content: `[+] Target: ${args.find(a=>!a.startsWith("-"))||"target"} Port: 80` });
        addTerminalLine({ type: "output", content: `[!] Server: Apache/2.4.51 PHP/8.1` });
        addTerminalLine({ type: "output", content: `[!] /admin/: Directory indexing enabled` });
        addTerminalLine({ type: "output", content: `[!] /wp-login.php: WordPress login found` });
        addTerminalLine({ type: "output", content: `[!] X-Frame-Options header missing` });
        addTerminalLine({ type: "output", content: `[i] 7914 requests, 0 errors, 8 items found` });
        break;

      case "gobuster":
        addTerminalLine({ type: "output", content: `GoBuster v3.6 — Dir Scan` });
        addTerminalLine({ type: "output", content: `[+] URL: ${args.find(a=>a.startsWith("http"))||"http://target.com"}` });
        for (const d of ["/admin","/login","/api","/backup","/.git","/config","/uploads"]) {
          addTerminalLine({ type: "output", content: `${d.padEnd(25)} (Status: ${rand(0,1)?200:403}) [Size: ${rand(100,9999)}]` });
        }
        addTerminalLine({ type: "output", content: `Done: 4614 requests in ${rand(5,30)}s` });
        break;

      case "ffuf":
        for (const l of simFfuf(args.find(a=>a.startsWith("http"))||"http://target.com")) addTerminalLine({ type: "output", content: l });
        break;

      case "wpscan":
        for (const l of simWpscan(args.find(a=>a.startsWith("http"))||"http://target.com")) addTerminalLine({ type: "output", content: l });
        break;

      case "strings":
        if (!args[0]) {
          addTerminalLine({ type: "error", content: "strings: usage: strings <file>" });
        } else {
          for (const l of simStrings(args[0])) addTerminalLine({ type: "output", content: l });
        }
        break;

      case "xxd":
        if (!args[0]) {
          addTerminalLine({ type: "error", content: "xxd: usage: xxd <file>" });
        } else {
          for (const l of simXxd(args[0])) addTerminalLine({ type: "output", content: l });
        }
        break;

      case "binwalk":
        if (!args[0]) {
          addTerminalLine({ type: "error", content: "binwalk: usage: binwalk <file>" });
        } else {
          for (const l of simBinwalk(args[0])) addTerminalLine({ type: "output", content: l });
        }
        break;

      case "volatility":
        for (const l of simVolatility(args)) addTerminalLine({ type: "output", content: l });
        break;

      case "airmon-ng":
        for (const l of simAirmon(args[1]||"wlan0")) addTerminalLine({ type: "output", content: l });
        break;

      case "airodump-ng":
        addTerminalLine({ type: "output", content: ` BSSID              PWR  Beacons  #Data  CH  MB   ENC  CIPHER AUTH ESSID` });
        for (let i = 0; i < rand(3,7); i++) {
          addTerminalLine({ type: "output", content: ` ${mac()}  -${rand(30,90)}  ${rand(10,200)}      ${rand(0,50)}   ${rand(1,11)}  130  WPA2 CCMP   PSK  Network_${rand(100,999)}` });
        }
        break;

      case "aircrack-ng":
        addTerminalLine({ type: "output", content: `Aircrack-ng 1.7` });
        addTerminalLine({ type: "output", content: `[00:03:42] ${rand(10000,99999)} keys tested (${rand(1000,9999)} k/s)` });
        addTerminalLine({ type: "success", content: `                   KEY FOUND! [ ${["RedDevil","admin123","password!"][rand(0,2)]} ]` });
        break;

      case "ssh":
        addTerminalLine({ type: "output", content: `ssh: connect to host ${args[args.length-1]} port 22: Connected` });
        addTerminalLine({ type: "success", content: `[+] Authenticated as root` });
        addTerminalLine({ type: "output", content: `Welcome to Ubuntu 22.04 LTS (GNU/Linux 5.15.0 x86_64)` });
        break;

      case "ftp":
        addTerminalLine({ type: "output", content: `Connected to ${args[0]||"target"}.` });
        addTerminalLine({ type: "output", content: `220 (vsFTPd 3.0.5)` });
        addTerminalLine({ type: "output", content: `331 Please specify the password.` });
        addTerminalLine({ type: "success", content: `230 Login successful.` });
        break;

      case "file":
        addTerminalLine({ type: "output", content: `${args[0]||"unknown"}: ELF 64-bit LSB executable, x86-64, dynamically linked, interpreter /lib64/ld-linux-x86-64.so.2, for GNU/Linux 3.2.0, BuildID[sha1]=abc123, not stripped` });
        break;

      case "strings":
        for (const l of simStrings(args[0]||"binary")) addTerminalLine({ type: "output", content: l });
        break;

      case "base64":
        if (args.includes("-d")) {
          addTerminalLine({ type: "output", content: `Decoded: root:toor` });
        } else {
          addTerminalLine({ type: "output", content: `cm9vdDp0b29y` });
        }
        break;

      case "chmod":
        addTerminalLine({ type: "success", content: `[+] chmod ${args.join(" ")} — OK` });
        break;

      case "find":
        for (const f of [`/root/.ssh/id_rsa`,`/etc/passwd`,`/var/www/html/config.php`,`/home/user/.bash_history`]) {
          if (Math.random() > 0.4) addTerminalLine({ type: "output", content: f });
        }
        break;

      case "mkdir":
        addTerminalLine({ type: "success", content: `[+] Directory created: ${args[0]||"newdir"}` });
        break;

      case "rm":
        addTerminalLine({ type: "success", content: `[+] Removed: ${args.join(" ")}` });
        break;

      case "cp":
      case "mv":
        addTerminalLine({ type: "success", content: `[+] ${command.toUpperCase()} ${args.join(" → ")} done` });
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
            addTerminalLine({ type: "output", content: "bin  dev  etc  home  lib  proc  root  sys  tmp  usr  var" });
          }
        } catch {
          addTerminalLine({ type: "output", content: "bin  dev  etc  home  lib  proc  root  sys  tmp  usr  var" });
        }
        break;
      }

      case "cd":
        if (!args[0] || args[0] === "~") {
          setCurrentPath("/root");
        } else if (args[0] === "..") {
          const p2 = currentPath.split("/").filter(Boolean);
          p2.pop();
          setCurrentPath("/" + p2.join("/") || "/");
        } else {
          setCurrentPath(args[0].startsWith("/") ? args[0] : `${currentPath}/${args[0]}`);
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
        } else {
          setActiveScreen("ai");
          addAiMessage({ role: "user", content: query });
        }
        break;
      }

      default:
        addTerminalLine({ type: "error", content: `bash: ${command}: command not found` });
        if (["wireshark","burpsuite","metasploit","msfconsole","responder","enum4linux","smbclient","rpcclient","crackmapexec","bloodhound","mimikatz","beef","setoolkit","maltego"].includes(command)) {
          addTerminalLine({ type: "info", content: `[~] Use the TOOLS tab for ${command}` });
        }
    }
  }, [addTerminalLine, clearTerminal, currentPath, setCurrentPath, setActiveScreen, addAiMessage, addToHistory, commandHistory]);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={0}>
      <View style={styles.header}>
        <Text style={[styles.headerText, { color: "#cc0000" }]}>root@lazy-devil:{currentPath}</Text>
        <TouchableOpacity onPress={clearHistory}>
          <Text style={{ color: "#440000", fontFamily: "monospace", fontSize: 9 }}>CLR HIST</Text>
        </TouchableOpacity>
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

      {suggestions.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.suggRow}
          contentContainerStyle={{ gap: 6, paddingHorizontal: 8, paddingVertical: 5 }}
        >
          {suggestions.map((s) => (
            <TouchableOpacity
              key={s}
              style={styles.suggChip}
              onPress={() => {
                setInput(s);
                setSuggestions([]);
                inputRef.current?.focus();
                Haptics.selectionAsync();
              }}
            >
              <Text style={styles.suggText}>{s}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={() => setSuggestions([])} style={styles.suggClose}>
            <Text style={{ color: "#440000", fontFamily: "monospace", fontSize: 10 }}>✕</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      <View style={[styles.navRow]}>
        <TouchableOpacity style={styles.navBtn} onPress={() => navigateHistory("up")}>
          <Text style={styles.navBtnText}>▲</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => navigateHistory("down")}>
          <Text style={styles.navBtnText}>▼</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.micBtn, isListening && styles.micActive]}
          onPress={isListening ? stopVoice : startVoice}
        >
          <Text style={styles.micText}>{isListening ? "◼ STOP" : "🎙 MIC"}</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.inputRow, { borderTopColor: "#330000", paddingBottom: insets.bottom + 90 }]}>
        <Text style={[styles.prompt, { color: "#cc0000" }]}># </Text>
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: "#ff3333" }]}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => { runCommand(input); setInput(""); }}
          returnKeyType="send"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          placeholderTextColor="#440000"
          placeholder="enter command..."
          blurOnSubmit={false}
        />
        <TouchableOpacity
          onPress={() => { runCommand(input); setInput(""); }}
          style={[styles.runBtn, { borderColor: "#cc0000" }]}
        >
          <Text style={[styles.runBtnText, { color: "#cc0000" }]}>RUN</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 8, paddingVertical: 5,
    borderBottomWidth: 1, borderBottomColor: "#330000",
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  headerText: { fontFamily: "monospace", fontSize: 11 },
  output: { flex: 1 },
  suggRow: { borderTopWidth: 1, borderTopColor: "#1a0000", flexGrow: 0, maxHeight: 36 },
  suggChip: { borderWidth: 1, borderColor: "#550000", paddingHorizontal: 8, paddingVertical: 3, backgroundColor: "#0a0000" },
  suggText: { fontFamily: "monospace", fontSize: 10, color: "#ff3333" },
  suggClose: { paddingHorizontal: 6, paddingVertical: 3 },
  navRow: { flexDirection: "row", gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderTopWidth: 1, borderTopColor: "#1a0000" },
  navBtn: { borderWidth: 1, borderColor: "#330000", paddingHorizontal: 12, paddingVertical: 4 },
  navBtnText: { color: "#880000", fontFamily: "monospace", fontSize: 12 },
  micBtn: { borderWidth: 1, borderColor: "#330000", paddingHorizontal: 10, paddingVertical: 4, marginLeft: "auto" },
  micActive: { backgroundColor: "#330000", borderColor: "#cc0000" },
  micText: { color: "#cc0000", fontFamily: "monospace", fontSize: 10 },
  inputRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingTop: 6, borderTopWidth: 1 },
  prompt: { fontFamily: "monospace", fontSize: 14, fontWeight: "bold" },
  input: { flex: 1, fontFamily: "monospace", fontSize: 13, paddingVertical: 6 },
  runBtn: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5, marginLeft: 6 },
  runBtnText: { fontFamily: "monospace", fontSize: 11, fontWeight: "bold" },
});
