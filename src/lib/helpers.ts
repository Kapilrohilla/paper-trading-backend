import { STATUS_CODES } from "http";

export const isValidEmail = (email: string): boolean => {
    return /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)*[a-zA-Z]{2,}))$/.test(
        email
    );
};

export const isValidPhone = (phone: number): boolean => {
    return phone > 999999999;
};

export const isValidPayload = (body: any, field: string[]): boolean => {
    if (Object.keys(body).length === 0) return false;
    for (let i = 0; i < field.length; i++) {
        if (!Object.keys(body).includes(field[i])) {
            console.log(field[i] + " not found");
            return false;
        }
    }
    return true;
};

export const success_response = (code: number, msg: string, params: Record<string, unknown>) => {
    const keys = Object.keys(params)
    const res: any = { status: code, message: msg, }

    for (let key of keys) {
        res[key] = params[key]
    }
    return res;
}

// console.log(success_response(200, "Hello world", {
//     res: "Hello world"
// }));

export const failure_response = (code: number, message: string) => {
    return {
        status: code,
        error: STATUS_CODES[code],
        error_description: message
    }
}