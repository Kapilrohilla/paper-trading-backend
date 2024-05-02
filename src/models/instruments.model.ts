import mongoose from "mongoose";

const insSchema = new mongoose.Schema({
    instrument_token: {
        type: Number, required: true
    },
    exchange_token: {
        type: Number, required: false
    },
    tradingsymbol: {
        type: String, required: false
    },
    name: { type: String, required: false },
    last_price: { type: String, required: false },
    expiry: { type: Date, required: false },
    strike: { type: Number, required: false },
    tick_size: { type: Number, required: false },
    lot_size: { type: Number, required: false },
    instrument_type: { type: String, required: false },
    segment: { type: String, required: false },
    exchange: { type: String, required: false }
})
const Instrument = mongoose.model("instument", insSchema);
export default Instrument;