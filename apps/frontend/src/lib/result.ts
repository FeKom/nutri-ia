export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export type Error = { status: number; message: string };

export const Ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const Err = <E>(error: E): Result<never, E> => ({ ok: false, error });
