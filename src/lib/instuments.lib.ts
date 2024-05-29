import axios from "axios";
import Instrument from "../models/instruments.model";
import csv from "csv-parser";
import { Readable } from "stream";
import mongoose from "mongoose";

const stockDerivatives = ["AARTIIND", "ACC", "ADANIENT", "ADANIPORTS", "ALKEM", "AMARAJABAT", "AMBUJACEM", "APLLTD", "APOLLOHOSP", "APOLLOTYRE", "ASHOKLEY", "ASIANPAINT", "AUBANK", "AUROPHARMA", "AXISBANK", "BAJAJ-AUTO", "BAJAJFINSV", "BAJFINANCE", "BALKRISIND", "BANDHANBNK", "BANKBARODA", "BATAINDIA", "BEL", "BERGEPAINT", "BHARATFORG", "BHARTIARTL", "BHEL", "BIOCON", "BOSCHLTD", "BPCL", "BRITANNIA", "CADILAHC", "CANBK", "CHOLAFIN", "CIPLA", "COALINDIA", "COFORGE", "COLPAL", "CONCOR", "CUB", "CUMMINSIND", "DABUR", "DEEPAKNTR", "DIVISLAB", "DLF", "DRREDDY", "EICHERMOT", "ESCORTS", "EXIDEIND", "FEDERALBNK", "GAIL", "GLENMARK", "GMRINFRA", "GODREJCP", "GODREJPROP", "GRANULES", "GRASIM", "GUJGASLTD", "HAVELLS", "HCLTECH", "HDFC", "HDFCAMC", "HDFCBANK", "HDFCLIFE", "HEROMOTOCO", "HINDALCO", "HINDPETRO", "HINDUNILVR", "IBULHSGFIN", "ICICIBANK", "ICICIGI", "ICICIPRULI", "IDEA", "IDFCFIRSTB", "IGL", "INDIGO", "INDUSINDBK", "INDUSTOWER", "INFY", "IOC", "IRCTC", "ITC", "JINDALSTEL", "JSWSTEEL", "JUBLFOOD", "KOTAKBANK", "L&amp;TFH", "LALPATHLAB", "LICHSGFIN", "LT", "LTI", "LTTS", "LUPIN", "M&amp;M", "M&amp;MFIN", "MANAPPURAM", "MARICO", "MARUTI", "MCDOWELL-N", "MFSL", "MGL", "MINDTREE", "MOTHERSON", "MPHASIS", "MRF", "MUTHOOTFIN", "NAM-INDIA", "NATIONALUM", "NAUKRI", "NAVINFLUOR", "NESTLEIND", "NMDC", "NTPC", "ONGC", "PAGEIND", "PEL", "PETRONET", "PFC", "PFIZER", "PIDILITIND", "PIIND", "PNB", "POWERGRID", "PVR", "RAMCOCEM", "RBLBANK", "RECLTD", "RELIANCE", "SAIL", "SBILIFE", "SBIN", "SHREECEM", "SIEMENS", "SRF", "SRTRANSFIN", "SUNPHARMA", "SUNTV", "TATACHEM", "TATACONSUM", "TATAMOTORS", "TATAPOWER", "TATASTEEL", "TCS", "TECHM", "TITAN", "TORNTPHARM", "TORNTPOWER", "TRENT", "TVSMOTOR", "UBL", "ULTRACEMCO", "UPL", "VEDL", "VOLTAS", "WIPRO", "ZEEL"]
const midcapStocks = ["ACC", "APLAPOLLO", "AUBANK", "ABCAPITAL", "ABFRL", "ALKEM", "APOLLOTYRE", "ASHOKLEY", "ASTRAL", "AUROPHARMA", "BSE", "BALKRISIND", "BANDHANBNK", "BANKINDIA", "MAHABANK", "BDL", "BHARATFORG", "BHEL", "BIOCON", "CGPOWER", "COFORGE", "CONCOR", "CUMMINSIND", "DALBHARAT", "DEEPAKNTR", "DELHIVERY", "DIXON", "LALPATHLAB", "ESCORTS", "NYKAA", "FEDERALBNK", "FACT", "FORTIS", "GMRINFRA", "GLAND", "GODREJPROP", "GUJGASLTD", "HDFCAMC", "HINDPETRO", "IDBI", "IDFCFIRSTB", "INDIANB", "INDHOTEL", "IGL", "INDUSTOWER", "IPCALAB", "JSWENERGY", "JSWINFRA", "JUBLFOOD", "KPITTECH", "KALYANKJIL", "LTF", "LTTS", "LICHSGFIN", "LAURUSLABS", "LUPIN", "MRF", "LODHA", "M&MFIN", "MANKIND", "MFSL", "MAXHEALTH", "MAZDOCK", "MPHASIS", "NHPC", "NMDC", "OBEROIRLTY", "OIL", "PAYTM", "OFSS", "POLICYBZR", "PIIND", "PAGEIND", "PATANJALI", "PERSISTENT", "PETRONET", "PEL", "POLYCAB", "POONAWALLA", "PRESTIGE", "RVNL", "SJVN", "SONACOMS", "SAIL", "SUNTV", "SUPREMEIND", "SUZLON", "SYNGENE", "TATACHEM", "TATACOMM", "TATAELXSI", "TATATECH", "TORNTPOWER", "TIINDIA", "UPL", "UNIONBANK", "IDEA", "VOLTAS", "YESBANK", "ZEEL"]
/**
 * It's retrieve the indices from mongodb set the required data to global variable
 * @returns Promise of indices
 */
async function setIndicesGlobally() {
    const indexNames = ["NIFTY 50", "NIFTY 100", "NIFTY BANK", "NIFTY MIDCAP 100", "SENSEX"];
    let indices: Record<string, Record<string, unknown>> = {};

    for (let i = 0; i < indexNames.length; i++) {
        try {
            const insDoc = await Instrument.findOne({ tradingsymbol: indexNames[i] })
            if (insDoc !== null) {
                // console.log(insDoc.instrument_type);
                indices[insDoc.tradingsymbol as unknown as string] = {};
                indices[insDoc.tradingsymbol as unknown as string]["ins_token"] = insDoc.instrument_token;
                indices[insDoc.tradingsymbol as unknown as string]['strike'] = insDoc.strike;
                indices[insDoc.tradingsymbol as unknown as string]['name'] = insDoc.name;
                indices[insDoc.tradingsymbol as unknown as string]['tradingsymbol'] = insDoc.tradingsymbol;
                indices[insDoc.tradingsymbol as unknown as string]['expiry'] = insDoc.expiry || "";
                indices[insDoc.tradingsymbol as unknown as string]['instrument_type'] = insDoc.instrument_type;
            }
        } catch (err: unknown) {
            if (err instanceof Error) {
                console.error(err);
            }
        }
    }
    global.indices = indices;
    return indices;
}

const instruemnt = mongoose.connection.collection('instument');

async function getInstrumentListCSV() {
    console.log("updating instruments...")
    const csvResponse = await axios.get("https://api.kite.trade/instruments");
    const data = csvResponse.data;
    // console.log(data);
    const results: Record<string, unknown>[] = []
    await instruemnt.deleteMany();
    Readable.from(data).pipe(csv()).on("data", async (chunk) => {
        results.push(chunk);
        // try {
        //     await Instrument.insertMany(chunk);
        // } catch (err) {
        //     console.error(err);
        // }
    }).on('end', () => {
        console.log("ended");
        console.log(results.length);
        console.log(results[0]);
        instruemnt.insertMany(results).then((r: any) => {
            console.log(r);
        })
    })

    /*
    try {
        await Instrument.deleteMany({});
    } catch (err) {
        console.log(err);
    }
    Readable.from(data).pipe(csv()).on("data", async (chunk) => {
        // console.log(chunk, 0);
        results.push(chunk);
        try {
            // await Instrument.insertMany(chunk);
            
        } catch (err) {
            console.log(err);
        }
    }).on("end", async () => {
        try {
            // await Instrument.deleteMany({}).then(r => {
            //     Instrument.insertMany(results).then(r => {
            //         console.log("instruments updated successfuly.");
            //         // console.log(r);
            //     }).catch(err => {
            //         console.log("______error while inserting_____")
            //         console.log(err);
            //         console.log("______error while inserting_____")
            //     });
            // });
        } catch (err) {
            console.error(err);
        }
    });
    */

}

function roundToNearest(number: number, base: number) {
    // Round the number to the nearest multiple of the specified base
    return Math.round(number / base) * base;
}

async function setIndicesFutures() {
    global.isFuturesRetrieved = true;

    const res = Object.values(global.indices);
    const futures: never[] | Record<string, unknown>[] = [];
    try {
        for (let obj of res) {
            const symbol = obj.symbol;
            const roundedTo50 = roundToNearest(obj.last_price as number, 50);
            for (let i = 0; i < 10; i++) {
                const roundFactor = 50;
                const searchStrike = [(roundedTo50 + (i * roundFactor)), (roundedTo50 - (i * roundFactor))]
                //@ts-ignore
                const ins = await Instrument.find({ strike: { $in: searchStrike }, name: { $regex: obj.symbol?.split(' ')[0] } });
                //@ts-ignore
                futures.push(...ins);
            }
        }
        global.futures = futures;
        console.log(`indices futures setting complete... : ${futures.length} `)
    } catch (err) {
        console.log("Failed to retrieve futures indices");
    }

}

async function setCurrencies() {
    const currency = ["USDINR", "JPYINR", "GBPINR"]

    const sym = [];
    for (let curr of currency) {
        const ins = await Instrument.find({ name: curr, instrument_type: "FUT" })
        sym.push(...ins);
    }
    // console.log("currentcy: " + sym.length);
    global.currencies = sym;
}

async function setCommodities() {
    const symbols = ["WTICRUDEOIL", "SILVER", "GOLD"];
    const commodities: Record<string, Record<string, unknown>> = {};
    for (let i = 0; i < symbols.length; i++) {
        const query = { tradingsymbol: symbols[i], exchange: "NCO" }
        const commodity = await Instrument.findOne(query).lean();
        if (commodity !== null) {
            commodities[symbols[i]] = commodity
        }
    }
    global.commodities = commodities;
    console.log("cammo: ", Object.keys(commodities).length);
}

function getFuturesIns_Tokens() {
    const tokens = [];

    for (let i = 0; i < global.futures.length; i++) {
        const token = global.futures[i]?.instrument_token;
        tokens.push(token);
    }
    console.log("new token futures to subs length: " + tokens.length);
    return tokens;
}

async function setStockDerivatives() {
    const stocksDerivativesDoc = await Instrument.find({ tradingsymbol: { $in: stockDerivatives }, exchange: 'NSE' });
    //@ts-ignore
    global.stocksDerivatives = stocksDerivativesDoc;
    console.log("stocks derivatives cached: " + stocksDerivativesDoc.length);

}

async function setMicaps() {
    const stocksDerivativesDoc = await Instrument.find({ tradingsymbol: { $in: midcapStocks }, exchange: 'NSE' });
    //@ts-ignore
    global.midcap = stocksDerivativesDoc;

}
const instruments = { setCurrencies, setIndicesFutures, setIndicesGlobally, getInstrumentListCSV, getFuturesIns_Tokens, setCommodities, setStockDerivatives, setMicaps };
export default instruments;