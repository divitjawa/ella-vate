const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { OpenAI } = require('openai');
const { Pinecone } = require('@pinecone-database/pinecone');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Load environment variables
dotenv.config();

// Connect to MongoDB with error handling
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => {
  console.error('MongoDB connection error:', err);
  console.warn('Continuing without MongoDB connection - authentication features will be disabled');
});

// Define User Schema
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  fullName: { type: String, required: true },
  currentRole: { type: String },
  desiredRole: { type: String },
  createdAt: { type: Date, default: Date.now },
  savedJobs: [{ 
    jobId: String,
    jobTitle: String, 
    company: String, 
    matchScore: Number,
    savedAt: { type: Date, default: Date.now } 
  }],
  generatedCoverLetters: [{
    jobId: String,
    jobTitle: String,
    company: String,
    coverLetterText: String,
    generatedAt: { type: Date, default: Date.now }
  }]
});

// Create User model
const User = mongoose.model('User', userSchema);

// Initialize Express app
const app = express();
const port = process.env.PORT || 5050;

// Update the CORS configuration to allow requests from Render domains
app.use(cors({
  origin: [
    'http://localhost:3000', 
    'https://ella-vate-ui.onrender.com',    // Your Render frontend URL
    process.env.FRONTEND_URL             // From environment variable
  ].filter(Boolean), // Remove any undefined/empty values
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Configure middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure file upload storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

const upload = multer({ storage });

// Initialize OpenAI client
let openai;
try {
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is missing. Check your .env file.");
  } else {
    console.log("Initializing OpenAI with API key");
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
} catch (error) {
  console.error("Error initializing OpenAI client:", error);
}

// Initialize Pinecone client
let pinecone;
let index;

try {
  console.log("Initializing Pinecone with environment:", process.env.PINECONE_ENVIRONMENT);
  
  if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_ENVIRONMENT) {
    throw new Error("Missing Pinecone API key or environment.");
  } else {
    pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
      // environment: process.env.PINECONE_ENVIRONMENT
    });
    
    // Get a reference to your index
    const indexName = process.env.PINECONE_INDEX || 'ella-vate-jobs';
    console.log("Connecting to Pinecone index:", indexName);
    
    index = pinecone.index(indexName);
  }
} catch (error) {
  console.error("Error initializing Pinecone:", error);
  process.exit(1); // Exit the process if Pinecone initialization fails
}

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET || 'your_secure_jwt_secret_key_here');
    req.user = verified;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// User Registration Endpoint
app.post('/api/auth/register', async (req, res) => {
  console.log("Registration endpoint called");
  // Set CORS headers manually to be extra safe
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  try {
    const { email, password, fullName } = req.body;
    console.log("Registration request for:", email);
    
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      console.log("MongoDB not connected, using mock registration");
      // Mock successful registration
      const token = "mock_token_" + Date.now();
      return res.status(201).json({
        token,
        user: {
          id: "mock_id_" + Date.now(),
          email,
          fullName
        }
      });
    }
    
    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const user = new User({
      email,
      password: hashedPassword,
      fullName
    });

    // Save user
    const savedUser = await user.save();

    // Generate token
    const token = jwt.sign(
      { id: savedUser._id, email: savedUser.email },
      process.env.JWT_SECRET || 'your_secure_jwt_secret_key_here',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: savedUser._id,
        email: savedUser.email,
        fullName: savedUser.fullName
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Handle OPTIONS preflight requests for registration
app.options('/api/auth/register', (req, res) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// User Login Endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      console.log("MongoDB not connected, using mock login");
      // Mock successful login
      const token = "mock_token_" + Date.now();
      return res.status(200).json({
        token,
        user: {
          id: "mock_id_" + Date.now(),
          email,
          fullName: "Mock User"
        }
      });
    }
    
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // Validate password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // Generate token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET || 'your_secure_jwt_secret_key_here',
      { expiresIn: '7d' }
    );

    res.status(200).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        currentRole: user.currentRole,
        desiredRole: user.desiredRole
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get user profile
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        id: req.user.id,
        email: req.user.email,
        fullName: "Mock User",
        currentRole: "Software Engineer",
        desiredRole: "Machine Learning Engineer"
      });
    }
    
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Error fetching profile' });
  }
});

// Update user profile
app.put('/api/profile', authenticateToken, async (req, res) => {
  try {
    const { fullName, currentRole, desiredRole } = req.body;
    
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        id: req.user.id,
        email: req.user.email,
        fullName: fullName || "Mock User",
        currentRole: currentRole || "Software Engineer",
        desiredRole: desiredRole || "Machine Learning Engineer"
      });
    }
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    user.fullName = fullName || user.fullName;
    user.currentRole = currentRole || user.currentRole;
    user.desiredRole = desiredRole || user.desiredRole;
    
    const updatedUser = await user.save();
    
    res.json({
      id: updatedUser._id,
      email: updatedUser.email,
      fullName: updatedUser.fullName,
      currentRole: updatedUser.currentRole,
      desiredRole: updatedUser.desiredRole
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Error updating profile' });
  }
});

// Save a job
app.post('/api/saved-jobs', authenticateToken, async (req, res) => {
  try {
    const { jobId, jobTitle, company, matchScore } = req.body;
    
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      return res.status(201).json({ 
        message: 'Job saved successfully', 
        savedJobs: [{
          jobId,
          jobTitle,
          company,
          matchScore,
          savedAt: new Date()
        }]
      });
    }
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if job is already saved
    const jobExists = user.savedJobs.find(job => job.jobId === jobId);
    if (jobExists) {
      return res.status(400).json({ error: 'Job already saved' });
    }
    
    user.savedJobs.push({
      jobId,
      jobTitle,
      company,
      matchScore,
      savedAt: new Date()
    });
    
    await user.save();
    
    res.status(201).json({ message: 'Job saved successfully', savedJobs: user.savedJobs });
  } catch (error) {
    console.error('Save job error:', error);
    res.status(500).json({ error: 'Error saving job' });
  }
});

// Get saved jobs
app.get('/api/saved-jobs', authenticateToken, async (req, res) => {
  try {
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      return res.json([
        {
          jobId: "mock_job_1",
          jobTitle: "Machine Learning Engineer",
          company: "TechCorp",
          matchScore: 0.92,
          savedAt: new Date()
        }
      ]);
    }
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user.savedJobs);
  } catch (error) {
    console.error('Get saved jobs error:', error);
    res.status(500).json({ error: 'Error fetching saved jobs' });
  }
});

// Generate cover letter
app.post('/api/generate-cover-letter', authenticateToken, async (req, res) => {
  try {
    const { jobId, jobTitle, company, jobDescription, resumeText } = req.body;
    
    if (!jobTitle || !company || !jobDescription || !resumeText) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check if OpenAI API key is configured
    if (!openai) {
      console.log("OpenAI not configured, using mock cover letter");
      const mockCoverLetter = `
Dear Hiring Manager,

I am writing to express my interest in the ${jobTitle} position at ${company}. With my background in machine learning and data science, I believe I am well-suited for this role.

My experience includes developing and deploying machine learning models, working with large datasets, and implementing natural language processing solutions. I am proficient in Python, TensorFlow, and PyTorch, and have experience with cloud platforms such as AWS and Google Cloud.

In my current role as a Software Engineer, I have led several projects that involved machine learning components, including a recommendation system that increased user engagement by 25%. I am particularly interested in joining ${company} because of your innovative work in artificial intelligence and commitment to solving real-world problems with technology.

I am excited about the opportunity to contribute to your team and help advance your mission. Thank you for considering my application.

Sincerely,
[Your Name]
`;
      
      // Mock saving cover letter if MongoDB is connected
      if (mongoose.connection.readyState === 1 && jobId) {
        try {
          const user = await User.findById(req.user.id);
          if (user) {
            user.generatedCoverLetters.push({
              jobId,
              jobTitle,
              company,
              coverLetterText: mockCoverLetter,
              generatedAt: new Date()
            });
            
            await user.save();
          }
        } catch (err) {
          console.error("Error saving mock cover letter:", err);
        }
      }
      
      return res.json({ coverLetterText: mockCoverLetter });
    }
    
    // Generate cover letter using OpenAI
    const prompt = `
      Create a professional and personalized cover letter for a ${jobTitle} position at ${company}.
      
      Here is the job description:
      ${jobDescription}
      
      Here is my resume:
      ${resumeText}
      
      The cover letter should:
      1. Be professionally formatted with my contact information at the top
      2. Address the key requirements in the job description
      3. Highlight relevant experience and skills from my resume
      4. Show enthusiasm for the role and company
      5. Include a strong closing paragraph
      6. Be approximately 400 words
    `;
    
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert career advisor who specializes in writing compelling cover letters that highlight a candidate's relevant qualifications."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });
    
    const coverLetterText = completion.choices[0].message.content;
    
    // Save the cover letter to user's profile if jobId is provided and MongoDB is connected
    if (jobId && mongoose.connection.readyState === 1) {
      const user = await User.findById(req.user.id);
      if (user) {
        user.generatedCoverLetters.push({
          jobId,
          jobTitle,
          company,
          coverLetterText,
          generatedAt: new Date()
        });
        
        await user.save();
      }
    }
    
    res.json({ coverLetterText });
  } catch (error) {
    console.error('Cover letter generation error:', error);
    res.status(500).json({ error: 'Error generating cover letter' });
  }
});

// Get generated cover letters
app.get('/api/cover-letters', authenticateToken, async (req, res) => {
  try {
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      return res.json([
        {
          jobId: "mock_job_1",
          jobTitle: "Machine Learning Engineer",
          company: "TechCorp",
          coverLetterText: "This is a mock cover letter for a Machine Learning Engineer position at TechCorp.",
          generatedAt: new Date()
        }
      ]);
    }
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user.generatedCoverLetters);
  } catch (error) {
    console.error('Get cover letters error:', error);
    res.status(500).json({ error: 'Error fetching cover letters' });
  }
});

// Main route for profile submission and job matching
app.post('/api/profile', upload.single('resume'), async (req, res) => {
  console.log("Process profile request received");
  try {
    const { fullName, currentRole, desiredRole, additionalInfo } = req.body;
    const resumeFile = req.file;
    
    if (!resumeFile) {
      return res.status(400).json({ error: 'No resume file uploaded' });
    }

    console.log("Resume file received:", resumeFile.originalname);
    
    // Process the resume
    const resumeText = await extractTextFromResume(resumeFile.path);
    console.log("Resume text extracted, length:", resumeText.length);
    
    // Create user profile
    const userProfile = {
      fullName,
      currentRole,
      desiredRole,
      additionalInfo,
      resumeText
    };

    // Generate embedding for resume
    let embedding;
    try {
      if (openai) {
        console.log("Generating embedding using OpenAI");
        embedding = await generateEmbedding(resumeText);
      } else {
        console.log("OpenAI not available, using mock embedding");
        // Create a mock embedding (1536 dimensions is common for OpenAI embeddings)
        embedding = Array(1536).fill(0).map(() => Math.random() * 2 - 1);
      }
    } catch (err) {
      console.error("Error generating embedding:", err);
      console.log("Using mock embedding instead");
      embedding = Array(1536).fill(0).map(() => Math.random() * 2 - 1);
    }
    
    // Find matching jobs
    console.log("Finding matching jobs...");
    const matches = await findMatchingJobs(embedding);
    console.log(`Found ${matches.length} matching jobs`);
    
    // Return the profile and matches
    res.json({
      profile: userProfile,
      matches
    });
  } catch (error) {
    console.error('Error processing profile:', error);
    res.status(500).json({ error: 'Error processing profile: ' + error.message });
  }
});

// Function to extract text from resume file
async function extractTextFromResume(filePath) {
  console.log("Extracting text from:", filePath);
  const fileExtension = path.extname(filePath).toLowerCase();
  
  try {
    if (fileExtension === '.pdf') {
      // Handle PDF files
      console.log("Processing PDF file");
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdf(dataBuffer);
      return pdfData.text;
    } else if (fileExtension === '.docx') {
      // Handle DOCX files
      console.log("Processing DOCX file");
      const dataBuffer = fs.readFileSync(filePath);
      const result = await mammoth.extractRawText({ buffer: dataBuffer });
      return result.value;
    } else if (fileExtension === '.txt') {
      // Handle plain text files
      console.log("Processing TXT file");
      return fs.readFileSync(filePath, 'utf8');
    } else {
      console.log("Unsupported file format:", fileExtension);
      throw new Error('Unsupported file format: ' + fileExtension);
    }
  } catch (error) {
    console.error('Error extracting text from resume:', error);
    throw error;
  }
}

// Function to generate embedding using OpenAI
async function generateEmbedding(text) {
  try {
    console.log("Generating embedding for text of length:", text.length);
    
    // If OpenAI is not configured, return a mock embedding
    if (!openai) {
      console.log("OpenAI not configured, using mock embedding");
      return Array(1536).fill(0).map(() => Math.random() * 2 - 1);
    }
    
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text
    });
    
    console.log("Embedding generated successfully");
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

// Function to find matching jobs using Pinecone
async function findMatchingJobs(embedding) {
  try {
    // Query Pinecone for similar vectors
    console.log("Querying Pinecone for similar job vectors");
    const queryResponse = await index.query({
      vector: embedding,
      topK: 5,
      includeMetadata: true
    });
    
    console.log(`Pinecone returned ${queryResponse.matches.length} matches`);
    
    // Process and format the results
    const matches = queryResponse.matches.map(match => {
      return {
        jobTitle: match.metadata.job_title || match.metadata.title || 'Unknown Position',
        company: match.metadata.company || match.metadata.company_name || 'Unknown Company',
        location: match.metadata.location || 'Multiple Locations',
        employmentType: match.metadata.employment_type || 'Not Specified',
        salary: match.metadata.salary || '$100,000+',
        applyLink: match.metadata.job_apply_link || '#',
        description: match.metadata.description || match.metadata.job_description || '',
        matchScore: match.score
      };
    });
    
    return matches;
  } catch (error) {
    console.error('Error finding matching jobs:', error);
    throw new Error('Error finding matching jobs');
  }
}

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`CORS is configured to allow requests from ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});