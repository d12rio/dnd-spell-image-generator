import fs from 'node:fs';

const fileName = 'spells-xphb';
const inputFileName = '/5etools-src-main/data/spells/' + fileName + '.json';
const outputFileName = 'figma/' + fileName + '.csv';

/**
 * Enhanced cleaning function to handle 5etools specific tags.
 * Added support for {@variantrule}, {@action}, {@skill}, {@sense}, {@book}, and {@chance}.
 */
function clean5etoolsText(text) {
    if (typeof text !== 'string') return '';
    
    return text
        // Standard tags: {@tag text|source|display} -> extracts "text"
        // This covers @spell, @creature, @condition, @damage, @scaledamage, @dice, @status, @race
        .replace(/\{@[\w]+ ([^|}]+)(?:\|[^}]*)?\}/g, '$1')
        
        // Handle specialized reference tags that might have different pipe structures
        .replace(/\{@variantrule (.*?)\}/g, (m, p1) => p1.split('|')[0])
        .replace(/\{@book (.*?)\}/g, (m, p1) => p1.split('|')[0])
        .replace(/\{@action (.*?)\}/g, (m, p1) => p1.split('|')[0])
        .replace(/\{@skill (.*?)\}/g, (m, p1) => p1.split('|')[0])
        .replace(/\{@sense (.*?)\}/g, (m, p1) => p1.split('|')[0])
        
        // Handle {@chance 33|||Failure|Success} -> "33%"
        .replace(/\{@chance (\d+)(?:\|[^}]*)?\}/g, '$1%')

        // Clean up markdown-style tags sometimes found in newer data
        .replace(/\{@b (.*?)\}/g, '**$1**')
        .replace(/\{@i (.*?)\}/g, '_$1_');
}

/**
 * Deep recursive parser to handle the hierarchical 5etools entry system.
 * Now handles 'table' types found in spells like 'Augury' or 'Reincarnate'.
 */
function parseEntries(entries) {
    if (!entries) return '';
    const entryArray = Array.isArray(entries) ? entries : [entries];
    
    return entryArray.map(entry => {
        if (typeof entry === 'string') return clean5etoolsText(entry);
        
        // Handle Tables (found in Augury, Reincarnate, etc.)
        if (entry.type === 'table') {
            const caption = entry.caption ? `**${entry.caption}**\n` : '';
            const labels = entry.colLabels ? `| ${entry.colLabels.join(' | ')} |\n| ${entry.colLabels.map(() => '---').join(' | ')} |\n` : '';
            const rows = entry.rows.map(row => `| ${row.map(cell => clean5etoolsText(cell)).join(' | ')} |`).join('\n');
            return `${caption}${labels}${rows}`;
        }

        // Handle Lists (Recursive for items with sub-entries)
        if (entry.type === 'list' && entry.items) {
            return entry.items.map(item => {
                if (typeof item === 'object') {
                    const itemName = item.name ? `**${clean5etoolsText(item.name)}**: ` : '';
                    const subContent = parseEntries(item.entries || item.items);
                    return `* ${itemName}${subContent}`;
                }
                return `* ${clean5etoolsText(item)}`;
            }).join('\n');
        }
        
        // Handle Sections/Sub-entries
        if (entry.entries) {
            const header = entry.name ? `**${clean5etoolsText(entry.name)}**: ` : '';
            return `${header}${parseEntries(entry.entries)}`;
        }
        
        return ''; 
    }).join('\n\n');
}

function slugify(text) {
    return text.toString().toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
}

function formatCSVCell(value) {
    const stringValue = (value === null || value === undefined) ? '' : String(value);
    return `"${stringValue.replace(/"/g, '""')}"`;
}

function extractSpells() {
    try {
        const rawData = fs.readFileSync(inputFileName, 'utf8');
        const jsonData = JSON.parse(rawData);
        const spells = jsonData.spell;

        const headers = ["Name", "Level", "Source", "Image", "Time_Number", "Time_Unit", "Distance_Type", "Distance_Amount", "Duration", "Ritual", "Concentration", "Description"].join(',');
        
        const rows = spells.map(spell => {
            const timeObj = spell.time?.[0] || {};
            const distObj = spell.range || {};
            const durObj = spell.duration?.[0] || {};

            const data = [
                spell.name,
                spell.level,
                spell.source,
                `${slugify(spell.name)}.png`,
                timeObj.number || '',
                timeObj.unit || '',
                distObj.distance?.type || distObj.type || '',
                distObj.distance?.amount || '',
                durObj.duration ? `${durObj.duration.amount} ${durObj.duration.type}` : (durObj.type || 'instant'),
                (spell.meta?.ritual) ? "Yes" : "No",
                (durObj.concentration) ? "Yes" : "No",
                parseEntries(spell.entries) + (spell.entriesHigherLevel ? `\n\n${parseEntries(spell.entriesHigherLevel)}` : '')
            ];
            
            return data.map(formatCSVCell).join(',');
        });

        fs.writeFileSync(outputFileName, [headers, ...rows].join('\n'));
        console.log(`Successfully processed ${spells.length} spells into ${outputFileName}`);

    } catch (error) {
        console.error("Critical Error:", error.message);
    }
}

extractSpells();