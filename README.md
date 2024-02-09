# Wafris for Node Express
Wafris is an open-source Web Application Firewall (WAF) that runs within your Node web application (and other frameworks) powered by Redis.

Paired with [Wafris Hub](https://wafris.org/hub), you can create rules to block malicious traffic from hitting your application.

![Rules and Graph](https://github.com/Wafris/wafris-rb/raw/main/docs/rules-and-graph.png)

Rules like:

- Block IP addresses (IPv6 and IPv4) from making requests
- Block on hosts, paths, user agents, parameters, and methods
- Rate limit (throttle) requests
- Visualize inbound traffic and requests

Need a better explanation? Read the overview at: [wafris.org](https://wafris.org)

## Installation and Configuration

The Wafris Node package creates a middleware function that communicates with a Redis instance that you can insert into your Express application's middleware stack.

### Requirements
- [redis](https://www.npmjs.com/package/redis)
- Express

## Setup

### 1. Connect on Wafris Hub

Go to https://wafris.org/hub to create a new account and
follow the instructions to link your Redis instance.

**Note:** In Step 3, you'll use this same Redis URL in your app configuration.

### 2. Add the middleware to your application

Use your preferred package manager to add `node-wafris`. For instance, using
`npm`

```
npm install https://github.com/Wafris/node-wafris.git
```

### 3. Initialize the middleware
Using the `node-wafris` middleware is fairly straightforward. Simply invoke
the library's exported function with a configuration and `use` the returned
middleware function in your Express application:

**Note:** We recommend storing the Redis URL as an environment variable or in a secret management system of your choosing rather than hard coding the string in the initializer.

```javascript
import express from "express";
import wafrisMiddleware from "wafris";

const app = express();
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

const wafrisConfig = { redisUrl };
const wafris = await wafrisMiddleware(wafrisConfig);

app.use("/", wafris);
```

A few configuration properties are available and all have sensible defaults. See the `WafrisConfig` type definition for the full list.

Not sure what Redis provider to use? Please read our [Wafris Redis Providers Guide](https://wafris.org/guides/redis-provisioning)

