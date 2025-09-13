class SetupI18n {
    constructor() {
        this.currentLanguage = 'en';
        this.fallbackLanguage = 'en';
        this.translations = {};
        this.supportedLanguages = ['en', 'zh-Hans'];
        
        this.pluralRules = {
            'en': (count) => {
                if (count === 0) return 'zero';
                if (count === 1) return 'one';
                return 'other';
            },
            'zh-Hans': (count) => {
                if (count === 0) return 'zero';
                return 'other';
            }
        };
    }

    async init() {
        await this.detectLanguage();
        await this.loadTranslations();
        this.applyTranslations();
        
        document.addEventListener('languageChanged', () => {
            this.applyTranslations();
        });
    }

    async detectLanguage() {
        const savedLang = localStorage.getItem('baklab_setup_lang');
        if (savedLang && this.supportedLanguages.includes(savedLang)) {
            this.currentLanguage = savedLang;
            return;
        }

        const browserLang = navigator.language || navigator.userLanguage;
        const langMap = {
            'zh-CN': 'zh-Hans',
            'zh-SG': 'zh-Hans'
        };

        let detectedLang = langMap[browserLang] || browserLang.split('-')[0];
        
        if (this.supportedLanguages.includes(detectedLang)) {
            this.currentLanguage = detectedLang;
        }
    }

    async loadTranslations() {
        try {
            const response = await fetch(`/static/i18n/${this.currentLanguage}.json`);
            if (response.ok) {
                this.translations[this.currentLanguage] = await response.json();
            } else {
                this.loadBuiltinTranslations();
            }

            if (this.currentLanguage !== this.fallbackLanguage) {
                const fallbackResponse = await fetch(`/static/i18n/${this.fallbackLanguage}.json`);
                if (fallbackResponse.ok) {
                    this.translations[this.fallbackLanguage] = await fallbackResponse.json();
                } else {
                    this.loadBuiltinTranslations();
                }
            }
        } catch (error) {
            console.warn('Failed to load translations:', error);
            this.loadBuiltinTranslations();
        }
    }
    loadBuiltinTranslations() {
        this.translations = {
            'en': {
                common: { next: "Next", previous: "Previous", save: "Save", cancel: "Cancel", loading: "Loading..." },
                setup: { title: "BakLab Setup", page_title: "BakLab Setup", welcome: "Welcome to BakLab Setup" }
            },
            'zh-Hans': {
                common: { next: "下一步", previous: "上一步", save: "保存", cancel: "取消", loading: "加载中..." },
                setup: { title: "BakLab 设置", page_title: "BakLab 设置", welcome: "欢迎使用 BakLab 设置向导" }
            }
        };
    }

    t(key, params = {}) {
        const value = this.getTranslationValue(key);
        if (!value) return key;
        
        if (typeof value === 'string') {
            return this.interpolateVariables(value, params);
        }
        
        if (typeof value === 'object' && value !== null) {
            return this.handlePluralObject(value, params);
        }
        
        return key;
    }
    getTranslationValue(key) {
        const keys = key.split('.');
        let value = this.translations[this.currentLanguage];
        
        // 尝试从当前语言获取
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                value = null;
                break;
            }
        }
        
        // 如果当前语言没有，尝试fallback语言
        if (value === null && this.currentLanguage !== this.fallbackLanguage) {
            value = this.translations[this.fallbackLanguage];
            for (const k of keys) {
                if (value && typeof value === 'object' && k in value) {
                    value = value[k];
                } else {
                    value = null;
                    break;
                }
            }
        }
        
        return value;
    }

    // 处理复数对象
    handlePluralObject(pluralObj, params) {
        // 查找复数键，通常是第一个数字类型的参数
        let countKey = null;
        let count = 0;
        
        // 智能查找count参数
        for (const [key, value] of Object.entries(params)) {
            if (typeof value === 'number') {
                countKey = key;
                count = value;
                break;
            }
        }
        
        // 如果没找到数字参数，尝试常见的键名
        if (countKey === null) {
            const commonCountKeys = ['count', 'num', 'number', 'length'];
            for (const key of commonCountKeys) {
                if (key in params && typeof params[key] === 'number') {
                    countKey = key;
                    count = params[key];
                    break;
                }
            }
        }
        
        // 根据复数规则选择合适的形式
        const pluralRule = this.pluralRules[this.currentLanguage] || this.pluralRules['en'];
        const pluralForm = pluralRule(count);
        
        // 按优先级选择复数形式
        let selectedText = pluralObj[pluralForm] || pluralObj['other'] || pluralObj['one'] || pluralObj['zero'];
        
        // 如果还没找到，取对象中第一个字符串值
        if (!selectedText) {
            for (const value of Object.values(pluralObj)) {
                if (typeof value === 'string') {
                    selectedText = value;
                    break;
                }
            }
        }
        
        // 如果count参数存在但selectedText中没有显式使用，添加到params中
        if (countKey && selectedText) {
            params = { ...params, count };
        }
        
        return selectedText ? this.interpolateVariables(selectedText, params) : '';
    }

    // 变量插值
    interpolateVariables(template, params) {
        return template.replace(/\{\{(\w+)\}\}/g, (match, paramKey) => {
            return params[paramKey] !== undefined ? String(params[paramKey]) : match;
        });
    }

    // 设置语言并重新应用翻译
    async setLanguage(lang) {
        if (!this.supportedLanguages.includes(lang)) {
            console.warn(`Unsupported language: ${lang}`);
            return;
        }

        this.currentLanguage = lang;
        localStorage.setItem('baklab_setup_lang', lang);

        // 重新加载翻译
        await this.loadTranslations();
        
        // 触发语言切换事件，让app重新渲染
        document.dispatchEvent(new CustomEvent('languageChanged', { 
            detail: { language: lang } 
        }));
        
        // 如果存在全局app实例，重新渲染页面
        if (window.app && typeof window.app.render === 'function') {
            window.app.render();
        } else {
            // 重新应用翻译到现有元素
            this.applyTranslations();
        }
    }

    // 应用翻译到页面元素
    applyTranslations() {
        // 更新页面标题
        document.title = this.t('setup.page_title');
        
        // 处理带有data-i18n属性的元素
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const paramsAttr = element.getAttribute('data-i18n-params');
            const params = paramsAttr ? JSON.parse(paramsAttr) : {};
            
            element.textContent = this.t(key, params);
        });

        // 处理带有data-i18n-html属性的元素（支持HTML内容）
        document.querySelectorAll('[data-i18n-html]').forEach(element => {
            const key = element.getAttribute('data-i18n-html');
            const paramsAttr = element.getAttribute('data-i18n-params');
            const params = paramsAttr ? JSON.parse(paramsAttr) : {};
            
            element.innerHTML = this.t(key, params);
        });

        // 处理带有data-i18n-placeholder属性的输入元素
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            const paramsAttr = element.getAttribute('data-i18n-params');
            const params = paramsAttr ? JSON.parse(paramsAttr) : {};
            
            element.placeholder = this.t(key, params);
        });

        // 处理带有data-i18n-title属性的元素
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            const paramsAttr = element.getAttribute('data-i18n-params');
            const params = paramsAttr ? JSON.parse(paramsAttr) : {};
            
            element.title = this.t(key, params);
        });

        // 处理带有data-i18n-value属性的元素
        document.querySelectorAll('[data-i18n-value]').forEach(element => {
            const key = element.getAttribute('data-i18n-value');
            const paramsAttr = element.getAttribute('data-i18n-params');
            const params = paramsAttr ? JSON.parse(paramsAttr) : {};
            
            element.value = this.t(key, params);
        });
    }

    // 获取当前语言
    getCurrentLanguage() {
        return this.currentLanguage;
    }

    // 获取支持的语言列表
    getSupportedLanguages() {
        return this.supportedLanguages.map(lang => ({
            code: lang,
            name: this.getLanguageName(lang)
        }));
    }

    // 获取语言的本地化名称
    getLanguageName(langCode) {
        const languageNames = {
            'en': 'English',
            'zh-Hans': '中文 (简体)'
        };
        return languageNames[langCode] || langCode;
    }

    // 生成语言选择器HTML
    generateLanguageSelector(containerId, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.warn(`Language selector container not found: ${containerId}`);
            return;
        }

        const {
            showLabel = true,
            labelKey = 'common.language',
            className = 'language-selector',
            style = 'dropdown' // 'dropdown' or 'buttons'
        } = options;

        let html = '';
        
        if (showLabel) {
            html += `<label class="language-label">${this.t(labelKey)}</label>`;
        }

        if (style === 'dropdown') {
            html += `<select class="${className}" onchange="window.i18n.setLanguage(this.value)">`;
            this.supportedLanguages.forEach(lang => {
                const selected = lang === this.currentLanguage ? 'selected' : '';
                html += `<option value="${lang}" ${selected}>${this.getLanguageName(lang)}</option>`;
            });
            html += '</select>';
        } else if (style === 'buttons') {
            html += `<div class="${className}">`;
            this.supportedLanguages.forEach(lang => {
                const active = lang === this.currentLanguage ? 'active' : '';
                html += `<button class="lang-btn ${active}" onclick="window.i18n.setLanguage('${lang}')" data-lang="${lang}">
                    ${this.getLanguageName(lang)}
                </button>`;
            });
            html += '</div>';
        }

        container.innerHTML = html;
    }

    // 工具方法：格式化日期
    formatDate(date, options = {}) {
        const locale = this.currentLanguage === 'zh-Hans' ? 'zh-CN' : 'en-US';
        return new Intl.DateTimeFormat(locale, options).format(new Date(date));
    }

    // 工具方法：格式化数字
    formatNumber(number, options = {}) {
        const locale = this.currentLanguage === 'zh-Hans' ? 'zh-CN' : 'en-US';
        return new Intl.NumberFormat(locale, options).format(number);
    }
}

window.i18n = new SetupI18n();

document.addEventListener('DOMContentLoaded', async () => {
    await window.i18n.init();
    console.log('Setup i18n initialized with language:', window.i18n.getCurrentLanguage());
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SetupI18n;
}

// 测试函数
function testI18n() {
    console.log('=== i18n 测试开始 ===');
    
    const testData = {
        'en': {
            welcome: "Welcome {{name}}!",
            items: { zero: "No items", one: "{{count}} item", other: "{{count}} items" },
            nested: { deep: { value: "Deep value: {{value}}" } }
        },
        'zh-Hans': {
            welcome: "欢迎 {{name}}！",
            items: { zero: "没有项目", other: "{{count}} 个项目" },
            nested: { deep: { value: "深层值：{{value}}" } }
        }
    };
    
    const i18nTest = new SetupI18n();
    i18nTest.translations = testData;
    
    const testCases = [
        { lang: 'en', key: 'welcome', params: { name: 'Alice' }, expected: 'Welcome Alice!' },
        { lang: 'en', key: 'items', params: { count: 0 }, expected: 'No items' },
        { lang: 'en', key: 'items', params: { count: 1 }, expected: '1 item' },
        { lang: 'en', key: 'items', params: { count: 5 }, expected: '5 items' },
        { lang: 'en', key: 'nested.deep.value', params: { value: 'test' }, expected: 'Deep value: test' },
        { lang: 'zh-Hans', key: 'welcome', params: { name: '张三' }, expected: '欢迎 张三！' },
        { lang: 'zh-Hans', key: 'items', params: { count: 0 }, expected: '没有项目' },
        { lang: 'zh-Hans', key: 'items', params: { count: 5 }, expected: '5 个项目' },
        { lang: 'zh-Hans', key: 'nested.deep.value', params: { value: '测试' }, expected: '深层值：测试' }
    ];
    
    let passed = 0;
    let total = testCases.length;
    
    testCases.forEach((test, index) => {
        i18nTest.currentLanguage = test.lang;
        const result = i18nTest.t(test.key, test.params);
        const success = result === test.expected;
        
        console.log(`Test ${index + 1}: ${success ? '✅' : '❌'} [${test.lang}] ${test.key}`);
        if (!success) {
            console.log(`  Expected: ${test.expected}`);
            console.log(`  Got: ${result}`);
        }
        
        if (success) passed++;
    });
    
    console.log(`\n测试结果: ${passed}/${total} 通过`);
    console.log('=== i18n 测试结束 ===');
    
    return passed === total;
}

// 自动运行测试 (仅在开发环境)
if (window.location.search.includes('test=true')) {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(testI18n, 1000);
    });
}