import wafrisMiddleware, {
  type WafrisMiddleware,
  type WafrisLogger,
} from "./index";

import { type Request, type NextFunction } from "express";

import * as redis from "redis";

import wafrisCore from "./wafrisCore";

describe("wafris", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("configuration", () => {
    it("loads the lua script", async () => {
      const scriptLoadSpy = jest.spyOn(redis.createClient(), "scriptLoad");
      const middleware = await setupMiddleware();
      const request = mockRequest({ path: "/pass" });
      const next: jest.Mock<NextFunction> = jest.fn();

      await middleware(request, {}, next);

      expect(scriptLoadSpy).toHaveBeenCalledWith(wafrisCore);
      expect(next).toHaveBeenCalled();
    });

    it("creates a redis client", async () => {
      const createClientSpy = jest.spyOn(redis, "createClient");
      const middleware = await setupMiddleware();
      const request = mockRequest({ path: "/pass" });
      const next: jest.Mock<NextFunction> = jest.fn();

      await middleware(request, {}, next);

      expect(createClientSpy).toHaveBeenCalled();
    });

    it("uses default values", async () => {
      const createClientSpy = jest.spyOn(redis, "createClient");
      const middleware = await setupMiddleware();
      const request = mockRequest({ path: "/pass" });
      const next: jest.Mock<NextFunction> = jest.fn();

      await middleware(request, {}, next);

      expect(createClientSpy).toHaveBeenCalledWith({
        url: "redis://localhost:6379",
        socket: { connectTimeout: 250 },
      });
    });

    it("sets the timeout", async () => {
      const createClientSpy = jest.spyOn(redis, "createClient");
      const middleware = await setupMiddleware({ timeout: 500 });
      const request = mockRequest({ path: "/pass" });
      const next: jest.Mock<NextFunction> = jest.fn();

      await middleware(request, {}, next);

      expect(createClientSpy).toHaveBeenCalledWith({
        url: "redis://localhost:6379",
        socket: { connectTimeout: 500 },
      });
    });

    it("sets the redis pool size", async () => {
      const createClientSpy = jest.spyOn(redis, "createClient");
      const middleware = await setupMiddleware({ redisPoolSize: 5 });
      const request = mockRequest({ path: "/pass" });
      const next: jest.Mock<NextFunction> = jest.fn();

      await middleware(request, {}, next);

      expect(createClientSpy).toHaveBeenCalledWith({
        url: "redis://localhost:6379",
        socket: { connectTimeout: 250 },
        isolationPoolOptions: { min: 1, max: 5 },
      });
    });
  });

  describe("middleware", () => {
    it("passes", async () => {
      const middleware = await setupMiddleware();
      const request = mockRequest({ path: "/pass" });
      const next: jest.Mock<NextFunction> = jest.fn();

      await middleware(request, {}, next);

      expect(next).toHaveBeenCalled();
    });

    it("logs when there is an error", async () => {
      const logger = mockLogger();
      const middleware = await setupMiddleware({ logger });
      const request = mockRequest({ path: "/error" });
      const next: jest.Mock<NextFunction> = jest.fn();

      await middleware(request, {}, next);

      expect(logger.error).toHaveBeenCalledWith(expect.stringMatching(/error/));
    });

    it("logs when timed out", async () => {
      const logger = mockLogger();
      const middleware = await setupMiddleware({ logger });
      const request = mockRequest({ path: "/timeout" });
      const next: jest.Mock<NextFunction> = jest.fn();

      await middleware(request, {}, next);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching(/timed out/),
      );
    });

    it("passes when timed out", async () => {
      const middleware = await setupMiddleware();
      const request = mockRequest({ path: "/timeout" });
      const next: jest.Mock<NextFunction> = jest.fn();

      await middleware(request, {}, next);

      expect(next).toHaveBeenCalled();
    });

    it("passes when there is an error", async () => {
      const middleware = await setupMiddleware();
      const request = mockRequest({ path: "/error" });
      const next: jest.Mock<NextFunction> = jest.fn();

      await middleware(request, {}, next);

      expect(next).toHaveBeenCalled();
    });

    it("fails when wafris check returns 'blocked'", async () => {
      const middleware = await setupMiddleware();
      const request = mockRequest({ path: "/block" });
      const response = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      };
      const next: jest.Mock<NextFunction> = jest.fn();

      await middleware(request, response, next);
      expect(response.status).toHaveBeenCalledWith(403);
      expect(response.send).toHaveBeenCalledWith("Blocked");
      expect(next).not.toHaveBeenCalled();
    });

    it("respects trusted proxies", async () => {
      const jennyProxy = "86.7.53.09";
      const middleware = await setupMiddleware({
        trustedProxies: [jennyProxy],
      });
      const request = mockRequest({ path: "/block", ip: jennyProxy });
      const next: jest.Mock<NextFunction> = jest.fn();

      await middleware(request, {}, next);

      expect(next).toHaveBeenCalled();
    });

    it("handles IPv4 addresses", async () => {
      const middleware = await setupMiddleware();
      const request = mockRequest({ path: "/pass", ip: "127.0.0.1" });
      const next: jest.Mock<NextFunction> = jest.fn();
      const redisClient = redis.createClient();
      const evalshaSpy = jest.spyOn(redisClient, "EVALSHA");

      await middleware(request, {}, next);

      expect(evalshaSpy).toHaveBeenCalledWith("DEF8675309", {
        arguments: expect.arrayContaining(["127.0.0.1", "2130706433"]),
      });
      expect(next).toHaveBeenCalled();
    });

    it("handles IPv6 addresses", async () => {
      const middleware = await setupMiddleware();
      const request = mockRequest({
        path: "/pass",
        ip: "2345:0425:2CA1:0000:0000:0567:5673:23b5",
      });
      const next: jest.Mock<NextFunction> = jest.fn();
      const redisClient = redis.createClient();
      const evalshaSpy = jest.spyOn(redisClient, "EVALSHA");

      await middleware(request, {}, next);

      expect(evalshaSpy).toHaveBeenCalledWith("DEF8675309", {
        arguments: expect.arrayContaining([
          "2345:0425:2CA1:0000:0000:0567:5673:23b5",
          "46881332410603363781561182369067770805",
        ]),
      });
      expect(next).toHaveBeenCalled();
    });

    it("respects quiet mode", async () => {
      const logger = mockLogger();
      const middleware = await setupMiddleware({ logger, quietMode: true });
      const request = mockRequest({ path: "/pass" });
      const next: jest.Mock<NextFunction> = jest.fn();

      await middleware(request, {}, next);

      expect(logger.debug).not.toHaveBeenCalled();
    });
  });
});

async function setupMiddleware(overrides = {}): Promise<WafrisMiddleware> {
  return await wafrisMiddleware({
    logger: mockLogger(),
    ...overrides,
  });
}

function mockRequest(overrides?: Partial<Request>): Request {
  const gettables = new Map([["User-Agent", "Jest mock"]]);
  const request: Request = {
    body: {},
    params: {},
    query: {},
    ip: "127.0.0.1",
    ...overrides,
    get: (key: string) => gettables.get(key),
  };

  return request;
}

function mockLogger(): WafrisLogger {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}
