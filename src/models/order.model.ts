import mongoose from "mongoose";

export interface OrderType {
    stock_name: string;
    stock_price: number;
    stock_quantity: number;
    is_nse: boolean;
    user_id: mongoose.Types.ObjectId;
    type: number; // 0, 1
    closePrice?: number;
    is_interaday: boolean;
    stock_type: string;

}
const os = new mongoose.Schema<OrderType>({
    stock_name: { type: String, required: true },
    stock_price: { type: Number, required: true },
    stock_quantity: { type: Number, required: true, min: 0 },
    is_nse: { type: Boolean, required: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    type: { type: Number, required: true, min: 0, max: 1 }, // 0 -> sell, 1 -> buy
    closePrice: { type: Number, required: false, min: 0 },
    // is_active: { type: Boolean, required: true, default: true },  // true -> active, false -> close
    is_interaday: { type: Boolean, required: true, default: false },
    stock_type: { type: String, required: true }
})

const OrderModel = mongoose.model("Orders", os);
export default OrderModel;