require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const BACKUP_KEY = process.env.BACKUP_KEY || 'joker_secret_key_123';

app.use(express.json());

const backupsDir = path.join(__dirname, 'backups');
if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
}
app.use('/backups', express.static(backupsDir));

const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 }
});

// 🌐 Dashboard displaying saved media links
app.get('/', (req, res) => {
    let fileListHtml = '';
    try {
        const files = fs.readdirSync(backupsDir);
        if (files.length === 0) {
            fileListHtml = '<p style="color: #94a3b8;">No backups uploaded yet.</p>';
        } else {
            fileListHtml = files.map(file => {
                return `<p><a style="color: #38bdf8;" href="/backups/${file}" target="_blank">📄 ${file}</a></p>`;
            }).join('');
        }
    } catch (e) {
        fileListHtml = '<p style="color: #ef4444;">Error reading files.</p>';
    }

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>🤡 Joker Storage Vault</title>
            <style>
                body { background: #0f172a; color: #f8fafc; font-family: monospace; text-align: center; padding: 40px 20px; }
                .box { border: 2px solid #22c55e; display: inline-block; padding: 20px 40px; border-radius: 10px; background: #1e293b; max-width: 600px; width: 100%; }
                h1 { color: #22c55e; margin: 0 0 10px 0; }
                .files { text-align: left; background: #0f172a; padding: 15px; border-radius: 8px; margin-top: 20px; max-height: 300px; overflow-y: auto; }
            </style>
        </head>
        <body>
            <div class="box">
                <h1>🤡 JOKER MEDIA VAULT</h1>
                <p>Status: <b>ONLINE & LISTENING</b></p>
                <div class="files">
                    <h3>📁 Stored Media Files:</h3>
                    ${fileListHtml}
                </div>
            </div>
        </body>
        </html>
    `);
});

// 📤 Media Backup Upload Endpoint
app.post('/api/backup', upload.single('media'), async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        if (!authHeader || authHeader !== `Bearer ${BACKUP_KEY}`) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No media received' });
        }

        const fileName = req.file.originalname || `media_${Date.now()}`;
        const localPath = path.join(backupsDir, fileName);

        await fs.promises.writeFile(localPath, req.file.buffer);
        const fileUrl = `${req.protocol}://${req.get('host')}/backups/${fileName}`;

        console.log(`[VAULT SAVED]: ${fileName}`);
        return res.json({ success: true, fileName, url: fileUrl });

    } catch (error) {
        console.error('[VAULT ERROR]:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => console.log(`Vault active on port ${PORT}`));