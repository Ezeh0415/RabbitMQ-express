import mongoose from "mongoose";
import { ZodError } from "zod";
import { MongoServerError } from "mongodb";
import { AppErrorOptions } from "./Interface";



type AppErrorInput = string | Error | AppErrorOptions;

export class AppError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;
    public readonly details?: unknown;

    constructor(input: AppErrorInput = "Something went wrong") {
        // 1. Normalize input → { message, statusCode, details, isOperational }
        const normalized = AppError.normalize(input);

        // 2. Preserve original error as `cause` when applicable (not supported in TS/Node < v16)
        super(normalized.message);

        this.statusCode = normalized.statusCode;
        this.isOperational = normalized.isOperational;
        this.details = normalized.details;

        Object.setPrototypeOf(this, AppError.prototype);
        Error.captureStackTrace(this, this.constructor);
    }

    // 👇 The brain: figures out status/details from the error type
    private static normalize(input: AppErrorInput) {
        // If it's already an AppError, keep everything
        if (input instanceof AppError) {
            return {
                message: input.message,
                statusCode: input.statusCode,
                details: input.details,
                isOperational: input.isOperational,
            };
        }

        // Plain string
        if (typeof input === "string") {
            return { message: input, statusCode: 500, details: undefined, isOperational: true };
        }

        // Plain object override
        if (!(input instanceof Error)) {
            return {
                message: input.message ?? "Something went wrong",
                statusCode: input.statusCode ?? 500,
                details: input.details,
                isOperational: input.isOperational ?? true,
            };
        }

        // ---- It's an Error: inspect its type ----

        // Zod validation
        if (input instanceof ZodError) {
            return {
                message: "Validation failed",
                statusCode: 400,
                details: input.issues.map((e) => ({
                    path: e.path.join("."),
                    message: e.message,
                })),
                isOperational: true,
            };
        }

        // Mongoose validation
        if (input instanceof mongoose.Error.ValidationError) {
            return {
                message: "Validation failed",
                statusCode: 400,
                details: Object.values(input.errors).map((e) => ({
                    field: e.path,
                    message: e.message,
                })),
                isOperational: true,
            };
        }

        // Mongoose bad ObjectId
        if (input instanceof mongoose.Error.CastError) {
            return {
                message: `Invalid ${input.path}: ${String((input as mongoose.Error.CastError).value)}`,
                statusCode: 400,
                details: undefined,
                isOperational: true,
            };
        }

        // Mongo duplicate key
        if (input instanceof MongoServerError && input.code === 11000) {
            const field = Object.keys(input.keyValue ?? {})[0] ?? "field";
            return {
                message: `Duplicate value for ${field}`,
                statusCode: 409,
                details: undefined,
                isOperational: true,
            };
        }

        // JWT
        if (input.name === "JsonWebTokenError") {
            return { message: "Invalid token", statusCode: 401, details: undefined, isOperational: true };
        }
        if (input.name === "TokenExpiredError") {
            return { message: "Token expired", statusCode: 401, details: undefined, isOperational: true };
        }

        // Generic Error → unknown, non-operational
        return {
            message: input.message || "Something went wrong",
            statusCode: 500,
            details: undefined,
            isOperational: false,
        };
    }
}