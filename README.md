# Smart Rider Allocation System (Simplified Rebuild)

A beginner-friendly MERN implementation of a food-delivery rider dispatch and live-tracking simulation.

## Goal

Rebuild the core behaviour of the original Rider Allocation System with straightforward JavaScript and familiar MERN patterns. The code should be easy to read, test, and explain in interviews.

## Planned stack

- Frontend: React
- Backend: Node.js and Express
- Database: MongoDB and Mongoose
- Authentication: JWT and bcrypt
- Real-time updates: Socket.IO
- Maps: Leaflet
- Geospatial search: H3
- Distance estimate: Haversine formula
- Road routing: Mapbox Directions API (optional configuration)

## Planned features

1. Authentication and protected routes
2. Rider, restaurant, customer, and order management
3. Nearby rider search using H3
4. Rider scoring using ETA, rating, and recent workload
5. Order and rider status lifecycle
6. Time-based delivery simulation
7. Live rider positions using Socket.IO
8. Delivery analytics and automated tests

## Learning-first implementation rules

- Use JavaScript (not TypeScript).
- Prefer simple controllers, models, routes, and service functions.
- Keep functions small and use clear variable names.
- Explain important algorithms in comments and documentation.
- Build and verify one phase at a time.
- Keep secrets in environment variables; never commit real credentials.

## Development phases

- Phase 1: Project setup, MongoDB connection, models, authentication, and basic APIs
- Phase 2: Haversine distance and H3 nearby-rider search
- Phase 3: Weighted rider scoring and allocation
- Phase 4: Order lifecycle and simulation loop
- Phase 5: Socket.IO live tracking and map UI
- Phase 6: Analytics, tests, documentation, and cleanup

This repository is the simplified learning rebuild, separate from the original project source.
