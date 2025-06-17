import prisma from '../config/prismaClient.js';
/* eslint no-console: off */

/**
 * @desc   Creates a new video conference session
 * @route  /api/video/sessions
 * @method POST
 * @access private
 */
export const createVideoSession = async (req, res) => {
  try {
    const { chatRoomId, title, description, settings } = req.body;
    const userId = req.user.id;

    // Verify chat room exists and user is a participant
    const chatParticipant = await prisma.chatParticipant.findUnique({
      where: {
        chatRoomId_userId: {
          chatRoomId,
          userId,
        },
      },
    });

    if (!chatParticipant) {
      return res.status(403).json({
        message:
          'You are not authorized to create a video session in this chat room',
      });
    }

    // Check if there's an active session already
    const activeSession = await prisma.videoConferenceSession.findFirst({
      where: {
        chatRoomId,
        status: 'ACTIVE',
      },
    });

    if (activeSession) {
      return res.status(409).json({
        message: 'An active video session already exists in this chat room',
        sessionId: activeSession.id,
      });
    }

    // Generate a unique meeting URL
    const meetingUrl = generateMeetingUrl();

    // Process settings with defaults
    const sessionSettings = {
      enableWaitingRoom: false, // Default: no waiting room
      allowScreenSharing: true,
      allowRecording: true,
      allowChat: true,
      maxParticipants: 50,
      ...settings,
    };

    // Create the video session
    const videoSession = await prisma.videoConferenceSession.create({
      data: {
        chatRoomId,
        title: title || 'Video Conference',
        description,
        hostId: userId,
        meetingUrl,
        settings: sessionSettings,
        status: 'ACTIVE',
      },
    });

    // Add the creator as first participant with HOST role
    await prisma.videoParticipant.create({
      data: {
        sessionId: videoSession.id,
        userId,
        role: 'HOST',
      },
    });

    // Create a system message in the chat room
    await prisma.chatMessage.create({
      data: {
        chatRoomId,
        senderId: userId,
        content: `${req.user.firstName} ${req.user.lastName} started a video conference: ${title || 'Video Conference'}`,
        contentType: 'SYSTEM',
      },
    });

    // Update chat room's last message timestamp
    await prisma.chatRoom.update({
      where: { id: chatRoomId },
      data: { lastMessageAt: new Date() },
    });

    return res.status(201).json(videoSession);
  } catch (error) {
    console.error('Error creating video session:', error);
    return res.status(500).json({
      message: 'Failed to create video session',
      error: error.message,
    });
  }
};

/**
 * @desc   Get all video sessions for a chat room
 * @route  /api/video/chat/:chatRoomId/sessions
 * @method GET
 * @access private
 */
export const getChatRoomSessions = async (req, res) => {
  try {
    const { chatRoomId } = req.params;
    const userId = req.user.id;
    const { status, limit = 10, page = 1 } = req.query;

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    // Verify user is a chat participant
    const chatParticipant = await prisma.chatParticipant.findUnique({
      where: {
        chatRoomId_userId: {
          chatRoomId,
          userId,
        },
      },
    });

    if (!chatParticipant) {
      return res.status(403).json({
        message: 'You are not authorized to view sessions in this chat room',
      });
    }

    // Build the query
    const whereClause = {
      chatRoomId,
      ...(status && { status }),
    };

    // Get sessions with pagination
    const sessions = await prisma.videoConferenceSession.findMany({
      where: whereClause,
      orderBy: {
        startTime: 'desc',
      },
      skip,
      take: limitNumber,
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
        _count: {
          select: {
            participants: true,
            recordings: true,
          },
        },
      },
    });

    const total = await prisma.videoConferenceSession.count({
      where: whereClause,
    });

    return res.status(200).json({
      sessions,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        pages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    console.error('Error fetching video sessions:', error);
    return res.status(500).json({
      message: 'Failed to fetch video sessions',
      error: error.message,
    });
  }
};

/**
 * @desc   Get a specific video session
 * @route  /api/video/sessions/:id
 * @method GET
 * @access private
 */
export const getVideoSession = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

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
          select: {
            id: true,
            name: true,
            type: true,
            entityType: true,
            entityId: true,
          },
        },
      },
    });

    if (!session) {
      return res.status(404).json({ message: 'Video session not found' });
    }

    // Verify user is a chat participant
    const chatParticipant = await prisma.chatParticipant.findUnique({
      where: {
        chatRoomId_userId: {
          chatRoomId: session.chatRoomId,
          userId,
        },
      },
    });

    if (!chatParticipant) {
      return res.status(403).json({
        message: 'You are not authorized to view this session',
      });
    }

    return res.status(200).json(session);
  } catch (error) {
    console.error('Error fetching video session:', error);
    return res.status(500).json({
      message: 'Failed to fetch video session',
      error: error.message,
    });
  }
};

/**
 * @desc   Update a video session
 * @route  /api/video/sessions/:id
 * @method PUT
 * @access private
 */
export const updateVideoSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status, settings } = req.body;
    const userId = req.user.id;

    // Verify session exists
    const session = await prisma.videoConferenceSession.findUnique({
      where: { id },
      select: {
        id: true,
        hostId: true,
        chatRoomId: true,
        status: true,
      },
    });

    if (!session) {
      return res.status(404).json({ message: 'Video session not found' });
    }

    // Verify user is the host
    if (session.hostId !== userId) {
      // Check if user is a co-host
      const participant = await prisma.videoParticipant.findUnique({
        where: {
          sessionId_userId: {
            sessionId: id,
            userId,
          },
        },
      });

      if (!participant || participant.role !== 'COHOST') {
        return res.status(403).json({
          message: 'Only the host or co-host can update the session',
        });
      }
    }

    // Don't allow updating ended or cancelled sessions
    if (session.status === 'ENDED' || session.status === 'CANCELLED') {
      return res.status(400).json({
        message: 'Cannot update a session that has ended or been cancelled',
      });
    }

    // Prepare update data
    const updateData = {};
    if (title) {
      updateData.title = title;
    }
    if (description !== undefined) {
      updateData.description = description;
    }
    if (settings) {
      updateData.settings = settings;
    }

    // If status is being changed to ENDED, set endTime
    if (status && status !== session.status) {
      updateData.status = status;
      if (status === 'ENDED') {
        updateData.endTime = new Date();
      }
    }

    // Update the session
    const updatedSession = await prisma.videoConferenceSession.update({
      where: { id },
      data: updateData,
    });

    // If the session is ended, update all participants' leftAt times who haven't left yet
    if (status === 'ENDED') {
      await prisma.videoParticipant.updateMany({
        where: {
          sessionId: id,
          leftAt: null,
        },
        data: {
          leftAt: new Date(),
        },
      });

      // Add a system message in the chat room
      await prisma.chatMessage.create({
        data: {
          chatRoomId: session.chatRoomId,
          senderId: userId,
          content: `The video conference has ended`,
          contentType: 'SYSTEM',
        },
      });

      // Update chat room's last message timestamp
      await prisma.chatRoom.update({
        where: { id: session.chatRoomId },
        data: { lastMessageAt: new Date() },
      });
    }

    return res.status(200).json(updatedSession);
  } catch (error) {
    console.error('Error updating video session:', error);
    return res.status(500).json({
      message: 'Failed to update video session',
      error: error.message,
    });
  }
};

/**
 * @desc   Join a video session
 * @route  /api/video/sessions/:id/join
 * @method POST
 * @access private
 */
export const joinVideoSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { deviceInfo } = req.body;
    const userId = req.user.id;

    // Verify session exists and is active
    const session = await prisma.videoConferenceSession.findUnique({
      where: { id },
      select: {
        id: true,
        chatRoomId: true,
        status: true,
        hostId: true,
        settings: true,
      },
    });

    if (!session) {
      return res.status(404).json({ message: 'Video session not found' });
    }

    if (session.status !== 'ACTIVE' && session.status !== 'SCHEDULED') {
      return res.status(400).json({
        message: 'Cannot join a session that has ended or been cancelled',
      });
    }

    // Verify user is a chat participant
    const chatParticipant = await prisma.chatParticipant.findUnique({
      where: {
        chatRoomId_userId: {
          chatRoomId: session.chatRoomId,
          userId,
        },
      },
    });

    if (!chatParticipant) {
      return res.status(403).json({
        message: 'You are not authorized to join this session',
      });
    }

    // Check if user is already a participant
    const existingParticipant = await prisma.videoParticipant.findUnique({
      where: {
        sessionId_userId: {
          sessionId: id,
          userId,
        },
      },
    });

    // Check if waiting room is enabled and user is not host
    const waitingRoomEnabled = session.settings?.enableWaitingRoom === true;
    const isHost = userId === session.hostId;
    const needsAdmission = waitingRoomEnabled && !isHost;

    // If the user was already admitted, they don't need to wait again
    const wasAdmitted =
      existingParticipant && existingParticipant.status === 'ADMITTED';

    let participant;

    if (existingParticipant) {
      // If user had left, update their record
      if (existingParticipant.leftAt) {
        const updateData = {
          joinedAt: new Date(),
          leftAt: null,
          deviceInfo: deviceInfo || existingParticipant.deviceInfo,
        };

        // If waiting room is enabled and user is not host and not previously admitted,
        // put them in the waiting room
        if (needsAdmission && !wasAdmitted) {
          updateData.status = 'WAITING';
        } else {
          updateData.status = 'ADMITTED';
        }

        participant = await prisma.videoParticipant.update({
          where: {
            id: existingParticipant.id,
          },
          data: updateData,
        });
      } else {
        // User is already in the session
        return res.status(200).json({
          message: 'Already joined this session',
          participant: existingParticipant,
          waitingForAdmission: existingParticipant.status === 'WAITING',
        });
      }
    } else {
      // Determine the role
      let role = 'ATTENDEE';

      if (isHost) {
        role = 'HOST';
      }

      // Create new participant record
      participant = await prisma.videoParticipant.create({
        data: {
          sessionId: id,
          userId,
          deviceInfo: deviceInfo || {},
          role,
          // If waiting room is enabled and user is not host, set status to WAITING
          status: needsAdmission ? 'WAITING' : 'ADMITTED',
        },
      });
    }

    // If session was in SCHEDULED status and this is the host joining, update to ACTIVE
    if (session.status === 'SCHEDULED' && isHost) {
      await prisma.videoConferenceSession.update({
        where: { id },
        data: { status: 'ACTIVE' },
      });
    }

    // If the participant is in waiting room, notify the host
    if (participant.status === 'WAITING') {
      // Create a notification for the host (in a real implementation, this would use WebSockets)
      await prisma.notification
        .create({
          data: {
            userId: session.hostId,
            title: 'Participant waiting to join',
            content: `${req.user.firstName} ${req.user.lastName} is waiting to join your video session`,
            type: 'VIDEO_WAITING_ROOM',
            metadata: {
              sessionId: id,
              participantId: participant.id,
              participantName: `${req.user.firstName} ${req.user.lastName}`,
            },
            isRead: false,
          },
        })
        .catch((err) => console.error('Error creating notification:', err));

      return res.status(200).json({
        message: 'Waiting for host approval to join the session',
        participant,
        waitingForAdmission: true,
      });
    }

    return res.status(200).json({
      message: 'Successfully joined the session',
      participant,
      waitingForAdmission: false,
    });
  } catch (error) {
    console.error('Error joining video session:', error);
    return res.status(500).json({
      message: 'Failed to join video session',
      error: error.message,
    });
  }
};

/**
 * @desc   Leave a video session
 * @route  /api/video/sessions/:id/leave
 * @method POST
 * @access private
 */
export const leaveVideoSession = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Find the participant record
    const participant = await prisma.videoParticipant.findUnique({
      where: {
        sessionId_userId: {
          sessionId: id,
          userId,
        },
      },
    });

    if (!participant) {
      return res.status(404).json({
        message: 'You are not a participant in this session',
      });
    }

    // Update the participant record with leave time
    const updatedParticipant = await prisma.videoParticipant.update({
      where: {
        id: participant.id,
      },
      data: {
        leftAt: new Date(),
      },
    });

    // Check if the user is the host and there are other participants
    const session = await prisma.videoConferenceSession.findUnique({
      where: { id },
      select: {
        hostId: true,
      },
    });

    if (userId === session.hostId) {
      // Count active participants
      const activeParticipantsCount = await prisma.videoParticipant.count({
        where: {
          sessionId: id,
          leftAt: null,
        },
      });

      // If host is leaving and no one else is present, end the session
      if (activeParticipantsCount <= 1) {
        await prisma.videoConferenceSession.update({
          where: { id },
          data: {
            status: 'ENDED',
            endTime: new Date(),
          },
        });
      } else {
        // Look for a co-host to promote to host
        const cohost = await prisma.videoParticipant.findFirst({
          where: {
            sessionId: id,
            role: 'COHOST',
            leftAt: null,
          },
          select: {
            userId: true,
          },
        });

        if (cohost) {
          // Promote co-host to host
          await prisma.videoConferenceSession.update({
            where: { id },
            data: {
              hostId: cohost.userId,
            },
          });

          // Update the participant role
          await prisma.videoParticipant.update({
            where: {
              sessionId_userId: {
                sessionId: id,
                userId: cohost.userId,
              },
            },
            data: {
              role: 'HOST',
            },
          });
        } else {
          // Promote the longest-present participant to host
          const nextHost = await prisma.videoParticipant.findFirst({
            where: {
              sessionId: id,
              leftAt: null,
              userId: {
                not: userId,
              },
            },
            orderBy: {
              joinedAt: 'asc',
            },
            select: {
              userId: true,
            },
          });

          if (nextHost) {
            await prisma.videoConferenceSession.update({
              where: { id },
              data: {
                hostId: nextHost.userId,
              },
            });

            await prisma.videoParticipant.update({
              where: {
                sessionId_userId: {
                  sessionId: id,
                  userId: nextHost.userId,
                },
              },
              data: {
                role: 'HOST',
              },
            });
          }
        }
      }
    }

    return res.status(200).json({
      message: 'Successfully left the session',
      participant: updatedParticipant,
    });
  } catch (error) {
    console.error('Error leaving video session:', error);
    return res.status(500).json({
      message: 'Failed to leave video session',
      error: error.message,
    });
  }
};

/**
 * @desc   Change participant role
 * @route  /api/video/sessions/:id/participants/:participantId/role
 * @method PUT
 * @access private
 */
export const changeParticipantRole = async (req, res) => {
  try {
    const { id, participantId } = req.params;
    const { role } = req.body;
    const userId = req.user.id;

    if (!['HOST', 'COHOST', 'PRESENTER', 'ATTENDEE'].includes(role)) {
      return res.status(400).json({
        message: 'Invalid role specified',
      });
    }

    // Verify session exists
    const session = await prisma.videoConferenceSession.findUnique({
      where: { id },
      select: {
        id: true,
        hostId: true,
        status: true,
      },
    });

    if (!session) {
      return res.status(404).json({ message: 'Video session not found' });
    }

    if (session.status !== 'ACTIVE') {
      return res.status(400).json({
        message: 'Cannot change roles in a session that is not active',
      });
    }

    // Get the participant to update
    const targetParticipant = await prisma.videoParticipant.findUnique({
      where: { id: participantId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!targetParticipant) {
      return res.status(404).json({ message: 'Participant not found' });
    }

    // Check if requesting user is host or co-host
    const requestingParticipant = await prisma.videoParticipant.findUnique({
      where: {
        sessionId_userId: {
          sessionId: id,
          userId,
        },
      },
    });

    if (!requestingParticipant) {
      return res.status(403).json({
        message: 'You are not a participant in this session',
      });
    }

    if (session.hostId !== userId && requestingParticipant.role !== 'COHOST') {
      return res.status(403).json({
        message: 'Only the host or co-host can change participant roles',
      });
    }

    // Prevent non-hosts from changing the host's role
    if (
      targetParticipant.user.id === session.hostId &&
      userId !== session.hostId
    ) {
      return res.status(403).json({
        message: 'Only the host can change their own role',
      });
    }

    // If changing someone to HOST, the current host becomes a co-host
    if (role === 'HOST' && targetParticipant.user.id !== session.hostId) {
      // Update the session host
      await prisma.videoConferenceSession.update({
        where: { id },
        data: {
          hostId: targetParticipant.user.id,
        },
      });

      // Demote current host to co-host (if it's not the person being promoted)
      if (session.hostId !== targetParticipant.user.id) {
        await prisma.videoParticipant.update({
          where: {
            sessionId_userId: {
              sessionId: id,
              userId: session.hostId,
            },
          },
          data: {
            role: 'COHOST',
          },
        });
      }
    }

    // Update the participant role
    const updatedParticipant = await prisma.videoParticipant.update({
      where: { id: participantId },
      data: {
        role,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return res.status(200).json({
      message: 'Participant role updated successfully',
      participant: updatedParticipant,
    });
  } catch (error) {
    console.error('Error changing participant role:', error);
    return res.status(500).json({
      message: 'Failed to change participant role',
      error: error.message,
    });
  }
};

/**
 * @desc   Start recording a video session
 * @route  /api/video/sessions/:id/recordings
 * @method POST
 * @access private
 */
export const startRecording = async (req, res) => {
  try {
    const { id } = req.params;
    const { storageProvider = 'LOCAL' } = req.body;
    const userId = req.user.id;

    // Verify session exists and is active
    const session = await prisma.videoConferenceSession.findUnique({
      where: { id },
      select: {
        id: true,
        hostId: true,
        status: true,
        chatRoomId: true,
      },
    });

    if (!session) {
      return res.status(404).json({ message: 'Video session not found' });
    }

    if (session.status !== 'ACTIVE') {
      return res.status(400).json({
        message: 'Cannot start recording a session that is not active',
      });
    }

    // Check if user is host or co-host
    const participant = await prisma.videoParticipant.findUnique({
      where: {
        sessionId_userId: {
          sessionId: id,
          userId,
        },
      },
    });

    if (!participant) {
      return res.status(403).json({
        message: 'You are not a participant in this session',
      });
    }

    if (session.hostId !== userId && participant.role !== 'COHOST') {
      return res.status(403).json({
        message: 'Only the host or co-host can start recording',
      });
    }

    // Check if there's an existing processing recording
    const existingRecording = await prisma.videoRecording.findFirst({
      where: {
        sessionId: id,
        processingStatus: {
          in: ['PROCESSING', 'READY'],
        },
        endTime: null,
      },
    });

    if (existingRecording) {
      return res.status(409).json({
        message: 'A recording is already in progress for this session',
      });
    }

    // Generate a storage key
    const storageKey = `recordings/${id}/${Date.now()}`;

    // Create a new recording record
    const recording = await prisma.videoRecording.create({
      data: {
        sessionId: id,
        fileName: `recording_${Date.now()}.mp4`,
        fileSize: 0, // Will be updated when recording ends
        duration: 0, // Will be updated when recording ends
        recordedBy: userId,
        startTime: new Date(),
        endTime: null, // Will be set when recording ends
        storageProvider,
        storageKey,
        processingStatus: 'PROCESSING',
        // Default to participants only for visibility
        visibility: 'PARTICIPANTS_ONLY',
      },
    });

    // Add a system message in the chat room
    await prisma.chatMessage.create({
      data: {
        chatRoomId: session.chatRoomId,
        senderId: userId,
        content: `${req.user.firstName} ${req.user.lastName} started recording the session`,
        contentType: 'SYSTEM',
      },
    });

    // Update chat room's last message timestamp
    await prisma.chatRoom.update({
      where: { id: session.chatRoomId },
      data: { lastMessageAt: new Date() },
    });

    return res.status(201).json({
      message: 'Recording started successfully',
      recording,
    });
  } catch (error) {
    console.error('Error starting recording:', error);
    return res.status(500).json({
      message: 'Failed to start recording',
      error: error.message,
    });
  }
};

/**
 * @desc   Stop recording a video session
 * @route  /api/video/recordings/:recordingId/stop
 * @method PUT
 * @access private
 */
export const stopRecording = async (req, res) => {
  try {
    const { recordingId } = req.params;
    const { fileSize, duration } = req.body;
    const userId = req.user.id;

    // Find the recording
    const recording = await prisma.videoRecording.findUnique({
      where: { id: recordingId },
      include: {
        session: {
          select: {
            id: true,
            hostId: true,
            chatRoomId: true,
          },
        },
      },
    });

    if (!recording) {
      return res.status(404).json({ message: 'Recording not found' });
    }

    if (recording.endTime) {
      return res.status(400).json({
        message: 'Recording has already been stopped',
      });
    }

    // Check if user is host, co-host, or the person who started the recording
    const participant = await prisma.videoParticipant.findUnique({
      where: {
        sessionId_userId: {
          sessionId: recording.sessionId,
          userId,
        },
      },
    });

    if (!participant) {
      return res.status(403).json({
        message: 'You are not a participant in this session',
      });
    }

    const canStopRecording =
      recording.session.hostId === userId ||
      participant.role === 'COHOST' ||
      recording.recordedBy === userId;

    if (!canStopRecording) {
      return res.status(403).json({
        message: 'You do not have permission to stop this recording',
      });
    }

    // Calculate duration if not provided
    const calculatedDuration =
      duration ||
      Math.floor((new Date() - new Date(recording.startTime)) / 1000);

    // Update the recording
    const updatedRecording = await prisma.videoRecording.update({
      where: { id: recordingId },
      data: {
        endTime: new Date(),
        fileSize: fileSize || 0,
        duration: calculatedDuration,
        processingStatus: 'READY', // Assuming immediate processing for now
      },
    });

    // Update session's recordingUrl if not already set
    if (!recording.session.recordingUrl) {
      await prisma.videoConferenceSession.update({
        where: { id: recording.sessionId },
        data: {
          /* eslint no-undef: off */
          recordingUrl: `${process.env.API_URL}/api/video/recordings/${recordingId}/stream`,
        },
      });
    }

    // Add a system message in the chat room
    await prisma.chatMessage.create({
      data: {
        chatRoomId: recording.session.chatRoomId,
        senderId: userId,
        content: `${req.user.firstName} ${req.user.lastName} stopped recording the session`,
        contentType: 'SYSTEM',
      },
    });

    // Update chat room's last message timestamp
    await prisma.chatRoom.update({
      where: { id: recording.session.chatRoomId },
      data: { lastMessageAt: new Date() },
    });

    return res.status(200).json({
      message: 'Recording stopped successfully',
      recording: updatedRecording,
    });
  } catch (error) {
    console.error('Error stopping recording:', error);
    return res.status(500).json({
      message: 'Failed to stop recording',
      error: error.message,
    });
  }
};

/**
 * @desc   Get recordings for a session
 * @route  /api/video/sessions/:id/recordings
 * @method GET
 * @access private
 */
export const getSessionRecordings = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify session exists
    const session = await prisma.videoConferenceSession.findUnique({
      where: { id },
      select: {
        id: true,
        chatRoomId: true,
      },
    });

    if (!session) {
      return res.status(404).json({ message: 'Video session not found' });
    }

    // Verify user was a participant or is a chat room participant
    const wasParticipant = await prisma.videoParticipant.findUnique({
      where: {
        sessionId_userId: {
          sessionId: id,
          userId,
        },
      },
    });

    const isChatParticipant = await prisma.chatParticipant.findUnique({
      where: {
        chatRoomId_userId: {
          chatRoomId: session.chatRoomId,
          userId,
        },
      },
    });

    if (!wasParticipant && !isChatParticipant) {
      return res.status(403).json({
        message: 'You do not have permission to view these recordings',
      });
    }

    // Build visibility conditions based on user's role
    const visibilityConditions = ['PUBLIC'];

    if (wasParticipant) {
      visibilityConditions.push('PARTICIPANTS_ONLY');
    }

    // Get the recordings
    const recordings = await prisma.videoRecording.findMany({
      where: {
        sessionId: id,
        visibility: {
          in: visibilityConditions,
        },
      },
      include: {
        recorder: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePic: true,
          },
        },
      },
      orderBy: {
        startTime: 'desc',
      },
    });

    return res.status(200).json(recordings);
  } catch (error) {
    console.error('Error fetching recordings:', error);
    return res.status(500).json({
      message: 'Failed to fetch recordings',
      error: error.message,
    });
  }
};

/**
 * @desc   Update recording visibility
 * @route  /api/video/recordings/:id/visibility
 * @method PUT
 * @access private
 */
export const updateRecordingVisibility = async (req, res) => {
  try {
    const { id } = req.params;
    const { visibility } = req.body;
    const userId = req.user.id;

    if (
      !['PRIVATE', 'PARTICIPANTS_ONLY', 'ORGANIZATION', 'PUBLIC'].includes(
        visibility,
      )
    ) {
      return res.status(400).json({
        message: 'Invalid visibility setting',
      });
    }

    // Find the recording
    const recording = await prisma.videoRecording.findUnique({
      where: { id },
      include: {
        session: {
          select: {
            id: true,
            hostId: true,
          },
        },
      },
    });

    if (!recording) {
      return res.status(404).json({ message: 'Recording not found' });
    }

    // Check if user is host or recorder
    const isHost = recording.session.hostId === userId;
    const isRecorder = recording.recordedBy === userId;

    if (!isHost && !isRecorder) {
      return res.status(403).json({
        message:
          'Only the host or the person who recorded can update visibility',
      });
    }

    // Update visibility
    const updatedRecording = await prisma.videoRecording.update({
      where: { id },
      data: {
        visibility,
      },
    });

    return res.status(200).json({
      message: 'Recording visibility updated successfully',
      recording: updatedRecording,
    });
  } catch (error) {
    console.error('Error updating recording visibility:', error);
    return res.status(500).json({
      message: 'Failed to update recording visibility',
      error: error.message,
    });
  }
};

/**
 * @desc   Admit participant from waiting room
 * @route  /api/video/sessions/:id/participants/:participantId/admit
 * @method PUT
 * @access private
 */
export const admitParticipant = async (req, res) => {
  try {
    const { id, participantId } = req.params;
    const userId = req.user.id;

    // Verify session exists
    const session = await prisma.videoConferenceSession.findUnique({
      where: { id },
      select: {
        id: true,
        hostId: true,
        status: true,
        settings: true,
      },
    });

    if (!session) {
      return res.status(404).json({ message: 'Video session not found' });
    }

    if (session.status !== 'ACTIVE') {
      return res.status(400).json({
        message: 'Cannot admit participants to a session that is not active',
      });
    }

    // Check if waiting room is enabled
    const waitingRoomEnabled = session.settings?.enableWaitingRoom === true;
    if (!waitingRoomEnabled) {
      return res.status(400).json({
        message: 'Waiting room is not enabled for this session',
      });
    }

    // Check if requesting user is host or co-host
    const requestingParticipant = await prisma.videoParticipant.findUnique({
      where: {
        sessionId_userId: {
          sessionId: id,
          userId,
        },
      },
    });

    if (!requestingParticipant) {
      return res.status(403).json({
        message: 'You are not a participant in this session',
      });
    }

    const canAdmit =
      session.hostId === userId || requestingParticipant.role === 'COHOST';

    if (!canAdmit) {
      return res.status(403).json({
        message: 'Only the host or co-host can admit participants',
      });
    }

    // Get the participant to admit
    const participantToAdmit = await prisma.videoParticipant.findUnique({
      where: { id: participantId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!participantToAdmit) {
      return res.status(404).json({ message: 'Participant not found' });
    }

    if (participantToAdmit.status !== 'WAITING') {
      return res.status(400).json({
        message: 'Participant is not in the waiting room',
      });
    }

    // Admit the participant
    const updatedParticipant = await prisma.videoParticipant.update({
      where: { id: participantId },
      data: {
        status: 'ADMITTED',
      },
    });

    // Delete any waiting room notifications for this participant
    await prisma.notification
      .deleteMany({
        where: {
          type: 'VIDEO_WAITING_ROOM',
          userId: session.hostId,
          metadata: {
            path: ['participantId'],
            equals: participantId,
          },
        },
      })
      .catch((err) => console.error('Error deleting notifications:', err));

    return res.status(200).json({
      message: `${participantToAdmit.user.firstName} ${participantToAdmit.user.lastName} has been admitted`,
      participant: updatedParticipant,
    });
  } catch (error) {
    console.error('Error admitting participant:', error);
    return res.status(500).json({
      message: 'Failed to admit participant',
      error: error.message,
    });
  }
};

/**
 * @desc   Deny participant from waiting room
 * @route  /api/video/sessions/:id/participants/:participantId/deny
 * @method PUT
 * @access private
 */
export const denyParticipant = async (req, res) => {
  try {
    const { id, participantId } = req.params;
    const userId = req.user.id;

    // Verify session exists
    const session = await prisma.videoConferenceSession.findUnique({
      where: { id },
      select: {
        id: true,
        hostId: true,
        status: true,
        settings: true,
      },
    });

    if (!session) {
      return res.status(404).json({ message: 'Video session not found' });
    }

    // Check if requesting user is host or co-host
    const requestingParticipant = await prisma.videoParticipant.findUnique({
      where: {
        sessionId_userId: {
          sessionId: id,
          userId,
        },
      },
    });

    if (!requestingParticipant) {
      return res.status(403).json({
        message: 'You are not a participant in this session',
      });
    }

    const canDeny =
      session.hostId === userId || requestingParticipant.role === 'COHOST';

    if (!canDeny) {
      return res.status(403).json({
        message: 'Only the host or co-host can deny participants',
      });
    }

    // Get the participant to deny
    const participantToDeny = await prisma.videoParticipant.findUnique({
      where: { id: participantId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!participantToDeny) {
      return res.status(404).json({ message: 'Participant not found' });
    }

    if (participantToDeny.status !== 'WAITING') {
      return res.status(400).json({
        message: 'Participant is not in the waiting room',
      });
    }

    // Deny the participant by marking them as left
    await prisma.videoParticipant.update({
      where: { id: participantId },
      data: {
        status: 'DENIED',
        leftAt: new Date(),
      },
    });

    // Delete any waiting room notifications for this participant
    await prisma.notification
      .deleteMany({
        where: {
          type: 'VIDEO_WAITING_ROOM',
          userId: session.hostId,
          metadata: {
            path: ['participantId'],
            equals: participantId,
          },
        },
      })
      .catch((err) => console.error('Error deleting notifications:', err));

    return res.status(200).json({
      message: `${participantToDeny.user.firstName} ${participantToDeny.user.lastName} has been denied access`,
    });
  } catch (error) {
    console.error('Error denying participant:', error);
    return res.status(500).json({
      message: 'Failed to deny participant',
      error: error.message,
    });
  }
};

// Helper function to generate a unique meeting URL
const generateMeetingUrl = () => {
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return `${process.env.CLIENT_URL || 'http://localhost:5173'}/meeting/${result}`;
};
