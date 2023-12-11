export const {
  RedisClientOptions,
  createClient: redisCreateClient,
  ConnectionTimeoutError,
} = jest.requireActual("redis");

const redisSingleton = {
  __data: {},
  get data() {
    return this.__data;
  },
  set data(data) {
    this.__data = data;
  },
  get(key) {
    return this.data[key];
  },
  set(key, value) {
    this.data[key] = value;
  },
  async scriptLoad() {
    return await Promise.resolve("DEF8675309");
  },
  async EVALSHA(sha: string, options: { arguments: string[] }) {
    const path = options.arguments.find((a) => a.startsWith("/"));
    switch (path) {
      case "/allow":
        return await Promise.resolve("Allowed");
      case "/pass":
        return await Promise.resolve("Passed");
      case "/block":
        return await Promise.resolve("Blocked");
      case "/error":
        throw new Error("Unspecified error");
      case "/timeout":
        throw new ConnectionTimeoutError("Timeout");
      default:
        return await Promise.resolve("Unknown");
    }
  },
};

export function createClient(options): ReturnType<typeof redisCreateClient> {
  return redisSingleton;
}
