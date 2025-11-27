var F=class{constructor(e=null){this.token=null,this.i18n=e,this.requestLocks={initialize:!1,complete:!1,generateConfig:!1,testDatabase:!1,testRedis:!1,testSMTP:!1,saveConfig:!1,geoFileUpload:!1}}setI18n(e){this.i18n=e}setToken(e){this.token=e}async api(e,t,s=null){let a={method:e,headers:{"Content-Type":"application/json"}};this.token&&(a.headers["Setup-Token"]=this.token),this.i18n&&this.i18n.getCurrentLanguage&&(a.headers["X-Language"]=this.i18n.getCurrentLanguage()),s&&(a.body=JSON.stringify(s));let r=await fetch(t,a),o=await r.json();if(!r.ok){if(o.errors&&o.errors.length>0){let n=this.i18n?this.i18n.t("messages.errors.validation_failed"):"Validation failed",l=new Error(o.message||n);throw l.validationErrors=o.errors,l}let d=this.i18n?this.i18n.t("messages.errors.request_failed"):"Request failed";throw new Error(o.message||d)}return o}acquireLock(e){return this.requestLocks[e]?!1:(this.requestLocks[e]=!0,!0)}releaseLock(e){this.requestLocks[e]=!1}async protectedApiCall(e,t,s){if(!this.acquireLock(e))return null;try{return await t()}catch(a){throw s&&s(a),a}finally{this.releaseLock(e)}}async initialize(){return this.api("POST","/api/initialize")}async getStatus(){return this.api("GET","/api/status")}async getConfig(){return this.api("GET","/api/config")}async saveConfig(e,t=null){let s=t!==null?{...e,current_step:t}:e;return this.api("POST","/api/config",s)}async getGeoFileStatus(){return this.api("GET","/api/geo-file/status")}async uploadGeoFile(e,t,s){let a=new FormData;return a.append("geo_file",e),new Promise((r,o)=>{let d=new XMLHttpRequest;d.upload.addEventListener("progress",n=>{if(n.lengthComputable&&t){let l=n.loaded/n.total*100;t(l,n.loaded,n.total)}}),d.addEventListener("load",()=>{if(d.status===200)try{let n=JSON.parse(d.responseText);r(n)}catch{let l=this.i18n?this.i18n.t("messages.errors.invalid_response"):"Invalid response format";o(new Error(l))}else try{let n=JSON.parse(d.responseText),l=this.i18n?this.i18n.t("messages.errors.upload_failed"):"Upload failed";o(new Error(n.message||l))}catch{let l=this.i18n?this.i18n.t("messages.errors.upload_failed"):"Upload failed";o(new Error(l))}}),d.addEventListener("error",()=>{let n=this.i18n?this.i18n.t("messages.errors.network_error_upload"):"Network error during upload",l=new Error(n);s&&s(l),o(l)}),d.addEventListener("abort",()=>{let n=this.i18n?this.i18n.t("messages.errors.upload_cancelled"):"Upload cancelled",l=new Error(n);s&&s(l),o(l)}),d.open("POST","/api/upload/geo-file"),this.token&&d.setRequestHeader("Setup-Token",this.token),d.send(a)})}async getCurrentCertPaths(){return(await fetch("/api/current-cert-paths",{headers:{"Setup-Token":this.token}})).json()}async testConnections(e,t){return this.api("POST","/api/test-connections",{type:e,...t})}async generateConfig(e){return this.api("POST","/api/generate",e)}async completeSetup(){return this.api("POST","/api/complete")}};function H(i,e=null){if(i===0)return"0 "+(e?e.t("common.file_size_units.bytes"):"Bytes");let t=1024,s=["bytes","kb","mb","gb"],a=Math.floor(Math.log(i)/Math.log(t)),r=e?e.t(`common.file_size_units.${s[a]}`):s[a].toUpperCase();return Math.round(i/Math.pow(t,a)*100)/100+" "+r}var N="baklab_setup_config";function W(i){try{localStorage.setItem(N,JSON.stringify(i))}catch(e){console.warn("Failed to save to localStorage:",e)}}function J(i={}){try{let e=localStorage.getItem(N);return e?{...i,...JSON.parse(e)}:i}catch(e){return console.warn("Failed to load from localStorage:",e),i}}function Y(){try{localStorage.removeItem(N)}catch(i){console.warn("Failed to clear localStorage:",i)}}async function X(i,e,t,s={}){let{onSuccess:a,onValidationError:r,onError:o}=s;try{return await t.protectedApiCall("saveConfig",async()=>{let n={...i,current_step:e},l=await t.saveConfig(n);return l.success&&a&&a(l),l},n=>{n.validationErrors&&n.validationErrors.length>0?r&&r(n.validationErrors):o&&o(n)})}catch(d){throw console.error("Configuration validation failed:",d),d}}async function Q(i,e,t,s={}){let{onValidationError:a,onError:r}=s;try{return await t.protectedApiCall("saveConfig",async()=>{let d={...i,current_step:e};return await t.saveConfig(d)},d=>{d.validationErrors&&d.validationErrors.length>0?a&&a(d.validationErrors):r&&r(d)})}catch(o){throw r&&r(o),o}}var V=class{constructor(e={}){this._config=e,this._listeners=[]}get(e){if(!e)return this._config;let t=e.split("."),s=this._config;for(let a of t)s=s?.[a];return s}set(e,t){let s=e.split("."),a=s.pop(),r=this._config;for(let o of s)r[o]||(r[o]={}),r=r[o];r[a]=t,this._notify()}update(e){this._config={...this._config,...e},this._notify()}getAll(){return this._config}setAll(e){this._config=e,this._notify()}saveToLocalCache(){W(this._config)}loadFromLocalCache(){this._config=J(this._config),this._notify()}clearLocalCache(){Y()}async saveWithValidation(e,t,s={}){return await X(this._config,e,t,s)}async save(e,t,s={}){return await Q(this._config,e,t,s)}subscribe(e){return this._listeners.push(e),()=>{this._listeners=this._listeners.filter(t=>t!==e)}}_notify(){this._listeners.forEach(e=>e(this._config))}};var P=class{constructor(e,t,s){this._steps=e,this._getCurrentStep=t,this._setCurrentStep=s}getCurrentStepKey(){let e=this._getCurrentStep();return this._steps[e].key}nextStep(){let e=this._getCurrentStep();e<this._steps.length-1&&this._setCurrentStep(e+1)}previousStep(){let e=this._getCurrentStep();e>0&&this._setCurrentStep(e-1)}goToStep(e){e>=0&&e<this._steps.length&&this._setCurrentStep(e)}};function O(i){let e=/^[A-Za-z\d!@#$%^&*]{12,64}$/,t=/[a-z]/,s=/[A-Z]/,a=/\d/,r=/[!@#$%^&*]/;return e.test(i)&&t.test(i)&&s.test(i)&&a.test(i)&&r.test(i)}function C(i){let e=/^[A-Za-z\d!@#$%^&*]{12,64}$/,t=/[a-z]/,s=/[A-Z]/,a=/\d/,r=/[!@#$%^&*]/;if(!e.test(i))return!1;let o=0;return t.test(i)&&o++,s.test(i)&&o++,a.test(i)&&o++,r.test(i)&&o++,o>=3}function L(i){if(!i||i.length===0||i.length>128)return!1;for(let e=0;e<i.length;e++){let t=i.charCodeAt(e);if(t<32||t===127)return!1}return!0}function E(i){let e=i.querySelectorAll(":invalid");e.forEach(s=>{let a=s.closest(".form-group");if(a){a.classList.add("error");let r=a.querySelector(".invalid-feedback");r&&(r.style.display="block")}}),i.querySelectorAll(":valid").forEach(s=>{let a=s.closest(".form-group");if(a){a.classList.remove("error");let r=a.querySelector(".invalid-feedback");r&&(r.style.display="none")}}),e.length>0&&(e[0].focus(),e[0].scrollIntoView({behavior:"smooth",block:"center"}))}function B(i){i.querySelectorAll(".form-group.error").forEach(t=>{t.classList.remove("error");let s=t.querySelector(".invalid-feedback");s&&(s.style.display="none",s.textContent="")})}function k(i){i.querySelectorAll("input, select, textarea").forEach(t=>{let s=()=>{let a=t.closest(".form-group");a&&a.classList.add("touched")};t.addEventListener("input",s),t.addEventListener("change",s),t.addEventListener("blur",s)})}function q(i,e){let t=i.closest(".form-group");if(t){t.classList.add("error");let s=t.querySelector(".invalid-feedback");s&&setTimeout(()=>{s.textContent=e,s.style.display="block"},0)}}function S(i,e){let t=i.closest(".form-group");if(t){t.classList.add("error");let s=t.querySelector(".invalid-feedback");s&&(s.textContent=e,s.style.display="block"),i.style.borderColor="#dc2626"}}function b(i){let e=i.closest(".form-group");if(e){e.classList.remove("error");let t=e.querySelector(".invalid-feedback");t&&(t.style.display="none"),i.style.borderColor=""}}function x(i,e=null){document.querySelectorAll(".alert").forEach(o=>o.remove());let s=document.createElement("div");s.className="alert alert-error validation-errors";let a=document.createElement("div");a.className="validation-error-title",a.textContent=e?e.t("messages.fix_errors"):"Please fix the validation errors below and try again.",s.appendChild(a);let r=document.createElement("ul");r.className="validation-error-list",i.forEach(o=>{let d=document.createElement("li");d.className="validation-error-item";let n=e?e.t("messages.errors.validation_error_generic"):"Validation error",l=o.message||n;d.textContent=l,r.appendChild(d)}),s.appendChild(r),document.querySelector(".setup-card").insertBefore(s,document.getElementById("step-content")),setTimeout(()=>{s.parentNode&&s.parentNode.removeChild(s)},1e4)}function ee(i,e,t,s={}){let{i18n:a=null,showCustomErrorFn:r=null,hideCustomErrorFn:o=null,errorMessages:d={}}=s;if(!e)return i.setCustomValidity(""),o&&o(i),!0;let n=!1,l="";switch(t){case"admin":n=O(e),l=d.admin||(a?a.t("setup.admin.password_error"):"Password must contain lowercase, uppercase, numbers, and special characters (!@#$%^&*)");break;case"database":n=C(e),l=d.database||(a?a.t("setup.database.password_error"):"Password must be 12-64 characters with at least 3 types: lowercase, uppercase, numbers, special characters (!@#$%^&*)");break;case"external":n=L(e),l=d.external||(a?a.t("setup.password_external_error"):"Password must be 1-128 characters and cannot contain control characters");break;default:throw new Error(`Unknown validation mode: ${t}`)}return n?(i.setCustomValidity(""),o&&o(i)):(i.setCustomValidity(l),r&&r(i,l)),n}var z=class{constructor(e){this.i18n=e}updateRadioStyles(e){document.querySelectorAll(`input[name="${e}"]`).forEach(s=>{let a=s.closest(".radio-option");s.checked?a.classList.add("selected"):a.classList.remove("selected")})}showAlert(e,t){let s=document.createElement("div");s.className=`alert alert-${e}`,s.textContent=this.i18n&&t.includes(".")?this.i18n.t(t):t;let a=document.querySelector(".setup-card");a&&a.insertBefore(s,document.getElementById("step-content")),setTimeout(()=>{s.parentNode&&s.parentNode.removeChild(s)},5e3)}showValidationErrors(e){x(e,this.i18n)}};var M=class{constructor(e,t,s,a){this._store=e,this._navigation=t,this._apiClient=s,this._ui=a}get(e){return this._store.get(e)}set(e,t){this._store.set(e,t)}update(e){this._store.update(e)}getAll(){return this._store.getAll()}saveToLocalCache(){this._store.saveToLocalCache()}async saveWithValidation(){return await this._store.saveWithValidation(this._navigation.getCurrentStepKey(),this._apiClient,{onSuccess:()=>this._navigation.nextStep(),onValidationError:e=>this._ui.showValidationErrors(e),onError:e=>this._ui.showAlert("error",e.message)})}async save(){return await this._store.save(this._navigation.getCurrentStepKey(),this._apiClient,{onValidationError:e=>this._ui.showValidationErrors(e),onError:e=>this._ui.showAlert("error",e.message)})}};var j=class{constructor(e,t,s,a,r){this.apiClient=e,this.navigation=t,this.ui=s,this.config=a,this.i18n=r,this.token=null,this.outputPath=null}async initialize(){try{if(!await this.apiClient.protectedApiCall("initialize",async()=>{let t=await this.apiClient.initialize();return this.token=t.data.token,this.apiClient.setToken(this.token),window.app&&(window.app.token=this.token),this.navigation.nextStep(),t},t=>{t.validationErrors&&t.validationErrors.length>0?x(t.validationErrors,this.i18n):this.ui.showAlert("error",t.message)}))return}catch(e){console.error("Initialize error:",e)}}async generateConfig(e,t){let s=document.querySelector('button[onclick*="generateConfig"]')||document.getElementById("generate-config-btn");if(!s)return;let a=s.innerHTML;try{s.disabled=!0;let r=this.i18n?this.i18n.t("setup.review.generating"):"Generating...";return s.innerHTML=r,await this.apiClient.protectedApiCall("generateConfig",async()=>{await this.config.save();let o=await this.apiClient.generateConfig(this.config.getAll());return o.data&&o.data.output_path&&(this.outputPath=o.data.output_path),e&&e(),t&&t(),this.navigation.nextStep(),o},o=>{o.validationErrors&&o.validationErrors.length>0?this.ui.showValidationErrors(o.validationErrors):this.ui.showAlert("error",o.message)}),this.outputPath}catch(r){if(s.disabled=!1,s.innerHTML=a,this.i18n&&this.i18n.applyTranslations(),r.message&&r.message.includes("validation"))try{let o=JSON.parse(r.message.split("validation failed: ")[1]),d=this.i18n?this.i18n.t("setup.review.generation_failed"):"Configuration validation failed. Please check all fields and try again.";this.ui.showAlert("error",d)}catch{let d=this.i18n?this.i18n.t("setup.review.generation_failed"):"Configuration validation failed. Please check all fields and try again.";this.ui.showAlert("error",d)}else{let o=this.i18n?this.i18n.t("setup.review.generation_error"):"Configuration generation failed. Please try again.";this.ui.showAlert("error",o)}}}async completeSetup(e,t){try{await this.apiClient.protectedApiCall("complete",async()=>{await this.apiClient.completeSetup(),e&&e(),this.ui.showAlert("success",this.i18n?this.i18n.t("messages.setup_completed"):"Setup completed successfully! Your BakLab application is ready to use."),setTimeout(()=>{t&&t()},3e3)},s=>{s.validationErrors&&s.validationErrors.length>0?x(s.validationErrors,this.i18n):this.ui.showAlert("error",s.message)})}catch(s){console.error("Complete setup error:",s)}}};var T=class{constructor(){this.currentLanguage="en",this.fallbackLanguage="en",this.translations={},this.supportedLanguages=["en","zh-Hans"],this.pluralRules={en:e=>e===0?"zero":e===1?"one":"other","zh-Hans":e=>e===0?"zero":"other"}}async init(){await this.detectLanguage(),await this.loadTranslations(),this.applyTranslations(),document.addEventListener("languageChanged",()=>{this.applyTranslations()})}async detectLanguage(){let e=localStorage.getItem("baklab_setup_lang");if(e&&this.supportedLanguages.includes(e)){this.currentLanguage=e;return}let t=navigator.language||navigator.userLanguage,a={"zh-CN":"zh-Hans","zh-SG":"zh-Hans"}[t]||t.split("-")[0];this.supportedLanguages.includes(a)&&(this.currentLanguage=a)}async loadTranslations(){let e=!1;try{let t=await fetch(`/static/i18n/${this.currentLanguage}.json`);if(t.ok){let s=await t.json();this.translations[this.currentLanguage]=s,e=!0}else console.warn("Failed to fetch translations for",this.currentLanguage,"status:",t.status);if(this.currentLanguage!==this.fallbackLanguage){let s=await fetch(`/static/i18n/${this.fallbackLanguage}.json`);if(s.ok){let a=await s.json();this.translations[this.fallbackLanguage]=a}else console.warn("Failed to fetch fallback translations for",this.fallbackLanguage,"status:",s.status)}e||this.loadBuiltinTranslations()}catch(t){console.warn("Failed to load translations:",t),this.loadBuiltinTranslations()}}loadBuiltinTranslations(){this.translations={en:{common:{next:"Next",previous:"Previous",save:"Save",cancel:"Cancel",loading:"Loading..."},setup:{title:"BakLab Setup",page_title:"BakLab Setup",welcome:"Welcome to BakLab Setup"}},"zh-Hans":{common:{next:"\u4E0B\u4E00\u6B65",previous:"\u4E0A\u4E00\u6B65",save:"\u4FDD\u5B58",cancel:"\u53D6\u6D88",loading:"\u52A0\u8F7D\u4E2D..."},setup:{title:"BakLab \u8BBE\u7F6E",page_title:"BakLab \u8BBE\u7F6E",welcome:"\u6B22\u8FCE\u4F7F\u7528 BakLab \u8BBE\u7F6E\u5411\u5BFC"}}}}t(e,t={}){let s=this.getTranslationValue(e);return s?typeof s=="string"?this.interpolateVariables(s,t):typeof s=="object"&&s!==null?this.handlePluralObject(s,t):e:e}getTranslationValue(e){let t=e.split("."),s=this.translations[this.currentLanguage];for(let a of t)if(s&&typeof s=="object"&&a in s)s=s[a];else{s=null;break}if(s===null&&this.currentLanguage!==this.fallbackLanguage){s=this.translations[this.fallbackLanguage];for(let a of t)if(s&&typeof s=="object"&&a in s)s=s[a];else{s=null;break}}return s}handlePluralObject(e,t){let s=null,a=0;for(let[n,l]of Object.entries(t))if(typeof l=="number"){s=n,a=l;break}if(s===null){let n=["count","num","number","length"];for(let l of n)if(l in t&&typeof t[l]=="number"){s=l,a=t[l];break}}let o=(this.pluralRules[this.currentLanguage]||this.pluralRules.en)(a),d=e[o]||e.other||e.one||e.zero;if(!d){for(let n of Object.values(e))if(typeof n=="string"){d=n;break}}return s&&d&&(t={...t,count:a}),d?this.interpolateVariables(d,t):""}interpolateVariables(e,t){return e.replace(/\{\{(\w+)\}\}/g,(s,a)=>t[a]!==void 0?String(t[a]):s)}setLanguageChangeCallback(e){this.languageChangeCallback=e}async setLanguage(e){if(!this.supportedLanguages.includes(e)){console.warn(`Unsupported language: ${e}`);return}this.currentLanguage=e,localStorage.setItem("baklab_setup_lang",e),await this.loadTranslations(),document.dispatchEvent(new CustomEvent("languageChanged",{detail:{language:e}})),this.languageChangeCallback&&typeof this.languageChangeCallback=="function"?this.languageChangeCallback():this.applyTranslations()}applyTranslations(){document.title=this.t("setup.page_title"),document.querySelectorAll("[data-i18n]").forEach(e=>{let t=e.getAttribute("data-i18n"),s=e.getAttribute("data-i18n-params"),a=s?JSON.parse(s):{};e.textContent=this.t(t,a)}),document.querySelectorAll("[data-i18n-html]").forEach(e=>{let t=e.getAttribute("data-i18n-html"),s=e.getAttribute("data-i18n-params"),a=s?JSON.parse(s):{};e.innerHTML=this.t(t,a)}),document.querySelectorAll("[data-i18n-placeholder]").forEach(e=>{let t=e.getAttribute("data-i18n-placeholder"),s=e.getAttribute("data-i18n-params"),a=s?JSON.parse(s):{};e.placeholder=this.t(t,a)}),document.querySelectorAll("[data-i18n-title]").forEach(e=>{let t=e.getAttribute("data-i18n-title"),s=e.getAttribute("data-i18n-params"),a=s?JSON.parse(s):{};e.title=this.t(t,a)}),document.querySelectorAll("[data-i18n-value]").forEach(e=>{let t=e.getAttribute("data-i18n-value"),s=e.getAttribute("data-i18n-params"),a=s?JSON.parse(s):{};e.value=this.t(t,a)})}getCurrentLanguage(){return this.currentLanguage}getSupportedLanguages(){return this.supportedLanguages.map(e=>({code:e,name:this.getLanguageName(e)}))}getLanguageName(e){return{en:"English","zh-Hans":"\u4E2D\u6587 (\u7B80\u4F53)"}[e]||e}generateLanguageSelector(e,t={}){let s=document.getElementById(e);if(!s){console.warn(`Language selector container not found: ${e}`);return}let{showLabel:a=!0,labelKey:r="common.language",className:o="language-selector",style:d="dropdown"}=t,n="";a&&(n+=`<label class="language-label">${this.t(r)}</label>`),d==="dropdown"?(n+=`<select class="${o}" data-i18n-selector>`,this.supportedLanguages.forEach(c=>{let m=c===this.currentLanguage?"selected":"";n+=`<option value="${c}" ${m}>${this.getLanguageName(c)}</option>`}),n+="</select>"):d==="buttons"&&(n+=`<div class="${o}">`,this.supportedLanguages.forEach(c=>{let m=c===this.currentLanguage?"active":"";n+=`<button class="lang-btn ${m}" data-i18n-btn data-lang="${c}">
                    ${this.getLanguageName(c)}
                </button>`}),n+="</div>"),s.innerHTML=n;let l=s.querySelector("[data-i18n-selector]");l&&l.addEventListener("change",c=>this.setLanguage(c.target.value)),s.querySelectorAll("[data-i18n-btn]").forEach(c=>{c.addEventListener("click",m=>{let v=m.target.getAttribute("data-lang");this.setLanguage(v)})})}formatDate(e,t={}){let s=this.currentLanguage==="zh-Hans"?"zh-CN":"en-US";return new Intl.DateTimeFormat(s,t).format(new Date(e))}formatNumber(e,t={}){let s=this.currentLanguage==="zh-Hans"?"zh-CN":"en-US";return new Intl.NumberFormat(s,t).format(e)}};function ve(){let i={en:{welcome:"Welcome {{name}}!",items:{zero:"No items",one:"{{count}} item",other:"{{count}} items"},nested:{deep:{value:"Deep value: {{value}}"}}},"zh-Hans":{welcome:"\u6B22\u8FCE {{name}}\uFF01",items:{zero:"\u6CA1\u6709\u9879\u76EE",other:"{{count}} \u4E2A\u9879\u76EE"},nested:{deep:{value:"\u6DF1\u5C42\u503C\uFF1A{{value}}"}}}},e=new T;e.translations=i;let t=[{lang:"en",key:"welcome",params:{name:"Alice"},expected:"Welcome Alice!"},{lang:"en",key:"items",params:{count:0},expected:"No items"},{lang:"en",key:"items",params:{count:1},expected:"1 item"},{lang:"en",key:"items",params:{count:5},expected:"5 items"},{lang:"en",key:"nested.deep.value",params:{value:"test"},expected:"Deep value: test"},{lang:"zh-Hans",key:"welcome",params:{name:"\u5F20\u4E09"},expected:"\u6B22\u8FCE \u5F20\u4E09\uFF01"},{lang:"zh-Hans",key:"items",params:{count:0},expected:"\u6CA1\u6709\u9879\u76EE"},{lang:"zh-Hans",key:"items",params:{count:5},expected:"5 \u4E2A\u9879\u76EE"},{lang:"zh-Hans",key:"nested.deep.value",params:{value:"\u6D4B\u8BD5"},expected:"\u6DF1\u5C42\u503C\uFF1A\u6D4B\u8BD5"}],s=0,a=t.length;return t.forEach((r,o)=>{e.currentLanguage=r.lang,e.t(r.key,r.params)===r.expected&&s++}),s===a}window.location.search.includes("test=true")&&document.addEventListener("DOMContentLoaded",()=>{setTimeout(ve,1e3)});function te(i,{setupService:e}){i.innerHTML=`
        <div class="form-section">
            <h3 data-i18n="setup.init.welcome_title"></h3>
            <div style="margin-bottom: 2rem; color: var(--gray-600); line-height: 1.6;">
                <span data-i18n="setup.init.welcome_description_part1"></span>
                <strong data-i18n="setup.init.timeout_highlight"></strong>
                <span data-i18n="setup.init.welcome_description_part2"></span>
            </div>

            <div style="border: 1px solid #ddd; border-radius: 4px; padding: 1rem; margin: 1rem 0; background: #f9f9f9;">
                <h4 style="margin: 0 0 0.75rem 0;" data-i18n="setup.init.prerequisites_title"></h4>
                <p style="margin: 0 0 0.75rem 0;" data-i18n="setup.init.prerequisites_description"></p>

                <ul style="margin: 0.25rem 0 0.75rem 1rem;">
                    <li data-i18n="setup.init.required_smtp"></li>
                    <li data-i18n="setup.init.required_https"></li>
                    <li data-i18n="setup.init.required_static"></li>
                </ul>

                <p style="margin: 0; font-size: 0.9rem; font-style: italic;" data-i18n="setup.init.prerequisites_note"></p>
            </div>

            <div class="form-group" style="margin-bottom: 2rem;">
                <label class="form-label" data-i18n="setup.init.language_label"></label>
                <div class="language-switcher-container" id="language-switcher"></div>
            </div>

            <div class="btn-group init-actions">
                <button class="btn btn-primary" id="init-btn">
                    <span data-i18n="setup.init.initialize_button"></span>
                </button>
            </div>
        </div>
    `,document.getElementById("init-btn").addEventListener("click",async()=>{await e.initialize()})}async function ye(i,e,t,s){await i.protectedApiCall("testDatabase",async()=>{let a={...e.getAll()},r=document.querySelector('input[name="db-service-type"]:checked').value;a.database={service_type:r,host:document.getElementById("db-host").value,port:parseInt(document.getElementById("db-port").value),name:document.getElementById("db-name").value,app_user:document.getElementById("db-app-user").value,app_password:document.getElementById("db-app-password").value},r==="docker"?(a.database.super_user=document.getElementById("db-super-user").value,a.database.super_password=document.getElementById("db-super-password").value):(a.database.super_user="",a.database.super_password="");let o=document.getElementById("db-test-btn"),d=o.textContent;o.disabled=!0,o.textContent=s?s.t("common.testing"):"Testing...";try{let n=await i.testConnections("database",a);_e(n.data,"database")}catch(n){t.showAlert("error",s?s.t("messages.errors.failed_test_connections",{error:n.message}):"Connection test failed: "+n.message)}finally{o.disabled=!1,o.textContent=d}},a=>{a.validationErrors&&a.validationErrors.length>0?x(a.validationErrors,s):t.showAlert("error",a.message)})}function _e(i,e){let s=document.getElementById("db-connection-results");if(s){let a=i.filter(r=>r.service===e);s.innerHTML=a.length>0?`
            <div class="connection-results">
                ${a.map(r=>`
                    <div class="connection-result ${r.success?"success":"error"}">
                        <div class="connection-result-icon">
                            ${r.success?"\u2713":"\u2717"}
                        </div>
                        <div class="connection-result-text">
                            <strong>${r.service.toUpperCase()}</strong>: ${r.message}
                        </div>
                    </div>
                `).join("")}
            </div>
        `:""}}function D(i,e){let t=document.getElementById(i);if(t){let s=t.closest(".form-group");if(s){let a=s.querySelector(".form-help");a&&(a.style.display=e?"block":"none")}}}function U(i){let e=document.getElementById("db-host"),t=document.getElementById("db-test-connection-container"),s=document.getElementById("db-super-user-config"),a=document.getElementById("db-super-user"),r=document.getElementById("db-super-password"),o=document.getElementById("db-app-user"),d=document.getElementById("db-app-password"),n=document.getElementById("database-form");i==="docker"?(e.value="localhost",e.readOnly=!0,e.style.backgroundColor="var(--gray-100)",t&&(t.style.display="none"),s&&(s.style.display="block"),a&&(a.required=!0,a.disabled=!1),r&&(r.required=!0,r.disabled=!1),o&&(o.minLength=1,o.maxLength=63,o.pattern="^[a-zA-Z][a-zA-Z0-9_]*$"),d&&(d.minLength=12,d.maxLength=64,d.pattern="^[A-Za-z\\d!@#$%^&*]{12,64}$"),D("db-app-user",!0),D("db-app-password",!0),o&&(o.setCustomValidity(""),b(o)),d&&(d.setCustomValidity(""),b(d)),a&&(a.setCustomValidity(""),b(a)),r&&(r.setCustomValidity(""),b(r))):(e.readOnly=!1,e.style.backgroundColor="",t&&(t.style.display="block"),s&&(s.style.display="none"),a&&(a.required=!1,a.disabled=!0),r&&(r.required=!1,r.disabled=!0),o&&(o.minLength=1,o.maxLength=128,o.pattern="",o.removeAttribute("pattern")),d&&(d.minLength=1,d.maxLength=128,d.pattern="",d.removeAttribute("pattern")),D("db-app-user",!1),D("db-app-password",!1),o&&(o.setCustomValidity(""),b(o)),d&&(d.setCustomValidity(""),b(d)),a&&(a.setCustomValidity(""),b(a)),r&&(r.setCustomValidity(""),b(r))),n&&(n.querySelectorAll("input, select, textarea").forEach(c=>{c.style.display!=="none"&&!c.closest('[style*="display: none"]')&&c.setCustomValidity("")}),n.noValidate=!0,setTimeout(()=>{n.noValidate=!1},10))}function se(i,{config:e,navigation:t,ui:s,apiClient:a,i18n:r}){let o=e.get("database");i.innerHTML=`
        <form id="database-form" class="form-section" novalidate>
            <h3 data-i18n="setup.database.title"></h3>
            <p style="margin-bottom: 1.5rem; color: var(--gray-600);" data-i18n="setup.database.description"></p>

            <div class="form-group">
                <label class="form-label"><span data-i18n="setup.database.service_type_label"></span> <span data-i18n="common.required"></span></label>
                <div class="radio-group">
                    <label class="radio-option">
                        <input type="radio" name="db-service-type" value="docker" ${o.service_type==="docker"?"checked":""}>
                        <div>
                            <span data-i18n="setup.database.service_type_docker"></span>
                        </div>
                    </label>
                    <label class="radio-option">
                        <input type="radio" name="db-service-type" value="external" ${o.service_type==="external"?"checked":""}>
                        <div>
                            <span data-i18n="setup.database.service_type_external"></span>
                        </div>
                    </label>
                </div>
            </div>

            <div class="form-row" id="db-connection-fields">
                <div class="form-group">
                    <label for="db-host"><span data-i18n="setup.database.host_label"></span> <span data-i18n="common.required"></span></label>
                    <input
                        type="text"
                        id="db-host"
                        name="host"
                        value="${o.host}"
                        data-i18n-placeholder="setup.database.host_placeholder"
                        required
                        pattern="^[a-zA-Z0-9.\\-]+$"
                        data-i18n-title="setup.database.host_error"
                    >
                    <div class="form-help" data-i18n="setup.database.host_help"></div>
                    <div class="invalid-feedback" data-i18n="setup.database.host_error"></div>
                </div>
                <div class="form-group">
                    <label for="db-port"><span data-i18n="setup.database.port_label"></span> <span data-i18n="common.required"></span></label>
                    <input
                        type="number"
                        id="db-port"
                        name="port"
                        value="${o.port}"
                        data-i18n-placeholder="setup.database.port_placeholder"
                        required
                        min="1"
                        max="65535"
                        data-i18n-title="setup.database.port_error"
                    >
                    <div class="form-help" data-i18n="setup.database.port_help"></div>
                    <div class="invalid-feedback" data-i18n="setup.database.port_error"></div>
                </div>
            </div>

            <div class="form-group">
                <label for="db-name"><span data-i18n="setup.database.name_label"></span> <span data-i18n="common.required"></span></label>
                <input
                    type="text"
                    id="db-name"
                    name="database"
                    value="${o.name}"
                    data-i18n-placeholder="setup.database.name_placeholder"
                    required
                    pattern="^[a-zA-Z][a-zA-Z0-9_]*$"
                    minlength="1"
                    maxlength="63"
                    data-i18n-title="setup.database.name_error"
                >
                <div class="form-help" data-i18n="setup.database.name_help"></div>
                <div class="invalid-feedback" data-i18n="setup.database.name_error"></div>
            </div>

            <div id="db-super-user-config" style="background: var(--gray-50); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                <h4 style="margin: 0 0 1rem 0; color: var(--gray-700); font-size: 1rem;" data-i18n="setup.database.super_user_title"></h4>
                <div class="form-row">
                    <div class="form-group">
                        <label for="db-super-user"><span data-i18n="setup.database.super_username_label"></span> <span data-i18n="common.required"></span></label>
                        <input
                            type="text"
                            id="db-super-user"
                            name="super_username"
                            value="${o.super_user||"baklab_super"}"
                            data-i18n-placeholder="setup.database.super_username_placeholder"
                            required
                            pattern="^[a-zA-Z][a-zA-Z0-9_]*$"
                            minlength="1"
                            maxlength="63"
                            data-i18n-title="setup.database.super_username_error"
                        >
                        <div class="form-help" data-i18n="setup.database.super_username_help"></div>
                        <div class="invalid-feedback" data-i18n="setup.database.super_username_error"></div>
                    </div>
                    <div class="form-group">
                        <label for="db-super-password"><span data-i18n="setup.database.super_password_label"></span> <span data-i18n="common.required"></span></label>
                        <input
                            type="password"
                            id="db-super-password"
                            name="super_password"
                            data-i18n-placeholder="setup.database.super_password_placeholder"
                            required
                            minlength="12"
                            maxlength="64"
                            pattern="^[A-Za-z\\d!@#$%^&*]{12,64}$"
                            data-i18n-title="setup.database.super_password_error"
                        >
                        <div class="form-help" data-i18n="setup.database.super_password_help"></div>
                        <div class="invalid-feedback" data-i18n="setup.database.super_password_error"></div>
                    </div>
                </div>
            </div>

            <div style="background: var(--gray-50); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                <h4 style="margin: 0 0 1rem 0; color: var(--gray-700); font-size: 1rem;" data-i18n="setup.database.app_user_title"></h4>
                <div class="form-row">
                    <div class="form-group">
                        <label for="db-app-user"><span data-i18n="setup.database.app_username_label"></span> <span data-i18n="common.required"></span></label>
                        <input
                            type="text"
                            id="db-app-user"
                            name="app_username"
                            value="${o.app_user||"baklab"}"
                            data-i18n-placeholder="setup.database.app_username_placeholder"
                            required
                            data-i18n-title="setup.database.app_username_error"
                        >
                        <div class="form-help" data-i18n="setup.database.app_username_help"></div>
                        <div class="invalid-feedback" data-i18n="setup.database.app_username_error"></div>
                    </div>
                    <div class="form-group">
                        <label for="db-app-password"><span data-i18n="setup.database.app_password_label"></span> <span data-i18n="common.required"></span></label>
                        <input
                            type="password"
                            id="db-app-password"
                            name="app_password"
                            data-i18n-placeholder="setup.database.app_password_placeholder"
                            required
                            data-i18n-title="setup.database.app_password_error"
                        >
                        <div class="form-help" data-i18n="setup.database.app_password_help"></div>
                        <div class="invalid-feedback" data-i18n="setup.database.app_password_error"></div>
                    </div>
                </div>
            </div>

            <div id="db-test-connection-container" style="display: none;">
                <div class="form-group">
                    <button type="button" id="db-test-btn" class="btn btn-outline-primary" data-i18n="setup.database.test_connection"></button>
                </div>
                <div id="db-connection-results" class="connection-results-container"></div>
            </div>

            <div class="btn-group">
                <button type="button" class="btn btn-secondary" id="db-prev-btn" data-i18n="common.previous"></button>
                <button type="submit" class="btn btn-primary" data-i18n="common.next"></button>
            </div>
        </form>
    `,document.getElementById("db-prev-btn").addEventListener("click",()=>{t.previousStep()}),document.querySelectorAll('input[name="db-service-type"]').forEach(v=>{v.addEventListener("change",u=>{U(u.target.value),s.updateRadioStyles("db-service-type"),setTimeout(()=>n(),10)})}),U(o.service_type),s.updateRadioStyles("db-service-type"),setTimeout(()=>{U(o.service_type)},100);let n=()=>{let v=document.querySelector('input[name="db-service-type"]:checked').value,u=document.getElementById("db-app-user"),p=document.getElementById("db-app-password");if(v==="docker"){let h=document.getElementById("db-super-user").value,f=document.getElementById("db-app-user").value,w=document.getElementById("db-super-password").value,I=document.getElementById("db-app-password").value;if(h===f&&h!==""&&f!==""){let $=r?r.t("setup.database.username_duplicate_error"):"Application username must be different from super user username";u.setCustomValidity($),S(u,$)}else u.setCustomValidity(""),b(u)}else u.setCustomValidity(""),b(u);if(v==="docker"){let h=document.getElementById("db-super-password").value,f=document.getElementById("db-app-password").value;if(h===f&&h!==""&&f!==""){let w=r?r.t("setup.database.password_duplicate_error"):"Application password must be different from super user password";p.setCustomValidity(w),S(p,w);return}}let g=document.getElementById("db-super-password"),y=document.getElementById("db-super-password").value;if(v==="docker"&&y){let h=C(y),f=r?r.t("setup.database.super_password_error"):"Super password must be 12-64 characters with at least 3 types: lowercase, uppercase, numbers, special characters (!@#$%^&*)";h?(g.setCustomValidity(""),b(g)):(g.setCustomValidity(f),S(g,f))}else(y===""||v!=="docker")&&(g.setCustomValidity(""),b(g));let _=document.getElementById("db-app-password").value;if(_){let h=!0,f="";v==="docker"?(h=C(_),f=r?r.t("setup.database.app_password_error"):"App password must be 12-64 characters with at least 3 types: lowercase, uppercase, numbers, special characters (!@#$%^&*)"):(h=L(_),f=r?r.t("setup.database.app_password_external_error"):"App password must be 1-128 characters and cannot contain control characters"),h?(p.setCustomValidity(""),b(p)):(p.setCustomValidity(f),S(p,f))}else _===""&&(p.setCustomValidity(""),b(p))},l=document.getElementById("db-super-password");l&&o.super_password&&(l.value=o.super_password);let c=document.getElementById("db-app-password");c&&o.app_password&&(c.value=o.app_password),["db-super-user","db-app-user","db-super-password","db-app-password"].forEach(v=>{let u=document.getElementById(v);u&&u.addEventListener("input",n)}),document.getElementById("database-form").addEventListener("submit",async v=>{v.preventDefault();let u=document.querySelector('input[name="db-service-type"]:checked').value,p=document.getElementById("db-super-password").value,g=document.getElementById("db-app-password").value,y=document.getElementById("db-super-password"),_=document.getElementById("db-app-password");if(u==="docker")if(p&&!C(p)){let h=r?r.t("setup.database.super_password_error"):"Super password must be 12-64 characters with at least 3 types: lowercase, uppercase, numbers, special characters (!@#$%^&*)";y.setCustomValidity(h)}else y.setCustomValidity("");else y&&y.setCustomValidity("");if(g){let h=!0,f="";u==="docker"?(h=C(g),f=r?r.t("setup.database.app_password_error"):"App password must be 12-64 characters with at least 3 types: lowercase, uppercase, numbers, special characters (!@#$%^&*)"):(h=L(g),f=r?r.t("setup.database.app_password_external_error"):"App password must be 1-128 characters and cannot contain control characters"),h?_.setCustomValidity(""):_.setCustomValidity(f)}else _.setCustomValidity("");if(u==="docker"){let h=document.getElementById("db-super-user").value,f=document.getElementById("db-app-user").value,w=document.getElementById("db-app-user");if(h===f&&h!==""){let I=r?r.t("setup.database.username_duplicate_error"):"Application username must be different from super user username";w.setCustomValidity(I)}else w.setCustomValidity("");if(p===g&&p!==""){let I=r?r.t("setup.database.password_duplicate_error"):"Application password must be different from super user password";_.setCustomValidity(I)}else if(g){let I=!0,$="";u==="docker"?(I=C(g),$=r?r.t("setup.database.app_password_error"):"App password must be 12-64 characters with at least 3 types: lowercase, uppercase, numbers, special characters (!@#$%^&*)"):(I=L(g),$=r?r.t("setup.database.app_password_external_error"):"App password must be 1-128 characters and cannot contain control characters"),I||_.setCustomValidity($)}}else{let h=document.getElementById("db-app-user");h&&h.setCustomValidity("")}if(v.target.checkValidity()){let h=document.querySelector('input[name="db-service-type"]:checked').value;e.set("database",{service_type:h,host:h==="docker"?"localhost":document.getElementById("db-host").value,port:parseInt(document.getElementById("db-port").value),name:document.getElementById("db-name").value,app_user:document.getElementById("db-app-user").value,app_password:document.getElementById("db-app-password").value,super_user:h==="docker"?document.getElementById("db-super-user").value:"",super_password:h==="docker"?document.getElementById("db-super-password").value:""}),e.saveToLocalCache(),await e.saveWithValidation()}else E(v.target)});let m=document.getElementById("db-test-btn");m&&m.addEventListener("click",()=>ye(a,e,s,r)),k(i)}function ae(i,{config:e,navigation:t,ui:s,i18n:a}){let r=e.get("admin_user");i.innerHTML=`
            <form id="admin-form" class="form-section" novalidate>
                <h3 data-i18n="setup.admin.title"></h3>
                <p style="margin-bottom: 1.5rem; color: var(--gray-600);" data-i18n="setup.admin.description"></p>

                <div class="form-group">
                    <label for="admin-username"><span data-i18n="setup.admin.username_label"></span> <span data-i18n="common.required"></span></label>
                    <input
                        type="text"
                        id="admin-username"
                        name="username"
                        value="${r.username}"
                        data-i18n-placeholder="setup.admin.username_placeholder"
                        required
                        minlength="4"
                        maxlength="20"
                        pattern="^[a-zA-Z0-9][a-zA-Z0-9._\\-]+[a-zA-Z0-9]$"
                        data-i18n-title="setup.admin.username_error"
                    >
                    <div class="form-help" data-i18n="setup.admin.username_help"></div>
                    <div class="invalid-feedback" data-i18n="setup.admin.username_error"></div>
                </div>

                <div class="form-group">
                    <label for="admin-email"><span data-i18n="setup.admin.email_label"></span> <span data-i18n="common.required"></span></label>
                    <input
                        type="email"
                        id="admin-email"
                        name="email"
                        value="${r.email}"
                        placeholder="admin@example.com"
                        required
                        data-i18n-title="setup.admin.email_error"
                    >
                    <div class="form-help" data-i18n="setup.admin.email_help"></div>
                    <div class="invalid-feedback" data-i18n="setup.admin.email_error"></div>
                </div>
                
                <div class="form-group">
                    <label for="admin-password"><span data-i18n="setup.admin.password_label"></span> <span data-i18n="common.required"></span></label>
                    <input
                        type="password"
                        id="admin-password"
                        name="password"
                        data-i18n-placeholder="setup.admin.password_placeholder"
                        required
                        minlength="12"
                        maxlength="64"
                        pattern="^[A-Za-z\\d!@#$%^&*]{12,64}$"
                        data-i18n-title="setup.admin.password_error"
                    >
                    <div class="form-help" data-i18n="setup.admin.password_help"></div>
                    <div class="invalid-feedback" data-i18n="setup.admin.password_error"></div>
                </div>
                
                <div class="form-group">
                    <label for="admin-password-confirm"><span data-i18n="setup.admin.password_confirm_label"></span> <span data-i18n="common.required"></span></label>
                    <input
                        type="password"
                        id="admin-password-confirm"
                        name="passwordConfirm"
                        data-i18n-placeholder="setup.admin.password_confirm_placeholder"
                        required
                        data-i18n-title="setup.admin.password_confirm_error"
                    >
                    <div class="invalid-feedback" data-i18n="setup.admin.password_confirm_error"></div>
                </div>
                
                <div class="btn-group">
                    <button type="button" class="btn btn-secondary" id="admin-prev-btn" data-i18n="common.previous"></button>
                    <button type="submit" class="btn btn-primary" data-i18n="common.next"></button>
                </div>
            </form>
        `,document.getElementById("admin-prev-btn").addEventListener("click",()=>{t.previousStep()}),document.getElementById("admin-form").addEventListener("submit",async n=>{n.preventDefault();let l=document.getElementById("admin-password").value,c=document.getElementById("admin-password-confirm").value,m=document.getElementById("admin-password-confirm"),v=document.getElementById("admin-password");if(l&&!O(l)){let u=a?a.t("setup.admin.password_error"):"Password must contain lowercase, uppercase, numbers, and special characters (!@#$%^&*)";v.setCustomValidity(u)}else v.setCustomValidity("");if(l!==c){let u=a?a.t("setup.admin.password_confirm_error"):"Passwords must match";m.setCustomValidity(u)}else m.setCustomValidity("");n.target.checkValidity()?(e.set("admin_user",{username:document.getElementById("admin-username").value,email:document.getElementById("admin-email").value,password:document.getElementById("admin-password").value}),e.saveToLocalCache(),await e.saveWithValidation()):E(n.target)});let o=document.getElementById("admin-password"),d=document.getElementById("admin-password-confirm");o&&r.password&&(o.value=r.password),d&&r.password&&(d.value=r.password),o.addEventListener("input",()=>{if(ee(o,o.value,"admin",{i18n:a,showCustomErrorFn:(n,l)=>S(n,l),hideCustomErrorFn:n=>b(n)}),d.value&&o.value!==d.value){let n=a?a.t("setup.admin.password_confirm_error"):"Passwords must match";d.setCustomValidity(n),S(d,n)}else d.setCustomValidity(""),b(d)}),d.addEventListener("input",()=>{let n=o.value,l=d.value;if(l&&n!==l){let c=a?a.t("setup.admin.password_confirm_error"):"Passwords must match";d.setCustomValidity(c),S(d,c)}else d.setCustomValidity(""),b(d)}),k(i)}function re(i,e){let t=document.getElementById("ssl-use-setup-cert"),s=document.getElementById("ssl-enabled");if(!t||!s)return;let a=i.get("app"),r=i.get("ssl");if(a.use_setup_domain&&r.enabled){t.checked=!0,t.readOnly=!0,t.disabled=!0,t.dataset.autoSelected="true";let o=new Event("change");t.dispatchEvent(o),r.use_setup_cert=!0,i.set("ssl",r);let d=t.closest(".checkbox-label");if(d){d.style.opacity="0.7",d.title=e?e.t("setup.ssl.auto_selected_due_to_domain"):"Automatically selected because you are using the setup program domain";let n=d.querySelector(".auto-selection-note");if(!n){n=document.createElement("span"),n.className="auto-selection-note",n.style.cssText="font-size: 0.85em; color: var(--gray-600); margin-left: 0.5rem; font-style: italic; display: inline;";let c=d.querySelector("span");c?c.parentNode.insertBefore(n,c.nextSibling):d.appendChild(n)}let l=e?e.t("setup.ssl.auto_selected_due_to_domain"):"Automatically selected because you are using the setup program domain";n.textContent=` (${l})`}}else!a.use_setup_domain&&t.dataset.autoSelected==="true"&&G(i)}function G(i){let e=document.getElementById("ssl-use-setup-cert");if(e){e.checked=!1,e.readOnly=!1,e.disabled=!1,delete e.dataset.autoSelected;let t=document.getElementById("ssl-cert-path"),s=document.getElementById("ssl-key-path");t&&(t.value="",t.readOnly=!1,t.style.backgroundColor=""),s&&(s.value="",s.readOnly=!1,s.style.backgroundColor="");let a=e.closest(".checkbox-label");if(a){a.style.opacity="",a.title="";let o=a.querySelector(".auto-selection-note");o&&o.remove()}let r=i.get("ssl");r.use_setup_cert=!1,i.set("ssl",r)}}function oe(i,{config:e,navigation:t,apiClient:s,i18n:a}){let r=e.get("ssl"),o=e.get("app");i.innerHTML=`
            <form id="ssl-form" class="form-section" novalidate>
                <h3 data-i18n="setup.ssl.title"></h3>
                <p style="margin-bottom: 1.5rem; color: var(--gray-600);" data-i18n="setup.ssl.description"></p>

                <div class="alert alert-warning" style="margin-bottom: 1.5rem; color: inherit;">
                    <p style="margin: 0;" data-i18n="setup.ssl.domain_match_warning_text" data-i18n-params='{"domain":"${o.domain_name||"example.com"}"}'></p>
                </div>

                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="ssl-enabled" name="enabled" ${r.enabled?"checked":""}>
                        <span data-i18n="setup.ssl.enable_label"></span>
                    </label>
                </div>

                <div id="ssl-config" style="display: ${r.enabled?"block":"none"};">
                    <div class="form-group">
                        <label class="checkbox-label">
                            <input type="checkbox" id="ssl-use-setup-cert" name="use_setup_cert" ${r.use_setup_cert?"checked":""}>
                            <span data-i18n="setup.ssl.use_setup_cert_label"></span>
                        </label>
                        <div class="form-help" data-i18n="setup.ssl.use_setup_cert_help"></div>
                    </div>

                    <div class="form-group">
                        <label for="ssl-cert-path" data-i18n="setup.ssl.cert_path_label"></label>
                        <input type="text" id="ssl-cert-path" name="cert_path" value="${r.cert_path}"
                               placeholder="/path/to/certificate.crt" required>
                        <div class="invalid-feedback" style="display: none;"></div>
                        <div class="form-help" data-i18n="setup.ssl.cert_path_help"></div>
                    </div>

                    <div class="form-group">
                        <label for="ssl-key-path" data-i18n="setup.ssl.key_path_label"></label>
                        <input type="text" id="ssl-key-path" name="key_path" value="${r.key_path}"
                               placeholder="/path/to/private.key" required>
                        <div class="invalid-feedback" style="display: none;"></div>
                        <div class="form-help" data-i18n="setup.ssl.key_path_help"></div>
                    </div>
                </div>

                <div class="btn-group">
                    <button type="button" class="btn btn-secondary" id="ssl-prev-btn" data-i18n="common.previous"></button>
                    <button type="submit" class="btn btn-primary" data-i18n="common.next"></button>
                </div>
            </form>
        `,document.getElementById("ssl-prev-btn").addEventListener("click",()=>{t.previousStep()}),document.getElementById("ssl-enabled").addEventListener("change",d=>{let n=document.getElementById("ssl-config"),l=document.getElementById("ssl-cert-path"),c=document.getElementById("ssl-key-path");if(d.target.checked){n.style.display="block",l.required=!0,c.required=!0;let m=e.get("ssl");m.enabled=!0,e.set("ssl",m),setTimeout(()=>re(e,a),0)}else{n.style.display="none",l.required=!1,c.required=!1,B(document.getElementById("ssl-form"));let m=e.get("ssl");m.enabled=!1,e.set("ssl",m),G(e)}}),document.getElementById("ssl-use-setup-cert").addEventListener("change",async d=>{let n=document.getElementById("ssl-cert-path"),l=document.getElementById("ssl-key-path");if(d.target.checked)try{let c=await s.getCurrentCertPaths();c.data&&(n.value=c.data.cert_path,l.value=c.data.key_path,n.readOnly=!0,l.readOnly=!0)}catch(c){console.error("Failed to get current cert paths:",c),d.target.checked=!1}else n.readOnly=!1,l.readOnly=!1}),re(e,a),document.getElementById("ssl-form").addEventListener("submit",async d=>{d.preventDefault();let n=new FormData(d.target),l={enabled:n.get("enabled")==="on",cert_path:n.get("cert_path")||"",key_path:n.get("key_path")||"",use_setup_cert:n.get("use_setup_cert")==="on"},c=!0;if(B(document.getElementById("ssl-form")),l.enabled){if(l.cert_path.trim()){if(!l.cert_path.startsWith("/")){let m=a?a.t("setup.ssl.cert_path_must_be_absolute"):"Certificate path must be an absolute path (starting with /)";q(document.getElementById("ssl-cert-path"),m),c=!1}}else{let m=a?a.t("setup.ssl.cert_path_required"):"Certificate path is required when SSL is enabled";q(document.getElementById("ssl-cert-path"),m),c=!1}if(l.key_path.trim()){if(!l.key_path.startsWith("/")){let m=a?a.t("setup.ssl.key_path_must_be_absolute"):"Private key path must be an absolute path (starting with /)";q(document.getElementById("ssl-key-path"),m),c=!1}}else{let m=a?a.t("setup.ssl.key_path_required"):"Private key path is required when SSL is enabled";q(document.getElementById("ssl-key-path"),m),c=!1}}c&&(e.set("ssl",l),await e.save(),t.nextStep())}),k(i)}function Ce(){let i=document.querySelector('input[name="jwt_method"]:checked')?.value,e=document.getElementById("jwt-auto-config"),t=document.getElementById("jwt-path-config"),s=document.getElementById("jwt-key-path");s&&s.setCustomValidity(""),i==="auto"?(e&&(e.style.display="block"),t&&(t.style.display="none"),s&&(s.required=!1)):i==="path"&&(e&&(e.style.display="none"),t&&(t.style.display="block"),s&&(s.required=!0))}function ie(i,{config:e,navigation:t,ui:s,apiClient:a,i18n:r}){let o=e.get("app");i.innerHTML=`
            <form id="app-form" class="form-section" novalidate>
                <h3 data-i18n="setup.app.title"></h3>
                <p style="margin-bottom: 1.5rem; color: var(--gray-600);" data-i18n="setup.app.description"></p>

                <div class="form-group">
                    <label for="app-domain"><span data-i18n="setup.app.domain_label"></span> <span data-i18n="common.required"></span></label>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <input
                            type="text"
                            id="app-domain"
                            name="domain"
                            value="${o.domain_name}"
                            data-i18n-placeholder="setup.app.domain_placeholder"
                            required
                            pattern="^([a-zA-Z0-9]([a-zA-Z0-9\\-]*[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,}$|^localhost$"
                            data-i18n-title="setup.app.domain_error"
                            style="flex: 1;"
                        >
                        <div style="display: flex; align-items: center; gap: 3px;">
                            <input type="checkbox" id="use-setup-domain" name="use_setup_domain" ${o.use_setup_domain?"checked":""} style="margin: 0;">
                            <label for="use-setup-domain" data-i18n="setup.app.use_setup_domain" style="margin: 0; white-space: nowrap; line-height: 1;"></label>
                        </div>
                    </div>
                    <div class="invalid-feedback" data-i18n="setup.app.domain_error"></div>
                </div>

                <div class="form-group">
                    <label for="app-static-host"><span data-i18n="setup.app.static_host_label"></span> <span data-i18n="common.required"></span></label>
                    <input
                        type="text"
                        id="app-static-host"
                        name="static_host"
                        value="${o.static_host_name||""}"
                        data-i18n-placeholder="setup.app.static_host_placeholder"
                        required
                        pattern="^([a-zA-Z0-9]([a-zA-Z0-9\\-]*[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,}(:[0-9]{1,5})?$|^localhost(:[0-9]{1,5})?$"
                        data-i18n-title="setup.app.static_host_error"
                    >
                    <div class="form-help" data-i18n="setup.app.static_host_help"></div>
                    <div class="invalid-feedback" data-i18n="setup.app.static_host_error"></div>
                </div>

                <div class="form-group">
                    <label for="app-brand"><span data-i18n="setup.app.brand_label"></span> <span data-i18n="common.required"></span></label>
                    <input
                        type="text"
                        id="app-brand"
                        name="brand"
                        value="${o.brand_name}"
                        data-i18n-placeholder="setup.app.brand_placeholder"
                        required
                        minlength="2"
                        maxlength="50"
                    >
                </div>
                <div class="form-group">
                    <label for="app-version" data-i18n="setup.app.version_label"></label>
                    <select
                        id="app-version"
                        name="version"
                    >
                        <option value="latest" ${o.version==="latest"?"selected":""}>latest</option>
                    </select>
                    <div class="form-help" data-i18n="setup.app.version_help"></div>
                </div>

                <div class="form-group">
                    <label for="reverse-proxy-type" data-i18n="setup.app.reverse_proxy_label"></label>
                    <select
                        id="reverse-proxy-type"
                        name="reverse_proxy_type"
                    >
                        <option value="caddy" ${!e.get("reverse_proxy")?.type||e.get("reverse_proxy")?.type==="caddy"?"selected":""}>Caddy</option>
                        <option value="nginx" ${e.get("reverse_proxy")?.type==="nginx"?"selected":""}>Nginx</option>
                    </select>
                    <div class="form-help" data-i18n="setup.app.reverse_proxy_help"></div>
                </div>

                <div class="form-group">
                    <label for="app-cors" data-i18n="setup.app.cors_label"></label>
                    <textarea
                        id="app-cors"
                        name="cors"
                        rows="3"
                        data-i18n-placeholder="setup.app.cors_placeholder"
                        pattern="^(https?:\\/\\/[a-zA-Z0-9.\\-]+(?:\\:[0-9]+)?(?:\\/.*)?\\s*)*$"
                        data-i18n-title="setup.app.cors_error"
                    >${o.cors_allow_origins.join("\\n")}</textarea>
                    <div class="form-help" data-i18n="setup.app.cors_help"></div>
                    <div class="invalid-feedback" data-i18n="setup.app.cors_error"></div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="app-lang"><span data-i18n="setup.app.language_label"></span> <span data-i18n="common.required"></span></label>
                        <select
                            id="app-lang"
                            name="language"
                            required
                            data-i18n-title="setup.app.language_error"
                        >
                            <option value="en" ${o.default_lang==="en"?"selected":""}>English</option>
                            <option value="zh-Hans" ${o.default_lang==="zh-Hans"?"selected":""}>\u4E2D\u6587 (\u7B80\u4F53)</option>
                        </select>
                        <div class="form-help" data-i18n="setup.app.language_help"></div>
                        <div class="invalid-feedback" data-i18n="setup.app.language_error"></div>
                    </div>
                    <div class="form-group">
                        <label for="app-debug">
                            <input type="checkbox" id="app-debug" name="debug" ${o.debug?"checked":""}>
                            <span data-i18n="setup.app.debug_label"></span>
                        </label>
                        <div class="form-help" data-i18n="setup.app.debug_help"></div>
                    </div>
                </div>

                <h4 style="margin: 2rem 0 1rem 0; color: var(--gray-700);" data-i18n="setup.app.jwt_section_title"></h4>
                <p style="margin-bottom: 1rem; color: var(--gray-600);" data-i18n="setup.app.jwt_section_description"></p>
                
                <div class="form-group">
                    <label class="radio-group-label" data-i18n="setup.app.jwt_method_label"></label>
                    <div class="radio-group">
                        <div class="radio-option">
                            <input
                                type="radio"
                                id="jwt-method-auto"
                                name="jwt_method"
                                value="auto"
                                ${o.jwt_key_from_file?"":"checked"}
                                onchange="updateJWTMethodDisplay(); app.updateRadioStyles('jwt_method');"
                            >
                            <label for="jwt-method-auto">
                                <span data-i18n="setup.app.jwt_method_auto"></span>
                            </label>
                        </div>
                        <div class="radio-option">
                            <input
                                type="radio"
                                id="jwt-method-path"
                                name="jwt_method"
                                value="path"
                                ${o.jwt_key_from_file?"checked":""}
                                onchange="updateJWTMethodDisplay(); app.updateRadioStyles('jwt_method');"
                            >
                            <label for="jwt-method-path">
                                <span data-i18n="setup.app.jwt_method_path"></span>
                            </label>
                        </div>
                    </div>
                </div>

                <div id="jwt-auto-config" style="display: ${o.jwt_key_from_file?"none":"block"};">
                    <div class="info-box">
                        <p style="color: var(--gray-600); font-size: 0.875rem; margin-bottom: 0;" data-i18n="setup.app.jwt_auto_description"></p>
                    </div>
                </div>

                <div id="jwt-path-config" style="display: ${o.jwt_key_from_file?"block":"none"};">
                    <details style="margin-bottom: 1.5rem;">
                        <summary style="color: var(--gray-600); font-size: 0.9rem; margin-bottom: 0.75rem;" data-i18n="setup.app.jwt_generation_title"></summary>
                        <div style="background: var(--info-bg, #e3f2fd); border: 1px solid var(--info-border, #1976d2); border-radius: 4px; padding: 1rem;" id="jwt-generation-commands" data-i18n-html="setup.app.jwt_generation_commands"></div>
                    </details>
                    <div class="form-group">
                        <label for="jwt-key-path" data-i18n="setup.app.jwt_path_label"></label>
                        <input
                            type="text"
                            id="jwt-key-path"
                            name="jwt_key_path"
                            value="${o.jwt_key_file_path}"
                            data-i18n-placeholder="setup.app.jwt_path_placeholder"
                        >
                        <div class="form-help" data-i18n="setup.app.jwt_path_help"></div>
                        <div class="invalid-feedback" data-i18n="setup.app.jwt_path_required"></div>
                    </div>
                </div>
                
                <div class="btn-group">
                    <button type="button" class="btn btn-secondary" id="app-prev-btn" data-i18n="common.previous"></button>
                    <button type="submit" class="btn btn-primary" data-i18n="common.next"></button>
                </div>
            </form>
        `,document.getElementById("app-prev-btn").addEventListener("click",()=>{t.previousStep()}),document.getElementById("app-form").addEventListener("submit",async n=>{if(n.preventDefault(),n.target.checkValidity()){let l=document.getElementById("app-cors").value.trim(),c=l?l.split("\\n").map(p=>p.trim()).filter(p=>p):[],m=document.querySelector('input[name="jwt_method"]:checked')?.value||"auto",v=!1,u="";if(m==="path"&&(v=!0,u=document.getElementById("jwt-key-path").value.trim(),!u)){let p=document.getElementById("jwt-key-path");p.setCustomValidity(r?r.t("setup.app.jwt_path_required"):"JWT key file path is required"),p.reportValidity();return}e.update({app:{...o,domain_name:document.getElementById("app-domain").value,static_host_name:document.getElementById("app-static-host").value,brand_name:document.getElementById("app-brand").value,version:document.getElementById("app-version").value,cors_allow_origins:c,default_lang:document.getElementById("app-lang").value,debug:document.getElementById("app-debug").checked,jwt_key_from_file:v,jwt_key_file_path:u,use_setup_domain:document.getElementById("use-setup-domain").checked},reverse_proxy:{type:document.getElementById("reverse-proxy-type").value}}),e.saveToLocalCache(),await e.saveWithValidation()}else E(n.target)}),Ce(),s.updateRadioStyles("jwt_method"),document.getElementById("jwt-key-path").addEventListener("input",n=>{n.target.setCustomValidity("")}),document.getElementById("use-setup-domain").addEventListener("change",n=>{let l=document.getElementById("app-domain");if(n.target.checked){let m=window.location.hostname;l.value=m,l.readOnly=!0,l.style.backgroundColor="#f8f9fa";let v=e.get("ssl");v&&v.enabled&&(v.use_setup_cert=!0,e.set("ssl",v))}else{l.readOnly=!1,l.style.backgroundColor="";let m=e.get("ssl");m&&(m.use_setup_cert=!1,e.set("ssl",m)),G(e)}let c=e.get("app");c.use_setup_domain=n.target.checked,e.set("app",c),e.saveToLocalCache()});let d=document.getElementById("use-setup-domain");if(o.use_setup_domain){let n=document.getElementById("app-domain"),l=window.location.hostname;n.value=l,n.readOnly=!0,n.style.backgroundColor="#f8f9fa"}k(i)}function ne(){let i=document.getElementById("google-enabled").checked,e=document.getElementById("github-enabled").checked,t=document.getElementById("frontend-origin-section");t&&(t.style.display=i||e?"block":"none")}function de(i,{config:e,navigation:t}){let s=e.get("oauth"),a=e.get("app"),r=e.get("ssl");i.innerHTML=`
            <form id="oauth-form" class="form-section" novalidate>
                <h3 data-i18n="setup.oauth.title"></h3>
                <p style="margin-bottom: 1.5rem; color: var(--gray-600);" data-i18n="setup.oauth.description"></p>

                <!-- Google OAuth Configuration -->
                <div class="oauth-provider-section" style="margin-bottom: 2rem;">
                    <h4 style="margin: 1.5rem 0 1rem 0; color: var(--gray-700); display: flex; align-items: center;">
                        <img src="/static/google.webp" alt="Google" width="20" height="20" style="margin-right: 0.5rem;">
                        Google
                    </h4>
                    <div class="form-group">
                        <label class="checkbox-label">
                            <input type="checkbox" id="google-enabled" name="google_enabled" ${s.google_enabled?"checked":""}>
                            <span data-i18n="setup.oauth.google_enable_label"></span>
                        </label>
                    </div>
                    <div id="google-config" style="display: ${s.google_enabled?"block":"none"};">
                        <div class="form-row">
                            <div class="form-group">
                                <label for="google-client-id"><span data-i18n="setup.oauth.google_client_id_label"></span> <span data-i18n="common.required"></span></label>
                                <input
                                    type="text"
                                    id="google-client-id"
                                    name="google_client_id"
                                    value="${s.google_client_id}"
                                    data-i18n-placeholder="setup.oauth.google_client_id_placeholder"
                                    ${s.google_enabled?"required":""}
                                >
                                <div class="invalid-feedback" data-i18n="setup.oauth.google_client_id_error"></div>
                            </div>
                            <div class="form-group">
                                <label for="google-client-secret"><span data-i18n="setup.oauth.google_client_secret_label"></span> <span data-i18n="common.required"></span></label>
                                <input
                                    type="password"
                                    id="google-client-secret"
                                    name="google_client_secret"
                                    data-i18n-placeholder="setup.oauth.google_client_secret_placeholder"
                                    ${s.google_enabled?"required":""}
                                >
                                <div class="invalid-feedback" data-i18n="setup.oauth.google_client_secret_error"></div>
                            </div>
                        </div>
                    </div>
                    <div style="margin-top: 0.5rem; font-size: 0.875rem; color: var(--gray-600);">
                        <span data-i18n="setup.oauth.google_docs_description"></span>
                        <a href="https://developers.google.com/identity/protocols/oauth2" target="_blank" data-i18n="setup.oauth.google_docs_link" style="margin-left: 0.25rem;"></a>
                    </div>
                </div>

                <!-- GitHub OAuth Configuration -->
                <div class="oauth-provider-section">
                    <h4 style="margin: 1.5rem 0 1rem 0; color: var(--gray-700); display: flex; align-items: center;">
                        <img src="/static/github-mark.png" alt="GitHub" width="20" height="20" style="margin-right: 0.5rem;">
                        GitHub
                    </h4>
                    <div class="form-group">
                        <label class="checkbox-label">
                            <input type="checkbox" id="github-enabled" name="github_enabled" ${s.github_enabled?"checked":""}>
                            <span data-i18n="setup.oauth.github_enable_label"></span>
                        </label>
                    </div>
                    <div id="github-config" style="display: ${s.github_enabled?"block":"none"};">
                        <div class="form-row">
                            <div class="form-group">
                                <label for="github-client-id"><span data-i18n="setup.oauth.github_client_id_label"></span> <span data-i18n="common.required"></span></label>
                                <input
                                    type="text"
                                    id="github-client-id"
                                    name="github_client_id"
                                    value="${s.github_client_id}"
                                    data-i18n-placeholder="setup.oauth.github_client_id_placeholder"
                                    ${s.github_enabled?"required":""}
                                >
                                <div class="invalid-feedback" data-i18n="setup.oauth.github_client_id_error"></div>
                            </div>
                            <div class="form-group">
                                <label for="github-client-secret"><span data-i18n="setup.oauth.github_client_secret_label"></span> <span data-i18n="common.required"></span></label>
                                <input
                                    type="password"
                                    id="github-client-secret"
                                    name="github_client_secret"
                                    data-i18n-placeholder="setup.oauth.github_client_secret_placeholder"
                                    ${s.github_enabled?"required":""}
                                >
                                <div class="invalid-feedback" data-i18n="setup.oauth.github_client_secret_error"></div>
                            </div>
                        </div>
                    </div>
                    <div style="margin-top: 0.5rem; font-size: 0.875rem; color: var(--gray-600);">
                        <span data-i18n="setup.oauth.github_docs_description"></span>
                        <a href="https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app" target="_blank" data-i18n="setup.oauth.github_docs_link" style="margin-left: 0.25rem;"></a>
                    </div>
                </div>

                <!-- Frontend Origin Configuration (only when OAuth is enabled) -->
                <div id="frontend-origin-section" style="display: ${s.google_enabled||s.github_enabled?"block":"none"}; margin-top: 2rem;">
                    <h4 style="margin: 1.5rem 0 1rem 0; color: var(--gray-700);" data-i18n="setup.oauth.frontend_origin_title"></h4>
                    <div class="form-group">
                        <label for="frontend-origin"><span data-i18n="setup.oauth.frontend_origin_label"></span></label>
                        <input
                            type="url"
                            id="frontend-origin"
                            name="frontend_origin"
                            value="${s.frontend_origin||(r?.enabled?"https://":"http://")+a.domain_name}"
                            data-i18n-placeholder="setup.oauth.frontend_origin_placeholder"
                        >
                        <div class="form-help" data-i18n="setup.oauth.frontend_origin_help"></div>
                        <div class="invalid-feedback" data-i18n="setup.oauth.frontend_origin_error"></div>
                    </div>
                </div>

                <div class="btn-group">
                    <button type="button" class="btn btn-secondary" id="oauth-prev-btn" data-i18n="common.previous"></button>
                    <button type="submit" class="btn btn-primary" data-i18n="common.next"></button>
                </div>
            </form>
        `,document.getElementById("google-enabled").addEventListener("change",n=>{let l=document.getElementById("google-config"),c=document.getElementById("google-client-id"),m=document.getElementById("google-client-secret");n.target.checked?(l.style.display="block",c.required=!0,m.required=!0):(l.style.display="none",c.required=!1,m.required=!1,B(document.getElementById("oauth-form"))),ne()}),document.getElementById("github-enabled").addEventListener("change",n=>{let l=document.getElementById("github-config"),c=document.getElementById("github-client-id"),m=document.getElementById("github-client-secret");n.target.checked?(l.style.display="block",c.required=!0,m.required=!0):(l.style.display="none",c.required=!1,m.required=!1,B(document.getElementById("oauth-form"))),ne()}),document.getElementById("oauth-prev-btn").addEventListener("click",()=>{t.previousStep()});let o=document.getElementById("google-client-secret");o&&s.google_client_secret&&(o.value=s.google_client_secret);let d=document.getElementById("github-client-secret");d&&s.github_client_secret&&(d.value=s.github_client_secret),document.getElementById("oauth-form").addEventListener("submit",async n=>{n.preventDefault(),n.target.checkValidity()?(e.set("oauth",{google_enabled:document.getElementById("google-enabled").checked,google_client_id:document.getElementById("google-client-id").value.trim(),google_client_secret:document.getElementById("google-client-secret").value.trim(),github_enabled:document.getElementById("github-enabled").checked,github_client_id:document.getElementById("github-client-id").value.trim(),github_client_secret:document.getElementById("github-client-secret").value.trim(),frontend_origin:document.getElementById("frontend-origin").value.trim()}),e.saveToLocalCache(),await e.saveWithValidation()):E(n.target)}),k(i)}async function Ie(i,e,t,s){await i.protectedApiCall("testRedis",async()=>{let a={...e.getAll()};a.redis={service_type:document.querySelector('input[name="redis-service-type"]:checked').value,host:document.getElementById("redis-host").value,port:parseInt(document.getElementById("redis-port").value),user:document.getElementById("redis-user")?document.getElementById("redis-user").value:"",password:document.getElementById("redis-password").value};let r=document.getElementById("redis-test-btn"),o=r.textContent;r.disabled=!0,r.textContent=s?s.t("common.testing"):"Testing...";try{let d=await i.testConnections("redis",a);Le(d.data,"redis")}catch(d){t.showAlert("error",s?s.t("messages.errors.failed_test_connections",{error:d.message}):"Connection test failed: "+d.message)}finally{r.disabled=!1,r.textContent=o}},a=>{a.validationErrors&&a.validationErrors.length>0?x(a.validationErrors,s):t.showAlert("error",a.message)})}function Le(i,e){let s=document.getElementById("redis-connection-results");if(s){let a=i.filter(r=>r.service===e);s.innerHTML=a.length>0?`
            <div class="connection-results">
                ${a.map(r=>`
                    <div class="connection-result ${r.success?"success":"error"}">
                        <div class="connection-result-icon">
                            ${r.success?"\u2713":"\u2717"}
                        </div>
                        <div class="connection-result-text">
                            <strong>${r.service.toUpperCase()}</strong>: ${r.message}
                        </div>
                    </div>
                `).join("")}
            </div>
        `:""}}function A(i,e){let t=document.getElementById(i);if(t){let s=t.closest(".form-group");if(s){let a=s.querySelector(".form-help");a&&(a.style.display=e?"block":"none")}}}function Z(i){let e=document.getElementById("redis-host"),t=document.getElementById("redis-test-connection-container"),s=document.getElementById("redis-password"),a=document.getElementById("redis-user"),r=document.getElementById("redis-admin-config"),o=document.getElementById("redis-admin-password"),d=document.getElementById("redis-form");if(i==="docker"){if(e.value="localhost",e.readOnly=!0,e.style.backgroundColor="var(--gray-100)",t&&(t.style.display="none"),r&&(r.style.display="block"),o&&(o.required=!0,o.disabled=!1),a){a.required=!0;let n=document.getElementById("redis-user-required-indicator");n&&(n.textContent="*",n.setAttribute("data-i18n","common.required"))}s&&(s.minLength=12,s.maxLength=64,s.pattern="^[A-Za-z\\d!@#$%^&*]{12,64}$"),A("redis-password",!0),A("redis-user",!0),A("redis-admin-password",!0),s&&(s.setCustomValidity(""),b(s)),a&&(a.setCustomValidity(""),b(a)),o&&(o.setCustomValidity(""),b(o))}else e.readOnly=!1,e.style.backgroundColor="",t&&(t.style.display="block"),r&&(r.style.display="none"),o&&(o.required=!1,o.disabled=!0),a&&(a.required=!1,a.placeholder=""),s&&(s.minLength=1,s.maxLength=128,s.pattern="",s.removeAttribute("pattern")),A("redis-password",!1),A("redis-user",!1),A("redis-admin-password",!1),s&&(s.setCustomValidity(""),b(s)),a&&(a.setCustomValidity(""),b(a)),o&&(o.setCustomValidity(""),b(o));d&&(d.noValidate=!0,setTimeout(()=>{d.noValidate=!1},10))}function le(i,{config:e,navigation:t,ui:s,apiClient:a,i18n:r}){let o=e.get("redis");i.innerHTML=`
            <form id="redis-form" class="form-section" novalidate>
                <h3 data-i18n="setup.redis.title"></h3>
                <p style="margin-bottom: 1.5rem; color: var(--gray-600);" data-i18n="setup.redis.description"></p>

                <div class="form-group">
                    <label class="form-label"><span data-i18n="setup.redis.service_type_label"></span> <span data-i18n="common.required"></span></label>
                    <div class="radio-group">
                        <label class="radio-option">
                            <input type="radio" name="redis-service-type" value="docker" ${o.service_type==="docker"?"checked":""}>
                            <div>
                                <span data-i18n="setup.redis.service_type_docker"></span>
                            </div>
                        </label>
                        <label class="radio-option">
                            <input type="radio" name="redis-service-type" value="external" ${o.service_type==="external"?"checked":""}>
                            <div>
                                <span data-i18n="setup.redis.service_type_external"></span>
                            </div>
                        </label>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="redis-host"><span data-i18n="setup.redis.host_label"></span> <span data-i18n="common.required"></span></label>
                        <input
                            type="text"
                            id="redis-host"
                            name="host"
                            value="${o.host}"
                            data-i18n-placeholder="setup.redis.host_placeholder"
                            required
                            pattern="^[a-zA-Z0-9.\\-]+$"
                            data-i18n-title="setup.redis.host_error"
                        >
                        <div class="form-help" data-i18n="setup.redis.host_help"></div>
                        <div class="invalid-feedback" data-i18n="setup.redis.host_error"></div>
                    </div>
                    <div class="form-group">
                        <label for="redis-port"><span data-i18n="setup.redis.port_label"></span> <span data-i18n="common.required"></span></label>
                        <input
                            type="number"
                            id="redis-port"
                            name="port"
                            value="${o.port}"
                            data-i18n-placeholder="setup.redis.port_placeholder"
                            required
                            min="1"
                            max="65535"
                            data-i18n-title="setup.redis.port_error"
                        >
                        <div class="form-help" data-i18n="setup.redis.port_help"></div>
                        <div class="invalid-feedback" data-i18n="setup.redis.port_error"></div>
                    </div>
                </div>

                <div class="form-group">
                    <label for="redis-user" id="redis-user-label"><span data-i18n="setup.redis.user_label"></span> <span id="redis-user-required-indicator" data-i18n="common.optional"></span></label>
                    <input
                        type="text"
                        id="redis-user"
                        name="user"
                        value="${o.user||""}"
                        data-i18n-placeholder="setup.redis.user_placeholder"
                        maxlength="128"
                        data-i18n-title="setup.redis.user_error"
                    >
                    <div class="form-help" data-i18n="setup.redis.user_help"></div>
                    <div class="invalid-feedback" data-i18n="setup.redis.user_error"></div>
                </div>

                <div id="redis-admin-config" style="background: var(--gray-50); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; display: none;">
                    <h4 style="margin: 0 0 0.5rem 0; color: var(--gray-700); font-size: 1rem;" data-i18n="setup.redis.admin_password_title"></h4>
                    <p style="margin: 0 0 1rem 0; color: var(--gray-600); font-size: 0.9rem;" data-i18n="setup.redis.admin_password_description"></p>
                    <div class="form-group">
                        <label for="redis-admin-password"><span data-i18n="setup.redis.admin_password_label"></span> <span data-i18n="common.required"></span></label>
                        <input
                            type="password"
                            id="redis-admin-password"
                            name="admin_password"
                            data-i18n-placeholder="setup.redis.admin_password_placeholder"
                            required
                            minlength="12"
                            maxlength="64"
                            pattern="^[A-Za-z\\d!@#$%^&*]{12,64}$"
                            data-i18n-title="setup.redis.admin_password_error"
                        >
                        <div class="form-help" data-i18n="setup.redis.admin_password_help"></div>
                        <div class="invalid-feedback" data-i18n="setup.redis.admin_password_error"></div>
                    </div>
                </div>

                <div class="form-group">
                    <label for="redis-password"><span data-i18n="setup.redis.password_label"></span> <span data-i18n="common.required"></span></label>
                    <input
                        type="password"
                        id="redis-password"
                        name="password"
                        data-i18n-placeholder="setup.redis.password_placeholder"
                        required
                        data-i18n-title="setup.redis.password_error"
                    >
                    <div class="form-help" data-i18n="setup.redis.password_help"></div>
                    <div class="invalid-feedback" data-i18n="setup.redis.password_error"></div>
                </div>

                <div id="redis-test-connection-container" style="display: none;">
                    <div class="form-group">
                        <button type="button" id="redis-test-btn" class="btn btn-outline-primary" data-i18n="setup.redis.test_connection"></button>
                    </div>
                    <div id="redis-connection-results" class="connection-results-container"></div>
                </div>

                <div class="btn-group">
                    <button type="button" class="btn btn-secondary" id="redis-prev-btn" data-i18n="common.previous"></button>
                    <button type="submit" class="btn btn-primary" data-i18n="common.next"></button>
                </div>
            </form>
        `,document.getElementById("redis-prev-btn").addEventListener("click",()=>{t.previousStep()});let d=document.querySelectorAll('input[name="redis-service-type"]');d.forEach(p=>{p.addEventListener("change",g=>{Z(g.target.value),s.updateRadioStyles("redis-service-type")})}),Z(o.service_type),s.updateRadioStyles("redis-service-type");let n=document.getElementById("redis-password");n&&o.password&&(n.value=o.password);let l=document.getElementById("redis-admin-password");l&&o.admin_password&&(l.value=o.admin_password),setTimeout(()=>{Z(o.service_type)},100);let c=()=>{let p=document.querySelector('input[name="redis-service-type"]:checked').value,g=document.getElementById("redis-password"),y=document.getElementById("redis-admin-password"),_=g.value;if(_){let h=!0,f="";p==="docker"?(h=C(_),f=r?r.t("setup.redis.password_error"):"Password must be 12-64 characters with at least 3 types: lowercase, uppercase, numbers, special characters (!@#$%^&*)"):(h=L(_),f=r?r.t("setup.redis.password_external_error"):"Password must be 1-128 characters and cannot contain control characters"),h?(g.setCustomValidity(""),b(g)):(g.setCustomValidity(f),S(g,f))}else g.setCustomValidity(""),b(g);if(p==="docker"&&y){let h=y.value;if(h){let f=C(h),w=r?r.t("setup.redis.admin_password_error"):"CLI password must be 12-64 characters with at least 3 types: lowercase, uppercase, numbers, special characters (!@#$%^&*)";f?(y.setCustomValidity(""),b(y)):(y.setCustomValidity(w),S(y,w))}else y.setCustomValidity(""),b(y)}else y&&(y.setCustomValidity(""),b(y))},m=document.getElementById("redis-password"),v=document.getElementById("redis-admin-password");m&&m.addEventListener("input",c.bind(this)),v&&v.addEventListener("input",c.bind(this)),d.forEach(p=>{p.addEventListener("change",()=>{setTimeout(()=>c.bind(this)(),10)})}),document.getElementById("redis-form").addEventListener("submit",async p=>{p.preventDefault();let g=document.querySelector('input[name="redis-service-type"]:checked').value,y=document.getElementById("redis-password").value,_=document.getElementById("redis-password");if(y){let f=!0,w="";g==="docker"?(f=C(y),w=r?r.t("setup.redis.password_error"):"Password must be 12-64 characters with at least 3 types: lowercase, uppercase, numbers, special characters (!@#$%^&*)"):(f=L(y),w=r?r.t("setup.redis.password_external_error"):"Password must be 1-128 characters and cannot contain control characters"),f?_.setCustomValidity(""):_.setCustomValidity(w)}else _.setCustomValidity("");let h=document.getElementById("redis-admin-password");if(g==="docker"){let f=h?h.value:"";if(f)if(C(f))h.setCustomValidity("");else{let I=r?r.t("setup.redis.admin_password_error"):"CLI password must be 12-64 characters with at least 3 types: lowercase, uppercase, numbers, special characters (!@#$%^&*)";h.setCustomValidity(I)}else h&&h.setCustomValidity("")}else h&&h.setCustomValidity("");if(p.target.checkValidity()){let f=document.querySelector('input[name="redis-service-type"]:checked').value,w={service_type:f,host:f==="docker"?"localhost":document.getElementById("redis-host").value,port:parseInt(document.getElementById("redis-port").value),user:document.getElementById("redis-user")?document.getElementById("redis-user").value:"",password:document.getElementById("redis-password").value};f==="docker"?w.admin_password=document.getElementById("redis-admin-password").value:w.admin_password="",e.set("redis",w),e.saveToLocalCache(),await e.saveWithValidation()}else E(p.target)});let u=document.getElementById("redis-test-btn");u&&u.addEventListener("click",()=>Ie(a,e,s,r)),k(i)}async function qe(i,e,t,s){await i.protectedApiCall("testSMTP",async()=>{let a={...e.getAll()};a.smtp={server:document.getElementById("smtp-server").value,port:parseInt(document.getElementById("smtp-port").value),user:document.getElementById("smtp-user").value,password:document.getElementById("smtp-password").value,sender:document.getElementById("smtp-sender").value};let r=document.getElementById("smtp-test-btn"),o=r.textContent;r.disabled=!0,r.textContent=s?s.t("common.testing"):"Testing...";try{let d=await i.testConnections("smtp",a);$e(d.data,"smtp")}catch(d){t.showAlert("error",s?s.t("messages.errors.failed_test_connections",{error:d.message}):"Connection test failed: "+d.message)}finally{r.disabled=!1,r.textContent=o}},a=>{a.validationErrors&&a.validationErrors.length>0?x(a.validationErrors,s):t.showAlert("error",a.message)})}function $e(i,e){let s=document.getElementById("smtp-connection-results");if(s){let a=i.filter(r=>r.service===e);s.innerHTML=a.length>0?`
            <div class="connection-results">
                ${a.map(r=>`
                    <div class="connection-result ${r.success?"success":"error"}">
                        <div class="connection-result-icon">
                            ${r.success?"\u2713":"\u2717"}
                        </div>
                        <div class="connection-result-text">
                            <strong>${r.service.toUpperCase()}</strong>: ${r.message}
                        </div>
                    </div>
                `).join("")}
            </div>
        `:""}}function Ae(){let i=["smtp-server","smtp-port","smtp-user","smtp-password","smtp-sender"],e=document.getElementById("smtp-test-btn"),t=()=>{let s=i.every(a=>{let r=document.getElementById(a);return r&&r.value.trim()!==""});e&&(e.disabled=!s)};i.forEach(s=>{let a=document.getElementById(s);a&&(a.addEventListener("input",t),a.addEventListener("blur",t))}),t()}function ce(i,{config:e,navigation:t,ui:s,apiClient:a,i18n:r}){let o=e.get("smtp");i.innerHTML=`
            <form id="smtp-form" class="form-section" novalidate>
                <h3 data-i18n="setup.smtp.title"></h3>
                <p style="margin-bottom: 1.5rem; color: var(--gray-600);" data-i18n="setup.smtp.description"></p>

                <div class="form-row">
                    <div class="form-group">
                        <label for="smtp-server"><span data-i18n="setup.smtp.server_label"></span> <span data-i18n="common.required"></span></label>
                        <input
                            type="text"
                            id="smtp-server"
                            name="server"
                            value="${o.server}"
                            data-i18n-placeholder="setup.smtp.server_placeholder"
                            required
                            pattern="^[a-zA-Z0-9.\\-]+$"
                            data-i18n-title="setup.smtp.server_error"
                        >
                        <div class="form-help" data-i18n="setup.smtp.server_help"></div>
                        <div class="invalid-feedback" data-i18n="setup.smtp.server_error"></div>
                    </div>
                    <div class="form-group">
                        <label for="smtp-port"><span data-i18n="setup.smtp.port_label"></span> <span data-i18n="common.required"></span></label>
                        <input
                            type="number"
                            id="smtp-port"
                            name="port"
                            value="${o.port}"
                            data-i18n-placeholder="setup.smtp.port_placeholder"
                            required
                            min="1"
                            max="65535"
                            data-i18n-title="setup.smtp.port_error"
                        >
                        <div class="form-help" data-i18n="setup.smtp.port_help"></div>
                        <div class="invalid-feedback" data-i18n="setup.smtp.port_error"></div>
                    </div>
                </div>

                <div class="form-group">
                    <label for="smtp-user"><span data-i18n="setup.smtp.user_label"></span> <span data-i18n="common.required"></span></label>
                    <input
                        type="text"
                        id="smtp-user"
                        name="user"
                        value="${o.user}"
                        data-i18n-placeholder="setup.smtp.user_placeholder"
                        required
                        data-i18n-title="setup.smtp.user_error"
                    >
                    <div class="form-help" data-i18n="setup.smtp.user_help"></div>
                    <div class="invalid-feedback" data-i18n="setup.smtp.user_error"></div>
                </div>

                <div class="form-group">
                    <label for="smtp-password"><span data-i18n="setup.smtp.password_label"></span> <span data-i18n="common.required"></span></label>
                    <input
                        type="password"
                        id="smtp-password"
                        name="password"
                        data-i18n-placeholder="setup.smtp.password_placeholder"
                        required
                        data-i18n-title="setup.smtp.password_error"
                    >
                    <div class="form-help" data-i18n="setup.smtp.password_help"></div>
                    <div class="invalid-feedback" data-i18n="setup.smtp.password_error"></div>
                </div>

                <div class="form-group">
                    <label for="smtp-sender"><span data-i18n="setup.smtp.sender_label"></span> <span data-i18n="common.required"></span></label>
                    <input
                        type="email"
                        id="smtp-sender"
                        name="sender"
                        value="${o.sender}"
                        data-i18n-placeholder="setup.smtp.sender_placeholder"
                        required
                        data-i18n-title="setup.smtp.sender_error"
                    >
                    <div class="form-help" data-i18n="setup.smtp.sender_help"></div>
                    <div class="invalid-feedback" data-i18n="setup.smtp.sender_error"></div>
                </div>

                <div id="smtp-test-connection-container">
                    <div class="form-group">
                        <button type="button" id="smtp-test-btn" class="btn btn-outline-primary" data-i18n="setup.smtp.test_connection" disabled></button>
                        <div class="form-help" data-i18n="setup.smtp.test_connection_help"></div>
                    </div>
                    <div id="smtp-connection-results" class="connection-results-container"></div>
                </div>

                <div class="btn-group">
                    <button type="button" class="btn btn-secondary" id="smtp-prev-btn" data-i18n="common.previous"></button>
                    <button type="submit" class="btn btn-primary" data-i18n="common.next"></button>
                </div>
            </form>
        `,document.getElementById("smtp-prev-btn").addEventListener("click",()=>{t.previousStep()});let d=document.getElementById("smtp-password");d&&o.password&&(d.value=o.password),Ae(),document.getElementById("smtp-form").addEventListener("submit",async l=>{l.preventDefault(),l.target.checkValidity()?(e.set("smtp",{server:document.getElementById("smtp-server").value,port:parseInt(document.getElementById("smtp-port").value),user:document.getElementById("smtp-user").value,password:document.getElementById("smtp-password").value,sender:document.getElementById("smtp-sender").value}),e.saveToLocalCache(),await e.saveWithValidation()):E(l.target)});let n=document.getElementById("smtp-test-btn");n&&n.addEventListener("click",()=>qe(a,e,s,r)),k(i)}function R(i,e){let t=document.getElementById("geo-file-info"),s=document.querySelector("#geo-upload-area .file-upload-content");if(!t||!s)return;let a=i.get("goaccess");if(a.has_geo_file&&a.geo_file_temp_path){s.style.display="none",t.style.display="block";let r=a.original_file_name||a.geo_file_temp_path.split("/").pop(),o=a.file_size,d=t.querySelector("#geo-file-name"),n=t.querySelector("#geo-file-size");if(d&&(d.textContent=r),n){let c=e?e.t("common.unknown"):"Unknown";n.textContent=typeof o=="number"&&o>0?H(o,e):c}let l=t.querySelector("#geo-upload-progress");if(l&&l.remove(),!t.querySelector("#geo-upload-progress")){let c=e?e.t("setup.app.jwt_upload_success"):"Upload successful!",m=document.createElement("p");m.id="geo-upload-progress",m.textContent=c,m.style.color="var(--success-color)",t.appendChild(m)}}else s.style.display="block",t.style.display="none"}async function Fe(i,e,t){try{let s=await i.getGeoFileStatus();if(s.success&&s.data){let{exists:a,file_name:r,file_size:o,temp_path:d}=s.data,n=e.get("goaccess");n.has_geo_file&&!a?(console.log("GeoIP file cache inconsistent with actual file status, resetting..."),n.has_geo_file=!1,n.geo_file_temp_path="",n.original_file_name="",n.file_size=0,e.set("goaccess",n),e.saveToLocalCache(),R(e,t)):!n.has_geo_file&&a&&(console.log("Found GeoIP file but cache shows no file, updating cache..."),n.has_geo_file=!0,n.geo_file_temp_path=d,n.original_file_name=r,n.file_size=o,e.set("goaccess",n),e.saveToLocalCache(),R(e,t))}}catch(s){console.warn("Failed to check GeoIP file status:",s)}}async function pe(i,e,t,s,a){let r=s||document.getElementById("geo-file-info"),o=document.getElementById("geo-upload-area");try{if(!await i.protectedApiCall("geoFileUpload",async()=>{if(!r){console.error("fileInfoDiv is null in handleGeoFileSelect");return}if(!t.name.endsWith(".mmdb")){let p=a?a.t("setup.goaccess.invalid_file_type"):"Please select a valid .mmdb file";alert(p);return}let n=100*1024*1024;if(t.size>n){let p=a?a.t("setup.goaccess.file_too_large"):"File size too large. Maximum allowed size is 100MB";alert(p);return}if(o){let p=o.closest(".form-group");if(p){p.classList.remove("error");let g=p.querySelector(".invalid-feedback");g&&(g.style.display="none",g.textContent="")}}let l=document.querySelector("#geo-upload-area .file-upload-content");l&&(l.style.display="none"),o&&(o.style.pointerEvents="none",o.style.opacity="0.6"),r.style.display="block",r.querySelector("#geo-file-name").textContent=t.name,r.querySelector("#geo-file-size").textContent=H(t.size,a);let c=r.querySelector("#geo-upload-progress");c&&c.remove();let m=a?a.t("setup.app.jwt_uploading"):"Uploading...",v=document.createElement("p");v.id="geo-upload-progress",v.textContent=m,r.appendChild(v);let u=await i.uploadGeoFile(t);if(u.success){let p=r.querySelector("#geo-upload-progress");if(p){let y=a?a.t("setup.app.jwt_upload_success"):"Upload successful!";p.textContent=y,p.style.color="var(--success-color)"}let g=e.get("goaccess");return g.has_geo_file=!0,g.geo_file_temp_path=u.data.temp_path,g.original_file_name=t.name,g.file_size=t.size,e.set("goaccess",g),o&&(o.style.pointerEvents="",o.style.opacity=""),u}else{let p=a?a.t("messages.errors.upload_failed"):"Upload failed";throw new Error(u.message||p)}}))return}catch(d){if(console.error("File upload error:",d),r){let l=r.querySelector("#geo-upload-progress");if(l){let c=a?a.t("setup.app.jwt_upload_failed"):"Upload failed";l.textContent=`${c}: ${d.message}`,l.style.color="var(--error-color)"}}o&&(o.style.pointerEvents="",o.style.opacity="");let n=e.get("goaccess");n.has_geo_file=!1,e.set("goaccess",n),setTimeout(()=>{ue()},2e3)}}function ue(){let i=document.getElementById("geo-file-info"),e=document.querySelector("#geo-upload-area .file-upload-content");if(i&&e){i.style.display="none",e.style.display="block";let t=document.getElementById("goaccess-geo-file");t&&(t.value="")}}function Ve(i,e,t){let s=!0;B(e);let a=e.querySelector("#goaccess-enabled").checked,r=i.get("goaccess");if(a&&(!r.has_geo_file||r.has_geo_file&&!r.geo_file_temp_path)){s=!1;let o=e.querySelector("#geo-upload-area"),d;r.has_geo_file?d=t?t.t("setup.goaccess.geo_file_missing"):"GeoIP database file is no longer available. Please re-upload your GeoIP database file.":d=t?t.t("setup.goaccess.geo_file_required"):"GeoIP database file is required when GoAccess is enabled",q(o,d)}return s}function me(i,{config:e,navigation:t,apiClient:s,i18n:a}){let r=e.get("goaccess");i.innerHTML=`
            <form id="goaccess-form" class="form-section" novalidate>
                <h3 data-i18n="setup.goaccess.title"></h3>
                <p style="margin-bottom: 1.5rem; color: var(--gray-600);" data-i18n="setup.goaccess.description"></p>

                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="goaccess-enabled" name="enabled" ${r.enabled?"checked":""}>
                        <span data-i18n="setup.goaccess.enable_label"></span>
                    </label>
                </div>

                <div id="goaccess-config" style="display: ${r.enabled?"block":"none"};">
                    <div class="form-group">
                        <label for="goaccess-geo-file"><span data-i18n="setup.goaccess.geo_file_label"></span></label>
                        <div class="file-upload-area" id="geo-upload-area">
                            <input type="file" id="goaccess-geo-file" name="geo_file" accept=".mmdb" style="display: none;">
                            <div class="file-upload-content">
                                <div class="file-upload-icon">\u{1F4C1}</div>
                                <p data-i18n="setup.goaccess.geo_file_help"></p>
                                <button type="button" class="btn-secondary" id="geo-file-select-btn">
                                    <span data-i18n="setup.goaccess.select_file"></span>
                                </button>
                            </div>
                            <div id="geo-file-info" style="display: none;">
                                <p><strong data-i18n="setup.goaccess.selected_file"></strong>: <span id="geo-file-name"></span></p>
                                <p><strong data-i18n="setup.goaccess.file_size"></strong>: <span id="geo-file-size"></span></p>
                                <button type="button" id="geo-reselect-btn" class="btn-secondary" style="margin-top: 0.5rem;">
                                    <span data-i18n="setup.goaccess.select_file"></span>
                                </button>
                            </div>
                        </div>
                        <div class="invalid-feedback" style="display: none;"></div>
                        <div class="form-help">
                            <span data-i18n="setup.goaccess.geo_file_note"></span>
                            <a href="https://dev.maxmind.com/geoip/geolite2-free-geolocation-data" target="_blank" data-i18n="setup.goaccess.download_link"></a>
                        </div>
                    </div>
                </div>

                <div class="btn-group">
                    <button type="button" class="btn btn-secondary" id="goaccess-prev-btn">
                        <span data-i18n="common.previous"></span>
                    </button>
                    <button type="submit" class="btn btn-primary">
                        <span data-i18n="common.next"></span>
                    </button>
                </div>
            </form>
        `,document.getElementById("goaccess-prev-btn").addEventListener("click",()=>{t.previousStep()});let o=i.querySelector("#goaccess-enabled"),d=i.querySelector("#goaccess-config"),n=i.querySelector("#goaccess-geo-file"),l=i.querySelector("#geo-upload-area"),c=i.querySelector("#file-info");o.addEventListener("change",u=>{d.style.display=u.target.checked?"block":"none";let p=e.get("goaccess");if(p.enabled=u.target.checked,e.set("goaccess",p),!u.target.checked){let g=l.closest(".form-group");if(g){g.classList.remove("error");let y=g.querySelector(".invalid-feedback");y&&(y.style.display="none",y.textContent="")}}}),l.addEventListener("dragover",u=>{u.preventDefault(),l.classList.add("drag-over")}),l.addEventListener("dragleave",u=>{u.preventDefault(),l.classList.remove("drag-over")}),l.addEventListener("drop",u=>{if(u.preventDefault(),l.classList.remove("drag-over"),s.requestLocks.geoFileUpload){let g=a?a.t("messages.upload_in_progress"):"File upload in progress...";alert(g);return}let p=u.dataTransfer.files;p.length>0&&pe(s,e,p[0],c,a)});let m=i.querySelector("#geo-file-select-btn");m&&m.addEventListener("click",()=>{if(s.requestLocks.geoFileUpload){let u=a?a.t("messages.upload_in_progress"):"File upload in progress...";alert(u);return}n.click()});let v=i.querySelector("#geo-reselect-btn");v&&v.addEventListener("click",()=>{ue()}),n.addEventListener("change",u=>{if(u.target.files.length>0){if(s.requestLocks.geoFileUpload){let p=a?a.t("messages.upload_in_progress"):"File upload in progress...";alert(p),u.target.value="";return}pe(s,e,u.target.files[0],c,a)}}),i.querySelector("#goaccess-form").addEventListener("submit",u=>{if(u.preventDefault(),Ve(e,u.target,a)){let p=u.target,g=e.get("goaccess");g.enabled=p.querySelector("#goaccess-enabled").checked,e.set("goaccess",g),e.saveToLocalCache(),t.nextStep()}else E(u.target)}),Fe(s,e,a)}function ze(i,e){try{let t=i.getAll(),s=e?e.t("setup.review.cors_configured",{count:t.app.cors_allow_origins.length}):`${t.app.cors_allow_origins.length} configured`,r=`
            <h4 data-i18n="setup.review.sections.database"></h4>
            <p><strong data-i18n="setup.review.fields.service_type"></strong>: ${e?e.t(`setup.database.service_type_${t.database.service_type}`):t.database.service_type}</p>
            <p><strong data-i18n="setup.review.fields.host"></strong>: ${t.database.host}:${t.database.port}</p>
            <p><strong data-i18n="setup.review.fields.database"></strong>: ${t.database.name}</p>
            <p><strong data-i18n="setup.review.fields.app_user"></strong>: ${t.database.app_user}</p>`;t.database.service_type==="docker"&&t.database.super_user&&(r+=`
            <p><strong data-i18n="setup.review.fields.super_user"></strong>: ${t.database.super_user}</p>`),document.getElementById("config-review").innerHTML=`
            <div style="text-align: left;">
                ${r}

                <h4 style="margin-top: 1.5rem;" data-i18n="setup.review.sections.redis"></h4>
                <p><strong data-i18n="setup.review.fields.service_type"></strong>: ${e?e.t(`setup.redis.service_type_${t.redis.service_type}`):t.redis.service_type}</p>
                <p><strong data-i18n="setup.review.fields.host"></strong>: ${t.redis.host}:${t.redis.port}</p>
                ${t.redis.user?`<p><strong data-i18n="setup.review.fields.user"></strong>: ${t.redis.user}</p>`:""}

                <h4 style="margin-top: 1.5rem;" data-i18n="setup.review.sections.smtp"></h4>
                <p><strong data-i18n="setup.review.fields.smtp_server"></strong>: ${t.smtp.server}:${t.smtp.port}</p>
                <p><strong data-i18n="setup.review.fields.smtp_user"></strong>: ${t.smtp.user}</p>
                <p><strong data-i18n="setup.review.fields.smtp_sender"></strong>: ${t.smtp.sender}</p>

                <h4 style="margin-top: 1.5rem;" data-i18n="setup.review.sections.application"></h4>
                <p><strong data-i18n="setup.review.fields.domain"></strong>: ${t.app.domain_name}</p>
                <p><strong data-i18n="setup.review.fields.static_host"></strong>: ${t.app.static_host_name}</p>
                <p><strong data-i18n="setup.review.fields.brand"></strong>: ${t.app.brand_name}</p>
                <p><strong data-i18n="setup.review.fields.version"></strong>: ${t.app.version||"latest"}</p>
                <p><strong data-i18n="setup.review.fields.language"></strong>: ${t.app.default_lang}</p>
                <p><strong data-i18n="setup.review.fields.cors_origins"></strong>: ${s}</p>
                <p><strong data-i18n="setup.review.fields.jwt_mode"></strong>: ${t.app.jwt_key_from_file?e?e.t("setup.review.jwt_from_file"):"From File":e?e.t("setup.review.jwt_auto_generate"):"Auto Generate"}</p>
                ${t.app.jwt_key_from_file?`
                    <p><strong data-i18n="setup.review.fields.jwt_file_path"></strong>: ${t.app.jwt_key_file_path}</p>
                `:""}
                <p><strong data-i18n="setup.review.fields.reverse_proxy"></strong>: ${t.reverse_proxy?.type||"caddy"}</p>

                <h4 style="margin-top: 1.5rem;" data-i18n="setup.review.sections.ssl"></h4>
                <p><strong data-i18n="setup.review.fields.ssl_enabled"></strong>: ${t.ssl.enabled?e?e.t("common.yes"):"Yes":e?e.t("common.no"):"No"}</p>
                ${t.ssl.enabled?`
                    <p><strong data-i18n="setup.review.fields.ssl_cert_path"></strong>: ${t.ssl.cert_path}</p>
                    <p><strong data-i18n="setup.review.fields.ssl_key_path"></strong>: ${t.ssl.key_path}</p>
                    <p><strong data-i18n="setup.review.fields.ssl_use_setup_cert"></strong>: ${t.ssl.use_setup_cert?e?e.t("common.yes"):"Yes":e?e.t("common.no"):"No"}</p>
                `:""}

                <h4 style="margin-top: 1.5rem;" data-i18n="setup.review.sections.administrator"></h4>
                <p><strong data-i18n="setup.review.fields.username"></strong>: ${t.admin_user.username}</p>
                <p><strong data-i18n="setup.review.fields.email"></strong>: ${t.admin_user.email}</p>

                <h4 style="margin-top: 1.5rem;" data-i18n="setup.review.sections.oauth"></h4>
                <p><strong data-i18n="setup.review.fields.google_oauth"></strong>: ${t.oauth.google_enabled?e?e.t("setup.review.fields.oauth_enabled"):"Enabled":e?e.t("setup.review.fields.oauth_disabled"):"Disabled"}</p>
                <p><strong data-i18n="setup.review.fields.github_oauth"></strong>: ${t.oauth.github_enabled?e?e.t("setup.review.fields.oauth_enabled"):"Enabled":e?e.t("setup.review.fields.oauth_disabled"):"Disabled"}</p>

                <h4 style="margin-top: 1.5rem;" data-i18n="setup.review.sections.goaccess"></h4>
                <p><strong data-i18n="setup.review.fields.goaccess_enabled"></strong>: ${t.goaccess.enabled?e?e.t("common.yes"):"Yes":e?e.t("common.no"):"No"}</p>
                ${t.goaccess.enabled&&t.goaccess.has_geo_file?`
                    <p><strong data-i18n="setup.review.fields.goaccess_geo_file"></strong>: ${t.goaccess.original_file_name||"GeoLite2-City.mmdb"}</p>
                `:""}
            </div>
        `}catch(t){document.getElementById("config-review").innerHTML=`
            <div class="alert alert-error">${e?e.t("messages.failed_get_config"):"Failed to load configuration"}: ${t.message}</div>
        `}e&&e.applyTranslations()}function ge(i,{config:e,navigation:t,setupService:s,i18n:a}){i.innerHTML=`
            <div class="form-section">
                <h3 data-i18n="setup.review.title"></h3>
                <p style="margin-bottom: 1.5rem; color: var(--gray-600);" data-i18n="setup.review.description"></p>

                <div id="config-review">
                    <div class="loading">
                        <div class="loading-spinner"></div>
                    </div>
                </div>

                <div class="btn-group">
                    <button class="btn btn-secondary" id="review-prev-btn" data-i18n="common.previous"></button>
                    <button class="btn btn-success" id="generate-config-btn" data-i18n="setup.review.generate_button"></button>
                </div>
            </div>
        `,document.getElementById("review-prev-btn").addEventListener("click",()=>{t.previousStep()}),document.getElementById("generate-config-btn").addEventListener("click",async()=>{await s.generateConfig()}),ze(e,a)}function he(i,{setupService:e,i18n:t}){i.innerHTML=`
            <div class="form-section">
                <h3 style="text-align: center;">
                    <span style="color: var(--success-color); margin-right: 0.5rem;">\u2713</span>
                    <span data-i18n="setup.config_complete.title"></span>
                </h3>
                <p style="margin-bottom: 2rem; color: var(--gray-600); line-height: 1.6;" data-i18n="setup.config_complete.description"></p>

                <div style="background: var(--info-bg, #e3f2fd); border: 1px solid var(--info-border, #1976d2); border-radius: 4px; padding: 1rem; margin: 2rem 0;">
                    <p style="margin: 0 0 0.5rem 0; color: var(--gray-700); font-weight: 600;" data-i18n-html="setup.config_complete.ready_notice" id="ready-notice"></p>
                    <p style="margin: 0; color: var(--gray-600); line-height: 1.6;" data-i18n-html="setup.config_complete.ready_description" id="ready-description"></p>
                </div>

            </div>
        `,setTimeout(()=>{if(t){let a={outputPath:e.outputPath||"./output"},r=document.getElementById("ready-notice"),o=document.getElementById("ready-description");if(r){let d=t.t("setup.config_complete.ready_notice",a);r.innerHTML=d,r.removeAttribute("data-i18n-html")}if(o){let n=t.t("setup.config_complete.ready_description",a).replace(/<code>([^<]*cd [^<]*)<\/code>/g,'<code class="complete-step-code">$1</code>');o.innerHTML=n,o.removeAttribute("data-i18n-html")}}},50)}var K=class{constructor(){this.currentStep=0,this.token=null,this.shouldAutoScroll=!0,this.i18n=new T,this.apiClient=new F(this.i18n);let e={database:{service_type:"docker",host:"localhost",port:5433,name:"baklab",user:"baklab",password:""},redis:{service_type:"docker",host:"localhost",port:6377,user:"",password:"",admin_password:""},smtp:{server:"",port:587,user:"",password:"",sender:""},app:{domain_name:"",static_host_name:"",brand_name:"BakLab",default_lang:"en",version:"latest",debug:!1,cors_allow_origins:[],session_secret:"",csrf_secret:"",jwt_key_file_path:"/host/path/to/jwt.pem",jwt_key_from_file:!1,original_file_name:"",file_size:0,cloudflare_site_key:"",cloudflare_secret:"",use_setup_domain:!1},oauth:{google_enabled:!1,google_client_id:"",google_client_secret:"",github_enabled:!1,github_client_id:"",github_client_secret:"",frontend_origin:""},admin_user:{username:"admin",email:"",password:""},goaccess:{enabled:!1,geo_db_path:"./geoip/GeoLite2-City.mmdb",has_geo_file:!1},ssl:{enabled:!1,cert_path:"",key_path:"",use_setup_cert:!1}};this.configStore=new V(e),this.steps=[{key:"welcome",titleKey:"setup.steps.welcome",handler:(t,s)=>te(t,s)},{key:"database",titleKey:"setup.steps.database",handler:(t,s)=>se(t,s)},{key:"redis",titleKey:"setup.steps.redis",handler:(t,s)=>le(t,s)},{key:"smtp",titleKey:"setup.steps.smtp",handler:(t,s)=>ce(t,s)},{key:"app",titleKey:"setup.steps.application",handler:(t,s)=>ie(t,s)},{key:"ssl",titleKey:"setup.steps.ssl",handler:(t,s)=>oe(t,s)},{key:"admin",titleKey:"setup.steps.admin_user",handler:(t,s)=>ae(t,s)},{key:"oauth",titleKey:"setup.steps.oauth",handler:(t,s)=>de(t,s)},{key:"goaccess",titleKey:"setup.steps.goaccess",handler:(t,s)=>me(t,s)},{key:"review",titleKey:"setup.steps.review",handler:(t,s)=>ge(t,s)},{key:"config_complete",titleKey:"setup.steps.config_complete",handler:(t,s)=>he(t,s)}],this.navigation=new P(this.steps,()=>this.currentStep,t=>{this.currentStep=t,this.render()}),this.ui=new z(this.i18n),this.config=new M(this.configStore,this.navigation,this.apiClient,this.ui),this.setupService=new j(this.apiClient,this.navigation,this.ui,this.config,this.i18n),this.init()}get configData(){return this.configStore.getAll()}set configData(e){this.configStore.setAll(e)}async init(){this.setFavicon(),await this.i18n.init(),this.i18n.setLanguageChangeCallback(()=>this.render());try{this.loadFromLocalCache();let t=new URLSearchParams(window.location.search).get("token");t&&(this.token=t,this.apiClient.setToken(t),this.currentStep=0,await this.checkAndLoadImportedConfig()),this.render()}catch(e){console.error("Initialization error:",e),this.render()}}render(){this.setFavicon();let e=document.getElementById("app"),t=this.steps[this.currentStep];e.innerHTML=`
            <div class="container">
                <div class="sidebar">
                    <div class="sidebar-header">
                        <h1 class="sidebar-title">
                            <img src="/static/logo-icon.png" alt="BakLab Logo" class="sidebar-logo">
                            <span data-i18n="setup.title"></span>
                        </h1>
                        <p class="sidebar-subtitle" data-i18n="setup.subtitle"></p>
                    </div>
                    ${this.renderSidebarSteps()}
                </div>

                <div class="main-content">
                    <div class="header">
                        <h1 data-i18n="${t.titleKey}"></h1>
                    </div>

                    <div class="setup-card">
                        <div id="step-content"></div>
                    </div>
                </div>
            </div>
        `;let s=document.getElementById("step-content");t.handler(s,{config:this.config,navigation:this.navigation,ui:this.ui,apiClient:this.apiClient,setupService:this.setupService,i18n:this.i18n}),this.i18n.applyTranslations(),document.getElementById("language-switcher")&&this.i18n.generateLanguageSelector("language-switcher",{showLabel:!1,className:"language-selector",style:"dropdown"}),document.querySelectorAll(".sidebar-step[data-step-index]").forEach(r=>{r.addEventListener("click",()=>{let o=parseInt(r.getAttribute("data-step-index"));this.currentStep=o,this.render()})}),this.updateUploadStates()}renderSidebarSteps(){return`
            <div class="sidebar-steps">
                ${this.steps.map((e,t)=>`
                    <div class="sidebar-step ${t<this.currentStep?"completed":t===this.currentStep?"active":""}"
                         ${t<this.currentStep?`data-step-index="${t}" style="cursor: pointer;"`:""}>
                        <div class="sidebar-step-circle">
                            ${t<this.currentStep?"\u2713":t+1}
                        </div>
                        <div class="sidebar-step-label" data-i18n="${e.titleKey}"></div>
                    </div>
                `).join("")}
            </div>
        `}loadFromLocalCache(){this.configStore.loadFromLocalCache()}async checkAndLoadImportedConfig(){try{let e=await this.apiClient.getStatus();if(e.success&&e.data&&e.data.revision_mode&&e.data.revision_mode.enabled){console.log("Revision mode detected, loading imported configuration...");let t=await this.apiClient.getConfig();t.success&&t.data&&(this.configStore.clearLocalCache(),this.configStore.setAll(t.data),this.config.saveToLocalCache())}}catch(e){console.warn("Failed to check or load imported configuration:",e)}}updateUploadStates(){R(this.config,this.i18n)}setFavicon(){document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]').forEach(a=>a.remove());let t=document.createElement("link");t.rel="icon",t.type="image/x-icon",t.href="/static/favicon.ico",document.head.appendChild(t);let s=document.createElement("link");s.rel="icon",s.type="image/png",s.href="/static/logo-icon.png",document.head.appendChild(s)}};document.addEventListener("DOMContentLoaded",()=>{window.app=new K});
