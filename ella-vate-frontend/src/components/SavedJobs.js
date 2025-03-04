import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import './SavedJobs.css';

function SavedJobs() {
  const [savedJobs, setSavedJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const { currentUser } = useContext(AuthContext);
  
  useEffect(() => {
    // Fetch saved jobs when component mounts
    const fetchSavedJobs = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const token = localStorage.getItem('auth_token');
        
        const response = await fetch('http://localhost:5050/api/saved-jobs', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch saved jobs');
        }
        
        const data = await response.json();
        setSavedJobs(data);
      } catch (err) {
        console.error('Error fetching saved jobs:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    if (currentUser) {
      fetchSavedJobs();
    }
  }, [currentUser]);
  
  const removeSavedJob = async (jobId) => {
    // Implementation for removing a saved job would go here
    // This would require adding a DELETE endpoint in the backend
    alert('Remove job functionality would be implemented here');
  };
  
  if (loading) {
    return (
      <div className="saved-jobs-container">
        <h1>Saved Jobs</h1>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading saved jobs...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="saved-jobs-container">
      <h1>Saved Jobs</h1>
      
      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}
      
      {savedJobs.length === 0 ? (
        <div className="no-saved-jobs">
          <p>You haven't saved any jobs yet.</p>
          <Link to="/" className="btn btn-primary">Find Jobs</Link>
        </div>
      ) : (
        <div className="saved-jobs-list">
          {savedJobs.map((job) => (
            <div key={job.jobId} className="saved-job-card">
              <div className="saved-job-info">
                <h3 className="saved-job-title">{job.jobTitle}</h3>
                <p className="saved-job-company">{job.company}</p>
                <p className="saved-job-date">
                  Saved on {new Date(job.savedAt).toLocaleDateString()}
                </p>
                {job.matchScore && (
                  <div className="saved-job-score">
                    <span>Match Score: </span>
                    <span className="score-value">{job.matchScore.toFixed(2)}</span>
                  </div>
                )}
              </div>
              
              <div className="saved-job-actions">
                <button 
                  className="btn btn-remove"
                  onClick={() => removeSavedJob(job.jobId)}
                >
                  Remove
                </button>
                <Link to={`/jobs/${job.jobId}`} className="btn btn-view">View Details</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SavedJobs;
