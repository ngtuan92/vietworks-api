import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/userModels.js';
import Conversation from '../models/conversationModels.js';
import Message from '../models/messageModels.js';

let io;

export const initializeSocket = (server) => {
  const allowedOrigins = [
    process.env.CLIENT_URL || 'http://localhost:5173',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:4173',
  ];

  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication error'));
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      const user = await User.findById(decoded.id);
      if (!user) return next(new Error('User not found'));
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected to socket: ${socket.user._id}`);
    
    // Automatically join personal room
    socket.join(socket.user._id.toString());

    // Join conversation room
    socket.on('join_conversation', (conversationId) => {
      socket.join(conversationId);
      console.log(`User ${socket.user._id} joined conversation ${conversationId}`);
    });

    // Leave conversation room
    socket.on('leave_conversation', (conversationId) => {
      socket.leave(conversationId);
      console.log(`User ${socket.user._id} left conversation ${conversationId}`);
    });

    // Typing indicators
    socket.on('typing_start', (conversationId) => {
      socket.to(conversationId).emit('typing_start', { conversationId, userId: socket.user._id.toString() });
    });

    socket.on('typing_stop', (conversationId) => {
      socket.to(conversationId).emit('typing_stop', { conversationId, userId: socket.user._id.toString() });
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected from socket: ${socket.user._id}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

