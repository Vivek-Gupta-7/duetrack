# Duetrack – Smart Customer & Appointment Tracking System

Duetrack is a full-stack backend system designed to manage customer flow, appointments, and service tracking for service-based businesses like salons, clinics, and small service shops.

It is built using Node.js and PostgreSQL with a focus on scalability, clean architecture, and production-ready deployment.

---

## 🚀 Features

- Customer management system
- Appointment scheduling system
- Service tracking system
- REST API architecture
- PostgreSQL database integration
- Database migration support
- Environment-based configuration
- Scalable backend structure

---

## 🏗️ Tech Stack

- Node.js
- Express.js
- PostgreSQL (Neon / Supabase compatible)
- dotenv
- nodemon

---

## 📁 Project Structure

src/
├── db/
│ ├── migrate.js
│ ├── schema.sql
├── routes/
├── controllers/
├── models/
├── server.js


---

## ⚙️ Installation

### 1. Clone repository
```bash
git clone https://github.com/Vivek-Gupta-7/duetrack.git
cd duetrack

2. Install dependencies
npm install



3. Setup environment variables

Create a .env file in root directory:

DATABASE_URL=your_postgres_connection_string
PORT=5000

🧪 Run Project
Start development server
npm run dev
Run migrations
npm run migrate


🗄️ Database Setup

This project uses PostgreSQL.

Recommended providers:

https://neon.tech
https://supabase.com

Make sure your connection string includes:

sslmode=require

If SSL error occurs, update DB connection config in backend accordingly.

👨‍💻 Author

Vivek Gupta



