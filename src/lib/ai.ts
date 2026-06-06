import { GoogleGenAI, Type } from '@google/genai';
import { useStore } from '../store/useStore';
import i18n from '../i18n';

const handleAIError = (error: any, provider: string) => {
  console.error(`${provider} API Error:`, error);
  
  const status = error.status || (error.message?.match(/status: (\d+)/)?.[1]);
  const message = error.message?.toLowerCase() || '';

  if (status === '429' || message.includes('429') || message.includes('rate limit')) {
    return i18n.t('error_rate_limit');
  }
  if (status === '401' || message.includes('401') || message.includes('invalid api key') || message.includes('unauthorized')) {
    return i18n.t('error_invalid_key');
  }
  if (status === '404' || message.includes('404') || message.includes('not found')) {
    return i18n.t('error_model_not_found');
  }
  if (message.includes('quota') || message.includes('exhausted')) {
    return i18n.t('error_quota_exhausted');
  }
  if (message.includes('network') || message.includes('fetch') || message.includes('failed to fetch')) {
    return i18n.t('error_network');
  }

  return error.message || i18n.t('chat_error');
};

const getGeminiAi = () => {
  const apiKey = useStore.getState().geminiApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API Key is missing. Please set it in Settings.');
  }
  return new GoogleGenAI({ apiKey });
};

async function callTextAI(prompt: string, jsonMode: boolean = false): Promise<string> {
  const state = useStore.getState();
  const provider = state.textProvider || 'openrouter';

  if (provider === 'deepseek') {
    const apiKey = state.deepseekApiKey || process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error('DeepSeek API Key is missing. Please set it in Settings.');
    }
    const model = state.deepseekTextModel || 'deepseek-v4-flash';
    try {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: prompt }],
          response_format: jsonMode ? { type: 'json_object' } : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`DeepSeek API error: ${response.status} ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      return jsonMode ? content : stripMarkdownCodeBlocks(content);
    } catch (error: any) {
      throw new Error(handleAIError(error, 'DeepSeek'));
    }
  } else if (provider === 'openrouter') {
    const apiKey = state.openRouterApiKey || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OpenRouter API Key is missing. Please set it in Settings.');
    }
    const model = state.openRouterTextModel || 'google/gemma-4-31b-it:free';
    try {
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
      const content = data.choices?.[0]?.message?.content || '';
      return jsonMode ? content : stripMarkdownCodeBlocks(content);
    } catch (error: any) {
      throw new Error(handleAIError(error, 'OpenRouter'));
    }
  } else {
    // Gemini
    try {
      const ai = getGeminiAi();
      const config: any = {};
      if (jsonMode) {
        config.responseMimeType = 'application/json';
      }
      let model = state.geminiTextModel || 'gemini-3.5-flash';
      if (model === 'gemini-3.1-flash-preview' || model === 'gemini-3-flash-preview') {
        model = 'gemini-3.5-flash';
      }
      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: Object.keys(config).length > 0 ? config : undefined,
      });
      const content = response.text || '';
      return jsonMode ? content : stripMarkdownCodeBlocks(content);
    } catch (error: any) {
      throw new Error(handleAIError(error, 'Gemini'));
    }
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

function stripMarkdownCodeBlocks(text: string): string {
  const cleaned = text.trim();
  // If the entire text is wrapped in a markdown code block, remove it.
  const match = cleaned.match(/^```(?:markdown)?\s*([\s\S]*?)\s*```$/i);
  if (match) {
    return match[1].trim();
  }
  return cleaned;
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

export async function extractDesignThemeStyle(
  bookTitle: string,
  bookSummary: string,
  userInspirations: string,
  existingTheme: any | null = null,
  language: string = 'zh'
): Promise<any> {
  const existingStr = existingTheme 
    ? `\nExisting Style Guidelines to grow upon (you should maintain, evolve, and refine these instead of overwriting completely): ${JSON.stringify(existingTheme)}\n` 
    : '';
    
  const prompt = `You are a world-class book layout designer, typographer, and art director.
Extract or evolve a highly cohesive, professional design theme/style guideline for the book "${bookTitle}".
Book Summary: ${bookSummary}
User Intent / Inspiration / Material details provided: ${userInspirations}
${existingStr}

You must return a cohesive JSON object representing the design theme structure. Ensure:
1. "keywords": 3-5 concise, atmospheric style keywords (e.g. ["Classic Detective", "Nostalgic Vintage", "Chiaroscuro Silhouette"]).
2. "colors": A structured color palette:
   - "dominant": A dark/rich color hex code representing the main visual accent color of the design (not white).
   - "accent": A bright, high-contrast accent color hex code (e.g. for highlights, lines, or details).
   - "background": A soft, elegant paper/background hex code (e.g. warm ivory "#FBF9F4", vintage charcoal "#18181A", classic craft "#F2EADB").
   - "text": A high-contrast readable text color hex code matching the background color (e.g. deep charcoal "#1C1917" on light backgrounds, or ivory "#F5F5F4" on dark backgrounds).
3. "typography": Recommendations wrapping:
   - "headingFont": Elegant heading font character/vibe description.
   - "bodyFont": Readable body font character/vibe description.
   - "styleVibe": One cohesive style name (e.g., "Vintage Academic Monolith", "Minimalist Cyberpunk").
4. "illustrationStyle": A refined illustration style template/prompt. It must describe an artistic medium and aesthetics (textures, lighting, composition) suitable for image generator engines (like "stippling ink sketch, high-contrast chiaroscuro shadows, classic vintage gothic engraving, delicate paper textures").
5. "typesettingGuidelines": Specific, actionable book design/DTP advice (e.g., margins, line heights, drop caps enable, columns recommendation, drop caps suggestions).
6. "extractedGuidelines": A brief, highly refined editorial description (1-2 paragraphs) of this style model's design philosophy, detailing why these aesthetic configurations was chosen and how it pairs with the book's narrative.

Return ONLY a valid JSON object matching the structures shown below with no extra markdown blocks or conversational text.
{
  "keywords": ["..."],
  "colors": {
    "dominant": "#HEX",
    "accent": "#HEX",
    "background": "#HEX",
    "text": "#HEX"
  },
  "typography": {
    "headingFont": "...",
    "bodyFont": "...",
    "styleVibe": "..."
  },
  "illustrationStyle": "...",
  "typesettingGuidelines": "...",
  "extractedGuidelines": "..."
}`;

  const text = await callTextAI(prompt, true);
  return parseJSON(text || '{}');
}

export async function generateChapterContent(
  bookTitle: string,
  bookSummary: string,
  chapterTitle: string,
  chapterDescription: string,
  previousChapterContent: string | null,
  language: string,
  designTheme?: any
): Promise<string> {
  let prompt = `Write the content for a chapter of a book.
Book Title: ${bookTitle}
Book Summary: ${bookSummary}
Chapter Title: ${chapterTitle}
Chapter Description: ${chapterDescription}
Language: ${language}`;

  if (designTheme && designTheme.extractedGuidelines) {
    prompt += `\nCreative Tone and Aesthetic Direction to integrate: ${designTheme.extractedGuidelines}`;
  }

  prompt += `\n\nWrite engaging, well-structured content that fits the tone of the book. Use markdown formatting.`;

  if (previousChapterContent) {
    prompt += `\n\nFor context, here is the end of the previous chapter:\n${previousChapterContent.slice(-1000)}`;
  }

  return await callTextAI(prompt, false);
}

async function generateImageWithGemini(prompt: string): Promise<string | null> {
  const state = useStore.getState();
  try {
    const ai = getGeminiAi();
    const model = state.geminiImageModel || 'gemini-2.5-flash-image';
    const response = await ai.models.generateContent({
      model: model,
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
  } catch (error: any) {
    throw new Error(handleAIError(error, 'Gemini Image'));
  }
}

function extractImageFromObject(obj: any): string | null {
  if (!obj) return null;

  // 0. Direct, high-priority, bulletproof path for known OpenRouter chat completions & normal generations structures
  try {
    if (typeof obj === 'object') {
      // Look for standard chat completion formats
      const choices = obj.choices;
      if (Array.isArray(choices) && choices.length > 0) {
        const message = choices[0]?.message;
        if (message && typeof message === 'object') {
          // Check for message.images list (standard OpenRouter vision/image format like Seedream 4.5)
          const images = message.images;
          if (Array.isArray(images) && images.length > 0) {
            const firstImg = images[0];
            if (firstImg) {
              const url = typeof firstImg === 'string' ? firstImg : (firstImg.image_url?.url || firstImg.url || firstImg.image_url);
              if (url && typeof url === 'string') {
                const trimmed = url.trim();
                const clean = trimmed.replace(/[\s\r\n]+/g, '');
                if (clean.startsWith('data:image/') && clean.includes(';base64,')) {
                  console.log('Directly extracted base64 image from message.images in choices.');
                  return clean;
                }
                if (/^https?:\/\/[^\s"'()]+/i.test(trimmed)) {
                  console.log('Directly extracted HTTP/HTTPS image URL from message.images in choices.');
                  return trimmed;
                }
              }
            }
          }

          // Check for markdown image format or embedded image URL inside message.content
          const content = message.content;
          if (typeof content === 'string' && content.trim() !== '') {
            const markdownMatch = content.match(/!\[.*?\]\((.*?)\)/);
            if (markdownMatch && markdownMatch[1]) {
              console.log('Directly extracted markdown image URL from message.content.');
              return markdownMatch[1].trim();
            }
            const embeddedUrlMatch = content.match(/https?:\/\/[^\s"'()]+/i);
            if (embeddedUrlMatch && embeddedUrlMatch[0]) {
              const url = embeddedUrlMatch[0];
              const lowerUrl = url.toLowerCase();
              if (!lowerUrl.includes('openrouter.ai/schemas') && 
                  !lowerUrl.includes('schema.org') && 
                  !lowerUrl.includes('w3.org') &&
                  !lowerUrl.includes('openai.com/schemas')) {
                console.log('Directly extracted embedded image URL from message.content.');
                return url;
              }
            }
          }
        }
      }

      // Check if current level is message object or contains images array directly
      if (Array.isArray(obj.images) && obj.images.length > 0) {
        const firstImg = obj.images[0];
        if (firstImg) {
          const url = typeof firstImg === 'string' ? firstImg : (firstImg.image_url?.url || firstImg.url || firstImg.image_url);
          if (url && typeof url === 'string') {
            const trimmed = url.trim();
            const clean = trimmed.replace(/[\s\r\n]+/g, '');
            if (clean.startsWith('data:image/') && clean.includes(';base64,')) {
              console.log('Directly extracted base64 image from images array.');
              return clean;
            }
            if (/^https?:\/\/[^\s"'()]+/i.test(trimmed)) {
              console.log('Directly extracted HTTP/HTTPS image URL from images array.');
              return trimmed;
            }
          }
        }
      }

      // Check standard DALL-E format ({ data: [ { url: "..." } ] }) or similar generations format
      const dataArr = obj.data;
      if (Array.isArray(dataArr) && dataArr.length > 0) {
        const firstData = dataArr[0];
        if (firstData && typeof firstData === 'object') {
          const url = firstData.url || firstData.b64_json || firstData.b64Json || firstData.b64 || firstData.base64;
          if (url && typeof url === 'string') {
            const trimmed = url.trim();
            const clean = trimmed.replace(/[\s\r\n]+/g, '');
            if (clean.startsWith('data:image/') && clean.includes(';base64,')) {
              console.log('Directly extracted base64 image from standard generations data array.');
              return clean;
            }
            if (clean.length > 100 && /^[a-zA-Z0-9+/=_-]+$/.test(clean)) {
              console.log('Directly extracted raw base64 data from standard generations data array and wrapped it.');
              return `data:image/png;base64,${clean}`;
            }
            if (/^https?:\/\/[^\s"'()]+/i.test(trimmed)) {
              console.log('Directly extracted HTTP/HTTPS URL from standard generations data array.');
              return trimmed;
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('Error in high-priority direct image extraction:', err);
  }

  // 1. Fallback to generic string/regex parsers
  if (typeof obj === 'string') {
    const trimmed = obj.trim();
    
    // Check if it is a complete base64 image data URI (clearing internal whitespaces/newlines)
    const cleanDataUri = trimmed.replace(/[\s\r\n]+/g, '');
    if (cleanDataUri.startsWith('data:image/') && cleanDataUri.includes(';base64,')) {
      return cleanDataUri;
    }
    
    // Check if it is a raw base64 string without data:image/ scheme (sometimes models output raw base64)
    if (cleanDataUri.length > 100 && /^[a-zA-Z0-9+/=_-]+$/.test(cleanDataUri)) {
      return `data:image/png;base64,${cleanDataUri}`;
    }

    // Check if it is a direct HTTP/HTTPS URL
    if (/^https?:\/\/[^\s"'()]+/i.test(trimmed)) {
      const urlMatch = trimmed.match(/^https?:\/\/[^\s"'()]+/i);
      const url = urlMatch ? urlMatch[0] : trimmed;
      const lowerUrl = url.toLowerCase();
      if (!lowerUrl.includes('openrouter.ai/schemas') && 
          !lowerUrl.includes('schema.org') && 
          !lowerUrl.includes('w3.org') &&
          !lowerUrl.includes('openai.com/schemas')) {
        return url;
      }
    }

    // Check if it contains markdown image syntax
    const markdownMatch = trimmed.match(/!\[.*?\]\((.*?)\)/);
    if (markdownMatch && markdownMatch[1]) {
      return markdownMatch[1].trim();
    }

    // Check if it has a plain URL embedded in some text
    const embeddedUrlMatch = trimmed.match(/https?:\/\/[^\s"'()]+/i);
    if (embeddedUrlMatch && embeddedUrlMatch[0]) {
      const url = embeddedUrlMatch[0];
      const lowerUrl = url.toLowerCase();
      if (!lowerUrl.includes('openrouter.ai/schemas') && 
          !lowerUrl.includes('schema.org') && 
          !lowerUrl.includes('w3.org') &&
          !lowerUrl.includes('openai.com/schemas')) {
        return url;
      }
    }

    // Check if it is a JSON string
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        const parsed = JSON.parse(trimmed);
        const res = extractImageFromObject(parsed);
        if (res) return res;
      } catch (e) {
        // Ignore JSON parse errors
      }
    }

    return null;
  }

  // 2. If it's an array, search every item recursively
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const res = extractImageFromObject(item);
      if (res) return res;
    }
    return null;
  }

  // 3. Fallback to recursive object search based on key priorities
  if (typeof obj === 'object') {
    const priorityKeys = [
      'url', 
      'image_url', 
      'imageUrl',
      'image', 
      'uri',
      'imageUri',
      'src',
      'imageSrc',
      'link',
      'asset',
      'b64_json', 
      'b64Json',
      'b64', 
      'base64', 
      'imageData',
      'output', 
      'img', 
      'file', 
      'data', 
      'images', 
      'content',
      'result',
      'results'
    ];

    for (const key of priorityKeys) {
      if (key in obj && obj[key] !== undefined && obj[key] !== null) {
        const res = extractImageFromObject(obj[key]);
        if (res) return res;
      }
    }

    // Fallback: search all other keys recursively
    for (const key in obj) {
      if (!priorityKeys.includes(key) && obj[key] !== undefined && obj[key] !== null) {
        const res = extractImageFromObject(obj[key]);
        if (res) return res;
      }
    }
  }

  return null;
}

export async function generateImage(prompt: string): Promise<string | null> {
  const state = useStore.getState();
  const provider = state.imageProvider || 'gemini';
  
  if (provider === 'openrouter') {
    const apiKey = state.openRouterApiKey || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      // Fallback if OpenRouter Key is missing
      const geminiApiKey = state.geminiApiKey || process.env.GEMINI_API_KEY;
      if (geminiApiKey) {
        console.warn('OpenRouter API key not found. Querying Gemini as fallback image generator.');
        return await generateImageWithGemini(prompt);
      }
      throw new Error('OpenRouter API key is not set. Please configure it in Settings.');
    }
    const model = state.openRouterImageModel || 'google/gemini-3.1-flash-image-preview';
    
    // First attempt: Standard image generation endpoint (/images/generations)
    try {
      console.log(`Sending image request to OpenRouter /images/generations for model ${model}...`);
      const response = await fetch('https://openrouter.ai/api/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'AI Book Writer',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          prompt: prompt
        })
      });

      const data = await response.json().catch(() => null);
      console.log('OpenRouter /images/generations raw API response object:', data);

      if (data && data.error) {
        const errMsg = data.error.message || JSON.stringify(data.error);
        throw new Error(`OpenRouter image generate error: ${errMsg}`);
      }

      if (response.ok && data) {
        // Use our super-robust extractor for the standard endpoint data structure as well!
        const extracted = extractImageFromObject(data);
        if (extracted) {
          console.log('Successfully extracted image from /images/generations response.');
          return extracted;
        }
      }
    } catch (e: any) {
      console.warn('OpenRouter image generation endpoint failed, trying chat fallback...', e);
    }

    // Second attempt: Fallback to chat completions endpoint (/chat/completions)
    try {
      console.log(`Sending fallback image request to OpenRouter /chat/completions for model ${model}...`);
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'AI Book Writer',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'user', content: prompt }
          ]
        })
      });

      const data = await response.json().catch(() => ({}));
      console.log('OpenRouter /chat/completions raw API response object:', data);

      if (data.error) {
        throw new Error(data.error.message || JSON.stringify(data.error));
      }

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      // Try fully robust search of entire payload object first
      const extracted = extractImageFromObject(data);
      if (extracted) {
        console.log('Successfully extracted image from /chat/completions fallback response.');
        return extracted;
      }

      // Fallback directly to Gemini if parsing yielded no valid URL
      const geminiApiKey = state.geminiApiKey || process.env.GEMINI_API_KEY;
      if (geminiApiKey) {
        console.warn('Could not extract image URL from OpenRouter content. Falling back to Gemini.');
        return await generateImageWithGemini(prompt);
      }

      const content = data.choices?.[0]?.message?.content || '';
      const jsonSnippet = JSON.stringify(data);
      const responseSnippet = typeof content === 'string' && content.trim() !== ''
        ? (content.substring(0, 500) + (content.length > 500 ? '...' : '')) 
        : (jsonSnippet.substring(0, 1000) + (jsonSnippet.length > 1000 ? '...' : ''));

      throw new Error(`Could not extract image URL from OpenRouter response. Response content: "${responseSnippet}"`);
    } catch (error: any) {
      // Automatic fallback to Gemini if OpenRouter overall failed and we have a Gemini Key
      const geminiApiKey = state.geminiApiKey || process.env.GEMINI_API_KEY;
      if (geminiApiKey) {
        console.warn('OpenRouter image generation failed. Performing automatic fallback to Gemini...', error);
        try {
          return await generateImageWithGemini(prompt);
        } catch (geminiError) {
          // If fallback fails, throw the original OpenRouter error
          throw new Error(handleAIError(error, 'OpenRouter Image'));
        }
      }
      throw new Error(handleAIError(error, 'OpenRouter Image'));
    }
  }
  return await generateImageWithGemini(prompt);
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
  try {
    const ai = getGeminiAi();
    const state = useStore.getState();
    let model = state.geminiTextModel || 'gemini-3.5-flash';
    if (model === 'gemini-3.1-flash-preview' || model === 'gemini-3-flash-preview') {
      model = 'gemini-3.5-flash';
    }
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });
    return stripMarkdownCodeBlocks(response.text || content);
  } catch (error: any) {
    throw new Error(handleAIError(error, 'Gemini Proofread Apply'));
  }
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
  const result = parseJSON(text || '{}');
  if (result.updatedContent) {
    result.updatedContent = stripMarkdownCodeBlocks(result.updatedContent);
  }
  return result;
}

export async function extractMasterDesignerProfile(
  promptDescription: string,
  language: string = 'zh'
): Promise<any> {
  const prompt = `You are an expert design historian and book layout researcher.
Analyze the following user prompt requesting to create a custom/new Master Designer or design movement style profile.
Description provided: ${promptDescription}

Create a cohesive, highly structured Master Style profile JSON package. You must return a single JSON object with EXACTLY the following structure:
{
  "name": "Full Name in English",
  "nameZh": "Full Name in Chinese (or same as English if not translatable)",
  "vibe": "3-4 word phrase representing the design school / movement (e.g. Traditional Japanese Wabi-Sabi, Leipzig Traditional Novel, Chicago Bauhaus Neo-modern)",
  "quote": "An inspirational custom-synthesized quote representing their visual philosophy (e.g. 'Symmetry is a quiet river; the page is its banks.')",
  "colors": {
    "dominant": "#HEX (a rich accent color)",
    "accent": "#HEX (a sharp highlight color)",
    "background": "#HEX (a soft, elegant paper bg color like warm cream or charcoal)",
    "text": "#HEX (a highly readable contrast text color)"
  },
  "typography": {
    "headingFont": "Description/vibe of recommended heading typography (e.g., 'Heavy Slab Serif', 'Geometric Sans-Serif Space')",
    "bodyFont": "Description/vibe of recommended body copy typography (e.g., 'Elegant Renaissance Garamond Garamond')",
    "styleVibe": "A concise style genre descriptor"
  },
  "illustrationStyle": "A detailed, descriptive illustration prompt style constraint (e.g., 'minimal single-line vector hand sketch, organic warm grainy watercolor offsets, natural sepia vellum raw textures')",
  "typesettingGuidelines": "Actionable, precise typesetting/DTP recommendations (e.g., opening margins should be at least 60px, first-line indent set to 2em, columns set to 1, paragraphs to justified)",
  "extractedGuidelines": "A beautiful, evocative 1-2 paragraph editorial synthesis of this custom master's core aesthetics and decorative logic, detailing how it elevates slow reading."
}

Return ONLY the valid JSON object with NO markdown markup or container blocks.`;

  const text = await callTextAI(prompt, true);
  return parseJSON(text || '{}');
}

export async function parseAndAnalyzeLayoutFromIntent(
  layoutReferenceDescription: string,
  language: string = 'zh'
): Promise<any> {
  const prompt = `You are a professional typesetter, layout editor, and grid structure architect.
Analyze the following description of a page layout or reference layout pattern.
Description: ${layoutReferenceDescription}

Abstract this into a clean, modern, structural Typeset Layout Template configured with exact layout variables.
Return exactly a structured JSON object with the following properties:
{
  "name": "Descriptive, elegant template name (e.g., 'Asymmetric Editorial columns', 'Medieval Manuscript Margin Grid')",
  "headerPos": "one of: 'hidden' | 'top-center' | 'top-outside' | 'bottom-center' | 'bottom-outside'",
  "columns": "1, 2, or 3 (numeric)",
  "paperStyle": "one of: 'warm' | 'white' | 'dark' | 'kraft' | 'vintage' | 'glossy' | 'newsprint'",
  "fontSize": "numeric (e.g. 14, 15, 16, 17, 18)",
  "lineHeight": "numeric (e.g. 1.5, 1.6, 1.7, 1.8)",
  "marginTop": "numeric in pixels (e.g. 36, 48, 64, 80)",
  "marginBottom": "numeric in pixels (e.g. 36, 48, 64, 80)",
  "marginLeft": "numeric in pixels (e.g. 36, 48, 64, 80)",
  "marginRight": "numeric in pixels (e.g. 36, 48, 64, 80)",
  "format": "one of: 'a4' | 'letter' | 'trade' | 'pocket' | 'landscape' | 'square'",
  "chapterTitleStyle": "one of: 'hidden' | 'classical' | 'modern' | 'minimal'",
  "sceneBreakStyle": "one of: 'asterism' | 'dots' | 'line' | 'space'",
  "dropCaps": "boolean (true or false)",
  "justifyText": "boolean (true or false)",
  "firstLineIndent": "numeric in scale (0, 1, or 2 representing indent tabs)",
  "paragraphSpacing": "numeric (e.g. 8, 12, 16, 20)",
  "visualExplanation": "An organic, architectural briefing (1-2 sentences) of how this geometric wireframe maps columns, spacing, and image alignment to achieve perfect balance."
}

Return ONLY the valid JSON object with no wrapping blocks.`;

  const text = await callTextAI(prompt, true);
  return parseJSON(text || '{}');
}
