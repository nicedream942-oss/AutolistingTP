// sidepanel.js (v2.7 - Added Collapsible Sections and Suggestion Tag)

document.addEventListener('DOMContentLoaded', async () => {
    // Views and Buttons
    const mainView = document.getElementById('main-view');
    const settingsView = document.getElementById('settings-view');
    const goToSettingsBtn = document.getElementById('go-to-settings-btn');
    const backToMainBtn = document.getElementById('back-to-main-btn');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const startStopBtn = document.getElementById('start-stop-btn');
    const startAutoflowBtn = document.getElementById('start-autoflow-btn');
    const addGeminiKeyBtn = document.getElementById('add-gemini-key-btn');
    
    // Main View Controls
    const logEl = document.getElementById('process-log');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const selectedImagePreview = document.getElementById('selected-image-preview');
    const customMainTagInput = document.getElementById('custom-main-tag');
    const suggestionTagInput = document.getElementById('suggestion-tag'); // New element
    
    // Collapsible Sections
    const toggleGeneralSettingsBtn = document.getElementById('toggle-general-settings-btn');
    const generalSettingsContent = document.getElementById('general-settings-content');
    const toggleContentSettingsBtn = document.getElementById('toggle-content-settings-btn');
    const contentSettingsContent = document.getElementById('content-settings-content');
    
    // Settings Controls
    const aiProviderSelect = document.getElementById('ai-provider');
    const geminiSettings = document.getElementById('gemini-settings');
    const newGeminiKeyInput = document.getElementById('new-gemini-key');
    const geminiKeysList = document.getElementById('gemini-keys-list');
    const openrouterSettings = document.getElementById('openrouter-settings');
    const openrouterKeyInput = document.getElementById('openrouter-key');
    const openrouterModelSelect = document.getElementById('openrouter-model-select');
    const groqSettings = document.getElementById('groq-settings');
    const groqKeyInput = document.getElementById('groq-key');
    const groqModelSelect = document.getElementById('groq-model-select');
    const tshirtColorSelect = document.getElementById('teepublic-tshirt-color');
    const hoodieColorSelect = document.getElementById('teepublic-hoodie-color');
    const tankColorSelect = document.getElementById('teepublic-tank-color');
    const crewneckColorSelect = document.getElementById('teepublic-crewneck-color');
    const longsleeveColorSelect = document.getElementById('teepublic-longsleeve-color');
    const baseballColorSelect = document.getElementById('teepublic-baseball-color');
    const productColorsSelect = document.getElementById('teepublic-product-colors');
    const matureContentSelect = document.getElementById('teepublic-mature-content');
    const supportingTagsCountInput = document.getElementById('supporting-tags-count');
    const autoflowCountInput = document.getElementById('autoflow-count');
    const autoPublishSelect = document.getElementById('teepublic-auto-publish');
    const avoidCopyrightSelect = document.getElementById('avoid-copyright');
    const autoflowDelaySelect = document.getElementById('autoflow-delay');
    const descriptionLengthSelect = document.getElementById('description-length'); // New element
    // New Kids Settings Controls
    const enableKidsSelect = document.getElementById('teepublic-enable-kids');
    const kidsTshirtColorSelect = document.getElementById('teepublic-kids-tshirt-color');
    const kidsHoodieColorSelect = document.getElementById('teepublic-kids-hoodie-color');
    const kidsLongsleeveColorSelect = document.getElementById('teepublic-kids-longsleeve-color');
    
    let geminiKeys = [];

    const logToPanel = (message) => {
        logEl.textContent += `> ${message}\n`;
        logEl.scrollTop = logEl.scrollHeight;
    };
    
    // --- COLLAPSIBLE SECTIONS MANAGEMENT ---
    
    const initializeCollapsibleSections = () => {
        // General Settings Collapsible
        toggleGeneralSettingsBtn.addEventListener('click', () => {
            const isActive = toggleGeneralSettingsBtn.classList.toggle('active');
            if (isActive) {
                generalSettingsContent.style.maxHeight = generalSettingsContent.scrollHeight + 'px';
            } else {
                generalSettingsContent.style.maxHeight = '0';
            }
        });

        // Content Settings Collapsible
        toggleContentSettingsBtn.addEventListener('click', () => {
            const isActive = toggleContentSettingsBtn.classList.toggle('active');
            if (isActive) {
                contentSettingsContent.style.maxHeight = contentSettingsContent.scrollHeight + 'px';
            } else {
                contentSettingsContent.style.maxHeight = '0';
            }
        });

        // Open general settings by default
        toggleGeneralSettingsBtn.classList.add('active');
        generalSettingsContent.style.maxHeight = generalSettingsContent.scrollHeight + 'px';
    };

    // --- SETTINGS MANAGEMENT ---

    const saveSettings = () => {
        chrome.storage.sync.set({
            aiProvider: aiProviderSelect.value,
            geminiKeys: geminiKeys,
            openrouterKey: openrouterKeyInput.value.trim(),
            openrouterModel: openrouterModelSelect.value,
            groqKey: groqKeyInput.value.trim(),
            groqModel: groqModelSelect.value,
            teepublicTshirtColor: tshirtColorSelect.value,
            teepublicHoodieColor: hoodieColorSelect.value,
            teepublicTankColor: tankColorSelect.value,
            teepublicCrewneckColor: crewneckColorSelect.value,
            teepublicLongsleeveColor: longsleeveColorSelect.value,
            teepublicBaseballColor: baseballColorSelect.value,
            teepublicProductColors: productColorsSelect.value,
            teepublicMatureContent: matureContentSelect.value,
            supportingTagsCount: parseInt(supportingTagsCountInput.value, 10),
            autoflowCount: parseInt(autoflowCountInput.value, 10),
            teepublicAutoPublish: autoPublishSelect.value,
            avoidCopyright: avoidCopyrightSelect.value,
            autoflowDelay: autoflowDelaySelect.value,
            descriptionLength: descriptionLengthSelect.value, // New setting
            // New Kids Settings
            teepublicEnableKids: enableKidsSelect.value,
            teepublicKidsTshirtColor: kidsTshirtColorSelect.value,
            teepublicKidsHoodieColor: kidsHoodieColorSelect.value,
            teepublicKidsLongsleeveColor: kidsLongsleeveColorSelect.value,
            currentApiKeyIndex: 0
        }, () => {
            logToPanel("Pengaturan disimpan.");
            settingsView.classList.remove('active');
            mainView.classList.add('active');
        });
    };

    const loadSettings = () => {
        const keys = [ 
            'aiProvider', 'geminiKeys', 'openrouterKey', 'openrouterModel', 'groqKey', 'groqModel', 
            'teepublicTshirtColor', 'teepublicHoodieColor', 'teepublicTankColor', 'teepublicCrewneckColor',
            'teepublicLongsleeveColor', 'teepublicBaseballColor',
            'teepublicProductColors', 'teepublicMatureContent', 'supportingTagsCount', 'autoflowCount',
            'teepublicAutoPublish', 'avoidCopyright', 'autoflowDelay', 'descriptionLength',
            // New Kids Settings
            'teepublicEnableKids', 'teepublicKidsTshirtColor', 'teepublicKidsHoodieColor', 'teepublicKidsLongsleeveColor'
        ];
        chrome.storage.sync.get(keys, (data) => {
            // AI Provider Settings
            aiProviderSelect.value = data.aiProvider || 'gemini';
            geminiKeys = data.geminiKeys || [];
            openrouterKeyInput.value = data.openrouterKey || '';
            openrouterModelSelect.value = data.openrouterModel || 'google/gemini-pro-vision';
            groqKeyInput.value = data.groqKey || '';
            groqModelSelect.value = data.groqModel || 'mixtral-8x7b-32768';
            
            // Color Settings
            tshirtColorSelect.value = data.teepublicTshirtColor || 'AI_DECIDE';
            hoodieColorSelect.value = data.teepublicHoodieColor || 'AI_DECIDE';
            tankColorSelect.value = data.teepublicTankColor || 'AI_DECIDE';
            crewneckColorSelect.value = data.teepublicCrewneckColor || 'AI_DECIDE';
            longsleeveColorSelect.value = data.teepublicLongsleeveColor || 'AI_DECIDE';
            baseballColorSelect.value = data.teepublicBaseballColor || 'AI_DECIDE';
            productColorsSelect.value = data.teepublicProductColors || 'all';
            
            // General Settings
            matureContentSelect.value = data.teepublicMatureContent || 'false';
            supportingTagsCountInput.value = data.supportingTagsCount || 5;
            autoflowCountInput.value = data.autoflowCount || 5;
            autoPublishSelect.value = data.teepublicAutoPublish || 'false';
            avoidCopyrightSelect.value = data.avoidCopyright || 'true';
            autoflowDelaySelect.value = data.autoflowDelay || '5';
            descriptionLengthSelect.value = data.descriptionLength || 'short';
            
            // Kids Settings
            enableKidsSelect.value = data.teepublicEnableKids || 'false';
            kidsTshirtColorSelect.value = data.teepublicKidsTshirtColor || 'AI_DECIDE';
            kidsHoodieColorSelect.value = data.teepublicKidsHoodieColor || 'AI_DECIDE';
            kidsLongsleeveColorSelect.value = data.teepublicKidsLongsleeveColor || 'AI_DECIDE';
            
            updateProviderUI();
            renderApiKeys();
        });
    };
    
    // --- VIEW & UI MANAGEMENT ---

    goToSettingsBtn.addEventListener('click', () => {
        mainView.classList.remove('active');
        settingsView.classList.add('active');
    });

    backToMainBtn.addEventListener('click', () => {
        settingsView.classList.remove('active');
        mainView.classList.add('active');
    });

    const updateProviderUI = () => {
        const provider = aiProviderSelect.value;
        geminiSettings.style.display = provider === 'gemini' ? 'block' : 'none';
        openrouterSettings.style.display = provider === 'openrouter' ? 'block' : 'none';
        groqSettings.style.display = provider === 'groq' ? 'block' : 'none';
    };

    saveSettingsBtn.addEventListener('click', saveSettings);
    aiProviderSelect.addEventListener('change', updateProviderUI);

    const setUiRunningState = (isRunning, isAutoflow = false) => {
        const allButtons = [startStopBtn, startAutoflowBtn, goToSettingsBtn];
        if (isRunning) {
            allButtons.forEach(btn => btn.disabled = true);
            let runningBtn;
            if (isAutoflow) {
                runningBtn = startAutoflowBtn;
                runningBtn.textContent = 'Hentikan Autoflow';
            } else {
                runningBtn = startStopBtn;
                runningBtn.textContent = 'Hentikan Proses';
            }
            runningBtn.classList.add('is-running');
            runningBtn.disabled = false;
        } else {
            startStopBtn.textContent = 'Generate & Fill';
            startAutoflowBtn.textContent = 'Start Autoflow';
            allButtons.forEach(btn => {
                btn.classList.remove('is-running');
                btn.disabled = false;
            });
        }
    };

    // --- API KEY MANAGEMENT ---

    const renderApiKeys = () => {
        geminiKeysList.innerHTML = '';
        geminiKeys.forEach((key, index) => {
            const keyItem = document.createElement('div');
            keyItem.className = 'api-key-item';
            const partialKey = `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
            keyItem.innerHTML = `<span>Key ${index + 1}: ${partialKey}</span><button class="btn-remove" data-key-index="${index}">&times;</button>`;
            geminiKeysList.appendChild(keyItem);
        });
    };

    addGeminiKeyBtn.addEventListener('click', () => {
        const newKey = newGeminiKeyInput.value.trim();
        if (newKey) {
            if (!geminiKeys.includes(newKey)) {
                geminiKeys.push(newKey);
                newGeminiKeyInput.value = '';
                renderApiKeys();
                logToPanel("Gemini API Key berhasil ditambahkan.");
            } else {
                logToPanel("API Key sudah ada dalam daftar.");
            }
        }
    });

    geminiKeysList.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-remove')) {
            const keyIndex = parseInt(e.target.getAttribute('data-key-index'), 10);
            geminiKeys.splice(keyIndex, 1);
            renderApiKeys();
            logToPanel("Gemini API Key dihapus.");
        }
    });

    // --- MAIN ACTION LISTENERS ---

    startStopBtn.addEventListener('click', () => {
        if (startStopBtn.classList.contains('is-running')) {
            chrome.runtime.sendMessage({ action: "stopProcess" });
        } else {
            logEl.textContent = '';
            imagePreviewContainer.classList.remove('visible');
            selectedImagePreview.src = '';
            const customTag = customMainTagInput.value.trim();
            const suggestionTag = suggestionTagInput.value.trim();
            chrome.runtime.sendMessage({ 
                action: "startGeneration", 
                isAutoflow: false, 
                customMainTag: customTag,
                suggestionTag: suggestionTag
            });
        }
    });
    
    startAutoflowBtn.addEventListener('click', () => {
        if (startAutoflowBtn.classList.contains('is-running')) {
            chrome.runtime.sendMessage({ action: "stopProcess" });
        } else {
            logEl.textContent = '';
            imagePreviewContainer.classList.remove('visible');
            selectedImagePreview.src = '';
            const customTag = customMainTagInput.value.trim();
            const suggestionTag = suggestionTagInput.value.trim();
            chrome.storage.sync.get('autoflowCount', (data) => {
                const count = data.autoflowCount || 1;
                chrome.runtime.sendMessage({ 
                    action: "startGeneration", 
                    isAutoflow: true, 
                    count: count,
                    customMainTag: customTag,
                    suggestionTag: suggestionTag
                });
            });
        }
    });

    // --- LISTENER FOR MESSAGES FROM BACKGROUND SCRIPT ---
    chrome.runtime.onMessage.addListener((request) => {
        switch(request.action) {
            case "log": 
                logToPanel(request.message); 
                break;
            case "flowStarted": 
                setUiRunningState(true, request.isAutoflow); 
                break;
            case "flowStopped": 
                setUiRunningState(false); 
                imagePreviewContainer.classList.remove('visible'); 
                break;
            case "displayImagePreview": 
                selectedImagePreview.src = request.imageUrl; 
                imagePreviewContainer.classList.add('visible'); 
                break;
        }
    });

    // --- INITIALIZATION ---
    const initializeApp = () => {
        loadSettings();
        initializeCollapsibleSections();
        logToPanel("Aplikasi Teepublic Autolisting siap digunakan.");
        logToPanel("Pastikan Anda berada di halaman upload/edit desain Teepublic.");
    };

    initializeApp();
});