import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, formatPrice } from '../api';
import { useAuth } from '../AuthContext';

export default function ProductDetail() {
  const { id } = useParams();
  const { user, setCartCount } = useAuth();

  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/products/${id}`)
      .then(({ product }) => setProduct(product))
      .catch((err) => setError(err.message));
  }, [id]);

  const addToCart = async () => {
    try {
      const { count } = await api('/cart', { method: 'POST', body: { productId: product.id, quantity } });
      setCartCount(count);
      setNotice(`Added ${quantity} × ${product.name} to your cart.`);
    } catch (err) {
      setNotice(err.message);
    }
  };

  if (error) return <p className="error">{error}</p>;
  if (!product) return <p className="muted">Loading…</p>;

  return (
    <section className="detail">
      <Link to="/products" className="small">
        ← Back to products
      </Link>

      <div className="detail-body">
        <div className="detail-thumb">{product.image}</div>

        <div>
          <h1>{product.name}</h1>
          <p className="pill">{product.category}</p>
          <p>{product.description}</p>
          <p className="price">{formatPrice(product.price_cents)}</p>
          <p className="muted small">{product.stock} in stock</p>

          {notice && <p className="notice">{notice}</p>}

          {product.stock === 0 ? (
            <p className="muted">This item is currently out of stock.</p>
          ) : user ? (
            <div className="row">
              <input
                type="number"
                min="1"
                max={product.stock}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                className="qty"
              />
              <button className="btn btn-primary" onClick={addToCart}>
                Add to cart
              </button>
            </div>
          ) : (
            <Link className="btn btn-primary" to="/login">
              Log in to buy
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
