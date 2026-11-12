import { Router, Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import Papa from 'papaparse';
import crypto from 'crypto';
import prisma from '../../lib/prisma';
import { requireApiKey, requireApiKeyScope, ApiKeyRequest } from '../../middleware/apiKeyAuth.middleware';
import { emailService } from '../../services/email.service';
import { personalisationService } from '../../services/personalisation.service';
import { senderService } from '../../services/sender.service';
import { reconcileCampaignQueue } from '../../controllers/campaign/campaign.queue.controller';
import { logger } from '../../config/logger';

const router = Router();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });

router.use(cors({ origin: true, credentials: true }));

/**
 * GET /api/public/town-crier/widget.js
 * Autonomous Shadow-DOM Injection Engine (Next.js SPA & Cross-Domain Hardened):
 * 1. Derives API origin dynamically from document.currentScript.src (defaults to https://midas-aem.vercel.app).
 * 2. Uses document-level click delegation to support dynamic Next.js client-side route transitions.
 * 3. Uses MutationObserver to auto-mount inline embeds rendered dynamically in SPAs.
 * 4. Supports data-gong attribute for channel attribution and welcome autoresponders.
 */
router.get('/widget.js', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const script = `
(function() {
  window.TownCrier = window.TownCrier || {};

  // 1. Dynamic Origin Resolution: Resolves the actual MIDAS backend domain, not the host website's origin
  var defaultBackend = (function() {
    try {
      if (document.currentScript && document.currentScript.src) {
        return new URL(document.currentScript.src).origin;
      }
      var scripts = document.querySelectorAll('script[src*="widget.js"]');
      if (scripts.length > 0) {
        return new URL(scripts[scripts.length - 1].src).origin;
      }
    } catch (e) {}
    return 'https://midas-aem.vercel.app';
  })();

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  window.TownCrier.subscribe = async function(options) {
    if (!options || !options.email) throw new Error('Email address is required');
    var endpoint = options.endpoint || (defaultBackend + '/api/public/town-crier/subscribe');
    var res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (options.apiKey || '')
      },
      body: JSON.stringify({
        email: options.email,
        name: options.name || undefined,
        cadence: options.cadence || 'weekly',
        tags: options.tags || ['website_widget'],
        gongId: options.gongId || options.gong || undefined,
        campaignId: options.campaignId || undefined,
        metadata: options.metadata || undefined
      })
    });
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok) throw new Error(data.error || 'Subscription failed');
    return data;
  };

  function getContrastColor(hex) {
    if (!hex || typeof hex !== 'string') return '#FFFFFF';
    var c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(function(x) { return x + x; }).join('');
    var num = parseInt(c, 16);
    if (isNaN(num)) return '#FFFFFF';
    var lum = (0.2126 * ((num >> 16) & 255) + 0.7152 * ((num >> 8) & 255) + 0.0722 * (num & 255)) / 255;
    return lum > 0.55 ? '#18181B' : '#FFFFFF';
  }

  function resolveSchema(schemaAttr, fieldsAttr) {
    if (schemaAttr) {
      try {
        var parsed = JSON.parse(schemaAttr);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (!parsed.some(function(f) { return f.name === 'email' || f.type === 'email'; })) {
            parsed.unshift({ name: 'email', type: 'email', label: 'Email Address', placeholder: 'you@company.com', required: true });
          }
          return parsed;
        }
      } catch (e) {
        console.warn('[TownCrier] Invalid data-schema JSON, falling back to data-fields:', e.message);
      }
    }

    var raw = (fieldsAttr || 'email').split(',').map(function(s) { return s.trim().toLowerCase(); }).filter(Boolean);
    if (raw.indexOf('email') === -1) raw.push('email');

    var presets = {
      name: { name: 'name', type: 'text', label: 'Full Name', placeholder: 'Your full name' },
      email: { name: 'email', type: 'email', label: 'Email Address', placeholder: 'Your email address', required: true },
      company: { name: 'company', type: 'text', label: 'Company', placeholder: 'Company / Organization' },
      phone: { name: 'phone', type: 'tel', label: 'Phone Number', placeholder: '+1 (555) 000-0000' },
      cadence: { name: 'cadence', type: 'cadence', label: 'Delivery Cadence' },
      developer: {
        name: 'isDeveloper',
        type: 'boolean',
        label: 'Are you a developer?',
        followUp: { name: 'githubUrl', type: 'url', label: 'GitHub / Portfolio URL', placeholder: 'https://github.com/username' }
      }
    };

    return raw.map(function(token) {
      return presets[token] || { name: token, type: 'text', label: token.charAt(0).toUpperCase() + token.slice(1), placeholder: 'Enter ' + token };
    });
  }

  function renderFieldHtml(field, accent, btnTextColor) {
    var safeName = escapeHtml(field.name);
    var safeLabel = escapeHtml(field.label || field.name);
    var safePlaceholder = escapeHtml(field.placeholder || safeLabel);
    var reqAttr = field.required ? 'required' : '';

    if (field.type === 'cadence') {
      return '<div style="margin-bottom:12px;">' +
        '<span style="font-size:11px;font-weight:700;text-transform:uppercase;margin-bottom:6px;opacity:0.7;display:block;">' + safeLabel + '</span>' +
        '<div class="tc-pills">' +
          '<button type="button" class="tc-pill" data-cadence="daily">Daily</button>' +
          '<button type="button" class="tc-pill active" data-cadence="weekly">Weekly</button>' +
          '<button type="button" class="tc-pill" data-cadence="monthly">Monthly</button>' +
        '</div>' +
      '</div>';
    }

    if (field.type === 'boolean') {
      var followUpHtml = '';
      if (field.followUp) {
        var fName = escapeHtml(field.followUp.name);
        var fType = escapeHtml(field.followUp.type || 'text');
        var fPlaceholder = escapeHtml(field.followUp.placeholder || field.followUp.label || fName);
        followUpHtml = '<div class="tc-bool-expand" data-expand-for="' + safeName + '">' +
          '<input type="' + fType + '" class="tc-input tc-dynamic-input" data-field-name="' + fName + '" placeholder="' + fPlaceholder + '" />' +
        '</div>';
      }

      return '<label class="tc-bool-toggle">' +
        '<span>' + safeLabel + '</span>' +
        '<input type="checkbox" class="tc-dynamic-bool" data-field-name="' + safeName + '" style="cursor:pointer;width:16px;height:16px;accent-color:' + escapeHtml(accent) + ';" />' +
      '</label>' + followUpHtml;
    }

    if (field.type === 'select' && Array.isArray(field.options)) {
      var optsHtml = field.options.map(function(opt) {
        var safeOpt = escapeHtml(opt);
        return '<option value="' + safeOpt + '">' + safeOpt + '</option>';
      }).join('');
      return '<select class="tc-input tc-dynamic-input" data-field-name="' + safeName + '" ' + reqAttr + '>' +
        '<option value="">-- Select ' + safeLabel + ' --</option>' + optsHtml +
      '</select>';
    }

    var safeType = escapeHtml(field.type || 'text');
    return '<input type="' + safeType + '" class="tc-input tc-dynamic-input" data-field-name="' + safeName + '" placeholder="' + safePlaceholder + '" ' + reqAttr + ' />';
  }

  window.TownCrier.openModal = function(options) {
    options = options || {};
    var key = options.apiKey || options.key || '';
    var gongId = options.gongId || options.gong || '';
    var endpoint = options.endpoint || (defaultBackend + '/api/public/town-crier/subscribe');
    var headline = escapeHtml(options.headline || 'Join Our Newsletter');
    var subheadline = escapeHtml(options.subheadline || 'Get high-signal insights and product updates delivered to your inbox.');
    var accent = options.accent || '#2563EB';
    var bg = options.bg || '#FFFFFF';
    var text = options.text || '#18181B';
    var radius = options.radius || '20px';
    var btnText = escapeHtml(options.buttonText || 'Subscribe');
    var btnTextColor = getContrastColor(accent);

    var schema = Array.isArray(options.schema) && options.schema.length > 0
      ? options.schema
      : resolveSchema(null, Array.isArray(options.fields) ? options.fields.join(',') : (options.fields || 'name,email,cadence'));

    var backdrop = document.createElement('div');
    backdrop.id = 'tc-modal-backdrop';
    backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(9,9,11,0.7);backdrop-filter:blur(6px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';

    var host = document.createElement('div');
    var shadow = host.attachShadow({ mode: 'open' });

    var css = \`
      * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
      .tc-card { background: \${bg}; border-radius: \${radius}; padding: 32px; max-width: 440px; width: 100%; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.3); border: 1px solid rgba(0,0,0,0.1); position: relative; color: \${text}; max-height: 90vh; overflow-y: auto; }
      .tc-close { position: absolute; top: 16px; right: 16px; background: transparent; border: none; color: \${text}; opacity: 0.6; font-size: 16px; cursor: pointer; padding: 4px; }
      .tc-head { font-size: 18px; font-weight: 900; margin: 0 0 4px 0; letter-spacing: -0.02em; }
      .tc-sub { font-size: 13px; opacity: 0.75; margin: 0 0 18px 0; line-height: 1.45; }
      .tc-input { width: 100%; padding: 10px 14px; border-radius: 10px; border: 1px solid #d4d4d8; font-size: 13px; outline: none; margin-bottom: 10px; background: #fff; color: #18181b; }
      .tc-input:focus { border-color: \${accent}; }
      .tc-btn { width: 100%; padding: 11px; border-radius: 10px; border: none; background: \${accent}; color: \${btnTextColor}; font-size: 13px; font-weight: 700; cursor: pointer; transition: opacity 0.15s; margin-top: 4px; }
      .tc-btn:hover { opacity: 0.9; }
      .tc-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .tc-pills { display: flex; gap: 6px; }
      .tc-pill { flex: 1; padding: 6px; border-radius: 8px; border: 1px solid #d4d4d8; background: #fff; font-size: 11px; font-weight: 600; cursor: pointer; color: #18181b; }
      .tc-pill.active { border-color: \${accent}; background: \${accent}; color: \${btnTextColor}; font-weight: 700; }
      .tc-bool-toggle { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: #f4f4f5; border-radius: 10px; margin-bottom: 10px; cursor: pointer; font-size: 12px; font-weight: 600; color: #18181b; user-select: none; }
      .tc-bool-expand { max-height: 0; overflow: hidden; transition: max-height 0.25s ease-out; }
      .tc-bool-expand.open { max-height: 80px; }
      .tc-success { display: none; padding: 14px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; text-align: center; color: #065f46; font-size: 13px; font-weight: 700; margin-top: 10px; }
    \`;

    var fieldsMarkup = schema.map(function(f) { return renderFieldHtml(f, accent, btnTextColor); }).join('');

    shadow.innerHTML = \`
      <style>\${css}</style>
      <div class="tc-card">
        <button class="tc-close" id="close-btn">✕</button>
        <div class="tc-head">\${headline}</div>
        <div class="tc-sub">\${subheadline}</div>
        <form id="tc-form">
          \${fieldsMarkup}
          <button type="submit" class="tc-btn" id="btn-submit">\${btnText}</button>
        </form>
        <div class="tc-success" id="box-success">✓ Thank you for subscribing!</div>
      </div>
    \`;

    backdrop.appendChild(host);
    document.body.appendChild(backdrop);
    document.body.style.overflow = 'hidden';

    var chosenCadence = 'weekly';
    shadow.querySelectorAll('.tc-pill').forEach(function(p) {
      p.onclick = function() {
        shadow.querySelectorAll('.tc-pill').forEach(function(x) { x.classList.remove('active'); });
        p.classList.add('active');
        chosenCadence = p.getAttribute('data-cadence') || 'weekly';
      };
    });

    shadow.querySelectorAll('.tc-dynamic-bool').forEach(function(chk) {
      var fName = chk.getAttribute('data-field-name');
      var expandBox = shadow.querySelector('[data-expand-for="' + fName + '"]');
      if (expandBox) {
        chk.onchange = function() {
          if (chk.checked) expandBox.classList.add('open');
          else expandBox.classList.remove('open');
        };
      }
    });

    function closeModal() {
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      document.body.style.overflow = '';
    }

    shadow.querySelector('#close-btn').onclick = closeModal;
    backdrop.onclick = function(e) { if (e.target === backdrop) closeModal(); };
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', escHandler); }
    });

    var form = shadow.querySelector('#tc-form');
    var firstEmail = shadow.querySelector('input[type="email"]');
    if (firstEmail) firstEmail.focus();

    form.onsubmit = async function(e) {
      e.preventDefault();
      var btn = shadow.querySelector('#btn-submit');
      btn.disabled = true;
      btn.innerText = 'Subscribing...';

      var emailVal = '';
      var nameVal = undefined;
      var meta = {};

      shadow.querySelectorAll('.tc-dynamic-input').forEach(function(inp) {
        var fName = inp.getAttribute('data-field-name');
        var val = (inp.value || '').trim();
        if (!val) return;
        if (fName === 'email') emailVal = val;
        else if (fName === 'name') nameVal = val;
        else meta[fName] = val;
      });

      shadow.querySelectorAll('.tc-dynamic-bool').forEach(function(chk) {
        var fName = chk.getAttribute('data-field-name');
        meta[fName] = Boolean(chk.checked);
      });

      try {
        await window.TownCrier.subscribe({
          endpoint: endpoint,
          apiKey: key,
          email: emailVal,
          name: nameVal,
          cadence: chosenCadence,
          gongId: gongId || undefined,
          metadata: Object.keys(meta).length ? meta : undefined,
          tags: ['modal_progressive_profile']
        });
        form.style.display = 'none';
        shadow.querySelector('#box-success').style.display = 'block';
        setTimeout(closeModal, 1800);
      } catch (err) {
        alert(err.message || 'Subscription failed');
        btn.disabled = false;
        btn.innerText = btnText;
      }
    };
  };

  // 2. Document-Level Event Delegation: Catches clicks across dynamic Next.js SPA transitions
  document.addEventListener('click', function(e) {
    var btn = e.target && e.target.closest ? e.target.closest('[data-town-crier-modal]') : null;
    if (!btn) return;
    e.preventDefault();

    var gongIdentifier = btn.getAttribute('data-gong') || btn.getAttribute('data-gong-id') || btn.getAttribute('data-gong-slug') || '';
    var schema = resolveSchema(btn.getAttribute('data-schema'), btn.getAttribute('data-fields') || 'name,email,cadence');

    window.TownCrier.openModal({
      endpoint: btn.getAttribute('data-endpoint') || undefined,
      apiKey: btn.getAttribute('data-key') || '',
      gongId: gongIdentifier,
      schema: schema,
      headline: btn.getAttribute('data-headline') || 'Join our Newsletter',
      subheadline: btn.getAttribute('data-subheadline') || 'Get high-signal insights delivered to your inbox.',
      accent: btn.getAttribute('data-accent') || '#2563EB',
      bg: btn.getAttribute('data-bg') || '#FFFFFF',
      text: btn.getAttribute('data-text') || '#18181B',
      radius: btn.getAttribute('data-radius') || '20px',
      buttonText: btn.getAttribute('data-button') || 'Subscribe'
    });
  });

  // 3. Inline Embed Initializer with Shadow DOM
  function initInlineWidgets() {
    document.querySelectorAll('[data-town-crier-embed], [data-town-crier-widget]').forEach(function(el) {
      if (el.getAttribute('data-tc-ready')) return;
      el.setAttribute('data-tc-ready', 'true');

      var key = el.getAttribute('data-key');
      var gongId = el.getAttribute('data-gong') || el.getAttribute('data-gong-id') || '';
      var endpoint = el.getAttribute('data-endpoint') || (defaultBackend + '/api/public/town-crier/subscribe');
      var accent = el.getAttribute('data-accent') || '#2563EB';
      var bg = el.getAttribute('data-bg') || '#FFFFFF';
      var radius = el.getAttribute('data-radius') || '14px';
      var layout = el.getAttribute('data-layout') || 'card';
      var btnText = escapeHtml(el.getAttribute('data-button') || 'Subscribe');
      var headline = escapeHtml(el.getAttribute('data-headline') || 'Join our newsletter');
      var subheadline = escapeHtml(el.getAttribute('data-subheadline') || 'Get updates in your inbox.');
      var btnTextColor = getContrastColor(accent);
      var schema = resolveSchema(el.getAttribute('data-schema'), el.getAttribute('data-fields') || 'email');

      var shadow = el.attachShadow({ mode: 'open' });
      var isHorizontal = layout === 'horizontal';

      var css = \`
        * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .tc-embed-box { width: 100%; max-width: \${isHorizontal ? '100%' : '440px'}; background: \${bg}; border-radius: \${radius}; padding: \${isHorizontal ? '0' : '24px'}; \${isHorizontal ? '' : 'box-shadow: 0 4px 20px -2px rgba(0,0,0,0.08); border: 1px solid #e4e4e7;'} }
        .tc-form-col { display: flex; flex-direction: column; gap: 8px; }
        .tc-form-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .tc-input { width: 100%; padding: 10px 14px; border-radius: 10px; border: 1px solid #d4d4d8; font-size: 13px; outline: none; background: #fff; color: #18181b; }
        .tc-btn-sub { padding: 10px 18px; border-radius: 10px; border: none; background: \${accent}; color: \${btnTextColor}; font-size: 13px; font-weight: 700; cursor: pointer; }
        .tc-pills { display: flex; gap: 6px; margin-bottom: 4px; }
        .tc-pill { flex: 1; padding: 6px; border-radius: 8px; border: 1px solid #d4d4d8; background: #fff; font-size: 11px; font-weight: 600; cursor: pointer; color: #18181b; }
        .tc-pill.active { border-color: \${accent}; background: \${accent}; color: \${btnTextColor}; font-weight: 700; }
        .tc-bool-toggle { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: #f4f4f5; border-radius: 10px; cursor: pointer; font-size: 12px; font-weight: 600; color: #18181b; }
        .tc-bool-expand { max-height: 0; overflow: hidden; transition: max-height 0.25s ease-out; }
        .tc-bool-expand.open { max-height: 80px; }
      \`;

      var fieldsMarkup = schema.map(function(f) { return renderFieldHtml(f, accent, btnTextColor); }).join('');

      shadow.innerHTML = \`
        <style>\${css}</style>
        <div class="tc-embed-box">
          \${isHorizontal ? '' : '<h4 style="margin:0 0 4px 0;font-size:15px;font-weight:900;">' + headline + '</h4><p style="margin:0 0 14px 0;font-size:12px;opacity:0.75;">' + subheadline + '</p>'}
          <form class="\${isHorizontal ? 'tc-form-row' : 'tc-form-col'}" id="tc-form">
            \${fieldsMarkup}
            <button type="submit" class="tc-btn-sub">\${btnText}</button>
          </form>
          <p id="tc-ok" style="display:none;color:#10b981;font-size:12px;font-weight:700;margin-top:8px;">✓ You are subscribed!</p>
        </div>
      \`;

      var chosenCadence = 'weekly';
      shadow.querySelectorAll('.tc-pill').forEach(function(p) {
        p.onclick = function() {
          shadow.querySelectorAll('.tc-pill').forEach(function(x) { x.classList.remove('active'); });
          p.classList.add('active');
          chosenCadence = p.getAttribute('data-cadence') || 'weekly';
        };
      });

      shadow.querySelectorAll('.tc-dynamic-bool').forEach(function(chk) {
        var fName = chk.getAttribute('data-field-name');
        var expandBox = shadow.querySelector('[data-expand-for="' + fName + '"]');
        if (expandBox) {
          chk.onchange = function() {
            if (chk.checked) expandBox.classList.add('open');
            else expandBox.classList.remove('open');
          };
        }
      });

      var form = shadow.querySelector('#tc-form');
      form.onsubmit = async function(e) {
        e.preventDefault();
        var emailVal = '';
        var nameVal = undefined;
        var meta = {};

        shadow.querySelectorAll('.tc-dynamic-input').forEach(function(inp) {
          var fName = inp.getAttribute('data-field-name');
          var val = (inp.value || '').trim();
          if (!val) return;
          if (fName === 'email') emailVal = val;
          else if (fName === 'name') nameVal = val;
          else meta[fName] = val;
        });

        shadow.querySelectorAll('.tc-dynamic-bool').forEach(function(chk) {
          meta[chk.getAttribute('data-field-name')] = Boolean(chk.checked);
        });

        try {
          await window.TownCrier.subscribe({
            endpoint: endpoint,
            apiKey: key,
            email: emailVal,
            name: nameVal,
            cadence: chosenCadence,
            gongId: gongId || undefined,
            metadata: Object.keys(meta).length ? meta : undefined,
            tags: ['embed_inline']
          });
          form.style.display = 'none';
          shadow.querySelector('#tc-ok').style.display = 'block';
        } catch (err) {
          alert(err.message || 'Subscription failed');
        }
      };
    });
  }

  // 4. MutationObserver for Dynamic SPA Route Transitions: Automatically mounts newly inserted inline embeds
  function setupSpaObserver() {
    initInlineWidgets();
    if (window.MutationObserver) {
      var observer = new MutationObserver(function(mutations) {
        for (var i = 0; i < mutations.length; i++) {
          if (mutations[i].addedNodes.length > 0) {
            initInlineWidgets();
            break;
          }
        }
      });

      function attach() {
        if (document.body) {
          observer.observe(document.body, { childList: true, subtree: true });
        } else {
          document.addEventListener('DOMContentLoaded', function() {
            observer.observe(document.body, { childList: true, subtree: true });
          });
        }
      }
      attach();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupSpaObserver);
  } else {
    setupSpaObserver();
  }
})();
  `.trim();

  res.send(script);
});

// Public Unsubscribe Routes
async function executeUnsubscribe(identifier: string, isToken: boolean, res: Response) {
  try {
    const recipient = await prisma.newsletterRecipient.findFirst({
      where: isToken ? { unsubscribeToken: identifier } : { OR: [{ id: identifier }, { unsubscribeToken: identifier }] },
    });

    if (!recipient) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html><body style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 80px auto; text-align: center; color: #18181b;">
          <h2>Unsubscribe Link Expired</h2>
          <p>We could not find a subscriber associated with this link.</p>
        </body></html>
      `);
    }

    if (recipient.status !== 'UNSUBSCRIBED') {
      await prisma.newsletterRecipient.update({
        where: { id: recipient.id },
        data: { status: 'UNSUBSCRIBED' },
      });

      await prisma.newsletterQueueItem.deleteMany({
        where: { recipientId: recipient.id, status: 'PENDING' },
      });
      logger.info({ recipientId: recipient.id, email: recipient.email }, 'Town Crier subscriber unsubscribed');
    }

    res.send(`
      <!DOCTYPE html>
      <html><body style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 80px auto; text-align: center; color: #18181b;">
        <h2>You Have Been Unsubscribed</h2>
        <p>${recipient.email} will no longer receive broadcast newsletters from this sender.</p>
      </body></html>
    `);
  } catch (error) {
    logger.error({ error }, 'Town Crier unsubscribe failure');
    res.status(500).send('Unsubscribe failed. Please try again later.');
  }
}

router.get('/recipients/unsubscribe/:token', async (req: Request, res: Response) => {
  await executeUnsubscribe(req.params.token, true, res);
});

router.get('/recipients/:id/unsubscribe', async (req: Request, res: Response) => {
  await executeUnsubscribe(req.params.id, false, res);
});

router.post('/recipients/unsubscribe/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const recipient = await prisma.newsletterRecipient.findFirst({
      where: { unsubscribeToken: token },
    });
    if (!recipient) return res.status(404).send('Not Found');

    await prisma.newsletterRecipient.update({
      where: { id: recipient.id },
      data: { status: 'UNSUBSCRIBED' },
    });
    await prisma.newsletterQueueItem.deleteMany({
      where: { recipientId: recipient.id, status: 'PENDING' },
    });
    res.status(200).send('OK');
  } catch {
    res.status(500).send('Error');
  }
});

router.use(requireApiKey);

router.get('/stats', requireApiKeyScope('analytics:read'), async (req: Request, res: Response) => {
  const apiReq = req as ApiKeyRequest;
  const userId = apiReq.apiUser!.id;

  try {
    const [totalSubscribers, activeGongs, totalSent, broadcastsCount] = await Promise.all([
      prisma.newsletterRecipient.count({ where: { userId, status: 'SUBSCRIBED' } }),
      prisma.gong.count({ where: { userId } }),
      prisma.newsletterQueueItem.count({ where: { userId, status: 'SENT' } }),
      prisma.newsletterBroadcast.count({ where: { userId } }),
    ]);

    res.json({
      totalSubscribers,
      activeGongs,
      totalSent,
      broadcastsCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch stats' });
  }
});

router.get('/gongs', requireApiKeyScope('town_crier:read'), async (req: Request, res: Response) => {
  const apiReq = req as ApiKeyRequest;
  const userId = apiReq.apiUser!.id;

  try {
    const gongs = await prisma.gong.findMany({
      where: { userId },
      include: {
        _count: {
          select: { recipients: true, broadcasts: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ gongs });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch gongs' });
  }
});

router.post('/gongs', requireApiKeyScope('town_crier:write'), async (req: Request, res: Response) => {
  const apiReq = req as ApiKeyRequest;
  const userId = apiReq.apiUser!.id;
  const {
    name,
    slug,
    description,
    cadence = 'weekly',
    templateStyle = 'card',
    welcomeEmailEnabled = false,
    welcomeSubject,
    welcomeBody,
    embedTheme = 'minimal',
    accentColor = '#2563EB',
    headline = 'Join our newsletter',
    buttonText = 'Subscribe',
  } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ error: 'Gong channel name is required' });
  }

  const generatedSlug = (slug || name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, '-');

  try {
    const gong = await prisma.gong.create({
      data: {
        userId,
        name: name.trim(),
        slug: generatedSlug,
        description: description?.trim() || null,
        cadence: ['daily', 'weekly', 'biweekly', 'monthly'].includes(cadence) ? cadence : 'weekly',
        templateStyle: ['card', 'editorial', 'minimal', 'plain'].includes(templateStyle) ? templateStyle : 'card',
        welcomeEmailEnabled: Boolean(welcomeEmailEnabled),
        welcomeSubject: welcomeSubject?.trim() || null,
        welcomeBody: welcomeBody?.trim() || null,
        embedTheme,
        accentColor,
        headline,
        buttonText,
      },
    });

    res.status(201).json({ success: true, gong });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to create Gong channel' });
  }
});

router.post('/gongs/:id/broadcast', requireApiKeyScope('town_crier:send'), async (req: Request, res: Response) => {
  const apiReq = req as ApiKeyRequest;
  const userId = apiReq.apiUser!.id;
  const { id } = req.params;
  const { subject, body, templateStyle } = req.body;

  if (!subject?.trim() || !body?.trim()) {
    return res.status(400).json({ error: 'Subject and body are required' });
  }

  try {
    const gong = await prisma.gong.findFirst({
      where: { id, userId },
    });
    if (!gong) return res.status(404).json({ error: 'Gong channel not found' });

    const broadcast = await prisma.newsletterBroadcast.create({
      data: {
        userId,
        gongId: gong.id,
        subject: subject.trim(),
        body: body.trim(),
        templateStyle: templateStyle || gong.templateStyle || 'card',
        status: 'QUEUED',
        queuedAt: new Date(),
      },
    });

    const recipients = await prisma.newsletterRecipient.findMany({
      where: { userId, gongId: gong.id, status: 'SUBSCRIBED' },
      select: { id: true },
    });

    const queueItems = recipients.map((r) => ({
      broadcastId: broadcast.id,
      recipientId: r.id,
      userId,
      status: 'PENDING',
    }));

    if (queueItems.length > 0) {
      await prisma.newsletterQueueItem.createMany({ data: queueItems });
    }

    res.status(201).json({
      success: true,
      broadcastId: broadcast.id,
      queuedSubscribers: queueItems.length,
      message: `Broadcast staged into bounded queue drainer for ${queueItems.length} subscriber(s).`,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to publish headless broadcast' });
  }
});

/**
 * POST /api/public/town-crier/subscribe
 * Resolves Gongs by CUID or Slug, automatically attaches channel tags, and triggers welcome autoresponders.
 */
router.post('/subscribe', requireApiKeyScope('town_crier:write'), async (req: Request, res: Response) => {
  const apiReq = req as ApiKeyRequest;
  const userId = apiReq.apiUser!.id;
  const payload = req.body;

  try {
    const blocklist = await prisma.blocklist.findMany({ where: { userId } });
    const isSuppressed = (email: string) =>
      blocklist.some((b) => {
        const p = b.pattern.replace(/^\*@?/, '').replace(/^@/, '');
        return email === p || email.endsWith('@' + p) || email.endsWith('.' + p);
      });

    // 1. Bulk Subscriber Array
    if (Array.isArray(payload.subscribers)) {
      const validSubscribers = payload.subscribers
        .map((s: any) => ({
          email: String(s.email || '').trim().toLowerCase(),
          name: s.name ? String(s.name).trim() : null,
          cadence: s.cadence || 'weekly',
          tags: Array.isArray(s.tags) ? s.tags.map((t: any) => String(t).trim()) : ['api_bulk'],
          userId,
          gongId: payload.gongId || payload.gong || undefined,
          source: 'api_bulk',
          status: 'SUBSCRIBED',
          unsubscribeToken: crypto.randomBytes(16).toString('hex'),
        }))
        .filter((s: any) => s.email && s.email.includes('@') && !isSuppressed(s.email));

      let insertedCount = 0;
      const CHUNK = 500;
      for (let i = 0; i < validSubscribers.length; i += CHUNK) {
        const batch = validSubscribers.slice(i, i + CHUNK);
        const r = await prisma.newsletterRecipient.createMany({
          data: batch,
          skipDuplicates: true,
        });
        insertedCount += r.count;
      }

      return res.status(201).json({ success: true, processed: payload.subscribers.length, inserted: insertedCount });
    }

    // 2. Single Subscriber Submission
    const cleanEmail = (payload.email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }

    if (isSuppressed(cleanEmail)) {
      return res.status(400).json({ error: 'This email is suppressed by workspace blocklist rules.' });
    }

    // Dynamic Gong Resolution: Checks by ID OR Slug
    let targetGong: any = null;
    const gongIdentifier = (payload.gongId || payload.gong || '').trim();
    if (gongIdentifier) {
      targetGong = await prisma.gong.findFirst({
        where: {
          userId,
          OR: [
            { id: gongIdentifier },
            { slug: gongIdentifier.toLowerCase() },
          ],
        },
      });
    }

    const unsubToken = crypto.randomBytes(16).toString('hex');
    let cleanTags = Array.isArray(payload.tags)
      ? payload.tags.map((t: any) => String(t).trim())
      : targetGong?.tags?.length
      ? [...targetGong.tags]
      : ['website_form'];

    // Auto-append gong tag for instant segment filtering
    if (targetGong && !cleanTags.includes(`gong:${targetGong.slug}`)) {
      cleanTags.push(`gong:${targetGong.slug}`);
    }

    const requestedCadence = payload.cadence || targetGong?.cadence || 'weekly';

    const recipient = await prisma.newsletterRecipient.upsert({
      where: {
        userId_email: {
          userId,
          email: cleanEmail,
        },
      },
      update: {
        name: payload.name ? String(payload.name).trim() : undefined,
        cadence: requestedCadence,
        status: 'SUBSCRIBED',
        gongId: targetGong?.id || undefined,
        tags: cleanTags,
        metadata: payload.metadata || undefined,
      },
      create: {
        userId,
        email: cleanEmail,
        name: payload.name ? String(payload.name).trim() : null,
        cadence: requestedCadence,
        gongId: targetGong?.id || null,
        source: 'website_form',
        status: 'SUBSCRIBED',
        tags: cleanTags,
        metadata: payload.metadata || null,
        unsubscribeToken: unsubToken,
      },
    });

    // 3. Preset Welcome Email Autoresponder
    if (targetGong && targetGong.welcomeEmailEnabled && targetGong.welcomeSubject && targetGong.welcomeBody) {
      (async () => {
        try {
          const userSettings = await prisma.userSettings.findUnique({
            where: { userId },
            include: { dedicatedNewsletterSender: { include: { domain: true } } },
          });

          let eligibleSender = userSettings?.dedicatedNewsletterSender;

          if (!eligibleSender || eligibleSender.status !== 'active') {
            const senders = await prisma.sender.findMany({
              where: { userId, status: 'active', domain: { status: 'active' } },
              include: { domain: true },
            });
            eligibleSender = senders[0] || null;
          }

          if (eligibleSender) {
            eligibleSender = await senderService.ensureSenderDailyReset(eligibleSender.id);
            const appBaseUrl = process.env.APP_URL || 'https://midas-aem.vercel.app';
            const unsubUrl = `${appBaseUrl.replace(/\/$/, '')}/api/public/town-crier/recipients/unsubscribe/${recipient.unsubscribeToken}`;

            const { subject, body } = personalisationService.personalise(
              recipient,
              targetGong.welcomeSubject,
              targetGong.welcomeBody,
              null,
              eligibleSender.displayName || userSettings?.companyName || 'The Team',
              unsubUrl,
              {
                companyName: userSettings?.companyName,
                physicalAddress: userSettings?.physicalAddress,
                customOptOutText: userSettings?.customOptOutText,
              }
            );

            await emailService.sendEmailNow(
              { ...eligibleSender.domain, senderLocalPart: eligibleSender.localPart },
              recipient.email,
              subject,
              body.replace(/\n/g, '<br>'),
              body,
              `tc_welcome_${recipient.id}`,
              eligibleSender.displayName || userSettings?.companyName || null,
              undefined,
              unsubUrl,
              undefined,
              {
                brandName: userSettings?.companyName,
                brandInitials: userSettings?.brandInitials,
                brandColorHex: userSettings?.brandColorHex,
                logoUrl: userSettings?.logoUrl,
                brandingEnabled: userSettings?.brandingEnabled ?? true,
                templateStyle: targetGong.templateStyle || 'card',
              }
            );
            logger.info({ recipientId: recipient.id, gongId: targetGong.id }, '[GONG] Preset welcome email dispatched');
          }
        } catch (err: any) {
          logger.error({ err: err?.message, recipientId: recipient.id }, '[GONG] Failed to dispatch welcome email');
        }
      })();
    }

    if (payload.campaignId && typeof payload.campaignId === 'string') {
      const campaign = await prisma.campaign.findFirst({
        where: { id: payload.campaignId.trim(), userId },
      });
      if (campaign) {
        await prisma.lead.upsert({
          where: { userId_email: { userId, email: cleanEmail } },
          update: { campaignId: campaign.id, outreachStatus: 'PENDING' },
          create: {
            userId,
            email: cleanEmail,
            name: payload.name ? String(payload.name).trim() : cleanEmail.split('@')[0],
            campaignId: campaign.id,
            outreachStatus: 'PENDING',
          },
        });
        reconcileCampaignQueue(campaign.id, userId).catch(() => {});
      }
    }

    res.status(201).json({ success: true, subscriber: recipient, gong: targetGong });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to ingest newsletter subscriber');
    res.status(500).json({ error: 'Failed to process subscription' });
  }
});

router.post('/recipients/import', requireApiKeyScope('town_crier:write'), upload.single('file'), async (req: Request, res: Response) => {
  const apiReq = req as ApiKeyRequest;
  const userId = apiReq.apiUser!.id;

  if (!req.file) {
    return res.status(400).json({ error: 'A CSV file is required' });
  }

  try {
    const csvText = req.file.buffer.toString('utf8');
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
    const rows = parsed.data as any[];

    const blocklist = await prisma.blocklist.findMany({ where: { userId } });
    const validRecipients: any[] = [];

    for (const row of rows) {
      const keys = Object.keys(row);
      const emailKey = keys.find((k) => /email/i.test(k));
      const nameKey = keys.find((k) => /^(full ?name|name)$/i.test(k));

      const email = emailKey ? String(row[emailKey] || '').trim().toLowerCase() : '';
      const name = nameKey ? String(row[nameKey] || '').trim() : null;

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;

      const isBlocked = blocklist.some((b) => {
        const pattern = b.pattern.replace(/^\*@?/, '').replace(/^@/, '');
        return email === pattern || email.endsWith('@' + pattern) || email.endsWith('.' + pattern);
      });
      if (isBlocked) continue;

      validRecipients.push({
        email,
        name: name || null,
        userId,
        source: 'api_import',
        status: 'SUBSCRIBED',
        tags: ['csv_import'],
        unsubscribeToken: crypto.randomBytes(16).toString('hex'),
      });
    }

    let insertedCount = 0;
    const CHUNK = 500;
    for (let i = 0; i < validRecipients.length; i += CHUNK) {
      const batch = validRecipients.slice(i, i + CHUNK);
      const r = await prisma.newsletterRecipient.createMany({
        data: batch,
        skipDuplicates: true,
      });
      insertedCount += r.count;
    }

    res.status(201).json({ success: true, processedRows: rows.length, insertedCount });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Import failed' });
  }
});

router.get('/recipients', requireApiKeyScope('town_crier:read'), async (req: Request, res: Response) => {
  const apiReq = req as ApiKeyRequest;
  const userId = apiReq.apiUser!.id;
  const page = parseInt((req.query.page as string) || '1', 10);
  const pageSize = parseInt((req.query.pageSize as string) || '50', 10);

  try {
    const [recipients, total] = await Promise.all([
      prisma.newsletterRecipient.findMany({
        where: { userId },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.newsletterRecipient.count({ where: { userId } }),
    ]);

    res.json({
      data: recipients,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recipients' });
  }
});

export default router;