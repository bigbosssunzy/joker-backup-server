require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const BACKUP_KEY = process.env.BACKUP_KEY || 'bigboss_secret_key_2026';
const ACCESS_PIN = process.env.WEB_ACCESS_PIN || '426580@Sunzy';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// 🔒 Main Dashboard
app.get('/', (req, res) => {
    const userPin = req.query.pin;

    if (userPin !== ACCESS_PIN) {
        return res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>🤡 Joker Vault - Access Locked</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { background: #0f172a; color: #f8fafc; font-family: sans-serif; text-align: center; padding-top: 100px; margin: 0; }
                    .login-box { background: #1e293b; border: 2px solid #ef4444; border-radius: 12px; padding: 30px; display: inline-block; max-width: 320px; width: 90%; }
                    input { width: 100%; padding: 12px; margin: 15px 0; border-radius: 6px; border: 1px solid #334155; background: #0f172a; color: #fff; text-align: center; font-size: 16px; box-sizing: border-box; }
                    button { width: 100%; padding: 12px; background: #ef4444; border: none; color: white; border-radius: 6px; font-size: 16px; font-weight: bold; cursor: pointer; }
                </style>
            </head>
            <body>
                <div class="login-box">
                    <h2>🔒 VAULT ACCESS</h2>
                    <form method="GET" action="/">
                        <input type="password" name="pin" placeholder="Enter Access Code" required autofocus />
                        <button type="submit">Unlock</button>
                    </form>
                    ${userPin ? '<p style="color: #ef4444; margin-top: 10px;">Incorrect Access Code!</p>' : ''}
                </div>
            </body>
            </html>
        `);
    }

    let filesHtml = '';
    try {
        const allFiles = fs.readdirSync(backupsDir);
        const mediaFiles = allFiles.filter(f => !f.endsWith('.json')).reverse();

        if (mediaFiles.length === 0) {
            filesHtml = '<p style="color: #94a3b8; grid-column: 1/-1; text-align: center;">No stored media found.</p>';
        } else {
            filesHtml = mediaFiles.map(file => {
                const isVideo = file.endsWith('.mp4');
                const fileUrl = `/backups/${file}`;
                const metaFileName = `${file}.json`;
                const metaFilePath = path.join(backupsDir, metaFileName);
                
                let metadata = {
                    dateTime: 'N/A',
                    botNumber: 'N/A',
                    senderName: 'N/A',
                    senderNumber: 'N/A',
                    caption: 'N/A',
                    userReply: 'N/A'
                };

                if (fs.existsSync(metaFilePath)) {
                    try {
                        metadata = JSON.parse(fs.readFileSync(metaFilePath, 'utf8'));
                    } catch(e) {}
                }

                const safeMeta = JSON.stringify(metadata).replace(/'/g, "&apos;").replace(/"/g, "&quot;");

                return `
                    <div class="media-card">
                        ${isVideo ? 
                            `<video src="${fileUrl}" controls preload="metadata"></video>` : 
                            `<img src="${fileUrl}" loading="lazy" />`
                        }
                        <div class="card-info">
                            <button class="btn-info" data-meta='${safeMeta}' onclick="showInfo(this)">ℹ️ Info</button>
                            <form method="POST" action="/delete" style="margin: 0;">
                                <input type="hidden" name="pin" value="${userPin}" />
                                <input type="hidden" name="fileName" value="${file}" />
                                <button type="submit" class="btn-delete" onclick="return confirm('Delete this file permanently?')">🗑️ Delete</button>
                            </form>
                        </div>
                    </div>
                `;
            }).join('');
        }
    } catch (e) {
        filesHtml = '<p style="color: #ef4444; grid-column: 1/-1; text-align: center;">Error reading storage directory.</p>';
    }

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>🤡 Joker Vault - Gallery</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { background: #0f172a; color: #f8fafc; font-family: sans-serif; margin: 0; padding: 20px; }
                .header { text-align: center; margin-bottom: 25px; border-bottom: 2px solid #22c55e; padding-bottom: 15px; }
                h1 { color: #22c55e; margin: 0 0 5px 0; }
                .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; max-width: 1200px; margin: 0 auto; }
                .media-card { background: #1e293b; border: 1px solid #334155; border-radius: 10px; overflow: hidden; display: flex; flex-direction: column; }
                .media-card img, .media-card video { width: 100%; height: 220px; object-fit: cover; background: #000; }
                .card-info { padding: 12px; display: flex; justify-content: space-between; align-items: center; gap: 10px; background: #1e293b; }
                .btn-info { background: #3b82f6; border: none; color: white; padding: 6px 12px; border-radius: 5px; font-size: 12px; font-weight: bold; cursor: pointer; }
                .btn-delete { background: #dc2626; border: none; color: white; padding: 6px 12px; border-radius: 5px; font-size: 12px; font-weight: bold; cursor: pointer; }
                
                .modal-overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 100; justify-content: center; align-items: center; }
                .modal-box { background: #1e293b; border: 1px solid #3b82f6; border-radius: 10px; padding: 20px; max-width: 400px; width: 90%; color: #f8fafc; font-family: sans-serif; }
                .modal-box h2 { color: #3b82f6; margin-top: 0; font-size: 18px; border-bottom: 1px solid #334155; padding-bottom: 10px; }
                .info-item { margin: 10px 0; font-size: 14px; word-break: break-word; }
                .info-item b { color: #94a3b8; display: block; font-size: 12px; margin-bottom: 2px; }
                .btn-close { margin-top: 15px; width: 100%; padding: 10px; background: #475569; border: none; color: white; border-radius: 5px; cursor: pointer; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🤡 JOKER MEDIA VAULT</h1>
                <span style="color: #22c55e; font-size: 14px;">● ONLINE & SECURED</span>
            </div>
            <div class="grid">
                ${filesHtml}
            </div>

            <div id="infoModal" class="modal-overlay">
                <div class="modal-box">
                    <h2>📋 ViewOnce Details</h2>
                    <div class="info-item"><b>📅 Saved Date & Time:</b> <span id="mDateTime"></span></div>
                    <div class="info-item"><b>🤖 Bot Number:</b> <span id="mBot"></span></div>
                    <div class="info-item"><b>👤 Sender Name:</b> <span id="mSenderName"></span></div>
                    <div class="info-item"><b>📞 Sender Number:</b> <span id="mSenderNum"></span></div>
                    <div class="info-item"><b>💬 Trigger Reply Text:</b> <span id="mReply"></span></div>
                    <div class="info-item"><b>📝 Original Caption:</b> <span id="mCaption"></span></div>
                    <button class="btn-close" onclick="closeInfo()">Close</button>
                </div>
            </div>

            <script>
                function showInfo(btn) {
                    const data = JSON.parse(btn.getAttribute('data-meta'));
                    document.getElementById('mDateTime').innerText = data.dateTime || 'N/A';
                    document.getElementById('mBot').innerText = data.botNumber || 'N/A';
                    document.getElementById('mSenderName').innerText = data.senderName || 'N/A';
                    document.getElementById('mSenderNum').innerText = data.senderNumber || 'N/A';
                    document.getElementById('mReply').innerText = data.userReply || 'N/A';
                    document.getElementById('mCaption').innerText = data.caption || 'N/A';
                    document.getElementById('infoModal').style.display = 'flex';
                }
                function closeInfo() {
                    document.getElementById('infoModal').style.display = 'none';
                }
            </script>
        </body>
        </html>
    `);
});

// 🗑️ Delete Route
app.post('/delete', (req, res) => {
    const { pin, fileName } = req.body;
    if (pin !== ACCESS_PIN) {
        return res.status(403).send('Unauthorized');
    }

    if (fileName) {
        const filePath = path.join(backupsDir, path.basename(fileName));
        const metaPath = path.join(backupsDir, `${path.basename(fileName)}.json`);
        
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
    }
    res.redirect(`/?pin=${encodeURIComponent(pin)}`);
});

// 📤 API Upload Route
app.post('/api/backup', upload.any(), async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        if (!authHeader || authHeader !== `Bearer ${BACKUP_KEY}`) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const mediaFile = req.files ? req.files.find(f => f.fieldname === 'media') : null;
        if (!mediaFile) {
            return res.status(400).json({ success: false, message: 'No media file received' });
        }

        const fileName = mediaFile.originalname || `media_${Date.now()}`;
        const localPath = path.join(backupsDir, fileName);

        await fs.promises.writeFile(localPath, mediaFile.buffer);

        if (req.body.metadata) {
            const metaPath = path.join(backupsDir, `${fileName}.json`);
            await fs.promises.writeFile(metaPath, req.body.metadata);
        }

        const fileUrl = `${req.protocol}://${req.get('host')}/backups/${fileName}`;
        console.log(`\n✅ [VAULT BACKUP SUCCESS] Saved: ${fileName}\n`);
        return res.json({ success: true, fileName, url: fileUrl });

    } catch (error) {
        console.error(`\n❌ [VAULT BACKUP ERROR]:`, error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
