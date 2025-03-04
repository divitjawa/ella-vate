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
    <header className="header">
      <div className="container header-container">
        <Link to="/" className="logo">
          <div className="logo-circle"></div>
          <span>Ella-Vate</span>
        </Link>
        
        <nav className="nav">
          <ul>
            <li><Link to="/">Our Product</Link></li>
            {currentUser && (
              <>
                <li><Link to="/dashboard">Dashboard</Link></li>
                <li><Link to="/saved-jobs">Saved Jobs</Link></li>
              </>
            )}
            <li><Link to="/about">About</Link></li>
          </ul>
        </nav>
        
        {currentUser ? (
          <button className="btn btn-logout" onClick={handleLogout}>Log Out</button>
        ) : (
          <Link to="/login" className="btn btn-login">Sign In</Link>
        )}
      </div>
    </header>
  );
}

export default Header;
