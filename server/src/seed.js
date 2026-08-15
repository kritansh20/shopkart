import bcrypt from 'bcryptjs';
import { db } from './db.js';

const PRODUCTS = [
  ['Aeropress Go', 'Portable espresso-style coffee press that packs into its own mug.', 'kitchen', 4900, '☕', 24],
  ['Burr Grinder', 'Hand-cranked conical burr grinder with 40 grind settings.', 'kitchen', 7200, '⚙️', 15],
  ['Cast Iron Skillet', 'Pre-seasoned 10-inch skillet. Oven safe to 260°C.', 'kitchen', 3800, '🍳', 30],
  ['Mechanical Keyboard', '75% hot-swappable board with tactile browns and PBT caps.', 'desk', 12900, '⌨️', 12],
  ['Desk Lamp', 'Aluminium arm lamp with adjustable colour temperature.', 'desk', 5400, '💡', 20],
  ['Monitor Riser', 'Solid oak riser with a drawer for cables and notebooks.', 'desk', 6600, '🖥️', 18],
  ['Merino Socks', 'Three-pack of cushioned merino wool crew socks.', 'apparel', 2800, '🧦', 60],
  ['Canvas Tote', 'Heavyweight 16oz canvas tote with an inner pocket.', 'apparel', 2200, '👜', 45],
  ['Rain Shell', 'Packable 2.5-layer waterproof shell with taped seams.', 'apparel', 15900, '🧥', 9],
  ['Pocket Notebook', 'Dot-grid notebook, 90gsm paper, lies flat when open.', 'stationery', 1400, '📓', 80],
  ['Fountain Pen', 'Fine-nib starter fountain pen with a converter included.', 'stationery', 3200, '🖊️', 25],
  ['Sticker Pack', 'Twelve die-cut vinyl stickers, weatherproof.', 'stationery', 900, '✨', 100],
];

const seed = db.transaction(() => {
  const existing = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
  if (existing > 0) {
    console.log(`Products table already has ${existing} rows — skipping product seed.`);
  } else {
    const insert = db.prepare(
      'INSERT INTO products (name, description, category, price_cents, image, stock) VALUES (?, ?, ?, ?, ?, ?)'
    );
    for (const p of PRODUCTS) insert.run(...p);
    console.log(`Seeded ${PRODUCTS.length} products.`);
  }

  const demoEmail = 'demo@shopkart.dev';
  if (!db.prepare('SELECT 1 FROM users WHERE email = ?').get(demoEmail)) {
    db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)').run(
      'Demo User',
      demoEmail,
      bcrypt.hashSync('demo1234', 10)
    );
    console.log(`Seeded demo account: ${demoEmail} / demo1234`);
  } else {
    console.log('Demo account already exists — skipping.');
  }
});

seed();
