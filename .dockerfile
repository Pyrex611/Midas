# Use official Node.js image
FROM node:18-slim AS build

WORKDIR /app

# Copy backend package files and install dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm ci

# Copy frontend package files and install dependencies
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci

# Copy source code
COPY . .

# Build the application (runs the build script)
RUN cd backend && npm run build

# Production image
FROM node:18-slim

WORKDIR /app

# Copy built backend and public frontend from build stage
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/public ./public
COPY --from=build /app/backend/package*.json ./
COPY --from=build /app/backend/node_modules ./node_modules

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Expose the port Cloud Run expects
EXPOSE 8080

# Start the server
CMD ["npm", "start"]