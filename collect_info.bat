@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

:: =========================================================================
:: ASSET MANAGER CLIENT SCANNER & UPLOAD SCRIPT
:: =========================================================================
:: Configure your Dashboard Server URL below.
:: - Local machine testing: http://localhost:3000/api/upload
:: - Local Network / WiFi:  http://192.168.0.101:3000/api/upload
:: - Hosted over Internet:  https://your-domain.com/api/upload
:: =========================================================================
set "SERVER_URL=http://localhost:3000/api/upload"

:: Detect actual Desktop path (handles OneDrive or custom locations)
set "DESKTOP_DIR="
for /f "usebackq delims=" %%A in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "[Environment]::GetFolderPath('Desktop')"` ) do (
    set "DESKTOP_DIR=%%A"
)
if not defined DESKTOP_DIR set "DESKTOP_DIR=%USERPROFILE%\Desktop"
if not exist "!DESKTOP_DIR!" set "DESKTOP_DIR=%USERPROFILE%\Desktop"
if not exist "!DESKTOP_DIR!" set "DESKTOP_DIR=%TEMP%"

set "output_file=!DESKTOP_DIR!\system_info.txt"

:SelectDept
cls
echo ============================================================
echo           ASSET MANAGER - SYSTEM INVENTORY SCANNER
echo ============================================================
echo.
echo Please select the Department for this computer:
echo.
echo   [1]  IT                     [11] DISPATCH
echo   [2]  ACCOUNTS               [12] SECURITY GATE
echo   [3]  HR                     [13] COM
echo   [4]  EHS                    [14] PURCHASE
echo   [5]  OHC                    [15] RND
echo   [6]  PRODUCTION             [16] CO-ORPORATE
echo   [7]  PLANNING               [17] QUALITY ASSURANCE
echo   [8]  ETP                    [18] ENGINEERING SERVICES
echo   [9]  CHARGING               [19] CASTING
echo   [10] PRODUCTION LINE        [20] POWER HOUSE
echo.
echo ============================================================
set "DEPT_CHOICE="
set "DEPARTMENT="
set /p "DEPT_CHOICE=Enter Department number (1-20): "

if "!DEPT_CHOICE!"=="1" set "DEPARTMENT=IT"
if "!DEPT_CHOICE!"=="2" set "DEPARTMENT=ACCOUNTS"
if "!DEPT_CHOICE!"=="3" set "DEPARTMENT=HR"
if "!DEPT_CHOICE!"=="4" set "DEPARTMENT=EHS"
if "!DEPT_CHOICE!"=="5" set "DEPARTMENT=OHC"
if "!DEPT_CHOICE!"=="6" set "DEPARTMENT=PRODUCTION"
if "!DEPT_CHOICE!"=="7" set "DEPARTMENT=PLANNING"
if "!DEPT_CHOICE!"=="8" set "DEPARTMENT=ETP"
if "!DEPT_CHOICE!"=="9" set "DEPARTMENT=CHARGING"
if "!DEPT_CHOICE!"=="10" set "DEPARTMENT=PRODUCTION LINE"
if "!DEPT_CHOICE!"=="11" set "DEPARTMENT=DISPATCH"
if "!DEPT_CHOICE!"=="12" set "DEPARTMENT=SECURITY GATE"
if "!DEPT_CHOICE!"=="13" set "DEPARTMENT=COM"
if "!DEPT_CHOICE!"=="14" set "DEPARTMENT=PURCHASE"
if "!DEPT_CHOICE!"=="15" set "DEPARTMENT=RND"
if "!DEPT_CHOICE!"=="16" set "DEPARTMENT=CO-ORPORATE"
if "!DEPT_CHOICE!"=="17" set "DEPARTMENT=QUALITY ASSURANCE"
if "!DEPT_CHOICE!"=="18" set "DEPARTMENT=ENGINEERING SERVICES"
if "!DEPT_CHOICE!"=="19" set "DEPARTMENT=CASTING"
if "!DEPT_CHOICE!"=="20" set "DEPARTMENT=POWER HOUSE"

if not defined DEPARTMENT (
    echo.
    echo [ERROR] Invalid selection "!DEPT_CHOICE!". Please choose a number from 1 to 20.
    timeout /t 2 >nul
    goto SelectDept
)

echo.
echo [OK] Selected Department: !DEPARTMENT!
echo.
echo ============================================================
echo   Running system inventory scan. Please wait...
echo ============================================================
echo.

echo ======================================= > "!output_file!"
echo           SYSTEM INFORMATION            >> "!output_file!"
echo ======================================= >> "!output_file!"
echo. >> "!output_file!"

:: Department
echo Department: >> "!output_file!"
echo !DEPARTMENT! >> "!output_file!"
echo --------------------------------------- >> "!output_file!"

:: Hostname
echo Hostname: >> "!output_file!"
hostname >> "!output_file!"
echo --------------------------------------- >> "!output_file!"

:: Serial Number
echo Serial Number: >> "!output_file!"
for /f "usebackq delims=" %%A in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "(Get-CimInstance Win32_BIOS).SerialNumber"` ) do (
    echo %%A >> "!output_file!"
)
echo --------------------------------------- >> "!output_file!"

:: User Folders
echo User Directories Found: >> "!output_file!"
if exist "C:\Users" (
    dir C:\Users /b >> "!output_file!" 2>nul
)
echo --------------------------------------- >> "!output_file!"

:: User Profiles
echo Configured User Profiles: >> "!output_file!"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_UserProfile | Select-Object LocalPath,SID | Format-Table -AutoSize | Out-String -Width 300" >> "!output_file!"
echo --------------------------------------- >> "!output_file!"

:: Trend Micro Info
echo Trend Micro Component Versions: >> "!output_file!"

set "TM_VSAPI=Not Found"
set "TM_AGENT=Not Found"

if exist "C:\Program Files (x86)\Trend Micro\Security Agent\vsapi64.dll" (
    for /f "usebackq delims=" %%A in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "[System.Diagnostics.FileVersionInfo]::GetVersionInfo('C:\Program Files (x86)\Trend Micro\Security Agent\vsapi64.dll').FileVersion"` ) do (
        set "TM_VSAPI=%%A"
    )
)

if exist "C:\Program Files (x86)\Trend Micro\Security Agent\Ntrtscan.exe" (
    for /f "usebackq delims=" %%A in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "[System.Diagnostics.FileVersionInfo]::GetVersionInfo('C:\Program Files (x86)\Trend Micro\Security Agent\Ntrtscan.exe').ProductVersion"` ) do (
        set "TM_AGENT=%%A"
    )
)

echo Virus Scan Engine: !TM_VSAPI! >> "!output_file!"
echo Agent Version: !TM_AGENT! >> "!output_file!"
echo --------------------------------------- >> "!output_file!"

:: Trend Micro Virus Scan Engine (Registry)
echo Virus Scan Engine: >> "!output_file!"
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { (Get-ItemProperty 'HKLM:\SOFTWARE\WOW6432Node\TrendMicro\PC-cillinNTCorp\CurrentVersion\Misc.' -ErrorAction Stop).PSObject.Properties['VsApiNT-Ver'].Value } catch {}" >> "!output_file!"
echo --------------------------------------- >> "!output_file!"

:: SelfScan Check
echo SelfScan Status: >> "!output_file!"
set "SELFSCAN_PATH=C:\SelfScan.exe"
if exist "C:\SelfScan.exe" (
    echo 🔥 SelfScan is INSTALLED >> "!output_file!"
    echo Path: C:\SelfScan.exe >> "!output_file!"
    echo Running Command: >> "!output_file!"
    echo "C:\SelfScan.exe" apiKey=1003.319a8bd3a181b66f581412212dd46834.af3c218ec65c8293dc119410dddf9452 server=sdpondemand.manageengine.in >> "!output_file!"
    start "" "C:\SelfScan.exe" apiKey=1003.319a8bd3a181b66f581412212dd46834.af3c218ec65c8293dc119410dddf9452 server=sdpondemand.manageengine.in
) else (
    echo ❌ SelfScan is NOT INSTALLED >> "!output_file!"
)
echo --------------------------------------- >> "!output_file!"

:: Netskope Check
echo Netskope Status: >> "!output_file!"
if exist "C:\Program Files\Netskope" (
    echo 🔥 Netskope is INSTALLED >> "!output_file!"
) else (
    echo ❌ Netskope is NOT INSTALLED >> "!output_file!"
)
echo --------------------------------------- >> "!output_file!"

:: Model Name
echo Model Name: >> "!output_file!"
for /f "usebackq delims=" %%A in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "(Get-CimInstance Win32_ComputerSystem).Model"` ) do (
    echo %%A >> "!output_file!"
)
echo --------------------------------------- >> "!output_file!"

:: IP Address
echo IP Address: >> "!output_file!"
for /f "usebackq delims=" %%A in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "(Get-CimInstance Win32_NetworkAdapterConfiguration | Where-Object IPEnabled | Select-Object -ExpandProperty IPAddress)[0]"` ) do (
    echo %%A >> "!output_file!"
)
echo --------------------------------------- >> "!output_file!"

:: Network Adapters
echo Network Adapters and MAC Addresses: >> "!output_file!"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetAdapter | Select-Object Name,Status,MacAddress | Format-Table -AutoSize | Out-String -Width 300" >> "!output_file!"
echo --------------------------------------- >> "!output_file!"

:: =========================================================================
:: UPLOAD REPORT TO CENTRAL SERVER
:: =========================================================================
echo.
echo ============================================================
echo   Uploading scan report for [!DEPARTMENT!] to: !SERVER_URL!
echo ============================================================
echo.

set "UPLOAD_SUCCESS=0"

:: Try using curl first
where curl >nul 2>nul
if %ERRORLEVEL% equ 0 (
    curl -s -f -X POST -H "Content-Type: text/plain; charset=utf-8" --data-binary "@!output_file!" "!SERVER_URL!" >nul 2>nul
    if !ERRORLEVEL! equ 0 (
        set "UPLOAD_SUCCESS=1"
    )
)

:: If curl was missing or failed, fallback to PowerShell
if "!UPLOAD_SUCCESS!"=="0" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "$ErrorActionPreference = 'Stop'; try { $resp = Invoke-RestMethod -Uri '!SERVER_URL!' -Method Post -InFile '!output_file!' -ContentType 'text/plain; charset=utf-8'; exit 0; } catch { exit 1; }" >nul 2>nul
    if !ERRORLEVEL! equ 0 (
        set "UPLOAD_SUCCESS=1"
    )
)

if "!UPLOAD_SUCCESS!"=="1" goto :UploadSuccess
goto :UploadFailed

:UploadSuccess
echo [SUCCESS] System inventory [!DEPARTMENT!] uploaded successfully to Asset Dashboard!
goto :Finish

:UploadFailed
echo [WARNING] Automatic upload to !SERVER_URL! failed.
echo Please verify that the server is online and accessible over the network.
echo The scan report is saved at:
echo   "!output_file!"
echo (You can also copy/paste its content manually into the dashboard)
goto :Finish

:Finish
echo.
echo ============================================================
echo Scan complete.
echo ============================================================
echo.
pause
