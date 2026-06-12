<script lang="ts">
	import LanguagesIcon from '@lucide/svelte/icons/languages';
	import * as Field from '$lib/components/ui/field';
	import * as InputGroup from '$lib/components/ui/input-group';
	import * as Select from '$lib/components/ui/select';
	import { m } from '$lib/paraglide/messages';
	import { getLocale, locales, setLocale } from '$lib/paraglide/runtime';
	import { saveLanguagePreference } from '$lib/remotes/preferences.remote';
	import { translateLanguage } from '$lib/utils';
	import { toast } from 'svelte-sonner';

	type Locale = (typeof locales)[number];

	const saveLanguage = async (locale: Locale) => {
		try {
			await saveLanguagePreference(locale);
			setLocale(locale);
			toast.success(m.preferences_saved());
		} catch (error) {
			console.error('[profile] set language FE', error);
			toast.error(m.errors_generic());
		}
	};
	let language = $state<Locale>(getLocale());
</script>

<div class="contents">
	<Field.Field>
		<Field.Label for="locale">{m.language()}</Field.Label>
		<InputGroup.Root class="w-full md:max-w-sm">
			<InputGroup.Addon>
				<LanguagesIcon />
			</InputGroup.Addon>
			<Select.Root
				type="single"
				bind:value={language}
				onValueChange={(locale) => {
					if (locale && locale !== getLocale()) saveLanguage(locale as Locale);
				}}
			>
				<Select.Trigger class="grow border-r-0" id="locale">
					{translateLanguage(getLocale(), language)}
				</Select.Trigger>
				<Select.Content>
					{#each locales as locale (locale)}
						<Select.Item label={translateLanguage(getLocale(), locale)} value={locale} />
					{/each}
				</Select.Content>
			</Select.Root>
		</InputGroup.Root>
	</Field.Field>
</div>
