import type { OpenApiLogger } from "./types.ts";
/**
 * Returns the currently active logger.
 *
 * This indirection allows the generator to consume logging consistently
 * without importing `console` directly and without coupling to a specific
 * logging implementation.
 */
export declare function getLogger(): OpenApiLogger;
/**
 * Installs a custom logger.
 *
 * Requirements:
 * - must define `error` and `warn` as functions.
 *
 * Invalid or missing loggers fall back to the built-in logger.
 */
export declare function setOpenApiLogger(logger: null | OpenApiLogger | undefined): void;
/**
 * Produces a shortened, human-readable file path.
 *
 * Useful for error reporting when module paths are deeply nested. The
 * function keeps the final `segments` path parts and prefixes with an
 * ellipsis.
 *
 * Example:
 *   shortenFilePath('/src/routes/api/users/[id]/+server.ts', 3)
 *   → '…/users/[id]/+server.ts'
 */
export declare function shortenFilePath(path: string, segments?: number): string;
