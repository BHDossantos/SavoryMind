# Setup Guide for SavoryMind

## Table of Contents
- [Docker Quick Start](#docker-quick-start)
- [Local Development Setup](#local-development-setup)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [Environment Configuration](#environment-configuration)
- [API Endpoints](#api-endpoints)
- [Troubleshooting](#troubleshooting)
- [Project Structure](#project-structure)
- [Deployment Instructions](#deployment-instructions)

## Docker Quick Start
To quickly run the application using Docker, follow these steps:
1. Ensure you have Docker installed on your machine.
2. Navigate to the project directory.
3. Run the following command to build and start the containers:
   ```bash
   docker-compose up --build
   ```
4. Access the application at `http://localhost:3000`.

## Local Development Setup

### Backend Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/BHDossantos/SavoryMind.git
   ```
2. Navigate to the backend directory:
   ```bash
   cd SavoryMind/backend
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a `.env` file based on the `.env.example` file and set up your environment variables.
5. Start the backend server:
   ```bash
   npm start
   ```

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the frontend server:
   ```bash
   npm start
   ```

## Environment Configuration
- Create a `.env` file in both the backend and frontend directories.
- Here are some key configuration options:
  - `DB_HOST`: Database host
  - `DB_USERNAME`: Database username
  - `DB_PASSWORD`: Database password
  - `API_URL`: URL for the backend API

## API Endpoints
| Endpoint             | Method | Description               |
|---------------------|--------|---------------------------|
| `/api/users`        | GET    | Fetch all users           |
| `/api/users/:id`    | GET    | Fetch user by ID          |
| `/api/users`        | POST   | Create a new user         |
| `/api/users/:id`    | PUT    | Update user by ID         |
| `/api/users/:id`    | DELETE | Delete user by ID         |

## Troubleshooting
- **Issue**: Application not starting.
  - **Solution**: Ensure all dependencies are installed and the environment variables are set correctly.
- **Issue**: API returning 404.
  - **Solution**: Check the server logs to see if the endpoint is reached.

## Project Structure
```
SavoryMind/
│
├── backend/         # Backend source code
├── frontend/        # Frontend source code
├── docker-compose.yml
└── README.md
```

## Deployment Instructions
1. Ensure the production environment is set up with necessary resources.
2. Build the application using Docker:
   ```bash
   docker-compose -f docker-compose.prod.yml up --build
   ```
3. Make sure to test the deployed application to confirm everything is working as expected.

For any issues not covered here, please consult the project's issue tracker or documentation.