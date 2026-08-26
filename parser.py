import re

def clean_value(val):
    if not val:
        return ""
    return val.strip()

def parse_system_info(text):
    text = text.replace('\r\n', '\n')
    raw_lines = text.split('\n')
    lines = [line.strip() for line in raw_lines]
    
    data = {
        "department": "",
        "hostname": "",
        "serial_number": "",
        "user_directories": [],
        "configured_user_profiles": [],
        "trend_micro_agent_version": "",
        "trend_micro_scan_engine": "",
        "virus_scan_engine_alt": "",
        "self_scan_installed": False,
        "self_scan_status_text": "Not Installed",
        "self_scan_path": "",
        "self_scan_command": "",
        "netskope_installed": False,
        "netskope_status_text": "Not Installed",
        "model_name": "",
        "ip_address": "",
        "network_adapters": [],
        "wifi_mac": "Not Installed",
        "ethernet_mac": "Not Installed",
        "raw_log": text
    }

    # 0. Department
    try:
        idx = next((i for i, l in enumerate(lines) if "Department:" in l), -1)
        if idx != -1:
            for offset in range(1, 5):
                if idx + offset < len(lines) and lines[idx + offset]:
                    line = lines[idx + offset]
                    if "---" in line:
                        break
                    data["department"] = line
                    break
    except Exception:
        pass

    # 1. Hostname
    try:
        idx = next((i for i, l in enumerate(lines) if "Hostname:" in l), -1)
        if idx != -1:
            for offset in range(1, 5):
                if idx + offset < len(lines) and lines[idx + offset]:
                    data["hostname"] = lines[idx + offset]
                    break
    except Exception:
        pass

    # 2. Serial Number
    try:
        idx = next((i for i, l in enumerate(lines) if "Serial Number:" in l), -1)
        if idx != -1:
            for offset in range(1, 5):
                if idx + offset < len(lines) and lines[idx + offset]:
                    data["serial_number"] = lines[idx + offset]
                    break
    except Exception:
        pass

    # 3. User Directories Found
    try:
        idx = next((i for i, l in enumerate(lines) if "User Directories Found:" in l), -1)
        if idx != -1:
            for offset in range(1, 20):
                curr_idx = idx + offset
                if curr_idx >= len(lines):
                    break
                line = lines[curr_idx]
                if not line:
                    continue
                if "---" in line or "Configured User Profiles" in line:
                    break
                data["user_directories"].append(line)
    except Exception:
        pass

    # 4. Configured User Profiles
    try:
        idx = next((i for i, l in enumerate(lines) if "Configured User Profiles:" in l), -1)
        if idx != -1:
            for offset in range(1, 30):
                curr_idx = idx + offset
                if curr_idx >= len(lines):
                    break
                line = lines[curr_idx]
                if "Trend Micro" in line or "=====" in line or (offset > 5 and line.startswith("---")):
                    break
                if not line or line.startswith("LocalPath") or line.startswith("---------"):
                    continue
                
                sid_match = re.search(r'(S-1-[0-9-]+)', line)
                if sid_match:
                    sid = sid_match.group(1).strip()
                    local_path = line[:sid_match.start()].strip()
                    if local_path.lower().startswith("c:\\") or "serviceprofiles" in local_path.lower():
                        data["configured_user_profiles"].append({
                            "local_path": local_path,
                            "sid": sid
                        })
    except Exception:
        pass

    # 5. Trend Micro Component Versions
    try:
        idx = next((i for i, l in enumerate(lines) if "Trend Micro Component Versions:" in l), -1)
        if idx != -1:
            for offset in range(1, 10):
                curr_idx = idx + offset
                if curr_idx >= len(lines):
                    break
                line = lines[curr_idx]
                if line.startswith("---") or line.startswith("===") or "SelfScan Status" in line or "Virus Scan Engine:" in line and not ":" in line:
                    break
                if "Virus Scan Engine:" in line:
                    data["trend_micro_scan_engine"] = clean_value(line.replace("Virus Scan Engine:", ""))
                elif "Agent Version:" in line:
                    data["trend_micro_agent_version"] = clean_value(line.replace("Agent Version:", ""))
    except Exception:
        pass

    # 6. Standalone Virus Scan Engine (wide-char spaced version)
    try:
        for i, l in enumerate(lines):
            if l == "Virus Scan Engine:":
                is_component_version = False
                for back_offset in range(1, 5):
                    if i - back_offset >= 0:
                        prev_line = lines[i - back_offset]
                        if "Trend Micro Component Versions" in prev_line:
                            is_component_version = True
                            break
                        if "---" in prev_line:
                            break
                if is_component_version:
                    continue
                
                for offset in range(1, 5):
                    if i + offset < len(lines) and lines[i + offset]:
                        spaced_val = lines[i + offset]
                        if "---" in spaced_val or "SelfScan" in spaced_val:
                            break
                        cleaned_val = spaced_val.replace(" ", "")
                        if re.match(r'^\d+(\.\d+)*$', cleaned_val):
                            data["virus_scan_engine_alt"] = cleaned_val
                            break
    except Exception:
        pass

    # 7. Parse SelfScan Status
    try:
        idx = next((i for i, l in enumerate(lines) if "SelfScan Status:" in l), -1)
        if idx != -1:
            for offset in range(1, 10):
                curr_idx = idx + offset
                if curr_idx >= len(lines):
                    break
                line = lines[curr_idx]
                if "---" in line or "Netskope Status" in line or "Network Adapters" in line:
                    break
                if "SelfScan is" in line:
                    data["self_scan_installed"] = "INSTALLED" in line.upper() and "NOT INSTALLED" not in line.upper()
                    data["self_scan_status_text"] = "Installed" if data["self_scan_installed"] else "Not Installed"
                elif line.startswith("Path:"):
                    data["self_scan_path"] = clean_value(line.replace("Path:", ""))
                elif line.startswith("Running Command:"):
                    cmd_line = ""
                    for cmd_offset in range(1, 4):
                        if curr_idx + cmd_offset < len(lines):
                            next_l = lines[curr_idx + cmd_offset]
                            if next_l and not next_l.startswith("---") and not next_l.startswith("Network Adapters") and not next_l.startswith("Netskope Status"):
                                cmd_line = next_l
                                break
                    data["self_scan_command"] = clean_value(cmd_line)
    except Exception:
        pass

    # 8. Netskope Status
    try:
        idx = next((i for i, l in enumerate(lines) if "Netskope Status:" in l), -1)
        if idx != -1:
            for offset in range(1, 5):
                if idx + offset < len(lines) and lines[idx + offset]:
                    line = lines[idx + offset]
                    if "---" in line:
                        break
                    data["netskope_installed"] = "INSTALLED" in line.upper() and "NOT INSTALLED" not in line.upper()
                    data["netskope_status_text"] = "Installed" if data["netskope_installed"] else "Not Installed"
                    break
    except Exception:
        pass

    # 9. Model Name
    try:
        idx = next((i for i, l in enumerate(lines) if "Model Name:" in l), -1)
        if idx != -1:
            for offset in range(1, 5):
                if idx + offset < len(lines) and lines[idx + offset]:
                    line = lines[idx + offset]
                    if "---" in line:
                        break
                    data["model_name"] = line
                    break
    except Exception:
        pass

    # 10. IP Address
    try:
        idx = next((i for i, l in enumerate(lines) if "IP Address:" in l), -1)
        if idx != -1:
            for offset in range(1, 5):
                if idx + offset < len(lines) and lines[idx + offset]:
                    line = lines[idx + offset]
                    if "---" in line:
                        break
                    data["ip_address"] = line
                    break
    except Exception:
        pass

    # 11. Network Adapters and MAC Addresses
    try:
        idx = next((i for i, l in enumerate(lines) if "Network Adapters and MAC Addresses:" in l), -1)
        if idx != -1:
            for offset in range(1, 40):
                curr_idx = idx + offset
                if curr_idx >= len(lines):
                    break
                line = lines[curr_idx]
                if "=====" in line or (offset > 5 and line.startswith("---")):
                    break
                if not line or line.startswith("Name") or line.startswith("----"):
                    continue
                
                mac = ""
                mac_match = re.search(r'([0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2})', line)
                remaining_line = line
                if mac_match:
                    mac = mac_match.group(1).strip()
                    remaining_line = line[:mac_match.start()].strip()
                
                status = "Unknown"
                status_match = re.search(r'\s+(up|down|disconnected|not\s+present|testing|dormant|disabled|unknown|connected|present)\s*$', remaining_line, re.IGNORECASE)
                name = remaining_line
                if status_match:
                    status = status_match.group(1).strip()
                    name = remaining_line[:status_match.start()].strip()
                
                if status.lower() == 'up':
                    status = 'Up'
                elif status.lower() == 'down':
                    status = 'Down'
                elif status.lower() == 'disconnected':
                    status = 'Disconnected'
                elif status.lower() == 'not present':
                    status = 'Not Present'
                    
                data["network_adapters"].append({
                    "name": name,
                    "status": status,
                    "mac_address": mac
                })
    except Exception:
        pass

    # Classify Network Adapters (Ethernet vs Wi-Fi) and sort active first
    try:
        active_wifi = []
        inactive_wifi = []
        active_eth = []
        inactive_eth = []

        for adapter in data["network_adapters"]:
            name = adapter["name"].lower()
            mac = adapter["mac_address"]
            status = adapter["status"]
            if not mac:
                continue

            if "wi-fi" in name or "wifi" in name or "wireless" in name or "wlan" in name:
                if status == "Up":
                    active_wifi.append(mac)
                else:
                    inactive_wifi.append(mac)
            elif "ethernet" in name:
                if status == "Up":
                    active_eth.append(mac)
                else:
                    inactive_eth.append(mac)

        wifi_macs = active_wifi + inactive_wifi
        ethernet_macs = active_eth + inactive_eth

        data["wifi_mac"] = ", ".join(wifi_macs) if wifi_macs else "Not Installed"
        data["ethernet_mac"] = ", ".join(ethernet_macs) if ethernet_macs else "Not Installed"
    except Exception:
        pass

    # Standardize software compliance to show "Not Installed" instead of missing/unknown/Not Found
    for key in ["trend_micro_agent_version", "trend_micro_scan_engine", "virus_scan_engine_alt"]:
        val = data.get(key, "")
        if not val or val.lower() in ["not found", "unknown", "not_found", ""]:
            data[key] = "Not Installed"

    return data
