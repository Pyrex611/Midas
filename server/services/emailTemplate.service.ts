export interface BrandEnvelopeOptions {
  brandName?: string | null;
  brandInitials?: string | null;
  brandColorHex?: string | null;
  logoUrl?: string | null;
  brandingEnabled?: boolean;
}

export class EmailTemplateService {
  /**
   * Wraps personalized email copy in a responsive, centered card envelope
   * matching the PyrexxAI / Resend visual standard.
   * If brandingEnabled is false, returns bodyHtml unmodified.
   */
  wrapInBrandTemplate(bodyHtml: string, options: BrandEnvelopeOptions): string {
    if (!options.brandingEnabled) {
      return bodyHtml;
    }

    const brandName = options.brandName?.trim() || 'Outreach';
    const brandColor = options.brandColorHex?.trim() || '#2563EB';
    const brandInitials = (options.brandInitials?.trim() || brandName.slice(0, 2)).toUpperCase();
    const logoUrl = options.logoUrl?.trim();

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
        <!-- Main Card Container (Max Width 580px) -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; width: 100%; background-color: #FFFFFF; border-radius: 16px; border: 1px solid #E5E7EB; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05); overflow: hidden;">
          <!-- Header Row -->
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

          <!-- Email Body Content -->
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