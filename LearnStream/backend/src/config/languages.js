// BCP-47 language tags for `course.language` and `user.language` (D3, user.model.js
// additions). A short, curated list rather than the full BCP-47 registry —
// this is what a course-language picker or a user-locale dropdown offers,
// not an exhaustive validator; `config/env.js`-style "keep the list the
// server actually needs" applies here too.
export const LANGUAGES = Object.freeze([
  { code: "en", label: "English" },
  { code: "en-US", label: "English (US)" },
  { code: "en-GB", label: "English (UK)" },
  { code: "hi", label: "Hindi" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
  { code: "pt-BR", label: "Portuguese (Brazil)" },
  { code: "zh", label: "Chinese" },
  { code: "zh-CN", label: "Chinese (Simplified)" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "ar", label: "Arabic" },
  { code: "ru", label: "Russian" },
  { code: "it", label: "Italian" },
  { code: "nl", label: "Dutch" },
  { code: "tr", label: "Turkish" },
  { code: "vi", label: "Vietnamese" },
  { code: "id", label: "Indonesian" },
  { code: "ta", label: "Tamil" },
  { code: "te", label: "Telugu" },
  { code: "mr", label: "Marathi" },
  { code: "bn", label: "Bengali" },
  { code: "gu", label: "Gujarati" },
]);

export const LANGUAGE_CODES = LANGUAGES.map((language) => language.code);

export const DEFAULT_LANGUAGE = "en";
