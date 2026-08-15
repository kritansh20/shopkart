import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api, formatPrice } from '../api';

export default function Orders() {
  const location = useLocation();
  const placedOrderId = location.state?.placedOrderId;

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/orders')
      .then(({ orders }) => setOrders(orders))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="muted">Loading your orders…</p>;
  if (error) return <p className="error">{error}</p>;

  return (
    <section>
      <h1>Your orders</h1>

      {placedOrderId && <p className="notice success">Order #{placedOrderId} placed. Thanks for shopping!</p>}

      {orders.length === 0 ? (
        <p className="muted">
          You have not placed any orders yet. <Link to="/products">Start shopping →</Link>
        </p>
      ) : (
        <ul className="order-list">
          {orders.map((order) => (
            <li key={order.id} className="card order">
              <div className="row space-between order-head">
                <div>
                  <strong>Order #{order.id}</strong>
                  <span className="muted small"> · {order.created_at} UTC</span>
                </div>
                <span className="pill">{order.status}</span>
              </div>

              <ul className="order-items">
                {order.items.map((item) => (
                  <li key={item.id}>
                    <span>
                      {item.quantity} × {item.name}
                    </span>
                    <span className="muted">{formatPrice(item.price_cents * item.quantity)}</span>
                  </li>
                ))}
              </ul>

              <p className="muted small">Ships to: {order.address}</p>
              <div className="row space-between">
                <span>Total</span>
                <strong className="price">{formatPrice(order.total_cents)}</strong>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
