const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://ella-vate.onrender.com';

console.log('process.env.REACT_APP_API_URL:', process.env.REACT_APP_API_URL);
console.log('API_BASE_URL:', API_BASE_URL);

export const API_ENDPOINTS = {
  REGISTER: `${API_BASE_URL}/api/auth/register`,
  LOGIN: `${API_BASE_URL}/api/auth/login`,
  PROFILE: `${API_BASE_URL}/api/profile`,
  SAVED_JOBS: `${API_BASE_URL}/api/saved-jobs`,
  COVER_LETTER: `${API_BASE_URL}/api/generate-cover-letter`,
  COVER_LETTERS: `${API_BASE_URL}/api/cover-letters`
};

export default API_ENDPOINTS;