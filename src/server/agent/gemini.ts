import "server-only";
import { GoogleGenAI } from "@google/genai";
import { getSetting, setSetting } from "../db";
import { seal, unseal } from "../vault";

export const GEMINI_PREFIX = "gemini:";
export const VERTEX_PREFIX = "vertex:";
const KEY_SETTING = "gemini_key";
const MODELS_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const VERTEX_PROJECT_SETTING = "vertex_project";
const VERTEX_LOCATION_SETTING = "vertex_location";
const VERTEX_CREDENTIALS_SETTING = "vertex_credentials";

const g = globalThis as unknown as {
  __dotsGemini?: { key: string; client: GoogleGenAI };
  __dotsGeminiModels?: { at: number; ids: string[] };
  __dotsVertex?: { project: string; location: string; credentials: string | null; client: GoogleGenAI };
  __dotsVertexModels?: { at: number; ids: string[] };
};

function isValidKey(key: string | undefined | null): boolean {
  if (!key) return false;
  const k = key.trim();
  return Boolean(k && k !== "AIza..." && !k.startsWith("AIza-placeholder") && k.length > 15);
}

function envKey(): string | null {
  return isValidKey(process.env.GEMINI_API_KEY) ? process.env.GEMINI_API_KEY!.trim() : null;
}

function apiKey(): string | null {
  const sealed = getSetting(KEY_SETTING);
  if (sealed) {
    try {
      const unsealed = unseal(sealed);
      if (isValidKey(unsealed)) return unsealed.trim();
    } catch {}
  }
  if (envKey()) return envKey();
  return null;
}

export function geminiSource(): "env" | "settings" | null {
  const sealed = getSetting(KEY_SETTING);
  if (sealed) {
    try {
      const unsealed = unseal(sealed);
      if (isValidKey(unsealed)) return "settings";
    } catch {}
  }
  return envKey() ? "env" : null;
}

export function geminiKey(): string | null {
  return apiKey();
}

export function gemini(): GoogleGenAI {
  const key = apiKey();
  if (!key) throw new Error("No Gemini API key yet. Add one in Settings.");
  if (g.__dotsGemini?.key !== key) g.__dotsGemini = { key, client: new GoogleGenAI({ apiKey: key }) };
  return g.__dotsGemini.client;
}

function environmentProject(): string | null {
  return process.env.VERTEX_AI_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || null;
}

function environmentLocation(): string | null {
  return process.env.VERTEX_AI_LOCATION || process.env.GOOGLE_CLOUD_LOCATION || null;
}

function credentialsJson(): string | null {
  if (process.env.VERTEX_AI_CREDENTIALS_JSON) return process.env.VERTEX_AI_CREDENTIALS_JSON;
  const sealed = getSetting(VERTEX_CREDENTIALS_SETTING);
  if (!sealed) return null;
  try {
    return unseal(sealed);
  } catch {
    throw new Error("The saved Vertex AI credential could not be decrypted. Remove and configure Vertex AI again.");
  }
}

export function vertexProject(): string {
  return environmentProject() || getSetting(VERTEX_PROJECT_SETTING) || "";
}

export function vertexLocation(): string {
  return environmentLocation() || getSetting(VERTEX_LOCATION_SETTING) || "us-central1";
}

export function vertexConfig() {
  return { project: vertexProject(), location: vertexLocation(), credentials: credentialsJson() };
}

export function vertexSource(): "env" | "settings" | null {
  if (environmentProject() || process.env.VERTEX_AI_CREDENTIALS_JSON) return "env";
  return getSetting(VERTEX_PROJECT_SETTING) ? "settings" : null;
}

export function vertexConfigured(): boolean {
  return Boolean(vertexProject());
}

function serviceAccount(credentials: string): { type: "service_account"; project_id: string; client_email: string; private_key: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(credentials);
  } catch {
    throw new Error("The Vertex AI service-account credential must be valid JSON.");
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("type" in parsed) || parsed.type !== "service_account" ||
    !("project_id" in parsed) || typeof parsed.project_id !== "string" ||
    !("client_email" in parsed) || typeof parsed.client_email !== "string" ||
    !("private_key" in parsed) || typeof parsed.private_key !== "string"
  ) {
    throw new Error("Use a Google Cloud service-account JSON key with type, project_id, client_email, and private_key fields.");
  }
  return {
    type: "service_account",
    project_id: parsed.project_id,
    client_email: parsed.client_email,
    private_key: parsed.private_key,
  };
}

export function vertex(): GoogleGenAI {
  const { project, location, credentials } = vertexConfig();
  if (!project) throw new Error("Set a Google Cloud project ID in Settings before using Vertex AI.");
  if (g.__dotsVertex?.project !== project || g.__dotsVertex.location !== location || g.__dotsVertex.credentials !== credentials) {
    const googleAuthOptions = credentials ? { credentials: serviceAccount(credentials) } : undefined;
    g.__dotsVertex = {
      project,
      location,
      credentials,
      client: new GoogleGenAI({ vertexai: true, project, location, googleAuthOptions }),
    };
  }
  return g.__dotsVertex.client;
}

export async function saveVertexConfig(input: { project: string; location: string; credentials: string; useAdc: boolean }): Promise<string | null> {
  const project = input.project.trim();
  const rawLocation = input.location.trim();
  const credentials = input.credentials.trim();
  if (environmentProject() || process.env.VERTEX_AI_CREDENTIALS_JSON) return "Vertex AI settings are provided by environment variables.";
  if (!project && !rawLocation && !credentials) {
    setSetting(VERTEX_PROJECT_SETTING, null);
    setSetting(VERTEX_LOCATION_SETTING, null);
    setSetting(VERTEX_CREDENTIALS_SETTING, null);
    g.__dotsVertex = undefined;
    g.__dotsVertexModels = undefined;
    return null;
  }
  if (!project) return "Enter a Google Cloud project ID.";
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(project)) return "Enter a valid Google Cloud project ID.";
  const location = rawLocation || "us-central1";
  if (!/^[a-z0-9-]+$/.test(location)) return "Enter a valid Vertex AI location.";
  if (credentials) {
    try {
      serviceAccount(credentials);
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    }
  }

  setSetting(VERTEX_PROJECT_SETTING, project);
  setSetting(VERTEX_LOCATION_SETTING, location);
  if (input.useAdc) setSetting(VERTEX_CREDENTIALS_SETTING, null);
  else if (credentials) setSetting(VERTEX_CREDENTIALS_SETTING, seal(credentials));
  g.__dotsVertex = undefined;
  g.__dotsVertexModels = undefined;
  return null;
}

export async function vertexModels(): Promise<string[]> {
  if (!vertexConfigured()) return [];
  if (g.__dotsVertexModels && Date.now() - g.__dotsVertexModels.at < 3_600_000) return g.__dotsVertexModels.ids;

  const models: string[] = [];
  try {
    for await (const model of await vertex().models.list()) {
      const id = model.name?.split("/").at(-1);
      if (id?.startsWith("gemini-") && !/(?:embedding|image|tts|audio|live|robotics)/i.test(id)) {
        models.push(VERTEX_PREFIX + id);
      }
    }
  } catch (err) {
    throw new Error(`Couldn't list Vertex AI Gemini models: ${err instanceof Error ? err.message : String(err)}`);
  }
  const ids = [...new Set(models)].sort((a, b) => b.localeCompare(a));
  g.__dotsVertexModels = { at: Date.now(), ids };
  return ids;
}

export const isVertexModel = (model: string) => model.startsWith(VERTEX_PREFIX);
export const isGeminiModel = (model: string) => model.startsWith(GEMINI_PREFIX) || isVertexModel(model);
export const geminiModelName = (model: string) => model.slice(model.indexOf(":") + 1);
export const geminiClient = (model: string) => (isVertexModel(model) ? vertex() : gemini());

export async function saveGeminiKey(key: string): Promise<string | null> {
  const trimmed = key.trim();
  if (!trimmed) {
    setSetting(KEY_SETTING, null);
    g.__dotsGemini = undefined;
    g.__dotsGeminiModels = undefined;
    return null;
  }
  try {
    const response = await fetch(MODELS_URL, { headers: { "x-goog-api-key": trimmed } });
    if (response.status === 401 || response.status === 403) return "Google didn't accept that Gemini API key.";
    if (!response.ok) return `Couldn't check the Gemini key with Google (${response.status}).`;
  } catch (err) {
    return `Couldn't reach Google: ${err instanceof Error ? err.message : String(err)}`;
  }
  setSetting(KEY_SETTING, seal(key));
  g.__dotsGemini = undefined;
  g.__dotsGeminiModels = undefined;
  return null;
}

export const DEFAULT_FREE_GEMINI_MODELS = [
  GEMINI_PREFIX + "gemini-2.5-flash",
  GEMINI_PREFIX + "gemini-2.0-flash",
  GEMINI_PREFIX + "gemini-2.0-flash-lite",
  GEMINI_PREFIX + "gemini-1.5-flash",
  GEMINI_PREFIX + "gemini-1.5-pro",
];

export async function geminiModels(): Promise<string[]> {
  const key = apiKey();
  if (!key) return [];
  if (g.__dotsGeminiModels && Date.now() - g.__dotsGeminiModels.at < 3_600_000) return g.__dotsGeminiModels.ids;

  const models: string[] = [];
  let pageToken: string | undefined;
  try {
    do {
      const url = new URL(MODELS_URL);
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const response = await fetch(url, { headers: { "x-goog-api-key": key } });
      if (!response.ok) throw new Error(`Google API returned ${response.status} ${response.statusText}`);
      const page = (await response.json()) as {
        models?: { name?: string; supportedGenerationMethods?: string[] }[];
        nextPageToken?: string;
      };
      for (const model of page.models ?? []) {
        const id = model.name?.replace(/^models\//, "");
        if (
          id?.startsWith("gemini-") &&
          !/(?:embedding|image|tts|audio|live|robotics)/i.test(id) &&
          model.supportedGenerationMethods?.includes("generateContent")
        ) {
          models.push(GEMINI_PREFIX + id);
        }
      }
      pageToken = page.nextPageToken;
    } while (pageToken);
  } catch (err) {
    console.warn("[gemini] Error fetching dynamic models:", err);
    throw err;
  }

  const ids = [...new Set(models)].sort((a, b) => {
    // Prioritize free flash models first
    const score = (m: string) =>
      m.includes("2.5-flash") ? 100 :
      m.includes("2.0-flash") && !m.includes("lite") ? 95 :
      m.includes("2.0-flash-lite") ? 90 :
      m.includes("1.5-flash") ? 85 :
      m.includes("pro") ? 80 : 50;
    return score(b) - score(a) || b.localeCompare(a);
  });
  g.__dotsGeminiModels = { at: Date.now(), ids };
  return ids;
}

export async function generateGeminiText(
  model: string,
  instructions: string,
  prompt: string,
  options: { signal?: AbortSignal; responseJsonSchema?: unknown; googleSearch?: boolean } = {},
): Promise<string> {
  const response = await geminiClient(model).interactions.create({
    model: geminiModelName(model),
    input: prompt,
    system_instruction: instructions,
    ...(options.googleSearch ? { tools: [{ type: "google_search" as const }] } : {}),
    ...(options.responseJsonSchema
      ? { response_format: { type: "text" as const, mime_type: "application/json", schema: options.responseJsonSchema } }
      : {}),
  }, { signal: options.signal });
  return response.output_text ?? "";
}
