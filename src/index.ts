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
const envs = dotenv.config().parsed;

app.use(cors());

mongoose.connect(envs?.MONGODB_URI as string).then((r => {
  console.log('db connected');
})).catch(_err => {
	console.log(_err)
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
  // console.log("commod___________")
  const keys = Object.keys(global.commodities)
  // const commodities_tokens = new Array(keys.length);
  for (let i = 0; i < keys.length; i++) {
    const ins = global.commodities[keys[i]]?.instrument_token;
    i_c_tokens.push(ins);
  }
  zerodha.ticker.connect();
  console.log(i_c_tokens)
  zerodha.ticker.on('connect', () => zerodha.subscribe(i_c_tokens));
  //@ts-ignore
  zerodha.ticker.on("ticks", zerodha.handleOnTicks);
}

try {
   main();
} catch (err) {
  console.log(err);
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
