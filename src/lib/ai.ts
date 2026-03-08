import { GoogleGenAI, Type } from '@google/genai';
import { useStore } from '../store/useStore';

const getGeminiAi = () => {
  const apiKey = useStore.getState().geminiApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API Key is missing. Please set it in Settings.');
  }
  return new GoogleGenAI({ apiKey });
};

async function callTextAI(prompt: string, jsonMode: boolean = false): Promise<string> {
  const state = useStore.getState();
  const provider = state.aiProvider;

  if (provider === 'openrouter') {
    const apiKey = state.openRouterApiKey || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OpenRouter API Key is missing. Please set it in Settings.');
    }
    const model = state.openRouterModel || 'stepfun/step-3.5-flash:free';

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'InkSpire',
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        // response_format: jsonMode ? { type: 'json_object' } : undefined, // Not all models support this
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenRouter API error: ${response.status} ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } else {
    // Gemini
    const ai = getGeminiAi();
    const config: any = {};
    if (jsonMode) {
      config.responseMimeType = 'application/json';
    }
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: Object.keys(config).length > 0 ? config : undefined,
    });
    return response.text || '';
  }
}

export interface Proposal {
  title: string;
  concept: string;
  targetAudience: string;
  tone: string;
}

export interface Outline {
  summary: string;
  chapters: { title: string; description: string }[];
}

function parseJSON(text: string) {
  try {
    const cleaned = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("Failed to parse JSON:", text);
    throw e;
  }
}

export async function generateProposals(idea: string, language: string): Promise<Proposal[]> {
  const prompt = `Based on the following idea, generate 3 distinct book proposals.
Idea: ${idea}
Language: ${language}

Return ONLY a JSON array of 3 objects, each with 'title', 'concept', 'targetAudience', and 'tone'. Do not include markdown formatting like \`\`\`json.`;

  const text = await callTextAI(prompt, true);
  return parseJSON(text || '[]');
}

export async function generateOutline(proposal: Proposal, language: string): Promise<Outline> {
  const prompt = `Based on the following book proposal, generate a detailed summary and a chapter-by-chapter outline.
Title: ${proposal.title}
Concept: ${proposal.concept}
Target Audience: ${proposal.targetAudience}
Tone: ${proposal.tone}
Language: ${language}

Return ONLY a JSON object with 'summary' (a comprehensive overview of the book) and 'chapters' (an array of objects with 'title' and 'description'). Do not include markdown formatting like \`\`\`json.`;

  const text = await callTextAI(prompt, true);
  return parseJSON(text || '{}');
}

export async function generateChapterContent(
  bookTitle: string,
  bookSummary: string,
  chapterTitle: string,
  chapterDescription: string,
  previousChapterContent: string | null,
  language: string
): Promise<string> {
  let prompt = `Write the content for a chapter of a book.
Book Title: ${bookTitle}
Book Summary: ${bookSummary}
Chapter Title: ${chapterTitle}
Chapter Description: ${chapterDescription}
Language: ${language}

Write engaging, well-structured content that fits the tone of the book. Use markdown formatting.`;

  if (previousChapterContent) {
    prompt += `\n\nFor context, here is the end of the previous chapter:\n${previousChapterContent.slice(-1000)}`;
  }

  return await callTextAI(prompt, false);
}

export async function generateImage(prompt: string): Promise<string | null> {
  const ai = getGeminiAi(); // Always use Gemini for images for now
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: '16:9',
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error('Image generation failed', error);
    throw error; // Re-throw to let the UI handle the error message
  }
}

export interface ChatOutlineResponse {
  reply: string;
  updatedOutline?: { title: string; description: string }[];
}

export async function updateOutlineWithAI(
  currentChapters: { title: string; description: string }[],
  instruction: string,
  bookTitle: string,
  bookSummary: string,
  language: string
): Promise<ChatOutlineResponse> {
  const prompt = `You are a professional book editor and co-author. Help me revise the book outline based on the user's instruction.
  
Book Title: ${bookTitle}
Book Summary: ${bookSummary}
Language: ${language}

Current Chapters:
${JSON.stringify(currentChapters, null, 2)}

User Instruction: "${instruction}"

If the user is asking for a revision or modification to the outline (e.g., add, remove, or rename chapters):
1. Update the outline based on the instruction.
2. Provide a brief reply explaining what you changed.

If the user is asking a question or asking for advice (and not explicitly asking to change the outline yet):
1. Provide a helpful answer or suggestion in the reply.
2. OMIT the 'updatedOutline' field entirely. Do NOT return an empty array.

Return ONLY a JSON object with:
- 'reply': Your message to the user. Use markdown formatting for readability (e.g., bolding, bullet points).
- 'updatedOutline': The full updated list of chapters as a JSON array (only if a change was made). Each chapter must have 'title' and 'description'. If no changes are made to the outline, do not include this field.
Do not include markdown formatting like \`\`\`json.`;

  const text = await callTextAI(prompt, true);
  return parseJSON(text || '{}');
}

export interface ChatResponse {
  reply: string;
  updatedContent?: string;
}

export interface ProofreadFeedback {
  feedback: string;
  suggestions: string[];
}

export async function proofreadChapter(
  content: string,
  chapterTitle: string,
  language: string
): Promise<ProofreadFeedback> {
  const prompt = `You are an expert book editor. Review the following chapter content and provide constructive feedback and specific suggestions for improvement.
  
Chapter Title: ${chapterTitle}
Language: ${language}

Content:
"""
${content}
"""

Return ONLY a JSON object with:
- 'feedback': A general paragraph of feedback on pacing, tone, and structure.
- 'suggestions': An array of specific, actionable suggestions (strings) to improve the text.
Do not include markdown formatting like \`\`\`json.`;

  // This will use the currently selected provider (e.g., OpenRouter)
  const text = await callTextAI(prompt, true);
  return parseJSON(text || '{}');
}

export async function applyProofreadChanges(
  content: string,
  feedback: ProofreadFeedback,
  chapterTitle: string,
  language: string
): Promise<string> {
  const prompt = `You are an expert book editor. Rewrite the following chapter content by incorporating the provided feedback and suggestions.

Chapter Title: ${chapterTitle}
Language: ${language}

Original Content:
"""
${content}
"""

Feedback to incorporate:
${feedback.feedback}

Specific Suggestions:
${feedback.suggestions.map(s => `- ${s}`).join('\n')}

Return ONLY the fully rewritten chapter content in markdown format. Do not include any conversational text or explanations.`;

  // Force Gemini for applying changes as requested: "采纳则调用原来的Gemini模型进行改动内容"
  const ai = getGeminiAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
  });
  return response.text || content;
}
export async function chatWithChapter(
  currentContent: string,
  instruction: string,
  chapterTitle: string,
  bookTitle: string,
  language: string
): Promise<ChatResponse> {
  const prompt = `You are a professional book editor and co-author.
  
Book Title: ${bookTitle}
Chapter Title: ${chapterTitle}
Language: ${language}

Current Chapter Content:
"""
${currentContent}
"""

User Instruction: "${instruction}"

If the user is asking for a revision or modification to the content:
1. Rewrite the content based on the instruction.
2. Provide a brief reply explaining what you changed.

If the user is asking a question or asking for advice (and not explicitly asking to change the text yet):
1. Provide a helpful answer or suggestion in the reply.
2. Do NOT provide updatedContent.

Return ONLY a JSON object with:
- 'reply': Your message to the user.
- 'updatedContent': The full updated chapter content (only if a change was made).
Do not include markdown formatting like \`\`\`json.`;

  const text = await callTextAI(prompt, true);
  return parseJSON(text || '{}');
}
