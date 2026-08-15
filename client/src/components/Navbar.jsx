import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function Navbar() {
  const { user, logout, cartCount } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/products');
  };

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link to="/products" className="brand">
          🛒 ShopKart
        </Link>

        <nav className="nav-links">
          <NavLink to="/products">Products</NavLink>
          {user && (
            <>
              <NavLink to="/cart">
                Cart{cartCount > 0 && <span className="badge">{cartCount}</span>}
              </NavLink>
              <NavLink to="/orders">Orders</NavLink>
            </>
          )}
        </nav>

        <div className="nav-account">
          {user ? (
            <>
              <span className="muted">Hi, {user.name.split(' ')[0]}</span>
              <button className="btn btn-ghost" onClick={handleLogout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <Link className="btn btn-ghost" to="/login">
                Log in
              </Link>
              <Link className="btn btn-primary" to="/register">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
