import mongoose from "mongoose";

const os = new mongoose.Schema({
    amount: { type: Number, required: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    payment_status: { type: String, default: 0, required: true }
}, { timestamps: true });

const PaymentOrderModel = mongoose.model("PaymentOrder", os);
export default PaymentOrderModel;