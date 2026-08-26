const http = require('http');
const fs = require('fs');

const sample = `======================================= 
          SYSTEM INFORMATION            
======================================= 
 
Department: 
IT
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



--------------------------------------- `;

function testUpload() {
    return new Promise((resolve, reject) => {
        const req = http.request('http://localhost:3000/api/upload', {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain',
                'Content-Length': Buffer.byteLength(sample)
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                console.log('Upload response:', res.statusCode, body);
                resolve(JSON.parse(body));
            });
        });
        req.on('error', reject);
        req.write(sample);
        req.end();
    });
}

function testGetAssets() {
    return new Promise((resolve, reject) => {
        http.get('http://localhost:3000/api/assets', (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                console.log('Get Assets response:', res.statusCode, 'Count:', JSON.parse(body).length);
                resolve(JSON.parse(body));
            });
        }).on('error', reject);
    });
}

function testExport() {
    return new Promise((resolve, reject) => {
        http.get('http://localhost:3000/api/export', (res) => {
            let chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                const totalBytes = Buffer.concat(chunks).length;
                console.log('Export Excel response:', res.statusCode, 'Bytes:', totalBytes, 'ContentType:', res.headers['content-type']);
                resolve(totalBytes);
            });
        }).on('error', reject);
    });
}

async function run() {
    console.log('--- Testing API Upload ---');
    await testUpload();
    console.log('--- Testing API Get Assets ---');
    await testGetAssets();
    console.log('--- Testing API Export Excel ---');
    await testExport();
    console.log('--- ALL API TESTS SUCCESSFUL! ---');
}

run().catch(console.error);
