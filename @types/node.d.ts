
import type { Redis } from "ioredis";
import { OrderType } from "../src/models/order.model";
declare global {
    var redis: Redis
    var indices: Record<string, Record<string, unknown>>
    var futures: never[] | Record<string, unknown>[];
    var futuresTokens: number[];
    var isFuturesRetrieved: boolean;
    var commodities: Record<string, Record<string, unknown>>
    var stocksDerivatives: never[] | Record<string, unknown>[]
    var midcap: never[] | Record<string, unknown>[]
    var io: any
    var users: Record<string, UserInfo>
    var currencies: any[];
    var positions: Record<string | number, Record<string, unknown>>[]
    var lastData: Record<string, unknown>[]
}

type UserInfo = {
    balance: number;
    positions: OrderType[],
    runningProfit: number;
}