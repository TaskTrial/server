import prisma from '../config/prismaClient.js';
import { authenticate } from '../middlewares/auth.middleware.js';

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Retrieve all users
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   email:
 *                     type: string
 *                   firstName:
 *                     type: string
 *                   lastName:
 *                     type: string
 *                   role:
 *                     type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
export const getAllUsers = async (req, res, next) => {
  try {
    // Fetch all users from the database
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    return res.status(200).json({
      message: 'Users retrieved successfully',
      users,
    });
  } catch (error) {
    next(error);
  }
};
