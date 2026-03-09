import { translate, evaluate } from './api.js';
import { detectMismatches, detectUsedTerms, loadGlossary } from './glossary.js';

export async function runTranslation({ apiKey, sourceText, direction, baseGlossary }) {
  const glossary = loadGlossary(baseGlossary);
  const translatedText = await translate(apiKey, sourceText, direction, glossary);
  const usedTerms = detectUsedTerms(translatedText, direction, glossary);
  return { translatedText, usedTerms };
}

export async function runEvaluation({ apiKey, sourceText, targetText, direction, baseGlossary }) {
  const glossary = loadGlossary(baseGlossary);
  const mismatches = detectMismatches(sourceText, targetText, direction, glossary);
  const result = await evaluate(apiKey, sourceText, targetText, direction, glossary);
  return { ...result, mismatches };
}
