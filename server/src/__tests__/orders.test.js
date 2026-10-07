/**
 * Orders API tests — POST /api/orders, GET /api/orders, GET /api/orders/:id
 *
 * Uses an in-process SQLite DB (same db.js module) so no external server is needed.
 * Each test suite registers a fresh user and works with isolated data.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../app.js';
import { db } from '../db.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Register a unique user and return { token, userId }. */
async function registerUser(suffix = '') {
  const email = `orders-test-${suffix}-${Date.now()}@example.com`;
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Test User', email, password: 'password123' });
  return { token: res.body.token, userId: res.body.user?.id, email };
}

/** Seed a product with the given stock and return its id. */
function seedProduct(name, priceCents, stock) {
  const { lastInsertRowid } = db
    .prepare(
      'INSERT INTO products (name, description, category, price_cents, image, stock) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(name, 'Test product', 'test', priceCents, '', stock);
  return Number(lastInsertRowid);
}

/** Add a product to the authenticated user's cart via the API. */
async function addToCart(token, productId, quantity = 1) {
  return request(app)
    .post('/api/cart')
    .set('Authorization', `Bearer ${token}`)
    .send({ productId, quantity });
}

// ---------------------------------------------------------------------------
// Cleanup: remove all test data created by this suite
// ---------------------------------------------------------------------------

const createdUserEmails = [];
const createdProductIds = [];

afterAll(() => {
  // Delete users first — cascades to orders → order_items and cart_items via FK
  for (const email of createdUserEmails) {
    db.prepare('DELETE FROM users WHERE email = ?').run(email);
  }
  // Now safe to remove products (order_items referencing them are already gone)
  for (const id of createdProductIds) {
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
  }
});

// ---------------------------------------------------------------------------
// POST /api/orders — checkout
// ---------------------------------------------------------------------------

describe('POST /api/orders — checkout', () => {
  let token;
  let productId;

  beforeAll(async () => {
    const user = await registerUser('checkout');
    token = user.token;
    createdUserEmails.push(user.email);

    productId = seedProduct('Checkout Widget', 1999, 10);
    createdProductIds.push(productId);

    await addToCart(token, productId, 2);
  });

  it('happy path — creates order, returns 201 with order and line items', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ address: '123 Main Street, Springfield, IL 62701' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('order');
    const { order } = res.body;
    expect(order).toHaveProperty('id');
    expect(order).toHaveProperty('total_cents');
    expect(typeof order.total_cents).toBe('number');
    expect(order.total_cents).toBe(2 * 1999); // 2 × $19.99
    expect(order).toHaveProperty('address', '123 Main Street, Springfield, IL 62701');
    expect(order).toHaveProperty('status', 'placed');
    expect(Array.isArray(order.items)).toBe(true);
    expect(order.items).toHaveLength(1);
    expect(order.items[0]).toMatchObject({
      product_id: productId,
      quantity: 2,
      price_cents: 1999,
    });
  });

  it('happy path — stock is decremented after checkout', async () => {
    // Re-seed a fresh product so we can verify stock change independently
    const pid = seedProduct('Stock Widget', 500, 5);
    createdProductIds.push(pid);

    const user2 = await registerUser('stock-check');
    createdUserEmails.push(user2.email);

    await addToCart(user2.token, pid, 3);

    await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${user2.token}`)
      .send({ address: '456 Elm Avenue, Portland, OR 97201' });

    const product = db.prepare('SELECT stock FROM products WHERE id = ?').get(pid);
    expect(product.stock).toBe(2); // 5 − 3
  });

  it('happy path — cart is cleared after checkout', async () => {
    const pid = seedProduct('Cart Clear Widget', 300, 10);
    createdProductIds.push(pid);

    const user3 = await registerUser('cart-clear');
    createdUserEmails.push(user3.email);

    await addToCart(user3.token, pid, 1);

    await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${user3.token}`)
      .send({ address: '789 Oak Boulevard, Austin, TX 78701' });

    const cartRes = await request(app)
      .get('/api/cart')
      .set('Authorization', `Bearer ${user3.token}`);

    expect(cartRes.status).toBe(200);
    expect(cartRes.body.items).toHaveLength(0);
    expect(cartRes.body.count).toBe(0);
  });

  it('empty cart — returns 400 with descriptive error', async () => {
    // Use a fresh user with nothing in cart
    const emptyUser = await registerUser('empty-cart');
    createdUserEmails.push(emptyUser.email);

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${emptyUser.token}`)
      .send({ address: '123 Main Street, Springfield, IL 62701' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/cart is empty/i);
  });

  it('short address — returns 400 when address is fewer than 10 characters', async () => {
    const pid = seedProduct('Short Addr Widget', 100, 5);
    createdProductIds.push(pid);

    const user4 = await registerUser('short-addr');
    createdUserEmails.push(user4.email);

    await addToCart(user4.token, pid, 1);

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${user4.token}`)
      .send({ address: 'Short' }); // only 5 chars

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/at least 10 characters/i);
  });

  it('short address — returns 400 when address is missing entirely', async () => {
    const pid = seedProduct('No Addr Widget', 100, 5);
    createdProductIds.push(pid);

    const user5 = await registerUser('no-addr');
    createdUserEmails.push(user5.email);

    await addToCart(user5.token, pid, 1);

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${user5.token}`)
      .send({}); // no address field

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('requires auth — returns 401 when no token is provided', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ address: '123 Main Street, Springfield, IL 62701' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('requires auth — returns 401 when token is invalid', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', 'Bearer this.is.not.a.valid.token')
      .send({ address: '123 Main Street, Springfield, IL 62701' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });
});

// ---------------------------------------------------------------------------
// GET /api/orders — order history
// ---------------------------------------------------------------------------

describe('GET /api/orders — order history', () => {
  let token;
  let orderId;

  beforeAll(async () => {
    const user = await registerUser('history');
    token = user.token;
    createdUserEmails.push(user.email);

    const pid = seedProduct('History Widget', 750, 10);
    createdProductIds.push(pid);

    await addToCart(token, pid, 1);

    const checkoutRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ address: '100 History Lane, Chicago, IL 60601' });

    orderId = checkoutRes.body.order?.id;
  });

  it('returns 200 with an array of orders for the authenticated user', async () => {
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('orders');
    expect(Array.isArray(res.body.orders)).toBe(true);
    expect(res.body.orders.length).toBeGreaterThanOrEqual(1);
  });

  it('each order in the list includes id, total_cents, address, status, and items array', async () => {
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${token}`);

    const order = res.body.orders.find((o) => o.id === orderId);
    expect(order).toBeDefined();
    expect(order).toHaveProperty('id');
    expect(order).toHaveProperty('total_cents');
    expect(order).toHaveProperty('address');
    expect(order).toHaveProperty('status');
    expect(Array.isArray(order.items)).toBe(true);
  });

  it('does not return orders belonging to other users', async () => {
    // Create a second user with their own order
    const other = await registerUser('history-other');
    createdUserEmails.push(other.email);

    const pid2 = seedProduct('Other History Widget', 200, 5);
    createdProductIds.push(pid2);

    await addToCart(other.token, pid2, 1);
    const otherCheckout = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${other.token}`)
      .send({ address: '200 Other Street, Seattle, WA 98101' });

    const otherOrderId = otherCheckout.body.order?.id;

    // Fetch history as the first user — should NOT contain the other user's order
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${token}`);

    const ids = res.body.orders.map((o) => o.id);
    expect(ids).not.toContain(otherOrderId);
  });

  it('fresh user with no orders — returns 200 with an empty orders array', async () => {
    const freshUser = await registerUser('no-orders');
    createdUserEmails.push(freshUser.email);

    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${freshUser.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('orders');
    expect(Array.isArray(res.body.orders)).toBe(true);
    expect(res.body.orders).toHaveLength(0);
  });

  it('requires auth — returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/orders');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('requires auth — returns 401 when token is invalid', async () => {
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', 'Bearer bad.token.value');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });
});

// ---------------------------------------------------------------------------
// GET /api/orders/:id — single order
// ---------------------------------------------------------------------------

describe('GET /api/orders/:id — single order', () => {
  let token;
  let orderId;
  let productId;

  beforeAll(async () => {
    const user = await registerUser('single');
    token = user.token;
    createdUserEmails.push(user.email);

    productId = seedProduct('Single Order Widget', 1200, 10);
    createdProductIds.push(productId);

    await addToCart(token, productId, 2);

    const checkoutRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ address: '300 Single Road, Denver, CO 80201' });

    orderId = checkoutRes.body.order?.id;
  });

  it('returns 200 with the order and its line items for the owner', async () => {
    const res = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('order');
    const { order } = res.body;
    expect(order.id).toBe(orderId);
    expect(order).toHaveProperty('total_cents', 2 * 1200);
    expect(order).toHaveProperty('address', '300 Single Road, Denver, CO 80201');
    expect(order).toHaveProperty('status', 'placed');
    expect(Array.isArray(order.items)).toBe(true);
    expect(order.items).toHaveLength(1);
    expect(order.items[0]).toMatchObject({
      product_id: productId,
      quantity: 2,
      price_cents: 1200,
    });
  });

  it('order not found — returns 404 for a non-existent order id', async () => {
    const res = await request(app)
      .get('/api/orders/999999999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/not found/i);
  });

  it('order belongs to other user — returns 404 (not 403, to avoid leaking existence)', async () => {
    // Create another user with their own order
    const other = await registerUser('single-other');
    createdUserEmails.push(other.email);

    const pid3 = seedProduct('Other Single Widget', 500, 5);
    createdProductIds.push(pid3);

    await addToCart(other.token, pid3, 1);
    const otherCheckout = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${other.token}`)
      .send({ address: '400 Other Avenue, Miami, FL 33101' });

    const otherOrderId = otherCheckout.body.order?.id;

    // Try to fetch the other user's order as the first user
    const res = await request(app)
      .get(`/api/orders/${otherOrderId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('requires auth — returns 401 when no token is provided', async () => {
    const res = await request(app).get(`/api/orders/${orderId}`);

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('requires auth — returns 401 when token is invalid', async () => {
    const res = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', 'Bearer invalid.token.here');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });
});
