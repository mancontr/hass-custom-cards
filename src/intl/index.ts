import { ExtendedHomeAssistant } from '../types';
import en from './en.json'
import es from './es.json'

export const languages: { [k: string]: { [k: string]: string} } = {
  en,
  es,
}

export default function L(hass: ExtendedHomeAssistant, key: string) {
  const userLang = hass.selectedLanguage || hass.language || 'en'
  const lang = languages[userLang] || languages.en
  return lang[key] || languages.en[key] || key
}
