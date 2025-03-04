import React, { useState, useContext } from 'react';
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
  
  return (
    <div className="user-form-container">
      <h1>Find your match!</h1>
      <p className="subtitle">Join millions of users who have found their dream job on (our app)</p>
      
      <form onSubmit={handleSubmit} className="user-form">
        {!currentUser && (
          <div className="form-group">
            <label htmlFor="fullName">Full name</label>
            <input
              type="text"
              id="fullName"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
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
            rows="4"
          ></textarea>
        </div>
        
        <div className="form-group">
          <button type="button" className="btn btn-upload" onClick={() => document.getElementById('resumeUpload').click()}>
            Upload Resume
          </button>
          <input
            type="file"
            id="resumeUpload"
            onChange={handleFileChange}
            accept=".pdf,.docx,.txt"
            style={{ display: 'none' }}
          />
          {resumeFile && <p className="file-name">Selected file: {resumeFile.name}</p>}
          {fileError && <p className="error-message">{fileError}</p>}
        </div>
        
        {error && <p className="error-message">{error}</p>}
        
        <button 
          type="submit" 
          className="btn btn-primary btn-submit" 
          disabled={isLoading}
        >
          {isLoading ? 'Processing...' : 'Apply Changes'}
        </button>
      </form>
    </div>
  );
}

export default UserForm;
