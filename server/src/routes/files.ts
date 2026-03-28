import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { db, canAccessTrip } from '../db/database';
import { authenticate, demoUploadBlock } from '../middleware/auth';
import { requireTripAccess } from '../middleware/tripAccess';
import { broadcast } from '../websocket';
import { AuthRequest, TripFile } from '../types';

const router = express.Router({ mergeParams: true });

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const filesDir = path.join(__dirname, '../../uploads/files');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir, { recursive: true });
    cb(null, filesDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const DEFAULT_ALLOWED_EXTENSIONS = 'jpg,jpeg,png,gif,webp,heic,pdf,doc,docx,xls,xlsx,txt,csv';
const BLOCKED_EXTENSIONS = ['.svg', '.html', '.htm', '.xml'];

function getAllowedExtensions(): string {
  try {
    const row = db.prepare("SELECT value FROM app_settings WHERE key = 'allowed_file_types'").get() as { value: string } | undefined;
    return row?.value || DEFAULT_ALLOWED_EXTENSIONS;
  } catch { return DEFAULT_ALLOWED_EXTENSIONS; }
}

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (BLOCKED_EXTENSIONS.includes(ext) || file.mimetype.includes('svg')) {
      return cb(new Error('File type not allowed'));
    }
    const allowed = getAllowedExtensions().split(',').map(e => e.trim().toLowerCase());
    const fileExt = ext.replace('.', '');
    if (allowed.includes(fileExt) || (allowed.includes('*') && !BLOCKED_EXTENSIONS.includes(ext))) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  },
});

function verifyTripOwnership(tripId: string | number, userId: number) {
  return canAccessTrip(tripId, userId);
}

function formatFile(file: TripFile) {
  return {
    ...file,
    url: file.filename?.startsWith('files/') ? `/uploads/${file.filename}` : `/uploads/files/${file.filename}`,
  };
}

router.get('/', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { tripId } = req.params;

  const trip = verifyTripOwnership(tripId, authReq.user.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });

  const files = db.prepare(`
    SELECT f.*, r.title as reservation_title
    FROM trip_files f
    LEFT JOIN reservations r ON f.reservation_id = r.id
    WHERE f.trip_id = ?
    ORDER BY f.created_at DESC
  `).all(tripId) as TripFile[];
  res.json({ files: files.map(formatFile) });
});

router.post('/', authenticate, requireTripAccess, demoUploadBlock, upload.single('file'), (req: Request, res: Response) => {
  const { tripId } = req.params;
  const { place_id, description, reservation_id } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const result = db.prepare(`
    INSERT INTO trip_files (trip_id, place_id, reservation_id, filename, original_name, file_size, mime_type, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    tripId,
    place_id || null,
    reservation_id || null,
    req.file.filename,
    req.file.originalname,
    req.file.size,
    req.file.mimetype,
    description || null
  );

  const file = db.prepare(`
    SELECT f.*, r.title as reservation_title
    FROM trip_files f
    LEFT JOIN reservations r ON f.reservation_id = r.id
    WHERE f.id = ?
  `).get(result.lastInsertRowid) as TripFile;
  res.status(201).json({ file: formatFile(file) });
  broadcast(tripId, 'file:created', { file: formatFile(file) }, req.headers['x-socket-id'] as string);
});

router.put('/:id', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { tripId, id } = req.params;
  const { description, place_id, reservation_id } = req.body;

  const trip = verifyTripOwnership(tripId, authReq.user.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });

  const file = db.prepare('SELECT * FROM trip_files WHERE id = ? AND trip_id = ?').get(id, tripId) as TripFile | undefined;
  if (!file) return res.status(404).json({ error: 'File not found' });

  db.prepare(`
    UPDATE trip_files SET
      description = COALESCE(?, description),
      place_id = ?,
      reservation_id = ?
    WHERE id = ?
  `).run(
    description !== undefined ? description : file.description,
    place_id !== undefined ? (place_id || null) : file.place_id,
    reservation_id !== undefined ? (reservation_id || null) : file.reservation_id,
    id
  );

  const updated = db.prepare(`
    SELECT f.*, r.title as reservation_title
    FROM trip_files f
    LEFT JOIN reservations r ON f.reservation_id = r.id
    WHERE f.id = ?
  `).get(id) as TripFile;
  res.json({ file: formatFile(updated) });
  broadcast(tripId, 'file:updated', { file: formatFile(updated) }, req.headers['x-socket-id'] as string);
});

router.delete('/:id', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { tripId, id } = req.params;

  const trip = verifyTripOwnership(tripId, authReq.user.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });

  const file = db.prepare('SELECT * FROM trip_files WHERE id = ? AND trip_id = ?').get(id, tripId) as TripFile | undefined;
  if (!file) return res.status(404).json({ error: 'File not found' });

  const filePath = path.join(filesDir, file.filename);
  if (fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch (e) { console.error('Error deleting file:', e); }
  }

  db.prepare('DELETE FROM trip_files WHERE id = ?').run(id);
  res.json({ success: true });
  broadcast(tripId, 'file:deleted', { fileId: Number(id) }, req.headers['x-socket-id'] as string);
});

export default router;
