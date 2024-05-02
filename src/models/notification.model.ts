import mongoose from "mongoose";

const notSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    is_read: { type: Boolean, default: false },
    message: { type: String, required: true }
}, { timestamps: true })

const NotifiModel = mongoose.model('Notification', notSchema);

export default NotifiModel;