import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth); // Feature 2 — the cart is private to the signed-in user.

const cartQuery = db.prepare(`
  SELECT ci.id, ci.quantity, p.id AS product_id, p.name, p.price_cents, p.image, p.stock
  FROM cart_items ci
  JOIN products p ON p.id = ci.product_id
  WHERE ci.user_id = ?
  ORDER BY ci.id
`);

export function readCart(userId) {
  const items = cartQuery.all(userId);
  const total_cents = items.reduce((sum, i) => sum + i.price_cents * i.quantity, 0);
  return { items, total_cents, count: items.reduce((n, i) => n + i.quantity, 0) };
}

router.get('/', (req, res) => res.json(readCart(req.userId)));

router.post('/', (req, res) => {
  const productId = Number(req.body?.productId);
  const quantity = Number(req.body?.quantity ?? 1);

  if (!Number.isInteger(productId)) return res.status(400).json({ error: 'A valid productId is required' });
  if (!Number.isInteger(quantity) || quantity < 1) {
    return res.status(400).json({ error: 'Quantity must be a whole number of at least 1' });
  }

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const existing = db
    .prepare('SELECT quantity FROM cart_items WHERE user_id = ? AND product_id = ?')
    .get(req.userId, productId);
  const nextQty = (existing?.quantity || 0) + quantity;

  if (nextQty > product.stock) {
    return res.status(409).json({ error: `Only ${product.stock} left in stock` });
  }

  db.prepare(`
    INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)
    ON CONFLICT (user_id, product_id) DO UPDATE SET quantity = ?
  `).run(req.userId, productId, nextQty, nextQty);

  res.status(201).json(readCart(req.userId));
});

router.patch('/:productId', (req, res) => {
  const productId = Number(req.params.productId);
  const quantity = Number(req.body?.quantity);
  if (!Number.isInteger(quantity) || quantity < 0) {
    return res.status(400).json({ error: 'Quantity must be 0 or a positive whole number' });
  }

  if (quantity === 0) {
    db.prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?').run(req.userId, productId);
    return res.json(readCart(req.userId));
  }

  const product = db.prepare('SELECT stock FROM products WHERE id = ?').get(productId);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  if (quantity > product.stock) return res.status(409).json({ error: `Only ${product.stock} left in stock` });

  const { changes } = db
    .prepare('UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?')
    .run(quantity, req.userId, productId);
  if (!changes) return res.status(404).json({ error: 'That item is not in your cart' });

  res.json(readCart(req.userId));
});

router.delete('/:productId', (req, res) => {
  db.prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?').run(req.userId, req.params.productId);
  res.json(readCart(req.userId));
});

export default router;
