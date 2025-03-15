import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import './Header.css';

// 1536Logo component (renamed from EllaVateLogo)
const Logo1536 = () => {
  return (
    <div className="logo-1536">
      <div className="logo-circle">
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 24 24" 
          fill="white" 
          className="logo-icon"
        >
          <path 
            d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" 
            strokeWidth="2"
            stroke="white"
            fill="none"
          />
        </svg>
      </div>
      <h1 className="logo-text">1536</h1>
    </div>
  );
};

function Header() {
  const { currentUser, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  
  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="logo">
          <Logo1536 />
        </Link>
        
        <nav className="nav">
          <ul>
            <li><Link to="/about">About</Link></li>
            {currentUser && (
              <>
                <li><Link to="/">New Search</Link></li>
                <li><Link to="/matches">Job Matches</Link></li>
                <li><Link to="/saved-jobs">Saved Jobs</Link></li>
              </>
            )}
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

export { Logo1536 }; // Export renamed component
export default Header;