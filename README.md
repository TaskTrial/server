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

- **Sign up** or **register**: POST `/api/auth/signup`
- **Verify email**: POST `/api/auth/verifyEmail`
- **Sign in** or **login**: POST `/api/auth/signin`
- **Forget Password**: POST `/api/auth/forgotPassword`
- **Reset Password**: POST `/api/auth/resetPassword`
- **Refresh Access Token**: POST `/api/auth/refreshAccessToken`
- **Login with google**: POST `/auth/google`

### User

- **Get all Users**: GET `/api/users/all`
- **Get a specific User**: GET `/api/users/:id`
- **Update a User**: PUT `/api/users/:id`
- **Update User Password**: PUT `/api/users/update-password/:id`
- **Delete a User**: DELETE `/api/users/:id`
- **Restore a User**: PATCH `/api/users/restore/:id`

### Organization

- **Create an Organization**: POST `/api/organization`
- **Verify an Organization**: POST `/api/organization/verifyOrg`
- **Get all Organizations**: GET `/api/organization/all`
- **Get a specific Organization**: GET `/api/organization/:organizationId`
- **Update an Organization**: PUT `/api/organization/:organizationId`
