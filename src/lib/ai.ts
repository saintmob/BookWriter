import { GoogleGenAI, Type } from '@google/genai';
import { useStore } from '../store/useStore';

const getAi = () => {
  const apiKey = useStore.getState().geminiApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API Key is missing. Please set it in Settings.');
  }
  return new GoogleGenAI({ apiKey });
};

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
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Based on the following idea, generate 3 distinct book proposals.
    Idea: ${idea}
    Language: ${language}
    
    Return a JSON array of 3 objects, each with 'title', 'concept', 'targetAudience', and 'tone'.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            concept: { type: Type.STRING },
            targetAudience: { type: Type.STRING },
            tone: { type: Type.STRING },
          },
          required: ['title', 'concept', 'targetAudience', 'tone'],
        },
      },
    },
  });

  return parseJSON(response.text || '[]');
}

export async function generateOutline(proposal: Proposal, language: string): Promise<Outline> {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Based on the following book proposal, generate a detailed summary and a chapter-by-chapter outline.
    Title: ${proposal.title}
    Concept: ${proposal.concept}
    Target Audience: ${proposal.targetAudience}
    Tone: ${proposal.tone}
    Language: ${language}
    
    Return a JSON object with 'summary' (a comprehensive overview of the book) and 'chapters' (an array of objects with 'title' and 'description').`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          chapters: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
              },
              required: ['title', 'description'],
            },
          },
        },
        required: ['summary', 'chapters'],
      },
    },
  });

  return parseJSON(response.text || '{}');
}

export async function generateChapterContent(
  bookTitle: string,
  bookSummary: string,
  chapterTitle: string,
  chapterDescription: string,
  previousChapterContent: string | null,
  language: string
): Promise<string> {
  const ai = getAi();
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

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
  });

  return response.text || '';
}

export async function generateImage(prompt: string): Promise<string | null> {
  const ai = getAi();
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

export async function updateOutlineWithAI(
  currentChapters: { title: string; description: string }[],
  instruction: string,
  bookTitle: string,
  bookSummary: string,
  language: string
): Promise<{ title: string; description: string }[]> {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `You are a professional book editor. Help me revise the book outline based on the user's instruction.
    
    Book Title: ${bookTitle}
    Book Summary: ${bookSummary}
    Language: ${language}
    
    Current Chapters:
    ${JSON.stringify(currentChapters, null, 2)}
    
    User Instruction: "${instruction}"
    
    Return the UPDATED list of chapters as a JSON array. Each chapter must have 'title' and 'description'.
    Maintain the existing structure unless the user explicitly asks to change it.
    Do not return any other text, just the JSON array.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
          },
          required: ['title', 'description'],
        },
      },
    },
  });

  return parseJSON(response.text || '[]');
}

export interface ChatResponse {
  reply: string;
  updatedContent?: string;
}

export async function chatWithChapter(
  currentContent: string,
  instruction: string,
  chapterTitle: string,
  bookTitle: string,
  language: string
): Promise<ChatResponse> {
  const ai = getAi();
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
  
  Return a JSON object with:
  - 'reply': Your message to the user.
  - 'updatedContent': The full updated chapter content (only if a change was made).
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          reply: { type: Type.STRING },
          updatedContent: { type: Type.STRING },
        },
        required: ['reply'],
      },
    },
  });

  return parseJSON(response.text || '{}');
}
