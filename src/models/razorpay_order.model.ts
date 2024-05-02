import mongoose from "mongoose";

const razorpay_order_schema = new mongoose.Schema({
    order_id: String,
    amount: { type: Number, required: true },
    amount_due: { type: Number, required: true },
    amount_paid: { type: Number, required: true },
    attempts: Number,
    created_at: Number,
    currency: String,
    entity: String,
    is_success: { type: Boolean, required: true, default: false },
    notes: mongoose.Schema.Types.Mixed,
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true })

const RazorpayModel = mongoose.model("Razorpay", razorpay_order_schema);

export default RazorpayModel;