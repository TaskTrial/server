# Server Repository

This repository contains the server-side implementation for the project. It handles **backend logic**, **database** interactions, and serves **APIs** for the application.

## Usage

```bash

cd server/
#install first
npm install
# run the server
npm run start:dev # and makesure there is no error
```

## Completed Endpoints

You can test your APIs using **_Swagger_** from [_here_](http://localhost:3000/api-docs/) after running the server

base url: `http://localhost:3000`

### Auth

- Sign up or register: `POST /api/auth/signup`
- Verify email: `POST /api/auth/verifyEmail`
- Sign in or login: `POST /api/auth/signin`
- Forget Password: `POST /api/auth/forgotPassword`
- Reset Password: `POST /api/auth/resetPassword`
- Refresh Access Token: `POST /api/auth/refreshAccessToken`
- Login with google: `POST /api/auth/google`
- Logout: `POST /api/auth/logout`

### User

- Get all Users: `GET /api/users/all`
- Get a specific User: `GET /api/users/:id`
- Update a User: `PUT /api/users/:id`
- Update User Password: `PUT /api/users/update-password/:id`
- Delete a User: `DELETE /api/users/:id`
- Restore a User: `PATCH /api/users/restore/:id`
- Upload User Profile Picture: `POST /api/users/:userId/profile-picture`
- Delete User Profile Picture: `DELETE /api/users/:userId/profile-picture`

### Organization

- Create an Organization: `POST /api/organization`
- Verify an Organization: `POST /api/organization/verifyOrg`
- Get all Organizations: `GET /api/organization/all`
- Get a specific Organization: `GET /api/organization/:organizationId`
- Update an Organization: `PUT /api/organization/:organizationId`
- Delete an Organization: `DELETE /api/organization/:organizationId`
- Add owners to the org: `POST /api/organization/:organizationId/addOwner`
- Upload the organization logo: `POST /api/organization/:organizationId/logo/upload`
- Delete the organization logo: `DELETE /api/organization/:organizationId/logo/delete`

### Department

### Team

- Create a new team in a specific organization: `POST /api/organization/:organizationId/department/:departmentId/team`
- Add new team members: `POST /api/organization/:organizationId/department/:departmentId/team/:teamId/addMember`
- Remove member from a team: `DELETE /api/organization/:organizationId/department/:departmentId/team/:teamId/members/:memberId`
- Update a team: `PUT /api/organization/:organizationId/department/:departmentId/team/:teamId`
- Upload team avatar: `POST /api/organization/:organizationId/department/:departmentId/team/:teamId/avatar/upload`
- Delete team avatar: `DELETE /api/organization/:organizationId/department/:departmentId/team/:teamId/avatar/delete`
- Delete a team: `DELETE /api/organization/:organizationId/department/:departmentId/team/:teamId`
- Get all teams: `GET /api/organization/:organizationId/department/:departmentId/teams/all`
- Get a specific team: `GET /api/organization/:organizationId/department/:departmentId/teams/:teamId`
