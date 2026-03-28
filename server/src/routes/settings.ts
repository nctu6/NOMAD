import express, { Request, Response } from 'express';
import { db } from '../db/database';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = express.Router();

router.get('/', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const rows = db.prepare('SELECT key, value FROM settings WHERE user_id = ?').all(authReq.user.id) as { key: string; value: string }[];
  const settings: Record<string, unknown> = {};
  for (const row of rows) {
    try {
      settings[row.key] = JSON.parse(row.value);
    } catch {
      settings[row.key] = row.value;
    }
  }
  res.json({ settings });
});

router.put('/', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { key, value } = req.body;

  if (!key) return res.status(400).json({ error: 'Key is required' });

  const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value !== undefined ? value : '');

  db.prepare(`
    INSERT INTO settings (user_id, key, value) VALUES (?, ?, ?)
    ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value
  `).run(authReq.user.id, key, serialized);

  res.json({ success: true, key, value });
});

router.post('/bulk', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { settings } = req.body;

  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ error: 'Settings object is required' });
  }

  const upsert = db.prepare(`
    INSERT INTO settings (user_id, key, value) VALUES (?, ?, ?)
    ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value
  `);

  try {
    db.exec('BEGIN');
    for (const [key, value] of Object.entries(settings)) {
      const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value !== undefined ? value : '');
      upsert.run(authReq.user.id, key, serialized);
    }
    db.exec('COMMIT');
  } catch (err: unknown) {
    db.exec('ROLLBACK');
    console.error('Error saving settings:', err);
    return res.status(500).json({ error: 'Error saving settings' });
  }

  res.json({ success: true, updated: Object.keys(settings).length });
});

export default router;
