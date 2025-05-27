// =============== script.js ===============
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const apiKeyInput = document.getElementById('apiKeyInput');
    const modelSelector = document.getElementById('modelSelector');
    const videoFileInput = document.getElementById('videoFile');
    const categorySelector = document.getElementById('categorySelector');
    const difficultySelector = document.getElementById('difficultySelector');
    const addRuleButton = document.getElementById('addRuleButton');
    const randomAddRuleButton = document.getElementById('randomAddRuleButton');
    const selectedRulesList = document.getElementById('selectedRulesList');
    const selectedRulesCount = document.getElementById('selectedRulesCount');
    const noRulesPlaceholder = document.getElementById('noRulesPlaceholder');
    const clearRulesButton = document.getElementById('clearRulesButton');
    const generatedMetaPromptPreviewContainer = document.getElementById('generatedMetaPromptPreviewContainer');
    const generatedMetaPromptPreview = document.getElementById('generatedMetaPromptPreview');
    const submitButton = document.getElementById('submitButton');
    const buttonText = document.getElementById('buttonText');
    const loader = document.getElementById('loader');
    const geminiResponseOutput = document.getElementById('geminiResponse');
    const responseContainer = document.getElementById('responseContainer');
    const videoPreviewContainer = document.getElementById('videoPreviewContainer');
    const videoPreviewPlayer = document.getElementById('videoPreviewPlayer');
    const errorMessageDiv = document.getElementById('errorMessage');
    const errorMessageText = document.getElementById('errorMessageText');
    const statusMessageContainer = document.getElementById('statusMessageContainer');
    const statusMessage = document.getElementById('statusMessage');
    const fileReadProgressContainer = document.getElementById('fileReadProgressContainer');
    const fileReadProgressBar = document.getElementById('fileReadProgressBar');
    const fileReadTimeDisplay = document.getElementById('fileReadTime');
    const timingInfoDisplay = document.getElementById('timingInfoDisplay');
    const apiCallTimeDisplay = document.getElementById('apiCallTime');
    const totalProcessingTimeDisplay = document.getElementById('totalProcessingTime');
    const initialMessageDiv = document.getElementById('initialMessage'); // New element for right panel initial message

    // --- State Variables ---
    let currentBase64VideoData = null;
    let currentMimeType = null;
    let fileReadStartTime, apiCallStartTime, totalProcessingStartTime;
    let selectedQaRules = [];
    const MAX_RULES = 10;
    const FIXED_QUESTION_TYPE = "Multiple Choice";
    let apiTimerInterval = null; // New variable for the API timer interval

    // --- localStorage Keys ---
    const LOCAL_STORAGE_API_KEY = 'geminiVideoAnalyzerApiKey';
    const LOCAL_STORAGE_MODEL = 'geminiVideoAnalyzerModel';

    // --- Mapping for Chinese Display ---
    const keyToChineseMap = {
        "Object Perception": "物体感知",
        "Causal Reasoning": "因果推理",
        "Clips Summarization": "剪辑摘要",
        "Attribute Perception": "属性感知",
        "Event Understanding": "事件理解",
        "Text-Rich Understanding": "文本丰富理解",
        "Prospective Reasoning": "前瞻性推理",
        "Spatial Understanding": "空间理解",
        "Action Perception": "动作感知",
        "Counting": "计数",
        "Other": "其他",
        "Multiple Choice": "选择题",
        "Open-ended": "简答题",
        "Intermediate": "中级",
        "Advanced": "高级"
    };

    // --- Load settings from localStorage ---
    function loadSettings() {
        const savedApiKey = localStorage.getItem(LOCAL_STORAGE_API_KEY);
        if (savedApiKey) {
            apiKeyInput.value = savedApiKey;
        }
        const savedModel = localStorage.getItem(LOCAL_STORAGE_MODEL);
        if (savedModel) {
            modelSelector.value = savedModel;
        }
        updateSelectedRulesUI(); // Update button state based on loaded API key
    }

    // --- Save settings to localStorage ---
    apiKeyInput.addEventListener('input', () => {
        localStorage.setItem(LOCAL_STORAGE_API_KEY, apiKeyInput.value.trim());
        updateSelectedRulesUI(); // Re-check submit button state
    });

    modelSelector.addEventListener('change', () => {
        localStorage.setItem(LOCAL_STORAGE_MODEL, modelSelector.value);
    });


    // --- Prompt Management & Rule Selection ---
    function populateSelector(selector, optionsArray, placeholder) {
        selector.innerHTML = `<option value="">-- ${placeholder} --</option>`;
        optionsArray.forEach(optionText => {
            const optElement = document.createElement('option');
            optElement.value = optionText;
            optElement.textContent = keyToChineseMap[optionText] || optionText;
            selector.appendChild(optElement);
        });
        selector.disabled = optionsArray.length === 0;
    }

    function initializeCategorySelector() {
        if (typeof promptTemplates !== 'undefined' && Object.keys(promptTemplates).length > 0) {
            const categoriesWithMc = Object.keys(promptTemplates).filter(cat =>
                promptTemplates[cat] && promptTemplates[cat][FIXED_QUESTION_TYPE]
            );
            populateSelector(categorySelector, categoriesWithMc, "选择类别");
        } else {
            console.error("[Prompts] promptTemplates object is not defined or suitable. Check prompts.js.");
            categorySelector.innerHTML = '<option value="">无法加载类别</option>';
            [categorySelector, difficultySelector, addRuleButton, randomAddRuleButton].forEach(el => el.disabled = true);
        }
        difficultySelector.disabled = true;
    }

    categorySelector.addEventListener('change', () => {
        const selectedCategory = categorySelector.value;
        populateSelector(difficultySelector, [], "选择难度");
        difficultySelector.disabled = true;

        if (selectedCategory &&
            promptTemplates[selectedCategory] &&
            promptTemplates[selectedCategory][FIXED_QUESTION_TYPE]) {
            const difficulties = Object.keys(promptTemplates[selectedCategory][FIXED_QUESTION_TYPE]);
            populateSelector(difficultySelector, difficulties, "选择难度");
        }
    });

    function updateSelectedRulesUI() {
        selectedRulesList.innerHTML = '';
        if (selectedQaRules.length === 0) {
            selectedRulesList.appendChild(noRulesPlaceholder);
            noRulesPlaceholder.style.display = 'list-item';
            generatedMetaPromptPreviewContainer.classList.add('hidden');
        } else {
            noRulesPlaceholder.style.display = 'none';
            generatedMetaPromptPreviewContainer.classList.remove('hidden');
            selectedQaRules.forEach((rule, index) => {
                const listItem = document.createElement('li');
                listItem.className = 'p-3 flex justify-between items-center selected-rule-item';
                listItem.innerHTML = `
                    <span class="text-sm">
                        ${index + 1}. <strong>类别:</strong> ${escapeHtml(keyToChineseMap[rule.category] || rule.category)},
                        <strong>题型:</strong> ${escapeHtml(keyToChineseMap[rule.type] || rule.type)},
                        <strong>难度:</strong> ${escapeHtml(keyToChineseMap[rule.difficulty] || rule.difficulty)}
                    </span>
                    <button data-index="${index}" class="remove-rule-btn text-red-500 hover:text-red-700 text-xs p-1 rounded hover:bg-red-100">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                `;
                selectedRulesList.appendChild(listItem);
            });
        }
        selectedRulesCount.textContent = selectedQaRules.length;
        addRuleButton.disabled = selectedQaRules.length >= MAX_RULES;
        randomAddRuleButton.disabled = selectedQaRules.length >= MAX_RULES;
        clearRulesButton.disabled = selectedQaRules.length === 0;

        const userApiKey = apiKeyInput.value.trim();
        submitButton.disabled = !(userApiKey && selectedQaRules.length > 0 && selectedQaRules.length <= MAX_RULES && currentBase64VideoData);

        if (selectedQaRules.length > 0) {
            generatedMetaPromptPreview.innerHTML = `将指示 Gemini 根据以下 ${selectedQaRules.length} 条规则生成问答对：<br>` +
                selectedQaRules.map((r, i) => `<strong>${i+1}.</strong> 类别: ${keyToChineseMap[r.category] || r.category}, 题型: ${keyToChineseMap[r.type] || r.type}, 难度: ${keyToChineseMap[r.difficulty] || r.difficulty}`).join('<br>');
        } else {
            generatedMetaPromptPreview.textContent = "请添加规则以预览指令。";
        }
    }

    addRuleButton.addEventListener('click', () => {
        const category = categorySelector.value;
        const difficulty = difficultySelector.value;
        const type = FIXED_QUESTION_TYPE;

        if (!category || !difficulty) {
            showError("请先完整选择类别和难度。");
            return;
        }
        if (selectedQaRules.length >= MAX_RULES) {
            showError(`最多只能添加 ${MAX_RULES} 条规则。`);
            return;
        }
        selectedQaRules.push({ category, type, difficulty });
        updateSelectedRulesUI();
        hideError();
    });

    randomAddRuleButton.addEventListener('click', () => {
        if (selectedQaRules.length >= MAX_RULES) {
            showError(`最多只能添加 ${MAX_RULES} 条规则。`);
            return;
        }

        const existingCategories = selectedQaRules.map(rule => rule.category);

        const availableCategories = Object.keys(promptTemplates).filter(cat =>
            !existingCategories.includes(cat) &&
            promptTemplates[cat] &&
            promptTemplates[cat][FIXED_QUESTION_TYPE] &&
            Object.keys(promptTemplates[cat][FIXED_QUESTION_TYPE]).some(diff => diff === "Intermediate" || diff === "Advanced")
        );

        if (availableCategories.length === 0) {
            showError("没有可用的新类别来随机添加规则，或所有可用类别均已添加。");
            return;
        }

        const randomCategory = availableCategories[Math.floor(Math.random() * availableCategories.length)];

        const availableDifficulties = Object.keys(promptTemplates[randomCategory][FIXED_QUESTION_TYPE])
                                         .filter(diff => diff === "Intermediate" || diff === "Advanced");

        if (availableDifficulties.length === 0) {
             showError(`类别 "${keyToChineseMap[randomCategory] || randomCategory}" 中没有合适的中高级难度选择题。`);
            return;
        }
        const randomDifficulty = availableDifficulties[Math.floor(Math.random() * availableDifficulties.length)];

        selectedQaRules.push({ category: randomCategory, type: FIXED_QUESTION_TYPE, difficulty: randomDifficulty });
        updateSelectedRulesUI();
        hideError();
    });

    selectedRulesList.addEventListener('click', (event) => {
        if (event.target.closest('.remove-rule-btn')) {
            const indexToRemove = parseInt(event.target.closest('.remove-rule-btn').dataset.index, 10);
            selectedQaRules.splice(indexToRemove, 1);
            updateSelectedRulesUI();
        }
    });

    clearRulesButton.addEventListener('click', () => {
        selectedQaRules = [];
        updateSelectedRulesUI();
    });

    // --- Meta-Prompt Builder for User-Defined QA Generation ---
    function buildMetaPromptForUserSelectedQA(rules) {
        let rulesDescription = "";
        rules.forEach((rule, index) => {
            const categoryZh = keyToChineseMap[rule.category] || rule.category;
            const typeZh = keyToChineseMap[rule.type] || rule.type;
            const difficultyZh = keyToChineseMap[rule.difficulty] || rule.difficulty;

            rulesDescription += `
    ${index + 1}. **规则 ${index + 1}**:
        * 问题类别: "${escapeHtml(categoryZh)}" (对应JSON输出中的 \`category\` 字段应为 "${escapeHtml(rule.category)}")
        * 题型: "${escapeHtml(typeZh)}" (对应JSON输出中的 \`question_type\` 字段应为 "${escapeHtml(FIXED_QUESTION_TYPE)}")
        * 难度: "${escapeHtml(difficultyZh)}" (对应JSON输出中的 \`difficulty\` 字段应为 "${escapeHtml(rule.difficulty)}")
        * 请严格根据此规则生成一个选择题问答对。
`;
        });

        return `
你现在是一位专业的视频问答(QA)数据标注专家。你的任务是根据我提供的视频，严格按照下面列出的 ${rules.length} 条具体规则，为每一条规则分别生成一个高质量的选择题问答对。所有问答对必须是中文。问答对必须基于视频的10秒以上的视频片段进行判断。

**通用生成准则 (适用于所有问答对):**

1.  **纯视觉内容**: 所有问题都必须仅通过观看视频画面的视觉信息才能回答。绝对不能设计仅通过音频或字幕就能回答的问题。答案的核心视觉信息不应在画面中持续展示超过2秒。
2.  **题型固定**: 所有生成的问答对都必须是“选择题 (Multiple Choice)”。
3.  **难度符合要求**: 确保每个问答对的难度严格符合其对应规则中指定的“中级(Intermediate)”或“高级(Advanced)”难度。严禁生成“初级”问题。
    * 中级问题特征：需要一定的视觉推理；需要理解画面细节；答案可能不明显，但可以通过仔细观察和逻辑推断得出。
    * 高级问题特征：需要基于多个离散的视觉线索进行长时程推理；涉及专业领域知识（如体育战术、科学现象等）；需要对复杂的动态、空间关系有深刻理解。
4.  **时间戳(Timestamps)**: 为每个问答对提供一个与问题最相关的视觉内容起止时间戳，格式为 "MM:SS" (例如 "01:23")。如果需要观看整段视频才能回答，则标记整段视频的起止时间。计数类型的问题，其对应的时间戳跨度至少需要10秒。
5.  **输出格式**: 你必须以一个纯净的、不包含任何额外解释和Markdown标记的JSON数组格式返回结果。数组中应包含 ${rules.length} 个对象，每个对象对应一条规则，并必须包含以下英文字段键：
    * \`category\`: (字符串) 对应规则中指定的问题类别 (例如 "Object Perception", "Causal Reasoning" 等英文键值)。
    * \`question_type\`: (字符串) 必须为 "${FIXED_QUESTION_TYPE}"。
    * \`difficulty\`: (字符串) 对应规则中指定的难度 (例如 "Intermediate", "Advanced" 等英文键值)。
    * \`timestamp_start\`: (字符串) "MM:SS"格式的起始时间。
    * \`timestamp_end\`: (字符串) "MM:SS"格式的结束时间。
    * \`question\`: (字符串) 生成的选择题问题文本。
    * \`answer\`: (字符串) 对于选择题的正确答案的详细解释，而不仅仅是选项字母。
    * \`options\`: (必须提供) 一个包含4个选项字符串的数组 [A, B, C, D]，其中一个必须是正确答案。干扰选项需具有迷惑性但基于视觉上可能的混淆。

**具体生成规则列表如下:**
${rulesDescription}

**任务开始**: 请分析接下来的视频，并严格按照上述所有通用准则和具体的 ${rules.length} 条规则列表，生成相应的 ${rules.length} 个选择题问答对。确保JSON格式的有效性，并且JSON中的 'category', 'question_type', 'difficulty' 字段值使用英文键值。
        `;
    }

    // --- Submit Button Logic ---
    submitButton.addEventListener('click', async () => {
        const userApiKey = apiKeyInput.value.trim();
        if (!userApiKey) {
            showError("请输入您的 Google API 密钥。");
            updateStatus("API 密钥未填写", true);
            apiKeyInput.focus();
            return;
        }

        if (selectedQaRules.length === 0) {
            showError(`请至少添加 1 条规则。`);
            updateStatus(`需要至少 1 条规则`, true);
            return;
        }
        if (selectedQaRules.length > MAX_RULES) {
            showError(`规则数量不能超过 ${MAX_RULES} 条。`);
            updateStatus(`规则过多`, true);
            return;
        }
        if (!currentBase64VideoData || !currentMimeType) {
            showError("请先选择一个视频文件。");
            updateStatus("未选择视频文件", true);
            return;
        }

        const metaPrompt = buildMetaPromptForUserSelectedQA(selectedQaRules);
        const selectedModel = modelSelector.value;

        totalProcessingStartTime = performance.now();
        timingInfoDisplay.classList.remove('hidden');
        apiCallTimeDisplay.textContent = "0.00 s"; // Initialize immediately for real-time update
        totalProcessingTimeDisplay.textContent = "处理中...";
        hideError();
        responseContainer.classList.add('hidden');
        initialMessageDiv.classList.remove('hidden'); // Show initial message again
        geminiResponseOutput.innerHTML = '';

        showLoading(true);
        updateStatus("正在构建指令并发送请求...");

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${userApiKey}`;

        const payload = {
            contents: [{ role: "user", parts: [{ text: metaPrompt }, { inline_data: { mime_type: currentMimeType, data: currentBase64VideoData } }] }],
            generationConfig: { responseMimeType: "application/json" }
        };

        console.log(`[API Call] Sending Meta-Prompt to ${selectedModel}.`);
        updateStatus(`正在请求 ${selectedModel} 按 ${selectedQaRules.length} 条规则生成问答对...`);
        apiCallStartTime = performance.now();

        // Start real-time API call timer
        apiTimerInterval = setInterval(() => {
            const elapsed = performance.now() - apiCallStartTime;
            apiCallTimeDisplay.textContent = formatTime(elapsed);
        }, 100); // Update every 100ms

        try {
            const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

            // Stop the real-time timer once response is received
            clearInterval(apiTimerInterval);
            apiTimerInterval = null;

            const apiCallEndTime = performance.now();
            const apiDuration = apiCallEndTime - apiCallStartTime;
            apiCallTimeDisplay.textContent = formatTime(apiDuration); // Final update

            updateStatus(`收到 API 响应 (状态码: ${response.status})。正在处理...`);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: { message: "无法解析错误响应体" } }));
                throw new Error(`API 请求失败: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`);
            }

            const result = await response.json();
            if (result.candidates && result.candidates[0].content.parts[0].text) {
                const responseJsonText = result.candidates[0].content.parts[0].text;
                try {
                    const qaDataArray = JSON.parse(responseJsonText);
                    displayQAData(qaDataArray);
                    updateStatus(`已成功生成并显示 ${qaDataArray.length} 个问答对。`);
                    initialMessageDiv.classList.add('hidden'); // Hide initial message on success
                } catch (parseError) {
                    showError("Gemini返回的不是有效的JSON格式。请查看控制台。原始文本如下：");
                    geminiResponseOutput.textContent = responseJsonText;
                    responseContainer.classList.remove('hidden');
                    updateStatus("JSON解析失败", true);
                    console.error("JSON Parse Error:", parseError, "Raw text:", responseJsonText);
                }
            } else {
                let errorMessageContent = "未能从 Gemini 获取有效回复，或回复结构不符合预期。";
                if (result.promptFeedback && result.promptFeedback.blockReason) {
                    errorMessageContent += ` 原因: ${result.promptFeedback.blockReason}.`;
                    if (result.promptFeedback.safetyRatings) {
                         errorMessageContent += ` 安全评分: ${JSON.stringify(result.promptFeedback.safetyRatings)}`;
                    }
                }
                console.error('[API Call Error] Unexpected API response structure:', result);
                showError(errorMessageContent);
                updateStatus(errorMessageContent, true);
            }
        } catch (error) {
            // Ensure timer is cleared even on error
            if (apiTimerInterval) {
                clearInterval(apiTimerInterval);
                apiTimerInterval = null;
            }
            const apiCallEndTimeOnError = performance.now();
            if (apiCallStartTime) apiCallTimeDisplay.textContent = formatTime(apiCallEndTimeOnError - apiCallStartTime);
            else apiCallTimeDisplay.textContent = "请求失败";
            showError(`请求 Gemini API 时发生错误: ${error.message}`);
            updateStatus(`请求 Gemini API 失败: ${error.message}`, true);
            console.error('[API Call Error]', error);
        } finally {
            const totalProcessingEndTime = performance.now();
            if (totalProcessingStartTime) totalProcessingTimeDisplay.textContent = formatTime(totalProcessingEndTime - totalProcessingStartTime);
            showLoading(false);
        }
    });

    function displayQAData(qaArray) {
        geminiResponseOutput.innerHTML = '';
        if (!Array.isArray(qaArray)) {
            showError("返回的数据格式不正确 (不是数组)。");
            geminiResponseOutput.textContent = "原始数据: " + JSON.stringify(qaArray, null, 2);
            responseContainer.classList.remove('hidden');
            return;
        }
        if (qaArray.length === 0) {
            geminiResponseOutput.textContent = "Gemini 未能生成任何问答对。";
            responseContainer.classList.remove('hidden');
            return;
        }
        qaArray.forEach((qa, index) => {
            const card = document.createElement('div');
            card.className = 'p-4 border border-gray-300 rounded-lg mb-3 bg-gray-50 shadow';
            let optionsHTML = '';
            if (qa.question_type === FIXED_QUESTION_TYPE && Array.isArray(qa.options)) {
                optionsHTML = `<ol class="list-alpha list-inside mt-2 space-y-1 pl-4 text-gray-700">` +
                              qa.options.map(opt => `<li>${escapeHtml(opt)}</li>`).join('') + `</ol>`;
            }
            const categoryDisplay = keyToChineseMap[qa.category] || qa.category;
            const typeDisplay = keyToChineseMap[qa.question_type] || qa.question_type;
            const difficultyDisplay = keyToChineseMap[qa.difficulty] || qa.difficulty;

            card.innerHTML = `
                <div class="flex justify-between items-center mb-2 pb-2 border-b border-gray-200">
                    <h3 class="font-semibold text-md text-indigo-700">问答 ${index + 1}</h3>
                    <div class="flex space-x-2 text-xs">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-medium">${escapeHtml(categoryDisplay)}</span>
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full bg-pink-100 text-pink-800 font-medium">${escapeHtml(difficultyDisplay)}</span>
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full bg-green-100 text-green-800 font-medium">${escapeHtml(typeDisplay)}</span>
                    </div>
                </div>
                <div class="space-y-2 text-sm">
                    <p class="text-gray-500"><strong>时间戳:</strong> ${escapeHtml(qa.timestamp_start || 'N/A')} - ${escapeHtml(qa.timestamp_end || 'N/A')}</p>
                    <div><p class="font-medium text-gray-800">问题:</p><p class="mt-1 text-gray-700">${escapeHtml(qa.question)}</p>${optionsHTML}</div>
                    <div><p class="font-medium text-gray-800">答案/解释:</p><p class="mt-1 text-gray-700 leading-relaxed">${escapeHtml(qa.answer)}</p></div>
                </div>`;
            geminiResponseOutput.appendChild(card);
        });
        responseContainer.classList.remove('hidden');
    }

    function escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') return String(unsafe);
        return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    function formatTime(milliseconds) { if (milliseconds === undefined || milliseconds === null) return "N/A"; if (milliseconds < 1000) { return `${milliseconds.toFixed(0)} ms`; } return `${(milliseconds / 1000).toFixed(2)} s`; }
    function updateStatus(message, isError = false) { console.log(`Status: ${message}`); if (message) { statusMessage.textContent = message; statusMessageContainer.classList.remove('hidden'); if (isError) { statusMessageContainer.classList.remove('text-blue-600', 'bg-blue-50'); statusMessageContainer.classList.add('text-red-700', 'bg-red-100'); } else { statusMessageContainer.classList.remove('text-red-700', 'bg-red-100'); statusMessageContainer.classList.add('text-blue-600', 'bg-blue-50'); } } else { statusMessageContainer.classList.add('hidden'); } }

    function showLoading(isLoading) {
        if (isLoading) {
            loader.classList.remove('hidden');
            buttonText.textContent = '处理中...';
            submitButton.disabled = true;
            submitButton.classList.add('opacity-75', 'cursor-not-allowed');
        } else {
            loader.classList.add('hidden');
            const rulesCount = selectedQaRules.length;
            if (rulesCount > 0 && rulesCount <= MAX_RULES) {
                buttonText.textContent = `让 Gemini 按列表生成 ${rulesCount} 个问答对`;
            } else {
                 buttonText.textContent = `让 Gemini 按列表生成问答对`;
            }
            const userApiKey = apiKeyInput.value.trim();
            submitButton.disabled = !(userApiKey && selectedQaRules.length > 0 && selectedQaRules.length <= MAX_RULES && currentBase64VideoData);
            submitButton.classList.remove('opacity-75', 'cursor-not-allowed');
        }
    }

    function showError(message) { errorMessageText.textContent = message; errorMessageDiv.classList.remove('hidden'); }
    function hideError() { errorMessageDiv.classList.add('hidden'); errorMessageText.textContent = ''; }

    videoFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        fileReadProgressContainer.classList.add('hidden'); fileReadProgressBar.value = 0; fileReadTimeDisplay.textContent = ''; videoPreviewContainer.classList.add('hidden'); currentBase64VideoData = null; currentMimeType = null; timingInfoDisplay.classList.add('hidden'); apiCallTimeDisplay.textContent = "N/A"; totalProcessingTimeDisplay.textContent = "N/A"; hideError(); updateStatus("");
        responseContainer.classList.add('hidden'); // Ensure response container is hidden on new file selection
        initialMessageDiv.classList.remove('hidden'); // Show initial message

        // Clear any running API timer if a new file is selected mid-process
        if (apiTimerInterval) {
            clearInterval(apiTimerInterval);
            apiTimerInterval = null;
            apiCallTimeDisplay.textContent = "N/A"; // Reset timer display
        }

        const userApiKey = apiKeyInput.value.trim();
        submitButton.disabled = !(userApiKey && selectedQaRules.length > 0 && selectedQaRules.length <= MAX_RULES && currentBase64VideoData);

        if (file) {
            updateStatus(`正在处理文件: ${file.name}`);
            if (file.size > 20 * 1024 * 1024) { const errorMsg = "视频文件过大 (超过20MB)。"; showError(errorMsg); updateStatus(errorMsg, true); videoFileInput.value = ""; return; }
            const reader = new FileReader();
            reader.onloadstart = () => { fileReadStartTime = performance.now(); fileReadProgressContainer.classList.remove('hidden'); fileReadProgressBar.value = 0; fileReadTimeDisplay.textContent = "读取中..."; updateStatus(`开始读取: ${file.name}`); };
            reader.onprogress = (e) => { if (e.lengthComputable) { fileReadProgressBar.value = Math.round((e.loaded / e.total) * 100); } };
            reader.onload = (e) => {
                const duration = performance.now() - fileReadStartTime; fileReadTimeDisplay.textContent = `耗时: ${formatTime(duration)}`; fileReadProgressBar.value = 100; videoPreviewPlayer.src = e.target.result; videoPreviewContainer.classList.remove('hidden');
                const parts = e.target.result.split(',');
                if (parts.length === 2) { currentBase64VideoData = parts[1]; currentMimeType = parts[0].substring(parts[0].indexOf(':') + 1, parts[0].indexOf(';')); updateStatus(`视频 "${file.name}" 已就绪。`);
                const userApiKey = apiKeyInput.value.trim();
                submitButton.disabled = !(userApiKey && selectedQaRules.length > 0 && selectedQaRules.length <= MAX_RULES && currentBase64VideoData);
            } else { const errorMsg = "无法解析视频文件数据。"; showError(errorMsg); updateStatus("文件解析失败", true); }
            };
            reader.onerror = () => { const errorMsg = "读取视频文件失败。"; showError(errorMsg); updateStatus("文件读取错误", true); };
            reader.readAsDataURL(file);
        }
    });

    // --- Initializations ---
    loadSettings(); // Load saved API key and model on page start
    initializeCategorySelector();
    updateSelectedRulesUI();
});
