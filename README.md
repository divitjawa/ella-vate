# 1536: AI-Powered Job Matching Platform

1536 is an AI-driven job matching platform that transforms the job search process by leveraging semantic matching, natural language processing, and automated resume optimization. The platform provides personalized job recommendations based on candidates' qualifications rather than just keywords, while automating resume customization and cover letter generation.

## Project Overview

This platform was developed for the MSIS 549: Machine Learning and Artificial Intelligence For Business Applications course. It addresses the current challenges in job searching by:

- Providing semantic matching between resumes and job descriptions
- Going beyond basic keyword matching to consider experience and transferable skills
- Automating the resume customization process
- Generating personalized cover letters
- Streamlining the entire job search workflow in one platform

## 🛠️ Technologies Used

### Backend
- Node.js/Express
- MongoDB (for user data and saved jobs)
- OpenAI API (for embeddings and cover letter generation)
- Pinecone (vector database for job matching)
- JWT for authentication
- Multer for file uploads
- PDF-parse and Mammoth for document parsing

### Frontend
- React
- React Router
- CSS for styling

## 📋 Features

- **User Authentication**: Register, login, and manage profiles
- **Resume Upload & Analysis**: Upload PDFs, DOCXs, or TXT files
- **AI-Powered Job Matching**: Vector-based semantic matching with job listings
- **Cover Letter Generation**: AI-generated customized cover letters
- **Saved Jobs**: Save and track interesting job opportunities

## 🚀 Setup Instructions

### Prerequisites
- Node.js (v14+)
- npm or yarn
- MongoDB (local or Atlas)
- OpenAI API key (optional)
- Pinecone API key (optional)

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd ella-vate-frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. The application will be available at `http://localhost:3000`

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file based on the template provided:
   ```
   PORT=5050
   OPENAI_API_KEY=your_openai_api_key_here
   PINECONE_API_KEY=your_pinecone_api_key_here
   PINECONE_ENVIRONMENT=gcp-starter
   PINECONE_INDEX=ella-vate-jobs
   MONGODB_URI=mongodb://localhost:27017/ella-vate
   JWT_SECRET=your_secure_jwt_secret_key_here
   FRONTEND_URL=http://localhost:3000
   ```

4. Create an `uploads` directory for storing resume files:
   ```bash
   mkdir uploads
   ```

5. Start the server:
   ```bash
   npm start
   ```

6. The API will be available at `http://localhost:5050`

### Running without External APIs

The application is designed to work with mock data if the external APIs (OpenAI and Pinecone) are not configured. This is useful for development and testing.

To use mock data:
1. Leave the API keys in the `.env` file as placeholder text
2. The server will automatically detect missing credentials and use mock data

### MongoDB Configuration

For local development, you can use a local MongoDB instance:
```
MONGODB_URI=mongodb://localhost:27017/ella-vate
```

For MongoDB Atlas:
```
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/ella-vate?retryWrites=true&w=majority
```

## 📝 API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login a user
- `GET /api/profile` - Get user profile (protected)
- `PUT /api/profile` - Update user profile (protected)

### Job Matching
- `POST /api/profile` - Upload resume and get job matches

### Saved Jobs
- `POST /api/saved-jobs` - Save a job (protected)
- `GET /api/saved-jobs` - Get saved jobs (protected)

### Cover Letters
- `POST /api/generate-cover-letter` - Generate a cover letter (protected)
- `GET /api/cover-letters` - Get generated cover letters (protected)

## 📁 Project Structure

```
ella-vate/
├── backend/               # Backend server
│   ├── uploads/           # Uploaded resume files
│   ├── server.js          # Main server file
│   ├── package.json       # Backend dependencies
│   └── .env               # Environment variables
├── ella-vate-frontend/    # Frontend React app
│   ├── public/            # Public assets
│   ├── src/               # React source code
│   │   ├── components/    # React components
│   │   ├── context/       # Context providers
│   │   ├── App.js         # Main App component
│   │   ├── config.js      # API configuration
│   │   └── index.js       # Application entry point
│   └── package.json       # Frontend dependencies
└── README.md              # Project documentation
```

## ⚠️ Troubleshooting

### CORS Issues
If you encounter CORS issues, make sure:
- The frontend URL in the backend `.env` file matches your React app's URL
- The CORS middleware in `server.js` is properly configured
- You're using the correct port numbers in your API requests

### MongoDB Connection Errors
If MongoDB fails to connect:
- Check if your local MongoDB server is running
- Verify your connection string in the `.env` file
- For Atlas, ensure your IP address is whitelisted

### API Key Issues
If OpenAI or Pinecone API calls fail:
- Verify your API keys in the `.env` file
- Check that your Pinecone environment and index name are correct
- The app will fall back to mock data if APIs are unavailable

## 📊 Development Notes

### Working with Mock Data
During development, you can use mock data instead of connecting to real APIs:
- The server automatically uses mock job data if Pinecone is not configured
- Cover letter generation uses a template if OpenAI is not configured
- Authentication works in mock mode if MongoDB is not connected

### Adding Jobs to Pinecone
To add real job data to Pinecone, you'll need to:
1. Create embeddings for job descriptions using the OpenAI API
2. Upload these embeddings to your Pinecone index
3. The code for this process is in the project documentation

## 🤝 Contributors

1536 Team:
- Ella Braide - ebraide@uw.edu
- Divit Jawa - divitj@uw.edu
- Jose Granados - jogran23@uw.edu
- Liyi Liang - liyi41@uw.edu

## 📄 License

This project is licensed for educational purposes only.
