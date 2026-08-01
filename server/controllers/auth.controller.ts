import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { logger } from '../config/logger';

export const signUp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || email.split('@')[0],
      },
    });

    logger.info({ userId: user.id }, 'User registered in DB');
    res.status(201).json({ success: true, user: { id: user.id, email: user.email, name: user.name } });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Signup failed');
    res.status(400).json({ error: error.message });
  }
};

export const signIn = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    logger.info({ userId: user.id }, 'User signed in via custom credentials route');
    res.json({ success: true, user: { id: user.id, email: user.email, name: user.name } });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Signin failed');
    res.status(401).json({ error: error.message });
  }
};

export const signOut = async (req: Request, res: Response, next: NextFunction) => {
  res.json({ success: true });
};

export const getSession = async (req: Request, res: Response, next: NextFunction) => {
  res.json({ session: null });
};