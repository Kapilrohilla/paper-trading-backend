import mongoose from 'mongoose';

const transSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    transaction_type: { type: String, requried: true },
    amount: { type: Number, required: true },
}, { timestamps: true })

const TransactionModel = mongoose.model("Transaction", transSchema);

export default TransactionModel;