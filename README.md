# 🏥 PH Tech Talent Scout

<div align="center">

![AI](https://img.shields.io/badge/AI-Powered-blue?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)

**An AI-powered platform that connects developers to healthcare tech opportunities by analyzing GitHub profiles.**

[**🚀 Try Live Demo**](https://ph-tech-talent-scout.web.app/)

</div>

---

## 📌 Overview

PH Tech Talent Scout helps bridge the gap between healthcare and technology. It supports:

- **Recruiters:** Analyze developer GitHub profiles to identify strengths and skills, helping place them in healthcare projects or roles that match their expertise.  
- **Developers:** Receive guidance on which skills to learn, projects to engage with, and areas to explore to grow in healthcare technology.

**Goal:** Ensure the right developers are matched to the right healthcare opportunities while helping them grow professionally.

---

## 🚀 Features

- **GitHub Analysis:** Scans public repositories, commits, and activity patterns.  
- **Skill Insights:** Suggests key areas for improvement and skill-building projects.  
- **Healthcare Role Matching:** Helps recruiters find developers best suited for specific healthcare tech projects.  
- **Actionable Recommendations:** Guides developers on projects, learning paths, and domain knowledge.  
- **Live Demo:** Test the platform with sample GitHub profiles.

---

## 🏗️ Project Structure

This is an Nx monorepo with two main apps:

- **`apps/genkit/`** – Backend powered by Firebase Functions and AI orchestration.  
- **`apps/web/`** – Angular frontend application.

---

## 🛠️ Tech Stack

### Frontend

- **Angular 20** – Modern web framework  
- **TypeScript 5** – Type safety  
- **Tailwind CSS** – Styling  

### Backend

- **Firebase Functions** – Serverless backend  
- **AI Orchestration** – Analyze GitHub profiles and generate recommendations  
- **GitHub REST API** – Fetch public developer data  

### Build Tools

- **Nx Monorepo** – Organizes frontend and backend apps  

---

## 💻 Getting Started

### Prerequisites

- Node.js 18+  
- pnpm 9+  
- Firebase CLI  
- GitHub Personal Access Token  

### Installation

1. **Clone the repo**

```bash
git clone https://github.com/Narokwe/ph-tech-talent-scout.git
cd ph-tech-talent-scout
Install dependencies

bash
Copy code
pnpm install
Configure Firebase

bash
Copy code
firebase login
firebase use --add
Set GitHub token

Create .env in apps/genkit/:

bash
Copy code
GITHUB_TOKEN=your_github_token_here
Run locally

bash
Copy code
pnpm nx serve web
pnpm nx serve genkit
Open http://localhost:4200 to view the app.



🤝 Contributing
Contributions are welcome:

Fork the repo

Create a feature branch (git checkout -b feature-name)

Commit your changes (git commit -m "Add feature")

Push to the branch (git push origin feature-name)

Open a Pull Request

📝 License
MIT License – see LICENSE