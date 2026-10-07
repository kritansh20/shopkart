/**
 * Auth route tests — POST /api/auth/register, POST /api/auth/login, GET /api/auth/me
 *
 * Each describe block gets its own in-memory DB via createTestApp(), so tests
 * are fully isolated and never touch the production SQLite file.
 */
import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import { createTestApp, signTestToken } from './createTestApp.js';

// ── POST /api/auth/register ───────────────────────────────────────────────────
describe('POST /api/auth/register', () => {
  let app;

  beforeAll(() => {
    ({ app } = createTestApp());
  });

  it('happy path — creates user and returns JWT + public user object', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Alice', email: 'alice@example.com', password: 'secret123' });

    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.length).toBeGreaterThan(0);
    expect(res.body.user).toMatchObject({
      name: 'Alice',
      email: 'alice@example.com',
    });
    expect(typeof res.body.user.id).toBe('number');
    // password must NOT be exposed
    expect(res.body.user.password).toBeUndefined();
  });

  it('missing fields — returns 400 when name is absent', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'bob@example.com', password: 'secret123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('missing fields — returns 400 when email is absent', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Bob', password: 'secret123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('missing fields — returns 400 when password is absent', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Bob', email: 'bob@example.com' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('invalid email — returns 400 for malformed email address', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Bob', email: 'not-an-email', password: 'secret123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/i);
  });

  it('short password — returns 400 when password is fewer than 6 characters', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Bob', email: 'bob@example.com', password: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/6 characters/i);
  });

  it('duplicate email — returns 409 when email is already registered', async () => {
    // First registration succeeds
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Carol', email: 'carol@example.com', password: 'secret123' });

    // Second registration with same email must fail
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Carol2', email: 'carol@example.com', password: 'secret456' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  let app;

  beforeAll(async () => {
    ({ app } = createTestApp());
    // Seed one user for login tests
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Dave', email: 'dave@example.com', password: 'mypassword' });
  });

  it('happy path — returns JWT and public user object for valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'dave@example.com', password: 'mypassword' });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.length).toBeGreaterThan(0);
    expect(res.body.user).toMatchObject({
      name: 'Dave',
      email: 'dave@example.com',
    });
    expect(res.body.user.password).toBeUndefined();
  });

  it('wrong password — returns 401 with generic error message', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'dave@example.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/incorrect email or password/i);
  });

  it('unknown email — returns 401 with generic error message (no email enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'mypassword' });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/incorrect email or password/i);
  });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
describe('GET /api/auth/me', () => {
  let app;
  let db;
  let validToken;

  beforeAll(async () => {
    ({ app, db } = createTestApp());
    // Register a user and capture the token
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Eve', email: 'eve@example.com', password: 'evepassword' });
    validToken = res.body.token;
  });

  it('valid JWT — returns 200 with the authenticated user profile', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      name: 'Eve',
      email: 'eve@example.com',
    });
    expect(typeof res.body.user.id).toBe('number');
    expect(res.body.user.password).toBeUndefined();
  });

  it('no token — returns 401 when Authorization header is missing', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/missing authentication token/i);
  });

  it('invalid token — returns 401 for a tampered or expired JWT', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer this.is.not.a.valid.jwt');

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid or expired token/i);
  });
});
