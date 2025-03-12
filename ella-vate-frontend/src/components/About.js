import React from 'react';
import './About.css';

function About() {
  return (
    <div className="about-container">
      <div className="about-header">
        <h1>About Ella-Vate</h1>
        <p className="about-tagline">Elevating your career through AI-powered job matching</p>
      </div>

      <section className="about-section">
        <h2>Our Mission</h2>
        <p>
          Ella-Vate is an AI-driven job matching platform that transforms the traditional job search process by leveraging 
          semantic matching, natural language processing, and automated resume optimization. Unlike conventional job boards 
          that rely on simple keyword matching, our platform provides personalized job recommendations based on candidates' 
          actual qualifications and potential, while automating resume customization and cover letter generation.
        </p>
      </section>

      <section className="about-section">
        <h2>How Ella-Vate Works</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Semantic Matching</h3>
            <p>Our AI analyzes both your resume and job descriptions at a deeper level, understanding context and meaning beyond keywords.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🔄</div>
            <h3>Dual-Score System</h3>
            <p>We evaluate matches on two dimensions: how well your current skills match the job and how well the job aligns with your career goals.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🌉</div>
            <h3>Career Transition Support</h3>
            <p>Our algorithm identifies transferable skills and entry-level opportunities that can help you bridge to a new career path.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">📝</div>
            <h3>Cover Letter Generation</h3>
            <p>Automatically create personalized cover letters that highlight your most relevant experience for each position.</p>
          </div>
        </div>
      </section>

      <section className="about-section">
        <h2>Technology Behind Ella-Vate</h2>
        <p>
          Ella-Vate combines several cutting-edge technologies to deliver accurate and personalized job matches:
        </p>
        <ul className="tech-list">
          <li>
            <strong>Vector Embeddings:</strong> We convert resume text and job descriptions into mathematical representations that capture semantic meaning.
          </li>
          <li>
            <strong>Advanced NLP:</strong> Our system expands professional acronyms, identifies key skills, and understands the context of your experience.
          </li>
          <li>
            <strong>Section-Weighted Analysis:</strong> We give appropriate emphasis to different parts of your resume, prioritizing recent experience and relevant skills.
          </li>
          <li>
            <strong>Career Path Intelligence:</strong> Our algorithm understands common career progressions and can identify suitable opportunities for growth and transitions.
          </li>
        </ul>
      </section>

      <section className="about-section origin-section">
        <h2>Project Origin</h2>
        <p>
          This platform was developed for the MSIS 549: Machine Learning and Artificial Intelligence For Business Applications course. 
          It addresses the fundamental challenges in modern job searching:
        </p>
        <ul>
          <li>The inefficiency of keyword-based job matching</li>
          <li>The difficulty of career transitions despite transferable skills</li>
          <li>The time-consuming process of customizing applications</li>
          <li>The lack of personalized feedback on job compatibility</li>
        </ul>
        <p>
          By tackling these challenges, Ella-Vate streamlines the entire job search workflow into one intelligent platform.
        </p>
      </section>

      <section className="about-section cta-section">
        <h2>Ready to Elevate Your Career?</h2>
        <p>Upload your resume today and discover opportunities that truly match your skills and aspirations.</p>
        <button className="cta-button">Get Started</button>
      </section>
    </div>
  );
}

export default About;