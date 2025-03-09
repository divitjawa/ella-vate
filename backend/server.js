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

// Initialize Express app
const app = express();
const port = process.env.PORT || 5050;

// Set up CORS middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://ella-vate-ui.onrender.com',
    process.env.FRONTEND_URL,
  ].filter(Boolean),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads folder
app.use('/uploads', express.static('uploads'));

// Set up file upload with multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, 'uploads/'); },
  filename: (req, file, cb) => { cb(null, `${Date.now()}-${file.originalname}`); }
});
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
const upload = multer({ storage });

// Connect to MongoDB with error handling
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
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
  originalCurrentRole: { type: String },  // store original input
  desiredRole: { type: String },
  originalDesiredRole: { type: String },  // store original input
  createdAt: { type: Date, default: Date.now },
  savedJobs: [{
    jobId: String,
    jobTitle: String,
    company: String,
    matchScore: Number,
    savedAt: { type: Date, default: Date.now },
  }],
  generatedCoverLetters: [{
    jobId: String,
    jobTitle: String,
    company: String,
    coverLetterText: String,
    generatedAt: { type: Date, default: Date.now },
  }],
});
const User = mongoose.model('User', userSchema);

// Initialize OpenAI client
let openai;
try {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is missing. Check your .env file.');
  } else {
    console.log('Initializing OpenAI with API key');
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
} catch (error) {
  console.error('Error initializing OpenAI client:', error);
}

// Initialize Pinecone client
let pinecone;
let index;

try {
  console.log('Initializing Pinecone with environment:', process.env.PINECONE_ENVIRONMENT);
  
  if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_ENVIRONMENT) {
    throw new Error('Missing Pinecone API key or environment.');
  } else {
    pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    
    // Get a reference to your index
    const indexName = process.env.PINECONE_INDEX || 'ella-vate-jobs';
    console.log('Connecting to Pinecone index:', indexName);
    
    index = pinecone.index(indexName);
  }
} catch (error) {
  console.error('Error initializing Pinecone:', error);
  console.warn('Continuing server startup despite Pinecone initialization failure');
  // Do not exit the process to allow graceful fallbacks
}

// -------------------- Helper Functions --------------------

/**
 * Expand common professional acronyms to full forms.
 */
function expandProfessionalAcronyms(text) {
  if (!text) return text;
  const inputText = String(text).trim();
  const acronyms = {
    // Technology roles
    swe: 'software engineer',
    se: 'software engineer',
    dev: 'developer',
    fs: 'full stack',
    fsd: 'full stack developer',
    fe: 'frontend',
    fed: 'frontend developer',
    be: 'backend',
    bed: 'backend developer',
    devops: 'development operations',
    ml: 'machine learning',
    mle: 'machine learning engineer',
    ds: 'data scientist',
    da: 'data analyst',
    de: 'data engineer',
    ai: 'artificial intelligence',
    // Management roles
    pm: 'product manager',
    po: 'product owner',
    sm: 'scrum master',
    'eng mgr': 'engineering manager',
    em: 'engineering manager',
    tpm: 'technical program manager',
    cto: 'chief technology officer',
    cio: 'chief information officer',
    'vp eng': 'vice president of engineering',
    // Design roles
    ui: 'user interface',
    ux: 'user experience',
    'ui/ux': 'user interface and user experience',
    // Marketing and business
    seo: 'search engine optimization',
    sem: 'search engine marketing',
    cro: 'conversion rate optimization',
    'biz dev': 'business development',
    bd: 'business development',
    ba: 'business analyst',
    vc: 'venture capital',
    // IT and operations
    sre: 'site reliability engineer',
    infra: 'infrastructure',
    'sys admin': 'system administrator',
    qa: 'quality assurance',
    // Common supplementary terms
    jr: 'junior',
    sr: 'senior',
    mgr: 'manager',
    dir: 'director',
    exec: 'executive',
    lead: 'team lead',
    tech: 'technical',
    eng: 'engineer',
  };
  const lowerText = inputText.toLowerCase();
  if (acronyms[lowerText]) return acronyms[lowerText];

  let words = inputText.split(/\s+/);
  let expanded = false;
  for (let i = 0; i < words.length; i++) {
    const word = words[i].toLowerCase();
    if (acronyms[word]) {
      words[i] = acronyms[word];
      expanded = true;
    }
  }
  if (expanded) return words.join(' ');

  for (const [acronym, expansion] of Object.entries(acronyms)) {
    const regex = new RegExp(`\\b${acronym}\\b`, 'gi');
    if (regex.test(inputText)) {
      return inputText.replace(regex, expansion);
    }
  }
  return inputText;
}

/**
 * Extract text from resume files (PDF, DOCX, TXT).
 */
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

/**
 * Expand acronyms within a text block.
 */
function expandAcronymsInText(text) {
  if (!text) return text;
  const words = text.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const expanded = expandProfessionalAcronyms(words[i]);
    if (expanded !== words[i]) {
      words[i] = `${words[i]} ${expanded}`;
    }
  }
  return words.join(' ');
}

/**
 * Extract a section from text based on possible section header names.
 */
function extractSection(text, sectionNames) {
  for (const name of sectionNames) {
    const pattern = new RegExp(
      `\\b${name}\\b[:\\s]*(.*?)(?=\\b(experience|employment|work history|skills|technical skills|technologies|education|academic|qualifications|projects|portfolio|references)\\b|$)`,
      'is'
    );
    const match = text.match(pattern);
    if (match && match[1]) return match[1].trim();
  }
  return '';
}

/**
 * Create a simple deterministic hash for a text.
 */
function createTextHash(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash;
}

/**
 * Deterministic pseudo-random generator.
 */
function deterministicRandom(seed) {
  return function () {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

/**
 * Generate a consistent mock embedding based on a text hash.
 */
function generateConsistentMockEmbedding(seed) {
  const rand = deterministicRandom(seed);
  return Array(1536).fill(0).map(() => rand() * 2 - 1);
}

/**
 * Extract key terms from text.
 */
function extractKeyTerms(text) {
  const words = text.toLowerCase().split(/\W+/);
  const stopWords = new Set(['the', 'and', 'or', 'of', 'to', 'a', 'in', 'for', 'with', 'on', 'at', 'from', 'by']);
  const wordCounts = {};
  for (const word of words) {
    if (word.length > 3 && !stopWords.has(word)) {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    }
  }
  return Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(entry => entry[0]);
}

/**
 * Create a fallback embedding using keywords.
 */
function createKeywordFallbackEmbedding(text) {
  const keywords = extractKeyTerms(text);
  const keywordHash = createTextHash(keywords.join(' '));
  return generateConsistentMockEmbedding(keywordHash);
}

/**
 * Generate embedding using OpenAI (or fallback if not configured).
 */
async function generateEmbedding(text) {
  try {
    console.log('Generating embedding for text of length:', text.length);
    if (!openai) {
      console.log('OpenAI not configured, using consistent mock embedding');
      const hash = createTextHash(text);
      return generateConsistentMockEmbedding(hash);
    }
    let processedText = text;
    if (text.length > 32000) {
      console.log('Text too long, truncating');
      processedText = text.substring(0, 20000) + ' ' + text.substring(text.length - 10000);
    }
    const keyTerms = extractKeyTerms(processedText);
    const enhancedText = processedText + ' ' + keyTerms.join(' ');
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: enhancedText,
    });
    const embedding = response.data[0].embedding;
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) {
      console.warn('Warning: Zero magnitude embedding generated');
      return embedding;
    }
    const normalizedEmbedding = embedding.map(val => val / magnitude);
    console.log('Embedding generated and normalized successfully');
    return normalizedEmbedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    console.log('Using keyword-based fallback embedding');
    return createKeywordFallbackEmbedding(text);
  }
}

/**
 * Select embedding method for A/B testing.
 */
function selectEmbeddingMethod(sessionId) {
  // Simple A/B testing based on session ID
  const methods = ['standard', 'enhanced', 'sectionWeighted'];
  const hash = parseInt(sessionId.substring(sessionId.length - 4), 16);
  return methods[hash % methods.length];
}

/**
 * Generate embedding with a specific method for A/B testing.
 */
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

/**
 * Check if the job is entry-level based on its title or description.
 */
function isEntryLevelPosition(metadata) {
  if (!metadata) return false;
  const jobTitle = (metadata.job_title || '').toLowerCase();
  const description = (metadata.description || '').toLowerCase();
  const entryTerms = ['entry', 'junior', 'jr', 'associate', 'trainee', 'beginner', 'intern', 'apprentice'];
  if (entryTerms.some(term => jobTitle.includes(term))) return true;
  const entryPhrases = ['no experience required', 'entry level', 'junior position', '0-1 year', '0-2 year', 'recent graduate', 'training provided', 'entry-level', 'junior role', 'no prior experience', 'ideal for beginners'];
  return entryPhrases.some(phrase => description.includes(phrase));
}

/**
 * Check if the job description mentions transferable skills.
 */
function hasTransferableSkillsForRoles(description, currentRole, desiredRole) {
  if (!description) return false;
  const descriptionLower = description.toLowerCase();
  const transferableSkills = [
    'communication', 'problem solving', 'analytical', 'teamwork',
    'collaboration', 'project management', 'leadership',
    'critical thinking', 'adaptability', 'learning',
    'organizational', 'detail-oriented', 'time management',
    'research', 'presentation', 'interpersonal', 'documentation'
  ];
  const skillsFound = transferableSkills.filter(skill => descriptionLower.includes(skill));
  if (skillsFound.length >= 3) return true;
  const openBackgroundPhrases = [
    'different background', 'diverse experience', 'career changer',
    'career transition', 'transferable skills', 'equivalent experience',
    'willing to learn', 'fast learner', 'related field', 'open to candidates from',
    'skills from other industries'
  ];
  return openBackgroundPhrases.some(phrase => descriptionLower.includes(phrase));
}

/**
 * Determine if the candidate is likely undergoing a career transition.
 */
function isLikelyCareerTransition(currentRole, desiredRole) {
  if (!currentRole || !desiredRole) return false;
  const currentNormalized = currentRole.toLowerCase();
  const desiredNormalized = desiredRole.toLowerCase();
  if (currentNormalized === desiredNormalized) return false;
  if (currentNormalized.includes(desiredNormalized) || desiredNormalized.includes(currentNormalized))
    return false;
  const clusters = [
    ['software', 'developer', 'engineer', 'frontend', 'backend', 'fullstack', 'web', 'mobile', 'programmer'],
    ['devops', 'sre', 'infrastructure', 'cloud', 'system', 'admin', 'ops', 'reliability'],
    ['data', 'analyst', 'scientist', 'analytics', 'business intelligence', 'bi', 'database', 'machine learning', 'ai'],
    ['security', 'cyber', 'infosec', 'compliance', 'risk', 'governance', 'penetration', 'audit'],
    ['manager', 'director', 'lead', 'product', 'project', 'program', 'scrum', 'agile', 'executive'],
    ['design', 'ux', 'ui', 'user experience', 'graphic', 'creative', 'visual'],
  ];
  for (const cluster of clusters) {
    const currentInCluster = cluster.some(term => currentNormalized.includes(term));
    const desiredInCluster = cluster.some(term => desiredNormalized.includes(term));
    if (currentInCluster && desiredInCluster) return false;
  }
  return true;
}

/**
 * Calculate statistics for match results.
 */
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

/**
 * Merge resume-based and desired role–based matches and calculate an initial final score.
 */

/**
 * Format posted date to a more reader-friendly format.
 */
function formatPostedDate(dateString) {
  if (!dateString) return 'Date not specified';
  
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 1) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    
    // Format as "Feb 13, 2025"
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString;
  }
}

/**
 * Get a clear explanation of why this job was matched.
 */
function getMatchReason(match, isCareerTransition, currentRole, desiredRole) {
  // Determine which score is higher
  const skillsScore = Math.round(match.backgroundMatchScore * 100);
  const roleScore = Math.round(match.goalMatchScore * 100);
  
  if (skillsScore > 50 && roleScore > 50) {
    return `This job matches both your current skills (${skillsScore}%) and desired role (${roleScore}%)`;
  } else if (skillsScore > roleScore) {
    return `This job primarily matches your current skills in ${currentRole} (${skillsScore}%)`;
  } else if (roleScore > skillsScore) {
    return `This job aligns with your desired ${desiredRole} career path (${roleScore}%)`;
  } else if (match.isEntryLevel) {
    return `This entry-level position could be suitable for your career transition`;
  } else {
    return `This position matches your profile at a moderate level`;
  }
}


function mergeDualScoreMatches(resumeMatches, roleMatches, titleMatches, additionalInfoMatches, isCareerTransition) {
  const matchMap = new Map();
  
  // Process resume matches (background match dimension)
  resumeMatches.forEach(match => {
    const enhancedScore = Math.min(match.score * 1.2, 1.0);
    matchMap.set(match.id, {
      id: match.id,
      score: match.score,
      metadata: match.metadata || {},
      // Background match score
      backgroundMatchScore: enhancedScore,
      // Goal match score
      goalMatchScore: 0,
      factors: [],
      isEntryLevel: isEntryLevelPosition(match.metadata),
      hasTransferableSkills: hasTransferableSkillsForRoles(match.metadata?.description || '', '', ''),
    });
  });
  
  // Process desired role matches (goal match dimension)
  roleMatches.forEach(match => {
    const enhancedScore = Math.min(match.score * 1.2, 1.0);
    if (matchMap.has(match.id)) {
      const existingMatch = matchMap.get(match.id);
      existingMatch.goalMatchScore = enhancedScore;
    } else {
      matchMap.set(match.id, {
        id: match.id,
        score: match.score,
        metadata: match.metadata || {},
        backgroundMatchScore: 0,
        goalMatchScore: enhancedScore,
        factors: [],
        isEntryLevel: isEntryLevelPosition(match.metadata),
        hasTransferableSkills: hasTransferableSkillsForRoles(match.metadata?.description || '', '', ''),
      });
    }
  });
  
  // Optionally include title and additional info matches
  // This part can be simplified or removed if you want to streamline the system
  
  return Array.from(matchMap.values()).map(match => {
    let finalScore;
    
    // Ensure scores exist
    match.backgroundMatchScore = Math.round(match.backgroundMatchScore * 100) / 100;
    match.goalMatchScore = Math.round(match.goalMatchScore * 100) / 100;
    match.finalScore = Math.round(match.finalScore * 100) / 100;
    
    // Adjust weights based on career transition status
    if (isCareerTransition) {
      // Career transitioners value goal match more
      finalScore = (match.backgroundMatchScore * 0.4) + (match.goalMatchScore * 0.6);
    } else {
      // Non-transitioners value background match more
      finalScore = (match.backgroundMatchScore * 0.7) + (match.goalMatchScore * 0.3);
    }
    
    // Score normalization and enhancement
    // Lower the minimum score threshold, increase differentiation
    if (finalScore < 0.05) {
      finalScore = 0.05 + (finalScore * 3); // Slightly boost very low scores
    } else if (finalScore < 0.2) {
      finalScore = 0.2 + (finalScore * 1.5); // Moderately boost low scores
    }
    
    // Cap maximum score at 0.95
    finalScore = Math.min(Math.max(finalScore, 0.3), 0.95);
    match.finalScore = finalScore;
    
    return match;
  });
}




/**
 * Apply additional factors to adjust the final score.
 */

function applyAdditionalFactors(matches, userPreferences, isCareerTransition) {
  const currentRole = userPreferences.currentRole || '';
  const desiredRole = userPreferences.desiredRole || '';
  const maxScore = isCareerTransition ? 0.95 : 0.98;
  return matches.map(match => {
    let score = match.finalScore;
    const jobTitle = (match.metadata.job_title || '').toLowerCase();
    const jobDescription = (match.metadata.description || '').toLowerCase();
    match.hasTransferableSkills = hasTransferableSkillsForRoles(jobDescription, currentRole, desiredRole);
    
    if (match.isEntryLevel) {
      score *= isCareerTransition ? 1.3 : 1.1;
      match.factors.push('entry_level_position');
    }
    
    if (match.hasTransferableSkills) {
      score *= 1.2;
      match.factors.push('transferable_skills');
    }
    
    if (userPreferences.preferRemote && match.metadata.location && match.metadata.location.toLowerCase().includes('remote')) {
      score *= 1.15;
      match.factors.push('remote_match');
    }
    
    if (jobTitle.includes(desiredRole.toLowerCase())) {
      score *= 1.2;
      match.factors.push('title_match');
    }
    
    if (currentRole && jobTitle.includes(currentRole.toLowerCase())) {
      score *= 1.15;
      match.factors.push('experience_match');
    }
    
    score = Math.min(Math.max(score, 0.4), maxScore);
    match.finalScore = score;
    return match;
  }).sort((a, b) => b.finalScore - a.finalScore);
}


/**
 * Generate a human-readable explanation for the match.
 */
function generateMatchExplanation(match, isCareerTransition, currentRole, desiredRole) {
  if (isCareerTransition) {
    if (match.backgroundMatchScore > 0.5) {
      return `Your background in ${currentRole} has many transferable skills relevant to this position.`;
    } else if (match.goalMatchScore > 0.5) {
      return `This position aligns well with your desired role as a ${desiredRole}.`;
    } else if (match.isEntryLevel) {
      return `This entry-level position could be a good starting point for your career transition.`;
    } else if (match.hasTransferableSkills) {
      return `This role values transferable skills from your current background.`;
    } else {
      return `This position partially matches both your current skills and desired role.`;
    }
  } else {
    if (match.backgroundMatchScore > 0.5 && match.goalMatchScore > 0.5) {
      return `Strong match for both your experience and desired career direction.`;
    } else if (match.backgroundMatchScore > 0.5) {
      return `Your current skills and experience are well-suited for this position.`;
    } else if (match.goalMatchScore > 0.5) {
      return `This position aligns well with your career goals.`;
    } else {
      return `Moderate match based on your overall profile.`;
    }
  }
}

/**
 * Get a qualitative description of the match quality.
 */

function getMatchQualityDescription(match, isCareerTransition) {
  const score = match.finalScore;
  if (isCareerTransition) {
    if (score > 0.75) return "Excellent Transition Match";
    if (score > 0.6) return "Strong Transition Opportunity";
    if (score > 0.45) return "Potential Transition Path";
    if (score > 0.3) return "Challenging Transition";
    return "Significant Qualification Gap";
  } else {
    if (score > 0.8) return "Excellent Match";
    if (score > 0.65) return "Strong Match";
    if (score > 0.5) return "Good Match";
    if (score > 0.4) return "Moderate Match";
    return "Partial Match";
  }
}


/**
 * Generate fallback job matches when Pinecone query fails.
 */
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

// Step 1: Remove the duplicate getMatchQualityDescription function
// You have two identical functions in your code - remove the second one

// Step 2: Add the findMatchingJobs function right after the generateFallbackJobMatches function
// and before the Authentication Middleware section:

/**
 * Find matching jobs using Pinecone.
 */
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
        filters.job_title = { "$in": Array.from(roleKeywords) };
      }
    }
    
    if (userPreferences.location) {
      filters.location = { "$in": [userPreferences.location.toLowerCase()] };
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
    
    return matches;
  } catch (error) {
    console.error('Error finding matching jobs:', error);
    return [];
  }
}



// -------------------- Authentication Middleware --------------------

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });
  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET || 'your_secure_jwt_secret_key_here');
    req.user = verified;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// -------------------- API Endpoints --------------------

// User Registration Endpoint
app.post('/api/auth/register', async (req, res) => {
  try {
    console.log('Registration endpoint called');
    const { email, password, fullName } = req.body;
    console.log('Registration request for:', email);
    
    if (mongoose.connection.readyState !== 1) {
      console.log('MongoDB not connected, using mock registration');
      const token = 'mock_token_' + Date.now();
      return res.status(201).json({ 
        token, 
        user: { 
          id: 'mock_id_' + Date.now(), 
          email, 
          fullName 
        }
      });
    }
    
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ error: 'User already exists' });
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const user = new User({ email, password: hashedPassword, fullName });
    const savedUser = await user.save();
    
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
  ].filter(Boolean);
  
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
    
    if (mongoose.connection.readyState !== 1) {
      console.log('MongoDB not connected, using mock login');
      const token = 'mock_token_' + Date.now();
      return res.status(200).json({ 
        token, 
        user: { 
          id: 'mock_id_' + Date.now(), 
          email, 
          fullName: 'Mock User' 
        }
      });
    }
    
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid email or password' });
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Invalid email or password' });
    
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

// Get User Profile Endpoint
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ 
        id: req.user.id, 
        email: req.user.email, 
        fullName: 'Mock User', 
        currentRole: 'Software Engineer', 
        desiredRole: 'Machine Learning Engineer' 
      });
    }
    
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    res.json(user);
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Error fetching profile' });
  }
});

// Update User Profile Endpoint
app.put('/api/profile', authenticateToken, async (req, res) => {
  try {
    const { fullName, currentRole, desiredRole } = req.body;
    
    const expandedCurrentRole = expandProfessionalAcronyms(currentRole);
    const expandedDesiredRole = expandProfessionalAcronyms(desiredRole);
    
    console.log(`Updating profile - Current role: "${currentRole}" -> "${expandedCurrentRole}"`);
    console.log(`Updating profile - Desired role: "${desiredRole}" -> "${expandedDesiredRole}"`);
    
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        id: req.user.id,
        email: req.user.email,
        fullName: fullName || 'Mock User',
        currentRole: expandedCurrentRole || 'Software Engineer',
        desiredRole: expandedDesiredRole || 'Machine Learning Engineer',
        originalCurrentRole: currentRole,
        originalDesiredRole: desiredRole,
      });
    }
    
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
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
      originalDesiredRole: desiredRole,
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Error updating profile' });
  }
});

// Save Job Endpoint
app.post('/api/saved-jobs', authenticateToken, async (req, res) => {
  try {
    const { jobId, jobTitle, company, matchScore } = req.body;
    
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
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const jobExists = user.savedJobs.find(job => job.jobId === jobId);
    if (jobExists) return res.status(400).json({ error: 'Job already saved' });
    
    user.savedJobs.push({ 
      jobId, 
      jobTitle, 
      company, 
      matchScore, 
      savedAt: new Date() 
    });
    
    await user.save();
    
    res.status(201).json({ 
      message: 'Job saved successfully', 
      savedJobs: user.savedJobs 
    });
  } catch (error) {
    console.error('Save job error:', error);
    res.status(500).json({ error: 'Error saving job' });
  }
});

// Get Saved Jobs Endpoint
app.get('/api/saved-jobs', authenticateToken, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json([{ 
        jobId: 'mock_job_1', 
        jobTitle: 'Machine Learning Engineer', 
        company: 'TechCorp', 
        matchScore: 0.92, 
        savedAt: new Date() 
      }]);
    }
    
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    res.json(user.savedJobs);
  } catch (error) {
    console.error('Get saved jobs error:', error);
    res.status(500).json({ error: 'Error fetching saved jobs' });
  }
});

// Generate Cover Letter Endpoint
app.post('/api/generate-cover-letter', authenticateToken, async (req, res) => {
  try {
    const { jobId, jobTitle, company, jobDescription, resumeText } = req.body;
    
    if (!jobTitle || !company || !jobDescription || !resumeText) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (!openai) {
      console.log('OpenAI not configured, using mock cover letter');
      const mockCoverLetter = `
Dear Hiring Manager,

I am writing to express my interest in the ${jobTitle} position at ${company}. With my background in machine learning and data science, I believe I am well-suited for this role.

My experience includes developing and deploying machine learning models, working with large datasets, and implementing natural language processing solutions. I am proficient in Python, TensorFlow, and PyTorch, and have experience with cloud platforms such as AWS and Google Cloud.

In my current role as a Software Engineer, I have led several projects that involved machine learning components, including a recommendation system that increased user engagement by 25%. I am particularly interested in joining ${company} because of your innovative work in artificial intelligence and commitment to solving real-world problems with technology.

I am excited about the opportunity to contribute to your team and help advance your mission. Thank you for considering my application.

Sincerely,
[Your Name]
`;
      
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
          console.error('Error saving mock cover letter:', err);
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
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: "You are an expert career advisor who specializes in writing compelling cover letters that highlight a candidate's relevant qualifications."
        },
        {
          role: 'user',
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

// Get Generated Cover Letters Endpoint
app.get('/api/cover-letters', authenticateToken, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json([{ 
        jobId: 'mock_job_1', 
        jobTitle: 'Machine Learning Engineer', 
        company: 'TechCorp', 
        coverLetterText: 'This is a mock cover letter for a Machine Learning Engineer position at TechCorp.', 
        generatedAt: new Date() 
      }]);
    }
    
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    res.json(user.generatedCoverLetters);
  } catch (error) {
    console.error('Get cover letters error:', error);
    res.status(500).json({ error: 'Error fetching cover letters' });
  }
});

// Expand acronym endpoint
app.post('/api/expand-acronym', (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });
    
    const expanded = expandProfessionalAcronyms(text);
    
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

// Main Profile Submission and Job Matching Endpoint
app.post('/api/profile', upload.single('resume'), async (req, res) => {
  try {
    console.log('Process profile request received');
    const resumeFile = req.file;
    
    if (!resumeFile) {
      return res.status(400).json({ error: 'No resume file uploaded' });
    }

    console.log('Resume file received:', resumeFile.originalname);
    
    // Get fields from the request
    const { fullName, currentRole, desiredRole, location, preferRemote, additionalInfo } = req.body;
    
    // Expand acronyms in role fields
    const expandedCurrentRole = expandProfessionalAcronyms(currentRole);
    const expandedDesiredRole = expandProfessionalAcronyms(desiredRole);
    
    console.log(`Current role expanded: "${currentRole}" -> "${expandedCurrentRole}"`);
    console.log(`Desired role expanded: "${desiredRole}" -> "${expandedDesiredRole}"`);
    
    // Process the resume
    const resumeText = await extractTextFromResume(resumeFile.path);
    console.log('Resume text extracted and processed, length:', resumeText.length);
    
    // Create user profile with expanded roles
    const userProfile = {
      fullName,
      currentRole: expandedCurrentRole,
      desiredRole: expandedDesiredRole,
      originalCurrentRole: currentRole,
      originalDesiredRole: desiredRole,
      location,
      preferRemote: preferRemote === 'true',
      additionalInfo,
      resumeTextLength: resumeText.length,
      resumeFile: resumeFile.originalname,
      resumeText: resumeText,
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
      console.log('Falling back to standard embedding method');
      embedding = await generateEmbedding(resumeText);
    }
    
    // User preferences for job matching with expanded roles
    const userPreferences = {
      desiredRole: expandedDesiredRole,
      originalDesiredRole: desiredRole,
      location,
      preferRemote: preferRemote === 'true',
      currentRole: expandedCurrentRole,
      originalCurrentRole: currentRole,
    };
    
    console.log('Finding matching jobs with preferences:', JSON.stringify(userPreferences));

    // Query using resume embedding
    const resumeQueryOptions = {
      vector: embedding,
      topK: 50,
      includeMetadata: true,
      includeValues: false,
    };
    
    if (userPreferences.location) {
      resumeQueryOptions.filter = { 
        location: { '$containsAny': [userPreferences.location.toLowerCase()] } 
      };
    }
    
    let resumeMatches = [];
    let roleMatches = [];
    
    try {
      const resumeMatchesResponse = await index.query(resumeQueryOptions);
      resumeMatches = resumeMatchesResponse.matches;
      console.log(`Resume embedding query returned ${resumeMatches.length} matches`);
    } catch (error) {
      console.error('Error querying Pinecone with resume embedding:', error);
      resumeMatches = [];
    }

    // Generate embedding for desired role
    console.log('Generating embedding for desired role');
    let desiredRoleEmbedding;
    try {
      const desiredRoleText = expandProfessionalAcronyms(desiredRole);
      desiredRoleEmbedding = await generateEmbedding(desiredRoleText);
    } catch (error) {
      console.error('Error generating desired role embedding:', error);
      desiredRoleEmbedding = createKeywordFallbackEmbedding(desiredRole);
    }

    // Generate embedding for additional info if provided
    let additionalInfoEmbedding = null;
    if (additionalInfo && additionalInfo.trim()) {
      console.log('Generating embedding for additional info');
      try {
        additionalInfoEmbedding = await generateEmbedding(additionalInfo);
      } catch (error) {
        console.error('Error generating additional info embedding:', error);
        additionalInfoEmbedding = additionalInfo ? createKeywordFallbackEmbedding(additionalInfo) : null;
      }
    }

    const roleQueryOptions = {
      vector: desiredRoleEmbedding,
      topK: 50,
      includeMetadata: true,
      includeValues: false,
    };

    // Query for title matches
    const titleQueryOptions = {
      vector: desiredRoleEmbedding,
      topK: 30,
      includeMetadata: true,
      includeValues: false,
      filter: { job_title: { '$exists': true } } // Only return jobs with titles
    };

    let titleMatches = [];
    try {
      const titleMatchesResponse = await index.query(titleQueryOptions);
      titleMatches = titleMatchesResponse.matches;
      console.log(`Title-specific query returned ${titleMatches.length} matches`);
    } catch (error) {
      console.error('Error querying Pinecone with title-specific query:', error);
      titleMatches = [];
    }
    
    if (userPreferences.location) {
      roleQueryOptions.filter = { 
        location: { '$containsAny': [userPreferences.location.toLowerCase()] } 
      };
    }
    
    try {
      const roleMatchesResponse = await index.query(roleQueryOptions);
      roleMatches = roleMatchesResponse.matches;
      console.log(`Desired role embedding query returned ${roleMatches.length} matches`);
    } catch (error) {
      console.error('Error querying Pinecone with role embedding:', error);
      roleMatches = [];
    }

    console.log('Sample resume match metadata:', resumeMatches.length > 0 ? 
      JSON.stringify(resumeMatches[0].metadata, null, 2) : 'No resume matches');
    console.log('Sample role match metadata:', roleMatches.length > 0 ? 
      JSON.stringify(roleMatches[0].metadata, null, 2) : 'No role matches');
    console.log('Sample title match metadata:', titleMatches.length > 0 ? 
      JSON.stringify(titleMatches[0].metadata, null, 2) : 'No title matches');
    
    // Check if we need to use fallback jobs 
    if (resumeMatches.length === 0 && roleMatches.length === 0) {
      console.log('No matches found, using fallback jobs');
      const fallbackJobs = generateFallbackJobMatches(userPreferences);
      
      return res.json({
        profile: userProfile,
        matches: fallbackJobs,
        embeddingMethod,
        fallback: true,
        matchStats: calculateMatchStats(fallbackJobs)
      });

      console.log('Sending response with resume text length:', userProfile.resumeText ? userProfile.resumeText.length : 0);
    }

    // Merge resume and role matches, then calculate dual scores
    const careerTransition = isLikelyCareerTransition(expandedCurrentRole, expandedDesiredRole);
    console.log(`Career transition detected: ${careerTransition ? 'YES' : 'NO'}`);


    // If additionalInfo was provided, query with it
    let additionalInfoMatches = [];
    if (additionalInfoEmbedding) {
      try {
        const additionalInfoQueryOptions = {
          vector: additionalInfoEmbedding,
          topK: 30,
          includeMetadata: true,
          includeValues: false,
        };
        const additionalInfoMatchesResponse = await index.query(additionalInfoQueryOptions);
        additionalInfoMatches = additionalInfoMatchesResponse.matches;
        console.log(`Additional info query returned ${additionalInfoMatches.length} matches`);
      } catch (error) {
        console.error('Error querying Pinecone with additional info:', error);

      }
    }

    // Merge all matches
    let mergedMatches = mergeDualScoreMatches(
      resumeMatches, 
      roleMatches, 
      titleMatches, 
      additionalInfoMatches,
      careerTransition
    );
    

    console.log(`After merging, total matches: ${mergedMatches.length}`);

    const scoredMatches = applyAdditionalFactors(mergedMatches, userPreferences, careerTransition);
    console.log(`After applying additional factors, total matches: ${scoredMatches.length}`);

    // Slice the final matches to only take the top 10
    const finalMatches = scoredMatches.slice(0, 10);
    console.log(`Final matches count (slice(0,10)): ${finalMatches.length}`);

    
    
    
    
    
    
    
    
    
    finalMatches.forEach((match, idx) => {
      console.log(`Final Match #${idx + 1}: ${match.metadata.job_title} | finalScore=${match.finalScore.toFixed(2)}`);
    });

    res.json({
      profile: userProfile,
      matches: finalMatches.map(match => {
        // Optional: Add debug logging
        console.log(`Processing match ${match.id}:`, JSON.stringify({
          metadata: match.metadata,
          scores: {
            finalScore: match.finalScore,
            backgroundMatchScore: match.backgroundMatchScore,
            goalMatchScore: match.goalMatchScore
          }
        }, null, 2));
        
        return {
          id: match.id,
          jobTitle: match.metadata?.title || match.metadata?.job_title || 'Untitled Position',
          company: match.metadata?.company || match.metadata?.company_name || 'Unknown Company',
          location: match.metadata?.location || 'Multiple Locations',
          // Replace employmentType with remote status
          remote: match.metadata?.remote || 'Not Specified',
          salary: match.metadata?.salary || match.metadata?.salary_range || 'Not Specified',
          applyLink: match.metadata?.job_apply_link || match.metadata?.url || '#',
          description: match.metadata?.description || match.metadata?.job_description || '',
          // Format the date in a more readable way
          postedDate: formatPostedDate(match.metadata?.posted_at || match.metadata?.posted_date),
          // Update scores to ensure consistency
          matchScore: Math.round(match.finalScore * 100) / 100,
          skillsMatch: Math.round(match.backgroundMatchScore * 100) / 100, 
          roleRelevance: Math.round(match.goalMatchScore * 100) / 100,
          matchQuality: getMatchQualityDescription(match, careerTransition),
          isCareerTransition: careerTransition,
          // Improve match explanation
          matchExplanation: generateMatchExplanation(match, careerTransition, expandedCurrentRole, expandedDesiredRole),
          // Create a better matched with message
          matchReason: getMatchReason(match, careerTransition, expandedCurrentRole, expandedDesiredRole),
        };
      
      }),

      embeddingMethod,
      matchStats: calculateMatchStats(finalMatches)
    });



    
  } catch (error) {
    console.error('Error processing profile:', error);
    res.status(500).json({ error: 'Error processing profile: ' + error.message });
  }
});

// Pinecone Health Check Endpoint
app.get('/api/pinecone-health', async (req, res) => {
  try {
    if (!index) return res.status(500).json({ status: 'error', message: 'Pinecone index not initialized' });
    const stats = await index.describeIndexStats();
    return res.json({ 
      status: 'healthy', 
      vectorCount: stats.totalVectorCount, 
      namespaces: stats.namespaces, 
      dimensions: stats.dimension 
    });
  } catch (error) {
    console.error('Pinecone health check failed:', error);
    return res.status(500).json({ 
      status: 'error', 
      message: error.message, 
      code: error.status || 'unknown' 
    });
  }
});

app.get('/api/test-pinecone', async (req, res) => {
  try {
    const result = await testPineconeConnection();
    res.json(result);
  } catch (error) {
    console.error('Pinecone test error:', error);
    res.status(500).json({ error: 'Error testing Pinecone connection' });
  }
});

async function debugPineconeQuery(embedding) {
  try {
    const basicQueryOptions = { vector: embedding, topK: 10, includeMetadata: true };
    console.log('Running basic Pinecone query with options:', JSON.stringify(basicQueryOptions));
    const response = await index.query(basicQueryOptions);
    console.log(`Basic query returned ${response.matches?.length || 0} results`);
    return response;
  } catch (error) {
    console.error('Basic Pinecone query failed:', error);
    throw error;
  }
}

app.post('/api/debug-pinecone', async (req, res) => {
  try {
    const mockEmbedding = Array(1536).fill(0).map(() => Math.random() * 2 - 1);
    const result = await debugPineconeQuery(mockEmbedding);
    res.json(result);
  } catch (error) {
    console.error('Debug Pinecone error:', error);
    res.status(500).json({ error: 'Error debugging Pinecone' });
  }
});

// -------------------- Environment Variables Check --------------------

console.log('\n----- Environment Variables Check -----');
console.log(`- PINECONE_API_KEY: ${process.env.PINECONE_API_KEY ? '✓ Set' : '✗ Missing'}`);
console.log(`- PINECONE_ENVIRONMENT: ${process.env.PINECONE_ENVIRONMENT ? '✓ Set' : '✗ Missing'}`);
console.log(`- PINECONE_INDEX: ${process.env.PINECONE_INDEX ? '✓ Set' : `✗ Using default 'ella-vate-jobs'`}`);
console.log(`- OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✓ Set' : '✗ Missing'}`);
console.log(`- MONGODB_URI: ${process.env.MONGODB_URI ? '✓ Set' : '✗ Missing'}`);
console.log(`- JWT_SECRET: ${process.env.JWT_SECRET ? '✓ Set' : '✗ Using default secure key'}`);
console.log(`- FRONTEND_URL: ${process.env.FRONTEND_URL ? '✓ Set' : '✗ Using localhost:3000'}`);
console.log('----------------------------------------\n');

// -------------------- Start the Server --------------------

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`CORS is configured to allow requests from ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Test Pinecone Connection
async function testPineconeConnection() {
  try {
      console.log('Testing with:', {
          environment: process.env.PINECONE_ENVIRONMENT,
          index: process.env.PINECONE_INDEX,
          apiKeyPrefix: process.env.PINECONE_API_KEY.substring(0, 10) + '...'
      });
      
      const vector = Array(1536).fill(0.1);
      const result = await index.query({
          vector,
          topK: 1,
          includeMetadata: true
      });
      
      console.log('Query response:', JSON.stringify(result).substring(0, 200) + '...');
      return { success: true, message: 'Pinecone connection test successful' };
  } catch (error) {
      console.error('Pinecone test failed:', error);
      return { 
          success: false, 
          error: error.message, 
          details: error.details || {}
      };
  }
}