import { serve } from '@hono/node-server'
import { Hono } from 'hono'
// import { KiteTicker } from "kiteconnect";
import { Server as SocketIOServer } from "socket.io";
import { Server as HttpServer, STATUS_CODES } from 'http';
import mongoose from 'mongoose';
const app = new Hono();
import dotenv from "dotenv";
// import { Redis } from 'ioredis';
// const redis = new Redis();

// global variables
// global.redis = redis;
global.indices = {};
global.futures = [];
global.commodities = {};
global.stocksDerivatives = [];
global.isFuturesRetrieved = false;
import instruments from './lib/instuments.lib';
import generateChecksum from './lib/generate_checksum';
import zerodha from './lib/zerodha';
import userRouter from './routes/user.routes';
import { cors } from "hono/cors";
import { ZodError } from 'zod';
import middleware from './lib/middleware';
import userModel from './models/user.model';
const envs = dotenv.config().parsed;

app.use(cors());

mongoose.connect(envs?.MONGODB_URI as string).then((r => {
  console.log('db connected');
})).catch(_err => {
  console.error("failed to connect db");
})

async function main() {
  await instruments.setIndicesGlobally();
  await instruments.setCommodities();
  // get realtime data of indices
  const indicesSymbol = Object.keys(global.indices);
  const i_c_tokens: unknown[] = []
  for (let i = 0; i < indicesSymbol.length; i++) {
    const symbol = indicesSymbol[i];
    const values = global.indices[symbol];
    i_c_tokens.push(values["ins_token"]);
  }
  const keys = Object.keys(global.commodities)
  for (let i = 0; i < keys.length; i++) {
    const ins = global.commodities[keys[i]]?.instrument_token;
    i_c_tokens.push(ins);
  }
  zerodha.ticker.connect();
  zerodha.ticker.on('connect', () => zerodha.subscribe(i_c_tokens));
  //@ts-ignore
  zerodha.ticker.on("ticks", zerodha.handleOnTicks);
}

try {
  // main();
} catch (err) {
  console.error(err);
}


app.get('/ping', (c) => {
  return c.text("Pong");
})

app.get("/cs", (c) => {
  const checksum = generateChecksum();
  if (!checksum) {
    throw new Error("somthing not found");
  } else {
    console.log(checksum)
  }
  return c.json({ status: 200, c: checksum }, 200)
})

app.get("/symbol", async (c) => {
  const symbols = Object.keys(global.indices)
  console.log(symbols);

  return c.json({
    status: 200,
    message: STATUS_CODES['200'],
    symbols
  })
})

app.post("/symbol", middleware.AUTH_MIDDLEWARE, async (c) => {
  const body = await c.req.json();

  const { symbol } = body;
  //@ts-ignore
  const user = c.get("user");
  if (user.symbols.includes(symbol)) {
    return c.json({ status: 400, message: STATUS_CODES['400'], error_description: "symbol already exists" });
  } else {
    const savedUser = await userModel.findByIdAndUpdate(user._id, { $push: { symbols: [symbol] } }, { new: true });
    return c.json({ symbol, user, savedUser })
  }
})

app.route("/", userRouter);


app.onError((err, c) => {
  if (err instanceof ZodError) {
    return c.json({ status: 422, message: STATUS_CODES['422'], erorrs: err.errors, error_description: "payload validation error" });
  } else {
    console.log(err);
    return c.json({ status: 500, error: "INTERNAL SERVER ERROR", error_description: err.message }, 500)
  }
})

const port = 3000

const server = serve({ fetch: app.fetch, port: port, }, (info) => {
  console.log(`Server is running: http://127.0.0.1:${info.port}`);
}
);

const io = new SocketIOServer(server as HttpServer);
io.on("error", (err) => {
  console.log(err)
})

io.on("connection", (socket) => {
  console.log("client connected: " + socket.id)
})

global.io = io;
