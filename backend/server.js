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
  originalCurrentRole: { type: String },  // Added to store the original input
  desiredRole: { type: String },
  originalDesiredRole: { type: String },  // Added to store the original input
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

/**
 * Expands common professional acronyms into their full forms
 * @param {string} text - Input text containing potential acronyms
 * @return {string} Text with expanded acronyms
 */
function expandProfessionalAcronyms(text) {
  if (!text) return text;
  
  // Convert to string in case a number was passed
  const inputText = String(text).trim();
  
  // Common professional acronyms and their expansions
  const acronyms = {
    // Technology roles
    'swe': 'software engineer',
    'se': 'software engineer',
    'dev': 'developer',
    'fs': 'full stack',
    'fsd': 'full stack developer',
    'fe': 'frontend',
    'fed': 'frontend developer',
    'be': 'backend',
    'bed': 'backend developer',
    'devops': 'development operations',
    'ml': 'machine learning',
    'mle': 'machine learning engineer',
    'ds': 'data scientist',
    'da': 'data analyst',
    'de': 'data engineer',
    'ai': 'artificial intelligence',
    
    // Management roles
    'pm': 'product manager',
    'po': 'product owner',
    'sm': 'scrum master',
    'eng mgr': 'engineering manager',
    'em': 'engineering manager',
    'tpm': 'technical program manager',
    'cto': 'chief technology officer',
    'cio': 'chief information officer',
    'vp eng': 'vice president of engineering',
    
    // Design roles
    'ui': 'user interface',
    'ux': 'user experience',
    'ui/ux': 'user interface and user experience',
    
    // Marketing and business
    'seo': 'search engine optimization',
    'sem': 'search engine marketing',
    'cro': 'conversion rate optimization',
    'biz dev': 'business development',
    'bd': 'business development',
    'ba': 'business analyst',
    'vc': 'venture capital',
    
    // IT and operations
    'sre': 'site reliability engineer',
    'infra': 'infrastructure',
    'sys admin': 'system administrator',
    'qa': 'quality assurance',
    
    // Common supplementary terms
    'jr': 'junior',
    'sr': 'senior',
    'mgr': 'manager',
    'dir': 'director',
    'exec': 'executive',
    'lead': 'team lead',
    'tech': 'technical',
    'eng': 'engineer'
  };

  // First attempt: check if the entire input is an acronym
  const lowerText = inputText.toLowerCase();
  if (acronyms[lowerText]) {
    return acronyms[lowerText];
  }
  
  // Second attempt: Process combined acronyms (e.g., "Sr SWE" -> "Senior Software Engineer")
  let words = inputText.split(/\s+/);
  let expanded = false;
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i].toLowerCase();
    if (acronyms[word]) {
      words[i] = acronyms[word];
      expanded = true;
    }
  }
  
  // Third attempt: Handle special cases with mixed forms (e.g., "Sr. Software Eng")
  if (!expanded) {
    // Try to match partial acronyms within the text
    for (const [acronym, expansion] of Object.entries(acronyms)) {
      // Use word boundary to avoid substring matches
      const regex = new RegExp(`\\b${acronym}\\b`, 'gi');
      if (regex.test(inputText)) {
        return inputText.replace(regex, expansion);
      }
    }
  }
  
  return words.join(' ');
}

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
  const allowedOrigins = [
    'http://localhost:3000',
    'https://ella-vate-ui.onrender.com',
    process.env.FRONTEND_URL
  ].filter(Boolean); // Remove any empty/undefined values
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
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
  const allowedOrigins = [
    'http://localhost:3000',
    'https://ella-vate-ui.onrender.com',
    process.env.FRONTEND_URL
  ].filter(Boolean); // Remove any empty/undefined values
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
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
    
    // Expand acronyms
    const expandedCurrentRole = expandProfessionalAcronyms(currentRole);
    const expandedDesiredRole = expandProfessionalAcronyms(desiredRole);
    
    console.log(`Updating profile - Current role: "${currentRole}" -> "${expandedCurrentRole}"`);
    console.log(`Updating profile - Desired role: "${desiredRole}" -> "${expandedDesiredRole}"`);
    
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        id: req.user.id,
        email: req.user.email,
        fullName: fullName || "Mock User",
        currentRole: expandedCurrentRole || "Software Engineer",
        desiredRole: expandedDesiredRole || "Machine Learning Engineer",
        originalCurrentRole: currentRole,
        originalDesiredRole: desiredRole
      });
    }
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    user.fullName = fullName || user.fullName;
    user.currentRole = expandedCurrentRole || user.currentRole;
    user.desiredRole = expandedDesiredRole || user.desiredRole;
    user.originalCurrentRole = currentRole;
    user.originalDesiredRole = desiredRole;
    
    const updatedUser = await user.save();
    
    res.json({
      id: updatedUser._id,
      email: updatedUser.email,
      fullName: updatedUser.fullName,
      currentRole: updatedUser.currentRole,
      desiredRole: updatedUser.desiredRole,
      originalCurrentRole: currentRole,
      originalDesiredRole: desiredRole
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
    const resumeFile = req.file;
    
    if (!resumeFile) {
      return res.status(400).json({ error: 'No resume file uploaded' });
    }

    console.log("Resume file received:", resumeFile.originalname);
    
    // Get fields from the request
    const { fullName, currentRole, desiredRole, location, preferRemote, additionalInfo } = req.body;
    
    // Expand acronyms in role fields
    const expandedCurrentRole = expandProfessionalAcronyms(currentRole);
    const expandedDesiredRole = expandProfessionalAcronyms(desiredRole);
    
    console.log(`Current role expanded: "${currentRole}" -> "${expandedCurrentRole}"`);
    console.log(`Desired role expanded: "${desiredRole}" -> "${expandedDesiredRole}"`);
    
    // Process the resume
    const resumeText = await extractTextFromResume(resumeFile.path);
    console.log("Resume text extracted and processed, length:", resumeText.length);
    
    // Create user profile with expanded roles
    const userProfile = {
      fullName,
      currentRole: expandedCurrentRole,
      desiredRole: expandedDesiredRole,
      originalCurrentRole: currentRole,  // Keep the original for reference
      originalDesiredRole: desiredRole,  // Keep the original for reference
      location,
      preferRemote: preferRemote === 'true',
      additionalInfo,
      resumeTextLength: resumeText.length,
      resumeFile: resumeFile.originalname
    };

    // Select embedding method for A/B testing
    const sessionId = req.headers['x-session-id'] || Date.now().toString();
    const embeddingMethod = selectEmbeddingMethod(sessionId);
    console.log(`Using embedding method: ${embeddingMethod}`);
    
    // Generate embedding based on selected method
    let embedding;
    try {
      embedding = await generateEmbeddingWithMethod(resumeText, embeddingMethod);
      console.log(`Embedding generated successfully using ${embeddingMethod} method`);
    } catch (err) {
      console.error(`Error generating embedding with ${embeddingMethod} method:`, err);
      // Fallback to standard method
      console.log("Falling back to standard embedding method");
      embedding = await generateEmbedding(resumeText);
    }
    
    // User preferences for job matching with expanded roles
    const userPreferences = {
      desiredRole: expandedDesiredRole,
      originalDesiredRole: desiredRole,
      location,
      preferRemote: preferRemote === 'true',
      currentRole: expandedCurrentRole,
      originalCurrentRole: currentRole
    };
    
    // Find matching jobs with enhanced method
    console.log("Finding matching jobs with preferences:", JSON.stringify(userPreferences));
    const matches = await findMatchingJobs(embedding, userPreferences);
    console.log(`Found ${matches.length} matching jobs`);
    
    // Log metrics for analysis
    logMatchingMetrics(matches, embeddingMethod, userProfile);
    
    // Return the profile and matches
    res.json({
      profile: userProfile,
      matches,
      embeddingMethod,
      matchStats: calculateMatchStats(matches)
    });
  } catch (error) {
    console.error('Error processing profile:', error);
    res.status(500).json({ error: 'Error processing profile: ' + error.message });
  }
});

function selectEmbeddingMethod(sessionId) {
  // Simple A/B testing based on session ID
  const methods = ['standard', 'enhanced', 'sectionWeighted'];
  const hash = parseInt(sessionId.substring(sessionId.length - 4), 16);
  return methods[hash % methods.length];
}

async function generateEmbeddingWithMethod(text, method) {
  switch (method) {
    case 'enhanced':
      // Enhanced method with keyword boosting
      const keyTerms = extractKeyTerms(text);
      const enhancedText = text + " " + keyTerms.join(" ").repeat(3);
      return await generateEmbedding(enhancedText);
      
    case 'sectionWeighted':
      // Section-based weighting (assumes text is already processed by extractTextFromResume)
      return await generateEmbedding(text);
      
    case 'standard':
    default:
      // Standard method
      return await generateEmbedding(text);
  }
}

function calculateMatchStats(matches) {
  if (!matches || matches.length === 0) {
    return { min: 0, max: 0, avg: 0, count: 0 };
  }
  
  const scores = matches.map(m => m.matchScore);
  return {
    min: Math.min(...scores),
    max: Math.max(...scores),
    avg: scores.reduce((sum, score) => sum + score, 0) / scores.length,
    count: matches.length
  };
}

function logMatchingMetrics(matches, method, userProfile) {
  // Log metrics for later analysis
  const stats = calculateMatchStats(matches);
  console.log(`Matching metrics - Method: ${method}, Results: ${matches.length}, Avg Score: ${stats.avg.toFixed(2)}, Max: ${stats.max.toFixed(2)}`);
  
  // You could extend this to write to a database or analytics service
}

// Function to extract text from resume file
async function extractTextFromResume(filePath) {
  console.log("Extracting text from:", filePath);
  const fileExtension = path.extname(filePath).toLowerCase();
  
  let extractedText = '';
  try {
    if (fileExtension === '.pdf') {
      // Handle PDF files
      console.log("Processing PDF file");
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdf(dataBuffer);
      extractedText = pdfData.text;
    } else if (fileExtension === '.docx') {
      // Handle DOCX files
      console.log("Processing DOCX file");
      const dataBuffer = fs.readFileSync(filePath);
      const result = await mammoth.extractRawText({ buffer: dataBuffer });
      extractedText = result.value;
    } else if (fileExtension === '.txt') {
      // Handle plain text files
      console.log("Processing TXT file");
      extractedText = fs.readFileSync(filePath, 'utf8');
    } else {
      console.log("Unsupported file format:", fileExtension);
      throw new Error('Unsupported file format: ' + fileExtension);
    }
    
    // Clean the text
    extractedText = extractedText.replace(/\s+/g, ' ').trim();
    
    // Remove common irrelevant content
    extractedText = extractedText.replace(/references available upon request|page \d+ of \d+/gi, '');
    
    // Extract and emphasize key sections
    const sections = {
      experience: extractSection(extractedText, ['experience', 'work history', 'employment']),
      skills: extractSection(extractedText, ['skills', 'technical skills', 'technologies', 'expertise', 'proficiencies']),
      education: extractSection(extractedText, ['education', 'academic background', 'qualifications']),
      projects: extractSection(extractedText, ['projects', 'portfolio', 'key projects'])
    };
    
    // Expand any role acronyms in the resume
    Object.keys(sections).forEach(key => {
      sections[key] = expandAcronymsInText(sections[key]);
    });
    
    // Create a weighted text with more emphasis on recent experience and skills
    const weightedText = `
      ${sections.skills.repeat(3)}
      ${sections.experience.repeat(2)}
      ${sections.projects}
      ${sections.education}
    `;
    
    console.log("Resume processed successfully with section-based weighting");
    return weightedText;
  } catch (error) {
    console.error('Error extracting text from resume:', error);
    throw error;
  }
}

function expandAcronymsInText(text) {
  if (!text) return text;
  
  // Split text into words and expand any acronyms
  const words = text.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const expanded = expandProfessionalAcronyms(words[i]);
    if (expanded !== words[i]) {
      // Keep both the acronym and its expansion
      words[i] = `${words[i]} ${expanded}`;
    }
  }
  
  return words.join(' ');
}

function extractSection(text, sectionNames) {
  for (const name of sectionNames) {
    // Look for section headers followed by content until the next section
    const pattern = new RegExp(
      `\\b${name}\\b[:\\s]*(.*?)(?=\\b(experience|employment|work history|skills|technical skills|technologies|education|academic|qualifications|projects|portfolio|references)\\b|$)`,
      'is'
    );
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return '';
}

// Function to generate embedding using OpenAI
async function generateEmbedding(text) {
  try {
    console.log("Generating embedding for text of length:", text.length);
    
    // If OpenAI is not configured, return a structured mock embedding instead of random
    if (!openai) {
      console.log("OpenAI not configured, using consistent mock embedding");
      // Create a consistent mock embedding based on text hash
      const hash = createTextHash(text);
      return generateConsistentMockEmbedding(hash);
    }
    
    // Truncate text to avoid token limits (approx 8000 tokens or 32000 chars)
    let processedText = text;
    if (text.length > 32000) {
      console.log("Text too long, truncating");
      // Keep important beginning and end parts of the text
      processedText = text.substring(0, 20000) + " " + text.substring(text.length - 10000);
    }
    
    // Extract key terms to ensure they're well-represented
    const keyTerms = extractKeyTerms(processedText);
    const enhancedText = processedText + " " + keyTerms.join(" ");
    
    // Generate the actual embedding
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: enhancedText
    });
    
    // Normalize the embedding vectors (important for cosine similarity)
    const embedding = response.data[0].embedding;
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    
    if (magnitude === 0) {
      console.warn("Warning: Zero magnitude embedding generated");
      return embedding;
    }
    
    const normalizedEmbedding = embedding.map(val => val / magnitude);
    console.log("Embedding generated and normalized successfully");
    
    return normalizedEmbedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    // Provide a more graceful fallback than just random values
    console.log('Using keyword-based fallback embedding');
    return createKeywordFallbackEmbedding(text);
  }
}

function extractKeyTerms(text) {
  // Simple keyword extraction (could be enhanced with NLP libraries)
  const words = text.toLowerCase().split(/\W+/);
  const stopWords = new Set(['the', 'and', 'or', 'of', 'to', 'a', 'in', 'for', 'with', 'on', 'at', 'from', 'by']);
  
  // Count word frequencies
  const wordCounts = {};
  for (const word of words) {
    if (word.length > 3 && !stopWords.has(word)) {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    }
  }
  
  // Get top keywords
  return Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(entry => entry[0]);
}

function createTextHash(text) {
  // Simple deterministic hash function
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}

function generateConsistentMockEmbedding(seed) {
  // Create a deterministic sequence based on the seed
  const rand = deterministicRandom(seed);
  return Array(1536).fill(0).map(() => rand() * 2 - 1);
}

function deterministicRandom(seed) {
  return function() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

function createKeywordFallbackEmbedding(text) {
  // Extract keywords and create a simple embedding based on them
  const keywords = extractKeyTerms(text);
  const keywordHash = createTextHash(keywords.join(' '));
  return generateConsistentMockEmbedding(keywordHash);
}

// Function to find matching jobs using Pinecone
async function findMatchingJobs(embedding, userPreferences = {}) {
  try {
    console.log("Finding matching jobs with enhanced parameters");
    
    // Create filters based on user preferences
    const filters = {};
    
    if (userPreferences.desiredRole) {
      // Extract keywords from both original and expanded desired role
      const roleKeywords = new Set();
      
      // Process the expanded role
      userPreferences.desiredRole
        .toLowerCase()
        .split(/\W+/)
        .filter(word => word.length > 3)
        .forEach(word => roleKeywords.add(word));
      
      // Also add the original role if available
      if (userPreferences.originalDesiredRole) {
        userPreferences.originalDesiredRole
          .toLowerCase()
          .split(/\W+/)
          .filter(word => word.length > 2)  // Include shorter acronyms
          .forEach(word => roleKeywords.add(word));
      }
      
      // Add common role variations
      if (roleKeywords.has('engineer')) {
        roleKeywords.add('developer');
        roleKeywords.add('engineering');
      }
      if (roleKeywords.has('manager')) {
        roleKeywords.add('management');
        roleKeywords.add('lead');
      }
      
      if (roleKeywords.size > 0) {
        filters.job_title = { "$containsAny": Array.from(roleKeywords) };
      }
    }
    
    if (userPreferences.location) {
      filters.location = { "$containsAny": [userPreferences.location.toLowerCase()] };
    }
    
    // Determine if we should use filters
    const useFilters = Object.keys(filters).length > 0;
    
    // Query Pinecone with appropriate parameters
    const queryOptions = {
      vector: embedding,
      topK: 20,  // Get more results than needed to allow for post-filtering
      includeMetadata: true,
      includeValues: false
    };
    
    // Only add filter if we have valid filters to prevent empty filter object issues
    if (useFilters) {
      queryOptions.filter = filters;
    }
    
    console.log("Querying Pinecone with options:", JSON.stringify(queryOptions, null, 2));
    const queryResponse = await index.query(queryOptions);
    
    console.log(`Pinecone returned ${queryResponse.matches.length} matches`);
    
    // Enhanced post-processing of results
    let matches = queryResponse.matches;
    
    // Filter out low-quality matches
    const qualityThreshold = 0.5;  // Adjusted lower to account for expanded role terms
    matches = matches.filter(match => match.score > qualityThreshold);
    
    // Apply additional scoring factors for better ranking
    matches = matches.map(match => {
      let finalScore = match.score;
      
      // Boost score if job title matches desired role (either original or expanded)
      if (match.metadata.job_title) {
        const jobTitleLower = match.metadata.job_title.toLowerCase();
        
        // Check for expanded role match
        if (userPreferences.desiredRole && 
            jobTitleLower.includes(userPreferences.desiredRole.toLowerCase())) {
          finalScore *= 1.2;  // 20% boost
        }
        
        // Also check for original role match if it's an acronym
        if (userPreferences.originalDesiredRole && 
            userPreferences.originalDesiredRole.length <= 5 &&
            jobTitleLower.includes(userPreferences.originalDesiredRole.toLowerCase())) {
          finalScore *= 1.15;  // 15% boost
        }
        
        // Boost score for current role matches (might indicate experience fit)
        if (userPreferences.currentRole && 
            jobTitleLower.includes(userPreferences.currentRole.toLowerCase())) {
          finalScore *= 1.1;  // 10% boost
        }
      }
      
      // Boost remote jobs if user prefers remote
      if (userPreferences.preferRemote && 
          match.metadata.location && 
          match.metadata.location.toLowerCase().includes('remote')) {
        finalScore *= 1.1;  // 10% boost
      }
      
      return {
        ...match,
        adjustedScore: finalScore
      };
    });
    
    // Sort by adjusted score
    matches.sort((a, b) => b.adjustedScore - a.adjustedScore);
    
    // Take top results after re-scoring
    matches = matches.slice(0, 5);
    
    // Clean and format the response
    return matches.map(match => {
      return {
        id: match.id,
        jobTitle: match.metadata.job_title || match.metadata.title || 'Unknown Position',
        company: match.metadata.company || match.metadata.company_name || 'Unknown Company',
        location: match.metadata.location || 'Multiple Locations',
        employmentType: match.metadata.employment_type || 'Not Specified',
        salary: match.metadata.salary || match.metadata.salary_range || 'Not Specified',
        applyLink: match.metadata.job_apply_link || match.metadata.url || '#',
        description: match.metadata.description || match.metadata.job_description || '',
        postedDate: match.metadata.posted_date || 'Recent',
        matchScore: Math.round(match.adjustedScore * 100) / 100,  // Round to 2 decimal places
        rawScore: Math.round(match.score * 100) / 100,  // For debugging
        matchedWith: userPreferences.originalDesiredRole ? 
                    `${userPreferences.originalDesiredRole} (${userPreferences.desiredRole})` : 
                    userPreferences.desiredRole
      };
    });
  } catch (error) {
    console.error('Error finding matching jobs:', error);
    console.log('Returning fallback job matches');
    
    // Provide fallback job matches instead of failing completely
    return generateFallbackJobMatches(userPreferences);
  }
}

function generateFallbackJobMatches(userPreferences = {}) {
  // Generate some reasonable fallback matches when Pinecone query fails
  const role = userPreferences.desiredRole || userPreferences.originalDesiredRole || 'Software Developer';
  
  return [
    {
      id: 'fallback-1',
      jobTitle: role,
      company: 'TechCorp',
      location: userPreferences.location || 'Remote',
      employmentType: 'Full-time',
      salary: '$90,000 - $120,000',
      applyLink: '#',
      description: `We're looking for an experienced ${role} to join our team...`,
      postedDate: '1 week ago',
      matchScore: 0.75,
      isFallback: true
    },
    {
      id: 'fallback-2',
      jobTitle: `Senior ${role}`,
      company: 'InnovateTech',
      location: userPreferences.location || 'Remote',
      employmentType: 'Full-time',
      salary: '$110,000 - $150,000',
      applyLink: '#',
      description: `Senior ${role} position with opportunity for growth...`,
      postedDate: '3 days ago',
      matchScore: 0.72,
      isFallback: true
    }
  ];
}

app.post('/api/expand-acronym', (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    const expanded = expandProfessionalAcronyms(text);
    
    // Log expansions for monitoring
    if (expanded !== text) {
      console.log(`Acronym expanded: "${text}" -> "${expanded}"`);
    }
    
    res.json({ 
      original: text, 
      expanded, 
      wasExpanded: expanded !== text 
    });
  } catch (error) {
    console.error('Acronym expansion error:', error);
    res.status(500).json({ error: 'Error expanding acronym' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`CORS is configured to allow requests from ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});