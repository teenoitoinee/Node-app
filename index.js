const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const { stringify } = require('csv-stringify/sync');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB Connection String
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gps-tracker';

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static('public'));

// ========================
// MongoDB Connection
// ========================
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('✅ MongoDB Connected Successfully!');
}).catch(err => {
  console.error('❌ MongoDB Connection Error:', err);
  process.exit(1);
});

// ========================
// MongoDB Schema & Model
// ========================
const gpsSchema = new mongoose.Schema({
  employeeId: {
    type: String,
    required: true,
  },
  position: {
    type: String,
    required: true,
  },
  latitude: {
    type: Number,
    required: true,
  },
  longitude: {
    type: Number,
    required: true,
  },
  date: {
    type: String,
    required: true,
  },
  source: {
    type: String,
    enum: ['manual', 'gps'],
    default: 'manual',
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  accuracy: Number, // GPS accuracy in meters
  altitude: Number,  // GPS altitude
});

const GPSRecord = mongoose.model('GPSRecord', gpsSchema);

// ========================
// API: บันทึกตำแหน่ง GPS
// ========================
app.post('/api/gps', async (req, res) => {
  try {
    const { employeeId, position, latitude, longitude, date, source, accuracy, altitude } = req.body;

    // Validation
    if (!employeeId || !position || latitude === undefined || longitude === undefined || !date) {
      return res.status(400).json({ 
        success: false, 
        message: 'ขาดข้อมูล: รหัสพนักงาน, ตำแหน่ง, latitude, longitude, หรือวันที่' 
      });
    }

    // Validate GPS coordinates
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ 
        success: false, 
        message: 'ค่า GPS ไม่ถูกต้อง (Latitude: -90 to 90, Longitude: -180 to 180)' 
      });
    }

    // Create new record
    const newRecord = new GPSRecord({
      employeeId: employeeId.trim(),
      position: position.trim(),
      latitude: lat,
      longitude: lng,
      date,
      source: source || 'manual',
      accuracy: accuracy || null,
      altitude: altitude || null,
      timestamp: new Date()
    });

    // Save to MongoDB
    await newRecord.save();

    res.status(201).json({ 
      success: true, 
      message: 'บันทึกข้อมูล GPS สำเร็จ ✅',
      data: newRecord 
    });

  } catch (error) {
    console.error('Error saving GPS data:', error);
    res.status(500).json({ 
      success: false, 
      message: 'เกิดข้อผิดพลาดในการบันทึก',
      error: error.message
    });
  }
});

// ========================
// API: ดึงข้อมูล GPS ทั้งหมด
// ========================
app.get('/api/gps', async (req, res) => {
  try {
    const records = await GPSRecord.find().sort({ timestamp: -1 });
    res.json({ 
      success: true, 
      count: records.length,
      data: records 
    });
  } catch (error) {
    console.error('Error fetching GPS data:', error);
    res.status(500).json({ 
      success: false, 
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
      error: error.message 
    });
  }
});

// ========================
// API: ดึงข้อมูล GPS ตาม Employee ID
// ========================
app.get('/api/gps/employee/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const records = await GPSRecord.find({ employeeId }).sort({ timestamp: -1 });
    res.json({ 
      success: true, 
      count: records.length,
      data: records 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================
// API: ดึงข้อมูล GPS ตามช่วงวันที่
// ========================
app.get('/api/gps/date/:startDate/:endDate', async (req, res) => {
  try {
    const { startDate, endDate } = req.params;
    const records = await GPSRecord.find({
      date: { $gte: startDate, $lte: endDate }
    }).sort({ timestamp: -1 });
    res.json({ 
      success: true, 
      count: records.length,
      data: records 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================
// API: ลบข้อมูล
// ========================
app.delete('/api/gps/:id', async (req, res) => {
  try {
    const result = await GPSRecord.findByIdAndDelete(req.params.id);
    if (result) {
      res.json({ 
        success: true, 
        message: 'ลบข้อมูลสำเร็จ ✅' 
      });
    } else {
      res.status(404).json({ 
        success: false, 
        message: 'ไม่พบข้อมูล' 
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ========================
// API: Export เป็น CSV
// ========================
app.get('/api/export-csv', async (req, res) => {
  try {
    const records = await GPSRecord.find().sort({ timestamp: -1 });
    
    if (records.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'ไม่มีข้อมูลในการ Export' 
      });
    }

    const csvData = [
      ['ID', 'รหัสพนักงาน', 'ตำแหน่ง', 'Latitude', 'Longitude', 'วันที่', 'แหล่งที่มา', 'Accuracy (m)', 'Altitude (m)', 'เวลา'],
      ...records.map(r => [
        r._id.toString(),
        r.employeeId,
        r.position,
        r.latitude.toFixed(6),
        r.longitude.toFixed(6),
        r.date,
        r.source === 'gps' ? 'GPS' : 'Manual',
        r.accuracy ? r.accuracy.toFixed(2) : 'N/A',
        r.altitude ? r.altitude.toFixed(2) : 'N/A',
        new Date(r.timestamp).toLocaleString('th-TH')
      ])
    ];

    const csv = stringify(csvData);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=gps_records_${new Date().toISOString().split('T')[0]}.csv`);
    res.send('\uFEFF' + csv); // Add BOM for Excel UTF-8
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ========================
// API: Export ตาม Employee ID
// ========================
app.get('/api/export-csv/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const records = await GPSRecord.find({ employeeId }).sort({ timestamp: -1 });
    
    if (records.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'ไม่มีข้อมูลสำหรับพนักงาน: ' + employeeId
      });
    }

    const csvData = [
      ['ID', 'รหัสพนักงาน', 'ตำแหน่ง', 'Latitude', 'Longitude', 'วันที่', 'แหล่งที่มา', 'Accuracy (m)', 'Altitude (m)', 'เวลา'],
      ...records.map(r => [
        r._id.toString(),
        r.employeeId,
        r.position,
        r.latitude.toFixed(6),
        r.longitude.toFixed(6),
        r.date,
        r.source === 'gps' ? 'GPS' : 'Manual',
        r.accuracy ? r.accuracy.toFixed(2) : 'N/A',
        r.altitude ? r.altitude.toFixed(2) : 'N/A',
        new Date(r.timestamp).toLocaleString('th-TH')
      ])
    ];

    const csv = stringify(csvData);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=gps_${employeeId}_${new Date().toISOString().split('T')[0]}.csv`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ========================
// Health Check
// ========================
app.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'GPS Tracker Server is running! ✅',
    timestamp: new Date().toISOString()
  });
});

// ========================
// Server Start
// ========================
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n' + '='.repeat(50));
  console.log('🚀 GPS TRACKER SERVER');
  console.log('='.repeat(50));
  console.log(`✅ Server running on port: ${PORT}`);
  console.log(`🌐 Local: http://localhost:${PORT}`);
  console.log(`📡 Database: MongoDB`);
  console.log('='.repeat(50) + '\n');
});

module.exports = app;