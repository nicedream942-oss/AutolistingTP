// background.js (v4.2 - Fixed Random Delay Implementation)

// --- Variabel State Global ---
let isProcessing = false;
let isAutoflow = false;
let currentTabId = null;
let autoflowCount = 0;
let currentAutoflowIndex = 0;
let nextMetadataPromise = null;

const FORBIDDEN_KEYWORDS = ["vector", "png", "illustration", "teepublic"];

const VALID_COLORS = {
    tshirt: ["White", "Asphalt", "Black", "Maroon", "Red", "Soft Pink", "Hot Pink", "Brown", "Yellow", "Creme", "Kelly", "Navy", "Royal Blue", "Light Blue", "Purple", "Heather"],
    hoodie: ["Oatmeal Heather", "Sport Green", "Black", "Burgundy", "Creme", "Navy", "Colony Blue", "Vintage Heather", "Charcoal Heather"],
    tank: ["White", "Black", "Red", "Navy"],
    crewneck: ["White", "Black", "Dark Green", "Navy", "Royal Blue", "Heather", "Charcoal Heather"],
    longsleeve: ["White", "Black", "Red", "Dark Green", "Navy", "Royal Blue", "Light Blue", "Heather"],
    baseball: ["Black/White", "White/Black", "White/Royal", "White/Red", "White/Kelly", "White/Navy"],
    kids_tshirt: ["White", "Asphalt", "Black", "Red", "Soft Pink", "Orange", "Tennessee Orange", "Yellow", "Grass", "Navy", "Royal Blue", "Coastal Blue", "Light Blue", "Heather"],
    kids_hoodie: ["Black", "Navy", "Red Heather", "Vintage Royal"],
    kids_longsleeve: ["Black", "Navy", "Deep Royal"]
};

// --- Setup Awal ---
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(error => console.error(error));

// --- Penangan Pesan Utama ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case "startGeneration":
            isAutoflow = request.isAutoflow;
            autoflowCount = request.count || 1;
            currentAutoflowIndex = 0;
            nextMetadataPromise = null;
            chrome.runtime.sendMessage({ action: "flowStarted", isAutoflow: isAutoflow });
            startProcess(request.customMainTag, request.suggestionTag);
            break;

        case "stopProcess":
            stopFlow("Proses dihentikan oleh pengguna.");
            break;
    }
    return true;
});

// --- Fungsi Inti Workflow ---
async function startProcess(customMainTag = null, suggestionTag = null) {
    if (isProcessing) {
        logToPanel("Peringatan: Proses lain sedang berjalan.");
        return;
    }
    isProcessing = true;
    currentAutoflowIndex++;

    logToPanel(isAutoflow ? `--- Memproses Desain ${currentAutoflowIndex}/${autoflowCount} ---` : "--- Memulai Proses Tunggal ---");

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url) throw new Error("Tidak dapat mengakses tab aktif.");
        currentTabId = tab.id;
        
        const url = new URL(tab.url);
        if (!url.hostname.includes("teepublic.com") || !url.pathname.includes("/designs/")) {
            throw new Error("Buka halaman upload atau edit desain Teepublic untuk memulai.");
        }
        
        await chrome.scripting.executeScript({ target: { tabId: currentTabId }, files: ['content_script.js'] });

        let metadata;
        if (nextMetadataPromise) {
            logToPanel("Menggunakan metadata yang sudah disiapkan...");
            metadata = await nextMetadataPromise;
            nextMetadataPromise = null;
        } else {
            logToPanel("Mencari gambar desain...");
            const imageInfo = await chrome.tabs.sendMessage(currentTabId, { action: "findActiveImage" });
            if (imageInfo.status === 'ERROR') throw new Error(imageInfo.message);
            logToPanel(`Gambar ditemukan. Menampilkan preview...`);
            await chrome.runtime.sendMessage({ action: "displayImagePreview", imageUrl: imageInfo.imageUrl });
            logToPanel(`Membuat metadata dari AI...`);
            metadata = await generateMetadata(imageInfo.base64Data, customMainTag, suggestionTag);
        }

        if (!metadata) throw new Error("Gagal membuat metadata dari AI.");
        
        validateAndSetDefaultColors(metadata);
        
        metadata.title = filterForbiddenWords(metadata.title, 'title');
        metadata.main_tag = filterForbiddenWords(metadata.main_tag, 'main_tag');
        metadata.supporting_tags = filterForbiddenWords(metadata.supporting_tags, 'supporting_tags');

        const settings = await chrome.storage.sync.get([
            'teepublicTshirtColor', 'teepublicHoodieColor', 'teepublicTankColor', 'teepublicCrewneckColor',
            'teepublicLongsleeveColor', 'teepublicBaseballColor', 'teepublicMatureContent',
            'teepublicProductColors', 'teepublicAutoPublish', 'teepublicEnableKids',
            'teepublicKidsTshirtColor', 'teepublicKidsHoodieColor', 'teepublicKidsLongsleeveColor'
        ]);

        if (settings.teepublicTshirtColor !== 'AI_DECIDE') metadata.colors.tshirt = settings.teepublicTshirtColor;
        if (settings.teepublicHoodieColor !== 'AI_DECIDE') metadata.colors.hoodie = settings.teepublicHoodieColor;
        if (settings.teepublicTankColor !== 'AI_DECIDE') metadata.colors.tank = settings.teepublicTankColor;
        if (settings.teepublicCrewneckColor !== 'AI_DECIDE') metadata.colors.crewneck = settings.teepublicCrewneckColor;
        if (settings.teepublicLongsleeveColor !== 'AI_DECIDE') metadata.colors.longsleeve = settings.teepublicLongsleeveColor;
        if (settings.teepublicBaseballColor !== 'AI_DECIDE') metadata.colors.baseball = settings.teepublicBaseballColor;

        if (settings.teepublicEnableKids === 'true') {
            if (settings.teepublicKidsTshirtColor !== 'AI_DECIDE') metadata.colors.kids_tshirt = settings.teepublicKidsTshirtColor;
            if (settings.teepublicKidsHoodieColor !== 'AI_DECIDE') metadata.colors.kids_hoodie = settings.teepublicKidsHoodieColor;
            if (settings.teepublicKidsLongsleeveColor !== 'AI_DECIDE') metadata.colors.kids_longsleeve = settings.teepublicKidsLongsleeveColor;
        }
        
        validateAndSetDefaultColors(metadata);
        
        logToPanel(`Mengisi formulir di Teepublic...`);
        const fillResponse = await chrome.tabs.sendMessage(currentTabId, { action: "fillTeepublicForm", formData: { metadata, settings } });
        if (fillResponse && fillResponse.status === 'ERROR') throw new Error(fillResponse.message);
        logToPanel(`Formulir berhasil diisi.`);

        isProcessing = false;

        // --- AUTOFLOW CONTROL LOGIC WITH RANDOM DELAY FIX ---
        if (isAutoflow && currentAutoflowIndex < autoflowCount) {
            logToPanel(`Proses untuk desain ${currentAutoflowIndex} selesai. Menyiapkan desain berikutnya...`);
            
            const nextImageInfo = await chrome.tabs.sendMessage(currentTabId, { action: "findNextImage" });
            if (nextImageInfo.status === 'SUCCESS' && nextImageInfo.base64Data) {
                logToPanel("Gambar berikutnya ditemukan. Memulai proses AI di latar belakang...");
                nextMetadataPromise = generateMetadata(nextImageInfo.base64Data, customMainTag, suggestionTag);
            }

            const navigationPromise = new Promise(resolve => {
                const listener = (tabId, changeInfo, tab) => {
                    if (tabId === currentTabId && changeInfo.status === 'complete' && tab.url.includes('/designs/')) {
                        chrome.tabs.onUpdated.removeListener(listener);
                        resolve();
                    }
                };
                chrome.tabs.onUpdated.addListener(listener);
            });

            logToPanel("Pindah ke halaman berikutnya...");
            await chrome.tabs.sendMessage(currentTabId, { action: "goToNextDesign" });
            await navigationPromise;

            // FIXED RANDOM DELAY IMPLEMENTATION
            const { autoflowDelay } = await chrome.storage.sync.get('autoflowDelay');
            let delayInSeconds;

            console.log("Autoflow delay value:", autoflowDelay); // Debug log

            if (autoflowDelay === 'random') {
                // Generate random delay between 5-10 seconds
                delayInSeconds = Math.floor(Math.random() * 6) + 5; // 5-10 seconds
                logToPanel(`Delay acak: ${delayInSeconds} detik`);
            } else {
                // Convert string to number for fixed delays
                delayInSeconds = parseInt(autoflowDelay) || 5;
                logToPanel(`Delay tetap: ${delayInSeconds} detik`);
            }

            if (delayInSeconds > 0) {
                logToPanel(`Menunggu ${delayInSeconds} detik sebelum melanjutkan...`);
                await new Promise(resolve => setTimeout(resolve, delayInSeconds * 1000));
            }
            
            startProcess(customMainTag, suggestionTag);

        } else if (isAutoflow) {
            if (settings.teepublicAutoPublish === 'true') {
                logToPanel("Autoflow selesai. Mempublikasikan semua desain...");
                const publishResponse = await chrome.tabs.sendMessage(currentTabId, { action: "publishDesigns" });
                if (publishResponse.status === 'ERROR') throw new Error(publishResponse.message);
                stopFlow("Semua desain telah berhasil dipublikasikan.");
            } else {
                stopFlow("Proses Autoflow selesai. Anda dapat mempublikasikan secara manual.");
            }
        } else {
            stopFlow("Proses tunggal selesai dengan sukses.");
        }

    } catch (error) {
        const errorMessage = error.message.includes("Could not establish connection")
            ? "Gagal terhubung ke halaman. Coba refresh halaman."
            : error.message;
        stopFlow(`PROSES GAGAL: ${errorMessage}`);
    }
}

// --- AI & Pembuatan Metadata ---
async function generateMetadata(base64Data, customMainTag = null, suggestionTag = null) {
    const { avoidCopyright, supportingTagsCount, descriptionLength } = await chrome.storage.sync.get(['avoidCopyright', 'supportingTagsCount', 'descriptionLength']);
    const tagsCount = supportingTagsCount || 5;
    
    const copyrightInstruction = (avoidCopyright === 'true' || avoidCopyright === undefined)
      ? "\nIt is FORBIDDEN to use any copyrighted material, brand names, or specific character names from movies, books, or games. Be generic."
      : "";

    let prompt;
    let descriptionPrompt;
    let supportingTagsPrompt;

    if (descriptionLength === 'long') {
        descriptionPrompt = `2. "description": Write a natural, human-sounding description that accurately describes the design while being engaging and SEO-friendly. 
        Focus on what the design visually shows, its style, and who might enjoy wearing it. 
        Use descriptive language that paints a picture for potential buyers (around 30-50 words).
        Be specific about the visual elements - mention colors, shapes, patterns, and style if relevant.
        Avoid robotic or generic phrases like "this awesome design" or "perfect for anyone".`;
    } else {
        descriptionPrompt = `2. "description": A concise, human-friendly description that accurately captures the essence of the design.
        Be specific about what the design shows - mention key visual elements that make it unique.
        Make it sound natural and engaging, not like SEO spam (strict maximum of 13 words).
        Example format: "Playful cat illustration with geometric patterns in vibrant sunset colors"`;
    }

    const basePromptStart = `Act as an expert in Print-on-Demand SEO for Teepublic. Analyze the provided design image.
Generate a valid JSON object. It is CRITICAL that the output is ONLY the JSON object and nothing else.${copyrightInstruction}
Do not use these forbidden words: ${FORBIDDEN_KEYWORDS.join(', ')}.
The JSON should have four keys: "title", "description", "main_tag", "supporting_tags", and "colors".`;

    const colorPromptPart = `5. "colors": An object with nine keys. For each key, choose the best color from its respective list:
   - "tshirt": Choose from: ${VALID_COLORS.tshirt.join(', ')}
   - "hoodie": Choose from: ${VALID_COLORS.hoodie.join(', ')}
   - "tank": Choose from: ${VALID_COLORS.tank.join(', ')}
   - "crewneck": Choose from: ${VALID_COLORS.crewneck.join(', ')}
   - "longsleeve": Choose from: ${VALID_COLORS.longsleeve.join(', ')}
   - "baseball": Choose from: ${VALID_COLORS.baseball.join(', ')}
   - "kids_tshirt": Choose from: ${VALID_COLORS.kids_tshirt.join(', ')}
   - "kids_hoodie": Choose from: ${VALID_COLORS.kids_hoodie.join(', ')}
   - "kids_longsleeve": Choose from: ${VALID_COLORS.kids_longsleeve.join(', ')}`;

    customMainTag = customMainTag?.trim();
    suggestionTag = suggestionTag?.trim();

    if (customMainTag && suggestionTag) {
        logToPanel(`Menggunakan main tag kustom: "${customMainTag}" dan suggestion tag: "${suggestionTag}"`);
        const mainTagCount = Math.round(tagsCount * 0.4);
        const suggestionTagCount = tagsCount - mainTagCount;

        supportingTagsPrompt = `4. "supporting_tags": A comma-separated list of exactly ${tagsCount} unique tags. It is CRITICAL that:
   - Exactly ${mainTagCount} tags are directly related to the main tag "${customMainTag}".
   - Exactly ${suggestionTagCount} tags are directly related to the suggestion tag "${suggestionTag}".
The tags must expand on the provided themes, not just describe the image.`;
        
        prompt = `${basePromptStart}
1. "title": A catchy, SEO-friendly title (max 30 chars) related to the image and the main tag.
${descriptionPrompt}
3. "main_tag": Use this exact text: "${customMainTag}".
${supportingTagsPrompt}
${colorPromptPart}`;

    } else if (customMainTag) {
        logToPanel(`Menggunakan main tag kustom: "${customMainTag}"`);
        supportingTagsPrompt = `4. "supporting_tags": A comma-separated list of exactly ${tagsCount} unique tags. It is CRITICAL that these tags are directly and strongly related to the provided main tag "${customMainTag}". For example, if the main tag is "cat", supporting tags could be "kitten, feline, pet, meow, cat lover". The tags must expand on the main tag's theme, not just describe the image.`;

        prompt = `${basePromptStart}
1. "title": A catchy, SEO-friendly title (max 30 chars) related to the image and the main tag.
${descriptionPrompt}
3. "main_tag": Use this exact text: "${customMainTag}".
${supportingTagsPrompt}
${colorPromptPart}`;

    } else {
        supportingTagsPrompt = `4. "supporting_tags": A comma-separated list of exactly ${tagsCount} unique, relevant tags based on the image.`;
        prompt = `${basePromptStart}
1. "title": A catchy, SEO-friendly title (max 30 chars).
${descriptionPrompt}
3. "main_tag": The single most important tag based on the image.
${supportingTagsPrompt}
${colorPromptPart}`;
    }

    const { aiProvider } = await chrome.storage.sync.get('aiProvider');
    
    try {
        let result;
        if (aiProvider === 'gemini') {
            const data = await chrome.storage.sync.get(['geminiKeys', 'currentApiKeyIndex']);
            const keys = data.geminiKeys || [];
            const index = data.currentApiKeyIndex || 0;
            if (keys.length === 0) throw new Error("Tidak ada Gemini API Key yang ditemukan.");
            result = await generateWithGeminiAndRotate(base64Data, prompt, keys, index);
        } else if (aiProvider === 'openrouter') {
            const data = await chrome.storage.sync.get(['openrouterKey', 'openrouterModel']);
            if (!data.openrouterKey || !data.openrouterModel) throw new Error("OpenRouter Key/Model tidak ditemukan.");
            result = await generateWithOpenRouter(base64Data, prompt, data.openrouterKey, data.openrouterModel);
        } else if (aiProvider === 'groq') {
            const data = await chrome.storage.sync.get(['groqKey', 'groqModel']);
            if (!data.groqKey || !data.groqModel) throw new Error("Groq Key/Model tidak ditemukan.");
            result = await generateWithGroq(base64Data, prompt, data.groqKey, data.groqModel);
        } else {
            throw new Error("Provider AI tidak didukung atau tidak ada API Key.");
        }
        
        return result;
    } catch (error) {
        logToPanel(`Error dalam menghasilkan metadata: ${error.message}`);
        return getDefaultMetadata();
    }
}

function getDefaultMetadata() {
    return {
        title: "Unique Design",
        description: "A creative and unique design for your style",
        main_tag: "design",
        supporting_tags: "art, creative, style, fashion, unique",
        colors: {
            tshirt: "Black",
            hoodie: "Black",
            tank: "Black",
            crewneck: "Black",
            longsleeve: "Black",
            baseball: "Black/White",
            kids_tshirt: "Black",
            kids_hoodie: "Black",
            kids_longsleeve: "Black"
        }
    };
}

async function parseJsonResponse(rawJson) {
    try {
        const cleanedJson = rawJson.replace(/```json|```/g, '').trim();
        const parsedData = JSON.parse(cleanedJson);
        
        if (!parsedData.colors || typeof parsedData.colors !== 'object') {
            parsedData.colors = {};
        }
        
        return parsedData;
    } catch (parseError) {
        console.error("Failed to parse JSON response from AI:", rawJson);
        logToPanel("Menggunakan metadata default karena parsing JSON gagal.");
        return getDefaultMetadata();
    }
}

function validateAndSetDefaultColors(metadata) {
    if (!metadata.colors) {
        metadata.colors = {};
    }
    
    for (const [productType, validColors] of Object.entries(VALID_COLORS)) {
        if (!metadata.colors[productType] || !validColors.includes(metadata.colors[productType])) {
            const fallbackColor = productType.includes('kids') || productType === 'baseball' ? 
                (validColors.includes('Black') ? 'Black' : validColors[0]) : 
                (validColors.includes('White') ? 'White' : validColors[0]);
                
            metadata.colors[productType] = fallbackColor;
            logToPanel(`Menggunakan warna default (${fallbackColor}) untuk ${productType}`);
        }
    }
}

async function generateWithGeminiAndRotate(base64Data, prompt, apiKeys, keyIndex) {
    if (keyIndex >= apiKeys.length) {
        await chrome.storage.sync.set({ currentApiKeyIndex: 0 });
        throw new Error("Semua API key Gemini gagal.");
    }
    const currentKey = apiKeys[keyIndex];
    logToPanel(`Menghubungi Gemini API dengan Key #${keyIndex + 1}...`);
    try {
        return await Promise.race([
            generateWithGemini(base64Data, prompt, currentKey),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Timeout: Gemini API tidak merespon")), 30000)
            )
        ]);
    } catch (error) {
        if (error.message.toLowerCase().match(/api key not valid|permission denied|quota|429|timeout/)) {
            logToPanel(`Key #${keyIndex + 1} gagal. Mencoba kunci berikutnya...`);
            const nextKeyIndex = keyIndex + 1;
            await chrome.storage.sync.set({ currentApiKeyIndex: nextKeyIndex });
            return generateWithGeminiAndRotate(base64Data, prompt, apiKeys, nextKeyIndex);
        } else {
            throw error;
        }
    }
}

async function generateWithGemini(base64Data, prompt, apiKey) {
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const requestBody = { "contents": [{ "parts": [{ "text": prompt }, { "inline_data": { "mime_type": "image/jpeg", "data": base64Data } }] }] };
    const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
    const data = await response.json();
    if (!response.ok || data.error) throw new Error(data.error?.message || `HTTP error! Status: ${response.status}`);
    if (!data.candidates?.[0]) {
        const blockReason = data.promptFeedback?.blockReason;
        throw new Error(blockReason ? `Permintaan diblokir AI: ${blockReason}` : "API tidak memberikan respons.");
    }
    const rawJson = data.candidates[0].content.parts[0].text;
    return await parseJsonResponse(rawJson);
}

async function generateWithOpenRouter(base64Data, prompt, apiKey, model) {
    logToPanel(`Menghubungi OpenRouter dengan model ${model}...`);
    const API_URL = "https://openrouter.ai/api/v1/chat/completions";
    const requestBody = { "model": model, "messages": [{ "role": "user", "content": [{ "type": "text", "text": prompt }, { "type": "image_url", "image_url": { "url": `data:image/jpeg;base64,${base64Data}` } }] }] };
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    try {
        const response = await fetch(API_URL, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }, 
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        const data = await response.json();
        if (!response.ok || data.error) throw new Error(data.error?.message || `HTTP error! Status: ${response.status}`);
        if (!data.choices?.[0]) throw new Error("API tidak memberikan respons dari OpenRouter.");
        const rawJson = data.choices[0].message.content;
        return await parseJsonResponse(rawJson);
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error("Timeout: OpenRouter API tidak merespon");
        }
        throw error;
    }
}

async function generateWithGroq(base64Data, prompt, apiKey, model) {
    logToPanel(`Menghubungi Groq dengan model ${model}...`);
    const API_URL = "https://api.groq.com/openai/v1/chat/completions";
    const requestBody = { "model": model, "messages": [{ "role": "user", "content": [{ "type": "text", "text": prompt }, { "type": "image_url", "image_url": { "url": `data:image/jpeg;base64,${base64Data}` } }] }], "max_tokens": 2048 };
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    try {
        const response = await fetch(API_URL, { 
            method: 'POST', 
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, 
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        const data = await response.json();
        if (!response.ok || data.error) throw new Error(data.error?.message || `HTTP error! Status: ${response.status}`);
        if (!data.choices?.[0]) throw new Error("API tidak memberikan respons dari Groq.");
        const rawJson = data.choices[0].message.content;
        return await parseJsonResponse(rawJson);
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error("Timeout: Groq API tidak merespon");
        }
        throw error;
    }
}

// --- Fungsi Utilitas ---
function filterForbiddenWords(text, fieldName) {
    if (typeof text !== 'string' || !text) return text;
    let modified = false;
    const cleanedText = text.split(/, | /).filter(word => {
        const cleanWord = word.toLowerCase().replace(/[.,!?;:]$/, '');
        const isForbidden = FORBIDDEN_KEYWORDS.some(forbidden => cleanWord === forbidden);
        if (isForbidden) {
            logToPanel(`Filter: Menghapus kata '${word}' dari '${fieldName}'.`);
            modified = true;
            return false;
        }
        return true;
    }).join(fieldName.includes('tags') ? ', ' : ' ');
    return modified ? cleanedText.replace(/\s\s+/g, ' ').trim() : text;
}

function stopFlow(finalMessage) {
    isProcessing = false;
    isAutoflow = false;
    autoflowCount = 0;
    currentAutoflowIndex = 0;
    nextMetadataPromise = null;
    logToPanel(`--- ${finalMessage} ---`);
    chrome.runtime.sendMessage({ action: "flowStopped" });
}

function logToPanel(message) {
    chrome.runtime.sendMessage({ action: "log", message }).catch(e => console.warn("Tidak dapat mengirim log ke side panel. Panel mungkin ditutup.", e));
}
