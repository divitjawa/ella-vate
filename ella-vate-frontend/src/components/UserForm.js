import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import './UserForm.css';

function UserForm({ onSubmit, isLoading, error }) {
  const navigate = useNavigate();
  const { currentUser } = useContext(AuthContext);
  
  const [formData, setFormData] = useState({
    fullName: currentUser ? currentUser.fullName : '',
    currentRole: '',
    desiredRole: '',
    additionalInfo: ''
  });
  
  const [resumeFile, setResumeFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [animateButton, setAnimateButton] = useState(false);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) {
      setResumeFile(null);
      return;
    }
    
    // Check file type
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!validTypes.includes(file.type)) {
      setFileError('Please upload a PDF, DOCX, or TXT file');
      setResumeFile(null);
      return;
    }
    
    // Check file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setFileError('File size must be less than 5MB');
      setResumeFile(null);
      return;
    }
    
    setFileError('');
    setResumeFile(file);
    setAnimateButton(true);
    
    // Reset animation after a short delay
    setTimeout(() => {
      setAnimateButton(false);
    }, 500);
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!resumeFile) {
      setFileError('Please upload your resume');
      return;
    }
    
    // Create FormData for file upload
    const submitData = new FormData();
    submitData.append('fullName', formData.fullName);
    submitData.append('currentRole', formData.currentRole);
    submitData.append('desiredRole', formData.desiredRole);
    submitData.append('additionalInfo', formData.additionalInfo);
    submitData.append('resume', resumeFile);
    
    // Submit form data
    const success = await onSubmit(submitData);
    
    if (success) {
      navigate('/matches');
    }
  };

  // Custom file name display logic
  const formatFileName = (name) => {
    if (!name) return '';
    if (name.length <= 25) return name;
    
    const extension = name.split('.').pop();
    const baseName = name.substring(0, name.length - extension.length - 1);
    return `${baseName.substring(0, 18)}...${extension}`;
  };
  
  return (
    <div className="user-form-container">
      <h1>Launch Your Career to New Heights</h1>
      <p className="subtitle">Over 2 million professionals found their perfect job match on Ella-Vate last year</p>
      
      <form onSubmit={handleSubmit} className="user-form">
        {!currentUser && (
          <div className="form-group">
            <label htmlFor="fullName">Full Name</label>
            <input
              type="text"
              id="fullName"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              placeholder="Enter your full name"
              required
            />
          </div>
        )}
        
        <div className="form-group">
          <label htmlFor="currentRole">Current Role</label>
          <input
            type="text"
            id="currentRole"
            name="currentRole"
            value={formData.currentRole}
            onChange={handleChange}
            placeholder="e.g. Software Developer"
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="desiredRole">Desired Role</label>
          <input
            type="text"
            id="desiredRole"
            name="desiredRole"
            value={formData.desiredRole}
            onChange={handleChange}
            placeholder="e.g. Senior Software Engineer"
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="additionalInfo">What are you looking for in your next role?</label>
          <textarea
            id="additionalInfo"
            name="additionalInfo"
            value={formData.additionalInfo}
            onChange={handleChange}
            placeholder="Describe your ideal work environment, compensation expectations, remote/hybrid preferences, etc."
            rows="4"
          ></textarea>
        </div>
        
        <div className="form-group resume-upload-container">
          <label htmlFor="resumeUpload" className="resume-label">Your Resume</label>
          <button 
            type="button" 
            className={`btn btn-upload ${animateButton ? 'animate' : ''}`} 
            onClick={() => document.getElementById('resumeUpload').click()}
          >
            Upload Your Resume
          </button>
          <input
            type="file"
            id="resumeUpload"
            onChange={handleFileChange}
            accept=".pdf,.docx,.txt"
            style={{ display: 'none' }}
          />
          {resumeFile && <p className="file-name">Selected file: {formatFileName(resumeFile.name)}</p>}
          {!resumeFile && <p className="file-hint">Upload your resume to increase your match rate by 80%</p>}
          {fileError && <p className="error-message">{fileError}</p>}
        </div>
        
        {error && <p className="error-message">{error}</p>}
        
        <button 
          type="submit" 
          className={`btn btn-primary btn-submit ${isLoading ? 'loading' : ''}`}
          disabled={isLoading}
        >
          {isLoading ? 'Processing...' : 'Apply Changes'}
        </button>
      </form>
    </div>
  );
}

export default UserForm;