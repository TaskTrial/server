import prisma from '../config/prismaClient.js';
feat/59/get-user-by-id
import { getUserByIdValidation } from '../validations/user.validation.js';
//import { validateUserId, validateCreateUser } from '../validations/user.validation.j
// import { authenticate } from '../middlewares/auth.middleware.js';
main

/* eslint no-undef:off */
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
    next(error); // Ensure next is called with the error
  }
};

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     responses:
 *       200:
 *         description: User details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 email:
 *                   type: string
 *                 firstName:
 *                   type: string
 *                 lastName:
 *                   type: string
 *                 role:
 *                   type: string
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
export const getUserById = async (req, res, next) => {
  const { id } = req.params;
  try {
    // Validate the ID format (UUID)
    // const { error } = getUserByIdValidation(req.body);
    // if (error) {
    //   return res.status(400).json({ message: error.details[0].message });
    // }
    // Fetch the user by ID from the database
    const user = await prisma.user.findFirst({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json(user);
  } catch (error) {
    next(error); // Ensure next is called with the error
  }
};
