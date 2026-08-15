import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatPrice } from '../api';
import { useAuth } from '../AuthContext';

export default function Products() {
  const { user, setCartCount } = useAuth();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    api('/products/categories').then(({ categories }) => setCategories(categories)).catch(() => {});
  }, []);

  // Debounced so typing in the search box does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (category !== 'all') params.set('category', category);
      if (sort) params.set('sort', sort);

      setLoading(true);
      api(`/products?${params}`)
        .then(({ products }) => setProducts(products))
        .catch((err) => setNotice(err.message))
        .finally(() => setLoading(false));
    }, 250);

    return () => clearTimeout(timer);
  }, [q, category, sort]);

  const addToCart = async (product) => {
    try {
      const { count } = await api('/cart', { method: 'POST', body: { productId: product.id, quantity: 1 } });
      setCartCount(count);
      setNotice(`Added ${product.name} to your cart.`);
    } catch (err) {
      setNotice(err.message);
    }
  };

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Products</h1>
          <p className="muted">Search, filter by category and sort by price.</p>
        </div>
      </div>

      <div className="toolbar">
        <input
          className="search"
          placeholder="Search products…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="">Default order</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="name_asc">Name: A–Z</option>
        </select>
      </div>

      {notice && <p className="notice">{notice}</p>}

      {loading ? (
        <p className="muted">Loading products…</p>
      ) : products.length === 0 ? (
        <p className="muted">No products match those filters.</p>
      ) : (
        <div className="grid">
          {products.map((p) => (
            <article key={p.id} className="card product">
              <Link to={`/products/${p.id}`} className="product-thumb">
                {p.image}
              </Link>
              <h3>
                <Link to={`/products/${p.id}`}>{p.name}</Link>
              </h3>
              <p className="muted small">{p.description}</p>
              <div className="product-foot">
                <strong>{formatPrice(p.price_cents)}</strong>
                {p.stock === 0 ? (
                  <span className="muted small">Out of stock</span>
                ) : user ? (
                  <button className="btn btn-primary" onClick={() => addToCart(p)}>
                    Add to cart
                  </button>
                ) : (
                  <Link className="btn btn-ghost" to="/login">
                    Log in to buy
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
