import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import { db } from '../db.js';
import { signToken } from '../auth.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------
let testUserId;
let testToken;
let testProductId;
let lowStockProductId; // stock = 1, used for 409 tests

beforeAll(() => {
  // Create test user
  const hash = bcrypt.hashSync('testpass123', 10);
  const user = db
    .prepare("INSERT INTO users (name, email, password) VALUES (?, ?, ?)")
    .run('Cart Tester', `cart-test-${Date.now()}@example.com`, hash);
  testUserId = user.lastInsertRowid;
  testToken = signToken({ id: testUserId, email: `cart-test-${testUserId}@example.com` });

  // Create a normal test product (stock = 10)
  const product = db
    .prepare("INSERT INTO products (name, description, category, price_cents, image, stock) VALUES (?, ?, ?, ?, ?, ?)")
    .run('Test Widget', 'A widget for testing', 'test', 999, '', 10);
  testProductId = product.lastInsertRowid;

  // Create a low-stock product (stock = 1)
  const lowStock = db
    .prepare("INSERT INTO products (name, description, category, price_cents, image, stock) VALUES (?, ?, ?, ?, ?, ?)")
    .run('Rare Widget', 'Only one left', 'test', 1999, '', 1);
  lowStockProductId = lowStock.lastInsertRowid;
});

afterAll(() => {
  // Clean up in dependency order
  db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(testUserId);
  db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
  db.prepare('DELETE FROM products WHERE id IN (?, ?)').run(testProductId, lowStockProductId);
});

// Helper: clear this user's cart between tests that need a clean state
function clearCart() {
  db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(testUserId);
}

// ---------------------------------------------------------------------------
// GET /api/cart
// ---------------------------------------------------------------------------
describe('GET /api/cart', () => {
  it('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/cart');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 401 for an invalid/malformed token', async () => {
    const res = await request(app)
      .get('/api/cart')
      .set('Authorization', 'Bearer not.a.valid.token');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('returns the current user cart (200) with correct shape', async () => {
    clearCart();
    const res = await request(app)
      .get('/api/cart')
      .set('Authorization', `Bearer ${testToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(res.body).toHaveProperty('total_cents');
    expect(res.body).toHaveProperty('count');
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.total_cents).toBe(0);
    expect(res.body.count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// POST /api/cart
// ---------------------------------------------------------------------------
describe('POST /api/cart', () => {
  beforeAll(() => clearCart());

  it('returns 401 when no token is provided', async () => {
    const res = await request(app)
      .post('/api/cart')
      .send({ productId: testProductId, quantity: 1 });
    expect(res.status).toBe(401);
  });

  it('returns 400 when productId is missing', async () => {
    const res = await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ quantity: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/productId/i);
  });

  it('returns 400 when productId is not a valid integer', async () => {
    const res = await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ productId: 'abc', quantity: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/productId/i);
  });

  it('returns 400 when quantity is less than 1', async () => {
    const res = await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ productId: testProductId, quantity: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/quantity/i);
  });

  it('returns 400 when quantity is a non-integer float', async () => {
    const res = await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ productId: testProductId, quantity: 1.5 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/quantity/i);
  });

  it('returns 404 when product does not exist', async () => {
    const res = await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ productId: 999999, quantity: 1 });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/product not found/i);
  });

  it('returns 409 when requested quantity exceeds stock', async () => {
    clearCart();
    const res = await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ productId: lowStockProductId, quantity: 5 }); // stock = 1
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/stock/i);
  });

  it('adds item to cart and returns 201 with updated cart', async () => {
    clearCart();
    const res = await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ productId: testProductId, quantity: 2 });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('items');
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].product_id).toBe(testProductId);
    expect(res.body.items[0].quantity).toBe(2);
    expect(res.body.total_cents).toBe(999 * 2);
    expect(res.body.count).toBe(2);
  });

  it('uses default quantity of 1 when quantity is omitted', async () => {
    clearCart();
    const res = await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ productId: testProductId });
    expect(res.status).toBe(201);
    expect(res.body.items[0].quantity).toBe(1);
  });

  it('accumulates quantity when same product is added again', async () => {
    clearCart();
    await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ productId: testProductId, quantity: 2 });
    const res = await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ productId: testProductId, quantity: 3 });
    expect(res.status).toBe(201);
    expect(res.body.items[0].quantity).toBe(5);
  });

  it('returns 409 when accumulated quantity would exceed stock', async () => {
    clearCart();
    // Add 8 first (stock = 10)
    await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ productId: testProductId, quantity: 8 });
    // Try to add 5 more (8+5=13 > 10)
    const res = await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ productId: testProductId, quantity: 5 });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/stock/i);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/cart/:productId
// ---------------------------------------------------------------------------
describe('PATCH /api/cart/:productId', () => {
  beforeAll(() => {
    clearCart();
    // Seed one item in the cart
    db.prepare('INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)')
      .run(testUserId, testProductId, 3);
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app)
      .patch(`/api/cart/${testProductId}`)
      .send({ quantity: 2 });
    expect(res.status).toBe(401);
  });

  it('returns 400 when quantity is negative', async () => {
    const res = await request(app)
      .patch(`/api/cart/${testProductId}`)
      .set('Authorization', `Bearer ${testToken}`)
      .send({ quantity: -1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/quantity/i);
  });

  it('returns 400 when quantity is a non-integer float', async () => {
    const res = await request(app)
      .patch(`/api/cart/${testProductId}`)
      .set('Authorization', `Bearer ${testToken}`)
      .send({ quantity: 2.7 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/quantity/i);
  });

  it('removes item from cart when quantity is 0', async () => {
    // Ensure item exists first
    db.prepare('INSERT OR REPLACE INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)')
      .run(testUserId, testProductId, 3);

    const res = await request(app)
      .patch(`/api/cart/${testProductId}`)
      .set('Authorization', `Bearer ${testToken}`)
      .send({ quantity: 0 });
    expect(res.status).toBe(200);
    const item = res.body.items.find(i => i.product_id === testProductId);
    expect(item).toBeUndefined();
  });

  it('returns 404 when product does not exist', async () => {
    const res = await request(app)
      .patch('/api/cart/999999')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ quantity: 2 });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/product not found/i);
  });

  it('returns 409 when new quantity exceeds stock', async () => {
    db.prepare('INSERT OR REPLACE INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)')
      .run(testUserId, testProductId, 3);

    const res = await request(app)
      .patch(`/api/cart/${testProductId}`)
      .set('Authorization', `Bearer ${testToken}`)
      .send({ quantity: 999 }); // stock = 10
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/stock/i);
  });

  it('returns 404 when item is not in the cart', async () => {
    clearCart(); // ensure cart is empty
    const res = await request(app)
      .patch(`/api/cart/${testProductId}`)
      .set('Authorization', `Bearer ${testToken}`)
      .send({ quantity: 2 });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not in your cart/i);
  });

  it('updates quantity and returns 200 with updated cart', async () => {
    db.prepare('INSERT OR REPLACE INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)')
      .run(testUserId, testProductId, 3);

    const res = await request(app)
      .patch(`/api/cart/${testProductId}`)
      .set('Authorization', `Bearer ${testToken}`)
      .send({ quantity: 5 });
    expect(res.status).toBe(200);
    const item = res.body.items.find(i => i.product_id === testProductId);
    expect(item).toBeDefined();
    expect(item.quantity).toBe(5);
    expect(res.body.total_cents).toBe(999 * 5);
    expect(res.body.count).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/cart/:productId
// ---------------------------------------------------------------------------
describe('DELETE /api/cart/:productId', () => {
  beforeAll(() => {
    clearCart();
    db.prepare('INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)')
      .run(testUserId, testProductId, 2);
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app).delete(`/api/cart/${testProductId}`);
    expect(res.status).toBe(401);
  });

  it('removes the item and returns 200 with updated cart', async () => {
    // Ensure item is present
    db.prepare('INSERT OR REPLACE INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)')
      .run(testUserId, testProductId, 2);

    const res = await request(app)
      .delete(`/api/cart/${testProductId}`)
      .set('Authorization', `Bearer ${testToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    const item = res.body.items.find(i => i.product_id === testProductId);
    expect(item).toBeUndefined();
    expect(res.body.total_cents).toBe(0);
    expect(res.body.count).toBe(0);
  });

  it('is idempotent — deleting a non-existent item returns 200 with unchanged cart', async () => {
    clearCart();
    const res = await request(app)
      .delete(`/api/cart/${testProductId}`)
      .set('Authorization', `Bearer ${testToken}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
  });
});
