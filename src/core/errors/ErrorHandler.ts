import { logAppError, type AppErrorContext, type StoredAppError } from "./errorLogger";
import { logger } from "../logging";

export class ErrorHandler {
  capture(error: unknown, context: AppErrorContext = {}): StoredAppError {
    const stored = logAppError(error, context);
    logger.error(stored.message, { errorId: stored.id, source: stored.source, ...context.metadata });
    return stored;
  }

  async guard<T>(operation: () => Promise<T>, context: AppErrorContext = {}): Promise<T> {
    try { return await operation(); }
    catch (error) {
      this.capture(error, context);
      throw error;
    }
  }
}

export const errorHandler = new ErrorHandler();
