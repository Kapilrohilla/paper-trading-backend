import { z } from 'zod'
import { isValidObjectId } from 'mongoose';

const validateObjectId = (args: unknown) => isValidObjectId(args);

const LoginSchema = z.object({
    mobile: z.string().regex(/^(?:(?:\+|0{0,2})91(\s*[\-]\s*)?|[0]?)?[789]\d{9}$/, {
        message: "Invalid mobile number"
    })
})

const VerifyOtpSchema = z.object({
    mobile: z.string().regex(/^(?:(?:\+|0{0,2})91(\s*[\-]\s*)?|[0]?)?[789]\d{9}$/, {
        message: "Invalid mobile number"
    }),
    device_id: z.string().optional(),
    otp: z.number().min(999).max(9999)
})

const UpdateProfileSchema = z.object({
    // user_id: z.string().refine(validateObjectId, { message: "Invalid string" }),
    name: z.string().optional(),
    date_of_birth: z.string().optional()
})
const ReadNotificationSchema = z.object({
    notifi_id: z.string().refine(validateObjectId, { message: "Invalid id" }),
    is_read: z.boolean()
})
const DeleteNotificationSchema = z.object({
    notifi_id: z.string().refine(validateObjectId, { message: "Invalid id" }),
})
const AddFundSchema = z.object({
    amount: z.number().min(0)
})
const UpdateFundSchema = z.object({
    payment_status: z.enum(['0', '1', '2'], { message: "Invalid payment status. 0 -> Initiated, 1 -> Succeed, 2 -> Failed" }) // 0 -> initiated, 1 -> succeed, 2 -> failed
})
const orderTypeMessage = { message: "type should be either 0, or 1" };
const createOrderSchema = z.object({
    stock_name: z.string(),
    stock_price: z.number(),
    stock_quantity: z.number(),
    is_nse: z.boolean(),
    type: z.number().min(0, orderTypeMessage).max(1, orderTypeMessage),
    is_interaday: z.boolean(),
    stock_type: z.string().refine((val) => (val === "indices" || val === "options" || val === "futures" || val === "commodities" || val === "derivatives" || val === "currencies") ? true : false, {
        message: "stock_type should be one among (indices, options, futures, commodities, derivatives, currencies)"
    })
})
const add_delete_symbol_watchlist = z.object({ symbol: z.string() });

const close_position_schema = z.object({ positionId: z.string(), quantity: z.number().optional() });

const pv = { LoginSchema, VerifyOtpSchema, UpdateProfileSchema, ReadNotificationSchema, DeleteNotificationSchema, AddFundSchema, UpdateFundSchema, createOrderSchema, add_delete_symbol_watchlist, close_position_schema };
export default pv;
