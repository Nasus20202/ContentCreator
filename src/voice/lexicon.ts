/**
 * Spoken-form rewrites applied to narration just before TTS. Captions and fact-checking keep the
 * written form ("Artemis II"); only the audio uses the spoken one, because Kokoro's normaliser reads
 * Roman numerals literally ("Artemis roman two").
 */
const ROMAN: Record<string, string> = { II: 'two', III: 'three', IV: 'four', V: 'five', VI: 'six' };

const MISSION_NUMERAL =
  /\b(Artemis|Apollo|Gemini|Pioneer|Mariner|Ranger|Luna|Venera|Soyuz|Saturn)\s+(II|III|IV|V|VI)\b/g;

export function spokenForm(line: string): string {
  // Mission names with a Roman numeral: Artemis II, Gemini IV, Saturn V…
  return line.replace(MISSION_NUMERAL, (_m, name: string, n: string) => `${name} ${ROMAN[n]}`);
}
