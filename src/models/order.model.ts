import mongoose from "mongoose";

const os = new mongoose.Schema({
    stock_name: { type: String, required: true },
    stock_price: { type: Number, required: true },
    stock_quantity: { type: Number, required: true, min: 0 },
    is_nse: { type: Boolean, required: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    type: { type: Number, required: true, min: 0, max: 1 }, // 0 -> sell, 1 -> buy
    closePrice: { type: Number, required: false, min: 0 },
    is_active: { type: Boolean, required: true, default: true },  // true -> active, false -> close
    is_interaday: { type: Boolean, required: true, default: false },
    stock_type: { type: String, required: true }
})

const OrderModel = mongoose.model("Orders", os);
export default OrderModel;