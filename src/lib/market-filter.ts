import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Deterministic pre-filter for scouted videos (Dan: "English only, United States only — nothing from other countries").
 * Runs BEFORE Claude so we never pay to classify something the agency can't use. Claude does the finer judgement
 * (woman on camera, US setting, replicable, IG-safe) with the cover frame.
 *
 *   1. script check — more than 10 % of the letters in caption + hashtags outside the Latin alphabet (CJK, Devanagari,
 *      Arabic, Thai, Cyrillic, Hangul, …) → another language market → skip
 *   2. language check — Latin-script languages the script check can't see (Spanish, Portuguese, Italian, French, German,
 *      Dutch, Indonesian/Malay, Tagalog, Turkish): counted by stop-words; ≥ 3 distinct foreign stop-words that outnumber
 *      the English ones → skip
 *   3. keyword list — library/market-exclude.txt (one per line, case-insensitive; '//' comments; '#tag' entries match the
 *      whole hashtag, plain words match as substrings): regional platforms, country/city tags, market terms. Editable without code.
 */
const EXCLUDE_FILE = join(process.cwd(), 'library', 'market-exclude.txt');
let cache: { at: number; words: string[] } | undefined;

function excludeWords(): string[] {
  if (cache && Date.now() - cache.at < 60_000) return cache.words;
  const words = existsSync(EXCLUDE_FILE)
    ? readFileSync(EXCLUDE_FILE, 'utf8')
        .split('\n')
        .map((l) => l.trim().toLowerCase())
        .filter((l) => l && !l.startsWith('//'))
    : [];
  cache = { at: Date.now(), words };
  return words;
}

const NON_LATIN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Gurmukhi}\p{Script=Gujarati}\p{Script=Tamil}\p{Script=Telugu}\p{Script=Kannada}\p{Script=Malayalam}\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Thai}\p{Script=Cyrillic}\p{Script=Greek}\p{Script=Armenian}\p{Script=Georgian}\p{Script=Ethiopic}\p{Script=Khmer}\p{Script=Lao}\p{Script=Myanmar}\p{Script=Sinhala}]/u;
const LETTER = /[\p{L}\p{M}]/u; // letters + combining marks (vowel signs count toward the script)

// Function words that do not occur in English (English homographs like "no", "do", "me", "son", "con", "per" are left out
// on purpose). Short captions are common, so the rule below is: ≥ 2 distinct hits AND (≥ 4 hits OR hits ≥ 25 % of the words),
// and more foreign hits than English stop-words.
const FOREIGN_STOPWORDS: Record<string, string[]> = {
  spanish: ['que', 'lo', 'la', 'el', 'en', 'los', 'las', 'una', 'es', 'mi', 'tu', 'yo', 'se', 'te', 'para', 'por', 'como', 'pero', 'más', 'está', 'esta', 'este', 'cuando', 'porque', 'muy', 'también', 'tambien', 'todo', 'todos', 'nada', 'ella', 'ellos', 'tengo', 'tiene', 'siempre', 'nunca', 'gracias', 'hola', 'quiero', 'mucho', 'bien', 'ahora', 'aquí', 'aqui', 'creo', 'del', 'ese', 'esa', 'eso', 'sus', 'hay', 'soy', 'estoy', 'fue', 'así', 'asi', 'entonces', 'algo', 'alguien', 'nadie', 'después', 'despues', 'hasta', 'sobre', 'otra', 'otro', 'mejor', 'chicos', 'chicas', 'chica', 'amiga', 'novio', 'novia', 'amor', 'vida', 'mujer', 'hombre', 'antes', 'casi', 'obviamente', 'hacen', 'usaba', 'diferencia', 'encontramos', 'sí'],
  portuguese: ['você', 'voce', 'não', 'nao', 'uma', 'para', 'mais', 'muito', 'meu', 'minha', 'está', 'isso', 'aqui', 'quando', 'também', 'tambem', 'porque', 'nunca', 'sempre', 'obrigada', 'obrigado', 'gente', 'coisa', 'ela', 'ele', 'eles', 'até', 'já', 'sim', 'só', 'tô', 'pra', 'dos', 'das', 'seu', 'sua', 'na', 'ao', 'aos', 'pela', 'pelo', 'mesma', 'mesmo', 'comigo', 'sozinha', 'solteira', 'coração', 'alma', 'livre', 'leve', 'areia', 'pé', 'hoje', 'agora', 'nada', 'tudo', 'bem', 'então', 'entao', 'assim', 'cada', 'foi', 'são', 'ser', 'ter', 'fazer', 'pouco', 'amiga', 'amigo', 'menina', 'quem', 'nós', 'nos', 'vocês', 'aquela', 'aquele', 'esse', 'essa', 'isto'],
  italian: ['che', 'una', 'non', 'sono', 'anche', 'quando', 'perché', 'perche', 'sempre', 'molto', 'tutto', 'questa', 'questo', 'della', 'delle', 'nella', 'nel', 'del', 'grazie', 'ragazza', 'ragazzi', 'ciao', 'oggi', 'cosa', 'mai', 'più', 'gli', 'ho', 'fatto', 'bene', 'po', 'di', 'il', 'ti', 'si', 'lo', 'la', 'giusto', 'dopo', 'dove', 'qui', 'ora', 'niente', 'ancora', 'allora', 'quindi', 'però', 'sei', 'siamo', 'noi', 'voi', 'loro', 'mio', 'mia', 'tuo', 'tua', 'suo', 'sua', 'tutti', 'ogni', 'stasera', 'domani', 'ieri'],
  french: ['que', 'pour', 'avec', 'une', 'pas', 'les', 'des', 'est', 'dans', 'sur', 'mais', 'quand', 'toujours', 'jamais', 'très', 'tres', 'aussi', 'cette', 'merci', 'bonjour', 'moi', 'toi', 'elle', 'ils', 'nous', 'vous', 'tout', 'tous', 'être', 'fait', 'suis', 'ça', 'j’ai', "j'ai", 'c’est', "c'est", 'je', 'tu', 'il', 'on', 'ne', 'le', 'la', 'du', 'au', 'aux', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'ses', 'ce', 'ces', 'qui', 'où', 'comme', 'plus', 'encore', 'déjà', 'deja', 'rien', 'bien', 'mal', 'petit', 'petite', 'femme', 'fille', 'copain', 'copine', 'trop', 'peu', 'beaucoup', 'vraiment', 'maintenant', 'aujourd’hui', "aujourd'hui"],
  german: ['und', 'nicht', 'ich', 'ist', 'das', 'die', 'der', 'ein', 'eine', 'mit', 'auch', 'wenn', 'aber', 'immer', 'noch', 'schon', 'sehr', 'mein', 'meine', 'heute', 'danke', 'hallo', 'wir', 'ihr', 'sie', 'für', 'auf', 'dich', 'mich', 'dir', 'mir', 'du', 'es', 'zu', 'im', 'am', 'vom', 'zum', 'zur', 'bei', 'nach', 'über', 'unter', 'oder', 'dass', 'was', 'wie', 'wer', 'nur', 'mal', 'jetzt', 'dann', 'denn', 'kein', 'keine', 'mädchen', 'frau', 'freund', 'freundin', 'gibt', 'habe', 'hast', 'hat', 'bin', 'bist', 'sind', 'war', 'wird', 'werden', 'kann', 'muss', 'will', 'soll'],
  dutch: ['het', 'een', 'niet', 'van', 'ook', 'maar', 'als', 'dan', 'nog', 'wel', 'heel', 'mijn', 'jij', 'wij', 'zij', 'altijd', 'nooit', 'vandaag', 'lekker', 'gewoon', 'ik', 'je', 'ze', 'we', 'dit', 'dat', 'deze', 'die', 'met', 'voor', 'naar', 'bij', 'uit', 'aan', 'toch', 'echt', 'meisje', 'vrouw', 'vriend', 'vriendin', 'waarom', 'omdat', 'wanneer', 'iets', 'niets'],
  indonesian: ['yang', 'dan', 'tidak', 'ini', 'itu', 'dengan', 'untuk', 'aku', 'kamu', 'saya', 'kalian', 'juga', 'sudah', 'belum', 'bisa', 'lagi', 'banget', 'nggak', 'ngga', 'gak', 'kalo', 'kalau', 'karena', 'sama', 'jadi', 'teman', 'suka', 'mah', 'kepo', 'konten', 'dia', 'kita', 'mereka', 'ada', 'apa', 'siapa', 'kenapa', 'gimana', 'bagaimana', 'dimana', 'kok', 'dong', 'sih', 'nih', 'deh', 'aja', 'saja', 'udah', 'punya', 'bakat', 'soalnya', 'tau', 'ingin', 'bertanya', 'orang', 'cewek', 'cowok', 'pemimpin', 'adil', 'hari', 'malam', 'pagi'],
  tagalog: ['ang', 'ng', 'mga', 'ako', 'ikaw', 'siya', 'kami', 'kayo', 'sila', 'hindi', 'lang', 'naman', 'talaga', 'kasi', 'yung', 'yan', 'ito', 'pero', 'ganda', 'mahal', 'ko', 'mo', 'niya', 'natin', 'ninyo', 'nila', 'kung', 'para', 'sa', 'ay', 'may', 'wala', 'meron', 'bakit', 'paano', 'saan', 'kailan', 'ano', 'sino', 'ganito', 'ganyan', 'babae', 'lalaki', 'kaibigan', 'grabe', 'sobrang'],
  turkish: ['bir', 've', 'bu', 'için', 'icin', 'ben', 'sen', 'çok', 'cok', 'ama', 'gibi', 'değil', 'degil', 'var', 'yok', 'daha', 'kadar', 'hiç', 'hic', 'seni', 'bana', 'kız', 'kiz', 'şu', 'bunu', 'şey', 'sey', 'ne', 'nasıl', 'nasil', 'neden', 'kim', 'biz', 'siz', 'onlar', 'benim', 'senin', 'onun', 'bizim', 'sizin', 'olan', 'oldu', 'olmak', 'diye', 'ile', 'ya', 'zaten', 'hem', 'hep', 'sonra', 'önce', 'once', 'bugün', 'bugun', 'yarın', 'yarin'],
};
const ENGLISH_STOPWORDS = new Set(['the', 'and', 'you', 'that', 'this', 'with', 'for', 'are', 'was', 'not', 'but', 'when', 'your', 'have', 'just', 'like', 'what', 'she', 'her', 'him', 'they', 'them', 'who', 'how', 'why', 'get', 'got', 'can', 'all', 'out', 'about', 'from', 'one', 'girl', 'girls', 'guys', 'man', 'men', 'our', 'his', 'its', 'were', 'been', 'than', 'then', 'into', 'over', 'only', 'very', 'because', 'never', 'always', 'today', 'thanks', 'is', 'it', 'in', 'of', 'to', 'my', 'me', 'we', 'he', 'be', 'do', 'if', 'so', 'no', 'on', 'at', 'as', 'an', 'or', 'up', 'by', 'us', 'am', 'has', 'had', 'did', 'does', 'don’t', "don't", 'can’t', "can't", 'i’m', "i'm", 'it’s', "it's", 'you’re', "you're", 'there', 'their', 'here', 'where', 'some', 'more', 'most', 'much', 'many', 'know', 'think', 'would', 'could', 'should', 'will', 'want', 'need', 'make', 'made', 'said', 'says', 'say', 'see', 'go', 'going', 'went', 'come', 'came', 'back', 'still', 'even', 'also', 'really', 'literally', 'every', 'someone', 'something', 'nothing', 'everyone', 'anyone', 'people', 'time', 'day', 'life', 'love', 'thing', 'things', 'way', 'year', 'friend', 'friends', 'bestie', 'boyfriend', 'husband', 'wife', 'mom', 'dad']);
// homographs — never count as foreign evidence
const AMBIGUOUS = new Set(['con', 'para', 'per', 'come', 'die', 'das', 'sie', 'ist', 'mit', 'der', 'ein', 'est', 'les', 'des', 'pas', 'sur', 'dans', 'una', 'ho', 'gli', 'van', 'het', 'als', 'dan', 'wel', 'ang', 'yang', 'lang', 'var', 'ben', 'sen', 'bir', 'mah', 'tô', 'só', 'son', 'ton', 'on', 'ne', 'le', 'du', 'au', 'ma', 'ta', 'ce', 'ma', 'mal', 'plus', 'am', 'im', 'was', 'will', 'hat', 'bin', 'war', 'wird', 'kann', 'muss', 'soll', 'die', 'sind', 'bei', 'mes', 'ses', 'ces', 'ne', 'may', 'sa', 'ay', 'ya', 'ko', 'mo', 'ada', 'apa', 'dia', 'kita', 'aja', 'nos', 'foi', 'ser', 'ter', 'na', 'ao', 'sei', 'ora', 'po', 'di', 'il', 'ti', 'si', 'mi', 'tu', 'se', 'te', 'es', 'en', 'el', 'lo', 'la', 'un', 'yo', 'je', 'il', 'ils', 'du']);
const SHORT_OK = new Set(['que', 'los', 'las', 'del', 'não', 'nao', 'pra', 'você', 'voce', 'não', 'che', 'non', 'più', 'gli', 'und', 'ich', 'nicht', 'een', 'niet', 'yang', 'dan', 'tidak', 'aku', 'kamu', 'mga', 'ako', 'hindi', 'çok', 'için', 'ama', 'değil']);

export interface MarketVerdict {
  ok: boolean;
  reason?: string;
}

/** Latin-script language guess from stop-words; returns the language when the caption is clearly not English. */
export function foreignLanguage(text: string): string | undefined {
  const words = text.toLowerCase().replace(/#\w+/g, ' ').replace(/https?:\/\/\S+/g, ' ').match(/[\p{L}’']+/gu) ?? [];
  if (words.length < 3) return undefined;
  let english = 0;
  for (const w of words) if (ENGLISH_STOPWORDS.has(w)) english++;
  let best: { lang: string; n: number } | undefined;
  for (const [lang, list] of Object.entries(FOREIGN_STOPWORDS)) {
    const set = new Set(list);
    // 2-letter homographs (lo, la, en, es, mi, se, te, di, il, na, …) only count when a longer word from the same language is present
    const hits = new Set(words.filter((w) => set.has(w) && !AMBIGUOUS.has(w)));
    const shortOnly = [...hits].every((w) => w.length <= 2 && !SHORT_OK.has(w));
    if (shortOnly) continue;
    const n = hits.size;
    const strong = [...hits].some((w) => w.length >= 4);
    // very short caption with one unmistakable foreign word and no English at all ("te amo mi vida") also counts
    if (((n >= 2 && (n >= 4 || n / words.length >= 0.25)) || (words.length <= 6 && strong && english === 0)) && n > english && (!best || n > best.n)) best = { lang, n };
  }
  return best?.lang;
}

export function marketFilter(caption: string | undefined, hashtags: string[] | undefined): MarketVerdict {
  const text = `${caption ?? ''} ${(hashtags ?? []).map((h) => `#${h}`).join(' ')}`;
  let letters = 0;
  let foreign = 0;
  for (const ch of text) {
    if (!LETTER.test(ch)) continue;
    letters++;
    if (NON_LATIN.test(ch)) foreign++;
  }
  if (letters >= 8 && foreign / letters > 0.1) return { ok: false, reason: 'non-English script' };
  const lang = foreignLanguage(text);
  if (lang) return { ok: false, reason: `caption in ${lang}` };
  const lower = text.toLowerCase();
  // '#tag' entries match whole hashtags only (#india must not catch #indianapolis); plain words are substrings
  const hit = excludeWords().find((w) => (w.startsWith('#') ? new RegExp(`${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}_])`, 'u').test(lower) : lower.includes(w)));
  if (hit) return { ok: false, reason: `market keyword "${hit}"` };
  return { ok: true };
}
