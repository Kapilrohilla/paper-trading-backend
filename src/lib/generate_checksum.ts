import { createHash } from "crypto";
import dotenv from "dotenv";
// console.log(dotenv.config());
const envs= dotenv.config().parsed;
const ak = envs?.API_KEY;
const rt = envs?.REQUEST_TOKEN;
const as = envs?.API_SECRET;

/**
 * code to generate checksum
 */
function generateChecksum(){
    if(!ak || !rt || !as){
        return false;
    }
    const hash = createHash("sha256").update(ak + rt + as).digest('hex');
    return hash;
}
export default generateChecksum; 