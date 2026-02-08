import fs from 'node:fs';
import path from 'node:path';
import csv from 'csv-parser';
import { GoogleGenAI } from '@google/genai';

// 1. Configuration
const API_KEY = 'XYZ';
const ai = new GoogleGenAI({ apiKey: API_KEY });
const CSV_FILE_NAME = 'spells-xphb';
const CSV_FILE_PATH = CSV_FILE_NAME + '.csv';
const OUTPUT_BASE_DIR = './generated_images/' + CSV_FILE_NAME;

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
            // model: 'gemini-2.5-flash-image',
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
            var prompt = `You're a fantasy Art designer that got a customer who wants to get the Art pieces for their Trading card game. You will only focus on the main art. We're going for that "Concept Art" aesthetic—think raw, expressive watercolor (aquarelle) bleeds met with sharp, architectural ink lines and graphite grit. It’s a high-contrast look that pops beautifully. if there are colors the main color should be intense and vibrant. You will receive the name, intensity and need to create the perfect art that can be used on a card for print. The Art needs to be full size no borders whatsoever filling a 1024x1024. I’ve locked in your specific constraint: zero text, words, or letters on the artwork. My focus is purely on the visual narrative and the raw grit of the medium.`
            if (row.Title && row.Slug) {
                var level = row.Level == 'C' ? 0 : row.Level;
                prompt += ' Name: ' + row.Title + ' and Intensity is: ' + level + ' of out 9.';
                await generateAndSaveImage(prompt, row.Slug);
                // Respect rate limits - wait 2 seconds between generations
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        console.log('🏁 All tasks complete.');
    });
