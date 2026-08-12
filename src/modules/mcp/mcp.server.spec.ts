import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { mountMcpServer } from './mcp.server';
import type { ToolRegistryService } from '../../core/agent-tools/tool-registry.service';
import type { AuthService } from '../auth/auth.service';
import type { KeyRateLimiter } from './mcp-rate-limit';

describe('mountMcpServer HTTP Authentication', () => {
  let mockAdapter: any;
  let mockRegistry: any;
  let mockAuthService: any;
  let mockRateLimiter: any;
  let postHandler: (req: any, res: any) => Promise<void>;

  beforeEach(() => {
    mockAdapter = {
      post: jest.fn((path: string, middleware: any, handler: any) => {
        postHandler = handler;
      }),
    };
    mockRegistry = {
      list: jest.fn().mockReturnValue([]),
    };
    mockAuthService = {
      validateApiKey: jest.fn(),
    };
    mockRateLimiter = {
      check: jest.fn(),
    };
  });

  it('should reject unauthenticated request with 401 Unauthorized before invoking transport', async () => {
    mountMcpServer(mockAdapter, mockRegistry as unknown as ToolRegistryService, mockAuthService as unknown as AuthService, mockRateLimiter as unknown as KeyRateLimiter);

    const req = {
      headers: {},
      body: { jsonrpc: '2.0', method: 'tools/list', id: 1 },
      socket: { remoteAddress: '127.0.0.1' },
    };
    const res = {
      headersSent: false,
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await postHandler(req, res);

    expect(mockAuthService.validateApiKey).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      jsonrpc: '2.0',
      error: { code: -32001, message: 'API key is required to access the MCP server' },
      id: null,
    });
  });

  it('should reject invalid API key with 401 Unauthorized', async () => {
    mountMcpServer(mockAdapter, mockRegistry as unknown as ToolRegistryService, mockAuthService as unknown as AuthService, mockRateLimiter as unknown as KeyRateLimiter);

    mockAuthService.validateApiKey.mockRejectedValue(new UnauthorizedException('Invalid or expired API key'));

    const req = {
      headers: { 'x-api-key': 'invalid-key' },
      body: { jsonrpc: '2.0', method: 'tools/list', id: 1 },
      socket: { remoteAddress: '127.0.0.1' },
    };
    const res = {
      headersSent: false,
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await postHandler(req, res);

    expect(mockAuthService.validateApiKey).toHaveBeenCalledWith('invalid-key', '127.0.0.1');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      jsonrpc: '2.0',
      error: { code: -32001, message: 'Invalid or expired API key' },
      id: null,
    });
  });

  it('should reject IP-disallowed API key with 403 Forbidden', async () => {
    mountMcpServer(mockAdapter, mockRegistry as unknown as ToolRegistryService, mockAuthService as unknown as AuthService, mockRateLimiter as unknown as KeyRateLimiter);

    mockAuthService.validateApiKey.mockRejectedValue(new ForbiddenException('Client IP not whitelisted for this API key'));

    const req = {
      headers: { authorization: 'Bearer secret-key' },
      body: { jsonrpc: '2.0', method: 'tools/list', id: 1 },
      socket: { remoteAddress: '10.0.0.99' },
    };
    const res = {
      headersSent: false,
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await postHandler(req, res);

    expect(mockAuthService.validateApiKey).toHaveBeenCalledWith('secret-key', '10.0.0.99');
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      jsonrpc: '2.0',
      error: { code: -32003, message: 'Client IP not whitelisted for this API key' },
      id: null,
    });
  });
});
