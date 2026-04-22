# Stage 1: Build the Next.js app
FROM node:16 AS builder

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY frontend/package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the Next.js app
COPY frontend/ .

# Build the Next.js app
RUN npm run build

# Stage 2: Serve the app with a production-quality server
FROM node:16 AS runner

# Set the working directory
WORKDIR /app

# Copy the built app and dependencies from the builder stage
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./
COPY --from=builder /app/package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Set the environment variable to node
ENV NODE_ENV production

# Start the Next.js app
CMD ["npm", "start"]