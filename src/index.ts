import type { Request, Response, NextFunction } from "express";
import { Address4, Address6, AddressError } from "ip-address";
import {
  createClient,
  type RedisClientOptions,
  ConnectionTimeoutError,
} from "redis";

import wafrisCore from "./wafrisCore.js";

export type WafrisLogger = Pick<Console, "debug" | "info" | "warn" | "error">;

export interface WafrisConfig {
  redisUrl: string;
  timeout: number;
  redisPoolSize?: number;
  quietMode?: boolean;
  logger?: WafrisLogger;
}

function requestToRedisArguments(req: Request, logger: WafrisLogger): string[] {
  const map = new Map();
  // Order here is important, as the array of strings is supplied to Redis for the Lua script.
  map.set("ip", req.ip);
  map.set("decimalIp", requestIpToNumericString(req, logger));
  map.set("time", Date.now());
  map.set("userAgent", req.get("User-Agent"));
  map.set("path", req.path);
  map.set("query", req.query);
  map.set("host", req.hostname);
  map.set("method", req.method);

  return Array.from(map.values()).map(String);
}

function requestIpToNumericString(req: Request, logger: WafrisLogger): string {
  if (req.ip == null) {
    logger.error("[Wafris] Request IP is null");
    return "";
  }
  try {
    const ip4 = new Address4(req.ip);
    return ip4.bigInteger().toString();
  } catch (e) {
    try {
      const ip6 = new Address6(req.ip);
      return ip6.bigInteger().toString();
    } catch (e) {
      if (e instanceof AddressError) {
        logger.error(
          `[Wafris] Error parsing IP address ${req.ip}`,
          e.parseMessage,
        );
      } else if (e instanceof Error) {
        logger.error(
          `[Wafris] Unexpeected ${e.name} parsing IP address ${req.ip}`,
        );
      } else {
        logger.error(
          `[Wafris] Unexpeected error ${typeof e} parsing IP address ${req.ip}`,
        );
      }
      return "";
    }
  }
}

type RedisClient = ReturnType<typeof createClient>;

export type WafrisMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void>;

type WafrisResult = "blocked" | "allowed" | "passed";

async function wafrisMiddleware(
  config: Partial<WafrisConfig>,
): Promise<WafrisMiddleware> {
  const fullConfig: WafrisConfig = {
    redisUrl: "redis://localhost:6379",
    timeout: 250,
    logger: console,
    quietMode: false,
    ...config,
  };
  const redisClient = await createRedisClient(fullConfig);
  const coresha = await redisClient.scriptLoad(wafrisCore);
  const logger = config.logger ?? console;

  redisClient.HSET("waf-settings", "version", "v0.0.1", "client", "node-wafris");

  return async function wafris(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    config.quietMode !== true && logger.debug("[Wafris]");
    try {
      const redisResult = await redisClient.EVALSHA(coresha, {
        arguments: requestToRedisArguments(req, logger),
      });

      const result = String(
        redisResult,
      ).toLowerCase() as unknown as WafrisResult;

      if (result === "blocked") {
        logger.warn("[Wafris] Blocked"); // TODO: Expand log message with details
        res.status(403).send("Blocked");
        return;
      }
      next();
    } catch (e) {
      if (e instanceof ConnectionTimeoutError) {
        logger.error(
          "[Wafris] Wafris timed out during processing. Request passed without rules check.",
        );
      } else if (e instanceof Error) {
        logger.error(
          `[Wafris] An unexpected ${e.name} occurred: ${e.message}. Request passed without rules check.`,
        );
      } else {
        logger.error(
          `[Wafris] An unexpected ${typeof e} occurred: ${
            e as any
          }. Request passed without rules check.`,
        );
      }
      next();
    }
  };
}

async function createRedisClient(config: WafrisConfig): Promise<RedisClient> {
  const clientOptions: RedisClientOptions = {
    url: config.redisUrl,
    socket: { connectTimeout: config.timeout },
  };

  const poolSize = config.redisPoolSize ?? 20;
  clientOptions.isolationPoolOptions = {
    min: 5,
    max: poolSize,
  };

  const client = createClient(clientOptions);
  await client.connect();
  return client;
}
export default wafrisMiddleware;
