import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import './CoverLetterGenerator.css';

function CoverLetterGenerator({ job, resumeText }) {
  const [coverLetter, setCoverLetter] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const generateCoverLetter = async () => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    
    if (!job || !resumeText) {
      setError('Missing job details or resume text');
      return;
    }
    
    try {
      setIsGenerating(true);
      setError(null);
      
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch('http://localhost:5050/api/generate-cover-letter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
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
  
  const handleDownload = () => {
    // Create a blob with the cover letter text
    const blob = new Blob([coverLetter], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    // Create a link and trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = `Cover_Letter_${job.company}_${job.jobTitle.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Cleanup
    URL.revokeObjectURL(url);
  };
  
  return (
    <div className="cover-letter-container">
      <h2>Cover Letter Generator</h2>
      <p className="cover-letter-info">
        Generate a personalized cover letter for <strong>{job?.jobTitle}</strong> at <strong>{job?.company}</strong>
      </p>
      
      {!coverLetter ? (
        <div className="cover-letter-actions">
          <button 
            className="btn btn-primary" 
            onClick={generateCoverLetter}
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating...' : 'Generate Cover Letter'}
          </button>
          
          {error && <p className="error-message">{error}</p>}
        </div>
      ) : (
        <div className="cover-letter-content">
          <div className="cover-letter-preview">
            <pre>{coverLetter}</pre>
          </div>
          
          <div className="cover-letter-actions">
            <button className="btn btn-secondary" onClick={() => setCoverLetter('')}>
              Regenerate
            </button>
            <button className="btn btn-primary" onClick={handleDownload}>
              Download
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CoverLetterGenerator;
