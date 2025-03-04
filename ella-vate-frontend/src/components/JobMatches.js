import React, { useState, useContext } from 'react';
import AuthContext from '../context/AuthContext';
import CoverLetterGenerator from './CoverLetterGenerator';
import { Tooltip } from 'react-tooltip';
import './JobMatches.css';
import job_logo_placeholder from '../assets/job_logo_placeholder.jpg';

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
                  <img src={job_logo_placeholder} alt={job.company} />
                </div>
                
                <div className="job-info">
                  <h3 className="job-title" data-tip="Job Title">{job.jobTitle}</h3>
                  <p className="job-company" data-tip="Company">{job.company}</p>
                  <p className="job-location" data-tip="Location">{job.location}</p>
                  <p className="job-salary" data-tip="Salary">{job.salary}</p>
                  
                  <div className="job-match-score" data-tip="Match Score">
                    <span className="match-arrow">↑</span>
                    <span className="match-score">{job.matchScore.toFixed(2)}</span>
                  </div>
                </div>
                
                <div className="job-actions">
                  <button className="btn btn-save" onClick={() => saveJob(job)} data-tip="Save Job">
                    <span className="icon-bookmark">Save Job</span>
                  </button>
                  
                  <button className="btn btn-details" onClick={() => toggleJobDetails(job)} data-tip="View Details">
                    Details
                  </button>
                  
                  <a href={job.applyLink} target="_blank" rel="noopener noreferrer" className="btn btn-apply" data-tip="Apply for Job">
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
      
      <Tooltip />
    </div>
  );
}

export default JobMatches;
