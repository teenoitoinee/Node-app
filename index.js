const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { stringify } = require('csv-stringify/sync');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'gps_records.json');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// สร้างไฟล์ JSON ถ้ายังไม่มี
function initializeDataFile() {
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
  }
}

// อ่านข้อมูล GPS
function readGPSData() {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading data:', error);
    return [];
  }
}

// บันทึกข้อมูล GPS
function saveGPSData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving data:', error);
    return false;
  }
}

// API: บันทึกตำแหน่ง GPS
app.post('/api/gps', (req, res) => {
  const { employeeId, position, latitude, longitude, date, source } = req.body;

  // ตรวจสอบข้อมูล
  if (!employeeId || !position || !latitude || !longitude || !date) {
    return res.status(400).json({ 
      success: false, 
      message: 'ขาดข้อมูล: รหัสพนักงาน, ตำแหน่ง, latitude, longitude, หรือวันที่' 
    });
  }

  // ตรวจสอบ latitude longitude
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);
  
  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ 
      success: false, 
      message: 'ค่า GPS ไม่ถูกต้อง' 
    });
  }

  const records = readGPSData();
  const newRecord = {
    id: Date.now(),
    employeeId,
    position,
    latitude: lat,
    longitude: lng,
    date,
    source: source || 'manual',
    timestamp: new Date().toISOString()
  };

  records.push(newRecord);
  
  if (saveGPSData(records)) {
    res.json({ 
      success: true, 
      message: 'บันทึกข้อมูล GPS สำเร็จ',
      data: newRecord 
    });
  } else {
    res.status(500).json({ 
      success: false, 
      message: 'เกิดข้อผิดพลาดในการบันทึก' 
    });
  }
});

// API: ดึงข้อมูล GPS ทั้งหมด
app.get('/api/gps', (req, res) => {
  const records = readGPSData();
  res.json({ success: true, data: records });
});

// API: ลบข้อมูล
app.delete('/api/gps/:id', (req, res) => {
  const { id } = req.params;
  const records = readGPSData();
  const filtered = records.filter(r => r.id != id);
  
  if (filtered.length < records.length) {
    if (saveGPSData(filtered)) {
      res.json({ success: true, message: 'ลบข้อมูลสำเร็จ' });
    } else {
      res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
    }
  } else {
    res.status(404).json({ success: false, message: 'ไม่พบข้อมูล' });
  }
});

// API: Export เป็น CSV
app.get('/api/export-csv', (req, res) => {
  const records = readGPSData();
  
  if (records.length === 0) {
    return res.status(400).json({ 
      success: false, 
      message: 'ไม่มีข้อมูลในการ Export' 
    });
  }

  const csvData = [
    ['ID', 'รหัสพนักงาน', 'ตำแหน่ง', 'Latitude', 'Longitude', 'วันที่', 'แหล่งที่มา', 'เวลา'],
    ...records.map(r => [
      r.id,
      r.employeeId,
      r.position,
      r.latitude,
      r.longitude,
      r.date,
      r.source,
      r.timestamp
    ])
  ];

  const csv = stringify(csvData);
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=gps_records.csv');
  res.send('\uFEFF' + csv); // Add BOM for Excel UTF-8 support
});

// Get local IP address
function getLocalIP() {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // IPv4 and not internal
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Server start
initializeDataFile();
const localIP = getLocalIP();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ GPS Tracker Server running!`);
  console.log(`\n🖥️  Desktop: http://localhost:${PORT}`);
  console.log(`📱 Mobile: http://${localIP}:${PORT}`);
  console.log(`\n⚠️  Make sure your phone is on the same Wi-Fi network\n`);
});