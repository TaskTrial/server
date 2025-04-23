import { generateChatRoom } from '../controllers/chat.controller.js';
/* eslint no-console: off */
/**
 * Hook to create a chat room when a new organization is created
 * @param {Object} organization - Created organization
 * @param {string} userId - ID of the user creating the organization
 */
export const onOrganizationCreated = async (organization, userId) => {
  try {
    await generateChatRoom(
      'ORGANIZATION',
      organization.id,
      organization.name,
      `Chat room for ${organization.name} organization`,
      userId,
    );
    console.log(`Created chat room for organization ${organization.id}`);
  } catch (error) {
    console.error(
      `Failed to create chat room for organization ${organization.id}:`,
      error,
    );
    // Don't throw error to prevent organization creation from failing
  }
};

/**
 * Hook to create a chat room when a new department is created
 * @param {Object} department - Created department
 * @param {string} userId - ID of the user creating the department
 */
export const onDepartmentCreated = async (department, userId) => {
  try {
    await generateChatRoom(
      'DEPARTMENT',
      department.id,
      department.name,
      `Chat room for ${department.name} department`,
      userId,
    );
    console.log(`Created chat room for department ${department.id}`);
  } catch (error) {
    console.error(
      `Failed to create chat room for department ${department.id}:`,
      error,
    );
  }
};

/**
 * Hook to create a chat room when a new team is created
 * @param {Object} team - Created team
 * @param {string} userId - ID of the user creating the team
 */
export const onTeamCreated = async (team, userId) => {
  try {
    await generateChatRoom(
      'TEAM',
      team.id,
      team.name,
      `Chat room for ${team.name} team`,
      userId,
    );
    console.log(`Created chat room for team ${team.id}`);
  } catch (error) {
    console.error(`Failed to create chat room for team ${team.id}:`, error);
  }
};

/**
 * Hook to create a chat room when a new project is created
 * @param {Object} project - Created project
 * @param {string} userId - ID of the user creating the project
 */
export const onProjectCreated = async (project, userId) => {
  try {
    await generateChatRoom(
      'PROJECT',
      project.id,
      project.name,
      `Chat room for ${project.name} project`,
      userId,
    );
    console.log(`Created chat room for project ${project.id}`);
  } catch (error) {
    console.error(
      `Failed to create chat room for project ${project.id}:`,
      error,
    );
  }
};

/**
 * Hook to create a chat room when a new task is created
 * @param {Object} task - Created task
 * @param {string} userId - ID of the user creating the task
 */
export const onTaskCreated = async (task, userId) => {
  try {
    await generateChatRoom(
      'TASK',
      task.id,
      task.title,
      `Chat room for task: ${task.title}`,
      userId,
    );
    // console.log(`Created chat room for task ${task.id}`);
  } catch (error) {
    console.error(`Failed to create chat room for task ${task.id}:`, error);
  }
};
