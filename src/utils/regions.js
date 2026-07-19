// utils/regions.js
// Bölgesel konfigürasyon sistemi.
// Her bölge: varsayılan para birimi, dil, birim sistemi, hafta başı,
// altın formatları ve görünür varlık setini tanımlar.
//
// Prensip: Çekirdek (USD-pivot değerleme, kripto, hisse) bölge-agnostiktir.
// Bölge config yalnızca "kullanıcıya ne sunulur / neyi varsayar" kısmını belirler.
// Yeni ülke eklemek = buraya bir kayıt eklemek (kod değişmez).

// Altın formatları: her formatın gram karşılığı (çekirdek ons/gram ile değerlenir).
// key değeri veritabanına yazılır (dil-bağımsız). labelKey i18n içindir.
const GOLD_FORMATS = {
  // Batı / varsayılan — troy ons bazlı
  default: [
    { key: 'GOLD_OZ',        grams: 31.1035, labelKey: 'gold.oz' },        // 1 troy ons
    { key: 'GOLD_HALF_OZ',   grams: 15.5517, labelKey: 'gold.halfOz' },
    { key: 'GOLD_TEN_OZ',    grams: 311.035, labelKey: 'gold.tenOz' },
    { key: 'GOLD_KILO',      grams: 1000,    labelKey: 'gold.kiloBar' },
    { key: 'GOLD_GRAM',      grams: 1,       labelKey: 'gold.gram' },
  ],
  // Türkiye — geleneksel parçalar
  tr: [
    { key: 'GOLD_GRAM',      grams: 1,   labelKey: 'gold.gram' },
    { key: 'GOLD_QUARTER',   grams: 1.6, labelKey: 'gold.quarter' },   // çeyrek
    { key: 'GOLD_HALF',      grams: 3.2, labelKey: 'gold.half' },      // yarım
    { key: 'GOLD_FULL',      grams: 6.4, labelKey: 'gold.full' },      // tam
    { key: 'GOLD_REPUBLIC',  grams: 6.6, labelKey: 'gold.republic' },  // Cumhuriyet
  ],
  // ABD — coin/bar
  us: [
    { key: 'GOLD_OZ',        grams: 31.1035, labelKey: 'gold.ozCoin' },  // 1 oz coin (Eagle/Buffalo)
    { key: 'GOLD_HALF_OZ',   grams: 15.5517, labelKey: 'gold.halfOz' },
    { key: 'GOLD_TEN_OZ',    grams: 311.035, labelKey: 'gold.tenOzBar' },
    { key: 'GOLD_KILO',      grams: 1000,    labelKey: 'gold.kiloBar' },
    { key: 'GOLD_GRAM',      grams: 1,       labelKey: 'gold.gram' },
  ],
  // Hindistan — tola / sovereign
  in: [
    { key: 'GOLD_GRAM',      grams: 1,      labelKey: 'gold.gram' },
    { key: 'GOLD_TOLA',      grams: 11.6638, labelKey: 'gold.tola' },     // 1 tola
    { key: 'GOLD_SOVEREIGN', grams: 7.98805, labelKey: 'gold.sovereign' },// sovereign (8g)
    { key: 'GOLD_OZ',        grams: 31.1035, labelKey: 'gold.oz' },
  ],
}

// Varlık setleri: her bölgede hangi yatırım tipleri sunulur.
// Çekirdek tipler (USD, EUR, crypto, stock, silver, gold) her yerde var;
// bölgeye özgü olanlar (BIST, TEFAS) yalnızca ilgili bölgede.
const BASE_ASSETS = ['cash', 'gold', 'silver', 'crypto', 'stock']

const REGIONS = {
  _default: {
    code: '_default',
    currency: 'USD',
    language: 'en',
    unitSystem: 'imperial',   // ons temelli
    weekStart: 7,             // Pazar (ABD/çoğu)
    goldFormats: GOLD_FORMATS.default,
    localFunds: null,         // yerel fon kaynağı yok (ETF Yahoo'dan)
    localExchange: null,      // yerel borsa özel değil
    assets: [...BASE_ASSETS, 'etf'],
    cashCurrencies: ['USD', 'EUR', 'GBP'],
  },
  TR: {
    code: 'TR',
    currency: 'TRY',
    language: 'tr',
    unitSystem: 'metric',
    weekStart: 1,             // Pazartesi
    goldFormats: GOLD_FORMATS.tr,
    localFunds: 'TEFAS',      // TEFAS fon kaynağı aktif
    localExchange: 'BIST',    // BIST borsası
    assets: [...BASE_ASSETS, 'bist', 'tefas'],
    cashCurrencies: ['TRY', 'USD', 'EUR', 'GBP'],
  },
  US: {
    code: 'US',
    currency: 'USD',
    language: 'en',
    unitSystem: 'imperial',
    weekStart: 7,
    goldFormats: GOLD_FORMATS.us,
    localFunds: null,         // mutual fund/ETF Yahoo'dan
    localExchange: 'US',      // NYSE/NASDAQ (Yahoo varsayılan)
    assets: [...BASE_ASSETS, 'etf'],
    cashCurrencies: ['USD', 'EUR', 'GBP'],
  },
  IN: {
    code: 'IN',
    currency: 'INR',
    language: 'en',           // (Hintçe ileride eklenebilir)
    unitSystem: 'metric',
    weekStart: 1,
    goldFormats: GOLD_FORMATS.in,
    localFunds: null,         // Hindistan fon API'si ileride
    localExchange: 'NSE',     // NSE/BSE (Yahoo .NS / .BO)
    assets: [...BASE_ASSETS, 'stock'],
    cashCurrencies: ['INR', 'USD'],
  },
}

/**
 * Bölge kodundan config döndürür. Tanımsızsa _default.
 */
export function getRegion(regionCode) {
  return REGIONS[regionCode] || REGIONS._default
}

/**
 * Bir bölgenin altın formatlarını döndürür.
 */
export function getGoldFormats(regionCode) {
  return getRegion(regionCode).goldFormats
}

/**
 * Bir altın key'inin gram karşılığını, herhangi bir bölgede arayarak bulur.
 * (Kayıtlar bölge değişse bile doğru değerlenebilsin diye tüm setlerde arar.)
 */
export function goldKeyToGrams(key) {
  if (key === 'GOLD_GRAM') return 1
  for (const set of Object.values(GOLD_FORMATS)) {
    const found = set.find(f => f.key === key)
    if (found) return found.grams
  }
  return 0
}

/**
 * Bölgenin varsayılan tercihlerini döndürür (onboarding / yeni kullanıcı için).
 */
export function getRegionDefaults(regionCode) {
  const r = getRegion(regionCode)
  return {
    language: r.language,
    base_currency: r.currency,
    unit_system: r.unitSystem,
    region: r.code,
    week_start: r.weekStart,
  }
}

/**
 * Tarayıcı diline/lokasyona göre bölge tahmini (giriş öncesi için).
 */
export function guessRegion() {
  if (typeof navigator === 'undefined') return '_default'
  const lang = navigator.language || 'en'
  // Basit eşleme; ileride genişletilir
  if (lang.startsWith('tr')) return 'TR'
  if (lang.startsWith('en-US') || lang === 'en') return 'US'
  if (lang.startsWith('hi') || lang.endsWith('-IN')) return 'IN'
  return '_default'
}

export { REGIONS, GOLD_FORMATS }