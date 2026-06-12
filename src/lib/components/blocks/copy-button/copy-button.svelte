<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$lib/components/blocks/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { UseClipboard } from '$lib/hooks/use-clipboard.svelte';
	import { m } from '$lib/paraglide/messages';
	import { cn } from '$lib/utils';
	import { scale } from 'svelte/transition';
	import { toast } from 'svelte-sonner';

	import type { CopyButtonProps } from './types';
	let {
		animationDuration = 500,
		children,
		class: className,
		icon,
		onCopy,
		ref = $bindable(null),
		size = 'icon',
		tabindex = -1,
		text,
		variant = 'ghost',
		...rest
	}: CopyButtonProps = $props();
	// this way if the user passes text then the button will be the default size
	// svelte-ignore state_referenced_locally
	if (size === 'icon' && children) {
		size = 'default';
	}
	const clipboard = new UseClipboard();
	let fallbackOpen = $state(false);
	let fallbackInput = $state<HTMLInputElement | null>(null);

	$effect(() => {
		if (!fallbackOpen || !fallbackInput) return;
		setTimeout(() => {
			fallbackInput?.focus();
			fallbackInput?.select();
		});
	});
</script>

<Dialog.Root bind:open={fallbackOpen}>
	<Button
		{...rest}
		bind:ref
		{variant}
		{size}
		{tabindex}
		class={cn('flex items-center gap-2', className)}
		type="button"
		name="copy"
		onclick={async () => {
			const status = await clipboard.copy(text);
			if (status === 'success') toast.success(m.copied());
			if (status === 'failure') {
				toast.error(m.copy_failed());
				fallbackOpen = true;
			}
			onCopy?.(status);
		}}
	>
		{#if clipboard.status === 'success'}
			<div in:scale={{ duration: animationDuration, start: 0.85 }}>
				<CheckIcon tabindex={-1} />
				<span class="sr-only">Copied</span>
			</div>
		{:else if clipboard.status === 'failure'}
			<div in:scale={{ duration: animationDuration, start: 0.85 }}>
				<XIcon tabindex={-1} />
				<span class="sr-only">Failed to copy</span>
			</div>
		{:else}
			<div in:scale={{ duration: animationDuration, start: 0.85 }}>
				{#if icon}
					{@render icon()}
				{:else}
					<CopyIcon tabindex={-1} />
				{/if}
				<span class="sr-only">Copy</span>
			</div>
		{/if}
		{@render children?.()}
	</Button>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{m.copy_manually_title()}</Dialog.Title>
			<Dialog.Description>{m.copy_manually_helper()}</Dialog.Description>
		</Dialog.Header>
		<Input bind:ref={fallbackInput} readonly value={text} />
	</Dialog.Content>
</Dialog.Root>
