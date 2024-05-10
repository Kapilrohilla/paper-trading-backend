import mongoose from "mongoose"

const userSchema = new mongoose.Schema({
    name: { type: String, },
    mobile: { type: String, required: false, unique: true },
    date_of_birth: { type: String, required: false },
    avatar: { type: String, required: false, default: "" },
    mobile_verified_at: { type: String, required: false },
    device_id: { type: String, required: false },
    wallet: { type: Number, required: false, default: 0 },
    leverage: { type: Number, required: false, default: 0 },
    symbols: [{ type: String, required: false }]
}, { timestamps: true });

const userModel = mongoose.model('User', userSchema);
export default userModel;