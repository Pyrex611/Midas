import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from './auth.middleware';
import { verifyOperatorToken } from '../lib/operatorAuth';

export interface AdminAuthRequest extends AuthRequest {
  isBootstrapAdminAccess?: boolean;
  hasOperatorToken?: boolean;
}

export async function requireAdmin(req: AdminAuthRequest, res: Response, next: NextFunction) {
  try {
    // 1. Fresh DB lookup prevents stale 3-minute auth cache from granting or blocking admin access
    if (req.user?.id) {
      const freshUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { isAdmin: true },
      });
      if (freshUser?.isAdmin) {
        req.user.isAdmin = true;
        return next();
      }
      req.user.isAdmin = false;
    }

    // 2. Cryptographic operator token (when OPERATOR_PASSPHRASE is explicitly set)
    const operatorToken = req.headers['x-operator-token'] as string | undefined;
    if (operatorToken && verifyOperatorToken(operatorToken)) {
      req.hasOperatorToken = true;
      return next();
    }

    // 3. Zero-Lockout Bootstrap Mode: If ZERO admins exist in PostgreSQL, allow
    // authenticated access so the operator can promote their account in-place.
    const adminCount = await prisma.user.count({ where: { isAdmin: true } });
    if (adminCount === 0) {
      req.isBootstrapAdminAccess = true;
      return next();
    }

    return res.status(403).json({
      error: 'Forbidden: Platform administrator privileges required.',
      isAdminRequired: true,
    });
  } catch (err) {
    next(err);
  }
}