// Application State Variables
let assets = [];
let filteredAssets = [];
let currentPage = 1;
const pageSize = 10;

let sortColumn = 'last_updated';
let sortAsc = false;

// Configurable Columns Definition
const columnsDef = [
    { key: 'department', label: 'Department', visible: true },
    { key: 'hostname', label: 'Hostname', visible: true },
    { key: 'serial_number', label: 'Serial Number', visible: true },
    { key: 'model_name', label: 'Model Name', visible: true },
    { key: 'ip_address', label: 'IP Address', visible: true },
    { key: 'trend_micro_agent_version', label: 'TM Agent', visible: true },
    { key: 'trend_micro_scan_engine', label: 'TM Engine', visible: true },
    { key: 'virus_scan_engine_alt', label: 'Scan Engine (Wide)', visible: false },
    { key: 'self_scan_status_text', label: 'SelfScan Status', visible: true },
    { key: 'netskope_status_text', label: 'Netskope Status', visible: true },
    { key: 'configured_user_profiles', label: 'Profiles Count', visible: false },
    { key: 'network_adapters', label: 'Adapters Count', visible: false },
    { key: 'last_updated', label: 'Last Updated', visible: true }
];

let rawBatScriptTemplate = '';
let currentTargetUrl = window.location.origin + '/api/upload';

// Chart Instances
let selfScanChart = null;
let trendMicroChart = null;
let netskopeChart = null;

// Initialize on DOM Load
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    // Initialise Target Server Endpoint
    currentTargetUrl = `${window.location.origin}/api/upload`;
    document.getElementById('target-server-input').value = currentTargetUrl;
    document.getElementById('server-url').textContent = currentTargetUrl;

    // Load Batch script content and server network info from API
    fetchServerInfo();
    fetchBatchScript();

    // Fetch Assets Data
    fetchAssets();

    // Setup Event Listeners
    setupEventListeners();

    // Build Column Selector Menu
    buildColumnSelector();
}

// Fetch network IP info from backend for quick one-click IP switching
function fetchServerInfo() {
    fetch('/api/server-info')
        .then(r => r.json())
        .then(info => {
            const chipsContainer = document.getElementById('quick-ip-chips');
            chipsContainer.innerHTML = '<span class="chip-label">Quick Set:</span>';

            // 1. Current Browser URL Chip
            const currBtn = document.createElement('button');
            currBtn.className = 'ip-chip active';
            currBtn.innerHTML = '<i class="fa-solid fa-laptop"></i> Current Browser URL';
            currBtn.addEventListener('click', () => {
                setTargetUrl(`${window.location.origin}/api/upload`, currBtn);
            });
            chipsContainer.appendChild(currBtn);

            // 2. Localhost Chip
            if (!window.location.origin.includes('localhost') && !window.location.origin.includes('127.0.0.1')) {
                const localBtn = document.createElement('button');
                localBtn.className = 'ip-chip';
                localBtn.innerHTML = '<i class="fa-solid fa-house-laptop"></i> Localhost';
                localBtn.addEventListener('click', () => {
                    setTargetUrl(`http://localhost:${info.port || 3000}/api/upload`, localBtn);
                });
                chipsContainer.appendChild(localBtn);
            }

            // 3. Network LAN IP Chips (e.g. WiFi, Ethernet)
            if (info.networkIps && info.networkIps.length > 0) {
                info.networkIps.forEach(net => {
                    const chip = document.createElement('button');
                    chip.className = 'ip-chip';
                    chip.innerHTML = `<i class="fa-solid fa-network-wired"></i> LAN: ${net.ip}`;
                    chip.title = `Adapter: ${net.name} (${net.uploadUrl})`;
                    chip.addEventListener('click', () => {
                        setTargetUrl(net.uploadUrl, chip);
                    });
                    chipsContainer.appendChild(chip);
                });
            }
        })
        .catch(err => console.log('Could not load server-info:', err));
}

// Update Target URL across preview, indicators, and download link
function setTargetUrl(url, activeChipEl = null) {
    currentTargetUrl = url.trim();
    document.getElementById('target-server-input').value = currentTargetUrl;
    document.getElementById('server-url').textContent = currentTargetUrl;

    // Update Download Button URL
    const dlBtn = document.getElementById('btn-download-bat');
    dlBtn.href = `/api/download-bat?server_url=${encodeURIComponent(currentTargetUrl)}`;

    // Update active state on chips
    if (activeChipEl) {
        document.querySelectorAll('.ip-chip').forEach(c => c.classList.remove('active'));
        activeChipEl.classList.add('active');
    }

    // Refresh code preview with new target URL
    renderScriptPreview();
}

function renderScriptPreview() {
    if (!rawBatScriptTemplate) return;
    const modifiedCode = rawBatScriptTemplate.replace(
        /set\s+"SERVER_URL=[^"]*"/g,
        `set "SERVER_URL=${currentTargetUrl}"`
    );
    document.getElementById('bat-code').textContent = modifiedCode;
}

// Fetch the client batch script
function fetchBatchScript() {
    fetch(`/api/download-bat?server_url=${encodeURIComponent(currentTargetUrl)}`)
        .then(response => {
            if (!response.ok) throw new Error("Could not load script");
            return response.text();
        })
        .then(text => {
            rawBatScriptTemplate = text;
            renderScriptPreview();
        })
        .catch(err => {
            document.getElementById('bat-code').textContent = 
                `@echo off\nrem Error loading script from server.\nrem Please download using the button below.`;
        });
}

// Fetch all asset items
function fetchAssets() {
    const tableBody = document.querySelector('#assets-table tbody');
    tableBody.innerHTML = `<tr><td colspan="100%" class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Fetching assets inventory...</td></tr>`;

    fetch('/api/assets')
        .then(response => response.json())
        .then(data => {
            assets = data;
            applySearchAndSort();
            updateStatsAndCharts();
        })
        .catch(err => {
            console.error("Error loading assets:", err);
            tableBody.innerHTML = `<tr><td colspan="100%" class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i> Failed to retrieve inventory database.</td></tr>`;
        });
}

// Event Listeners Setup
function setupEventListeners() {
    // Export Button
    document.getElementById('btn-export').addEventListener('click', () => {
        if (assets.length === 0) {
            alert("No data available to export.");
            return;
        }
        window.location.href = '/api/export';
    });

    // Clear Button
    document.getElementById('btn-clear').addEventListener('click', () => {
        if (confirm("Are you sure you want to clear the entire system assets database? This cannot be undone.")) {
            fetch('/api/assets/clear', { method: 'POST' })
                .then(r => r.json())
                .then(() => fetchAssets())
                .catch(err => alert("Failed to clear assets."));
        }
    });

    // Search Box Input
    document.getElementById('table-search').addEventListener('input', () => {
        currentPage = 1;
        applySearchAndSort();
    });

    // Column Menu Toggle
    const colBtn = document.getElementById('btn-toggle-columns');
    const colMenu = document.getElementById('column-selector-menu');
    colBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        colMenu.classList.toggle('show');
    });

    document.addEventListener('click', () => {
        colMenu.classList.remove('show');
    });

    colMenu.addEventListener('click', (e) => {
        e.stopPropagation(); // prevent menu from closing when selecting column checkboxes
    });

    // Tab buttons for Collector Center
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            const paneId = btn.getAttribute('data-tab');
            document.getElementById(paneId).classList.add('active');
        });
    });

    // Target Server Input change listener
    const targetInput = document.getElementById('target-server-input');
    targetInput.addEventListener('input', (e) => {
        document.querySelectorAll('.ip-chip').forEach(c => c.classList.remove('active'));
        setTargetUrl(e.target.value);
    });

    // Reset to Current Browser URL Button
    document.getElementById('btn-reset-url').addEventListener('click', () => {
        const autoChip = document.querySelector('.ip-chip');
        setTargetUrl(`${window.location.origin}/api/upload`, autoChip);
    });

    // Copy batch code script
    document.getElementById('btn-copy-bat').addEventListener('click', () => {
        const codeText = document.getElementById('bat-code').textContent;
        navigator.clipboard.writeText(codeText)
            .then(() => {
                const icon = document.querySelector('#btn-copy-bat i');
                icon.className = "fa-solid fa-check";
                icon.style.color = "var(--emerald)";
                setTimeout(() => {
                    icon.className = "fa-regular fa-copy";
                    icon.style.color = "";
                }, 2000);
            })
            .catch(() => alert("Failed to copy script contents."));
    });

    // Manual Log submission
    document.getElementById('btn-submit-manual').addEventListener('click', () => {
        const text = document.getElementById('manual-log-input').value;
        const statusSpan = document.getElementById('manual-status-message');
        
        if (!text.trim()) {
            statusSpan.textContent = "Please paste log data.";
            statusSpan.className = "error";
            return;
        }

        statusSpan.textContent = "Processing...";
        statusSpan.className = "";

        fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: text
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                statusSpan.textContent = `Success: Profile for '${data.hostname}' ${data.status}!`;
                statusSpan.className = "success";
                document.getElementById('manual-log-input').value = "";
                fetchAssets();
                setTimeout(() => { statusSpan.textContent = ""; }, 5000);
            } else {
                statusSpan.textContent = `Error: ${data.error}`;
                statusSpan.className = "error";
            }
        })
        .catch(err => {
            statusSpan.textContent = "Error: Network failure.";
            statusSpan.className = "error";
        });
    });

    // Pagination Click Listeners
    document.getElementById('btn-prev').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderTable();
        }
    });

    document.getElementById('btn-next').addEventListener('click', () => {
        const totalPages = Math.ceil(filteredAssets.length / pageSize);
        if (currentPage < totalPages) {
            currentPage++;
            renderTable();
        }
    });

    // Close Modal Events
    document.getElementById('btn-close-modal').addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === document.getElementById('modal-details')) {
            closeModal();
        }
    });

    // Detail Modal Tab switching
    const detTabBtns = document.querySelectorAll('.detail-tab-btn');
    detTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            detTabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.detail-pane').forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            const paneId = btn.getAttribute('data-det-tab');
            document.getElementById(paneId).classList.add('active');
        });
    });
}

// Build Checkboxes for Column Selection
function buildColumnSelector() {
    const menu = document.getElementById('column-selector-menu');
    menu.innerHTML = '';
    
    columnsDef.forEach(col => {
        const label = document.createElement('label');
        label.className = 'column-option';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = col.visible;
        checkbox.addEventListener('change', () => {
            col.visible = checkbox.checked;
            renderTableHeader();
            renderTable();
        });

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(col.label));
        menu.appendChild(label);
    });
}

// Search and Sort Controller
function applySearchAndSort() {
    const searchVal = document.getElementById('table-search').value.toLowerCase().trim();

    // 1. Search filter
    if (!searchVal) {
        filteredAssets = [...assets];
    } else {
        filteredAssets = assets.filter(asset => {
            const department = (asset.department || "").toLowerCase();
            const hostname = (asset.hostname || "").toLowerCase();
            const serial = (asset.serial_number || "").toLowerCase();
            const tmAgent = (asset.trend_micro_agent_version || "").toLowerCase();
            const ip = (asset.ip_address || "").toLowerCase();
            const selfScanStatus = (asset.self_scan_status_text || "").toLowerCase();
            
            // Search in sub items like User Profiles local_path
            const profiles = (asset.configured_user_profiles || []).some(p => 
                (p.local_path || "").toLowerCase().includes(searchVal) || 
                (p.sid || "").toLowerCase().includes(searchVal)
            );

            // Search in adapters
            const adapters = (asset.network_adapters || []).some(a => 
                (a.name || "").toLowerCase().includes(searchVal) || 
                (a.mac_address || "").toLowerCase().includes(searchVal)
            );

            return department.includes(searchVal) ||
                   hostname.includes(searchVal) || 
                   serial.includes(searchVal) || 
                   tmAgent.includes(searchVal) || 
                   ip.includes(searchVal) ||
                   selfScanStatus.includes(searchVal) ||
                   profiles || 
                   adapters;
        });
    }

    // 2. Sorting
    if (sortColumn) {
        filteredAssets.sort((a, b) => {
            let valA = a[sortColumn];
            let valB = b[sortColumn];

            // Handle sub counts
            if (sortColumn === 'configured_user_profiles') {
                valA = (a.configured_user_profiles || []).length;
                valB = (b.configured_user_profiles || []).length;
            } else if (sortColumn === 'network_adapters') {
                valA = (a.network_adapters || []).length;
                valB = (b.network_adapters || []).length;
            } else if (typeof valA === 'string') {
                valA = valA.toLowerCase();
                valB = (valB || '').toLowerCase();
            }

            if (valA < valB) return sortAsc ? -1 : 1;
            if (valA > valB) return sortAsc ? 1 : -1;
            return 0;
        });
    }

    renderTableHeader();
    renderTable();
}

// Render Table Header
function renderTableHeader() {
    const tr = document.querySelector('#assets-table thead tr');
    tr.innerHTML = '';

    columnsDef.forEach(col => {
        if (!col.visible) return;

        const th = document.createElement('th');
        th.innerHTML = `${col.label} ` + (sortColumn === col.key ? 
            (sortAsc ? '<i class="fa-solid fa-sort-up"></i>' : '<i class="fa-solid fa-sort-down"></i>') : 
            '<i class="fa-solid fa-sort"></i>');
        
        th.addEventListener('click', () => {
            if (sortColumn === col.key) {
                sortAsc = !sortAsc;
            } else {
                sortColumn = col.key;
                sortAsc = true;
            }
            applySearchAndSort();
        });

        tr.appendChild(th);
    });

    // Action header
    const actionTh = document.createElement('th');
    actionTh.textContent = 'Actions';
    actionTh.style.textAlign = 'center';
    tr.appendChild(actionTh);
}

// Render Table Body & Pagination controls
function renderTable() {
    const tableBody = document.querySelector('#assets-table tbody');
    document.getElementById('assets-count').textContent = `${assets.length} systems`;

    if (filteredAssets.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="100%" class="empty-state"><i class="fa-solid fa-inbox"></i> No matching system assets found.</td></tr>`;
        updatePagination(0);
        return;
    }

    tableBody.innerHTML = '';
    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, filteredAssets.length);
    const paginatedItems = filteredAssets.slice(startIdx, endIdx);

    paginatedItems.forEach(asset => {
        const tr = document.createElement('tr');
        tr.addEventListener('click', () => showDetails(asset));

        columnsDef.forEach(col => {
            if (!col.visible) return;

            const td = document.createElement('td');
            const val = asset[col.key];

            if (col.key === 'department') {
                const dept = val || 'Unassigned';
                td.innerHTML = `<span class="badge-dept"><i class="fa-solid fa-building"></i> ${dept}</span>`;
            } else if (col.key === 'self_scan_status_text') {
                const isInstalled = asset.self_scan_installed;
                td.innerHTML = `<span class="badge ${isInstalled ? 'badge-success' : 'badge-danger'}">
                    <i class="fa-solid ${isInstalled ? 'fa-circle-check' : 'fa-circle-xmark'}"></i> ${val || 'Not Installed'}
                </span>`;
            } else if (col.key === 'netskope_status_text') {
                const isInstalled = asset.netskope_installed;
                td.innerHTML = `<span class="badge ${isInstalled ? 'badge-success' : 'badge-danger'}">
                    <i class="fa-solid ${isInstalled ? 'fa-circle-check' : 'fa-circle-xmark'}"></i> ${val || 'Not Installed'}
                </span>`;
            } else if (col.key === 'configured_user_profiles') {
                td.textContent = (val || []).length;
                td.style.textAlign = 'center';
            } else if (col.key === 'network_adapters') {
                td.textContent = (val || []).length;
                td.style.textAlign = 'center';
            } else if (col.key === 'hostname') {
                td.innerHTML = `<strong>${val}</strong>`;
            } else {
                td.textContent = val !== undefined ? val : 'N/A';
            }

            tr.appendChild(td);
        });

        // Actions column
        const actionTd = document.createElement('td');
        actionTd.style.textAlign = 'center';
        // stop propagation so deleting does not open details modal
        actionTd.addEventListener('click', (e) => e.stopPropagation());

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-icon delete-btn';
        deleteBtn.title = 'Delete System Asset';
        deleteBtn.innerHTML = '<i class="fa-regular fa-trash-can"></i>';
        deleteBtn.addEventListener('click', () => {
            if (confirm(`Are you sure you want to delete ${asset.hostname}?`)) {
                fetch(`/api/assets/${asset.id}`, { method: 'DELETE' })
                    .then(r => r.json())
                    .then(() => fetchAssets())
                    .catch(err => alert("Error deleting asset."));
            }
        });

        actionTd.appendChild(deleteBtn);
        tr.appendChild(actionTd);

        tableBody.appendChild(tr);
    });

    updatePagination(filteredAssets.length);
}

// Update Pagination DOM
function updatePagination(totalItems) {
    const totalPages = Math.ceil(totalItems / pageSize);
    const prevBtn = document.getElementById('btn-prev');
    const nextBtn = document.getElementById('btn-next');
    
    prevBtn.disabled = currentPage === 1 || totalPages === 0;
    nextBtn.disabled = currentPage === totalPages || totalPages === 0;

    const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, totalItems);
    document.getElementById('pagination-text').textContent = `Showing ${start} - ${end} of ${totalItems} systems`;

    const pagesContainer = document.getElementById('pagination-pages-container');
    pagesContainer.innerHTML = '';

    if (totalPages <= 1) return;

    for (let i = 1; i <= totalPages; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `page-num ${currentPage === i ? 'active' : ''}`;
        pageBtn.textContent = i;
        pageBtn.addEventListener('click', () => {
            currentPage = i;
            renderTable();
        });
        pagesContainer.appendChild(pageBtn);
    }
}

// Update Dashboard Statistics & Charts
function updateStatsAndCharts() {
    // 1. Compute Stats
    const totalCount = assets.length;
    let trendMicroCompliantCount = 0;
    let selfScanCount = 0;
    let netskopeCount = 0;

    assets.forEach(asset => {
        const tmAgent = asset.trend_micro_agent_version || '';
        const tmEngine = asset.trend_micro_scan_engine || '';
        if (tmAgent && tmAgent !== 'Unknown' && tmAgent !== 'Not Found' &&
            tmEngine && tmEngine !== 'Unknown' && tmEngine !== 'Not Found') {
            trendMicroCompliantCount++;
        }
        if (asset.self_scan_installed) {
            selfScanCount++;
        }
        if (asset.netskope_installed) {
            netskopeCount++;
        }
    });

    document.getElementById('stat-total').textContent = totalCount;
    document.getElementById('stat-trend').textContent = trendMicroCompliantCount;
    document.getElementById('stat-selfscan').textContent = selfScanCount;
    document.getElementById('stat-netskope').textContent = netskopeCount;

    // 2. Render Charts
    renderCharts(totalCount, selfScanCount, trendMicroCompliantCount, netskopeCount);
}

// Render Chart JS Dashboards
function renderCharts(total, selfScan, tmCompliant, netskope) {
    const notSelfScan = total - selfScan;
    const notTmCompliant = total - tmCompliant;
    const notNetskope = total - netskope;

    // Destroy existing charts if they exist
    if (selfScanChart) selfScanChart.destroy();
    if (trendMicroChart) trendMicroChart.destroy();
    if (netskopeChart) netskopeChart.destroy();

    // Chart Options
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    color: '#94a3b8',
                    font: { size: 10, family: 'Inter' },
                    padding: 4
                }
            }
        },
        cutout: '70%'
    };

    // SelfScan Chart
    const ctx1 = document.getElementById('chart-selfscan').getContext('2d');
    selfScanChart = new Chart(ctx1, {
        type: 'doughnut',
        data: {
            labels: ['Installed', 'Not Installed'],
            datasets: [{
                data: total > 0 ? [selfScan, notSelfScan] : [0, 1],
                backgroundColor: total > 0 ? ['#f59e0b', '#1e293b'] : ['#1e293b', '#1e293b'],
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.05)'
            }]
        },
        options: {
            ...chartOptions,
            plugins: {
                ...chartOptions.plugins,
                title: {
                    display: true,
                    text: 'SelfScan Status',
                    color: '#f1f5f9',
                    font: { family: 'Outfit', size: 12, weight: 600 }
                }
            }
        }
    });

    // Trend Micro Compliance Chart
    const ctx2 = document.getElementById('chart-trendmicro').getContext('2d');
    trendMicroChart = new Chart(ctx2, {
        type: 'doughnut',
        data: {
            labels: ['Compliant', 'Non-Compliant'],
            datasets: [{
                data: total > 0 ? [tmCompliant, notTmCompliant] : [0, 1],
                backgroundColor: total > 0 ? ['#10b981', '#1e293b'] : ['#1e293b', '#1e293b'],
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.05)'
            }]
        },
        options: {
            ...chartOptions,
            plugins: {
                ...chartOptions.plugins,
                title: {
                    display: true,
                    text: 'Trend Micro Security',
                    color: '#f1f5f9',
                    font: { family: 'Outfit', size: 12, weight: 600 }
                }
            }
        }
    });

    // Netskope Chart
    const ctx3 = document.getElementById('chart-netskope').getContext('2d');
    netskopeChart = new Chart(ctx3, {
        type: 'doughnut',
        data: {
            labels: ['Installed', 'Not Installed'],
            datasets: [{
                data: total > 0 ? [netskope, notNetskope] : [0, 1],
                backgroundColor: total > 0 ? ['#6366f1', '#1e293b'] : ['#1e293b', '#1e293b'],
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.05)'
            }]
        },
        options: {
            ...chartOptions,
            plugins: {
                ...chartOptions.plugins,
                title: {
                    display: true,
                    text: 'Netskope Status',
                    color: '#f1f5f9',
                    font: { family: 'Outfit', size: 12, weight: 600 }
                }
            }
        }
    });
}

// Show System Details Modal
function showDetails(asset) {
    // Fill text views
    document.getElementById('modal-host-title').textContent = asset.hostname || 'Unknown Machine';
    document.getElementById('modal-serial-subtitle').textContent = `Serial: ${asset.serial_number || 'N/A'}`;

    // Fill Summary info
    document.getElementById('det-department').textContent = asset.department || 'Unassigned';
    document.getElementById('det-hostname').textContent = asset.hostname || 'N/A';
    document.getElementById('det-serial').textContent = asset.serial_number || 'N/A';
    document.getElementById('det-tm-agent').textContent = asset.trend_micro_agent_version || 'N/A';
    document.getElementById('det-tm-engine').textContent = asset.trend_micro_scan_engine || 'N/A';
    document.getElementById('det-vse-alt').textContent = asset.virus_scan_engine_alt || 'N/A';
    
    // SelfScan Status Badge
    const ssStatus = document.getElementById('det-selfscan-status');
    ssStatus.textContent = asset.self_scan_status_text || 'Not Installed';
    ssStatus.className = `badge ${asset.self_scan_installed ? 'badge-success' : 'badge-danger'}`;

    document.getElementById('det-selfscan-path').textContent = asset.self_scan_path || 'N/A';
    document.getElementById('det-selfscan-cmd').textContent = asset.self_scan_command || 'N/A';
    
    // New fields detail binding
    document.getElementById('det-model').textContent = asset.model_name || 'N/A';
    document.getElementById('det-ip-addr').textContent = asset.ip_address || 'N/A';
    
    const nsStatus = document.getElementById('det-netskope-status');
    nsStatus.textContent = asset.netskope_status_text || 'Not Installed';
    nsStatus.className = `badge ${asset.netskope_installed ? 'badge-success' : 'badge-danger'}`;

    document.getElementById('det-last-updated').textContent = asset.last_updated || 'N/A';
    document.getElementById('det-ip').textContent = asset.sender_ip || asset.ip_address || '127.0.0.1';

    // User Directories Found
    const userDirsList = document.getElementById('det-user-dirs');
    userDirsList.innerHTML = '';
    if (asset.user_directories && asset.user_directories.length > 0) {
        asset.user_directories.forEach(dir => {
            const li = document.createElement('li');
            li.textContent = dir;
            userDirsList.appendChild(li);
        });
    } else {
        userDirsList.innerHTML = '<li>No user directories found.</li>';
    }

    // Configured profiles table
    const profilesTable = document.getElementById('det-user-profiles-table');
    profilesTable.innerHTML = '';
    if (asset.configured_user_profiles && asset.configured_user_profiles.length > 0) {
        asset.configured_user_profiles.forEach(prof => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${prof.local_path}</td><td>${prof.sid}</td>`;
            profilesTable.appendChild(tr);
        });
    } else {
        profilesTable.innerHTML = `<tr><td colspan="2" style="text-align:center; color: var(--text-muted);">No profiles registered.</td></tr>`;
    }

    // Network adapters table
    const adaptersTable = document.getElementById('det-adapters-table');
    adaptersTable.innerHTML = '';
    if (asset.network_adapters && asset.network_adapters.length > 0) {
        asset.network_adapters.forEach(adap => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${adap.name}</td><td>${adap.status}</td><td>${adap.mac_address || 'N/A'}</td>`;
            adaptersTable.appendChild(tr);
        });
    } else {
        adaptersTable.innerHTML = `<tr><td colspan="3" style="text-align:center; color: var(--text-muted);">No adapters found.</td></tr>`;
    }

    // Raw log code
    document.getElementById('det-raw-log-code').textContent = asset.raw_log || 'No raw log logged.';

    // Default to first tab (Summary) inside modal
    document.querySelectorAll('.detail-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.detail-pane').forEach(p => p.classList.remove('active'));
    document.querySelector('[data-det-tab="det-summary"]').classList.add('active');
    document.getElementById('det-summary').classList.add('active');

    // Open Modal DOM
    const modal = document.getElementById('modal-details');
    modal.classList.add('show');
}

// Close Modal
function closeModal() {
    const modal = document.getElementById('modal-details');
    modal.classList.remove('show');
}
