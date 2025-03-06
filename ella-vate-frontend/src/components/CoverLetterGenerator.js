import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import './CoverLetterGenerator.css';
import API_ENDPOINTS from '../config';

function CoverLetterGenerator({ job, resumeText }) {
  const [coverLetter, setCoverLetter] = useState('');
  const [isGenerating, setIsGenerating] = useState(true);
  const [error, setError] = useState(null);
  
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();

  // Debug resumeText
  useEffect(() => {
    console.log("CoverLetterGenerator received resumeText:", resumeText ? "Yes" : "No");
    console.log("Resume text length:", resumeText?.length || 0);
  }, [resumeText]);

  // Automatically generate cover letter on mount
  useEffect(() => {
    const autoGenerate = async () => {
      if (!currentUser) {
        navigate('/login');
        return;
      }
      if (!job || !resumeText) {
        setError('Missing job details or resume text');
        setIsGenerating(false);
        return;
      }
      try {
        setError(null);
        const token = localStorage.getItem('auth_token');
        const response = await fetch(API_ENDPOINTS.COVER_LETTER, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            jobId: job.id || '',
            jobTitle: job.jobTitle,
            company: job.company,
            jobDescription: job.description,
            resumeText: resumeText,
          }),
        });
        
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to generate cover letter');
        }
        setCoverLetter(data.coverLetterText);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsGenerating(false);
      }
    };
    autoGenerate();
  }, [currentUser, job, resumeText, navigate]);

  const handleDownload = () => {
    const blob = new Blob([coverLetter], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `Cover_Letter_${job.company}_${job.jobTitle.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="cover-letter-container">
      {/* Show loading or error */}
      {isGenerating && !error && (
        <p className="generating-msg">Generating your cover letter, please wait...</p>
      )}
      {error && !isGenerating && (
        <p className="error-message">{error}</p>
      )}

      {/* Once cover letter is ready, show it + actions */}
      {!isGenerating && !error && coverLetter && (
        <div className="cover-letter-content">
          <div className="cover-letter-preview">
            <pre>{coverLetter}</pre>
          </div>
          <div className="download-container">
            <button className="btn download-btn" onClick={handleDownload}>
              Download
            </button>
          </div>
          <div className="cover-letter-actions">
            <button
              className="btn btn-secondary"
              onClick={() => {
                setCoverLetter('');
                setIsGenerating(true);
              }}
            >
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CoverLetterGenerator;