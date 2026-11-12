export interface BrandEnvelopeOptions {
  brandName?: string | null;
  brandInitials?: string | null;
  brandColorHex?: string | null;
  logoUrl?: string | null;
  brandingEnabled?: boolean;
  templateStyle?: 'card' | 'editorial' | 'minimal' | 'plain' | string;
}

export class EmailTemplateService {
  /**
   * Wraps personalized copy in an email envelope according to the chosen templateStyle:
   * 1. 'card' (Default): Centered 580px PyrexxAI card envelope.
   * 2. 'editorial': Long-form publication layout with header, byline, and reading typography.
   * 3. 'minimal': Clean accent top border with logo header.
   * 4. 'plain': 100% plain HTML without card framing (maximum deliverability).
   */
  wrapInBrandTemplate(bodyHtml: string, options: BrandEnvelopeOptions): string {
    const style = options.templateStyle || 'card';

    // 1. Plain Conversational Style (Zero card framing)
    if (style === 'plain' || options.brandingEnabled === false) {
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #18181b;">
  ${bodyHtml}
</body>
</html>`;
    }

    const brandName = options.brandName?.trim() || 'Pyrexx AI';
    const brandColor = options.brandColorHex?.trim() || '#2563EB';
    const brandInitials = (options.brandInitials?.trim() || brandName.slice(0, 2)).toUpperCase();
    const logoUrl = options.logoUrl?.trim();

    // 2. Editorial Publication Style (Beehiiv / Substack aesthetic)
    if (style === 'editorial') {
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${brandName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FAFAFA; font-family: Georgia, Cambria, 'Times New Roman', Times, serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #FAFAFA; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #FFFFFF; border-radius: 8px; border: 1px solid #E4E4E7; overflow: hidden;">
          <tr>
            <td style="padding: 32px 32px 16px 32px; text-align: center; border-bottom: 2px solid ${brandColor};">
              <span style="font-family: -apple-system, sans-serif; font-size: 20px; font-weight: 900; color: #18181B; letter-spacing: -0.02em; text-transform: uppercase;">
                ${brandName}
              </span>
              <p style="font-family: -apple-system, sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #71717A; margin: 4px 0 0 0;">
                Official Publication Edition
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 36px 32px; color: #27272A; font-size: 16px; line-height: 1.7; word-break: break-word;">
              ${bodyHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
    }

    // 3. Clean Minimal Style (Accent border line header)
    if (style === 'minimal') {
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${brandName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FFFFFF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding: 24px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; width: 100%; border-top: 3px solid ${brandColor}; padding-top: 20px;">
          <tr>
            <td style="padding-bottom: 20px; font-size: 14px; font-weight: 800; color: #18181B;">
              ${brandName}
            </td>
          </tr>
          <tr>
            <td style="color: #27272A; font-size: 15px; line-height: 1.65; word-break: break-word;">
              ${bodyHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
    }

    // 4. Standard Card Envelope Style (Default PyrexxAI standard)
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${brandName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F9FAFB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #F9FAFB; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; width: 100%; background-color: #FFFFFF; border-radius: 16px; border: 1px solid #E5E7EB; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05); overflow: hidden;">
          <tr>
            <td style="padding: 28px 32px 20px 32px; border-bottom: 1px solid #F3F4F6;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  ${
                    logoUrl
                      ? `<td style="vertical-align: middle; padding-right: 12px;">
                          <img src="${logoUrl}" alt="${brandName}" width="32" height="32" style="border-radius: 8px; display: block; object-fit: cover;">
                        </td>`
                      : `<td style="vertical-align: middle; padding-right: 12px;">
                          <div style="width: 32px; height: 32px; border-radius: 8px; background-color: ${brandColor}; color: #FFFFFF; font-weight: 800; font-size: 13px; line-height: 32px; text-align: center; font-family: sans-serif;">
                            ${brandInitials}
                          </div>
                        </td>`
                  }
                  <td style="vertical-align: middle;">
                    <span style="font-size: 15px; font-weight: 700; color: #111827; letter-spacing: -0.01em;">${brandName}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px; color: #1F2937; font-size: 15px; line-height: 1.65; word-break: break-word;">
              ${bodyHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }
}

export const emailTemplateService = new EmailTemplateService();