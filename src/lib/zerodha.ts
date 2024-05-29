import dotenv from "dotenv";
import { KiteTicker } from "kiteconnect";
import instruments from "./instuments.lib";
import OrderModel, { OrderType } from "../models/order.model";
import mongoose from "mongoose";
import userModel from "../models/user.model";
import NotifiModel from "../models/notification.model";

const envs = dotenv.config().parsed;

function handleIndicesTick(ticks: TickType) {
    const indicesSymbols = Object.keys(global.indices);
    //@ts-ignore
    const symbolInsToken = Object.values(global.indices).map((token) => token.ins_token);
    for (let tick of ticks) {
        for (let i = 0; i < symbolInsToken.length; i++) {
            const token = symbolInsToken[i];
            const symbol = indicesSymbols[i];
            if (token === tick.instrument_token) {
                closePositions(symbol, tick.last_price as number);
                global.indices[symbol].last_price = tick.last_price;
                global.indices[symbol].symbol = symbol;
                tick.symbol = symbol;
                profit_calculation(symbol, tick.last_price as number);
            }
        }
    }
    return ticks;
}
const handleCommoTicks = (ticks: TickType) => {
    const commoSymbols = Object.keys(global.commodities);
    const commoTokens = Object.values(global.commodities).map((tick) => tick.instrument_token);

    for (let tick of ticks) {
        for (let i = 0; i < commoSymbols.length; i++) {
            const token = commoTokens[i];
            const symbol = commoSymbols[i];
            if (token === tick.instrument_token) {
                global.commodities[symbol].last_price = tick.last_price;
                global.commodities[symbol].symbol = symbol; // maybe not needed
                tick.symbol = symbol;
                closePositions(symbol, tick.last_price as number);
            }
        }
    }
    return ticks;
}

function handleMidcapDerivatives(ticks: TickType) {
    for (let i = 0; i < ticks.length; i++) {
        const tick = ticks[i];
        const tickCacheIdx = global.midcap.findIndex((obj) => {
            return obj.instrument_token === tick.instrument_token
        })

        if (tickCacheIdx != -1) {
            global.midcap[tickCacheIdx].last_price = tick.last_price;
            ticks[i].symbol = global.midcap[tickCacheIdx].tradingsymbol;
            // console.log(tickCacheIdx)
            // @ts-ignore
            const symbol: string = global.midcap[tickCacheIdx].tradingsymbol
            // console.log("Derivatives: " + symbol);
            profit_calculation(symbol, tick.last_price as number);
            closePositions(symbol, tick.last_price as number);
        }
    }
    return ticks;
}

function handleCurrencyTicks(ticks: TickType) {
    for (let i = 0; i < ticks.length; i++) {
        const tick = ticks[i];
        const tickCacheIdx = global.currencies.findIndex((obj) => obj.instrument_token === tick.instrument_token)

        if (tickCacheIdx !== -1) {
            global.currencies[tickCacheIdx].last_price = tick.last_price;
            ticks[i].symbol = global.currencies[tickCacheIdx].tradingsymbol;
            // @ts-ignore
            const symbol: string = global.currencies[tickCacheIdx].tradingsymbol
            // console.log(tick.last_price, ", last price" + symbol);
            closePositions(symbol, tick.last_price as number);
        }
    }
    return ticks;
}

function handleOnTicks(ticks: TickType) {
    console.log(ticks.length);
    const indicSymbol = handleIndicesTick(ticks);

    if (global.isFuturesRetrieved === false) {
        instruments.setIndicesFutures().then(r => {
            const tokens = instruments.getFuturesIns_Tokens();
            console.log("Total new Token: " + tokens.length);
            subscribe(tokens);
        })
    }
    const commoSymbol = handleCommoTicks(indicSymbol);
    const futSymbols = handleFutureTicks(commoSymbol);
    const derivSymbols = handleStocksDerivatives(futSymbols);
    const midcapSymbols = handleMidcapDerivatives(derivSymbols);
    const currencySymbols = handleCurrencyTicks(midcapSymbols);
    let currentTime = new Date();

    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();
    if (currentHour >= 15 && currentMinute >= 20) {
        for (let i = 0; i < ticks.length; i++) {
            const tick = ticks[i];
            saveRealTimeDataInDb(tick, tick?.symbol)
        }
    }
    global.io.emit("forex", currencySymbols);
}
function handleStocksDerivatives(ticks: TickType) {
    for (let i = 0; i < ticks.length; i++) {
        const tick = ticks[i];
        const tickCacheIdx = global.stocksDerivatives.findIndex((obj) => {
            return obj.instrument_token === tick.instrument_token
        })

        if (tickCacheIdx != -1) {
            global.stocksDerivatives[tickCacheIdx].last_price = tick.last_price;
            ticks[i].symbol = global.stocksDerivatives[tickCacheIdx].tradingsymbol;
            // @ts-ignore
            const symbol: string = global.stocksDerivatives[tickCacheIdx].tradingsymbol
            // console.log("Derivatives: " + symbol);
            closePositions(symbol, tick.last_price as number);
        }
    }
    return ticks;
}
function handleFutureTicks(ticks: TickType) {
    for (let i = 0; i < ticks.length; i++) {
        const tick = ticks[i];
        for (let j = 0; j < global.futures.length; j++) {
            // console.log(global.futures[0]);
            if (tick.instrument_token === global.futures[j].instrument_token) {
                global.futures[j].last_price = tick.last_price;
                tick.symbol = global.futures[j].tradingsymbol;
                closePositions(global.futures[j].tradingsymbol as string, tick.last_price as number);
                ticks[i].symbol = global.futures[j].tradingsymbol;
            }
        }
    }
    return ticks;
}
let ticker: any;
try {
    ticker = new KiteTicker({
        api_key: envs?.API_KEY!,
        access_token: envs?.ACCESS_TOKEN!
    })
} catch (err) {
    console.error(err);
}
function subscribe(ins_token: unknown[]) {
    // const items = Object.values(global.indices);
    //@ts-ignore
    // const ins_token = items.map((item) => item?.ins_token)

    ticker?.subscribe(ins_token);

    console.log("subscribed...")
}



const closePositions = (symbol: string, last_price: number) => {
    const currentTime = new Date();
    // currentTime.setHours(15, 20, 0);
    // if (symbol === "NIFTY2451622150CE") {
    //     console.log(symbol, last_price)
    // }
    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();
    if (currentHour >= 15 && currentMinute >= 20) {
        const positionsIds = Object.keys(global.positions);
        const positions2Close = [];
        for (let i = 0; i < positionsIds.length; i++) {
            const id: string = positionsIds[i];
            // @ts-ignore
            if (global.positions[id].is_interaday === true) {
                // @ts-ignore
                console.log(global[positions[id]])
                // @ts-ignore
                positions2Close.push(global.positions[id]._id.toString());

            }
        }
        // }
        if (positions2Close.length > 0) {
            for (let j = 0; j < positions2Close.length; j++) {
                const id = positions2Close[j];
                OrderModel.findByIdAndUpdate(id, { is_active: false, closePrice: last_price }).then(r => {
                    for (let i = 0; i < positionsIds.length; i++) {
                        const positionsId: string = positionsIds[i];
                        //@ts-ignore
                        delete global.positions[positionsId];
                    }
                }).catch(err => console.log(err));
                //@ts-ignore
                delete global.positions[id];
            }
        }
    }
}
const db = mongoose.connection;
async function saveRealTimeDataInDb(data: any, symbol: string | unknown) {
    const savedData = await db.collection(`${symbol}_d`).insertOne({ ...data, createdAt: new Date() });
    console.log(savedData);
}
interface OrderTypeWithLtp extends OrderType {
    ltp?: number;
}
async function profit_calculation(symbol: string, ltp: number) {
    const users = Object.keys(global.users);
    for (let i = 0; i < users.length; i++) {
        const userDetails = global.users[users[i]];
        const userPoss: OrderTypeWithLtp[] = userDetails.positions;
        // if (users[i] === "664c25fd69874a17e42b8c09") {
        let netRunningProfit = 0;
        let netOrderPrice = 0;
        if (userPoss) {
            for (let i = 0; i < userPoss.length; i++) {
                const position = userPoss[i];
                const stockName = position.stock_name;
                const stockType = position.stock_type;
                netOrderPrice += position.stock_price

                let profit;
                if (stockName === symbol) {
                    const orderPrice = position.stock_price;
                    // console.log("ltp: " + ltp, ", stock: " + stockName);
                    //@ts-ignore
                    userPoss[i].ltp = ltp
                    profit = ltp - orderPrice;
                } else {
                    let lastPrice;
                    if (stockType === "indices") {
                        lastPrice = Number(global.indices[stockName]["last_price"]);
                        if (Number.isNaN(lastPrice)) {
                            continue;
                        }
                    } else if (stockType === "midcap") {
                        // const tickCacheIdx = global.midcap.findIndex((obj) => obj.tradingSymbol === stockName)
                        const tickCacheIdx = global.midcap.findIndex((obj) => obj.tradingsymbol === stockName)
                        if (tickCacheIdx === -1) { continue; }
                        lastPrice = global.midcap[tickCacheIdx]?.last_price as number | undefined
                        //@ts-ignore
                        userPoss[i].ltp = lastPrice;
                        // console.log("lastPrice : " + lastPrice, " midcap");
                    } else if (stockType === "futures") {
                        const tickCacheIdx = global.futures.findIndex((obj) => obj.tradingsymbol === stockName);
                        if (tickCacheIdx === -1) { continue; }
                        lastPrice = global.futures[tickCacheIdx].last_price as unknown as number;
                        //@ts-ignore
                        userPoss[i].ltp = lastPrice;
                    } else if (stockType === "currencies") {
                        const tickCacheIdx = global.currencies.findIndex((obj) => obj.tradingsymbol === stockName);
                        if (tickCacheIdx === -1) { continue; }
                        lastPrice = global.currencies[tickCacheIdx].last_price;
                        userPoss[i].ltp = lastPrice;
                    } else if (stockType === "commodities") {
                        lastPrice = Number(global.commodities[stockName]["last_price"]);
                    }

                    if (!lastPrice) { continue; }
                    profit = lastPrice - position.stock_price;
                    // }
                    netRunningProfit += profit;
                }
                // console.log(netRunningProfit)
            }
            if (netOrderPrice > 0 && netRunningProfit < 0) {
                //TODO FIX IT
                const netLossPercent = (-netRunningProfit) / netOrderPrice * 100;
                // console.log("net Loss percent " + netLossPercent)
                if (netLossPercent >= 80) {
                    OrderModel.updateMany({ user_id: users[i] }, { closePrice: 99 })
                } else if (netLossPercent >= 60
                ) {
                    const newNofitication = new NotifiModel({
                        message: `Net running profit is ${netLossPercent} of balance`,
                        user: users[i],
                        is_read: false
                    })
                    await newNofitication.save();
                }
            }
        }
    }
}

const getUserDetails = async () => {
    const users = await userModel.find();
    for (let i = 0; i < users.length; i++) {

        const userId = users[i]._id;
        const userPositions = await OrderModel.find({ user_id: userId });
        global.users[userId.toString()] = { positions: [], balance: 0, runningProfit: 0 };
        global.users[userId.toString()].positions = userPositions;
        global.users[userId.toString()].balance = users[i].wallet! || 0;

    }
}

const zerodha = { handleOnTicks, ticker, subscribe, getUserDetails };

export default zerodha;
