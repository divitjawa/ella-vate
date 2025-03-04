import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import './Header.css';

function Header() {
  const { currentUser, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  
  return (
    <header className="header bg-light shadow-sm">
      <div className="container d-flex justify-content-between align-items-center py-2">
        <Link to="/" className="navbar-brand">
          <div className="logo-circle bg-primary"></div>
          <span>Ella-Vate</span>
        </Link>
        
        <nav className="nav">
          <ul className="nav">
            <li className="nav-item"><Link to="/" className="nav-link">Our Product</Link></li>
            {currentUser && (
              <>
                <li className="nav-item"><Link to="/dashboard" className="nav-link">Dashboard</Link></li>
                <li className="nav-item"><Link to="/saved-jobs" className="nav-link">Saved Jobs</Link></li>
              </>
            )}
            <li className="nav-item"><Link to="/about" className="nav-link">About</Link></li>
          </ul>
        </nav>
        
        {currentUser ? (
          <button className="btn btn-outline-primary" onClick={handleLogout}>Log Out</button>
        ) : (
          <Link to="/login" className="btn btn-primary">Sign In</Link>
        )}
      </div>
    </header>
  );
}

export default Header;
