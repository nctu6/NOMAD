import express, { Request, Response } from 'express';
import { db } from '../db/database';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = express.Router();

router.get('/', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const tags = db.prepare(
    'SELECT * FROM tags WHERE user_id = ? ORDER BY name ASC'
  ).all(authReq.user.id);
  res.json({ tags });
});

router.post('/', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { name, color } = req.body;

  if (!name) return res.status(400).json({ error: 'Tag name is required' });

  const result = db.prepare(
    'INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?)'
  ).run(authReq.user.id, name, color || '#10b981');

  const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ tag });
});

router.put('/:id', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { name, color } = req.body;
  const tag = db.prepare('SELECT * FROM tags WHERE id = ? AND user_id = ?').get(req.params.id, authReq.user.id);

  if (!tag) return res.status(404).json({ error: 'Tag not found' });

  db.prepare('UPDATE tags SET name = COALESCE(?, name), color = COALESCE(?, color) WHERE id = ?')
    .run(name || null, color || null, req.params.id);

  const updated = db.prepare('SELECT * FROM tags WHERE id = ?').get(req.params.id);
  res.json({ tag: updated });
});

router.delete('/:id', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const tag = db.prepare('SELECT * FROM tags WHERE id = ? AND user_id = ?').get(req.params.id, authReq.user.id);
  if (!tag) return res.status(404).json({ error: 'Tag not found' });

  db.prepare('DELETE FROM tags WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
