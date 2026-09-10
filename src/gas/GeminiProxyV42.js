/**
 * GeminiProxyV42.js
 * Hardened Apps Script Gemini proxy.
 *
 * - API key stays in Script Properties.
 * - Sends the key in x-goog-api-key header, not the URL.
 * - Uses current GA fallback models.
 * - Retries only rate-limit / 5xx transient failures.
 * - Avoids deprecated sampling parameters.
 * - Returns actionable diagnostics for managed-domain URL allowlist failures.
 */

const GEMINI42_CONFIG = Object.freeze({
  MODELS: ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash-lite'],
  MAX_RETRIES_PER_MODEL: 3,
  BACKOFF_BASE_MS: 750,
  MAX_OUTPUT_TOKENS: 16384,
  ENDPOINT_ROOT: 'https://generativelanguage.googleapis.com/v1beta/models/'
});

/**
 * Drop-in replacement backend for queryGemini().
 *
 * @param {string=} requestedModel
 * @param {Array<Object>} contents
 * @param {string=} systemInstruction
 * @return {{text?: string, error?: string, model?: string, status?: number}}
 */
function queryGeminiV42(requestedModel, contents, systemInstruction) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    return {
      error: 'Gemini API key is not configured. Save GEMINI_API_KEY in Apps Script Script Properties.',
      status: 401
    };
  }

  if (!Array.isArray(contents) || contents.length === 0) {
    return { error: 'Gemini request has no contents.', status: 400 };
  }

  const models = gemini42ModelChain_(requestedModel);
  let lastError = null;

  for (let m = 0; m < models.length; m++) {
    const model = models[m];
    const result = gemini42RequestWithRetry_(apiKey, model, contents, systemInstruction);

    if (result.text) return result;
    lastError = result;

    // A client/request error will not be fixed by switching models, except 404
    // which may indicate an unavailable model alias.
    if (result.status &&
        result.status >= 400 &&
        result.status < 500 &&
        result.status !== 404 &&
        result.status !== 429) {
      break;
    }
  }

  return lastError || { error: 'Gemini request failed with no response.', status: 500 };
}

function gemini42RequestWithRetry_(apiKey, model, contents, systemInstruction) {
  const endpoint = GEMINI42_CONFIG.ENDPOINT_ROOT +
    encodeURIComponent(model) +
    ':generateContent';

  const payload = {
    contents,
    generationConfig: {
      maxOutputTokens: GEMINI42_CONFIG.MAX_OUTPUT_TOKENS,
      responseFormat: {
        text: {
          mimeType: 'application/json',
          schema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                level: { type: 'integer' },
                content: { type: 'string' },
                color: { type: 'string' },
                labels: { type: 'array', items: { type: 'string' } }
              },
              required: ['title', 'level', 'content', 'color', 'labels']
            }
          }
        }
      }
    }
  };

  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: String(systemInstruction) }]
    };
  }

  let last = null;

  for (let attempt = 0; attempt < GEMINI42_CONFIG.MAX_RETRIES_PER_MODEL; attempt++) {
    try {
      const response = UrlFetchApp.fetch(endpoint, {
        method: 'post',
        contentType: 'application/json',
        headers: {
          'x-goog-api-key': apiKey,
          'Accept': 'application/json'
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });

      const status = response.getResponseCode();
      const responseText = response.getContentText();

      if (status >= 200 && status < 300) {
        const parsed = JSON.parse(responseText);
        const text = gemini42ExtractText_(parsed);

        if (!text) {
          return {
            error: 'Gemini returned no text candidate.',
            model,
            status
          };
        }

        return { text, model, status };
      }

      last = {
        error: gemini42ApiErrorMessage_(status, responseText, model),
        model,
        status
      };

      const transient = status === 429 || status >= 500;
      if (!transient) return last;
    } catch (error) {
      last = {
        error: gemini42FetchErrorMessage_(error),
        model,
        status: 0
      };
    }

    if (attempt < GEMINI42_CONFIG.MAX_RETRIES_PER_MODEL - 1) {
      const delay = GEMINI42_CONFIG.BACKOFF_BASE_MS * Math.pow(2, attempt);
      Utilities.sleep(delay);
    }
  }

  return last || { error: 'Gemini request failed.', model, status: 500 };
}

function gemini42ModelChain_(requestedModel) {
  const out = [];
  const requested = String(requestedModel || '').trim();

  if (requested && /^[a-zA-Z0-9._-]+$/.test(requested)) {
    out.push(requested);
  }

  for (let i = 0; i < GEMINI42_CONFIG.MODELS.length; i++) {
    if (out.indexOf(GEMINI42_CONFIG.MODELS[i]) === -1) {
      out.push(GEMINI42_CONFIG.MODELS[i]);
    }
  }
  return out;
}

function gemini42ExtractText_(responseJson) {
  if (!responseJson ||
      !responseJson.candidates ||
      responseJson.candidates.length === 0 ||
      !responseJson.candidates[0].content ||
      !responseJson.candidates[0].content.parts) {
    return '';
  }

  const parts = responseJson.candidates[0].content.parts;
  const chunks = [];

  for (let i = 0; i < parts.length; i++) {
    if (parts[i] && typeof parts[i].text === 'string') {
      chunks.push(parts[i].text);
    }
  }
  return chunks.join('');
}

function gemini42ApiErrorMessage_(status, responseText, model) {
  let detail = String(responseText || '').slice(0, 2000);
  try {
    const parsed = JSON.parse(responseText);
    if (parsed && parsed.error && parsed.error.message) {
      detail = parsed.error.message;
    }
  } catch (ignore) {}

  if (status === 401 || status === 403) {
    return 'Gemini authorization rejected for ' + model +
      '. Verify GEMINI_API_KEY and project/API access. ' + detail;
  }
  if (status === 429) {
    return 'Gemini rate limit reached for ' + model + '. ' + detail;
  }
  if (status === 404) {
    return 'Gemini model endpoint was not found for ' + model + '. ' + detail;
  }
  return 'Gemini API error ' + status + ' for ' + model + ': ' + detail;
}

function gemini42FetchErrorMessage_(error) {
  const message = error && error.message ? error.message : String(error);

  if (/allowlist|blocked|not allowed|urlfetch|fetch/i.test(message)) {
    return 'UrlFetchApp could not reach the Gemini endpoint. In a managed Google Workspace domain, ask the administrator to verify the Apps Script URL allowlist for generativelanguage.googleapis.com. Original error: ' + message;
  }

  return 'UrlFetchApp failed while contacting Gemini: ' + message;
}
