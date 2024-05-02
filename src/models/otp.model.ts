import mongoose from 'mongoose'

const OtpSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId, required: true,
    },
    otp: { type: Number, required: true, }

}, { timestamps: true });

const OtpModel = mongoose.model('Otp', OtpSchema);

export default OtpModel;