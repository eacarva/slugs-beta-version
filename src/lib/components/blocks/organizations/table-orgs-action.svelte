<script lang="ts">
	import CogIcon from '@lucide/svelte/icons/cog';
	import HomeIcon from '@lucide/svelte/icons/house';
	import { Button } from '$lib/components/ui/button';
	import { ButtonGroup } from '$lib/components/ui/button-group';
	const { origin }: { origin: string } = $props();

	const localOrigin = $derived.by(() => {
		if (!origin) return null;
		const parsed = new URL(origin);
		if (['[::1]', '127.0.0.1', 'localhost'].includes(parsed.hostname)) {
			return `http://${parsed.host}`;
		}
		return parsed.origin;
	});

	const settingsHref = $derived(localOrigin ? new URL('/settings', localOrigin).href : undefined);
</script>

<div class="flex w-full items-center justify-end">
	{#if origin}
		<ButtonGroup class=" divide-x rounded-none border-0 border-s ">
			<Button
				variant="ghost"
				class="h-10 w-10 p-0!"
				onclick={(e) => e.stopPropagation()}
				href={settingsHref}><CogIcon /></Button
			>
			<Button
				variant="ghost"
				class="h-10 w-10 p-0!"
				target="_blank"
				onclick={(e) => e.stopPropagation()}
				href={localOrigin ?? origin}><HomeIcon /></Button
			>
		</ButtonGroup>
	{/if}
</div>
