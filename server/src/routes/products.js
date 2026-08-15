import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

/**
 * Feature 1 — product catalog.
 * Supports free-text search, category filter and sorting, all optional.
 * GET /api/products?q=mug&category=kitchen&sort=price_asc
 */
router.get('/', (req, res) => {
  const q = String(req.query.q || '').trim();
  const category = String(req.query.category || '').trim();

  const where = [];
  const params = {};
  if (q) {
    where.push('(name LIKE :q OR description LIKE :q)');
    params.q = `%${q}%`;
  }
  if (category && category !== 'all') {
    where.push('category = :category');
    params.category = category;
  }

  const sorts = {
    price_asc: 'price_cents ASC',
    price_desc: 'price_cents DESC',
    name_asc: 'name ASC',
  };
  const orderBy = sorts[req.query.sort] || 'id ASC';

  const sql = `SELECT * FROM products ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY ${orderBy}`;
  res.json({ products: db.prepare(sql).all(params) });
});

router.get('/categories', (_req, res) => {
  const rows = db.prepare('SELECT DISTINCT category FROM products ORDER BY category').all();
  res.json({ categories: rows.map((r) => r.category) });
});

router.get('/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json({ product });
});

export default router;
