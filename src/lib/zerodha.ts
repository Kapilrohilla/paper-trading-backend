import dotenv from "dotenv";
import { KiteTicker } from "kiteconnect";
import instruments from "./instuments.lib";


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
                global.indices[symbol].last_price = tick.last_price;
                global.indices[symbol].symbol = symbol;
                tick.symbol = symbol;
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
            }
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
            subscribe(tokens);
        })
    }
    const commoSymbol = handleCommoTicks(indicSymbol);
    const futSymbols = handleFutureTicks(commoSymbol);
    const derivSymbols = handleStocksDerivatives(futSymbols);
    global.io.emit("forex", derivSymbols);
}
function handleStocksDerivatives(ticks: TickType) {
    for (let i = 0; i < ticks.length; i++) {
        const tick = ticks[i];
        const tickCacheIdx = global.stocksDerivatives.findIndex((obj) => obj.instrument_token === tick.instrument_token)
        if (tickCacheIdx != -1) {
            console.log("::::matched::::");
            ticks[i] = global.stocksDerivatives[tickCacheIdx];
            global.stocksDerivatives[tickCacheIdx].last_price = tick.last_price;
        }
    }
    return ticks;
}
function handleFutureTicks(ticks: TickType) {
    for (let i = 0; i < ticks.length; i++) {
        const tick = ticks[i];
        for (let j = 0; j < global.futures.length; j++) {
            if (tick.instrument_token === global.futures[j].instrument_token) {
                global.futures[j].last_price = tick.last_price;
                tick.symbol = global.futures[j].tradingsymbol;
                ticks[i].symbol = global.futures[j].tradingsymbol;
                // global.io.emit("e", tick);;
            }
        }
    }
    return ticks;
}

const ticker = new KiteTicker({
    api_key: envs?.API_KEY!,
    access_token: envs?.ACCESS_TOKEN!
});

ticker.autoReconnect(true, -1, 5);
function subscribe(ins_token: unknown[]) {
    // const items = Object.values(global.indices);
    //@ts-ignore
    // const ins_token = items.map((item) => item?.ins_token)
    ticker.subscribe(ins_token);

    ticker.setMode(ticker.modeFull, ins_token);
    console.log("subscribed...")
}

const zerodha = { handleOnTicks, ticker, subscribe };

export default zerodha;
