import { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma';
import { CreateUserInput, LoginInput } from '../types';

export class AuthController {
  async register(
    request: FastifyRequest<{ Body: CreateUserInput }>,
    reply: FastifyReply
  ) {
    try {
      const { name, email, password } = request.body;

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return reply.status(400).send({
          success: false,
          error: 'User already exists with this email',
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const user = await prisma.user.create({
        data: {
          name,
          email,
          emailVerified: false,
        },
      });

      // Create account with password
      await prisma.account.create({
        data: {
          id: `account_${user.id}`,
          accountId: user.id,
          providerId: 'credential',
          userId: user.id,
          password: hashedPassword,
        },
      });

      return reply.status(201).send({
        success: true,
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to register user',
      });
    }
  }

  async login(
    request: FastifyRequest<{ Body: LoginInput }>,
    reply: FastifyReply
  ) {
    try {
      const { email, password } = request.body;

      // Find user
      const user = await prisma.user.findUnique({
        where: { email },
        include: {
          accounts: {
            where: { providerId: 'credential' },
          },
        },
      });

      if (!user || !user.accounts[0]?.password) {
        return reply.status(401).send({
          success: false,
          error: 'Invalid credentials',
        });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(
        password,
        user.accounts[0].password
      );

      if (!isValidPassword) {
        return reply.status(401).send({
          success: false,
          error: 'Invalid credentials',
        });
      }

      // Create session
      const sessionToken = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

      const session = await prisma.session.create({
        data: {
          id: `session_${crypto.randomUUID()}`,
          token: sessionToken,
          userId: user.id,
          expiresAt,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        },
      });

      return reply.send({
        success: true,
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
          },
          token: session.token,
        },
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to login',
      });
    }
  }

  async logout(request: FastifyRequest, reply: FastifyReply) {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '');

      if (token) {
        await prisma.session.delete({
          where: { token },
        });
      }

      return reply.send({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to logout',
      });
    }
  }

  async me(request: FastifyRequest, reply: FastifyReply) {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return reply.status(401).send({
          success: false,
          error: 'No token provided',
        });
      }

      const session = await prisma.session.findUnique({
        where: { token },
        include: { user: true },
      });

      if (!session || session.expiresAt < new Date()) {
        return reply.status(401).send({
          success: false,
          error: 'Invalid or expired token',
        });
      }

      return reply.send({
        success: true,
        data: {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          image: session.user.image,
        },
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get user',
      });
    }
  }
}
