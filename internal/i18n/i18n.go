package i18n

import (
	"encoding/json"
	"fmt"
	"strconv"
	"sync"
	"text/template"

	"github.com/nicksnyder/go-i18n/v2/i18n"
	"github.com/xeonx/timeago"
	"golang.org/x/text/language"

	_ "embed"
)

type LocalizeConfig interface {
	ParseData(data any) *i18n.LocalizeConfig
}

type I18nManager struct {
	bundle         *i18n.Bundle
	timeAgoConfigs map[language.Tag]*timeago.Config
	localizerCache sync.Map
}

type I18nCustom struct {
	CurrLang  language.Tag
	Bundle    *i18n.Bundle
	Localizer *i18n.Localizer
	TimeAgo   *timeago.Config
}

//go:embed json/en.json
var langEnData []byte

//go:embed json/zh-Hans.json
var langZhHans []byte

var LangFileDataMap = map[string][]byte{
	"json/en.json":      langEnData,
	"json/zh-Hans.json": langZhHans,
}

var LangTagFileMap = map[language.Tag]string{
	language.English:           "json/en.json",
	language.SimplifiedChinese: "json/zh-Hans.json",
}

func NewI18nManager(defaultLang language.Tag) *I18nManager {
	bundle := i18n.NewBundle(defaultLang)
	bundle.RegisterUnmarshalFunc("json", json.Unmarshal)

	for path, data := range LangFileDataMap {
		bundle.MustParseMessageFileBytes(data, path)
	}

	timeago.English.PastPrefix = " "
	timeago.English.DefaultLayout = " 2006-01-02"
	timeago.Chinese.PastPrefix = "于 "
	timeago.Chinese.DefaultLayout = "于 2006-01-02"

	timeAgoConfigs := map[language.Tag]*timeago.Config{
		language.English:           &timeago.English,
		language.SimplifiedChinese: &timeago.Chinese,
	}

	return &I18nManager{
		bundle:         bundle,
		timeAgoConfigs: timeAgoConfigs,
		localizerCache: sync.Map{},
	}
}

func (im *I18nManager) GetLocalizer(lang language.Tag) *I18nCustom {
	if cached, ok := im.localizerCache.Load(lang); ok {
		return cached.(*I18nCustom)
	}

	localizer := i18n.NewLocalizer(im.bundle, lang.String())

	timeAgo := &timeago.English
	if config, ok := im.timeAgoConfigs[lang]; ok {
		timeAgo = config
	}

	i18nCustom := &I18nCustom{
		CurrLang:  lang,
		Bundle:    im.bundle,
		Localizer: localizer,
		TimeAgo:   timeAgo,
	}

	actual, loaded := im.localizerCache.LoadOrStore(lang, i18nCustom)
	if loaded {
		return actual.(*I18nCustom)
	}
	return i18nCustom
}

func New(defaultLang language.Tag) *I18nCustom {
	Bundle := i18n.NewBundle(defaultLang)
	Bundle.RegisterUnmarshalFunc("json", json.Unmarshal)

	for path, data := range LangFileDataMap {
		Bundle.MustParseMessageFileBytes(data, path)
	}

	Localizer := i18n.NewLocalizer(Bundle, defaultLang.String())

	timeago.English.PastPrefix = " "
	timeago.English.DefaultLayout = " 2006-01-02"
	timeago.Chinese.PastPrefix = "于 "
	timeago.Chinese.DefaultLayout = "于 2006-01-02"

	custom := &I18nCustom{
		CurrLang:  defaultLang,
		Bundle:    Bundle,
		Localizer: Localizer,
		TimeAgo:   &timeago.English,
	}

	return custom
}

func (ic *I18nCustom) Localize(id string, templateData any, pluralcount any) (string, error) {
	config := &i18n.LocalizeConfig{
		MessageID: id,
		Funcs: template.FuncMap{
			"local": ic.LocalTpl,
		},
	}

	if templateData != "" && templateData != nil {
		config.TemplateData = templateData
	}

	if pluralcount != "" && pluralcount != nil {
		config.PluralCount = pluralcount
	}

	return ic.Localizer.Localize(config)
}

func (ic *I18nCustom) MustLocalize(id string, templateData any, pluralcount any) string {
	result, err := ic.Localize(id, templateData, pluralcount)

	if err != nil {
		fmt.Printf("i18n localize error: %v\n", err)
	}

	return result
}

func (ic *I18nCustom) SwitchLang(lang language.Tag) {
	switch lang {
	case language.Chinese:
		fallthrough
	case language.SimplifiedChinese:
		ic.TimeAgo = &timeago.Chinese
	default:
		ic.TimeAgo = &timeago.English
	}

	ic.Localizer = i18n.NewLocalizer(ic.Bundle, lang.String())
	ic.CurrLang = lang
}

func (ic *I18nCustom) LocalTpl(id string, data ...any) string {
	if len(data) == 0 {
		return ic.MustLocalize(id, "", "")
	}

	var tplData = make(map[any]any)
	for idx, item := range data {
		if idx%2 == 0 {
			val := data[idx+1]
			if item == "Count" {
				switch v := val.(type) {
				case string:
					tplData[item], _ = strconv.Atoi(v)
				case int32:
					tplData[item] = int(v)
				case int64:
					tplData[item] = int(v)
				case int:
					tplData[item] = v
				case float32:
					tplData[item] = int(v)
				case float64:
					tplData[item] = int(v)
				default:
					tplData[item] = 0
				}
			} else {
				tplData[item] = data[idx+1]
			}
		}
	}

	return ic.MustLocalize(id, tplData, tplData["Count"])
}