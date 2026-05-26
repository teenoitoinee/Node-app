// GPS Tracker Application
let map;
let currentMarkers = [];
// Auto-detect server URL (works on both localhost and mobile)
const API_BASE = `${window.location.origin}/api`;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Set today's date as default
    document.getElementById('date').valueAsDate = new Date();
    
    // Initialize map
    initMap();
    
    // Load data
    loadGPSData();
    
    // Event listeners
    document.getElementById('gpsForm').addEventListener('submit', handleFormSubmit);
    document.getElementById('getCurrentLocation').addEventListener('click', getCurrentLocation);
    document.getElementById('refreshBtn').addEventListener('click', loadGPSData);
    document.getElementById('exportBtn').addEventListener('click', exportToCSV);
});

// Initialize Map
function initMap() {
    map = L.map('map').setView([13.7563, 100.5018], 13); // Bangkok coordinates
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
}

// Get current GPS location
function getCurrentLocation() {
    const btn = document.getElementById('getCurrentLocation');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading">⏳</span> กำลังดึงตำแหน่ง...';

    if (!navigator.geolocation) {
        showMessage('เบราว์เซอร์ของคุณไม่รองรับ GPS', 'error');
        btn.disabled = false;
        btn.innerHTML = '📍 ดึงตำแหน่ง GPS ปัจจุบัน';
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            document.getElementById('latitude').value = latitude.toFixed(6);
            document.getElementById('longitude').value = longitude.toFixed(6);
            
            // Update map
            map.setView([latitude, longitude], 15);
            clearMapMarkers();
            L.marker([latitude, longitude], {
                icon: L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                })
            }).bindPopup('ตำแหน่งปัจจุบัน').addTo(map);
            
            showMessage('ดึงตำแหน่ง GPS สำเร็จ', 'success');
            btn.disabled = false;
            btn.innerHTML = '📍 ดึงตำแหน่ง GPS ปัจจุบัน';
        },
        (error) => {
            let errorMsg = 'เกิดข้อผิดพลาดในการดึงตำแหน่ง';
            if (error.code === error.PERMISSION_DENIED) {
                errorMsg = 'กรุณาอนุญาต GPS access';
            } else if (error.code === error.TIMEOUT) {
                errorMsg = 'หมดเวลารอ GPS';
            }
            showMessage(errorMsg, 'error');
            btn.disabled = false;
            btn.innerHTML = '📍 ดึงตำแหน่ง GPS ปัจจุบัน';
        }
    );
}

// Handle form submit
async function handleFormSubmit(e) {
    e.preventDefault();

    const employeeId = document.getElementById('employeeId').value.trim();
    const position = document.getElementById('position').value.trim();
    const latitude = document.getElementById('latitude').value.trim();
    const longitude = document.getElementById('longitude').value.trim();
    const date = document.getElementById('date').value;

    // Validation
    if (!employeeId || !position || !latitude || !longitude || !date) {
        showMessage('⚠️ กรุณากรอกข้อมูลให้ครบ', 'error');
        return;
    }

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
                source: 'manual'
            })
        });

        const data = await response.json();

        if (data.success) {
            showMessage('✅ ' + data.message, 'success');
            document.getElementById('gpsForm').reset();
            document.getElementById('date').valueAsDate = new Date();
            loadGPSData();
            
            // Add marker to map
            map.setView([parseFloat(latitude), parseFloat(longitude)], 15);
            L.marker([parseFloat(latitude), parseFloat(longitude)], {
                icon: L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                })
            }).bindPopup(`${employeeId} - ${position}`).addTo(map);
        } else {
            showMessage('❌ ' + data.message, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showMessage('❌ เกิดข้อผิดพลาด: ' + error.message, 'error');
    }
}

// Load GPS data
async function loadGPSData() {
    try {
        const response = await fetch(`${API_BASE}/gps`);
        const result = await response.json();

        if (result.success) {
            const records = result.data;
            displayTable(records);
            updateMap(records);
        }
    } catch (error) {
        console.error('Error loading data:', error);
        showMessage('❌ ไม่สามารถโหลดข้อมูล', 'error');
    }
}

// Display data in table
function displayTable(records) {
    const tbody = document.getElementById('tableBody');
    
    if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-row">ยังไม่มีข้อมูล บันทึก GPS ครั้งแรก</td></tr>';
        return;
    }

    tbody.innerHTML = records.map(record => `
        <tr>
            <td>
                <button class="btn btn-danger" onclick="deleteRecord(${record.id})">🗑️</button>
            </td>
            <td>${record.employeeId}</td>
            <td>${record.position}</td>
            <td>${record.latitude.toFixed(6)}</td>
            <td>${record.longitude.toFixed(6)}</td>
            <td>${record.date}</td>
            <td>${record.source === 'gps' ? '📍 GPS' : '✏️ Manual'}</td>
            <td>${new Date(record.timestamp).toLocaleString('th-TH')}</td>
        </tr>
    `).join('');
}

// Update map with all records
function updateMap(records) {
    clearMapMarkers();
    
    records.forEach(record => {
        const marker = L.marker([record.latitude, record.longitude], {
            icon: L.icon({
                iconUrl: record.source === 'gps' 
                    ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png'
                    : 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png',
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
            แหล่งที่มา: ${record.source === 'gps' ? '📍 GPS' : '✏️ Manual'}
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

// Clear map markers
function clearMapMarkers() {
    currentMarkers.forEach(marker => map.removeLayer(marker));
    currentMarkers = [];
}

// Delete record
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

// Export to CSV
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

// Show message
function showMessage(msg, type) {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = msg;
    messageDiv.className = `message ${type}`;
    
    setTimeout(() => {
        messageDiv.className = 'message';
    }, 5000);
}

// Auto-load data every 5 seconds
setInterval(loadGPSData, 5000);