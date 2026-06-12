<script lang="ts">
	import type { FormEventHandler } from 'svelte/elements';

	import AppWindowIcon from '@lucide/svelte/icons/app-window';
	import LockIcon from '@lucide/svelte/icons/lock';
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { ButtonGroup } from '$lib/components/ui/button-group';
	import * as Field from '$lib/components/ui/field';
	import * as InputGroup from '$lib/components/ui/input-group';
	import { m } from '$lib/paraglide/messages';
	import { updateAppName } from '$lib/remotes/config.remote';
	import { toast } from 'svelte-sonner';

	type AppNameConfig = {
		appname: string;
		envLocked: boolean;
		envValue?: string;
	};

	const { config }: { config: AppNameConfig } = $props();
	let appname = $state('');

	$effect(() => {
		appname = config.appname;
	});

	const saveAppName: FormEventHandler<HTMLFormElement> = async (event) => {
		event.preventDefault();
		const value = appname.trim();
		if (!value) {
			toast.error(m.errors_non_empty());
			return;
		}

		try {
			await updateAppName(value);
			toast.success(m.settings_saved());
			await invalidateAll();
		} catch (error) {
			console.error('[settings] app name', error);
			toast.error(m.errors_settings_saving());
		}
	};
</script>

<form onsubmit={saveAppName} class="w-full">
	<Field.Set>
		<Field.Field>
			<Field.Label for="appname">{m.app_name()}</Field.Label>
			<ButtonGroup>
				<InputGroup.Root>
					<InputGroup.Addon align="inline-start" class="pe-0!">
						{#if config.envLocked}
							<LockIcon />
						{:else}
							<AppWindowIcon />
						{/if}
					</InputGroup.Addon>
					<InputGroup.Input
						id="appname"
						name="appname"
						type="text"
						bind:value={appname}
						disabled={config.envLocked}
					/>
				</InputGroup.Root>
				<Button
					type="submit"
					variant="outline"
					disabled={config.envLocked || appname.trim() === config.appname}
				>
					{m.save_changes()}
				</Button>
			</ButtonGroup>
			<Field.Description class="mt-1! max-w-xl @xl:text-xs text-balance">
				{#if config.envLocked}
					{m.app_name_env_locked_helper()}
				{:else}
					{m.app_name_helper()}
				{/if}
			</Field.Description>
		</Field.Field>
	</Field.Set>
</form>
