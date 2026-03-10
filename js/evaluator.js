import { translate, evaluate } from './api.js';
import { detectMismatches, detectUsedTerms, loadGlossary } from './glossary.js';

export async function runTranslation({ apiKey, segments, direction, baseGlossary }) {
  const glossary = loadGlossary(baseGlossary);
  const translatedSegments = await translate(apiKey, segments, direction, glossary);
  
  // Aggregate used terms across all translated segments
  const allUsedTerms = new Set();
  const usedTermsDetails = [];
  translatedSegments.forEach(target => {
    const used = detectUsedTerms(target, direction, glossary);
    used.forEach(t => {
      const key = t.id;
      if (!allUsedTerms.has(key)) {
        allUsedTerms.add(key);
        usedTermsDetails.push(t);
      }
    });
  });
  
  return { translatedSegments, usedTerms: usedTermsDetails };
}

export async function runEvaluation({ apiKey, segmentPairs, direction, baseGlossary }) {
  const glossary = loadGlossary(baseGlossary);
  
  // Detect mismatches per segment
  const mismatchesBySegment = segmentPairs.map(pair => 
    detectMismatches(pair.source, pair.target, direction, glossary)
  );

  const evalResults = await evaluate(apiKey, segmentPairs, direction, glossary);
  
  // Merge eval results with mismatches
  return evalResults.map((res, i) => ({
    ...res,
    mismatches: mismatchesBySegment[i] || []
  }));
}
