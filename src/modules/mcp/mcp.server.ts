import { HttpException, Logger, UnauthorizedException } from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js';
import express, { type Request, type RequestHandler, type Response } from 'express';
import { invokeTool } from '../../core/agent-tools/tool-invoker';
import type { ToolRegistryService } from '../../core/agent-tools/tool-registry.service';
import type { AuthService } from '../auth/auth.service';
import { handleToolError, jsonToolResult, smartToolResult } from './tool-result';
import type { KeyRateLimiter } from './mcp-rate-limit';
import { resolveClientIp, type RequestLike } from '../../common/utils/ip';

const logger = new Logger('McpServer');

type HttpAdapter = NonNullable<HttpAdapterHost['httpAdapter']>;
type ToolExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;

/** Extract the raw API key from request headers dictionary. Accepts X-Api-Key or Bearer token. */
function extractApiKeyFromHeaders(headers: Record<string, unknown>): string | undefined {
  const xApiKey = headers['x-api-key'];
  if (xApiKey) {
    return Array.isArray(xApiKey) ? (xApiKey[0] as string) : (xApiKey as string);
  }
  const auth = headers['authorization'];
  const authStr = Array.isArray(auth) ? (auth[0] as string) : (auth as string);
  if (authStr?.toLowerCase().startsWith('bearer ')) {
    return authStr.slice(7).trim();
  }
  return undefined;
}

/** Extract the raw API key from MCP request headers. Accepts X-Api-Key or Bearer token. */
function extractApiKey(extra: ToolExtra): string | undefined {
  return extractApiKeyFromHeaders((extra.requestInfo?.headers ?? {}) as Record<string, unknown>);
}

/**
 * Build the MCP server ONCE and register all tools from the registry.
 * The SDK's `registerTool` accepts `AnySchema` (z4.$ZodType) directly, so we
 * pass `tool.inputSchema` verbatim — no `.shape` extraction needed.
 */
function buildServer(
  registry: ToolRegistryService,
  authService: AuthService,
  rateLimiter: KeyRateLimiter,
  readOnly: boolean,
  serverInfo: { name: string; version: string },
): McpServer {
  const server = new McpServer(
    { name: serverInfo.name, version: serverInfo.version },
    { capabilities: { tools: {}, logging: {} } },
  );

  const tools = registry.list({ readOnly });
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        // inputSchema accepts AnySchema (zod v4 $ZodType is compatible)
        inputSchema: tool.inputSchema as Parameters<typeof server.registerTool>[1]['inputSchema'],
        annotations: {
          readOnlyHint: tool.tier === 'read',
          destructiveHint: tool.destructive ?? false,
          idempotentHint: tool.idempotent ?? tool.tier === 'read',
        },
      },
      async (input: Record<string, unknown>, extra: ToolExtra) => {
        const rawKey = extractApiKey(extra);
        try {
          const result = await invokeTool(tool, input, rawKey, authService, id => rateLimiter.check(id));
          return tool.resultDisposition === 'json'
            ? jsonToolResult(result as object)
            : smartToolResult(result as object);
        } catch (error) {
          return handleToolError(error);
        }
      },
    );
  }

  logger.log(`MCP server built with ${tools.length} tools (readOnly=${readOnly})`);
  return server;
}

export interface MountMcpServerOptions {
  basePath?: string;
  serverInfo?: { name: string; version: string };
  readOnly?: boolean;
}

/**
 * Mount the MCP Streamable-HTTP transport on the existing Nest/Express adapter
 * at `POST {basePath}` (default `/mcp`), single-port.
 *
 * Tool handlers are built ONCE at mount time (closure over registry/authService/rateLimiter).
 * Per-request: mint a fresh McpServer + StreamableHTTPServerTransport, handle, tear down.
 * Stateless (sessionIdGenerator: undefined) — no session map, no GET/DELETE reconnect.
 * Creating a new McpServer per request is safe and avoids the single-transport constraint;
 * tool registration is O(n) pure function calls with no I/O overhead.
 */
export function mountMcpServer(
  httpAdapter: HttpAdapter,
  registry: ToolRegistryService,
  authService: AuthService,
  rateLimiter: KeyRateLimiter,
  options: MountMcpServerOptions = {},
): void {
  const basePath = (options.basePath ?? '/mcp').replace(/\/$/, '') || '/mcp';
  const serverInfo = options.serverInfo ?? { name: 'openwa', version: '0.0.0' };
  const readOnly = options.readOnly ?? process.env.MCP_READONLY === 'true';

  // Eagerly compute the tool list at mount time to validate the registry is populated
  // and to emit the log line once. The actual McpServer is re-created per request to
  // avoid the SDK's single-transport-at-a-time constraint under concurrent load.
  const tools = registry.list({ readOnly });
  logger.log(`MCP server mounted at POST ${basePath} (${tools.length} tools)`);

  const handler: RequestHandler = async (req: Request, res: Response) => {
    try {
      const rawKey = extractApiKeyFromHeaders(req.headers as Record<string, unknown>);
      if (!rawKey) {
        throw new UnauthorizedException('API key is required to access the MCP server');
      }
      const trustedProxies = (process.env.TRUSTED_PROXIES || '')
        .split(',')
        .map(p => p.trim())
        .filter(Boolean);
      const clientIp = resolveClientIp(req as unknown as RequestLike, trustedProxies);
      await authService.validateApiKey(rawKey, clientIp);
    } catch (error) {
      const status = error instanceof HttpException ? error.getStatus() : 401;
      const message = error instanceof HttpException ? error.message : 'Authentication failed';
      if (!res.headersSent) {
        res.status(status).json({
          jsonrpc: '2.0',
          error: { code: status === 403 ? -32003 : -32001, message },
          id: null,
        });
      }
      return;
    }

    const server = buildServer(registry, authService, rateLimiter, readOnly, serverInfo);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    try {
      res.on('close', () => {
        void transport.close();
        void server.close();
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error('Error handling MCP request', error instanceof Error ? error.stack : String(error));
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
      }
    }
  };

  const adapter = httpAdapter as unknown as { post: (path: string, ...handlers: RequestHandler[]) => unknown };
  adapter.post(basePath, express.json(), handler);
}
