import { ExtendedHomeAssistant } from '../types';
import en from './en.json'
import es from './es.json'

export const languages: { [k: string]: { [k: string]: string} } = {
  en,
  es,
}

export default function L(hass: ExtendedHomeAssistant, key: string, params?: { [k: string]: string | number }) {
  const userLang = hass.selectedLanguage || hass.language || 'en'
  const lang = languages[userLang] || languages.en
  const template = lang[key] || languages.en[key] || key
  if (!params) return template
  return Object.keys(params).reduce((str, k) => str.replace(`{${k}}`, String(params[k])), template)
}
