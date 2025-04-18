import prisma from '../config/prismaClient.js';

/**
 * Utility function to create activity logs for system operations
 * @param {Object} params - Parameters for creating an activity log
 * @param {string} params.entityType - Type of entity (from EntityType enum)
 * @param {string} params.action - Action performed (from ActionType enum)
 * @param {string} params.userId - ID of the user who performed the action
 * @param {string} [params.organizationId] - ID of the organization (optional)
 * @param {string} [params.departmentId] - ID of the department (optional)
 * @param {string} [params.teamId] - ID of the team (optional)
 * @param {string} [params.projectId] - ID of the project (optional)
 * @param {string} [params.sprintId] - ID of the sprint (optional)
 * @param {string} [params.taskId] - ID of the task (optional)
 * @param {Object} [params.details] - Additional details about the action (optional)
 * @returns {Promise<Object>} The created activity log
 */
export const createActivityLog = async (params) => {
  try {
    const {
      entityType,
      action,
      userId,
      organizationId,
      departmentId,
      teamId,
      projectId,
      sprintId,
      taskId,
      details,
    } = params;

    // Validate required fields
    if (!entityType || !action || !userId) {
      throw new Error(
        'EntityType, action, and userId are required for activity logging',
      );
    }

    // Create activity log entry
    const activityLog = await prisma.activityLog.create({
      data: {
        entityType,
        action,
        userId,
        organizationId: organizationId || null,
        departmentId: departmentId || null,
        teamId: teamId || null,
        projectId: projectId || null,
        sprintId: sprintId || null,
        taskId: taskId || null,
        details: details || null,
      },
    });

    return activityLog;
  } catch (error) {
    /* eslint no-console: off */
    console.error('Error creating activity log:', error);
    return null;
  }
};

/**
 * Helper function to generate appropriate details for different action types
 * @param {string} action - Action type from ActionType enum
 * @param {Object} oldData - Previous state data (for update operations)
 * @param {Object} newData - New state data
 * @returns {Object} Structured details for the activity log
 */
export const generateActivityDetails = (
  action,
  oldData = null,
  newData = null,
) => {
  switch (action) {
    case 'CREATED':
      return {
        newData,
      };
    case 'UPDATED':
      // Find what fields were changed
      const changes = {}; /* eslint-disable-line */
      if (oldData && newData) {
        Object.keys(newData).forEach((key) => {
          // Only include fields that were actually changed
          if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
            changes[key] = {
              from: oldData[key],
              to: newData[key],
            };
          }
        });
      }
      return { changes };
    case 'STATUS_CHANGED':
      return {
        oldStatus: oldData?.status,
        newStatus: newData?.status,
      };
    case 'ASSIGNED':
      return {
        assignedTo: newData?.assignedTo || newData?.userId,
        taskId: newData?.taskId,
      };
    case 'UNASSIGNED':
      return {
        unassignedFrom: oldData?.assignedTo || oldData?.userId,
        taskId: oldData?.taskId,
      };
    case 'ATTACHMENT_ADDED':
    case 'ATTACHMENT_REMOVED':
      return {
        attachmentDetails: newData,
      };
    case 'DEPENDENCY_ADDED':
    case 'DEPENDENCY_REMOVED':
      return {
        dependencyDetails: newData,
      };
    case 'MEMBER_ADDED':
    case 'MEMBER_REMOVED':
    case 'MEMBER_ROLE_CHANGED':
      return {
        memberDetails: newData,
      };
    case 'SPRINT_STARTED':
    case 'SPRINT_COMPLETED':
      return {
        sprintDetails: newData,
      };
    case 'TASK_MOVED':
      return {
        from: {
          sprintId: oldData?.sprintId,
          projectId: oldData?.projectId,
          status: oldData?.status,
        },
        to: {
          sprintId: newData?.sprintId,
          projectId: newData?.projectId,
          status: newData?.status,
        },
      };
    case 'LOGGED_TIME':
      return {
        timeDetails: newData,
      };
    default:
      return { details: newData };
  }
};
