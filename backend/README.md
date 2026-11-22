# Backend — Phase 1

## Requirements

- Node.js 18 or newer
- MongoDB local installation or MongoDB Atlas

## Setup

1. Open a terminal inside the `backend` folder.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env`.
4. Add your MongoDB connection string and a long random JWT secret to `.env`.
5. Start the development server:

   ```bash
   npm run dev
   ```

## API routes

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Check the server |
| POST | `/api/auth/register` | Create a customer account |
| POST | `/api/auth/login` | Log in |
| GET | `/api/auth/me` | Get the logged-in user (Bearer token required) |

## Example register body

```json
{
  "name": "Test Customer",
  "email": "customer@example.com",
  "password": "password123"
}
```

## Example login body

```json
{
  "email": "customer@example.com",
  "password": "password123"
}
```

Copy the returned token and send it in the Authorization header:

```
Authorization: Bearer YOUR_TOKEN
```

## Phase 1 scope

This phase sets up the Express server, MongoDB connection, initial Mongoose models, and basic JWT authentication. Rider allocation, order creation, H3 search, simulation, and Socket.IO are added in later phases.
