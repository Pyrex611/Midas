import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase';
import { logger } from '../config/logger';
import prisma from '../lib/prisma';

/**
 * POST /api/auth/signup
 * Create a new user in Supabase and add a corresponding record in our User table.
 */
export const signUp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, username } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // 1. Create user in Supabase
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
      },
    });

    if (error) throw error;
    if (!data.user) throw new Error('User creation failed');

    // 2. Create corresponding user in our database
    try {
      await prisma.user.create({
        data: {
          id: data.user.id,
          email: data.user.email!,
        },
      });
      logger.info({ userId: data.user.id }, 'User record created in local DB');
    } catch (dbError: any) {
      // If user already exists (e.g., from a previous signup), ignore
      if (dbError.code === 'P2002') {
        logger.warn({ userId: data.user.id }, 'User already exists in local DB');
      } else {
        throw dbError;
      }
    }

    logger.info({ userId: data.user.id }, 'User signed up');
    res.status(201).json({
      user: data.user,
      session: data.session,
    });
  } catch (error: any) {
    logger.error({ error }, 'Signup failed');
    res.status(400).json({ error: error.message });
  }
};

/**
 * POST /api/auth/signin
 * Sign in an existing user and ensure they have a record in our User table.
 */
export const signIn = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error('Signin failed');

    // Ensure user exists in our database
    try {
      await prisma.user.upsert({
        where: { id: data.user.id },
        update: {},
        create: {
          id: data.user.id,
          email: data.user.email!,
        },
      });
      logger.info({ userId: data.user.id }, 'User record ensured in local DB');
    } catch (dbError: any) {
      logger.error({ dbError }, 'Failed to ensure user record');
      // Continue anyway – maybe they already exist
    }

    logger.info({ userId: data.user.id }, 'User signed in');
    res.json({ user: data.user, session: data.session });
  } catch (error: any) {
    logger.error({ error }, 'Signin failed');
    res.status(401).json({ error: error.message });
  }
};

/**
 * POST /api/auth/signout
 * Sign out the current user.
 */
export const signOut = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    logger.info('User signed out');
    res.json({ success: true });
  } catch (error: any) {
    logger.error({ error }, 'Signout failed');
    res.status(400).json({ error: error.message });
  }
};

/**
 * GET /api/auth/session
 * Retrieve the current session.
 */
export const getSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;

    res.json({ session: data.session });
  } catch (error: any) {
    logger.error({ error }, 'Get session failed');
    res.status(400).json({ error: error.message });
  }
};