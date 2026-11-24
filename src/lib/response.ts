// lib/response.js
interface SuccessResponse<T> {
  success: true;
  data: T;
  timestamp: number;
}

interface FailResponse<E> {
  success: false;
  error: E;
  timestamp: number;
}

const ok = <T>(data: T): SuccessResponse<T> => ({ success: true, data, timestamp: Date.now() });
const fail = <E>(error: E): FailResponse<E> => ({ success: false, error, timestamp: Date.now() });

export = { ok, fail };