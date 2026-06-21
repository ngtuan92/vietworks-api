import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';
import connectDB from './configs/db.js';
import './jobs/expireJobCron.js';
import './jobs/matchingJobCron.js';
import { initializeSocket } from './sockets/chatSocket.js';
const PORT = process.env.PORT || 8080;

connectDB();

const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

initializeSocket(server);

process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  server.close(() => process.exit(1));
});
