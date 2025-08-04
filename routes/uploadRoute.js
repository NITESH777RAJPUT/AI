const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs');
const axios = require('axios');
const path = require('path');
const https = require('https');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
let extractedText = '';

// ✅ Create uploads folder if it doesn't exist
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// ✅ Multer Config
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadsDir),
  filename: (_, file, cb) => cb(null, `${uuidv4()}-${file.originalname}`),
});
const upload = multer({ storage });

// ✅ Extract from .docx
const extractDocx = async (filePath) => {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
};

// ✅ Extract from .eml
const extractEml = async (filePath) => {
  return fs.readFileSync(filePath, 'utf-8');
};

// ✅ Upload from local file
router.post('/', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });

  const filePath = file.path;
  const ext = path.extname(file.originalname).toLowerCase();

  try {
    if (ext === '.pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      extractedText = pdfData.text;
    } else if (ext === '.docx') {
      extractedText = await extractDocx(filePath);
    } else if (ext === '.eml') {
      extractedText = await extractEml(filePath);
    } else {
      return res.status(400).json({ error: 'Unsupported file type' });
    }

    // ✅ Optional: delete uploaded file
    fs.unlink(filePath, () => {});
    res.json({ message: '✅ File uploaded and text extracted successfully' });
  } catch (err) {
    console.error('❌ Upload error:', err);
    res.status(500).json({ error: '❌ Failed to extract file' });
  }
});

// ✅ Upload from URL (pdf/docx/eml)
router.post('/url', async (req, res) => {
  const { pdfUrl } = req.body;
  if (!pdfUrl) return res.status(400).json({ error: 'URL is required' });

  const ext = path.extname(pdfUrl.split('?')[0]).toLowerCase();
  const tempPath = path.join(uploadsDir, `${uuidv4()}${ext}`);

  const file = fs.createWriteStream(tempPath);
  https.get(pdfUrl, (response) => {
    response.pipe(file);
    file.on('finish', async () => {
      file.close();

      try {
        if (ext === '.pdf') {
          const buffer = fs.readFileSync(tempPath);
          const parsed = await pdfParse(buffer);
          if (!parsed.text || parsed.text.trim().length < 10) {
            return res.status(400).json({ error: '❌ Extracted content too short or empty from PDF.' });
          }
          extractedText = parsed.text;
        } else if (ext === '.docx') {
          extractedText = await extractDocx(tempPath);
        } else if (ext === '.eml') {
          extractedText = await extractEml(tempPath);
        } else {
          return res.status(400).json({ error: 'Unsupported file type' });
        }

        fs.unlink(tempPath, () => {});
        res.json({ message: '✅ File downloaded and text extracted' });
      } catch (err) {
        console.error('❌ Error extracting text:', err.message);
        res.status(500).json({ error: '❌ Failed to extract from file. Format might be unsupported.' });
      }
    });
  }).on('error', (err) => {
    fs.unlink(tempPath, () => {});
    console.error('❌ Download failed:', err.message);
    res.status(500).json({ error: '❌ Error downloading file' });
  });
});

// ✅ Export router + extractedText getter
const getExtractedText = () => extractedText;
module.exports = { router, getExtractedText };
