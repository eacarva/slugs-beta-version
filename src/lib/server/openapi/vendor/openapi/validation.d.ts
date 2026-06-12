import type { AnySchema, MultiEndpointModule } from './types.ts';
/**
 * Hardened `_openapi` module validation and sanitization.
 * Purpose:
 * - Modules imported via `import.meta.glob` may contain arbitrary exports,
 *   arbitrary prototypes, and potentially malicious or malformed `_openapi`
 *   objects. This function enforces strict structural integrity before any
 *   endpoint definition becomes part of the final OpenAPI spec.
 *
 * Guarantees:
 * - `_openapi` must be a safe, prototype-free plain object.
 * - Only valid HTTP-method keys are retained.
 * - Each endpoint definition is recursively sanitized to eliminate:
 *     - prototype pollution vectors
 *     - forbidden keys (`__proto__`, etc.)
 *     - incorrect shapes
 *     - oversized structures (responses, tags, doc strings)
 *
 * - Drops all unrecognized methods silently.
 * - Caps endpoints per module to prevent abusive modules from blowing up
 *   the resulting spec or consuming unbounded CPU/RAM.
 *
 * Output:
 * - A deep-frozen `{ _openapi: { METHOD: sanitizedDef } }` object.
 * - Freezing ensures that later user code cannot mutate definitions after
 *   the fact — OpenAPI generation must operate on immutable, trusted data.
 */
export declare function sanitizeOpenApiModule(mod: Record<string, unknown>): MultiEndpointModule;
export declare const VALIBOT_SUPPORTED_TYPES: Set<string>;
/**
 * Runtime assertion ensuring the value is a Valibot schema.
 *
 * Rejects:
 * - Non-objects
 * - Objects with wrong `kind`
 * - Schemas using unsupported Valibot types (library whitelist)
 *
 * This protects the converter from receiving malformed input and ensures
 * that Valibot → JSON Schema always receives a real schema node.
 */
export declare function assertValibotSchema(schema: unknown, label: string): asserts schema is AnySchema;
export declare function hasWrapped(x: unknown): x is {
    type: string;
    wrapped: unknown;
};
/**
 * Runtime check: is this a Valibot schema object?
 *
 * Requirements:
 * - `kind` must be `"schema"` — Valibot’s internal tag.
 * - `type` must be a supported primitive (whitelisted).
 *
 * This guards normalization and conversion: only real schema nodes proceed.
 *
 * Why this is strict:
 * - Userland objects might pretend to be schemas.
 * - Import-meta-glob may load arbitrary modules.
 * - The converter must not operate on impostor objects.
 */
export declare function isValibotSchema(schema: unknown): schema is AnySchema;
export declare function isValidMediaType(mediaType: string): boolean;
