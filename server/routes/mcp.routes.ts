import { Router, Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { ApiKeyRequest } from '../middleware/apiKeyAuth.middleware';
import { mcpService } from '../services/mcp.service';
import { env } from '../config/env';

const router = Router();

function resolveBaseUrl(req: Request): string {
  if (env.APP_URL) return env.APP_URL.replace(/\/$/, '');
  const host = req.get('x-forwarded-host') || req.get('host');
  const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
  return host ? `${proto}://${host}` : 'https://midas-aem.vercel.app';
}

router.get('/', (_req: Request, res: Response) => {
  res.setHeader('Allow', 'POST');
  res.status(405).json({
    error: 'Method Not Allowed: Send MCP Streamable HTTP JSON-RPC 2.0 requests via POST.',
  });
});

router.post('/', async (req: Request, res: Response) => {
  const payload = req.body;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return res.status(400).json({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32600, message: 'Invalid JSON-RPC 2.0 Request' },
    });
  }

  const { id, method, params } = payload;

  // Notifications have no `id` and expect 202 Accepted with no body
  if (id === undefined && typeof method === 'string' && method.startsWith('notifications/')) {
    return res.status(202).send();
  }

  switch (method) {
    case 'initialize': {
      return res.json({
        jsonrpc: '2.0',
        id: id ?? null,
        result: {
          protocolVersion: '2025-03-26',
          capabilities: {
            tools: { listChanged: false },
          },
          serverInfo: {
            name: 'midas-mcp',
            version: '1.0.0',
          },
        },
      });
    }

    case 'ping': {
      return res.json({ jsonrpc: '2.0', id: id ?? null, result: {} });
    }

    case 'tools/list': {
      return res.json({
        jsonrpc: '2.0',
        id: id ?? null,
        result: { tools: mcpService.listTools() },
      });
    }

    case 'tools/call': {
      const authReq = req as AuthRequest & ApiKeyRequest;
      if (!authReq.user) {
        return res.status(401).json({
          jsonrpc: '2.0',
          id: id ?? null,
          error: { code: -32001, message: 'Unauthorized' },
        });
      }

      const toolName = params?.name;
      const toolArgs = params?.arguments || {};
      if (!toolName || typeof toolName !== 'string') {
        return res.json({
          jsonrpc: '2.0',
          id: id ?? null,
          error: { code: -32602, message: 'Missing params.name for tools/call' },
        });
      }

      const toolResult = await mcpService.callTool(toolName, toolArgs, {
        userId: authReq.user.id,
        userEmail: authReq.user.email,
        scopes: authReq.apiUser?.scopes,
        baseUrl: resolveBaseUrl(req),
      });

      return res.json({
        jsonrpc: '2.0',
        id: id ?? null,
        result: toolResult,
      });
    }

    default:
      return res.json({
        jsonrpc: '2.0',
        id: id ?? null,
        error: { code: -32601, message: `Method not found: ${method}` },
      });
  }
});

export default router;