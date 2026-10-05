import "server-only";
import { hasKey, openai } from "./agent/client";
import { geminiKey, generateGeminiText, vertexConfigured, vertexModels } from "./agent/gemini";
import * as runtime from "./agent/runtime";
import { getSetting } from "./db";
import * as repo from "./repo";

// Voice calls: a realtime/spoken voice front for a dot. It talks with the user and hands real work
// to the dot's text agent with send_task. Results land later as work updates.
export const VOICE_MODEL = process.env.DOTS_VOICE_MODEL || "gpt-realtime-2.1";

export async function getGeminiVoiceModel(): Promise<string> {
  if (process.env.DOTS_GEMINI_VOICE_MODEL) {
    return process.env.DOTS_GEMINI_VOICE_MODEL;
  }
  if (vertexConfigured()) {
    const vModels = await vertexModels().catch(() => []);
    const found = vModels.find((m) => m.includes("flash")) ?? vModels[0];
    if (found) return found;
  }
  return "gemini:gemini-2.0-flash";
}

function voicePrompt(dotId: string, convId: string): string {
  const dot = repo.getDot(dotId)!;
  const memories = repo.listMemories(dotId).slice(-12).map((m) => `- ${m.text}`).join("\n");
  const recent = repo
    .conversationMessages(convId, 16)
    .filter((m) => (m.role === "user" || m.role === "dot") && m.text)
    .map((m) => `${m.role === "user" ? "User" : dot.name}: ${m.text.slice(0, 300)}`)
    .join("\n");
  return `You are ${dot.name}, the user's personal AI agent (a "dot"), on a live voice call. ${dot.purpose ? `Your job: ${dot.purpose}.` : ""}
${dot.instructions ? `How the user wants you to work: ${dot.instructions}\n` : ""}
Voice style: warm, natural, brief. One or two short sentences per turn. No lists, no markdown, no reading out URLs or IDs. Don't introduce yourself; open with a short friendly line.

You're on the phone *and* at work. During the call you can't use your computer, browser, or apps yourself. For anything that needs real work (research, browsing, email, calendar, files, code), call send_task with a complete, self-contained request that preserves every detail, constraint, and approval requirement the user said. Then tell the user briefly that you're on it. Don't make up results.
Results arrive later as a "work update". When one arrives, tell the user naturally and briefly, placing it in context if the conversation has moved on. If an update says your working self needs approval, tell the user to approve it in the app.
Everything said on this call is also saved into the written chat. Call recent_messages if you need more of that chat. When the user says goodbye, say goodbye out loud first, then call end_call.

What you remember about the user:
${memories || "(nothing yet)"}

This chat so far:
${recent || "(none)"}`;
}

const TOOLS = [
  {
    type: "function" as const,
    name: "send_task",
    description:
      "Hand a job to your working self, who has your computer, browser, and the user's apps. This is a receipt, not the answer: the result arrives later as a work update.",
    parameters: {
      type: "object",
      properties: { request: { type: "string", description: "The complete request, preserving every constraint and approval requirement the user stated." } },
      required: ["request"],
    },
  },
  {
    type: "function" as const,
    name: "recent_messages",
    description: "Read the last few messages of the written chat with the user.",
    parameters: { type: "object", properties: {} },
  },
  {
    type: "function" as const,
    name: "end_call",
    description: "Hang up. Always say goodbye out loud first.",
    parameters: { type: "object", properties: {} },
  },
];

/** Creates a live voice session for a dot using Gemini Voice or OpenAI Realtime. */
export async function createVoiceSession(
  dotId: string,
  convId: string,
): Promise<{ provider: "openai" | "gemini"; token?: string; model: string; greeting?: string }> {
  const dot = repo.getDot(dotId);
  if (!dot) throw new Error("Dot not found.");

  const preferredProvider = getSetting("voice_provider") || process.env.DOTS_VOICE_PROVIDER || "auto";
  const openAiAvailable = hasKey();
  const geminiAvailable = Boolean(geminiKey()) || vertexConfigured();

  const isCute = getSetting("dots_reaction") === "cute";

  // If user selected Gemini, or if OpenAI is unavailable while Gemini is available:
  if (preferredProvider === "gemini" || (!openAiAvailable && geminiAvailable)) {
    if (!geminiAvailable) {
      throw new Error("No Gemini API key or Vertex AI configured. Add a Gemini key in Settings to call your dots.");
    }
    const model = await getGeminiVoiceModel();
    const greeting = isCute
      ? `Hey! It's ${dot.name}. What can I help you with today?`
      : `Hello, this is ${dot.name}. How can I assist you?`;
    return { provider: "gemini", model, greeting };
  }

  // If OpenAI is available, attempt to create an OpenAI Realtime session
  if (openAiAvailable && preferredProvider !== "gemini") {
    try {
      const res = await openai().realtime.clientSecrets.create({
        expires_after: { anchor: "created_at", seconds: 120 },
        session: {
          type: "realtime",
          model: VOICE_MODEL,
          instructions: voicePrompt(dotId, convId),
          audio: {
            input: { transcription: { model: "gpt-4o-mini-transcribe" }, turn_detection: { type: "semantic_vad" } },
            output: { voice: "marin" },
          },
          tools: TOOLS,
        },
      });
      return { provider: "openai", token: res.value, model: VOICE_MODEL };
    } catch (err) {
      // If OpenAI failed (e.g. 401 invalid key, quota), seamlessly fall back to Gemini if available!
      if (geminiAvailable) {
        console.warn("[voice] OpenAI Realtime failed, falling back to Gemini Voice:", err);
        const model = await getGeminiVoiceModel();
        const greeting = isCute
          ? `Hey! It's ${dot.name}. What are we working on today?`
          : `Hello, this is ${dot.name}. How can I assist you?`;
        return { provider: "gemini", model, greeting };
      }
      throw err;
    }
  }

  if (geminiAvailable) {
    const model = await getGeminiVoiceModel();
    const greeting = isCute
      ? `Hey! It's ${dot.name}. What can I do for you?`
      : `Hello, this is ${dot.name}. How can I help you?`;
    return { provider: "gemini", model, greeting };
  }

  throw new Error("No AI voice key found. Please add your Google Gemini API key or OpenAI key in Settings.");
}

/** Handles a conversational voice turn using Google Gemini. */
export async function communicateGeminiVoice(
  dotId: string,
  convId: string,
  userSpeech: string,
): Promise<{ text: string; note?: string; endCall?: boolean }> {
  const dot = repo.getDot(dotId);
  if (!dot) throw new Error("Dot not found.");

  const model = await getGeminiVoiceModel();
  const sysPrompt = `${voicePrompt(dotId, convId)}

Important rules for speaking out loud:
1. Speak directly in persona as ${dot.name}.
2. Keep your response brief, spoken, and conversational (1 to 2 short sentences). Do NOT output markdown, bullet points, headers, or links.
3. If the user asks you to perform research, coding, browsing, or computer work, acknowledge it out loud warmly and append this exact tag at the end:
[TOOL:send_task:{"request":"<complete request>"}]
4. If the user says goodbye or wants to end the call, say goodbye out loud and append:
[TOOL:end_call]
`;

  const recent = repo
    .conversationMessages(convId, 8)
    .filter((m) => (m.role === "user" || m.role === "dot") && m.text)
    .map((m) => `${m.role === "user" ? "User" : dot.name}: ${m.text}`)
    .join("\n");

  const prompt = `${recent ? `Recent chat transcript:\n${recent}\n\n` : ""}User said: "${userSpeech}"\n${dot.name}:`;

  const raw = await generateGeminiText(model, sysPrompt, prompt);
  let cleanText = raw.trim();
  let note: string | undefined;
  let endCall = false;

  const taskMatch = cleanText.match(/\[TOOL:send_task:([\s\S]*?)\]/);
  if (taskMatch) {
    try {
      const parsed = JSON.parse(taskMatch[1]);
      if (parsed.request) {
        runtime.queueTask(dotId, parsed.request, convId);
        note = `Handed off: ${parsed.request}`;
      }
    } catch {}
    cleanText = cleanText.replace(taskMatch[0], "").trim();
  }

  if (/\[TOOL:end_call\]/i.test(cleanText)) {
    endCall = true;
    cleanText = cleanText.replace(/\[TOOL:end_call\]/gi, "").trim();
  }

  // Strip markdown symbols that sound awkward in speech
  cleanText = cleanText.replace(/[*#_`~[\]]/g, "").trim();

  // Save the voice lines into the conversation history
  if (userSpeech.trim()) {
    repo.addMessage({ dotId, role: "user", text: userSpeech.trim(), from: "voice", conversationId: convId, channelId: null });
  }
  if (cleanText) {
    repo.addMessage({ dotId, role: "dot", text: cleanText, from: "voice", conversationId: convId, channelId: null });
  }

  return { text: cleanText, note, endCall };
}
