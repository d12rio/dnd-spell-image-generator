import fs from 'node:fs';
import path from 'node:path';
import csv from 'csv-parser';
import { GoogleGenAI } from '@google/genai';

// 1. Configuration
const API_KEY = 'XYZ';
const ai = new GoogleGenAI({ apiKey: API_KEY });
const CSV_FILE_PATH = 'prompts-all.csv';
const OUTPUT_BASE_DIR = './generated_images';

// Ensure base output directory exists
if (!fs.existsSync(OUTPUT_BASE_DIR)) {
    fs.mkdirSync(OUTPUT_BASE_DIR, { recursive: true });
}

async function generateAndSaveImage(prompt, slug) {
    const targetDir = path.join(OUTPUT_BASE_DIR);
    
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    try {
        console.log(`🎨 Generating: [${slug}]...`);
        
        // Call the image-capable model
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview', // The "Nano Banana" model
            contents: prompt,
        });

        // Loop through parts to find the image data
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                const buffer = Buffer.from(part.inlineData.data, 'base64');
                const filePath = path.join(targetDir, `${slug}.png`);
                
                fs.writeFileSync(filePath, buffer);
                console.log(`✅ Saved: ${filePath}`);
            } else if (part.text) {
                // Sometimes the model provides feedback text along with the image
                console.log(`Model Feedback: ${part.text}`);
            }
        }
    } catch (error) {
        console.error(`❌ Error for ${slug}:`, error.message);
    }
}

// 2. CSV Processing Logic
const rows = [];
fs.createReadStream(CSV_FILE_PATH)
    .pipe(csv())
    .on('data', (data) => rows.push(data))
    .on('end', async () => {
        console.log(`CSV Loaded. Processing ${rows.length} items...`);
        
        for (const row of rows) {
            if (row.Prompt && row.Slug) {
                await generateAndSaveImage(row.Prompt, row.Slug);
                // Respect rate limits - wait 2 seconds between generations
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        console.log('🏁 All tasks complete.');
    });
