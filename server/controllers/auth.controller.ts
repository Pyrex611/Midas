import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { logger } from '../config/logger';

const SECRET = process.env.AUTH_SECRET || 'fallback_secret_for_dev_32_chars_min';

export const signUp = async (req: Request, res: Response, next: NextFunction) => {
  console.log('[DEBUG AUTH 1] signUp endpoint triggered for email:', req.body?.email);
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      console.log('[DEBUG AUTH 2] Missing email or password in request body');
      return res.status(400).json({ error: 'Email and password required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    console.log('[DEBUG AUTH 3] Querying prisma.user.findUnique for:', cleanEmail);

    const existingUser = await prisma.user.findUnique({ where: { email: cleanEmail } });
    console.log('[DEBUG AUTH 4] prisma.user.findUnique query completed. User exists:', !!existingUser);

    if (existingUser) {
      console.log('[DEBUG AUTH 5] Aborting: User already exists');
      return res.status(400).json({ error: 'User already exists' });
    }

    console.log('[DEBUG AUTH 6] Hashing password with bcrypt...');
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('[DEBUG AUTH 7] Password hashed. Executing prisma.user.create...');

    const user = await prisma.user.create({
      data: {
        email: cleanEmail,
        password: hashedPassword,
        name: name || cleanEmail.split('@')[0],
      },
    });
    console.log('[DEBUG AUTH 8] User successfully created in DB with ID:', user.id);

    const token = jwt.sign({ userId: user.id, email: user.email }, SECRET, { expiresIn: '7d' });
    console.log('[DEBUG AUTH 9] JWT signed. Sending 201 response back to client.');

    res.status(201).json({
      success: true,
      token,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (error: any) {
    console.error('[DEBUG AUTH ERROR]', error);
    logger.error('Signup failed', { error: error.message || String(error) });
    res.status(400).json({ error: String(error.message || 'Signup failed') });
  }
};

export const signIn = async (req: Request, res: Response, next: NextFunction) => {
  console.log('[DEBUG AUTH SIGNIN 1] signIn endpoint triggered for:', req.body?.email);
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    console.log('[DEBUG AUTH SIGNIN 2] Querying prisma.user.findUnique...');

    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
    console.log('[DEBUG AUTH SIGNIN 3] Query complete. User found:', !!user);

    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    console.log('[DEBUG AUTH SIGNIN 4] Comparing password hash...');
    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, SECRET, { expiresIn: '7d' });
    console.log('[DEBUG AUTH SIGNIN 5] Password valid. Returning session token.');

    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (error: any) {
    console.error('[DEBUG AUTH SIGNIN ERROR]', error);
    logger.error('Signin failed', { error: error.message || String(error) });
    res.status(401).json({ error: String(error.message || 'Signin failed') });
  }
};

export const getSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) return res.json({ user: null });

    const payload = jwt.verify(token, SECRET) as { userId: string; email: string };
    
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, name: true },
    });

    res.json({ user: user || null });
  } catch {
    res.json({ user: null });
  }
};

export const signOut = async (req: Request, res: Response, next: NextFunction) => {
  res.json({ success: true });
};