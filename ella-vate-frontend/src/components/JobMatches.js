import React, { useState, useContext } from 'react';
import AuthContext from '../context/AuthContext';
import CoverLetterGenerator from './CoverLetterGenerator';
import './JobMatches.css';

function JobMatches({ userData, jobMatches }) {
  const [selectedJob, setSelectedJob] = useState(null);
  const [savedJobs, setSavedJobs] = useState([]);
  const { currentUser } = useContext(AuthContext);
  
  // Toggle job details and cover letter generator
  const toggleJobDetails = (job) => {
    if (selectedJob && selectedJob.jobTitle === job.jobTitle && selectedJob.company === job.company) {
      setSelectedJob(null);
    } else {
      setSelectedJob(job);
    }
  };
  
  // Save job to user profile
  const saveJob = async (job) => {
    if (!currentUser) {
      return;
    }
    
    try {
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch('http://localhost:5050/api/saved-jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          jobId: job.id || `job_${Date.now()}`,
          jobTitle: job.jobTitle,
          company: job.company,
          matchScore: job.matchScore,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save job');
      }
      
      const data = await response.json();
      setSavedJobs(data.savedJobs);
      
      // Show success message
      alert('Job saved successfully!');
    } catch (error) {
      console.error('Error saving job:', error);
    }
  };
  
  return (
    <div className="job-matches-container">
      <h1 className="job-matches-title">My Job Matches</h1>
      <p className="job-matches-count">1 of {jobMatches.length}</p>
      
      <div className="job-list">
        {jobMatches.length > 0 ? (
          jobMatches.map((job, index) => (
            <div key={index} className="job-card">
              <div className="job-card-content">
                <div className="job-logo">
                  <img src={`https://via.placeholder.com/50?text=${job.company.charAt(0)}`} alt={job.company} />
                </div>
                
                <div className="job-info">
                  <h3 className="job-title">{job.jobTitle}</h3>
                  <p className="job-company">{job.company}</p>
                  <p className="job-location">{job.location}</p>
                  <p className="job-salary">{job.salary}</p>
                  
                  <div className="job-match-score">
                    <span className="match-arrow">↑</span>
                    <span className="match-score">{job.matchScore.toFixed(10)}</span>
                  </div>
                </div>
                
                <div className="job-actions">
                  <button className="btn btn-save" onClick={() => saveJob(job)}>
                    <span className="icon-bookmark"></span>
                  </button>
                  
                  <button className="btn btn-details" onClick={() => toggleJobDetails(job)}>
                    Details
                  </button>
                  
                  <a href={job.applyLink} target="_blank" rel="noopener noreferrer" className="btn btn-apply">
                    Apply
                  </a>
                </div>
              </div>
              
              {selectedJob && selectedJob.jobTitle === job.jobTitle && selectedJob.company === job.company && (
                <div className="job-details">
                  <div className="job-description">
                    <h4>Job Description</h4>
                    <p>{job.description || 'No description available'}</p>
                  </div>
                  
                  <CoverLetterGenerator job={job} resumeText={userData.resumeText} />
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="no-matches">
            <p>No matching jobs found. Try adjusting your profile or uploading a different resume.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default JobMatches;
