import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import './Auth.css';

// Simple logo component directly in this file to avoid import issues
const ElegantLogo = () => {
  return (
    <div className="logo-1536">
      <div className="logo-circle">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="white"
          width="18"
          height="18"
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

function Login() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  
  const { login, loading, error } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const { email, password } = formData;
    const success = await login(email, password);
    
    if (success) {
      navigate('/');
    }
  };
  
  return (
    <div className="auth-container">
      <div className="auth-form-container">
        <div className="auth-logo-centered">
          <ElegantLogo />
        </div>
        
        <h1 className="auth-title">Welcome Back</h1>
        <p className="auth-subtitle">Sign in to continue your job search</p>
        
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              className="form-control"
              value={formData.email}
              onChange={handleChange}
              placeholder="your@email.com"
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              className="form-control"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
            />
          </div>
          
          {error && <div className="auth-error">{error}</div>}
          
          <button 
            type="submit" 
            className="btn btn-primary w-100" 
            disabled={loading}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
        
        <p className="auth-redirect">
          Don't have an account? <Link to="/register" className="signup-link">Sign Up</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;