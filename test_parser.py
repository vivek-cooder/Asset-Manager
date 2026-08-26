import json
from parser import parse_system_info

sample_data = """======================================= 
          SYSTEM INFORMATION            
======================================= 
 
Department: 
HR
--------------------------------------- 
Hostname: 
TALJ-HRD1
--------------------------------------- 
Serial Number: 
1N111807F0 
--------------------------------------- 
User Directories Found: 
admin
HRD1
Public
tljitadmin
--------------------------------------- 
Configured User Profiles: 

LocalPath                                   SID                                                            
---------                                   ---                                                            
C:\\windows\\ServiceProfiles\\MSSQL$SQLEXPRESS S-1-5-80-3880006512-4290199581-1648723128-3569869737-3631323133
C:\\Users\\HRD1                               S-1-5-21-966906744-3358157391-2775791923-1005                  
C:\\Users\\admin                              S-1-5-21-966906744-3358157391-2775791923-1001                  
C:\\Users\\tljitadmin                         S-1-5-21-553378609-2914435982-2802585094-2144                  



--------------------------------------- 
Trend Micro Component Versions: 
Virus Scan Engine: 25.560-1004 
Agent Version: 14.0 
--------------------------------------- 
Virus Scan Engine: 
2 6 . 5 1 0 . 1 0 0 5 
 
 --------------------------------------- 
SelfScan Status: 
🔥 SelfScan is INSTALLED 
Path: C:\\SelfScan.exe 
Running Command: 
"C:\\SelfScan.exe" apiKey=1003.319a8bd3a181b66f581412212dd46834.af3c218ec65c8293dc119410dddf9452 server=sdpondemand.manageengine.in 
--------------------------------------- 
Netskope Status: 
❌ Netskope is NOT INSTALLED 
--------------------------------------- 
Model Name: 
ThinkPad L14 Gen 1
--------------------------------------- 
IP Address: 
192.168.1.15
--------------------------------------- 
Network Adapters and MAC Addresses: 

Name            Status       MacAddress       
----            ------       ----------       
Ethernet 2      Disconnected 00-FF-AD-78-9D-D8
Ethernet        Up           00-68-EB-BC-2A-C5
BARCODE PRINTER Up           14-EB-B6-19-58-17



--------------------------------------- """

def run_test():
    result = parse_system_info(sample_data)
    print("Parsed Data Output:")
    print(json.dumps(result, indent=2))
    
    # Assertions
    assert result["department"] == "HR"
    assert result["hostname"] == "TALJ-HRD1"
    assert result["serial_number"] == "1N111807F0"
    assert "admin" in result["user_directories"]
    assert len(result["configured_user_profiles"]) == 4
    assert result["trend_micro_agent_version"] == "14.0"
    assert result["trend_micro_scan_engine"] == "25.560-1004"
    assert result["virus_scan_engine_alt"] == "26.510.1005"
    assert result["self_scan_installed"] is True
    
    # Netskope & IP
    assert result["netskope_installed"] is False
    assert result["netskope_status_text"] == "Not Installed"
    assert result["model_name"] == "ThinkPad L14 Gen 1"
    assert result["ip_address"] == "192.168.1.15"
    
    # MAC classification
    assert result["wifi_mac"] == "Not Installed"
    # Active Ethernet (00-68-EB-BC-2A-C5) should be first, inactive Ethernet 2 second
    assert result["ethernet_mac"] == "00-68-EB-BC-2A-C5, 00-FF-AD-78-9D-D8"
    
    print("\nAll classified MAC and compliance parser assertions PASSED!")

if __name__ == "__main__":
    run_test()
