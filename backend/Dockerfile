# Backend Dockerfile
FROM node:20-alpine

RUN apk add --no-cache nano curl wget bash

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy source code
COPY . .

# Expose port
EXPOSE 3201

# Start the server
CMD ["node", "src/index.js"]
