import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, formatPrice } from '../api';
import { useAuth } from '../AuthContext';

export default function Cart() {
  const { setCartCount } = useAuth();
  const navigate = useNavigate();

  const [cart, setCart] = useState({ items: [], total_cents: 0, count: 0 });
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [placing, setPlacing] = useState(false);

  const apply = (data) => {
    setCart(data);
    setCartCount(data.count);
  };

  useEffect(() => {
    api('/cart')
      .then(apply)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const changeQty = async (productId, quantity) => {
    setError('');
    try {
      apply(await api(`/cart/${productId}`, { method: 'PATCH', body: { quantity } }));
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (productId) => {
    setError('');
    try {
      apply(await api(`/cart/${productId}`, { method: 'DELETE' }));
    } catch (err) {
      setError(err.message);
    }
  };

  const checkout = async (e) => {
    e.preventDefault();
    setError('');
    setPlacing(true);
    try {
      const { order } = await api('/orders', { method: 'POST', body: { address } });
      setCartCount(0);
      navigate('/orders', { state: { placedOrderId: order.id } });
    } catch (err) {
      setError(err.message);
    } finally {
      setPlacing(false);
    }
  };

  if (loading) return <p className="muted">Loading your cart…</p>;

  return (
    <section>
      <h1>Your cart</h1>
      {error && <p className="error">{error}</p>}

      {cart.items.length === 0 ? (
        <p className="muted">
          Your cart is empty. <Link to="/products">Browse products →</Link>
        </p>
      ) : (
        <>
          <ul className="cart-list">
            {cart.items.map((item) => (
              <li key={item.id} className="card cart-row">
                <span className="cart-thumb">{item.image}</span>
                <div className="cart-info">
                  <strong>{item.name}</strong>
                  <span className="muted small">{formatPrice(item.price_cents)} each</span>
                </div>
                <div className="row">
                  <button className="btn btn-ghost" onClick={() => changeQty(item.product_id, item.quantity - 1)}>
                    −
                  </button>
                  <span className="qty-display">{item.quantity}</span>
                  <button className="btn btn-ghost" onClick={() => changeQty(item.product_id, item.quantity + 1)}>
                    +
                  </button>
                </div>
                <strong className="line-total">{formatPrice(item.price_cents * item.quantity)}</strong>
                <button className="btn btn-ghost danger" onClick={() => remove(item.product_id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>

          <div className="card checkout">
            <div className="row space-between">
              <span>Total</span>
              <strong className="price">{formatPrice(cart.total_cents)}</strong>
            </div>

            <form onSubmit={checkout}>
              <label>
                Delivery address
                <textarea
                  rows="3"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="221B Baker Street, London NW1 6XE"
                  required
                />
              </label>
              <button className="btn btn-primary btn-block" disabled={placing}>
                {placing ? 'Placing order…' : `Place order · ${formatPrice(cart.total_cents)}`}
              </button>
            </form>
          </div>
        </>
      )}
    </section>
  );
}
