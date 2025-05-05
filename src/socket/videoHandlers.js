import prisma from '../config/prismaClient.js';

/* eslint no-console: off */

const setupVideoHandlers = (io, socket, user) => {
  // Join user to their active video sessions
  const joinActiveVideoSessions = async () => {
    try {
      const activeParticipations = await prisma.videoParticipant.findMany({
        where: {
          userId: user.id,
          leftAt: null,
        },
        select: {
          sessionId: true,
        },
      });

      // Join each active session's socket room
      activeParticipations.forEach((participation) => {
        socket.join(`video:${participation.sessionId}`);
      });

      console.log(`User ${user.id} joined their active video sessions`);
    } catch (error) {
      console.error('Error joining video sessions:', error);
    }
  };

  // Handle joining a specific video session socket room
  const joinVideoRoom = async (sessionId, callback) => {
    try {
      // Verify user is a participant
      const participant = await prisma.videoParticipant.findUnique({
        where: {
          sessionId_userId: {
            sessionId,
            userId: user.id,
          },
        },
      });

      if (!participant) {
        if (callback) {
          callback({ error: 'Not authorized to join this video room' });
        }
        return;
      }

      // If participant had left, update their record
      if (participant.leftAt) {
        await prisma.videoParticipant.update({
          where: {
            id: participant.id,
          },
          data: {
            leftAt: null,
          },
        });
      }

      // Join the socket room for this session
      socket.join(`video:${sessionId}`);

      // Get participant list and notify others
      const participants = await prisma.videoParticipant.findMany({
        where: {
          sessionId,
          leftAt: null,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              profilePic: true,
            },
          },
        },
      });

      // Notify everyone in the room about user joining
      socket.to(`video:${sessionId}`).emit('participant_joined', {
        sessionId,
        participant: {
          ...participant,
          user: {
            id: user.id,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            profilePic: user.profilePic,
          },
        },
      });

      if (callback) {
        callback({ success: true, participants });
      }
    } catch (error) {
      console.error('Error joining video room:', error);
      if (callback) {
        callback({ error: 'Failed to join video room' });
      }
    }
  };

  // Handle leaving a video session socket room
  const leaveVideoRoom = async (sessionId, callback) => {
    try {
      socket.leave(`video:${sessionId}`);

      // Update participant record
      const participant = await prisma.videoParticipant.findUnique({
        where: {
          sessionId_userId: {
            sessionId,
            userId: user.id,
          },
        },
      });

      if (participant && !participant.leftAt) {
        await prisma.videoParticipant.update({
          where: {
            id: participant.id,
          },
          data: {
            leftAt: new Date(),
          },
        });
      }

      // Notify everyone in the room
      socket.to(`video:${sessionId}`).emit('participant_left', {
        sessionId,
        userId: user.id,
      });

      if (callback) {
        callback({ success: true });
      }
    } catch (error) {
      console.error('Error leaving video room:', error);
      if (callback) {
        callback({ error: 'Failed to leave video room' });
      }
    }
  };

  // Handle sending WebRTC signaling data
  const sendSignal = (data) => {
    const { sessionId, signal, targetUserId } = data;

    // If targetUserId is provided, send only to that user
    if (targetUserId) {
      socket.to(`video:${sessionId}`).emit('signal', {
        sessionId,
        fromUserId: user.id,
        signal,
        toUserId: targetUserId,
      });
    } else {
      // Otherwise broadcast to all in the room
      socket.to(`video:${sessionId}`).emit('signal', {
        sessionId,
        fromUserId: user.id,
        signal,
      });
    }
  };

  // Update participant media status (audio/video)
  const updateMediaStatus = async (data, callback) => {
    try {
      const { sessionId, hasVideo, hasAudio } = data;

      // Verify user is a participant
      const participant = await prisma.videoParticipant.findUnique({
        where: {
          sessionId_userId: {
            sessionId,
            userId: user.id,
          },
        },
      });

      if (!participant) {
        if (callback) {
          callback({ error: 'Not a participant in this session' });
        }
        return;
      }

      // Update the participant's media status
      const updatedParticipant = await prisma.videoParticipant.update({
        where: {
          id: participant.id,
        },
        data: {
          hasVideo: hasVideo !== undefined ? hasVideo : participant.hasVideo,
          hasAudio: hasAudio !== undefined ? hasAudio : participant.hasAudio,
        },
      });

      // Broadcast the update to everyone in the room
      io.to(`video:${sessionId}`).emit('media_status_update', {
        sessionId,
        userId: user.id,
        hasVideo: updatedParticipant.hasVideo,
        hasAudio: updatedParticipant.hasAudio,
      });

      if (callback) {
        callback({ success: true });
      }
    } catch (error) {
      console.error('Error updating media status:', error);
      if (callback) {
        callback({ error: 'Failed to update media status' });
      }
    }
  };

  // Update connection quality
  const updateConnectionQuality = async (data) => {
    try {
      const { sessionId, quality } = data;

      if (
        !['excellent', 'good', 'fair', 'poor', 'critical'].includes(quality)
      ) {
        return;
      }

      // Update the participant's connection quality
      await prisma.videoParticipant.update({
        where: {
          sessionId_userId: {
            sessionId,
            userId: user.id,
          },
        },
        data: {
          connectionQuality: quality,
        },
      });

      // Broadcast the update to everyone in the room
      socket.to(`video:${sessionId}`).emit('connection_quality_update', {
        sessionId,
        userId: user.id,
        quality,
      });
    } catch (error) {
      console.error('Error updating connection quality:', error);
    }
  };

  // Request to become presenter
  const requestPresenterRole = async (data, callback) => {
    try {
      const { sessionId } = data;

      // Verify session exists
      const session = await prisma.videoConferenceSession.findUnique({
        where: { id: sessionId },
        select: {
          id: true,
          hostId: true,
        },
      });

      if (!session) {
        if (callback) {
          callback({ error: 'Session not found' });
        }
        return;
      }

      // Emit request to host
      socket.to(`video:${sessionId}`).emit('presenter_role_request', {
        sessionId,
        userId: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
      });

      if (callback) {
        callback({ success: true });
      }
    } catch (error) {
      console.error('Error requesting presenter role:', error);
      if (callback) {
        callback({ error: 'Failed to request presenter role' });
      }
    }
  };

  // Screen sharing status update
  const updateScreenSharing = (data) => {
    const { sessionId, isSharing } = data;

    // Broadcast to everyone in the session
    io.to(`video:${sessionId}`).emit('screen_sharing_update', {
      sessionId,
      userId: user.id,
      isSharing,
    });
  };

  // Send chat message during video call
  const sendVideoMessage = async (data, callback) => {
    try {
      const { sessionId, message } = data;

      // Verify user is a participant
      const participant = await prisma.videoParticipant.findUnique({
        where: {
          sessionId_userId: {
            sessionId,
            userId: user.id,
          },
        },
      });

      if (!participant) {
        if (callback) {
          callback({ error: 'Not a participant in this session' });
        }
        return;
      }

      // Get session for chatRoomId
      const session = await prisma.videoConferenceSession.findUnique({
        where: { id: sessionId },
        select: { chatRoomId: true },
      });

      if (!session) {
        if (callback) {
          callback({ error: 'Session not found' });
        }
        return;
      }

      // Create chat message in the associated chat room
      const chatMessage = await prisma.chatMessage.create({
        data: {
          chatRoomId: session.chatRoomId,
          senderId: user.id,
          content: message,
          contentType: 'TEXT',
          metadata: {
            fromVideoSession: true,
            sessionId,
          },
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              profilePic: true,
            },
          },
        },
      });

      // Update chat room's last message timestamp
      await prisma.chatRoom.update({
        where: { id: session.chatRoomId },
        data: { lastMessageAt: new Date() },
      });

      // Emit to both video room and chat room
      io.to(`video:${sessionId}`).emit('video_chat_message', {
        message: chatMessage,
        sessionId,
      });

      io.to(session.chatRoomId).emit('new_message', chatMessage);

      if (callback) {
        callback({ success: true, message: chatMessage });
      }
    } catch (error) {
      console.error('Error sending video message:', error);
      if (callback) {
        callback({ error: 'Failed to send message' });
      }
    }
  };

  // Register event handlers
  socket.on('join_video_sessions', joinActiveVideoSessions);
  socket.on('join_video_room', joinVideoRoom);
  socket.on('leave_video_room', leaveVideoRoom);
  socket.on('signal', sendSignal);
  socket.on('update_media_status', updateMediaStatus);
  socket.on('update_connection_quality', updateConnectionQuality);
  socket.on('request_presenter_role', requestPresenterRole);
  socket.on('update_screen_sharing', updateScreenSharing);
  socket.on('send_video_message', sendVideoMessage);

  // Initialize by joining active sessions
  joinActiveVideoSessions();

  return {
    disconnect: () => {
      socket.removeAllListeners('join_video_sessions');
      socket.removeAllListeners('join_video_room');
      socket.removeAllListeners('leave_video_room');
      socket.removeAllListeners('signal');
      socket.removeAllListeners('update_media_status');
      socket.removeAllListeners('update_connection_quality');
      socket.removeAllListeners('request_presenter_role');
      socket.removeAllListeners('update_screen_sharing');
      socket.removeAllListeners('send_video_message');
    },
  };
};

export default setupVideoHandlers;
