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

### Auth

- **Sign up** or **register**: `/api/auth/signup`
- **Verify email**: `/api/auth/verifyEmail`
- **Sign in** or **login**: `/api/auth/signin`
- **Forget Password**: `/api/auth/forgotPassword`
- **Reset Password**: `/api/auth/resetPassword`
- **Refresh Access Token**: `/api/auth/refreshAccessToken`
- **Login with google**: `/auth/google`
