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
            }
        }
    }
}
function handleOnTicks(ticks: TickType) {
    // console.log(ticks.length);
    handleIndicesTick(ticks);

    if (global.isFuturesRetrieved === false) {
        instruments.setIndicesFutures().then(r => {
            const tokens = instruments.getFuturesIns_Tokens();
            console.log("futures tokens count: " + tokens.length);
            subscribe(tokens);
        })
    }
    handleFutureTicks(ticks);

}
function handleFutureTicks(ticks: TickType) {
    for (let tick of ticks) {
        for (let i = 0; i < global.futures.length; i++) {
            if (tick.instrument_token === global.futures[i].instrument_token) {
                // console.log("mateched")
                global.futures[i].last_price = tick.last_price;
                // console.log(global.futures[i]);
            }
        }
    }
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