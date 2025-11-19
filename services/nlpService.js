const natural = require('natural');
const Logger = require('../utils/logger');

class NLPService {
  constructor() {
    this.tokenizerES = new natural.WordTokenizer();
    this.tokenizerEN = new natural.WordTokenizer();
    
    this.stemmerES = natural.PorterStemmerEs;
    this.stemmerEN = natural.PorterStemmer;
    
    this.tfidf = new natural.TfIdf();
    
    this.casinoKeywords = {
      // Juegos
      'ruleta': ['roulette', 'rueda', 'wheel', 'giro'],
      'blackjack': ['21', 'veintiuno', 'twenty-one', 'black-jack'],
      'poker': ['póker', 'poquer', 'cartas'],
      'tragamonedas': ['slot', 'slots', 'máquina', 'maquina', 'tragaperras'],
      'dados': ['craps', 'die', 'dice'],
      'baccarat': ['bacará', 'punto', 'banca'],
      
      // Conceptos de juego
      'apostar': ['bet', 'wager', 'apuesta', 'jugar'],
      'ganar': ['win', 'victoria', 'premio', 'ganancia'],
      'perder': ['lose', 'pérdida', 'perdida'],
      'probabilidad': ['probability', 'chance', 'posibilidad', 'odds'],
      'pago': ['payout', 'payment', 'premio', 'retorno'],
      'ventaja': ['edge', 'advantage', 'house edge', 'ventaja casa'],
      'rtp': ['return to player', 'retorno al jugador', 'porcentaje retorno'],
      
      // Acciones
      'como': ['how', 'cómo'],
      'cual': ['which', 'cuál', 'cuales', 'cuáles'],
      'que': ['what', 'qué'],
      'donde': ['where', 'dónde'],
      'cuando': ['when', 'cuándo'],
      'por que': ['why', 'por qué', 'porque']
    };
    
    this.stopWordsES = new Set([
      'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
      'de', 'del', 'al', 'en', 'para', 'por', 'con', 'sin',
      'sobre', 'entre', 'desde', 'hasta', 'hacia',
      'y', 'o', 'u', 'e', 'ni', 'pero', 'sino',
      'que', 'cual', 'cuales', 'como', 'cuando', 'donde',
      'es', 'son', 'está', 'están', 'ser', 'estar',
      'a', 'ante', 'bajo', 'cabe', 'contra', 'durante',
      'mediante', 'según', 'tras', 'versus', 'vía'
    ]);
    
    this.stopWordsEN = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at',
      'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'are',
      'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
      'do', 'does', 'did', 'will', 'would', 'should', 'could',
      'may', 'might', 'must', 'can', 'about', 'into', 'through',
      'during', 'before', 'after', 'above', 'below', 'between'
    ]);
  }

  processQuery(query) {
    try {
      Logger.info(`Procesando consulta NLP: "${query}"`);
      
      const language = this.detectLanguage(query);
      
      const normalized = this.normalizeText(query);
      
      const tokens = this.tokenize(normalized, language);
      
      const filteredTokens = this.removeStopWords(tokens, language);
      
      const stems = this.applyStemming(filteredTokens, language);
      
      const keywords = this.identifyDomainKeywords(normalized, language);
      
      const expandedTerms = this.expandSynonyms(keywords);
      
      const intent = this.detectIntent(normalized, tokens);
      
      const searchTerms = this.generateSearchTerms(stems, keywords, expandedTerms);
      
      const result = {
        original: query,
        normalized,
        language,
        tokens,
        filteredTokens,
        stems,
        keywords,
        expandedTerms,
        intent,
        searchTerms
      };
      
      Logger.info(`Términos de búsqueda: ${searchTerms.join(', ')}`);
      
      return result;
    } catch (error) {
      Logger.error('Error procesando consulta NLP:', error);
      return {
        original: query,
        normalized: query.toLowerCase(),
        language: 'es',
        tokens: [query],
        searchTerms: [query]
      };
    }
  }

  normalizeText(text) {
    return text
      .toLowerCase()
      .trim()
      .replace(/á/g, 'a')
      .replace(/é/g, 'e')
      .replace(/í/g, 'i')
      .replace(/ó/g, 'o')
      .replace(/ú/g, 'u')
      .replace(/ñ/g, 'n')
      .replace(/[¿?¡!]/g, '')
      .replace(/\s+/g, ' ');
  }

  detectLanguage(text) {
    const lowerText = text.toLowerCase();
    
    const spanishIndicators = ['cuál', 'cuáles', 'cómo', 'qué', 'dónde', 'cuándo', 
                                'son', 'está', 'están', 'las', 'los', 'del', 'para'];
    
    const englishIndicators = ['what', 'how', 'which', 'where', 'when', 'the', 'are', 'is'];
    
    let spanishScore = 0;
    let englishScore = 0;
    
    spanishIndicators.forEach(word => {
      if (lowerText.includes(word)) spanishScore++;
    });
    
    englishIndicators.forEach(word => {
      if (lowerText.includes(word)) englishScore++;
    });
    
    return spanishScore >= englishScore ? 'es' : 'en';
  }

  tokenize(text, language) {
    const tokenizer = language === 'es' ? this.tokenizerES : this.tokenizerEN;
    return tokenizer.tokenize(text);
  }

  removeStopWords(tokens, language) {
    const stopWords = language === 'es' ? this.stopWordsES : this.stopWordsEN;
    return tokens.filter(token => !stopWords.has(token.toLowerCase()));
  }

  applyStemming(tokens, language) {
    const stemmer = language === 'es' ? this.stemmerES : this.stemmerEN;
    return tokens.map(token => stemmer.stem(token));
  }

  identifyDomainKeywords(text, language) {
    const keywords = [];
    const lowerText = text.toLowerCase();
    
    for (const [keyword, synonyms] of Object.entries(this.casinoKeywords)) {
      if (lowerText.includes(keyword)) {
        keywords.push(keyword);
      }
      
      for (const synonym of synonyms) {
        if (lowerText.includes(synonym.toLowerCase())) {
          keywords.push(keyword);
          break;
        }
      }
    }
    
    return [...new Set(keywords)];
  }

  expandSynonyms(keywords) {
    const expanded = new Set();
    
    keywords.forEach(keyword => {
      expanded.add(keyword);
      
      if (this.casinoKeywords[keyword]) {
        this.casinoKeywords[keyword].forEach(synonym => {
          expanded.add(synonym);
        });
      }
    });
    
    return Array.from(expanded);
  }

  detectIntent(text, tokens) {
    const lowerText = text.toLowerCase();
    
    const patterns = {
      probability: /probabilidad|chance|odds|posibilidad/i,
      payout: /pago|premio|retorno|rtp|ganancia/i,
      rules: /reglas|como jugar|instrucciones|como funciona/i,
      comparison: /mejor|peor|comparar|diferencia|versus|vs/i,
      list: /cuales|lista|todos|todas|tipos|variantes/i,
      definition: /que es|define|explicar|significado/i
    };
    
    for (const [intent, pattern] of Object.entries(patterns)) {
      if (pattern.test(lowerText)) {
        return intent;
      }
    }
    
    return 'search';
  }

  generateSearchTerms(stems, keywords, expandedTerms) {
    const searchTerms = new Set();
    
    keywords.forEach(kw => searchTerms.add(kw));
    
    expandedTerms.forEach(term => searchTerms.add(term));
    
    stems.forEach(stem => {
      if (stem.length > 3) {
        searchTerms.add(stem);
      }
    });
    
    return Array.from(searchTerms);
  }

  calculateSimilarity(text1, text2) {
    const distance = natural.JaroWinklerDistance(
      text1.toLowerCase(),
      text2.toLowerCase()
    );
    return distance;
  }

  suggestCorrections(word, vocabulary) {
    const spellcheck = new natural.Spellcheck(vocabulary);
    return spellcheck.getCorrections(word, 3);
  }
}

const nlpService = new NLPService();

module.exports = nlpService;
