import { Context } from "hono"
import { decode } from "hono/jwt";
import { STATUS_CODES } from "http";
import userModel from "../models/user.model";

const AUTH_MIDDLEWARE = async (c: Context, next: any) => {
    const auth = c.req.header('Authorization')
    // console.log(auth);
    if (!auth) {
        return c.json({
            status: 401,
            message: STATUS_CODES['401'],
            error_description: "Invalid token"
        })
    }
    const splittedAuth = auth.split(' ');
    if (splittedAuth.length < 2) {
        return c.json({
            status: 401,
            message: STATUS_CODES['401'],
            error_description: "bearer token is required"
        })
    }
    if (splittedAuth[0] !== "Bearer") { return c.json({ status: 401, message: STATUS_CODES['401'], error_description: "Invalid token type" }) }

    try {
        const dt = decode(splittedAuth[1]);
        const objectId = dt.payload;
        const user = await userModel.findById(objectId);
        if (!user) return c.json({ status: 401, message: STATUS_CODES['401'], error_description: "Invalid token, user not found" })

        c.set("user", user);
        return next();
    } catch (err: unknown) {
        if (err instanceof Error) {
            return c.json({
                status: 401,
                message: STATUS_CODES['401'],
                error_description: err.message
            })
        } else {
            return c.json({
                status: 500,
                message: STATUS_CODES['500']
            })
        }
    }
}

const middleware = { AUTH_MIDDLEWARE }
export default middleware;