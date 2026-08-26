const reSid = /(S-1-[0-9-]+)/;
const reMac = /([0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2})/;
const reStatus = /\s+(up|down|disconnected|not\s+present|testing|dormant|disabled|unknown|connected|present)\s*$/i;

function cleanValue(val) {
    if (!val) return '';
    return val.trim();
}

function parseSystemInfo(text) {
    if (!text) text = '';
    text = text.replace(/\r\n/g, '\n');
    const rawLines = text.split('\n');
    const lines = rawLines.map(l => l.trim());

    const data = {
        department: '',
        hostname: '',
        serial_number: '',
        user_directories: [],
        configured_user_profiles: [],
        trend_micro_agent_version: '',
        trend_micro_scan_engine: '',
        virus_scan_engine_alt: '',
        self_scan_installed: false,
        self_scan_status_text: 'Not Installed',
        self_scan_path: '',
        self_scan_command: '',
        netskope_installed: false,
        netskope_status_text: 'Not Installed',
        model_name: '',
        ip_address: '',
        network_adapters: [],
        wifi_mac: 'Not Installed',
        ethernet_mac: 'Not Installed',
        raw_log: text
    };

    // 0. Department
    try {
        const idx = lines.findIndex(l => l.includes('Department:'));
        if (idx !== -1) {
            for (let offset = 1; offset < 5; offset++) {
                if (idx + offset < lines.length && lines[idx + offset]) {
                    const line = lines[idx + offset];
                    if (line.includes('---')) break;
                    data.department = line;
                    break;
                }
            }
        }
    } catch (e) {}

    // 1. Hostname
    try {
        const idx = lines.findIndex(l => l.includes('Hostname:'));
        if (idx !== -1) {
            for (let offset = 1; offset < 5; offset++) {
                if (idx + offset < lines.length && lines[idx + offset]) {
                    data.hostname = lines[idx + offset];
                    break;
                }
            }
        }
    } catch (e) {}

    // 2. Serial Number
    try {
        const idx = lines.findIndex(l => l.includes('Serial Number:'));
        if (idx !== -1) {
            for (let offset = 1; offset < 5; offset++) {
                if (idx + offset < lines.length && lines[idx + offset]) {
                    data.serial_number = lines[idx + offset];
                    break;
                }
            }
        }
    } catch (e) {}

    // 3. User Directories Found
    try {
        const idx = lines.findIndex(l => l.includes('User Directories Found:'));
        if (idx !== -1) {
            for (let offset = 1; offset < 20; offset++) {
                const currIdx = idx + offset;
                if (currIdx >= lines.length) break;
                const line = lines[currIdx];
                if (!line) continue;
                if (line.includes('---') || line.includes('Configured User Profiles')) break;
                data.user_directories.push(line);
            }
        }
    } catch (e) {}

    // 4. Configured User Profiles
    try {
        const idx = lines.findIndex(l => l.includes('Configured User Profiles:'));
        if (idx !== -1) {
            for (let offset = 1; offset < 30; offset++) {
                const currIdx = idx + offset;
                if (currIdx >= lines.length) break;
                const line = lines[currIdx];
                if (line.includes('Trend Micro') || line.includes('=====') || (offset > 5 && line.startsWith('---'))) {
                    break;
                }
                if (!line || line.startsWith('LocalPath') || line.startsWith('---------')) {
                    continue;
                }

                const sidMatch = line.match(reSid);
                if (sidMatch) {
                    const sid = sidMatch[1].trim();
                    const localPath = line.substring(0, sidMatch.index).trim();
                    if (localPath.toLowerCase().startsWith('c:\\') || localPath.toLowerCase().includes('serviceprofiles')) {
                        data.configured_user_profiles.push({
                            local_path: localPath,
                            sid: sid
                        });
                    }
                }
            }
        }
    } catch (e) {}

    // 5. Trend Micro Component Versions
    try {
        const idx = lines.findIndex(l => l.includes('Trend Micro Component Versions:'));
        if (idx !== -1) {
            for (let offset = 1; offset < 10; offset++) {
                const currIdx = idx + offset;
                if (currIdx >= lines.length) break;
                const line = lines[currIdx];
                if (line.startsWith('---') || line.startsWith('===') || line.includes('SelfScan Status') || (line.includes('Virus Scan Engine:') && !line.includes(':'))) {
                    break;
                }
                if (line.includes('Virus Scan Engine:')) {
                    data.trend_micro_scan_engine = cleanValue(line.replace('Virus Scan Engine:', ''));
                } else if (line.includes('Agent Version:')) {
                    data.trend_micro_agent_version = cleanValue(line.replace('Agent Version:', ''));
                }
            }
        }
    } catch (e) {}

    // 6. Standalone Virus Scan Engine (wide-char spaced version)
    try {
        for (let i = 0; i < lines.length; i++) {
            const l = lines[i];
            if (l === 'Virus Scan Engine:') {
                let isComponentVersion = false;
                for (let backOffset = 1; backOffset < 5; backOffset++) {
                    if (i - backOffset >= 0) {
                        const prevLine = lines[i - backOffset];
                        if (prevLine.includes('Trend Micro Component Versions')) {
                            isComponentVersion = true;
                            break;
                        }
                        if (prevLine.includes('---')) {
                            break;
                        }
                    }
                }
                if (isComponentVersion) continue;

                for (let offset = 1; offset < 5; offset++) {
                    if (i + offset < lines.length && lines[i + offset]) {
                        const spacedVal = lines[i + offset];
                        if (spacedVal.includes('---') || spacedVal.includes('SelfScan')) {
                            break;
                        }
                        const cleanedVal = spacedVal.replace(/\s+/g, '');
                        if (/^\d+(\.\d+)*$/.test(cleanedVal)) {
                            data.virus_scan_engine_alt = cleanedVal;
                            break;
                        }
                    }
                }
            }
        }
    } catch (e) {}

    // 7. Parse SelfScan Status
    try {
        const idx = lines.findIndex(l => l.includes('SelfScan Status:'));
        if (idx !== -1) {
            for (let offset = 1; offset < 10; offset++) {
                const currIdx = idx + offset;
                if (currIdx >= lines.length) break;
                const line = lines[currIdx];
                if (line.includes('---') || line.includes('Netskope Status') || line.includes('Network Adapters')) {
                    break;
                }
                if (line.includes('SelfScan is')) {
                    data.self_scan_installed = line.toUpperCase().includes('INSTALLED') && !line.toUpperCase().includes('NOT INSTALLED');
                    data.self_scan_status_text = data.self_scan_installed ? 'Installed' : 'Not Installed';
                } else if (line.startsWith('Path:')) {
                    data.self_scan_path = cleanValue(line.replace('Path:', ''));
                } else if (line.startsWith('Running Command:')) {
                    let cmdLine = '';
                    for (let cmdOffset = 1; cmdOffset < 4; cmdOffset++) {
                        if (currIdx + cmdOffset < lines.length) {
                            const nextL = lines[currIdx + cmdOffset];
                            if (nextL && !nextL.startsWith('---') && !nextL.startsWith('Network Adapters') && !nextL.startsWith('Netskope Status')) {
                                cmdLine = nextL;
                                break;
                            }
                        }
                    }
                    data.self_scan_command = cleanValue(cmdLine);
                }
            }
        }
    } catch (e) {}

    // 8. Netskope Status
    try {
        const idx = lines.findIndex(l => l.includes('Netskope Status:'));
        if (idx !== -1) {
            for (let offset = 1; offset < 5; offset++) {
                if (idx + offset < lines.length && lines[idx + offset]) {
                    const line = lines[idx + offset];
                    if (line.includes('---')) break;
                    data.netskope_installed = line.toUpperCase().includes('INSTALLED') && !line.toUpperCase().includes('NOT INSTALLED');
                    data.netskope_status_text = data.netskope_installed ? 'Installed' : 'Not Installed';
                    break;
                }
            }
        }
    } catch (e) {}

    // 9. Model Name
    try {
        const idx = lines.findIndex(l => l.includes('Model Name:'));
        if (idx !== -1) {
            for (let offset = 1; offset < 5; offset++) {
                if (idx + offset < lines.length && lines[idx + offset]) {
                    const line = lines[idx + offset];
                    if (line.includes('---')) break;
                    data.model_name = line;
                    break;
                }
            }
        }
    } catch (e) {}

    // 10. IP Address
    try {
        const idx = lines.findIndex(l => l.includes('IP Address:'));
        if (idx !== -1) {
            for (let offset = 1; offset < 5; offset++) {
                if (idx + offset < lines.length && lines[idx + offset]) {
                    const line = lines[idx + offset];
                    if (line.includes('---')) break;
                    data.ip_address = line;
                    break;
                }
            }
        }
    } catch (e) {}

    // 11. Network Adapters and MAC Addresses
    try {
        const idx = lines.findIndex(l => l.includes('Network Adapters and MAC Addresses:'));
        if (idx !== -1) {
            for (let offset = 1; offset < 40; offset++) {
                const currIdx = idx + offset;
                if (currIdx >= lines.length) break;
                const line = lines[currIdx];
                if (line.includes('=====') || (offset > 5 && line.startsWith('---'))) {
                    break;
                }
                if (!line || line.startsWith('Name') || line.startsWith('----')) {
                    continue;
                }

                let mac = '';
                const macMatch = line.match(reMac);
                let remainingLine = line;
                if (macMatch) {
                    mac = macMatch[1].trim();
                    remainingLine = line.substring(0, macMatch.index).trim();
                }

                let status = 'Unknown';
                const statusMatch = remainingLine.match(reStatus);
                let name = remainingLine;
                if (statusMatch) {
                    status = statusMatch[1].trim();
                    name = remainingLine.substring(0, statusMatch.index).trim();
                }

                const sLow = status.toLowerCase();
                if (sLow === 'up') status = 'Up';
                else if (sLow === 'down') status = 'Down';
                else if (sLow === 'disconnected') status = 'Disconnected';
                else if (sLow === 'not present') status = 'Not Present';

                data.network_adapters.push({
                    name: name,
                    status: status,
                    mac_address: mac
                });
            }
        }
    } catch (e) {}

    // Classify Network Adapters (Ethernet vs Wi-Fi) and sort active first
    try {
        const activeWifi = [];
        const inactiveWifi = [];
        const activeEth = [];
        const inactiveEth = [];

        for (const adapter of data.network_adapters) {
            const name = adapter.name.toLowerCase();
            const mac = adapter.mac_address;
            const status = adapter.status;
            if (!mac) continue;

            if (name.includes('wi-fi') || name.includes('wifi') || name.includes('wireless') || name.includes('wlan')) {
                if (status === 'Up') {
                    activeWifi.push(mac);
                } else {
                    inactiveWifi.push(mac);
                }
            } else if (name.includes('ethernet')) {
                if (status === 'Up') {
                    activeEth.push(mac);
                } else {
                    inactiveEth.push(mac);
                }
            }
        }

        const wifiMacs = [...activeWifi, ...inactiveWifi];
        const ethernetMacs = [...activeEth, ...inactiveEth];

        data.wifi_mac = wifiMacs.length ? wifiMacs.join(', ') : 'Not Installed';
        data.ethernet_mac = ethernetMacs.length ? ethernetMacs.join(', ') : 'Not Installed';
    } catch (e) {}

    // Standardize software compliance to show "Not Installed"
    for (const key of ['trend_micro_agent_version', 'trend_micro_scan_engine', 'virus_scan_engine_alt']) {
        const val = data[key];
        if (!val || ['not found', 'unknown', 'not_found', ''].includes(val.toLowerCase())) {
            data[key] = 'Not Installed';
        }
    }

    return data;
}

module.exports = { parseSystemInfo };
