require('dotenv').config();
const express = require('express');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL
});

app.use(express.json());
app.use(express.static(__dirname));

const SYSTEM_PROMPT = `You are a sentence splitting tool for English dictation practice.

For each input sentence:
1. If the sentence has 5 or fewer words, return it as-is in the array.
2. If the sentence has more than 5 words, split it into smaller clauses or phrases that are:
   - Grammatically complete
   - Easy to practice (2-5 words each)
   - Return ALL parts as an array of strings

Rules:
- Keep punctuation with the words it belongs to
- Preserve apostrophes in contractions
- Split on conjunctions (and, but, or), relative pronouns (who, which, that), or commas
- Return a JSON array of strings
- Do NOT add any additional text or explanation

Example:
Input: "The quick brown fox jumps over the lazy dog"
Output: ["The quick brown fox", "jumps over the lazy dog"]

Input: "Hello world"
Output: ["Hello world"]`;

app.post('/api/split-sentences', async (req, res) => {
    try {
        const { sentences } = req.body;

        if (!sentences || !Array.isArray(sentences)) {
            return res.status(400).json({ error: 'Invalid request: sentences array required' });
        }

        const allPracticeUnits = [];

        for (const sentence of sentences) {
            const wordCount = sentence.trim().split(/\s+/).length;

            if (wordCount <= 5) {
                allPracticeUnits.push(sentence);
            } else {
                console.log(`Splitting sentence: ${sentence}`);
                const response = await openai.chat.completions.create({
                    model: process.env.MODEL_NAME || 'gpt-3.5-turbo',
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: `Split this sentence for dictation practice:\n"${sentence}"` }
                    ],
                    temperature: 0.3,
                    max_tokens: 500
                });


                function extractJSONArray(text) {
                    const match = text.match(/\[[\s\S]*\]/)
                    if (!match) return null
                    return JSON.parse(match[0])
                }

                const ret = response.choices[0]?.message?.content;

                console.log("=============")
                console.log(`LLM Response: ${ret}`);

                // remove content
                // <think>*123132</think> [1,2,3] => [1,2,3]
                const content = ret ? extractJSONArray(ret) : null;

                console.log(`Cleaned Content: ${content}`);
                console.log("=============")

                if (content) {
                    try {
                        const parts = JSON.parse(content);
                        if (Array.isArray(parts)) {
                            allPracticeUnits.push(...parts);
                        } else {
                            allPracticeUnits.push(sentence);
                        }
                    } catch (parseError) {
                        console.error('Failed to parse LLM response:', content);
                        allPracticeUnits.push(sentence);
                    }
                } else {
                    allPracticeUnits.push(sentence);
                }
            }
        }

        res.json({ sentences: allPracticeUnits });
    } catch (error) {
        console.error('Error splitting sentences:', error);
        res.status(500).json({ error: 'Failed to process sentences' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
