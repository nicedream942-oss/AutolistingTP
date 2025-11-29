// content_script.js (v3.3 - Final Patched Apparel Selectors)

if (typeof window.assistantListenerAttached === 'undefined') {
    window.assistantListenerAttached = true;
    console.log("Teepublic Autolisting: Content script loaded and attached.");

    const delay = (ms) => new Promise(res => setTimeout(res, ms));

    // --- UTILITY FUNCTIONS ---
    
    async function waitForVisibleElement(selector, timeout = 10000, root = document) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            for (const element of root.querySelectorAll(selector)) {
                const rect = element.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden') {
                    return element;
                }
            }
            await delay(250);
        }
        throw new Error(`Element not found or not visible after ${timeout}ms: '${selector}'`);
    }

    async function waitForElementWithText(selector, text, exactMatch = false, timeout = 5000, root = document) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            for (const element of root.querySelectorAll(selector)) {
                if (element.offsetParent !== null) {
                    const elementText = element.textContent.trim();
                    const searchText = text.trim();
                    if (exactMatch ? elementText.toLowerCase() === searchText.toLowerCase() : elementText.toLowerCase().includes(searchText.toLowerCase())) {
                        return element;
                    }
                }
            }
            await delay(200);
        }
        throw new Error(`Element '${selector}' with text '${text}' not found.`);
    }

    async function humanizedClick(element) {
        if (!element) throw new Error("The element to click is not valid.");
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await delay(100 + Math.random() * 100);
        element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    }

    async function humanizedInput(element, value) {
        if (!element) throw new Error("The input element is not valid.");
        element.scrollIntoView({ block: 'center' });
        await humanizedClick(element);
        await delay(100);
        element.value = '';
        element.dispatchEvent(new Event('input', { bubbles: true }));
        await delay(50);
        for (const char of value) {
            element.value += char;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            await delay(8 + Math.random() * 15);
        }
        await delay(150);
        element.dispatchEvent(new Event('blur', { bubbles: true }));
    }

    async function imageToB64(src) {
        try {
            const response = await fetch(src, { cache: "no-store" });
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    if (reader.result) resolve(reader.result.toString().split(',')[1]);
                    else reject(new Error("FileReader result was empty."));
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error("Image download error:", error);
            throw new Error(`Failed to download image for analysis: ${error.message}`);
        }
    }

    // --- DESIGN LISTING FUNCTIONS ---
    async function findTeepublicActiveImage() {
        const imageSelector = 'img#uploader-preview-image, img.js-design-img-main';
        const imageElement = await waitForVisibleElement(imageSelector);
        if (!imageElement || !imageElement.src) throw new Error("Could not find the main design image.");
        return imageElement.src;
    }
    
    async function findNextTeepublicImage() {
        const nextImageSelector = '.tp-img-upload-item.is-active + .tp-img-upload-item .js-design-img';
        const nextImageElement = document.querySelector(nextImageSelector);
        return nextImageElement ? nextImageElement.src : null;
    }

    async function fillSupportingTags(tagsString) {
        if (!tagsString) return;
        const tags = tagsString.split(',').map(t => t.trim()).filter(Boolean);
        if (tags.length === 0) return;

        const tagInput = await waitForVisibleElement('.taggle_list .taggle_input');
        
        for (const tag of tags) {
            await humanizedClick(tagInput);
            await delay(100);
            tagInput.value = '';

            for (const char of tag) {
                tagInput.value += char;
                tagInput.dispatchEvent(new Event('input', { bubbles: true }));
                await delay(10 + Math.random() * 20);
            }
            await delay(200);

            tagInput.dispatchEvent(new KeyboardEvent('keydown', { 
                key: ',', 
                code: 'Comma', 
                keyCode: 188, 
                bubbles: true 
            }));
            
            await delay(400);
        }
    }
    
    async function selectDefaultColor(productName, colorName) {
        if (!colorName) return;

        let productContainerSelector;
        switch (productName) {
            case 'T-Shirt':
                productContainerSelector = '#primary_color_tshirt';
                break;
            case 'Hoodie':
                productContainerSelector = '#primary_color_hoodie';
                break;
            case 'Tank':
                productContainerSelector = '#primary_color_tank';
                break;
            case 'Crewneck':
                productContainerSelector = '#primary_color_crewneck';
                break;
            case 'Long Sleeve T-Shirt':
                productContainerSelector = '#primary_color_longsleevetshirt';
                break;
            case 'Baseball Tee':
                productContainerSelector = '#primary_color_baseballtee';
                break;
            case 'Kids T-Shirt':
                productContainerSelector = '#primary_color_kids';
                break;
            case 'Kids Hoodie':
                productContainerSelector = '#primary_color_kidshoodie';
                break;
            case 'Kids Long Sleeve T-Shirt':
                productContainerSelector = '#primary_color_kidslongsleevetshirt';
                break;
            default:
                console.warn(`Unknown product name for color selection: '${productName}'`);
                return;
        }

        const productContainer = await waitForVisibleElement(productContainerSelector);
        const dropdownTrigger = await waitForVisibleElement('a.dd-selected', 5000, productContainer);
        await humanizedClick(dropdownTrigger);

        const dropdownList = await waitForVisibleElement('ul.dd-options', 5000, productContainer);
        const colorLabel = await waitForElementWithText('label.dd-option-text', colorName, true, 5000, dropdownList);
        const colorOptionLink = colorLabel.closest('a.dd-option');
        if (!colorOptionLink) throw new Error(`Clickable color option '${colorName}' for '${productName}' not found.`);
        
        await humanizedClick(colorOptionLink);
        await delay(200);
    }
    
    async function enableKidsApparel() {
        const kidsItemIds = [3, 14, 15];
        for (const id of kidsItemIds) {
            try {
                const hiddenInput = document.querySelector(`input#canvas-option_${id}`);
                if (!hiddenInput) {
                    console.warn(`Kids apparel input for ID ${id} not found.`);
                    continue;
                }
                const toggleSwitch = hiddenInput.closest('.on-off');
                if (!toggleSwitch) {
                    console.warn(`Toggle switch for kids apparel ID ${id} not found.`);
                    continue;
                }
                
                const isEnabled = toggleSwitch.querySelector('span.enabled');
                if (!isEnabled) {
                    console.log(`Enabling kids apparel item with ID ${id}...`);
                    await humanizedClick(toggleSwitch);
                    await delay(500);
                }
            } catch (error) {
                console.error(`Error while trying to enable kids apparel with ID ${id}:`, error);
            }
        }
    }

    async function fillTeepublicForm(formData) {
        const { metadata, settings } = formData;
        
        await humanizedInput(await waitForVisibleElement('#design_design_title'), metadata.title || '');
        await humanizedInput(await waitForVisibleElement('#design_design_description'), metadata.description || '');
        await humanizedInput(await waitForVisibleElement('#design_primary_tag'), metadata.main_tag || '');

        await fillSupportingTags(metadata.supporting_tags);
        
        if (settings) {
            if (settings.teepublicMatureContent) {
                 const radio = await waitForVisibleElement(`input[name="design[content_flag]"][value="${settings.teepublicMatureContent}"]`);
                 await humanizedClick(radio);
            }
            if (settings.teepublicProductColors) {
                 const colorButton = await waitForElementWithText('.jsAdditionalColorButtons a', settings.teepublicProductColors, false);
                 await humanizedClick(colorButton);
            }
        }

        if (metadata.colors) {
            await selectDefaultColor('T-Shirt', metadata.colors.tshirt);
            await selectDefaultColor('Hoodie', metadata.colors.hoodie);
            await selectDefaultColor('Tank', metadata.colors.tank);
            await selectDefaultColor('Crewneck', metadata.colors.crewneck);
            await selectDefaultColor('Long Sleeve T-Shirt', metadata.colors.longsleeve);
            await selectDefaultColor('Baseball Tee', metadata.colors.baseball);

            if (settings.teepublicEnableKids === 'true') {
                await enableKidsApparel();
                await selectDefaultColor('Kids T-Shirt', metadata.colors.kids_tshirt);
                await selectDefaultColor('Kids Hoodie', metadata.colors.kids_hoodie);
                await selectDefaultColor('Kids Long Sleeve T-Shirt', metadata.colors.kids_longsleeve);
            }
        }
    }

    async function goToNextDesign() {
        const nextButton = await waitForVisibleElement('input[type="submit"][name="commit"][value="Next Design"]');
        await humanizedClick(nextButton);
    }

    async function publishDesigns() {
        const termsCheckbox = await waitForVisibleElement('input#terms');
        if (!termsCheckbox.checked) {
            await humanizedClick(termsCheckbox);
        }
        await delay(250);
        const publishButton = await waitForVisibleElement('input[name="commit"][value="Publish All"]');
        await humanizedClick(publishButton);
    }

    // --- MAIN MESSAGE LISTENER ---
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        const asyncAction = (func) => {
            func()
                .then(response => sendResponse(response || { status: 'SUCCESS' }))
                .catch(e => sendResponse({ status: 'ERROR', message: e.message, stack: e.stack }));
            return true;
        };

        switch (request.action) {
            case "findActiveImage":
                return asyncAction(async () => {
                    const imageUrl = await findTeepublicActiveImage();
                    const base64Data = await imageToB64(imageUrl);
                    return { status: 'SUCCESS', imageUrl, base64Data };
                });
            case "findNextImage":
                return asyncAction(async () => {
                    const nextImageUrl = await findNextTeepublicImage();
                    if (!nextImageUrl) return { status: 'SUCCESS', base64Data: null };
                    const base64Data = await imageToB64(nextImageUrl);
                    return { status: 'SUCCESS', base64Data };
                });
            case "fillTeepublicForm":
                return asyncAction(() => fillTeepublicForm(request.formData));
            case "goToNextDesign":
                return asyncAction(goToNextDesign);
            case "publishDesigns":
                return asyncAction(publishDesigns);
            default:
                console.warn("Unknown action received in content script:", request.action);
                return false;
        }
    });
}