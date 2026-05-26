// GPS Tracker Application
let map;
let currentMarkers = [];
let allRecords = [];
let employeeChart = null;

// Auto-detect server URL
const API_BASE = `${window.location.origin}/api`;

// ========================
// Initialize
// ========================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing GPS Tracker...');
    console.log(`📡 API Base: ${API_BASE}`);
    
    // Set today's date as default
    document.getElementById('date').valueAsDate = new Date();
    const now = new Date();
    document.getElementById('time').value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    // Initialize map
    initMap();
    
    // Load data
    loadGPSData();
    
    // Event listeners - Form
    document.getElementById('gpsForm').addEventListener('submit', handleFormSubmit);
    document.getElementById('getCurrentLocation').addEventListener('click', getCurrentLocation);
    document.getElementById('clearLocation').addEventListener('click', clearLocationFields);
    
    // Event listeners - Data Table
    document.getElementById('refreshBtn').addEventListener('click', loadGPSData);
    document.getElementById('exportBtn').addEventListener('click', exportToCSV);
    document.getElementById('searchInput').addEventListener('input', filterTable);
    document.getElementById('positionFilter').addEventListener('change', filterTable);
    document.getElementById('filterDate').addEventListener('change', filterTable);
    
    // Event listeners - Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', switchTab);
    });
    
    // Auto-refresh every 10 seconds
    setInterval(loadGPSData, 10000);
});

// ========================
// Tab Navigation
// ========================
function switchTab(e) {
    const tabName = e.target.dataset.tab;
    
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active from all buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(`${tabName}-tab`).classList.add('active');
    e.target.classList.add('active');
    
    // Load analytics if analytics tab
    if (tabName === 'analytics') {
        updateAnalytics();
    }
}

// ========================
// Initialize Map
// ========================
function initMap() {
    map = L.map('map').setView([13.7563, 100.5018], 13); // Bangkok
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
        minZoom: 2
    }).addTo(map);
    
    console.log('✅ Map initialized');
}

// ========================
// Get Current GPS Location
// ========================
function getCurrentLocation() {
    const btn = document.getElementById('getCurrentLocation');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading">⏳</span> กำลังดึงตำแหน่ง...';

    if (!navigator.geolocation) {
        showMessage('เบราว์เซอร์ของคุณไม่รองรับ GPS', 'error');
        resetButton(btn, '📍 ดึงตำแหน่ง GPS ปัจจุบัน');
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude, accuracy, altitude } = position.coords;
            
            // Fill form
            document.getElementById('latitude').value = latitude.toFixed(6);
            document.getElementById('longitude').value = longitude.toFixed(6);
            document.getElementById('accuracy').value = accuracy.toFixed(2);
            if (altitude) {
                document.getElementById('altitude').value = altitude.toFixed(2);
            }
            
            // Update map
            map.setView([latitude, longitude], 15);
            clearMapMarkers();
            
            const marker = L.marker([latitude, longitude], {
                icon: L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                })
            });
            
            marker.bindPopup(`
                <strong>ตำแหน่งปัจจุบัน</strong><br>
                Latitude: ${latitude.toFixed(6)}<br>
                Longitude: ${longitude.toFixed(6)}<br>
                Accuracy: ±${accuracy.toFixed(2)}m<br>
                ${altitude ? `Altitude: ${altitude.toFixed(2)}m<br>` : ''}
                Time: ${new Date().toLocaleTimeString('th-TH')}
            `);
            
            marker.addTo(map);
            
            showMessage('✅ ดึงตำแหน่ง GPS สำเร็จ', 'success');
            resetButton(btn, '📍 ดึงตำแหน่ง GPS ปัจจุบัน');
        },
        (error) => {
            let errorMsg = 'เกิดข้อผิดพลาดในการดึงตำแหน่ง';
            if (error.code === error.PERMISSION_DENIED) {
                errorMsg = '❌ กรุณาอนุญาต GPS access ในการตั้งค่าเบราว์เซอร์';
            } else if (error.code === error.TIMEOUT) {
                errorMsg = '⏱️ หมดเวลารอ GPS (ลองอีกครั้ง)';
            } else if (error.code === error.POSITION_UNAVAILABLE) {
                errorMsg = '📍 GPS ไม่พร้อมใช้งาน';
            }
            showMessage(errorMsg, 'error');
            resetButton(btn, '📍 ดึงตำแหน่ง GPS ปัจจุบัน');
        },
        {
            timeout: 10000,
            enableHighAccuracy: true
        }
    );
}

// ========================
// Clear Location Fields
// ========================
function clearLocationFields() {
    document.getElementById('latitude').value = '';
    document.getElementById('longitude').value = '';
    document.getElementById('accuracy').value = '';
    document.getElementById('altitude').value = '';
    clearMapMarkers();
    showMessage('✅ ล้างข้อมูลสำเร็จ', 'success');
}

// ========================
// Handle Form Submit
// ========================
async function handleFormSubmit(e) {
    e.preventDefault();

    const employeeId = document.getElementById('employeeId').value.trim();
    const position = document.getElementById('position').value.trim();
    const latitude = document.getElementById('latitude').value.trim();
    const longitude = document.getElementById('longitude').value.trim();
    const date = document.getElementById('date').value;
    const accuracy = document.getElementById('accuracy').value;
    const altitude = document.getElementById('altitude').value;
    const submitBtn = document.getElementById('submitBtn');

    // Validation
    if (!employeeId || !position || !latitude || !longitude || !date) {
        showMessage('⚠️ กรุณากรอกข้อมูลให้ครบ (รหัสพนักงาน, ตำแหน่ง, Lat, Lon, วันที่)', 'error');
        return;
    }

    // Determine source
    const source = accuracy ? 'gps' : 'manual';

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading">⏳</span> กำลังบันทึก...';

    try {
        const response = await fetch(`${API_BASE}/gps`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeId,
                position,
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude),
                date,
                source,
                accuracy: accuracy ? parseFloat(accuracy) : null,
                altitude: altitude ? parseFloat(altitude) : null
            })
        });

        const data = await response.json();

        if (data.success) {
            showMessage('✅ ' + data.message, 'success');
            document.getElementById('gpsForm').reset();
            document.getElementById('date').valueAsDate = new Date();
            const now = new Date();
            document.getElementById('time').value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            
            // Add marker to map
            map.setView([parseFloat(latitude), parseFloat(longitude)], 15);
            L.marker([parseFloat(latitude), parseFloat(longitude)], {
                icon: L.icon({
                    iconUrl: source === 'gps' 
                        ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png'
                        : 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                })
            }).bindPopup(`${employeeId} (${position})`).addTo(map);
            
            loadGPSData();
        } else {
            showMessage('❌ ' + data.message, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showMessage('❌ เกิดข้อผิดพลาด: ' + error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '💾 บันทึกข้อมูล';
    }
}

// ========================
// Load GPS Data
// ========================
async function loadGPSData() {
    try {
        const response = await fetch(`${API_BASE}/gps`);
        const result = await response.json();

        if (result.success) {
            allRecords = result.data;
            displayTable(allRecords);
            updateMap(allRecords);
        }
    } catch (error) {
        console.error('Error loading data:', error);
        showMessage('❌ ไม่สามารถโหลดข้อมูล', 'error');
    }
}

// ========================
// Display Table
// ========================
function displayTable(records) {
    const tbody = document.getElementById('tableBody');
    
    if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-row">ยังไม่มีข้อมูล บันทึก GPS ครั้งแรก</td></tr>';
        document.getElementById('totalRecords').textContent = '0';
        return;
    }

    tbody.innerHTML = records.map(record => `
        <tr>
            <td>
                <button class="btn btn-danger" onclick="deleteRecord('${record._id}')">🗑️</button>
            </td>
            <td><strong>${record.employeeId}</strong></td>
            <td>${record.position}</td>
            <td><code>${record.latitude.toFixed(6)}</code></td>
            <td><code>${record.longitude.toFixed(6)}</code></td>
            <td>${record.date}</td>
            <td>${record.source === 'gps' ? '<span style="color: #ef4444;">📍 GPS</span>' : '<span style="color: #f59e0b;">✏️ Manual</span>'}</td>
            <td>${record.accuracy ? record.accuracy.toFixed(2) + 'm' : '-'}</td>
            <td><small>${new Date(record.timestamp).toLocaleString('th-TH')}</small></td>
        </tr>
    `).join('');
    
    document.getElementById('totalRecords').textContent = records.length;
}

// ========================
// Filter Table
// ========================
function filterTable() {
    const searchValue = document.getElementById('searchInput').value.toLowerCase();
    const positionFilter = document.getElementById('positionFilter').value;
    const dateFilter = document.getElementById('filterDate').value;

    const filtered = allRecords.filter(record => {
        const matchSearch = record.employeeId.toLowerCase().includes(searchValue) || 
                          record.position.toLowerCase().includes(searchValue);
        const matchPosition = !positionFilter || record.position === positionFilter;
        const matchDate = !dateFilter || record.date === dateFilter;
        
        return matchSearch && matchPosition && matchDate;
    });

    displayTable(filtered);
}

// ========================
// Update Map
// ========================
function updateMap(records) {
    clearMapMarkers();
    
    records.forEach(record => {
        const iconUrl = record.source === 'gps' 
            ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png'
            : 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png';

        const marker = L.marker([record.latitude, record.longitude], {
            icon: L.icon({
                iconUrl,
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            })
        });

        marker.bindPopup(`
            <strong>${record.employeeId}</strong><br>
            ตำแหน่ง: ${record.position}<br>
            วันที่: ${record.date}<br>
            แหล่งที่มา: ${record.source === 'gps' ? '📍 GPS' : '✏️ Manual'}<br>
            ${record.accuracy ? `Accuracy: ±${record.accuracy.toFixed(2)}m<br>` : ''}
            เวลา: ${new Date(record.timestamp).toLocaleTimeString('th-TH')}
        `);

        marker.addTo(map);
        currentMarkers.push(marker);
    });

    // Fit map to markers
    if (records.length > 0) {
        const group = new L.featureGroup(currentMarkers);
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

// ========================
// Clear Map Markers
// ========================
function clearMapMarkers() {
    currentMarkers.forEach(marker => map.removeLayer(marker));
    currentMarkers = [];
}

// ========================
// Delete Record
// ========================
async function deleteRecord(id) {
    if (!confirm('คุณต้องการลบข้อมูลนี้ใช่หรือไม่?')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/gps/${id}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            showMessage('✅ ' + data.message, 'success');
            loadGPSData();
        } else {
            showMessage('❌ ' + data.message, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showMessage('❌ เกิดข้อผิดพลาด', 'error');
    }
}

// ========================
// Export to CSV
// ========================
async function exportToCSV() {
    try {
        const response = await fetch(`${API_BASE}/export-csv`);
        
        if (!response.ok) {
            const data = await response.json();
            showMessage('❌ ' + data.message, 'error');
            return;
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gps_records_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        showMessage('✅ Export CSV สำเร็จ', 'success');
    } catch (error) {
        console.error('Error:', error);
        showMessage('❌ เกิดข้อผิดพลาดในการ Export', 'error');
    }
}

// ========================
// Analytics
// ========================
async function updateAnalytics() {
    if (allRecords.length === 0) {
        showMessage('ยังไม่มีข้อมูล', 'error');
        return;
    }

    // Calculate stats
    const uniqueEmployees = [...new Set(allRecords.map(r => r.employeeId))];
    const gpsCount = allRecords.filter(r => r.source === 'gps').length;
    const manualCount = allRecords.filter(r => r.source === 'manual').length;
    const latestDate = new Date(Math.max(...allRecords.map(r => new Date(r.timestamp)))).toLocaleDateString('th-TH');

    // Update stats
    document.getElementById('totalGPS').textContent = allRecords.length;
    document.getElementById('uniqueEmployees').textContent = uniqueEmployees.length;
    document.getElementById('gpsCount').textContent = gpsCount;
    document.getElementById('manualCount').textContent = manualCount;
    document.getElementById('latestDate').textContent = latestDate;

    // Employee chart
    updateEmployeeChart();

    // Employee list
    updateEmployeeList();
}

function updateEmployeeChart() {
    const employeeData = {};
    allRecords.forEach(record => {
        employeeData[record.employeeId] = (employeeData[record.employeeId] || 0) + 1;
    });

    const ctx = document.getElementById('myChart').getContext('2d');
    
    if (employeeChart) {
        employeeChart.destroy();
    }

    employeeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(employeeData),
            datasets: [{
                label: 'จำนวนบันทึก',
                data: Object.values(employeeData),
                backgroundColor: 'rgba(102, 126, 234, 0.7)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function updateEmployeeList() {
    const employeeStats = {};
    allRecords.forEach(record => {
        if (!employeeStats[record.employeeId]) {
            employeeStats[record.employeeId] = {
                position: record.position,
                count: 0
            };
        }
        employeeStats[record.employeeId].count++;
    });

    const tbody = document.getElementById('employeeBody');
    tbody.innerHTML = Object.entries(employeeStats).map(([empId, stats]) => `
        <tr>
            <td><strong>${empId}</strong></td>
            <td>${stats.position}</td>
            <td>${stats.count}</td>
            <td>
                <button class="btn btn-success" onclick="exportEmployeeCSV('${empId}')" style="padding: 6px 12px;">
                    📥
                </button>
            </td>
        </tr>
    `).join('');
}

async function exportEmployeeCSV(employeeId) {
    try {
        const response = await fetch(`${API_BASE}/export-csv/${employeeId}`);
        
        if (!response.ok) {
            const data = await response.json();
            showMessage('❌ ' + data.message, 'error');
            return;
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gps_${employeeId}_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        showMessage(`✅ Export CSV สำหรับ ${employeeId} สำเร็จ`, 'success');
    } catch (error) {
        console.error('Error:', error);
        showMessage('❌ เกิดข้อผิดพลาดในการ Export', 'error');
    }
}

// ========================
// Show Message
// ========================
function showMessage(msg, type) {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = msg;
    messageDiv.className = `message ${type}`;
    
    setTimeout(() => {
        messageDiv.className = 'message';
    }, 5000);
}

// ========================
// Helper Functions
// ========================
function resetButton(btn, text) {
    btn.disabled = false;
    btn.innerHTML = text;
}