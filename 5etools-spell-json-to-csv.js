import fs from 'node:fs';

// Configuration: Change these filenames as needed
const inputFileName = '/5etools-src-main/data/spells/spells-tce.json';
const outputFileName = 'spells-tce.csv';

/**
 * Escapes characters that would break CSV formatting.
 * 1. Wraps the value in double quotes.
 * 2. Doubles up any internal double quotes.
 */
function formatCSVCell(value) {
    const stringValue = String(value);
    if (stringValue.includes('"') || stringValue.includes(',') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
}

/**
 * Cleans 5etools tags like {@damage 1d6} or {@spell fireball|phb}
 * Extracts the primary text and removes the tag syntax.
 */
function clean5etoolsText(text) {
    if (typeof text !== 'string') return '';
    
    return text
        // Handle tags like {@tag text|source|etc} -> extracts "text"
        .replace(/\{@[\w]+ ([^|}]+)(?:\|[^}]*)?\}/g, '$1')
        .replace(/\{@b (.*?)\}/g, '**$1**')
        .replace(/\{@i (.*?)\}/g, '_$1_');
}

/**
 * Recursively parses entry arrays into Markdown.
 */
function parseEntries(entries) {
    if (!entries || !Array.isArray(entries)) return '';
    
    return entries.map(entry => {
        if (typeof entry === 'string') {
            return clean5etoolsText(entry);
        }
        
        // Handle lists (common in 5etools entries)
        if (entry.type === 'list' && entry.items) {
            return entry.items.map(i => `* ${clean5etoolsText(i)}`).join('\n');
        }
        
        // Handle nested entries with headers
        if (entry.entries) {
            const header = entry.name ? `**${entry.name}**: ` : '';
            return `${header}${parseEntries(entry.entries)}`;
        }
        
        return ''; 
    }).join('\n\n');
}

/**
 * Converts a string into a URL/file-friendly slug.
 * Example: "Melf's Acid Arrow" -> "melfs-acid-arrow"
 */
function slugify(text) {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')           // Replace spaces with -
        .replace(/[^\w\-]+/g, '')       // Remove all non-word chars (except -)
        .replace(/\-\-+/g, '-')         // Replace multiple - with single -
        .replace(/^-+/, '')             // Trim - from start
        .replace(/-+$/, '');            // Trim - from end
}

function extractSpells() {
    try {
        const rawData = fs.readFileSync(inputFileName, 'utf8');
        const jsonData = JSON.parse(rawData);
        const spells = jsonData.spell;

        const headers = ["Title", "Level", "Slug", "Description"].join(',');
        
        const rows = spells.map(spell => {
            // 1. Get main description
            let fullDescription = parseEntries(spell.entries);

            // 2. Append Higher Level entries if they exist
            if (spell.entriesHigherLevel) {
                const higherLevelText = parseEntries(spell.entriesHigherLevel);
                if (higherLevelText) {
                    fullDescription += `\n\n${higherLevelText}`;
                }
            }

            const title = formatCSVCell(spell.name);
            const level = formatCSVCell(spell.level);
            const slug = formatCSVCell(slugify(spell.name));
            const description = formatCSVCell(fullDescription);
            
            return `${title},${level},${slug},${description}`;
        });

        const csvContent = [headers, ...rows].join('\n');
        fs.writeFileSync(outputFileName, csvContent);
        console.log(`Success! Data including "Higher Levels" exported to ${outputFileName}`);

    } catch (error) {
        console.error("Error:", error.message);
    }
}

extractSpells();