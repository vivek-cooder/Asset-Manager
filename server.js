const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const XLSX = require('xlsx');
const { parseSystemInfo } = require('./parser');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'assets.json');
const BAT_FILE = path.join(__dirname, 'collect_info.bat');

app.use(cors());

// Support various content types for upload
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.text({ type: ['text/*', 'application/octet-stream', 'application/x-sh', 'text/plain'], limit: '50mb' }));

// Static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// Helper to format date string YYYY-MM-DD HH:mm:ss
function formatCurrentDateTime() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const YYYY = now.getFullYear();
    const MM = pad(now.getMonth() + 1);
    const DD = pad(now.getDate());
    const hh = pad(now.getHours());
    const mm = pad(now.getMinutes());
    const ss = pad(now.getSeconds());
    return `${YYYY}-${MM}-${DD} ${hh}:${mm}:${ss}`;
}

function formatFilenameTimestamp() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const YYYY = now.getFullYear();
    const MM = pad(now.getMonth() + 1);
    const DD = pad(now.getDate());
    const hh = pad(now.getHours());
    const mm = pad(now.getMinutes());
    const ss = pad(now.getSeconds());
    return `${YYYY}${MM}${DD}_${hh}${mm}${ss}`;
}

// Get non-internal local IPv4 addresses
function getLocalNetworkIps() {
    const interfaces = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                ips.push({ name, address: net.address });
            }
        }
    }
    return ips;
}

// Data storage helpers
function loadAssets() {
    if (!fs.existsSync(DATA_FILE)) {
        return [];
    }
    try {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        return JSON.parse(raw);
    } catch (err) {
        console.error('Error reading assets.json:', err);
        return [];
    }
}

function saveAssets(assets) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(assets, null, 2), 'utf-8');
    } catch (err) {
        console.error('Error writing assets.json:', err);
    }
}

// 1. Root page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 2. Server info & available network addresses
app.get('/api/server-info', (req, res) => {
    const port = PORT;
    const detectedHost = req.get('host');
    const detectedProtocol = req.protocol;
    const currentOrigin = `${detectedProtocol}://${detectedHost}`;
    const ips = getLocalNetworkIps();
    
    res.json({
        port,
        currentOrigin,
        defaultUploadUrl: `${currentOrigin}/api/upload`,
        networkIps: ips.map(i => ({
            name: i.name,
            ip: i.address,
            uploadUrl: `http://${i.address}:${port}/api/upload`
        }))
    });
});

// 3. Get all assets
app.get('/api/assets', (req, res) => {
    res.json(loadAssets());
});

// 4. Upload & parse system info log
app.post('/api/upload', (req, res) => {
    let logContent = '';

    // Check raw text / body
    if (typeof req.body === 'string' && req.body.trim()) {
        logContent = req.body;
    } else if (req.body && typeof req.body === 'object') {
        if (req.body.log_text) {
            logContent = req.body.log_text;
        } else if (req.body.file) {
            logContent = req.body.file;
        }
    }

    // Check buffer if sent as raw stream
    if (!logContent && Buffer.isBuffer(req.body)) {
        logContent = req.body.toString('utf-8');
    }

    if (!logContent || !logContent.trim()) {
        return res.status(400).json({ success: false, error: 'No log content provided' });
    }

    try {
        const parsedData = parseSystemInfo(logContent);

        if (!parsedData.hostname) {
            return res.status(400).json({ success: false, error: 'Could not parse hostname from log' });
        }

        const assets = loadAssets();
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
        const cleanIp = String(clientIp).replace(/^.*:/, ''); // strip IPv6 prefix if IPv4-mapped

        const existingIdx = assets.findIndex(
            a => (a.hostname || '').toLowerCase() === parsedData.hostname.toLowerCase()
        );

        parsedData.last_updated = formatCurrentDateTime();
        parsedData.sender_ip = cleanIp;
        if (!parsedData.ip_address) {
            parsedData.ip_address = cleanIp;
        }

        let status = 'created';
        if (existingIdx !== -1) {
            parsedData.id = assets[existingIdx].id;
            assets[existingIdx] = parsedData;
            status = 'updated';
        } else {
            parsedData.id = uuidv4().replace(/-/g, '');
            assets.push(parsedData);
            status = 'created';
        }

        saveAssets(assets);
        console.log(`[Upload] System ${parsedData.hostname} ${status} successfully from ${cleanIp}.`);

        return res.json({
            success: true,
            status,
            id: parsedData.id,
            hostname: parsedData.hostname
        });
    } catch (err) {
        console.error('[Upload Error]', err);
        return res.status(500).json({ success: false, error: `Error parsing log: ${err.message}` });
    }
});

// 5. Delete an asset
app.delete('/api/assets/:id', (req, res) => {
    const assetId = req.params.id;
    const assets = loadAssets();
    const filtered = assets.filter(a => a.id !== assetId);

    if (filtered.length === assets.length) {
        return res.status(404).json({ success: false, error: 'Asset not found' });
    }

    saveAssets(filtered);
    res.json({ success: true, message: 'Asset deleted successfully' });
});

// 6. Clear all assets
app.post('/api/assets/clear', (req, res) => {
    saveAssets([]);
    res.json({ success: true, message: 'All assets cleared successfully' });
});

// 7. Download dynamic batch collector script
app.get('/api/download-bat', (req, res) => {
    if (!fs.existsSync(BAT_FILE)) {
        return res.status(404).send('Batch file not found');
    }

    try {
        let batContent = fs.readFileSync(BAT_FILE, 'utf-8');
        
        // Determine the target upload URL
        let targetUrl = req.query.server_url;
        if (!targetUrl) {
            const detectedHost = req.get('host');
            const detectedProtocol = req.protocol;
            targetUrl = `${detectedProtocol}://${detectedHost}/api/upload`;
        }

        // Replace SERVER_URL in bat script
        batContent = batContent.replace(
            /set\s+"SERVER_URL=[^"]*"/g,
            `set "SERVER_URL=${targetUrl}"`
        );

        res.setHeader('Content-Type', 'application/x-bat; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="collect_info.bat"');
        res.send(batContent);
    } catch (err) {
        console.error('Error serving batch file:', err);
        res.status(500).send('Error generating batch file');
    }
});

// 8. Export to Excel
app.get('/api/export', (req, res) => {
    const assets = loadAssets();
    if (!assets || assets.length === 0) {
        return res.status(400).send('No data available to export');
    }

    const flatData = assets.map(asset => {
        const profiles = (asset.configured_user_profiles || []).map(
            p => `${p.local_path} (${p.sid})`
        );
        const profilesStr = profiles.join('\n');
        const userDirsStr = (asset.user_directories || []).join(', ');
        const adapters = (asset.network_adapters || []).map(
            a => `${a.name}: ${a.status} (${a.mac_address})`
        );
        const adaptersStr = adapters.join('\n');

        return {
            'Department': asset.department || 'N/A',
            'Hostname': asset.hostname || '',
            'Serial Number': asset.serial_number || '',
            'Model Name': asset.model_name || '',
            'IP Address': asset.ip_address || '',
            'User Directories': userDirsStr,
            'User Profiles Count': (asset.configured_user_profiles || []).length,
            'Configured User Profiles Detail': profilesStr,
            'Trend Micro Agent Version': asset.trend_micro_agent_version || '',
            'Trend Micro Scan Engine': asset.trend_micro_scan_engine || '',
            'Virus Scan Engine (wide-char)': asset.virus_scan_engine_alt || '',
            'SelfScan Installed': asset.self_scan_installed ? 'Yes' : 'No',
            'SelfScan Path': asset.self_scan_path || '',
            'SelfScan Command': asset.self_scan_command || '',
            'Netskope Installed': asset.netskope_installed ? 'Yes' : 'No',
            'Network Adapters Count': (asset.network_adapters || []).length,
            'Network Adapters Detail': adaptersStr,
            'Last Updated': asset.last_updated || '',
            'Sender IP': asset.sender_ip || ''
        };
    });

    try {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(flatData);

        // Auto column widths
        if (flatData.length > 0) {
            const colWidths = Object.keys(flatData[0]).map(key => {
                let maxLen = key.length;
                flatData.forEach(row => {
                    const val = String(row[key] || '');
                    const lines = val.split('\n');
                    lines.forEach(l => {
                        if (l.length > maxLen) maxLen = l.length;
                    });
                });
                return { wch: Math.min(Math.max(maxLen + 3, 12), 45) };
            });
            ws['!cols'] = colWidths;
        }

        XLSX.utils.book_append_sheet(wb, ws, 'System Assets');
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        const filename = `Asset_Report_${formatFilenameTimestamp()}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
    } catch (err) {
        console.error('Excel export error:', err);
        res.status(500).send(`Excel Generation Failed: ${err.message}`);
    }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    const localIps = getLocalNetworkIps();
    console.log(`================================================================`);
    console.log(`🚀 Asset Manager Server running!`);
    console.log(`📍 Localhost (This PC):    http://localhost:${PORT}`);
    localIps.forEach(i => {
        console.log(`📡 LAN / Wi-Fi (${i.name}): http://${i.address}:${PORT}`);
        console.log(`   ➜ Target for .bat:       http://${i.address}:${PORT}/api/upload`);
    });
    console.log(`🌐 Over Internet / Domain:  https://<YOUR-DOMAIN-OR-IP>/api/upload`);
    console.log(`================================================================`);
});
