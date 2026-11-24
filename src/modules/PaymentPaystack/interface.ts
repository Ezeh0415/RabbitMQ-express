export interface paymentInfo {
    type: string,
    paymentReference: string | undefined,
    email: string,
    amount: number
}

export interface webHookReturn {
    type: string,
    rawBody: string,
    signature: string | undefined
}