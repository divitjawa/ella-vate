import React, { useState } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Header from './components/Header';
import UserForm from './components/UserForm';
import JobMatches from './components/JobMatches';
import Login from './components/Login';
import Register from './components/Register';
import SavedJobs from './components/SavedJobs';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import './App.css';

function App() {
  const [userData, setUserData] = useState(null);
  const [jobMatches, setJobMatches] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Handle form submission and API call
  const handleSubmitProfile = async (formData) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Add auth token to request if available
      const token = localStorage.getItem('auth_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      
      const response = await fetch('http://localhost:5050/api/profile', {
        method: 'POST',
        headers,
        body: formData, // FormData already contains the file and form fields
      });
      
      if (!response.ok) {
        throw new Error('Failed to process profile');
      }
      
      const data = await response.json();
      setUserData(data.profile);
      setJobMatches(data.matches);
      setIsLoading(false);
      
      return true; // Return success to trigger navigation
    } catch (err) {
      console.error('Error submitting profile:', err);
      setError(err.message);
      setIsLoading(false);
      return false;
    }
  };

  return (
    <AuthProvider>
      <Router>
        <div className="app">
          <Header />
          
          <div className="container">
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              
              {/* Protected routes */}
              <Route element={<ProtectedRoute />}>
                <Route 
                  path="/" 
                  element={
                    <UserForm 
                      onSubmit={handleSubmitProfile} 
                      isLoading={isLoading} 
                      error={error} 
                    />
                  } 
                />
                
                <Route 
                  path="/matches" 
                  element={
                    userData ? (
                      <JobMatches 
                        userData={userData} 
                        jobMatches={jobMatches} 
                      />
                    ) : (
                      <Navigate to="/" replace />
                    )
                  } 
                />
                
                <Route path="/saved-jobs" element={<SavedJobs />} />
              </Route>
              
              {/* Redirect any unknown routes to home */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
