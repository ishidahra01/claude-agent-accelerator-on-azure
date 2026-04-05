type FoundryConfig = {
  model: string;
  baseUrl?: string;
  resource?: string;
  apiKey?: string;
  env: Record<string, string>;
  authMethod: 'api-key' | 'entra-id';
  displayTarget: string;
};

function normalizeFoundryBaseUrl(rawValue?: string): string | undefined {
  if (!rawValue) {
    return undefined;
  }

  const trimmed = rawValue.trim().replace(/\/+$/, '');

  if (!trimmed) {
    return undefined;
  }

  return trimmed.replace(/\/v1$/i, '');
}

export function loadFoundryConfig(env: NodeJS.ProcessEnv = process.env): FoundryConfig {
  const model =
    env.ANTHROPIC_DEFAULT_SONNET_MODEL?.trim() ||
    env.FOUNDRY_MODEL?.trim() ||
    'claude-sonnet-4-6';

  const baseUrl = normalizeFoundryBaseUrl(
    env.ANTHROPIC_FOUNDRY_BASE_URL || env.FOUNDRY_BASE_URL
  );
  const resource = env.ANTHROPIC_FOUNDRY_RESOURCE?.trim();
  const apiKey = env.ANTHROPIC_FOUNDRY_API_KEY?.trim() || env.FOUNDRY_API_KEY?.trim();

  if (!baseUrl && !resource) {
    throw new Error(
      'Set ANTHROPIC_FOUNDRY_RESOURCE or ANTHROPIC_FOUNDRY_BASE_URL to enable Microsoft Foundry.'
    );
  }

  const normalizedResource = resource || extractResourceName(baseUrl);
  const envForSdk: Record<string, string> = {
    CLAUDE_CODE_USE_FOUNDRY: '1',
    ANTHROPIC_DEFAULT_SONNET_MODEL: model,
  };

  if (baseUrl) {
    envForSdk.ANTHROPIC_FOUNDRY_BASE_URL = baseUrl;
  } else if (normalizedResource) {
    envForSdk.ANTHROPIC_FOUNDRY_RESOURCE = normalizedResource;
  }

  if (apiKey) {
    envForSdk.ANTHROPIC_FOUNDRY_API_KEY = apiKey;
  }

  const pinnedOpus = env.ANTHROPIC_DEFAULT_OPUS_MODEL?.trim();
  const pinnedHaiku = env.ANTHROPIC_DEFAULT_HAIKU_MODEL?.trim();

  if (pinnedOpus) {
    envForSdk.ANTHROPIC_DEFAULT_OPUS_MODEL = pinnedOpus;
  }

  if (pinnedHaiku) {
    envForSdk.ANTHROPIC_DEFAULT_HAIKU_MODEL = pinnedHaiku;
  }

  return {
    model,
    baseUrl,
    resource: normalizedResource,
    apiKey,
    env: envForSdk,
    authMethod: apiKey ? 'api-key' : 'entra-id',
    displayTarget: baseUrl || `https://${normalizedResource}.services.ai.azure.com/anthropic`,
  };
}

function extractResourceName(baseUrl?: string): string | undefined {
  if (!baseUrl) {
    return undefined;
  }

  try {
    const hostname = new URL(baseUrl).hostname;
    const [resourceName] = hostname.split('.');
    return resourceName || undefined;
  } catch {
    return undefined;
  }
}

export type { FoundryConfig };