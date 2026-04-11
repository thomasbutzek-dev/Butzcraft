# Use an official Node.js runtime as a parent image
FROM node:20-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json first to leverage Docker cache
COPY package*.json ./

# Install app dependencies
RUN npm install

# Bundle app source inside Docker image
COPY . .

# Bind port 3000 to the container
EXPOSE 3000

# Define the environment variable for the port
ENV PORT=3000

# Start the Node backend
CMD ["npm", "start"]
