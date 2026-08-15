import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { readCart } from './cart.js';

const router = Router();
router.use(requireAuth); // Feature 3 — checkout and order history.

/**
 * Turns the current cart into an order: decrements stock, writes the order plus
 * its line items, and empties the cart. Wrapped in a transaction so a failure
 * partway through cannot leave stock decremented without an order.
 */
const checkout = db.transaction((userId, address) => {
  const { items, total_cents } = readCart(userId);
  if (!items.length) throw Object.assign(new Error('Your cart is empty'), { status: 400 });

  for (const item of items) {
    if (item.quantity > item.stock) {
      throw Object.assign(new Error(`${item.name} only has ${item.stock} left in stock`), { status: 409 });
    }
  }

  const { lastInsertRowid: orderId } = db
    .prepare('INSERT INTO orders (user_id, total_cents, address) VALUES (?, ?, ?)')
    .run(userId, total_cents, address);

  const insertItem = db.prepare(
    'INSERT INTO order_items (order_id, product_id, name, price_cents, quantity) VALUES (?, ?, ?, ?, ?)'
  );
  const decrementStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');

  for (const item of items) {
    insertItem.run(orderId, item.product_id, item.name, item.price_cents, item.quantity);
    decrementStock.run(item.quantity, item.product_id);
  }

  db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(userId);
  return orderId;
});

router.post('/', (req, res) => {
  const address = String(req.body?.address || '').trim();
  if (address.length < 10) {
    return res.status(400).json({ error: 'Please enter a delivery address of at least 10 characters' });
  }

  try {
    const orderId = checkout(req.userId, address);
    res.status(201).json({ order: loadOrder(req.userId, orderId) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Checkout failed' });
  }
});

function loadOrder(userId, orderId) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(orderId, userId);
  if (!order) return null;
  order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id').all(orderId);
  return order;
}

router.get('/', (req, res) => {
  const orders = db
    .prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC')
    .all(req.userId)
    .map((o) => loadOrder(req.userId, o.id));
  res.json({ orders });
});

router.get('/:id', (req, res) => {
  const order = loadOrder(req.userId, req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json({ order });
});

export default router;
