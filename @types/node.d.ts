
import type { Redis } from "ioredis";
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
    var currencies: any[];
    var positions: Record<string | number, Record<string, unknown>>[]
}
