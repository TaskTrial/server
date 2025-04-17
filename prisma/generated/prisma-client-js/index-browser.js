/*eslint-disable */
Object.defineProperty(exports, '__esModule', { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip,
} = require('./runtime/index-browser.js');

const Prisma = {};

exports.Prisma = Prisma;
exports.$Enums = {};

/**
 * Prisma Client JS version: 6.6.0
 * Query Engine version: f676762280b54cd07c770017ed3711ddde35f37a
 */
Prisma.prismaVersion = {
  client: '6.6.0',
  engine: 'f676762280b54cd07c770017ed3711ddde35f37a',
};

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`);
};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`);
};
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`);
};
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`);
};
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`);
};
Prisma.Decimal = Decimal;

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`);
};
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`);
};
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`);
};
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`);
};
Prisma.validator = Public.validator;

/**
 * Extensions
 */
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`);
};
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`);
};

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull;
Prisma.JsonNull = objectEnumValues.instances.JsonNull;
Prisma.AnyNull = objectEnumValues.instances.AnyNull;

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull,
};

/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable',
});

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  email: 'email',
  username: 'username',
  password: 'password',
  firebaseUid: 'firebaseUid',
  firstName: 'firstName',
  lastName: 'lastName',
  role: 'role',
  profilePic: 'profilePic',
  departmentId: 'departmentId',
  organizationId: 'organizationId',
  isOwner: 'isOwner',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  isActive: 'isActive',
  deletedAt: 'deletedAt',
  phoneNumber: 'phoneNumber',
  jobTitle: 'jobTitle',
  timezone: 'timezone',
  bio: 'bio',
  preferences: 'preferences',
  emailVerificationToken: 'emailVerificationToken',
  emailVerificationExpires: 'emailVerificationExpires',
  passwordResetToken: 'passwordResetToken',
  passwordResetExpires: 'passwordResetExpires',
  refreshToken: 'refreshToken',
  lastLogin: 'lastLogin',
  lastLogout: 'lastLogout',
};

exports.Prisma.OrganizationScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  industry: 'industry',
  sizeRange: 'sizeRange',
  website: 'website',
  logoUrl: 'logoUrl',
  isVerified: 'isVerified',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt',
  createdBy: 'createdBy',
  address: 'address',
  contactEmail: 'contactEmail',
  contactPhone: 'contactPhone',
  emailVerificationOTP: 'emailVerificationOTP',
  emailVerificationExpires: 'emailVerificationExpires',
};

exports.Prisma.OrganizationOwnerScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  userId: 'userId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.DepartmentScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  organizationId: 'organizationId',
  managerId: 'managerId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt',
};

exports.Prisma.TeamScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  createdBy: 'createdBy',
  organizationId: 'organizationId',
  departmentId: 'departmentId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt',
  avatar: 'avatar',
};

exports.Prisma.TeamMemberScalarFieldEnum = {
  id: 'id',
  teamId: 'teamId',
  userId: 'userId',
  role: 'role',
  joinedAt: 'joinedAt',
  isActive: 'isActive',
  deletedAt: 'deletedAt',
};

exports.Prisma.ProjectScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  status: 'status',
  createdBy: 'createdBy',
  organizationId: 'organizationId',
  teamId: 'teamId',
  startDate: 'startDate',
  endDate: 'endDate',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt',
  priority: 'priority',
  progress: 'progress',
  budget: 'budget',
  lastModifiedBy: 'lastModifiedBy',
};

exports.Prisma.ProjectMemberScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  userId: 'userId',
  role: 'role',
  isActive: 'isActive',
  joinedAt: 'joinedAt',
  leftAt: 'leftAt',
  deletedAt: 'deletedAt',
};

exports.Prisma.SprintScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  name: 'name',
  description: 'description',
  startDate: 'startDate',
  endDate: 'endDate',
  status: 'status',
  goal: 'goal',
  order: 'order',
};

exports.Prisma.TaskScalarFieldEnum = {
  id: 'id',
  title: 'title',
  description: 'description',
  priority: 'priority',
  status: 'status',
  rate: 'rate',
  projectId: 'projectId',
  sprintId: 'sprintId',
  createdBy: 'createdBy',
  assignedTo: 'assignedTo',
  dueDate: 'dueDate',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt',
  estimatedTime: 'estimatedTime',
  actualTime: 'actualTime',
  parentId: 'parentId',
  order: 'order',
  labels: 'labels',
  lastModifiedBy: 'lastModifiedBy',
};

exports.Prisma.TaskAttachmentScalarFieldEnum = {
  id: 'id',
  taskId: 'taskId',
  fileName: 'fileName',
  fileType: 'fileType',
  filePath: 'filePath',
  fileSize: 'fileSize',
  uploadedBy: 'uploadedBy',
  createdAt: 'createdAt',
  storageProvider: 'storageProvider',
  storageKey: 'storageKey',
};

exports.Prisma.TaskDependencyScalarFieldEnum = {
  id: 'id',
  taskId: 'taskId',
  dependentTaskId: 'dependentTaskId',
  dependencyType: 'dependencyType',
  description: 'description',
};

exports.Prisma.TaskTemplateScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  priority: 'priority',
  estimatedTime: 'estimatedTime',
  organizationId: 'organizationId',
  createdBy: 'createdBy',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  checklist: 'checklist',
  labels: 'labels',
  isPublic: 'isPublic',
};

exports.Prisma.TimelogScalarFieldEnum = {
  id: 'id',
  taskId: 'taskId',
  userId: 'userId',
  startTime: 'startTime',
  endTime: 'endTime',
  description: 'description',
};

exports.Prisma.CommentScalarFieldEnum = {
  id: 'id',
  taskId: 'taskId',
  userId: 'userId',
  content: 'content',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.ActivityLogScalarFieldEnum = {
  id: 'id',
  entityType: 'entityType',
  entityId: 'entityId',
  userId: 'userId',
  action: 'action',
  details: 'details',
  createdAt: 'createdAt',
};

exports.Prisma.NotificationScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  content: 'content',
  isRead: 'isRead',
  type: 'type',
  metadata: 'metadata',
  createdAt: 'createdAt',
  deletedAt: 'deletedAt',
  entityType: 'entityType',
  entityId: 'entityId',
};

exports.Prisma.ReportScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  reportType: 'reportType',
  format: 'format',
  parameters: 'parameters',
  filePath: 'filePath',
  generatedBy: 'generatedBy',
  createdAt: 'createdAt',
  organizationId: 'organizationId',
  teamId: 'teamId',
  projectId: 'projectId',
  departmentId: 'departmentId',
  userId: 'userId',
  storageProvider: 'storageProvider',
  storageKey: 'storageKey',
};

exports.Prisma.PermissionScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  entityType: 'entityType',
  entityId: 'entityId',
  permissions: 'permissions',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc',
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull,
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive',
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull,
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last',
};
exports.UserRole = exports.$Enums.UserRole = {
  OWNER: 'OWNER',
  MANAGER: 'MANAGER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
  GUEST: 'GUEST',
};

exports.TeamMemberRole = exports.$Enums.TeamMemberRole = {
  MEMBER: 'MEMBER',
  LEADER: 'LEADER',
  VIEWER: 'VIEWER',
};

exports.TaskPriority = exports.$Enums.TaskPriority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
};

exports.TaskStatus = exports.$Enums.TaskStatus = {
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  REVIEW: 'REVIEW',
  DONE: 'DONE',
};

exports.DependencyType = exports.$Enums.DependencyType = {
  BLOCKS: 'BLOCKS',
  REQUIRES: 'REQUIRES',
  RELATES_TO: 'RELATES_TO',
  DUPLICATES: 'DUPLICATES',
};

exports.ReportType = exports.$Enums.ReportType = {
  ORGANIZATION: 'ORGANIZATION',
  DEPARTMENT: 'DEPARTMENT',
  TEAM: 'TEAM',
  PROJECT: 'PROJECT',
  TASK: 'TASK',
  USER_PERFORMANCE: 'USER_PERFORMANCE',
};

exports.Prisma.ModelName = {
  User: 'User',
  Organization: 'Organization',
  OrganizationOwner: 'OrganizationOwner',
  Department: 'Department',
  Team: 'Team',
  TeamMember: 'TeamMember',
  Project: 'Project',
  ProjectMember: 'ProjectMember',
  Sprint: 'Sprint',
  Task: 'Task',
  TaskAttachment: 'TaskAttachment',
  TaskDependency: 'TaskDependency',
  TaskTemplate: 'TaskTemplate',
  Timelog: 'Timelog',
  Comment: 'Comment',
  ActivityLog: 'ActivityLog',
  Notification: 'Notification',
  Report: 'Report',
  Permission: 'Permission',
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message;
        const runtime = getRuntime();
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message =
            'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' +
            runtime.prettyName +
            '`).';
        }

        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`;

        throw new Error(message);
      },
    });
  }
}

exports.PrismaClient = PrismaClient;

Object.assign(exports, Prisma);
