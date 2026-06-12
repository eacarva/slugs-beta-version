type Options = {
	/** The time before the copied status is reset. */
	delay: number;
};

/** Use this hook to copy text to the clipboard and show a copied state.
 *
 * ## Usage
 * ```svelte
 * <script lang="ts">
 * 		import { UseClipboard } from "$lib/hooks/use-clipboard.svelte";
 *
 * 		const clipboard = new UseClipboard();
 * </script>
 *
 * <button onclick={clipboard.copy('Hello, World!')}>
 *     {#if clipboard.copied === 'success'}
 *         Copied!
 *     {:else if clipboard.copied === 'failure'}
 *         Failed to copy!
 *     {:else}
 *         Copy
 *     {/if}
 * </button>
 * ```
 *
 */
export class UseClipboard {
	/** true when the user has just copied to the clipboard. */
	get copied() {
		return this.#copiedStatus === 'success';
	}
	/**	Indicates whether a copy has occurred
	 * and gives a status of either `success` or `failure`. */
	get status() {
		return this.#copiedStatus;
	}
	#copiedStatus = $state<'failure' | 'success'>();

	private delay: number;

	private timeout: ReturnType<typeof setTimeout> | undefined = undefined;

	constructor({ delay = 1500 }: Partial<Options> = {}) {
		this.delay = delay;
	}

	/** Copies the given text to the users clipboard.
	 *
	 * ## Usage
	 * ```ts
	 * clipboard.copy('Hello, World!');
	 * ```
	 *
	 * @param text
	 * @returns
	 */
	async copy(text: string) {
		if (this.timeout) {
			this.#copiedStatus = undefined;
			clearTimeout(this.timeout);
		}

		try {
			await writeClipboardText(text);

			this.#copiedStatus = 'success';

			this.timeout = setTimeout(() => {
				this.#copiedStatus = undefined;
			}, this.delay);
		} catch {
			// an error can occur when not in the browser or if the user hasn't given clipboard access
			this.#copiedStatus = 'failure';

			this.timeout = setTimeout(() => {
				this.#copiedStatus = undefined;
			}, this.delay);
		}

		return this.#copiedStatus;
	}
}

async function writeClipboardText(text: string) {
	if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
		try {
			await navigator.clipboard.writeText(text);
			return;
		} catch {
			// Fall back below for browsers or embedded webviews that expose the API but deny writes.
		}
	}

	if (copyWithTextarea(text)) return;
	throw new Error('Clipboard API is unavailable');
}

function copyWithTextarea(text: string) {
	if (typeof document === 'undefined' || !document.body) return false;

	const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
	const textarea = document.createElement('textarea');
	textarea.value = text;
	textarea.setAttribute('readonly', '');
	textarea.style.position = 'fixed';
	textarea.style.left = '-9999px';
	textarea.style.opacity = '0';
	textarea.style.pointerEvents = 'none';

	document.body.append(textarea);
	textarea.focus();
	textarea.select();

	try {
		return document.execCommand('copy');
	} finally {
		textarea.remove();
		activeElement?.focus({ preventScroll: true });
	}
}
