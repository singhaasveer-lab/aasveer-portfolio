import type { ErrorCode } from "../validation/schemas";

export function successBody<T>(data: T): { data: T } {
  return { data };
}

export function errorBody(code: ErrorCode, message: string) {
  return { error: { code, message } };
}

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

export function jsonSuccess<T>(data: T): Response {
  return new Response(JSON.stringify(successBody(data), null, 2), {
    status: 200,
    headers: JSON_HEADERS,
  });
}

export function jsonError(code: ErrorCode, message: string, status = 500): Response {
  return new Response(JSON.stringify(errorBody(code, message), null, 2), {
    status,
    headers: JSON_HEADERS,
  });
}
