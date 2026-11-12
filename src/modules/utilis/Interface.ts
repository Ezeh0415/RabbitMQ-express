export interface AppErrorOptions {
    message?: string;
    statusCode?: number;
    details?: unknown;
    isOperational?: boolean;
}

export interface ISignup {
    name: string,
    email: string,
    password: String
};

export interface IEmail {
    emailId: string,
    email: string,
    subject: string,
    body: string,
}