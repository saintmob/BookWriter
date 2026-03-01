import { GoogleGenAI, Type } from '@google/genai';

export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
