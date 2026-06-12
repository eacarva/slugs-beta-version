import type { AnySchema, EndpointDef, EndpointResponses, GlobModules, OpenApiOptions, OpenApiParameterObject, OpenApiResponsesObject, OpenApiSpec, QueryParameterDocs, SchemaRegistry } from "./types.ts";
interface SchemaTraversalBudget {
    arrayDepth: number;
    depth: number;
    nodeCount: number;
}
/**
 * Converts a Valibot object schema into OpenAPI `in: "query"` parameters.
 *
 * - Each *top-level* property becomes one OpenAPI parameter. Nested objects
 *   are intentionally ignored: query parameters are flat by design.
 *
 * - Required → `required: true`.
 * - Supported scalar types for direct conversion:
 *     string, number, integer, boolean
 *
 * - Enum fields produce OpenAPI `enum` arrays. Non-scalar enums are rejected.
 *
 * - If `docs` is provided, it overrides auto-generated descriptions and
 *   examples per-parameter. This allows a schema to remain purely technical
 *   while documentation stays human-readable.
 *
 * - If the input is not an object schema (e.g., a union, array, pipe),
 *   the function returns an empty array: query parameters must map 1:1
 *   with object properties, not arbitrary shapes.
 *
 * Output is deterministic: no ordering side-effects.
 */
export declare function convertQueryToParameters(schema: unknown, docs?: QueryParameterDocs): OpenApiParameterObject[];
/**
 * Converts endpoint response definitions into an OpenAPI 3.1 `responses` object.
 *
 * ResponseDef rules:
 * - You may define *either*:
 *     { content: { "media/type": schema, ... } }
 *   or
 *     { schema: someValibotSchema }
 *   or both.
 *
 * - If both exist:
 *     - `content` takes priority.
 *     - `schema` acts only as a fallback for `application/json` when
 *       `content["application/json"]` is missing.
 *
 * - Each schema is normalized, validated, and converted. Unsupported
 *   media types throw immediately — this prevents silently wrong specs.
 *
 * - The final shape is strictly OpenAPI: no Valibot-specific metadata leaks,
 *   no `$schema` keyword, no transforms.
 */
export declare function convertResponses(responses: EndpointResponses, schemaRegistry?: SchemaRegistry, operationHint?: string): OpenApiResponsesObject;
/**
 * Generates an OpenAPI 3.1 specification object for all routes matched by an
 * `import.meta.glob` call.
 *
 * Responsibilities:
 * - Load arbitrary module shapes from Vite/SK (`object`, `function`, nested loaders).
 * - Extract `_openapi` metadata from each module. Modules without `_openapi`
 *   are ignored without complaint.
 *
 * - Build the OpenAPI `paths` table:
 *     routes → methods → operations
 *
 * - Infer path parameters (`{id}`) and convert them.
 * - Convert query parameters.
 * - Normalize request bodies (content map or shorthand schema).
 * - Convert all response schemas.
 *
 * - Security is merged from:
 *     - endpoint-level `security`
 *     - global `options.security`
 *
 * - Produces a fully spec-compliant OpenAPI 3.1 document usable by Scalar,
 *   Redoc, Swagger UI, and generators.
 *
 *
 * This function performs *documentation conversion*, not runtime validation:
 * it will not execute async Valibot transforms, only document their structure.
 * The function is framework-agnostic: you can use the resulting spec in
 * SvelteKit, Express, Astro, a CLI tool, etc. All you need is a map of
 * modules that expose `_openapi` endpoint definitions.
 *
 * To expose the spec over HTTP in SvelteKit, call this function from a GET
 * handler and return the result as JSON, for example:
 *
 *   import { json } from '@sveltejs/kit';
 *
 *   export async function GET() {
 *     const spec = await createOpenApiSpec(
 *       import.meta.glob('../api/**\/+server.{ts,js}'),
 *       options
 *     );
 *
 *     return json(spec);
 *   }
 *
 * @param modules  Glob-imported API route modules
 * @param options  Optional OpenAPI metadata (title, version, servers, auth)
 * @returns        A Promise resolving to an `OpenApiSpec` object
 */
export declare function createOpenApiSpec<TEndpoint extends EndpointDef = EndpointDef>(modules: GlobModules, options?: OpenApiOptions): Promise<OpenApiSpec>;
/**
 * inferPathFromFile:
 *
 * Converts a filesystem route path like:
 *   "/src/routes/api/users/[id]/+server.ts"
 * to:
 *   "/api/users/{id}"
 *
 * Steps:
 * 1. Strip baseDir (default `/src/routes`). If the file is outside this root,
 *    log a warning — means the user misconfigured glob or baseDir.
 *
 * 2. Remove the "+server.ts|js" suffix — endpoint files produce HTTP verbs.
 *
 * 3. Replace SvelteKit `[id]` with OpenAPI `{id}`. Only the syntactic change.
 *    Validation of the parameter type happens elsewhere.
 *
 * 4. Guarantee leading slash.
 *
 * Assumptions:
 * - File paths come from `import.meta.glob`, so they’re absolute or rooted.
 * - No attempt is made to understand nested `+page.server` semantics.

* @param file - the file path string returned by import.meta.glob
 * @param options.baseDir - optional custom base directory prefix (defaults to "/src/routes")
 * @returns OpenAPI-compatible path (e.g. "/api/todos/{id}")
 */
export declare function inferPathFromFile(file: string, options?: {
    baseDir?: string;
}): string;
/**
 * Extracts all `{param}` segments from a final OpenAPI path.
 *
 * Rules:
 * - All path params are `required: true` (OpenAPI mandate).
 * - All are typed `string` — OpenAPI path parameters are always text; if
 *   further typing is desired, you document it but cannot enforce coercion.
 *
 * - Duplicate param names (e.g., erroneous `{id}/{id}`) are ignored after
 *   the first occurrence.
 *
 * - Does *not* validate naming conventions. If the user names `{user-id}`,
 *   that is passed through exactly.
 */
export declare function inferPathParamsFromPath(path: string): OpenApiParameterObject[];
/**
 * Deep structural normalization for Valibot → JSON Schema conversion.
 *
 * Enforces global safety constraints:
 * - MAX_SCHEMA_NODES: prevents memory bombs and pathological recursion.
 * - MAX_SCHEMA_DEPTH: prevents infinite cycles or excessively nested shapes.
 * - MAX_OBJECT_PROPERTIES: prevents schema explosion.
 * - MAX_ARRAY_NESTING: OpenAPI tools choke on unbounded nested arrays.
 * - MAX_UNION_OPTIONS: unions must stay enumerable.
 *
 * Behavior:
 * - Async schemas → sync via normalizeAsync.
 * - Unsupported Valibot types throw immediately with explicit messages.
 *
 * - `never()` is treated as "not documentable". At top-level → fail. Inside
 *   objects → property removed. Inside wrappers → wrapper is removed.
 *
 * - The function is *structurally persistent*: if children do not change,
 *   original nodes are cached and reused. Reduces JSON-schema churn and
 *   respects Valibot object identity.
 *
 * - Returns `undefined` when a node is fundamentally non-documentable,
 *   forcing callers to reject the schema rather than silently emitting
 *   garbage.
 */
export declare function normalizeSchema(schema: unknown, budget: SchemaTraversalBudget): AnySchema | undefined;
export {};
