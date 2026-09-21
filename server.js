require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const app = express();
const PORT = process.env.PORT || 3000;
const BACKUP_KEY = process.env.BACKUP_KEY || 'joker_secret_key_123';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve the 'backups' folder publicly so you can view/download uploaded files
const backupsDir = path.join(__dirname, 'backups');
if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
}
app.use('/backups', express.static(backupsDir));

// Multer Storage Configuration (In-Memory Buffer)
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB file size limit
});

// Configure Cloudflare R2 / S3 Client (Optional for permanent cloud storage)
const hasS3Config = process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY;
let s3Client = null;

if (hasS3Config) {
    s3Client = new S3Client({
        region: 'auto',
        endpoint: process.env.R2_ENDPOINT,
        credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
    });
}

// 🌐 Main Web Dashboard
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>🤡 Joker Storage Vault</title>
            <style>
                body { background: #0f172a; color: #f8fafc; font-family: monospace; text-align: center; padding-top: 50px; }
                .box { border: 2px solid #22c55e; display: inline-block; padding: 20px 40px; border-radius: 10px; background: #1e293b; }
                h1 { color: #22c55e; margin: 0 0 10px 0; }
            </style>
        </head>
        <body>
            <div class="box">
                <h1>🤡 JOKER MEDIA VAULT</h1>
                <p>Status: <b>ONLINE & LISTENING</b></p>
                <p>Storage Engine: <b>${hasS3Config ? 'Cloudflare R2 (Permanent)' : 'Local Disk'}</b></p>
            </div>
        </body>
        </html>
    `);
});

// 📤 API Endpoint to receive automatic backups from Bot
app.post('/api/backup', upload.single('media'), async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        if (!authHeader || authHeader !== `Bearer ${BACKUP_KEY}`) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No media file received' });
        }

        const fileName = `${Date.now()}_${req.file.originalname}`;
        let fileUrl = '';

        if (hasS3Config) {
            const bucketName = process.env.R2_BUCKET_NAME || 'joker-backups';
            await s3Client.send(new PutObjectCommand({
                Bucket: bucketName,
                Key: fileName,
                Body: req.file.buffer,
                ContentType: req.file.mimetype,
            }));
            fileUrl = `${process.env.PUBLIC_STORAGE_URL}/${fileName}`;
        } else {
            const localPath = path.join(backupsDir, fileName);
            await fs.promises.writeFile(localPath, req.file.buffer);
            fileUrl = `${req.protocol}://${req.get('host')}/backups/${fileName}`;
        }

        console.log(`[VAULT BACKUP SUCCESS]: ${fileName}`);
        return res.json({ success: true, fileName, url: fileUrl });

    } catch (error) {
        console.error('[VAULT UPLOAD ERROR]:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => console.log(`🚀 Vault Server active on port ${PORT}`));
