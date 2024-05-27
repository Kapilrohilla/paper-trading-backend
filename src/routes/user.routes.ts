import { Hono } from "hono";
import userModel from "../models/user.model";
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
import HistoryModel from "../models/history.model";

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
    // console.log(body);
    console.log(body['avatar']);
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

userRouter.post("/order", middleware.AUTH_MIDDLEWARE, async (c) => {
    const payload = await c.req.json();
    //@ts-ignore
    const user = c.get('user');
    await pv.createOrderSchema.parseAsync(payload);
    const { is_nse, stock_name, stock_price, stock_quantity, type, is_interaday, stock_type } = payload as createOrderPayloadType;

    let mb;
    try {
        mb = calculateMarginNBalance(user.wallet, stock_quantity, is_interaday, stock_price, stock_type);
    } catch (err) {
        console.log(err);
        return c.json({ status: 400, message: "Insuffient balance" });
    }
    // console.log(mb)
    const order = new OrderModel({ is_nse: is_nse, stock_name: stock_name, stock_price: stock_price, stock_quantity, user_id: user._id, type, is_interaday, stock_type });
    const history = new HistoryModel({ is_nse: is_nse, stock_name: stock_name, stock_price: stock_price, stock_quantity, user_id: user._id, type, is_interaday, stock_type, is_active: true });
    const savedOrder = await order.save();
    const savedHistory = await history.save();

    const updatedUser = await userModel.findByIdAndUpdate(user._id, { $set: { wallet: mb.balance, margin: mb.margin } }, { new: true });
    const key: string = savedOrder._id.toString();
    //@ts-ignore
    global.positions[key] = order; 0
    return c.json({ status: 200, message: STATUS_CODES['200'], order: savedOrder, user: updatedUser });
});
userRouter.get('/order', middleware.AUTH_MIDDLEWARE, async (c) => {
    //@ts-ignore
    const user = c.get('user');
    const orders = await OrderModel.find({ user_id: user._id });
    return c.json({ status: 200, message: STATUS_CODES['200'], orders })
});

userRouter.get("history", middleware.AUTH_MIDDLEWARE, async (c) => {

    //@ts-ignore
    const user = c.get('user');
    const user_id = user._id;
    const history = await HistoryModel.find({ user_id: user_id });
    const netPro = history.reduce((pv, cv) => {
        if (cv.is_active === false) {
            const pro = ((cv?.closePrice || 0) - cv.stock_price) * cv.stock_quantity;
            return pv += pro;
        } else {
            return pv;
        }
    }, 0)
    return c.json({ status: 200, message: STATUS_CODES['200'], history, profit: netPro })
})

userRouter.get('/order/:id', middleware.AUTH_MIDDLEWARE, async (c) => {
    //@ts-ignore
    const user = c.get('user');
    const params = c.req.param();
    const { id } = params;
    console.log(id);
    const order = await OrderModel.findOne({ _id: id, user_id: user._id }).lean();
    return c.json({ status: 200, message: STATUS_CODES['200'], order })
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

type ClosePositionSchema = z.infer<typeof pv.close_position_schema>;

userRouter.post("/close-position", middleware.AUTH_MIDDLEWARE, async (c) => {
    const body = await c.req.json();
    await pv.close_position_schema.parseAsync(body);

    // @ts-ignore
    const user = c.get('user');
    const { positionId, quantity = 0 } = body as ClosePositionSchema;
    const prevOrder = await OrderModel.findOne({ _id: positionId, user_id: user._id }).lean();
    if (!prevOrder) return c.json({ status: 400, message: STATUS_CODES['400'], error_description: `Position with #${positionId} not found.` });

    if (prevOrder.stock_quantity < quantity) return c.json({ status: 400, message: STATUS_CODES['200'], error_description: "position stock_quantity is shorter than provided quantity." });

    let closePrice = 0;
    switch (prevOrder.stock_type) {
        case "indices": {
            const prices = global.indices[prevOrder.stock_name]
            // console.log(prices);
            const ltp = prices?.last_price || 0;
            // @ts-ignore
            closePrice = ltp;
            break;
        }
        case "commodities": {
            const prices = global.commodities[prevOrder.stock_name]
            console.log(prices);
            const ltp = prices?.last_price || 0;
            console.log(ltp);
            // @ts-ignore
            closePrice = ltp;
            break;
        }
        case "stocksDerivatives": {
            const all_symbol_prices = global.stocksDerivatives;
            const symbolPrice = all_symbol_prices.find((prices) => prices.tradingsymbol === prevOrder.stock_name);
            if (symbolPrice) {
                const ltp = Number(symbolPrice.last_price);
                closePrice = ltp;
            }
            break;
        }
        //   }
        case "midcap": {
            const all_symbol_prices = global.midcap;
            const symbolPrice = all_symbol_prices.find((prices) => prices.tradingsymbol === prevOrder.stock_name);
            if (symbolPrice) {
                const ltp = Number(symbolPrice.last_price);
                closePrice = ltp;
            }
            break;
        }
        case "futures": {
            const all_symbol_prices = global.futures;
            const symPrice = all_symbol_prices.find((prices) => prices.tradingsymbol === prevOrder.stock_name);
            if (symPrice) {
                const ltp = Number(symPrice.last_price)
                console.log(ltp);
            }
            break;
        }
    }
    let closeOrder;
    if (0 === quantity || prevOrder.stock_quantity === quantity) {
        closeOrder = await OrderModel.findByIdAndDelete(prevOrder._id);
        const historyD = new HistoryModel({ is_active: false, is_interaday: prevOrder.is_interaday, stock_type: prevOrder.stock_type, closePrice: closePrice, type: prevOrder.type ? 0 : 1, stock_name: prevOrder.stock_name, stock_price: prevOrder.stock_price, stock_quantity: prevOrder.stock_quantity, is_nse: prevOrder.is_nse, user_id: prevOrder.user_id })
        await historyD.save()
        //@ts-ignore
        delete global.positions[positionId];
    } else {
        const pO = await OrderModel.findByIdAndUpdate(prevOrder._id, { stock_quantity: prevOrder.stock_quantity - quantity }, { new: true });
        const historyD = new HistoryModel({ is_active: false, stock_quantity: quantity, closePrice: closePrice, is_nse: prevOrder.is_nse, stock_name: prevOrder.stock_name, stock_price: prevOrder.stock_price, type: prevOrder.type === 0 ? 1 : 0, user_id: prevOrder.user_id, is_interaday: prevOrder.is_interaday, stock_type: prevOrder.stock_type });
        await historyD.save()
        //@ts-ignore
        global.positions[positionId].stock_quantity = pO?.stock_quantity;
    }
    let updatedUser;
    try {
        let profit = closePrice - prevOrder.stock_price;

        let margin: number = user.wallet, balance: number = user.balance;
        try {
            // const quant = (quantity === 0) ? prevOrder.stock_quantity : quantity;
            //@ts-ignore
            // const mb = calculateMarginNBalance(user.wallet, quant, prevOrder.is_interaday, prevOrder.stock_price, prevOrder.stock_type, profit);
            const bal = calculateBalanceForCloseOperation(user.wallet, prevOrder.stock_quantity, profit, prevOrder.stock_price, prevOrder.stock_type, prevOrder.stock_price);
            // console.log(mb);
            balance = bal;
            // margin = mb.margin;
            // balance = mb.balance;
        } catch (err: unknown) {
            if (err instanceof Error) {
                console.log(err.message);
            }
        }
        updatedUser = await userModel.findByIdAndUpdate(user._id, { $set: { wallet: balance } }, { new: true })
        return c.json({ status: 200, message: STATUS_CODES['200'], order: closeOrder, updatedUser });
    } catch (err) {
        console.log(err);
        if (err instanceof Error) {
            return c.json({ status: 400, message: STATUS_CODES['400'], error_description: err.message })
        } else {
            return c.json({ status: 500, message: STATUS_CODES['500'], error_description: JSON.stringify(err) })
        }
    }
})
type marginTimeValue = {
    interaday: number,
    holding: number
}
const marginTimes: Record<string, marginTimeValue> = {
    indices: { interaday: 500, holding: 50 },
    midcap: { interaday: 500, holding: 50 },
    options: { interaday: 10, holding: 1 },
    futures: { interaday: 500, holding: 50 },
    commodities: { interaday: 500, holding: 50 },
    stocksDerivatives: { interaday: 500, holding: 50 },
    currencies: { interaday: 0, holding: 0 }
}
/**
 * 
 * @param balance 
 * @param quantity 
 * @param isInteraday 
 * @param amount 
 * @param stockType 
 * @param profit required if close position
 * @returns 
 */
const calculateMarginNBalance = (balance: number, quantity: number, isInteraday: boolean, amount: number, stockType: string, profit: number | null = null): { margin: number, balance: number } => {
    console.log(balance, quantity, isInteraday, amount, stockType, profit)
    const brokeragePercent = 0.0001;
    if (!marginTimes[stockType]) throw new Error("Invalid stockType: " + stockType);
    if (balance <= 0) {
        throw new Error("Insufficient balance")
    }
    const times = isInteraday ? marginTimes[stockType].interaday : marginTimes[stockType].holding
    const totalCharge = quantity * amount;
    const brokerage = (brokeragePercent) * totalCharge;
    // console.log(balance);
    const calcBalance = balance - (totalCharge) / times - brokerage + (profit !== null ? profit : 0);
    // console.log(balance);
    const calcMargin = calcBalance * times;

    const userCalcMargin = balance * times;

    if (profit === null) {
        if (calcMargin < 0 || userCalcMargin < calcMargin) {
            throw new Error("Insufficient balance")
        }
    }
    console.log(calcMargin, calcBalance);
    return { margin: calcMargin, balance: calcBalance };
}
const calculateBalanceForCloseOperation = (balance: number, quantity: number, profit: number, amount: number, orderType: string, isInteraday: string) => {
    if (!marginTimes[orderType]) throw new Error("Invalid stockType: " + orderType);
    const brokeragePercent = 0.0001;
    const times = isInteraday ? marginTimes[orderType].interaday : marginTimes[orderType].holding
    const brokerage = (brokeragePercent) * (amount * quantity);
    // console.log(times);
    balance = balance + ((quantity * amount) / times) + profit - brokerage;

    return balance;
}
export default userRouter;