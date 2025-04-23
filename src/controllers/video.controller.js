import { prisma } from '../config/prismaClient.js';
import { v4 as uuidv4 } from 'uuid';
import { emitToRoom } from '../socket/socketServer.js';

/* eslint no-undef: off */
/**
 * Create a new video conference session
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const createVideoSession = async (req, res) => {
  try {
    const { chatRoomId, title, description, settings } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!chatRoomId || !title) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: chatRoomId or title',
      });
    }

    // Check if the user is a participant in this chat room
    const participant = await prisma.chatParticipant.findUnique({
      where: {
        chatRoomId_userId: {
          chatRoomId,
          userId,
        },
        status: 'ACTIVE',
      },
    });

    if (!participant) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant in this chat room',
      });
    }

    // Generate unique meeting URL
    const meetingId = uuidv4();
    const meetingUrl = `${process.env.VIDEO_BASE_URL || '/video'}/${meetingId}`;

    // Default settings if not provided
    const defaultSettings = {
      enableChat: true,
      enableScreenShare: true,
      muteOnEntry: false,
      videoOnEntry: true,
      maxParticipants: 50,
      recordingEnabled: true,
      ...settings,
    };

    // Create video session in database
    const session = await prisma.videoConferenceSession.create({
      data: {
        chatRoomId,
        title,
        description: description || '',
        hostId: userId,
        meetingUrl,
        status: 'ACTIVE',
        settings: defaultSettings,
      },
      include: {
        host: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePic: true,
          },
        },
        chatRoom: true,
      },
    });

    // Create host as first participant
    await prisma.videoParticipant.create({
      data: {
        sessionId: session.id,
        userId,
        role: 'HOST',
        hasVideo: true,
        hasAudio: true,
        deviceInfo: {
          userAgent: req.headers['user-agent'],
          timestamp: new Date().toISOString(),
        },
      },
    });

    // Create a system message in the chat about the video conference
    await prisma.chatMessage.create({
      data: {
        chatRoomId,
        senderId: userId,
        content: `Video conference started: ${title}`,
        contentType: 'SYSTEM',
        metadata: {
          videoSessionId: session.id,
          meetingUrl,
          action: 'video_started',
        },
      },
    });

    // Notify participants in the chat room
    emitToRoom(`chat:${chatRoomId}`, 'video:created', {
      session,
      creator: {
        id: userId,
        username: req.user.username,
      },
    });

    return res.status(201).json({
      success: true,
      data: session,
    });
  } catch (error) {
    // console.error('Error creating video session:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create video session',
      error: error.message,
    });
  }
};

/**
 * Get details of a video conference session
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const getVideoSession = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Find the session
    const session = await prisma.videoConferenceSession.findUnique({
      where: { id },
      include: {
        host: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePic: true,
          },
        },
        participants: {
          where: { leftAt: null },
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
        },
        chatRoom: {
          include: {
            participants: {
              where: {
                userId,
                status: 'ACTIVE',
              },
            },
          },
        },
      },
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Video session not found',
      });
    }

    // Check if user has access to this session through the chat room
    const hasAccess = session.chatRoom.participants.length > 0;

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this video session',
      });
    }

    return res.status(200).json({
      success: true,
      data: session,
    });
  } catch (error) {
    // console.error('Error getting video session:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get video session',
      error: error.message,
    });
  }
};

/**
 * Join a video conference session
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const joinVideoSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { deviceInfo } = req.body;
    const userId = req.user.id;

    // Find the session
    const session = await prisma.videoConferenceSession.findFirst({
      where: {
        id,
        status: 'ACTIVE',
        chatRoom: {
          participants: {
            some: {
              userId,
              status: 'ACTIVE',
            },
          },
        },
      },
      include: {
        participants: {
          where: { userId },
        },
      },
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Video session not found or you do not have access',
      });
    }

    let participant;

    if (session.participants.length > 0) {
      // Update existing participant record
      participant = await prisma.videoParticipant.update({
        where: { id: session.participants[0].id },
        data: {
          leftAt: null,
          deviceInfo: deviceInfo || {
            userAgent: req.headers['user-agent'],
            timestamp: new Date().toISOString(),
          },
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
    } else {
      // Create new participant record
      participant = await prisma.videoParticipant.create({
        data: {
          sessionId: session.id,
          userId,
          role: session.hostId === userId ? 'HOST' : 'ATTENDEE',
          deviceInfo: deviceInfo || {
            userAgent: req.headers['user-agent'],
            timestamp: new Date().toISOString(),
          },
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
    }

    // Notify other participants
    emitToRoom(`video:${session.id}`, 'video:user-joined', {
      sessionId: session.id,
      participant,
    });

    return res.status(200).json({
      success: true,
      data: {
        session,
        participant,
      },
    });
  } catch (error) {
    // console.error('Error joining video session:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to join video session',
      error: error.message,
    });
  }
};

/**
 * Leave a video conference session
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const leaveVideoSession = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Find participant record
    const participant = await prisma.videoParticipant.findFirst({
      where: {
        sessionId: id,
        userId,
        leftAt: null,
      },
    });

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'You are not an active participant in this session',
      });
    }

    // Update participant record
    await prisma.videoParticipant.update({
      where: { id: participant.id },
      data: { leftAt: new Date() },
    });

    // Notify other participants
    emitToRoom(`video:${id}`, 'video:user-left', {
      sessionId: id,
      userId,
      username: req.user.username,
    });

    // Check if session should be ended (if host left and no other participants)
    const session = await prisma.videoConferenceSession.findUnique({
      where: { id },
      include: {
        participants: {
          where: { leftAt: null },
        },
      },
    });

    // If host left and no other participants, end the session
    if (
      session &&
      session.hostId === userId &&
      session.participants.length === 0
    ) {
      await prisma.videoConferenceSession.update({
        where: { id },
        data: {
          status: 'ENDED',
          endTime: new Date(),
        },
      });

      // Create a system message in chat about the ended conference
      await prisma.chatMessage.create({
        data: {
          chatRoomId: session.chatRoomId,
          senderId: userId,
          content: `Video conference ended: ${session.title}`,
          contentType: 'SYSTEM',
          metadata: {
            videoSessionId: session.id,
            action: 'video_ended',
          },
        },
      });

      // Notify the chat room that the conference has ended
      emitToRoom(`chat:${session.chatRoomId}`, 'video:ended', {
        sessionId: id,
        title: session.title,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Successfully left the video session',
    });
  } catch (error) {
    // console.error('Error leaving video session:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to leave video session',
      error: error.message,
    });
  }
};

/**
 * End a video conference session
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const endVideoSession = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if user is the host
    const session = await prisma.videoConferenceSession.findFirst({
      where: {
        id,
        hostId: userId,
        status: 'ACTIVE',
      },
    });

    if (!session) {
      return res.status(403).json({
        success: false,
        message: 'Only the host can end this session or it has already ended',
      });
    }

    // End the session
    await prisma.videoConferenceSession.update({
      where: { id },
      data: {
        status: 'ENDED',
        endTime: new Date(),
      },
    });

    // Create a system message in the chat
    await prisma.chatMessage.create({
      data: {
        chatRoomId: session.chatRoomId,
        senderId: userId,
        content: `Video conference ended: ${session.title}`,
        contentType: 'SYSTEM',
        metadata: {
          videoSessionId: session.id,
          action: 'video_ended_by_host',
        },
      },
    });

    // Notify all participants
    emitToRoom(`video:${id}`, 'video:ended-by-host', {
      sessionId: id,
      endedBy: {
        id: userId,
        username: req.user.username,
      },
    });

    // Notify the chat room
    emitToRoom(`chat:${session.chatRoomId}`, 'video:ended', {
      sessionId: id,
      title: session.title,
    });

    return res.status(200).json({
      success: true,
      message: 'Video session ended successfully',
    });
  } catch (error) {
    // console.error('Error ending video session:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to end video session',
      error: error.message,
    });
  }
};

/**
 * Get active video sessions for a user
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const getUserVideoSessions = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all active video sessions in chat rooms where the user is a participant
    const sessions = await prisma.videoConferenceSession.findMany({
      where: {
        status: 'ACTIVE',
        chatRoom: {
          participants: {
            some: {
              userId,
              status: 'ACTIVE',
            },
          },
        },
      },
      include: {
        host: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePic: true,
          },
        },
        chatRoom: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            participants: {
              where: {
                leftAt: null,
              },
            },
          },
        },
      },
      orderBy: {
        startTime: 'desc',
      },
    });

    return res.status(200).json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    // console.error('Error getting user video sessions:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get video sessions',
      error: error.message,
    });
  }
};

/**
 * Start recording a video session
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const startRecording = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if user is host or co-host
    const participant = await prisma.videoParticipant.findFirst({
      where: {
        sessionId: id,
        userId,
        role: { in: ['HOST', 'COHOST'] },
        leftAt: null,
      },
    });

    if (!participant) {
      return res.status(403).json({
        success: false,
        message: 'Only hosts and co-hosts can start recordings',
      });
    }

    // Check if the session exists and is active
    const session = await prisma.videoConferenceSession.findFirst({
      where: {
        id,
        status: 'ACTIVE',
      },
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Video session not found or not active',
      });
    }

    // Check if there's already an active recording
    const activeRecording = await prisma.videoRecording.findFirst({
      where: {
        sessionId: id,
        processingStatus: 'PROCESSING',
        endTime: {
          equals: new Date(0), // Assuming we set this to epoch time for active recordings
        },
      },
    });

    if (activeRecording) {
      return res.status(400).json({
        success: false,
        message: 'This session is already being recorded',
      });
    }

    // Create a new recording record
    const recording = await prisma.videoRecording.create({
      data: {
        sessionId: id,
        fileName: `recording-${id}-${Date.now()}.mp4`,
        fileSize: 0, // Will be updated when recording ends
        duration: 0, // Will be updated when recording ends
        recordedBy: userId,
        startTime: new Date(),
        endTime: new Date(0), // Temporary, will be updated when recording ends
        storageProvider: process.env.STORAGE_PROVIDER || 'local',
        storageKey: `recordings/${id}/${Date.now()}`,
        processingStatus: 'PROCESSING',
      },
    });

    // Notify all participants
    emitToRoom(`video:${id}`, 'video:recording-started', {
      sessionId: id,
      recordingId: recording.id,
      startedBy: {
        id: userId,
        username: req.user.username,
      },
    });

    // In a real implementation, you would start the recording service here

    return res.status(200).json({
      success: true,
      data: recording,
      message: 'Recording started successfully',
    });
  } catch (error) {
    // console.error('Error starting recording:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to start recording',
      error: error.message,
    });
  }
};

/**
 * Stop recording a video session
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const stopRecording = async (req, res) => {
  try {
    const { sessionId, recordingId } = req.params;
    const userId = req.user.id;

    // Check if user is host or co-host
    const participant = await prisma.videoParticipant.findFirst({
      where: {
        sessionId,
        userId,
        role: { in: ['HOST', 'COHOST'] },
        leftAt: null,
      },
    });

    if (!participant) {
      return res.status(403).json({
        success: false,
        message: 'Only hosts and co-hosts can stop recordings',
      });
    }

    // Find the recording
    const recording = await prisma.videoRecording.findFirst({
      where: {
        id: recordingId,
        sessionId,
        processingStatus: 'PROCESSING',
        endTime: new Date(0), // Check for active recordings
      },
    });

    if (!recording) {
      return res.status(404).json({
        success: false,
        message: 'Active recording not found',
      });
    }

    // Calculate duration in seconds
    const durationInSeconds = Math.floor(
      (Date.now() - recording.startTime.getTime()) / 1000,
    );

    // Update recording record
    const updatedRecording = await prisma.videoRecording.update({
      where: { id: recordingId },
      data: {
        endTime: new Date(),
        duration: durationInSeconds,
        processingStatus: 'PROCESSING', // Will be updated to READY when processed
        // In a real implementation, fileSize would be updated here
      },
    });

    // Notify all participants
    emitToRoom(`video:${sessionId}`, 'video:recording-stopped', {
      sessionId,
      recordingId,
      stoppedBy: {
        id: userId,
        username: req.user.username,
      },
    });

    // In a real implementation, you would stop the recording service here
    // and start processing the recording

    return res.status(200).json({
      success: true,
      data: updatedRecording,
      message: 'Recording stopped successfully',
    });
  } catch (error) {
    // console.error('Error stopping recording:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to stop recording',
      error: error.message,
    });
  }
};
