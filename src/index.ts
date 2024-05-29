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

// // global variables
// global.redis = redis;
global.indices = {};
global.futures = [];
global.commodities = {};
global.stocksDerivatives = [];
global.currencies = [];
global.midcap = [];
global.isFuturesRetrieved = false;
global.positions = [];
global.lastData = [];
global.users = {};
import instruments from './lib/instuments.lib';
import generateChecksum from './lib/generate_checksum';
import zerodha from './lib/zerodha';
import userRouter from './routes/user.routes';
import { cors } from "hono/cors";
import { ZodError } from 'zod';
import OrderModel from './models/order.model';
import cronJobs from './lib/crons';
import Instrument from './models/instruments.model';

const envs = dotenv.config().parsed;

app.use(cors());
const db = mongoose.connection;

async function main() {
  await instruments.setIndicesGlobally();
  await instruments.setCommodities();
  await instruments.setStockDerivatives();
  await instruments.setCurrencies();
  await instruments.setMicaps()
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
  for (let i = 0; i < global.stocksDerivatives.length; i++) {
    const ins = global.stocksDerivatives[i]
    i_c_tokens.push(ins.instrument_token);
  }
  for (let i = 0; i < global.midcap.length; i++) {
    const ins = global.midcap[i]
    i_c_tokens.push(ins.instrument_token);
  }
  for (let i = 0; i < global.currencies.length; i++) {
    const ins = global.currencies[i];
    i_c_tokens.push(ins.instrument_token);
  }
  zerodha.ticker.connect();
  // console.log(i_c_tokens)
  zerodha.ticker.on('connect', () => zerodha.subscribe(i_c_tokens));
  //@ts-ignore
  zerodha.ticker.on("ticks", zerodha.handleOnTicks);
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
  const inSymbol = Object.keys(global.indices)
  const indicSymbol = [];
  for (let i = 0; i < inSymbol.length; i++) {
    // console.log(global.indices[inSymbol[i]].instrument_type)
    indicSymbol.push({ tradingsymbol: global.indices[inSymbol[i]].tradingsymbol, name: global.indices[inSymbol[i]].name, expiry: global.indices[inSymbol[i]].expiry, instrument_type: global.indices[inSymbol[i]].instrument_type, strike: global.indices[inSymbol[i]].strike });
  }
  const futSymbol = global.futures.map((ele) => { return { tradingsymbol: ele.tradingsymbol, name: ele.name, expiry: ele.expiry, strike: ele.strike, instrument_type: ele.instrument_type } });
  const comSymbol = Object.keys(global.commodities);
  const commoSymbol = [];
  // console.log(comSymbol);
  for (let i = 0; i < comSymbol.length; i++) {
    const sym = comSymbol[i];
    commoSymbol.push({ tradingsymbol: sym, name: global.commodities[sym].name, expiry: global.commodities[sym].expiry || "", instrument_type: global.commodities[sym].instrument_type, strike: global.commodities[sym].strike })
  }
  const stockDerivSymbol = global.stocksDerivatives.map((ele) => {
    { return { tradingsymbol: ele.tradingsymbol, name: ele.name, expiry: ele.expiry, strike: ele.strike, instrument_type: ele.instrument_type } }
  });
  const midcapSymbol = global.midcap.map((ele) => { return { tradingsymbol: ele.tradingsymbol, name: ele.name, expiry: ele.expiry, strike: ele.strike, instrument_type: ele.instrument_type } });
  const currencySymbol = global.currencies.map((ele) => { return { tradingSymbol: ele.tradingsymbol, name: ele.name, expiry: ele.expiry, strike: ele.strike, instrument_type: ele.instrument_type } });
  const symbols = [];

  symbols.push({ indices: indicSymbol, futures: futSymbol, commodities: commoSymbol, stocksDerivatives: stockDerivSymbol, midcap: midcapSymbol, currencySymbol: currencySymbol });

  return c.json({ status: 200, message: STATUS_CODES['200'], symbols })
});

async function findLastData() {
  const lastRecord = [];
  console.log("lastDataLength: " + global.lastData.length)

  if (global.lastData.length === 0 || new Date().getHours() === 10) {
    try {
      const collectionNames = await db.listCollections();
      const coll = collectionNames.filter((coll) => coll.name.slice(coll.name.length - 2) === "_d").map((coll) => coll.name)
      for (let col of coll) {
        const lr = await db.collection(col).find().limit(1).sort({ $natural: -1 }).toArray()
        lastRecord.push(lr[0])
        global.lastData = lastRecord;
      }
    } catch (err) {
      console.log(err);
    }
    return lastRecord;
  } else {
    return global.lastData;
  }
}

app.get("/ltp", async (c) => {
  // console.log("api called");
  try {
    const lastRecord = await findLastData();
    return c.json({ status: 200, message: STATUS_CODES['200'], lastRecord });
  } catch (err) {
    console.log(err);
  }
})

app.route("/", userRouter);

app.onError((err, c) => {
  if (err instanceof ZodError) {
    return c.json({ status: 422, message: STATUS_CODES['422'], erorrs: err.errors, error_description: "payload validation error" });
  } else if (err instanceof Error) {
    if (err.message === "Unexpected end of JSON input") {
      return c.json({ status: 422, message: STATUS_CODES['422'], error_description: "Invalid json payload." });
    }
  }
  console.log(err);
  return c.json({ status: 500, message: STATUS_CODES['500'], error_description: err.message })
})

const port = 3000

const server = serve({ fetch: app.fetch, port: port, }, (info) => {
  console.log(`Server is running: http://127.0.0.1:${info.port}`);
});

const io = new SocketIOServer(server as HttpServer);
io.on("error", (err) => {
  console.log(err)
})

io.on("connection", (socket) => {
  console.log("client connected: " + socket.id)
})

global.io = io;



mongoose.connect(envs?.MONGODB_URI as string).then((r => {
  console.log('db connected');
  cronJobs();
  zerodha.getUserDetails()
  OrderModel.find({}).then(r => {
    r.forEach((doc) => {
      const key = doc._id.toString();
      //@ts-ignore
      global.positions[key] = doc;

    })
    console.log("positions data cached..")
  }).catch((err) => {
    console.log(err);
  }).finally(() => {
    try {
      main();
    } catch (err) {
      console.error(err);
    }
  })
})).catch(_err => {
  console.log(_err)
  console.error("failed to connect db");
})
