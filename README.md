# 🛒 ShopKart

A small but complete e-commerce demo — Express + SQLite on the back, React + Vite on the front,
with JWT login and three self-contained features.

## Stack

| Layer    | Tech                                                        |
| -------- | ----------------------------------------------------------- |
| Backend  | Node + Express, SQLite (`better-sqlite3`), JWT, bcrypt       |
| Frontend | React 18, React Router, Vite                                 |
| Styling  | Hand-written CSS (no framework)                              |

## Features

**Login / authentication** — register or log in, passwords hashed with bcrypt, sessions carried by a
JWT stored in `localStorage`. Protected routes redirect signed-out visitors to `/login` and send them
back where they were headed once they authenticate.

Then three separate features on top of it:

1. **Product catalog** — browse a seeded catalog with debounced free-text search, a category filter,
   price/name sorting, and a per-product detail page.
2. **Shopping cart** — per-user server-side cart: add items, change quantities inline, remove them.
   Stock is validated on every write, so you cannot add more than exists.
3. **Checkout & order history** — turn the cart into an order inside a single SQL transaction
   (writes the order, decrements stock, clears the cart), then review past orders with their line
   items, delivery address and totals.

## Running it locally

Requires Node 18+.

```bash
git clone https://github.com/kritansh20/shopkart.git
cd shopkart

npm install            # root (concurrently)
npm run install:all    # server + client dependencies
npm run seed --prefix server

npm run dev            # starts both servers
```

- Frontend → <http://localhost:5173>
- API → <http://localhost:4000>

Vite proxies `/api/*` to the backend, so there is no API base URL to configure.

### Demo account

```
demo@shopkart.dev / demo1234
```

The login form is pre-filled with it. You can also register a fresh account.

## Configuration

Everything has a working default, so no `.env` is needed for local development. To override, copy
`server/env.example` to `server/.env`:

| Variable        | Default                 | Purpose                       |
| --------------- | ----------------------- | ----------------------------- |
| `PORT`          | `4000`                  | API port                      |
| `JWT_SECRET`    | dev-only fallback       | Token signing secret          |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Allowed CORS origin           |

> The default `JWT_SECRET` is a hardcoded development fallback. Set a real one before deploying
> this anywhere that matters.

## Project layout

```
shopkart/
├── server/
│   ├── src/
│   │   ├── index.js          Express app + route mounting
│   │   ├── db.js             SQLite connection + schema
│   │   ├── auth.js           JWT signing and the requireAuth middleware
│   │   ├── seed.js           Seeds 12 products + the demo user
│   │   └── routes/
│   │       ├── auth.js       register / login / me
│   │       ├── products.js   catalog, search, categories
│   │       ├── cart.js       per-user cart CRUD
│   │       └── orders.js     checkout (transactional) + history
│   └── data/                 SQLite file, created at runtime (gitignored)
└── client/
    └── src/
        ├── api.js            fetch wrapper, token storage, price formatting
        ├── AuthContext.jsx   session + cart-count state
        ├── components/       Navbar, ProtectedRoute
        └── pages/            Login, Register, Products, ProductDetail, Cart, Orders
```

## API

| Method | Endpoint                 | Auth | Description                     |
| ------ | ------------------------ | :--: | ------------------------------- |
| POST   | `/api/auth/register`     |  –   | Create an account, returns JWT  |
| POST   | `/api/auth/login`        |  –   | Log in, returns JWT             |
| GET    | `/api/auth/me`           |  ✓   | Current user                    |
| GET    | `/api/products`          |  –   | List; `?q=&category=&sort=`     |
| GET    | `/api/products/categories` | –  | Distinct categories             |
| GET    | `/api/products/:id`      |  –   | Single product                  |
| GET    | `/api/cart`              |  ✓   | Current cart                    |
| POST   | `/api/cart`              |  ✓   | Add item                        |
| PATCH  | `/api/cart/:productId`   |  ✓   | Set quantity (`0` removes)      |
| DELETE | `/api/cart/:productId`   |  ✓   | Remove item                     |
| POST   | `/api/orders`            |  ✓   | Check out the cart              |
| GET    | `/api/orders`            |  ✓   | Order history                   |
| GET    | `/api/orders/:id`        |  ✓   | Single order                    |

## Notes & limitations

This is a demo, not a production storefront:

- Tokens live in `localStorage`, which is XSS-readable — a real app would prefer httpOnly cookies.
- There is no payment integration; checkout just records the order.
- There are no admin routes; the catalog is managed through the seed script.
- No automated test suite yet.
