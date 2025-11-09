<p align="center">
  <img src="/public/pdf_logo.png" alt="PDF Annotation App Logo" width="90" height="90">
</p>

<h1 align="center" style="font-size:2.5rem; font-weight:700; letter-spacing:2px;">
  PDF Annotation Platform
</h1>

<p align="center" style="font-size:1.15rem;">
  <b>Enterprise-Grade Document Annotation System</b><br>
  Secure PDF viewing, role-based annotations, and collaborative document management for organizations.
</p>

<p align="center">
  <img src="assets/banner.png" alt="PDF Annotation Banner" width="100%" style="max-height:340px; object-fit:cover; border-radius:12px; box-shadow:0 4px 24px rgba(0,0,0,0.08);">
</p>

<p align="center">
  <a href="https://pdf-annotation-app.netlify.app" target="_blank">
    <img src="https://img.shields.io/badge/Live%20Demo-Online-success?style=for-the-badge&logo=vercel" alt="Live Demo" />
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-lightgrey?style=for-the-badge" alt="License: MIT" />
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-TypeScript-blue?style=flat-square&logo=react" alt="Frontend: React + TypeScript" />
  <img src="https://img.shields.io/badge/Node.js-Express-green?style=flat-square&logo=node.js" alt="Backend: Node.js + Express" />
  <img src="https://img.shields.io/badge/MongoDB-Atlas-green?style=flat-square&logo=mongodb" alt="Database: MongoDB Atlas" />
</p>

<hr>

## Overview

PDF Annotation Platform is a web application built with the MERN stack that enables secure document viewing and role-based annotation capabilities. Designed for enterprise environments, it provides granular access control and collaborative annotation features while maintaining document security and user permission boundaries.

## Key Capabilities

- Role-based access control (Admin, Default Users, Read-only)
- Secure PDF upload and storage with metadata tracking
- Browser-based PDF annotation with text highlights and comments
- Granular annotation visibility controls (public or user-specific)
- Real-time permission switching via user dropdown
- Responsive interface for desktop and mobile usage

## Technical Stack

| Layer      | Technology                                                             |
| ---------- | ---------------------------------------------------------------------- |
| Frontend   | React, TypeScript, Vite, TailwindCSS, ShadCN UI, react-pdf, pdfjs-dist |
| Backend    | Node.js, Express.js, MongoDB (Atlas)                                   |
| Deployment | Netlify (frontend), Render (backend), MongoDB Atlas (database)         |

---

## Target Users

- **Admin (A1)**: Manages document uploads, edits/deletes annotations, controls system access
- **Default Users (D1, D2)**: View and annotate PDFs with permission restrictions
- **Read-only Users (R1)**: View documents and annotations without modification rights
- **Organizations**: Requiring secure document collaboration with permission controls

---

## User Flow

1. Access the application through the web interface
2. Select user role via dropdown (A1, D1, D2, R1)
3. **Admin (A1)**: Upload PDF documents (single or bulk)
4. All users: Browse and view uploaded documents
5. **Annotators (A1, D1, D2)**: Add annotations to PDFs
6. Configure annotation visibility (public or user-specific)
7. **Read-only (R1)**: View documents and annotations
8. Switch roles to experience different permission levels

---

## API Reference

**Base URL**

```

https://pdf-annotation-backend.onrender.com/api

```

| Endpoint                    | Method | Purpose                                 |
| --------------------------- | ------ | --------------------------------------- |
| `/documents`                | POST   | Upload new PDF document (Admin only)    |
| `/documents`                | GET    | Retrieve all documents with metadata    |
| `/documents/:id`            | GET    | Fetch specific document details         |
| `/annotations`              | POST   | Create new annotation (A1, D1, D2 only) |
| `/annotations/:id`          | PUT    | Update annotation (Admin only)          |
| `/annotations/:id`          | DELETE | Delete annotation (Admin only)          |
| `/annotations/document/:id` | GET    | Get annotations for a document          |

**Status Codes**

| Code | Refers To                       |
| ---- | ------------------------------- |
| 200  | Successful requests             |
| 400  | Bad request / validation issues |
| 403  | Forbidden / permission denied   |
| 404  | Resource not found              |
| 500  | Server error                    |

---

## Development Status

Features to be implemented or already implemented:

- [x] Role-based access control (A1, D1, D2, R1)
- [x] PDF upload functionality (Admin only)
- [x] Document viewing with metadata display
- [x] Annotation creation (text highlights, comments)
- [x] Annotation visibility controls
- [x] User switching via dropdown
- [x] MongoDB integration for data storage
- [ ] Freehand drawing annotations
- [ ] Annotation search/filtering
- [ ] Document versioning
- [ ] Advanced permission settings
- [ ] Notification system for new annotations

---

## Setup Instructions

### Prerequisites

- Node.js version 18 or newer
- MongoDB Atlas account
- npm or yarn package manager

### Installation Steps

Frontend:

```bash
npm install
npm run dev
```

Backend:

```bash
cd server
npm install
nodemon index.ts
```

## Contributors

[![Typing SVG](https://readme-typing-svg.demolab.com?font=Fira+Code&pause=1000&color=0A66C2&width=435&lines=Mohammed+Varaliya)](https://github.com/Mohammedvaraliya)

---

## Developer Profile

For more projects and contributions, visit my GitHub profile:

[![GitHub Profile](https://img.shields.io/badge/GitHub-Mohammed%20Varaliya-blue?style=for-the-badge&logo=github)](https://github.com/Mohammedvaraliya/)

---
