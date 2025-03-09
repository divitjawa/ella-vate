import React, { useState, useContext, useEffect } from 'react';
import AuthContext from '../context/AuthContext';
import CoverLetterGenerator from './CoverLetterGenerator';
import { Tooltip } from 'react-tooltip';
import './JobMatches.css';
import job_logo_placeholder from '../assets/job_logo_placeholder.jpg';
import API_ENDPOINTS from '../config';

function JobMatches({ userData, jobMatches }) {
  const [selectedJob, setSelectedJob] = useState(null);
  const [savedJobs, setSavedJobs] = useState([]);
  const [showCoverLetter, setShowCoverLetter] = useState(false); // controls child mount
  const { currentUser } = useContext(AuthContext);

  useEffect(() => {
    console.log("JobMatches userData:", userData);
    console.log("Resume text available:", userData?.resumeText ? "Yes" : "No");
  }, [userData]);

  
  // Toggle job details
  const toggleJobDetails = (job) => {
    if (selectedJob && selectedJob.id === job.id) {
      setSelectedJob(null);
      setShowCoverLetter(false);
    } else {
      setSelectedJob(job);
      setShowCoverLetter(false);
    }
  };
  
  // Immediately mount the CoverLetterGenerator once clicked
  const handleGenerateCoverLetter = () => {
    setShowCoverLetter(true);
  };
  
  // Save job
  const saveJob = async (job) => {
    if (!currentUser) return;
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(API_ENDPOINTS.SAVED_JOBS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
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
      alert('Job saved successfully!');
    } catch (error) {
      console.error('Error saving job:', error);
    }
  };

  // Helper for match score color
  function getScoreColorClass(score) {
    if (score >= 0.8) return 'excellent';
    if (score >= 0.65) return 'good';
    if (score >= 0.5) return 'moderate';
    return 'low';
  };

  // Format remote status display text
  const formatRemoteStatus = (remote) => {
    if (!remote) return 'On-site';
    if (remote === 'yes') return 'Remote';
    if (remote === 'hybrid') return 'Hybrid';
    if (remote === 'no') return 'No';
    return remote;
  };

  return (
    <div className="job-matches-container">
      <div className="job-matches-header">
        <div className="header-content">
          <h1 className="job-matches-title">Matched Opportunities</h1>
          <div className="job-matches-subtitle">
            We found <span className="highlight">{jobMatches.length}</span> positions that match your profile
          </div>
        </div>
      </div>
      
      <div className="job-list">
        {jobMatches.length > 0 ? (
          jobMatches.map((job, index) => (
            <div key={index} className={`job-card ${selectedJob && selectedJob.id === job.id ? 'expanded' : ''}`}>
              <div className="job-card-content">
                <div className="job-card-grid">
                  {/* Left Column */}
                  <div className="job-info-column">
                    <div className="job-primary-info">
                      <div className="job-logo">
                        <img src={job_logo_placeholder} alt={job.company} />
                      </div>
                      
                      <div className="job-headline">
                        <h3 className="job-title">{job.jobTitle}</h3>
                        <p className="job-company">{job.company}</p>
                        {job.location && <p className="job-location">{job.location}</p>}
                        
                        <div className="job-details-list">
                          {job.salary && (
                            <div className="job-detail-item">
                              <span className="detail-label">Salary:</span>
                              <span className="detail-value">
                                {job.salary.toLowerCase().includes('not specified')
                                  ? job.salary
                                  : job.salary}
                              </span>
                            </div>
                          )}
                          
                          {job.postedDate && (
                            <div className="job-detail-item">
                              <span className="detail-label">Posted:</span>
                              <span className="detail-value">{job.postedDate}</span>
                            </div>
                          )}
                          
                          {job.remote && (
                            <div className="job-detail-item">
                              <span className="detail-label">Remote:</span>
                              <span className="detail-value">{formatRemoteStatus(job.remote)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Right Column */}
                  <div className="job-match-column">
                    <div className="job-match-info">
                      <div className="match-score-circle">
                        <svg viewBox="0 0 36 36" className="circular-chart">
                          <path className="circle-bg"
                            d="M18 2.0845
                              a 15.9155 15.9155 0 0 1 0 31.831
                              a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                          <path
                            className={`circle ${getScoreColorClass(job.matchScore)}`}
                            strokeDasharray={`${job.matchScore * 100}, 100`}
                            d="M18 2.0845
                              a 15.9155 15.9155 0 0 1 0 31.831
                              a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                          <text x="18" y="20.35" className="percentage">
                            {Math.round(job.matchScore * 100)}%
                          </text>
                        </svg>
                        <div className="match-label">Match</div>
                      </div>
                      
                      <div className="detailed-scores">
                        {/* Skills Match (formerly Resume Match) */}
                        {job.skillsMatch !== undefined && (
                          <div className="score-item">
                            <div className="score-label">Skills Match</div>
                            <div className="score-bar-container">
                              <div 
                                className="score-bar skills-score"
                                style={{ width: `${Math.min(job.skillsMatch * 100, 100)}%` }}
                              ></div>
                            </div>
                            <div className="score-value">
                              {Math.round(job.skillsMatch * 100)}%
                            </div>
                          </div>
                        )}
                        
                        {/* Fall back to resumeMatchScore if skillsMatch doesn't exist */}
                        {job.skillsMatch === undefined && job.resumeMatchScore !== undefined && (
                          <div className="score-item">
                            <div className="score-label">Skills Match</div>
                            <div className="score-bar-container">
                              <div 
                                className="score-bar skills-score"
                                style={{ width: `${Math.min(job.resumeMatchScore * 100, 100)}%` }}
                              ></div>
                            </div>
                            <div className="score-value">
                              {Math.round(job.resumeMatchScore * 100)}%
                            </div>
                          </div>
                        )}
                        
                        {/* Desired Role Relevance */}
                        {job.roleRelevance !== undefined && (
                          <div className="score-item">
                            <div className="score-label">Desired Role</div>
                            <div className="score-bar-container">
                              <div 
                                className="score-bar role-score"
                                style={{ width: `${Math.min(job.roleRelevance * 100, 100)}%` }}
                              ></div>
                            </div>
                            <div className="score-value">
                              {Math.round(job.roleRelevance * 100)}%
                            </div>
                          </div>
                        )}
                        
                        {/* Fall back to roleMatchScore if roleRelevance doesn't exist */}
                        {job.roleRelevance === undefined && job.roleMatchScore !== undefined && (
                          <div className="score-item">
                            <div className="score-label">Desired Role</div>
                            <div className="score-bar-container">
                              <div 
                                className="score-bar role-score"
                                style={{ width: `${Math.min(job.roleMatchScore * 100, 100)}%` }}
                              ></div>
                            </div>
                            <div className="score-value">
                              {Math.round(job.roleMatchScore * 100)}%
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="job-actions">
                      <button className="btn btn-save" onClick={() => saveJob(job)}>
                        Save
                      </button>
                      
                      <button
                        className={`btn btn-details ${selectedJob && selectedJob.id === job.id ? 'active' : ''}`}
                        onClick={() => toggleJobDetails(job)}
                      >
                        Details
                      </button>
                      
                      <a href={job.applyLink} target="_blank" rel="noopener noreferrer" className="btn btn-apply">
                        Apply
                      </a>
                    </div>
                  </div>
                </div>
              </div>
              
              {selectedJob && selectedJob.id === job.id && (
                <div className="job-details-panel">
                  <div className="details-container">
                    {/* Match Insights Section */}
                    <div className="details-section">
                      <h4 className="section-title">Match Insights</h4>
                      <div className="match-insight">
                        <div>
                          <span className="match-quality">{job.matchQuality}</span>
                          {job.isCareerTransition && (
                            <span className="career-transition-badge">Career Transition</span>
                          )}
                        </div>
                        <p className="match-explanation">{job.matchExplanation}</p>
                        {job.matchReason && (
                          <p className="match-reason">{job.matchReason}</p>
                        )}
                      </div>
                    </div>
                    
                    {/* Description up top */}
                    <div className="details-section description-section">
                      <h4 className="section-title">Description</h4>
                      <div className="job-description">
                        <p>{job.description || 'No description available'}</p>
                      </div>
                    </div>
                    
                    {/* Single heading + single line about generating, but no duplication */}
                    <div className="details-section cover-letter-section">
                      <h4 className="section-title">Cover Letter Generator</h4>
                      
                      {/* (Optional) "Generate a personalized cover letter for..." line. 
                          If you want to remove it, just comment this out. */}
                      {!showCoverLetter && (
                        <p>
                          Generate a personalized cover letter for <strong>{job.jobTitle}</strong> at <strong>{job.company}</strong>
                        </p>
                      )}
                      
                      {/* Single purple button - once clicked, the child is shown automatically generating. */}
                      {!showCoverLetter && (
                        <button className="btn btn-generate-letter" onClick={handleGenerateCoverLetter}>
                          Generate Cover Letter
                        </button>
                      )}
                      
                      {/* Only render if we have resumeText */}
                      {showCoverLetter && userData && userData.resumeText && (
                        <CoverLetterGenerator
                          job={selectedJob}
                          resumeText={userData.resumeText}
                        />
                      )}

                      {/* Show error message if resumeText is missing */}
                      {showCoverLetter && (!userData || !userData.resumeText) && (
                        <div className="error-container">
                          <p className="error-message">
                            Cannot generate cover letter: Resume text is missing. 
                            Please ensure you've uploaded a resume.
                          </p>
                          <button 
                            className="btn btn-primary" 
                            onClick={() => setShowCoverLetter(false)}
                          >
                            Go Back
                          </button>
                        </div>
                      )}

                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="no-matches">
            <div className="no-matches-illustration"></div>
            <h3>No Matches Found</h3>
            <p>
              We couldn't find any positions that match your profile. Try adjusting your
              search criteria or uploading a different resume.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default JobMatches;