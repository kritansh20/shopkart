import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../app.js';
import { db } from '../db.js';

// ── Seed data ────────────────────────────────────────────────────────────────

let insertedIds = [];

beforeAll(() => {
  const insert = db.prepare(
    `INSERT INTO products (name, description, category, price_cents, image, stock)
     VALUES (@name, @description, @category, @price_cents, @image, @stock)`
  );

  const seedProducts = [
    { name: 'Alpha Mug',      description: 'A ceramic mug',       category: 'kitchen',     price_cents: 1200, image: '', stock: 10 },
    { name: 'Beta Mug',       description: 'A glass mug',         category: 'kitchen',     price_cents: 800,  image: '', stock: 5  },
    { name: 'Gamma Notebook', description: 'A lined notebook',    category: 'stationery',  price_cents: 500,  image: '', stock: 20 },
    { name: 'Delta Pen',      description: 'A ballpoint pen',     category: 'stationery',  price_cents: 150,  image: '', stock: 50 },
    { name: 'Epsilon Lamp',   description: 'A desk lamp',         category: 'electronics', price_cents: 4500, image: '', stock: 3  },
  ];

  const insertMany = db.transaction((products) => {
    for (const p of products) {
      const info = insert.run(p);
      insertedIds.push(info.lastInsertRowid);
    }
  });

  insertMany(seedProducts);
});

afterAll(() => {
  if (insertedIds.length) {
    const placeholders = insertedIds.map(() => '?').join(',');
    db.prepare(`DELETE FROM products WHERE id IN (${placeholders})`).run(...insertedIds);
  }
  insertedIds = [];
});

// ── GET /api/products ─────────────────────────────────────────────────────────

describe('GET /api/products', () => {
  it('returns 200 with a products array containing all seeded items', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('products');
    expect(Array.isArray(res.body.products)).toBe(true);
    // At least the 5 seeded products must be present
    const names = res.body.products.map((p) => p.name);
    expect(names).toEqual(expect.arrayContaining(['Alpha Mug', 'Beta Mug', 'Gamma Notebook', 'Delta Pen', 'Epsilon Lamp']));
  });

  it('each product has the expected fields (id, name, description, category, price_cents, image, stock)', async () => {
    const res = await request(app).get('/api/products');
    const product = res.body.products.find((p) => p.name === 'Alpha Mug');
    expect(product).toBeDefined();
    expect(product).toMatchObject({
      name: 'Alpha Mug',
      description: 'A ceramic mug',
      category: 'kitchen',
      price_cents: 1200,
      stock: 10,
    });
    expect(product).toHaveProperty('id');
  });

  it('?q= search filter returns only products whose name or description matches', async () => {
    const res = await request(app).get('/api/products?q=mug');
    expect(res.status).toBe(200);
    const names = res.body.products.map((p) => p.name);
    expect(names).toEqual(expect.arrayContaining(['Alpha Mug', 'Beta Mug']));
    expect(names).not.toContain('Gamma Notebook');
    expect(names).not.toContain('Epsilon Lamp');
  });

  it('?q= search is case-insensitive', async () => {
    const res = await request(app).get('/api/products?q=MUG');
    expect(res.status).toBe(200);
    const names = res.body.products.map((p) => p.name);
    expect(names).toEqual(expect.arrayContaining(['Alpha Mug', 'Beta Mug']));
  });

  it('?q= search matches against description field', async () => {
    const res = await request(app).get('/api/products?q=ballpoint');
    expect(res.status).toBe(200);
    const names = res.body.products.map((p) => p.name);
    expect(names).toContain('Delta Pen');
  });

  it('?q= with no matches returns an empty products array', async () => {
    const res = await request(app).get('/api/products?q=zzznomatch999');
    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(0);
  });

  it('?category= filter returns only products in that category', async () => {
    const res = await request(app).get('/api/products?category=kitchen');
    expect(res.status).toBe(200);
    const names = res.body.products.map((p) => p.name);
    expect(names).toEqual(expect.arrayContaining(['Alpha Mug', 'Beta Mug']));
    expect(names).not.toContain('Gamma Notebook');
    expect(names).not.toContain('Epsilon Lamp');
  });

  it('?category=all returns all products (no category filter applied)', async () => {
    const res = await request(app).get('/api/products?category=all');
    expect(res.status).toBe(200);
    const names = res.body.products.map((p) => p.name);
    expect(names).toEqual(expect.arrayContaining(['Alpha Mug', 'Gamma Notebook', 'Epsilon Lamp']));
  });

  it('?category= with unknown value returns empty products array', async () => {
    const res = await request(app).get('/api/products?category=nonexistent');
    expect(res.status).toBe(200);
    // None of the seeded products belong to this category
    const seededNames = ['Alpha Mug', 'Beta Mug', 'Gamma Notebook', 'Delta Pen', 'Epsilon Lamp'];
    const returnedNames = res.body.products.map((p) => p.name);
    const overlap = returnedNames.filter((n) => seededNames.includes(n));
    expect(overlap).toHaveLength(0);
  });

  it('?q= and ?category= can be combined', async () => {
    const res = await request(app).get('/api/products?q=mug&category=kitchen');
    expect(res.status).toBe(200);
    const names = res.body.products.map((p) => p.name);
    expect(names).toEqual(expect.arrayContaining(['Alpha Mug', 'Beta Mug']));
    expect(names).not.toContain('Gamma Notebook');
  });

  it('?sort=price_asc returns products ordered by price ascending', async () => {
    const res = await request(app).get('/api/products?sort=price_asc');
    expect(res.status).toBe(200);
    const prices = res.body.products.map((p) => p.price_cents);
    const sorted = [...prices].sort((a, b) => a - b);
    expect(prices).toEqual(sorted);
  });

  it('?sort=price_desc returns products ordered by price descending', async () => {
    const res = await request(app).get('/api/products?sort=price_desc');
    expect(res.status).toBe(200);
    const prices = res.body.products.map((p) => p.price_cents);
    const sorted = [...prices].sort((a, b) => b - a);
    expect(prices).toEqual(sorted);
  });

  it('?sort=name_asc returns products ordered alphabetically by name', async () => {
    const res = await request(app).get('/api/products?sort=name_asc');
    expect(res.status).toBe(200);
    const names = res.body.products.map((p) => p.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });

  it('unknown sort value falls back to default (id ASC) order', async () => {
    const res = await request(app).get('/api/products?sort=invalid_sort');
    expect(res.status).toBe(200);
    const ids = res.body.products.map((p) => p.id);
    const sorted = [...ids].sort((a, b) => a - b);
    expect(ids).toEqual(sorted);
  });
});

// ── GET /api/products/categories ─────────────────────────────────────────────

describe('GET /api/products/categories', () => {
  it('returns 200 with a categories array', async () => {
    const res = await request(app).get('/api/products/categories');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('categories');
    expect(Array.isArray(res.body.categories)).toBe(true);
  });

  it('categories array contains all seeded categories', async () => {
    const res = await request(app).get('/api/products/categories');
    expect(res.body.categories).toEqual(expect.arrayContaining(['kitchen', 'stationery', 'electronics']));
  });

  it('categories array contains only distinct values (no duplicates)', async () => {
    const res = await request(app).get('/api/products/categories');
    const cats = res.body.categories;
    const unique = [...new Set(cats)];
    expect(cats).toHaveLength(unique.length);
  });

  it('categories are returned in alphabetical order', async () => {
    const res = await request(app).get('/api/products/categories');
    const cats = res.body.categories;
    const sorted = [...cats].sort((a, b) => a.localeCompare(b));
    expect(cats).toEqual(sorted);
  });
});

// ── GET /api/products/:id ─────────────────────────────────────────────────────

describe('GET /api/products/:id', () => {
  it('returns 200 with the correct product for a known id', async () => {
    const id = insertedIds[0]; // Alpha Mug
    const res = await request(app).get(`/api/products/${id}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('product');
    expect(res.body.product).toMatchObject({
      id,
      name: 'Alpha Mug',
      category: 'kitchen',
      price_cents: 1200,
    });
  });

  it('returned product object has all expected fields', async () => {
    const id = insertedIds[2]; // Gamma Notebook
    const res = await request(app).get(`/api/products/${id}`);
    expect(res.status).toBe(200);
    const p = res.body.product;
    expect(p).toHaveProperty('id');
    expect(p).toHaveProperty('name');
    expect(p).toHaveProperty('description');
    expect(p).toHaveProperty('category');
    expect(p).toHaveProperty('price_cents');
    expect(p).toHaveProperty('image');
    expect(p).toHaveProperty('stock');
  });

  it('returns 404 with error message for an unknown id', async () => {
    const res = await request(app).get('/api/products/999999999');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 404 for id 0', async () => {
    const res = await request(app).get('/api/products/0');
    expect(res.status).toBe(404);
  });
});

// ── Unknown sort value falls back to id-ascending ─────────────────────────────

describe('GET /api/products — unknown sort value', () => {
  it('?sort=unknown falls back to id-ascending order', async () => {
    const res = await request(app).get('/api/products?sort=unknown_value');
    expect(res.status).toBe(200);
    const ids = res.body.products.map((p) => p.id);
    const sorted = [...ids].sort((a, b) => a - b);
    expect(ids).toEqual(sorted);
  });
});
