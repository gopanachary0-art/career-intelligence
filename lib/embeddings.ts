import { embeddingModel, getOpenAI } from "./openai";

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const openai = getOpenAI();
  const response = await openai.embeddings.create({
    model: embeddingModel(),
    input: texts.map((t) => t.replace(/\s+/g, " ").trim()),
  });

  return response.data
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
}

export async function embedQuery(query: string): Promise<number[]> {
  const [embedding] = await embedTexts([query]);
  return embedding;
}
