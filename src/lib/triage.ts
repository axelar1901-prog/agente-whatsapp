const EMERGENCY_KEYWORDS = [
  "emergencia", "urgencia", "urgente", "accidente", "inconsciente",
  "no respira", "desmayo", "desmayó", "convulsión", "convulsiones",
  "derrame", "infarto", "ataque", "parálisis", "paralizado", "no puede mover",
  "mucho dolor de cabeza", "peor dolor", "sangrado", "sangra", "herida grave",
  "911", "ambulancia", "hospital urgente", "muy grave",
];

const URGENT_KEYWORDS = [
  "dolor fuerte", "dolor intenso", "dolor severo", "mucho dolor",
  "fiebre alta", "no puedo caminar", "no puedo hablar", "visión doble",
  "entumecimiento", "hormigueo", "confusión", "desorientado",
  "mareo fuerte", "vómito constante", "dolor de cabeza fuerte",
];

const HUMAN_REQUEST_KEYWORDS = [
  "hablar con alguien", "hablar con una persona", "hablar con recepcionista",
  "quiero hablar con", "necesito hablar con", "comunicarme con alguien",
  "atención humana", "persona real", "no quiero bot", "quiero una persona",
  "me comunicas", "comunícame", "atiéndeme", "necesito ayuda de una persona",
];

export function isHumanRequest(text: string): boolean {
  const lower = text.toLowerCase();
  return HUMAN_REQUEST_KEYWORDS.some((k) => lower.includes(k));
}

export type TriageLevel = "emergency" | "urgent" | "normal";

export function assessTriage(text: string): TriageLevel {
  const lower = text.toLowerCase();
  if (EMERGENCY_KEYWORDS.some((k) => lower.includes(k))) return "emergency";
  if (URGENT_KEYWORDS.some((k) => lower.includes(k))) return "urgent";
  return "normal";
}

export function getTriageResponse(level: TriageLevel): string | null {
  if (level === "emergency") {
    return `🚨 *EMERGENCIA MÉDICA*\n\nLlame al *911* de inmediato o diríjase a la sala de urgencias más cercana.\n\nNo espere — en situaciones de emergencia neurológica cada minuto cuenta. Si necesita orientación posterior, con gusto le ayudamos aquí.`;
  }
  if (level === "urgent") {
    return `⚠️ Los síntomas que describe requieren atención pronta.\n\nLe recomendamos acudir al consultorio *hoy mismo* o llamarnos al *33 1234 5678* para orientación inmediata.\n\nSi los síntomas empeoran, llame al *911* sin esperar.`;
  }
  return null;
}
