import { LANGUAGES, type ResourceLoader, type Resources } from '@grafana/i18n';

const resources = LANGUAGES.reduce<
  Record<string, () => Promise<{ default: Resources }>>
>((acc, lang) => {
  acc[lang.code] = async () =>
    await import(`./${lang.code}/grafana-query-ui.json`);
  return acc;
}, {});

/**
 * Loads the translation resources for the given language and returns them.
 */
export const loadTranslations: ResourceLoader = async (
  resolvedLanguage: string,
) => {
  const translation = await resources[resolvedLanguage]();
  return translation.default;
};
