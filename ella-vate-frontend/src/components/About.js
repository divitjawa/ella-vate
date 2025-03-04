import React from 'react';

function About() {
  return (
    <div className="about-container">
      <h1>About Ella-Vate</h1>
      <p>
        Ella-Vate is an AI-driven job matching platform that transforms the job search process by leveraging semantic matching, natural language processing, and automated resume optimization. The platform provides personalized job recommendations based on candidates' qualifications rather than just keywords, while automating resume customization and cover letter generation.
      </p>
      <h2>Project Overview</h2>
      <p>
        This platform was developed for the MSIS 549: Machine Learning and Artificial Intelligence For Business Applications course. It addresses the current challenges in job searching by:
      </p>
      <ul>
        <li>Providing semantic matching between resumes and job descriptions</li>
        <li>Going beyond basic keyword matching to consider experience and transferable skills</li>
        <li>Automating the resume customization process</li>
        <li>Generating personalized cover letters</li>
        <li>Streamlining the entire job search workflow in one platform</li>
      </ul>
    </div>
  );
}

export default About;