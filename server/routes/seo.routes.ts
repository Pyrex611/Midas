import { Router, Request, Response } from 'express';
import cors from 'cors';
import { env } from '../config/env';
import { seoRendererService } from '../services/seoRenderer.service';

const router = Router();

router.use(cors({ origin: '*', credentials: false }));

function resolveBaseUrl(req: Request): string {
  if (env.APP_URL) return env.APP_URL.replace(/\/$/, '');
  const host = req.get('x-forwarded-host') || req.get('host');
  const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
  return host ? `${proto}://${host}` : 'https://midas-aem.vercel.app';
}

router.get('/robots.txt', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(seoRendererService.buildRobotsTxt(resolveBaseUrl(req)));
});

router.get('/sitemap.xml', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(seoRendererService.buildSitemapXml(resolveBaseUrl(req)));
});

router.get('/llms.txt', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(seoRendererService.buildLlmsTxt(resolveBaseUrl(req)));
});

router.get('/llms-full.txt', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(seoRendererService.buildLlmsFullTxt(resolveBaseUrl(req)));
});

router.get('/docs.md', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(seoRendererService.buildDocsMarkdown(resolveBaseUrl(req)));
});

router.get('/openapi.json', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json(seoRendererService.buildOpenApiSpec(resolveBaseUrl(req)));
});

router.get('/overview', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600');
  res.send(seoRendererService.renderOverviewHtml(resolveBaseUrl(req)));
});

router.get('/pricing', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600');
  res.send(seoRendererService.renderPricingHtml(resolveBaseUrl(req)));
});

router.get('/deliverability-benchmarks', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600');
  res.send(seoRendererService.renderBenchmarksHtml(resolveBaseUrl(req)));
});

router.get('/vs/:competitor', (req: Request, res: Response) => {
  const html = seoRendererService.renderComparisonHtml(resolveBaseUrl(req), req.params.competitor.toLowerCase());
  if (!html) {
    return res.status(404).send('Comparison page not found');
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600');
  res.send(html);
});

router.get(['/docs', '/developers'], (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600');
  res.send(seoRendererService.renderDocsHtml(resolveBaseUrl(req)));
});

export default router;