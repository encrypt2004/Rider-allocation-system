# RiderFlow — Smart Rider Allocation System

A simplified, interview-friendly MERN project that demonstrates how a food-delivery platform can find a nearby rider, choose the best candidate, assign an order, and stream location updates to a live dashboard.

## Features

- JWT authentication with bcrypt password hashing.
- Per-user demo workspace: each account sees its own riders, restaurants, customer and orders.
- MongoDB persistence through Mongoose.
- Rider allocation using H3 geographic cells and Haversine distance.
- Explainable weighted score using distance, estimated arrival time, workload and rating.
- Order lifecycle: `PENDING → ASSIGNED → PICKED_UP → DELIVERED`.
- Backend-driven rider movement: each simulation tick updates rider coordinates in MongoDB.
- Socket.IO broadcasts dashboard changes to the authenticated user's room.
- Mapbox map with rider and restaurant markers.
- Add riders, restaurants and waiting orders from the dashboard.
- Reset the demo to its initial state.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, Axios, React Router |
| Backend | Node.js, Express |
| Database | MongoDB Atlas/local MongoDB, Mongoose |
| Authentication | JWT, bcryptjs |
| Real-time updates | Socket.IO |
| Geospatial search | h3-js |
| Distance | Haversine formula |
| Map | Mapbox GL JS |

## Run locally

### 1. Requirements

- Node.js 20 or later
- MongoDB Atlas cluster or local MongoDB
- Mapbox public access token

### 2. Backend setup

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

Edit `backend/.env`:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
```

Start the backend:

```powershell
npm run dev
```

Health check: http://localhost:5000/api/health

### 3. Frontend setup

Open a second terminal:

```powershell
cd frontend
npm install
Copy-Item .env.example .env
```

Edit `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api
VITE_MAPBOX_TOKEN=your_mapbox_public_token
```

Start the frontend:

```powershell
npm run dev
```

Open http://localhost:5173, create an account, and open the dashboard. The first dashboard load creates demo data for that account.

> Never commit real MongoDB credentials, JWT secrets, or private tokens. A Mapbox public token is intended for browser use; restrict it to your allowed URLs in the Mapbox dashboard.

## How rider allocation works

1. Find the oldest order with status `PENDING`.
2. Load riders belonging to the logged-in user's demo workspace whose status is `IDLE`.
3. Convert the restaurant and rider coordinates into H3 cells at resolution 9.
4. Expand the search from ring 0 up to ring 5 using `gridDisk`; stop when at least one available rider is found.
5. Calculate straight-line distance with the Haversine formula.
6. Estimate ETA using an assumed average speed of 25 km/h plus a 3-minute preparation buffer.
7. Calculate a weighted score. Lower score wins.

### Score formula

```text
distance = min(distanceKm / 5, 1) * 40
ETA      = min(etaMinutes / 15, 1) * 30
workload = min(recentDeliveries / 10, 1) * 20
rating   = ((5 - rating) / 5) * 10

totalScore = distance + ETA + workload + rating
```

The API returns every candidate's score breakdown, the selected rider, H3 resolution, number of rings searched, and candidate count.

## Live tracking flow

```text
React Start Simulation
        |
        v
POST /api/demo/simulation/tick
        |
        v
Express updates rider coordinates in MongoDB
        |
        v
Server emits dashboard:update through Socket.IO
        |
        v
React updates rider state and Mapbox markers
```

The simulation uses generated coordinates, not a real rider's GPS. Mapbox displays the map; allocation distance and ETA are straight-line estimates, not road-route calculations.

## Main API routes

All `/api/demo` routes require a valid JWT bearer token.

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | Backend health |
| POST | `/api/auth/register` | Register customer account |
| POST | `/api/auth/login` | Log in |
| GET | `/api/auth/me` | Current user |
| POST | `/api/demo/setup` | Create initial demo data |
| GET | `/api/demo/dashboard` | Read riders and orders |
| GET | `/api/demo/resources` | List open restaurants |
| POST | `/api/demo/riders` | Add a rider |
| PATCH | `/api/demo/riders/:code` | Update rider details/status |
| POST | `/api/demo/restaurants` | Add a restaurant |
| POST | `/api/demo/orders` | Create a pending order |
| POST | `/api/demo/allocate` | Allocate the next pending order |
| POST | `/api/demo/simulation/tick` | Move riders and broadcast updates |
| PATCH | `/api/demo/orders/:orderNumber/status` | Advance order lifecycle |
| POST | `/api/demo/reset` | Reset demo riders and seeded orders |

## Interview demo checklist

1. Register and log in.
2. Show seeded riders, restaurants and orders in MongoDB.
3. Create another rider and a pending order.
4. Allocate the order and explain H3 search, Haversine distance and each score component.
5. Start simulation; show rider coordinates changing in MongoDB and markers moving on the map.
6. Mark the order picked up, then delivered; show rider/order statuses update.
7. Try allocation with no idle riders and explain the no-available-rider response.
8. Reset the demo.

## Important limitations

- This is a learning/demo dispatch system, not a production delivery platform.
- Rider movement is simulated; no mobile GPS device is connected.
- ETA uses a fixed speed assumption and straight-line distance. Production ETA should use a road-routing provider and traffic data.
- The allocator searches H3 cells up to five rings; it reports when no eligible rider is found in that area.
- Production deployment would additionally need stronger operational monitoring, rate limits, audit logs, automated integration tests, and secure rider onboarding.

## Project structure

```text
backend/
  src/
    config/       MongoDB connection
    controllers/  Request handlers
    middleware/   JWT protection
    models/       Mongoose schemas
    routes/       API routes
    services/     Allocation and order-number logic
frontend/
  src/
    components/   Mapbox map
    App.jsx       Authentication and dashboard
    api.js        Axios client
```

Built as a simplified JavaScript/MERN rebuild for learning and interview discussion.
