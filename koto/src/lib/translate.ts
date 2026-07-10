import Anthropic from "@anthropic-ai/sdk";

export type Direction = "auto" | "en-ja" | "ja-en" | "fil-ja" | "ja-fil";

export interface TranslationResult {
  detectedSourceLang: string;
  detectedTargetLang: string;
  original: string;
  translation: string;
  romaji: string | null;
  meaning: string;
  formal: string;
  casual: string;
  business: string;
}

const MODEL = "claude-sonnet-5";

const DIRECTION_LABEL: Record<Direction, string> = {
  auto: "Detect the source language automatically (it will be English, Japanese, or Filipino/Tagalog) and translate into the most likely intended target language.",
  "en-ja": "Translate from English to Japanese.",
  "ja-en": "Translate from Japanese to English.",
  "fil-ja": "Translate from Filipino (Tagalog) to Japanese.",
  "ja-fil": "Translate from Japanese to Filipino (Tagalog).",
};

const TRANSLATE_TOOL: Anthropic.Tool = {
  name: "return_translation",
  description: "Return a structured Japanese translation with teaching notes.",
  input_schema: {
    type: "object",
    properties: {
      detectedSourceLang: {
        type: "string",
        description: "BCP-47-ish label of the detected source language, e.g. 'English', 'Japanese', 'Filipino'.",
      },
      detectedTargetLang: {
        type: "string",
        description: "Label of the target language translated into.",
      },
      translation: {
        type: "string",
        description: "The translated text in the target language, using natural native script (kanji/kana for Japanese).",
      },
      romaji: {
        type: ["string", "null"],
        description: "Hepburn romaji reading if the translation is Japanese, otherwise null.",
      },
      meaning: {
        type: "string",
        description: "2-4 sentences on how this is *actually* used by native speakers day to day: who says it to whom, in what setting, and any nuance a textbook definition would miss. Plain, conversational tone, not a dictionary entry.",
      },
      formal: {
        type: "string",
        description: "A formal/polite (keigo where relevant) version of the same meaning, in the target language.",
      },
      casual: {
        type: "string",
        description: "A casual/informal version of the same meaning, in the target language.",
      },
      business: {
        type: "string",
        description: "A business-appropriate version of the same meaning, in the target language.",
      },
    },
    required: [
      "detectedSourceLang",
      "detectedTargetLang",
      "translation",
      "romaji",
      "meaning",
      "formal",
      "casual",
      "business",
    ],
  },
};

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not configured on the server.");
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

export async function translate(
  text: string,
  direction: Direction = "auto"
): Promise<TranslationResult> {
  const anthropic = getClient();

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system:
      "You are a Japanese linguist and translator (JLPT N5-N1 fluent) helping a learner. " +
      "Be precise, natural, and native-sounding. Never produce textbook-stiff phrasing. " +
      DIRECTION_LABEL[direction],
    messages: [{ role: "user", content: text }],
    tools: [TRANSLATE_TOOL],
    tool_choice: { type: "tool", name: "return_translation" },
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );

  if (!toolUse) {
    throw new Error("Model did not return a structured translation.");
  }

  const input = toolUse.input as Omit<TranslationResult, "original">;

  return {
    original: text,
    ...input,
  };
}
