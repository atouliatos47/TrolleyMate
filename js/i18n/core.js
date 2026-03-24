// ===================================================
// i18n/core.js — Translation engine & utilities
// ===================================================

// TRANSLATIONS is populated by each lang-xx.js file
const TRANSLATIONS = {};

// Get translation by key
function t(key, ...args) {
    const lang = localStorage.getItem('bm_language') || 'en';
    const translations = TRANSLATIONS[lang] || TRANSLATIONS.en;
    const value = translations[key] || TRANSLATIONS.en[key];
    if (typeof value === 'function') return value(...args);
    return value || key;
}

// Available languages — add new entries here when adding a language
const LANGUAGES = [
    { code: 'en', name: 'English',    flag: '🇬🇧' },
    { code: 'pl', name: 'Polski',     flag: '🇵🇱' },
    { code: 'ro', name: 'Română',     flag: '🇷🇴' },
    { code: 'el', name: 'Ελληνικά',  flag: '🇬🇷' },
    { code: 'ur', name: 'اردو',       flag: '🇵🇰' },
];

// Aisle name translations (plain text keys for reliable matching)
const AISLE_NAMES = {
    en: {},
    pl: {
        'Bakery':          'Piekarnia',
        'Fresh Food':      'Świeże produkty',
        'Frozen Food':     'Mrożonki',
        'Treats & Snacks': 'Słodycze i przekąski',
        'Food Cupboard':   'Spiżarnia',
        'Drinks':          'Napoje',
        'Baby & Toddler':  'Niemowlęta i dzieci',
        'Health & Beauty': 'Zdrowie i uroda',
        'Pets':            'Zwierzęta',
        'Household':       'Dom',
    },
    ro: {
        'Bakery':          'Brutărie',
        'Fresh Food':      'Produse proaspete',
        'Frozen Food':     'Produse congelate',
        'Treats & Snacks': 'Dulciuri și gustări',
        'Food Cupboard':   'Cămară',
        'Drinks':          'Băuturi',
        'Baby & Toddler':  'Bebeluși și copii mici',
        'Health & Beauty': 'Sănătate și frumusețe',
        'Pets':            'Animale de companie',
        'Household':       'Gospodărie',
    },
    el: {
        'Bakery':          'Φούρνος',
        'Fresh Food':      'Φρέσκα τρόφιμα',
        'Frozen Food':     'Κατεψυγμένα',
        'Treats & Snacks': 'Γλυκά & Σνακ',
        'Food Cupboard':   'Αποθήκη τροφίμων',
        'Drinks':          'Ποτά',
        'Baby & Toddler':  'Βρέφη & Νήπια',
        'Health & Beauty': 'Υγεία & Ομορφιά',
        'Pets':            'Κατοικίδια',
        'Household':       'Οικιακά',
    },
    ur: {
        'Bakery':          'بیکری',
        'Fresh Food':      'تازہ خوراک',
        'Frozen Food':     'منجمد خوراک',
        'Treats & Snacks': 'مٹھائی اور اسنیکس',
        'Food Cupboard':   'کھانے کا ذخیرہ',
        'Drinks':          'مشروبات',
        'Baby & Toddler':  'بچے',
        'Health & Beauty': 'صحت اور خوبصورتی',
        'Pets':            'پالتو جانور',
        'Household':       'گھریلو',
    },
};

function translateAisleName(name) {
    const lang = localStorage.getItem('bm_language') || 'en';
    if (lang === 'en') return name;
    const map = AISLE_NAMES[lang] || {};
    const getWords = s => s.replace(/[^a-zA-Z0-9\s&']/g, ' ').replace(/\s+/g, ' ').trim();
    const nameWords = getWords(name);
    for (const [key, val] of Object.entries(map)) {
        if (getWords(key) === nameWords) return val;
    }
    return name;
}
