import express, { Request, Response } from 'express';
import { db } from '../db/database';
import { authenticate, adminOnly } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = express.Router();

router.get('/', authenticate, (_req: Request, res: Response) => {
  const categories = db.prepare(
    'SELECT * FROM categories ORDER BY name ASC'
  ).all();
  res.json({ categories });
});

router.post('/', authenticate, adminOnly, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { name, color, icon } = req.body;

  if (!name) return res.status(400).json({ error: 'Category name is required' });

  const result = db.prepare(
    'INSERT INTO categories (name, color, icon, user_id) VALUES (?, ?, ?, ?)'
  ).run(name, color || '#6366f1', icon || '\uD83D\uDCCD', authReq.user.id);

  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ category });
});

router.put('/:id', authenticate, adminOnly, (req: Request, res: Response) => {
  const { name, color, icon } = req.body;
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);

  if (!category) return res.status(404).json({ error: 'Category not found' });

  db.prepare(`
    UPDATE categories SET
      name = COALESCE(?, name),
      color = COALESCE(?, color),
      icon = COALESCE(?, icon)
    WHERE id = ?
  `).run(name || null, color || null, icon || null, req.params.id);

  const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  res.json({ category: updated });
});

router.delete('/:id', authenticate, adminOnly, (req: Request, res: Response) => {
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);

  if (!category) return res.status(404).json({ error: 'Category not found' });

  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
