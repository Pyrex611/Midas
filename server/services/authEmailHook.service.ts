import crypto from 'crypto';
import prisma from '../lib/prisma';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { emailTemplateService } from './emailTemplate.service';
import { espRouter } from './esp';

interface HookHeaders {
  'webhook-id'?: string;
  'webhook-timestamp'?: string;
  'webhook-signature'?: string;
}

export class AuthEmailHookService {
  isAdminServiceConfigured(): boolean {
    return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
  }

  /**
   * Verifies Standard Webhooks signature used by Supabase HTTP Auth Hooks.
   * Supports `v1,whsec_<base64>`, `whsec_<base64>`, and `|`-separated rotated secrets.
   */
  verifySignature(rawBody: Buffer | string, headers: HookHeaders): boolean {
    const rawSecret = env.SUPABASE_SEND_EMAIL_HOOK_SECRET;
    if (!rawSecret) return false;

    const webhookId = headers['webhook-id'];
    const webhookTimestamp = headers['webhook-timestamp'];
    const webhookSignature = headers['webhook-signature'];
    if (!webhookId || !webhookTimestamp || !webhookSignature) return false;

    const tsNum = Number(webhookTimestamp);
    if (!Number.isFinite(tsNum) || Math.abs(Math.floor(Date.now() / 1000) - tsNum) > 300) {
      return false;
    }

    const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
    const signedContent = `${webhookId}.${webhookTimestamp}.${bodyStr}`;
    const candidateSecrets = rawSecret.split('|').map((s) => s.trim()).filter(Boolean);
    const signatures = webhookSignature.split(' ');

    for (const secretEntry of candidateSecrets) {
      const cleaned = secretEntry.replace(/^v1,/, '').replace(/^whsec_/, '');
      const keyBytes = Buffer.from(cleaned, 'base64');
      const expectedB64 = crypto
        .createHmac('sha256', keyBytes)
        .update(signedContent)
        .digest('base64');

      for (const sigEntry of signatures) {
        const [version, sigB64] = sigEntry.split(',');
        if (version !== 'v1' || !sigB64) continue;
        const a = Buffer.from(sigB64, 'utf8');
        const b = Buffer.from(expectedB64, 'utf8');
        if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
          return true;
        }
      }
    }

    return false;
  }

  private async resolveAuthSender(): Promise<{
    domain: any;
    fromEmail: string;
    rawApiKey?: string;
  }> {
    if (env.AUTH_EMAIL_DOMAIN && env.AUTH_EMAIL_MAILGUN_KEY) {
      const cleanDomain = env.AUTH_EMAIL_DOMAIN.trim();
      const fromEmail = env.AUTH_EMAIL_FROM_ADDRESS?.trim() || `auth@${cleanDomain}`;
      return {
        domain: { domainName: cleanDomain, espProvider: 'mailgun', mailgunRegion: env.AUTH_EMAIL_REGION },
        fromEmail,
        rawApiKey: env.AUTH_EMAIL_MAILGUN_KEY.trim(),
      };
    }

    if (env.SANDBOX_DOMAIN && env.SANDBOX_MAILGUN_KEY) {
      const cleanDomain = env.SANDBOX_DOMAIN.trim();
      const fromEmail = env.AUTH_EMAIL_FROM_ADDRESS?.trim() || `auth@${cleanDomain}`;
      return {
        domain: { domainName: cleanDomain, espProvider: 'mailgun', mailgunRegion: env.SANDBOX_REGION },
        fromEmail,
        rawApiKey: env.SANDBOX_MAILGUN_KEY.trim(),
      };
    }

    if (env.MAILGUN_API_KEY && env.EMAIL_FROM && env.EMAIL_FROM.includes('.') && !env.EMAIL_FROM.includes('vercel.app')) {
      const cleanDomain = env.EMAIL_FROM.trim();
      const fromEmail = env.AUTH_EMAIL_FROM_ADDRESS?.trim() || `auth@${cleanDomain}`;
      return {
        domain: { domainName: cleanDomain, espProvider: 'mailgun', mailgunRegion: env.MAILGUN_REGION },
        fromEmail,
        rawApiKey: env.MAILGUN_API_KEY.trim(),
      };
    }

    const activeDomain =
      (await prisma.domain.findFirst({
        where: { status: 'active', sendTestPassedAt: { not: null }, user: { isAdmin: true } },
        include: { senders: { where: { status: 'active' }, take: 1 } },
      })) ||
      (await prisma.domain.findFirst({
        where: { status: 'active', sendTestPassedAt: { not: null } },
        include: { senders: { where: { status: 'active' }, take: 1 } },
      }));

    if (activeDomain) {
      const localPart = activeDomain.senders?.[0]?.localPart || 'auth';
      return {
        domain: activeDomain,
        fromEmail: env.AUTH_EMAIL_FROM_ADDRESS?.trim() || `${localPart}@${activeDomain.domainName}`,
      };
    }

    throw new Error('No transactional domain configured for MIDAS Auth OTP delivery.');
  }

  private buildConfirmUrl(supabaseUrl: string, tokenHash: string, type: string, redirectTo?: string): string {
    const base = supabaseUrl.replace(/\/$/, '');
    const qs = new URLSearchParams({ token_hash: tokenHash, type });
    if (redirectTo) qs.set('redirect_to', redirectTo);
    return `${base}/auth/v1/verify?${qs.toString()}`;
  }

  private buildDirectAppMagicLink(tokenHash: string, type: string = 'email'): string {
    const baseAppUrl = (env.APP_URL || 'https://midas-aem.vercel.app').replace(/\/$/, '');
    const qs = new URLSearchParams({ token_hash: tokenHash, type });
    return `${baseAppUrl}/login?${qs.toString()}`;
  }

  private renderOtpEmail(options: {
    heading: string;
    subtitle: string;
    token?: string;
    actionUrl?: string;
    actionLabel?: string;
  }) {
    const tokenBlock = options.token
      ? `<div style="margin: 22px 0; padding: 18px; background: #F7F1F7; border: 1px solid rgba(212,175,55,0.55); border-radius: 14px; text-align: center;">
           <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: #7A4E7A; margin-bottom: 6px;">One-Time Verification Code</div>
           <div style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 32px; font-weight: 900; letter-spacing: 0.25em; color: #1F1124;">${options.token}</div>
         </div>`
      : '';

    const linkBlock = options.actionUrl
      ? `<p style="margin: 18px 0; text-align: center;">
           <a href="${options.actionUrl}" style="display: inline-block; padding: 12px 26px; background: #4A2559; color: #FFFFFF; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 13px; border: 1px solid rgba(212,175,55,0.5);">
             ${options.actionLabel || 'Sign In to MIDAS'}
           </a>
         </p>`
      : '';

    const bodyHtml = `
      <h2 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 800; color: #1F1124;">${options.heading}</h2>
      <p style="margin: 0 0 14px 0; font-size: 14px; color: #33183E; line-height: 1.6;">${options.subtitle}</p>
      ${tokenBlock}
      ${linkBlock}
      <p style="margin: 18px 0 0 0; font-size: 12px; color: #7A4E7A;">If you did not request this email, you can safely ignore it.</p>
    `;

    const wrappedHtml = emailTemplateService.wrapInBrandTemplate(bodyHtml, {
      brandName: 'MIDAS Auth',
      brandInitials: 'M',
      brandColorHex: '#4A2559',
      brandingEnabled: true,
      templateStyle: 'card',
    });

    const plainText = [
      options.heading,
      '',
      options.subtitle,
      options.token ? `\nVerification Code: ${options.token}` : '',
      options.actionUrl ? `\nSign-In Link: ${options.actionUrl}` : '',
      '\nIf you did not request this email, you can safely ignore it.',
    ]
      .filter(Boolean)
      .join('\n');

    return { html: wrappedHtml, text: plainText };
  }

  private async dispatchAuthMessages(
    dispatches: Array<{ to: string; subject: string; html: string; text: string }>,
    actionType: string
  ) {
    const { domain, fromEmail, rawApiKey } = await this.resolveAuthSender();
    const fromHeader = `"MIDAS" <${fromEmail}>`;

    for (const msg of dispatches) {
      if (!msg.to) continue;
      const result = await espRouter.send({
        domain,
        fromEmail,
        fromHeader,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        outboundEmailId: `auth_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        isColdOutreach: false,
        disableTracking: true,
        rawApiKey,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to dispatch auth email via MIDAS ESP');
      }
      logger.info({ actionType, to: msg.to, messageId: result.messageId }, '[AUTH-EMAIL] Dispatched auth email');
    }
  }

  /**
   * Calls Supabase Admin `POST /auth/v1/admin/generate_link` (magiclink) to mint
   * an authentic Supabase OTP + hashed_token without hitting Supabase's 2/hr
   * email limit, then dispatches strictly the requested format (code or direct link).
   */
  async generateAndDispatchChallenge(options: {
    email: string;
    deliveryType: 'code' | 'link';
    name?: string;
  }): Promise<void> {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
    }

    const baseUrl = env.SUPABASE_URL.replace(/\/$/, '');
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY.trim();
    const cleanEmail = options.email.trim().toLowerCase();

    const genRes = await fetch(`${baseUrl}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'magiclink',
        email: cleanEmail,
        data: options.name ? { full_name: options.name, name: options.name } : undefined,
      }),
      signal: AbortSignal.timeout(8_000),
    });

    const data: any = await genRes.json().catch(() => ({}));
    if (!genRes.ok) {
      throw new Error(data.msg || data.message || data.error_description || `Supabase admin generate_link failed (${genRes.status})`);
    }

    const emailOtp: string | undefined = data.email_otp || data.properties?.email_otp;
    const hashedToken: string | undefined = data.hashed_token || data.properties?.hashed_token;

    if (options.deliveryType === 'code') {
      if (!emailOtp) {
        throw new Error('Supabase did not return an email_otp for this request');
      }
      const rendered = this.renderOtpEmail({
        heading: 'Your MIDAS Verification Code',
        subtitle: 'Enter this one-time verification code on MIDAS to sign in or finish setting up your password.',
        token: emailOtp,
      });
      await this.dispatchAuthMessages(
        [{ to: cleanEmail, subject: `MIDAS Verification Code: ${emailOtp}`, ...rendered }],
        'admin_otp_code'
      );
    } else {
      if (!hashedToken) {
        throw new Error('Supabase did not return a hashed_token for sign-in link');
      }
      const directLink = this.buildDirectAppMagicLink(hashedToken, 'email');
      const rendered = this.renderOtpEmail({
        heading: 'Your MIDAS Sign-In Link',
        subtitle: 'Click the button below to verify your email and sign straight into your MIDAS workspace.',
        actionUrl: directLink,
        actionLabel: 'Sign In to MIDAS →',
      });
      await this.dispatchAuthMessages(
        [{ to: cleanEmail, subject: 'Sign In to MIDAS', ...rendered }],
        'admin_magic_link'
      );
    }
  }

  /**
   * Registers a brand-new password user via Supabase Admin API without triggering
   * Supabase's 2/hr built-in email limit, then sends the 6-digit verification code via MIDAS.
   */
  async registerPasswordAndSendCode(options: {
    email: string;
    password: string;
    name?: string;
  }): Promise<void> {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
    }

    const baseUrl = env.SUPABASE_URL.replace(/\/$/, '');
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY.trim();
    const cleanEmail = options.email.trim().toLowerCase();

    const createRes = await fetch(`${baseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: cleanEmail,
        password: options.password,
        email_confirm: false,
        user_metadata: options.name ? { full_name: options.name, name: options.name } : undefined,
      }),
      signal: AbortSignal.timeout(8_000),
    });

    const createData: any = await createRes.json().catch(() => ({}));
    if (!createRes.ok) {
      const msg = String(createData.msg || createData.message || '');
      if (createRes.status === 422 || msg.toLowerCase().includes('already')) {
        const conflictErr: any = new Error(
          'An account with this email already exists in Supabase Auth. Use "Generate Code" or sign in with your password.'
        );
        conflictErr.statusCode = 409;
        throw conflictErr;
      }
      throw new Error(msg || `Could not create user (${createRes.status})`);
    }

    await this.generateAndDispatchChallenge({
      email: cleanEmail,
      deliveryType: 'code',
      name: options.name,
    });
  }

  async processSendEmailHook(payload: any): Promise<void> {
    const user = payload?.user || {};
    const emailData = payload?.email_data || {};
    const actionType: string = emailData.email_action_type || 'magiclink';
    const supabaseUrl = env.SUPABASE_URL || emailData.site_url || '';
    const redirectTo = emailData.redirect_to || (env.APP_URL ? `${env.APP_URL}/` : undefined);

    const dispatches: Array<{ to: string; subject: string; html: string; text: string }> = [];

    if (actionType === 'email_change') {
      if (emailData.token_hash_new && user.email && user.new_email) {
        const currentRender = this.renderOtpEmail({
          heading: 'Approve your email change',
          subtitle: `Enter the code below to authorize changing your MIDAS email to ${user.new_email}.`,
          token: emailData.token,
          actionUrl: supabaseUrl ? this.buildConfirmUrl(supabaseUrl, emailData.token_hash_new, 'email_change', redirectTo) : undefined,
          actionLabel: 'Confirm Current Email',
        });
        dispatches.push({ to: user.email, subject: 'MIDAS: Approve Email Change', ...currentRender });

        const newRender = this.renderOtpEmail({
          heading: 'Verify your new email address',
          subtitle: 'Enter this verification code to confirm your new MIDAS email.',
          token: emailData.token_new,
          actionUrl: supabaseUrl ? this.buildConfirmUrl(supabaseUrl, emailData.token_hash, 'email_change', redirectTo) : undefined,
          actionLabel: 'Confirm New Email',
        });
        dispatches.push({ to: user.new_email, subject: 'MIDAS: Confirm New Email', ...newRender });
      } else {
        const targetEmail = user.new_email || user.email;
        const singleRender = this.renderOtpEmail({
          heading: 'Confirm your new email address',
          subtitle: 'Enter the code below to finish updating your MIDAS email.',
          token: emailData.token || emailData.token_new,
          actionUrl: supabaseUrl && emailData.token_hash
            ? this.buildConfirmUrl(supabaseUrl, emailData.token_hash, 'email_change', redirectTo)
            : undefined,
          actionLabel: 'Confirm New Email',
        });
        dispatches.push({ to: targetEmail, subject: 'MIDAS: Confirm New Email', ...singleRender });
      }
    } else {
      const subjectMap: Record<string, string> = {
        signup: 'Your MIDAS Verification Code',
        magiclink: 'Your MIDAS Sign-In / Setup Code',
        recovery: 'Reset Your MIDAS Password',
        invite: 'You Have Been Invited to MIDAS',
        reauthentication: 'MIDAS Security Verification Code',
        password_changed_notification: 'Your MIDAS Password Was Updated',
      };

      const headingMap: Record<string, string> = {
        signup: 'Confirm your MIDAS workspace',
        magiclink: 'Your MIDAS verification code',
        recovery: 'Reset your password',
        invite: 'Accept your MIDAS invitation',
        reauthentication: 'Confirm security action',
        password_changed_notification: 'Password updated',
      };

      const subtitleMap: Record<string, string> = {
        signup: 'Enter this verification code on MIDAS to activate your workspace.',
        magiclink: 'Enter this one-time code on MIDAS or click the sign-in button below.',
        recovery: 'Enter this code on MIDAS to verify your identity and set a new password.',
        invite: 'You have been invited to join MIDAS Golden Email Infrastructure.',
        reauthentication: 'Use this one-time verification code to authorize your security change.',
        password_changed_notification: 'The password on your MIDAS account was updated. If you did not perform this change, contact support immediately.',
      };

      const actionUrl =
        emailData.token_hash
          ? this.buildDirectAppMagicLink(emailData.token_hash, 'email')
          : undefined;

      const rendered = this.renderOtpEmail({
        heading: headingMap[actionType] || 'MIDAS Account Verification',
        subtitle: subtitleMap[actionType] || `Security event: ${actionType}`,
        token: emailData.token,
        actionUrl,
        actionLabel: actionType === 'recovery' ? 'Reset Password' : 'Sign In to MIDAS →',
      });

      dispatches.push({
        to: user.email,
        subject: subjectMap[actionType] || 'MIDAS Verification Code',
        ...rendered,
      });
    }

    await this.dispatchAuthMessages(dispatches, actionType);
  }
}

export const authEmailHookService = new AuthEmailHookService();