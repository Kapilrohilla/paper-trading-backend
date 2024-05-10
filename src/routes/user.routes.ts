import { Hono } from "hono";
import userModel from "../models/user.model";
// import { isValidPayload, isValidPhone } from "../lib/helpers";
import { STATUS_CODES } from "http";
import OtpModel from "../models/otp.model";
import { sign } from "hono/jwt";
import pv from "../lib/payload_validation_schema";
import { z } from "zod"
import middleware from "../lib/middleware";
import NotifiModel from "../models/notification.model";
import PaymentOrderModel from "../models/payment_order.model";
import TransactionModel from "../models/transactions.model";
import Razorpay from "razorpay";
import crypto from "node:crypto";
const userRouter = new Hono().basePath('user');
import fs from 'fs/promises'
import path from "path";
import RazorpayModel from "../models/razorpay_order.model";
import OrderModel from "../models/order.model";
import dotenv from "dotenv";

const envs = dotenv.config().parsed;
const key_id = envs?.KEY_ID as string;
const key_secret = envs?.KEY_SECRET as string;

const razorpayInstance = new Razorpay({
    key_id: key_id,
    key_secret: key_secret
});
userRouter.get("/test", async (c) => {
    const filePath = path.join(import.meta.dirname + "../../../index.html");
    const file = await fs.readFile(filePath, "utf-8");
    return c.html(file);
})

userRouter.post('/login', async (c) => {
    const body = await c.req.json();
    pv.LoginSchema.parse(body);
    const { mobile } = body;
    const otp = 1234;
    const existingUser = await userModel.findOne({ mobile: mobile }).lean();
    if (existingUser) {
        await OtpModel.updateOne({ userId: existingUser._id, otp });
        return c.json({
            "status": 200,
            "message": "OTP sent successfully",
        })
    }

    const user = new userModel({ mobile });
    const otp2save = new OtpModel({ userId: user._id, otp });
    try {
        await user.save();
        await otp2save.save();
        return c.json({ "status": 200, "message": "OTP sent successfully" })
    } catch (err) { console.log(err); }


})

userRouter.post("/verify-otp", async (c) => {
    const body = await c.req.json();
    await pv.VerifyOtpSchema.parseAsync(body);
    let { mobile, device_id, otp } = body;
    const savedUser = await userModel.findOne({ mobile }).lean();
    if (!savedUser) {
        return c.json({ status: 400, message: STATUS_CODES['400'], error_description: "user not found with given mobile." })
    }
    otp = Number(otp);
    const savedOtp = await OtpModel.findOne({ userId: savedUser._id, otp }).lean();
    try {
        await NotifiModel.create({
            user: savedUser._id, message: "Welcome to Forex Trade"
        })
    } catch (_err) { }

    if (!savedOtp) {
        return c.json({ status: 400, message: STATUS_CODES['400'], error_description: "Incorrent mobile or otp." })
    }
    // TODO Implement and use deviceId otp expiration time
    const token = await sign(savedUser._id, "NOTHING");
    return c.json({ status: 200, message: "LoggedIn", user: savedUser, token })
})

type UpdateProfilePayloadType = z.infer<typeof pv.UpdateProfileSchema>;
userRouter.post("/update-profile", middleware.AUTH_MIDDLEWARE, async (c) => {
    const body = await c.req.parseBody();
    console.log(body);
    await pv.UpdateProfileSchema.parseAsync(body);
    const { name, date_of_birth } = body as UpdateProfilePayloadType;
    //@ts-ignore
    const user = c.get('user');
    const updatedUser = await userModel.findByIdAndUpdate(user._id, { name, date_of_birth }, { new: true });
    return c.json({ status: 200, message: STATUS_CODES['200'], user: updatedUser });
})

userRouter.get("/", middleware.AUTH_MIDDLEWARE, async (c) => {
    //@ts-ignore
    return c.json({ status: 200, message: STATUS_CODES['200'], user: c.get('user') });
})

userRouter.get("/notifications", middleware.AUTH_MIDDLEWARE, async (c) => {
    //@ts-ignore
    const user = c.get("user");

    const nots = await NotifiModel.find({ user: user._id })

    return c.json({
        status: 200,
        message: STATUS_CODES['200'],
        notifications: nots
    })
})
userRouter.put("/notification", middleware.AUTH_MIDDLEWARE, async (c) => {
    const payload = await c.req.json();
    await pv.ReadNotificationSchema.parseAsync(payload);
    //@ts-ignore
    const user = c.get('user');
    const { notifi_id, is_read } = payload;
    const updateNots = await NotifiModel.findOneAndUpdate({ _id: notifi_id, user: user._id }, { $set: { is_read: is_read } }, { new: true });
    if (!updateNots) { return c.json({ status: 400, message: STATUS_CODES['400'], error_description: "No notification found." }) }
    return c.json({
        status: 200,
        message: STATUS_CODES['200'],
        n: updateNots
    })
})

type DeleteNotificationPayloadType = z.infer<typeof pv.DeleteNotificationSchema>;

userRouter.delete("/notification", middleware.AUTH_MIDDLEWARE, async (c) => {
    const payload = await c.req.json();
    await pv.DeleteNotificationSchema.parseAsync(payload);

    //@ts-ignore
    const user = c.get('user');
    const { notifi_id } = payload as DeleteNotificationPayloadType;

    const toDelete = await NotifiModel.findOneAndDelete({ _id: notifi_id, user: user._id });

    if (!toDelete) {
        return c.json({
            status: 400,
            message: STATUS_CODES['400'],
            error_description: `notification with id=${notifi_id} not found for this user.`
        })
    }
    return c.json({
        status: 200,
        message: STATUS_CODES['200'],
        n: toDelete
    })
})

type AddFundPayloadType = z.infer<typeof pv.AddFundSchema>;
userRouter.post("/add-fund", middleware.AUTH_MIDDLEWARE, async (c) => {
    const payload = await c.req.json();
    await pv.AddFundSchema.parseAsync(payload);
    //@ts-ignore
    const user = c.get("user");

    const { amount } = payload as AddFundPayloadType;
    const orderEntry = new PaymentOrderModel({ amount, user_id: user._id });
    await orderEntry.save();
    return c.json({ status: 200, message: STATUS_CODES['200'], order: orderEntry })
})

type UpdateFundPayloadType = z.infer<typeof pv.UpdateFundSchema>;

userRouter.post("/update-fund", middleware.AUTH_MIDDLEWARE, async (c) => {
    const payload = await c.req.json();
    await pv.UpdateFundSchema.parseAsync(payload);
    //@ts-ignore
    const user = c.get('user')
    const { payment_status } = payload as UpdateFundPayloadType;
    const userLastOrder = await PaymentOrderModel.findOneAndUpdate({ user_id: user._id }, { payment_status: payment_status }).sort({ createdAt: -1 });
    if (userLastOrder?.payment_status !== "0") {
        return c.json({
            status: 400, message: STATUS_CODES['400'],
            error_description: "Last order already staus already processed."
        })
    }
    const updatedUser = await userModel.findByIdAndUpdate(user._id, { $inc: { wallet: userLastOrder.amount } }, { new: true })
    const trans2save = new TransactionModel({ amount: userLastOrder.amount, transaction_type: "Credit", user_id: user._id });
    await trans2save.save();
    return c.json({
        status: 200,
        message: STATUS_CODES['200'],
        user: updatedUser,
        transaction: trans2save
    })
})

userRouter.get("/transactions", middleware.AUTH_MIDDLEWARE, async (c) => {
    // @ts-ignore
    const user = c.get('user')
    const transactions = await TransactionModel.find({ user_id: user._id });

    return c.json({ status: 200, message: STATUS_CODES['200'], t: transactions })
});

userRouter.post('/createorder', middleware.AUTH_MIDDLEWARE, async (c) => {
    //@ts-ignore
    const user = c.get('user');
    const payload = await c.req.json();
    // amount is in paise
    const { amount } = payload;
    const currency = "INR";
    try {
        const order = await razorpayInstance.orders.create({
            "amount": amount,
            "currency": currency,
        });
        const razor = new RazorpayModel({
            ...order,
            order_id: order.id,
            user_id: user._id
        });
        const savedRazor = await razor.save();
        return c.json({ status: 200, message: STATUS_CODES['200'], order: savedRazor });
    } catch (err) {
        console.log(err);
        return c.text("Error");
    }
})

userRouter.post("/verifyorder", async (c) => {
    const { order_id, payment_id } = await c.req.json();
    const razorpay_signature = c.req.header('x-razorpay-signature');
    let sha256 = crypto.createHmac('sha256', key_secret);
    sha256.update(order_id + "|" + payment_id);
    // Creating the hmac in the required format 
    const generated_signature = sha256.digest('hex');
    if (razorpay_signature === generated_signature) {
        //payment verified.
        const orderOnRazor = await RazorpayModel.findOneAndUpdate({ order_id, is_success: false }, { is_success: true });

        if (!orderOnRazor) return c.json({ status: 400, message: STATUS_CODES['400'], error_descriptions: "OrderId is out of scope, or payment already verified" });
        const updatedUser = await userModel.findOneAndUpdate({ _id: orderOnRazor.user_id }, { $inc: { wallet: (orderOnRazor.amount * 0.01) } }, { new: true });
        (new TransactionModel({
            user_id: orderOnRazor.user_id,
            transaction_type: "credit",
            amount: orderOnRazor.amount * 0.01
        })).save()
        return c.json({ status: 200, message: "Payment has been verified", user: updatedUser });
    }
    else
        return c.json({ status: false, message: "Payment verification failed" })
})

type createOrderPayloadType = z.infer<typeof pv.createOrderSchema>;

userRouter.post("/order", async (c) => {
    const payload = await c.req.json();
    //@ts-ignore
    const user = c.get('user');
    await pv.createOrderSchema.parseAsync(payload);
    const { is_nse, stock_name, stock_price, stock_quantity, type } = payload as createOrderPayloadType;
    const order = new OrderModel({ is_nse: is_nse, stock_name: stock_name, stock_price: stock_price, stock_quantity, user_id: user?._id, type });
    const savedOrder = await order.save();
    return c.json({ status: 200, message: STATUS_CODES['200'], order: savedOrder })
});
userRouter.get('/order', middleware.AUTH_MIDDLEWARE, async (c) => {
    //@ts-ignore
    const user = c.get('user');
    const orders = await OrderModel.find({ user_id: user._id });
    return c.json({ status: 200, message: STATUS_CODES['200'], orders })
});

userRouter.post("/watchlist", middleware.AUTH_MIDDLEWARE, async (c) => {
    //@ts-ignore
    const user = c.get('user');
    const user_id = user._id;
    return c.json({ user })
    // const user = await userModel.findByIdAndUpdate(user_id, );
});

userRouter.post("/symbol", middleware.AUTH_MIDDLEWARE, async (c) => {
    const body = await c.req.json();
    await pv.add_delete_symbol_watchlist.parseAsync(body);
    const { symbol } = body;
    //@ts-ignore
    const user = c.get("user");
    if (user.symbols.includes(symbol)) {
        return c.json({ status: 400, message: STATUS_CODES['400'], error_description: "symbol already exists" });
    } else {
        const savedUser = await userModel.findByIdAndUpdate(user._id, { $push: { symbols: [symbol] } }, { new: true });
        return c.json({ status: 200, message: STATUS_CODES['200'], symbol, user: savedUser })
    }
})
userRouter.delete('/symbol', middleware.AUTH_MIDDLEWARE, async (c) => {
    const body = await c.req.json();
    await pv.add_delete_symbol_watchlist.parseAsync(body);
    const { symbol } = body;

    //@ts-ignore
    const user = c.get("user");
    const user_id = user._id;
    if (!user.symbols.includes(symbol)) {
        return c.json({ status: 400, message: STATUS_CODES['400'], error_description: "symbol not exists in user watchlist" });
    }
    const updateUser = await userModel.findByIdAndUpdate(user_id, { $pull: { symbols: symbol } }, { new: true });
    return c.json({ status: 200, message: STATUS_CODES['200'], user: updateUser });
})
export default userRouter;
