const natural = require("natural");
const Logger = require("../utils/logger");

class NLPServiceExtended {
  constructor() {
    this.tokenizerES = new natural.WordTokenizer();
    this.tokenizerEN = new natural.WordTokenizer();
    this.stemmerES = natural.PorterStemmerEs;
    this.stemmerEN = natural.PorterStemmer;
    this.tfidf = new natural.TfIdf();

    this.gameKnowledge = {
      blackjack: {
        names: ["blackjack", "21", "veintiuno", "twenty-one", "black-jack", "twenty one"],
        probability: 0.42,
        houseEdge: 0.5,
        rtp: 99.5,
        minBet: 5,
        maxBet: 10000,
        description: "Juego de cartas donde el objetivo es acercarse a 21 sin pasarse",
        detailedRules: "El jugador recibe 2 cartas y puede pedir más. Las cartas numéricas valen su número, las figuras valen 10 y el As vale 1 u 11.",
        bestOdds: "Usar estrategia básica perfecta",
        worstOdds: "Seguro (insurance)",
        strategies: [
          "Usa estrategia básica para cada mano según las cartas del dealer",
          "Nunca tomes seguro - la ventaja de la casa es 7.4%",
          "Divide ases y ochos siempre",
          "Dobla en 11 si el dealer muestra menos de 10",
          "Mantente en 17 duro o más",
          "El conteo de cartas puede reducir la ventaja de la casa a 0% o negativo",
          "Evita mesas con blackjack paga 6:5 - busca 3:2"
        ],
        facts: [
          "La ventaja de la casa es aproximadamente 0.5% con estrategia básica perfecta",
          "La probabilidad de ganar una mano es alrededor del 42%",
          "Un blackjack natural paga 3:2 (1.5 veces tu apuesta) o 6:5 en mesas malas",
          "La probabilidad de recibir blackjack natural es 4.8%",
          "El dealer debe plantarse en 17 blando en la mayoría de casinos",
          "Dividir pares puede aumentar tus probabilidades si se hace correctamente",
          "Sin estrategia básica, la ventaja de la casa puede ser del 2-5%"
        ],
        probabilities: {
          natural: 0.048,
          bust: 0.28,
          win: 0.42,
          lose: 0.49,
          push: 0.09,
          dealerBust: 0.28,
          dealerNatural: 0.048
        },
        payouts: {
          natural: 1.5,
          win: 1,
          insurance: 2,
          surrender: 0.5
        },
        specificBets: {
          "insurance": { houseEdge: 7.4, rtp: 92.6, recommendation: "Nunca tomar" },
          "surrender": { houseEdge: -0.5, rtp: 100.5, recommendation: "Usar en situaciones específicas" },
          "double": { houseEdge: 0.5, rtp: 99.5, recommendation: "Doblar en 11 vs dealer bajo" }
        }
      },
      ruleta: {
        names: ["ruleta", "roulette", "rueda", "wheel", "rouleta"],
        probability: 0.4865,
        houseEdge: 2.7,
        houseEdgeAmerican: 5.26,
        rtp: 97.3,
        rtpAmerican: 94.74,
        minBet: 1,
        maxBet: 5000,
        description: "Juego de azar con una rueda giratoria y una bola",
        detailedRules: "La rueda tiene números del 0 al 36. Puedes apostar a números individuales, colores, pares/impares, docenas, columnas, etc.",
        bestOdds: "Apuestas externas en ruleta europea (rojo/negro, par/impar)",
        worstOdds: "Números individuales y apuesta de cinco números en ruleta americana",
        strategies: [
          "SIEMPRE juega ruleta europea (un solo cero) en lugar de americana (doble cero)",
          "Apuesta a rojo/negro o par/impar para mejores probabilidades (48.65%)",
          "Evita el sistema Martingale - requiere bankroll infinito",
          "No existe estrategia que supere la ventaja de la casa a largo plazo",
          "Establece límites de pérdidas y ganancias antes de jugar",
          "La apuesta de cinco números (0, 00, 1, 2, 3) tiene la peor ventaja: 7.89%"
        ],
        facts: [
          "La ruleta europea tiene ventaja de la casa de 2.7% debido al cero",
          "La ruleta americana tiene ventaja de la casa de 5.26% debido al doble cero",
          "Apostar a rojo/negro tiene probabilidad del 48.65% en ruleta europea",
          "El cero verde (y doble cero) da la ventaja a la casa",
          "La probabilidad de acertar un número específico es 2.7% (1/37)",
          "Las apuestas externas pagan 1:1, las internas pagan más pero son menos probables",
          "No existe diferencia de probabilidad entre números - todos son igualmente probables"
        ],
        probabilities: {
          red: 0.4865,
          black: 0.4865,
          green: 0.027,
          greenAmerican: 0.053,
          even: 0.4865,
          odd: 0.4865,
          singleNumber: 0.027,
          singleNumberAmerican: 0.026,
          dozen: 0.324,
          column: 0.324,
          split: 0.054,
          street: 0.081,
          corner: 0.108,
          sixLine: 0.162,
          highLow: 0.4865
        },
        payouts: {
          straight: 35,
          split: 17,
          street: 11,
          corner: 8,
          sixLine: 5,
          dozen: 2,
          column: 2,
          redBlack: 1,
          evenOdd: 1,
          highLow: 1
        },
        specificBets: {
          "rojo": { probability: 48.65, payout: 1, houseEdge: 2.7, recommendation: "Buena apuesta exterior" },
          "negro": { probability: 48.65, payout: 1, houseEdge: 2.7, recommendation: "Buena apuesta exterior" },
          "par": { probability: 48.65, payout: 1, houseEdge: 2.7, recommendation: "Buena apuesta exterior" },
          "impar": { probability: 48.65, payout: 1, houseEdge: 2.7, recommendation: "Buena apuesta exterior" },
          "numero": { probability: 2.7, payout: 35, houseEdge: 2.7, recommendation: "Alto riesgo, alto pago" }
        }
      },
      poker: {
        names: ["poker", "póker", "poquer", "texas holdem", "omaha", "texas", "hold'em"],
        probability: "variable",
        houseEdge: 0,
        rtp: "variable",
        minBet: 2,
        maxBet: "sin límite",
        description: "Juego de cartas estratégico entre jugadores",
        detailedRules: "Cada jugador recibe cartas privadas y hay cartas comunitarias. El mejor conjunto de 5 cartas gana.",
        bestOdds: "Juego con habilidad - no contra la casa",
        worstOdds: "Depende de tu habilidad vs oponentes",
        strategies: [
          "Juega tight-aggressive (pocas manos, pero agresivamente)",
          "La posición es CRUCIAL - actúa último para máxima ventaja",
          "Lee a tus oponentes y sus patrones de apuesta",
          "Gestiona tu bankroll - nunca juegues más del 5% en una sesión",
          "Estudia rangos de manos preflop según posición",
          "Calcula tus outs y pot odds para decisiones matemáticas",
          "El farol es importante pero no abuses - 1 de cada 3-4 manos máximo",
          "En torneos, ajusta según tamaño de stack y blinds"
        ],
        facts: [
          "No juegas contra la casa, sino contra otros jugadores",
          "La habilidad es el factor más importante a largo plazo",
          "La probabilidad de recibir par de ases es 0.45% (221:1)",
          "Requiere estrategia, psicología y gestión de bankroll",
          "Los pros ganan consistentemente porque toman decisiones matemáticamente correctas",
          "El rake (comisión del casino) es típicamente 5-10% del pot",
          "Texas Hold'em es la variante más popular mundialmente"
        ],
        probabilities: {
          pocketAces: 0.0045,
          pocketKings: 0.0045,
          anyPocketPair: 0.059,
          aceKing: 0.012,
          flushDraw: 0.118,
          straightDraw: 0.085,
          makeFlushByRiver: 0.35,
          makeStraightByRiver: 0.32,
          overcardImproving: 0.065
        },
        handRankings: [
          "Royal Flush - 0.00015% (649,739:1)",
          "Straight Flush - 0.00139% (72,192:1)",
          "Four of a Kind - 0.024% (4,165:1)",
          "Full House - 0.144% (694:1)",
          "Flush - 0.197% (509:1)",
          "Straight - 0.392% (255:1)",
          "Three of a Kind - 2.11% (46:1)",
          "Two Pair - 4.75% (20:1)",
          "One Pair - 42.3% (1.4:1)",
          "High Card - 50.1% (1:1)"
        ]
      },
      tragamonedas: {
        names: ["tragamonedas", "slot", "slots", "máquina", "maquina", "tragaperras", "slot machine"],
        probability: "variable",
        houseEdge: 5,
        rtp: 95,
        minBet: 0.01,
        maxBet: 100,
        description: "Máquinas de juego con rodillos y símbolos",
        detailedRules: "Gira los rodillos y gana si los símbolos coinciden en líneas de pago activas.",
        bestOdds: "Slots con RTP alto (97-99%) en casinos online",
        worstOdds: "Slots con jackpot progresivo grande (85-88% RTP)",
        strategies: [
          "Busca slots con RTP alto - 96% o más",
          "Los jackpots progresivos tienen RTP más bajo (88-92%)",
          "NO existe estrategia para ganar - son pura suerte",
          "Establece presupuesto y NUNCA lo excedas",
          "Las apuestas máximas no aumentan el RTP",
          "Los resultados son determinados por RNG (generador aleatorio)"
        ],
        facts: [
          "El RTP típico varía entre 85% y 98%",
          "Son juegos de pura suerte, sin estrategia",
          "La ventaja de la casa suele ser del 2-15%",
          "Los jackpots progresivos tienen menor RTP pero premios gigantes",
          "Los slots online generalmente tienen mejor RTP que físicos",
          "Cada giro es independiente - no hay 'máquinas calientes'",
          "Los casinos físicos típicamente tienen RTP de 88-92%"
        ],
        rtpRanges: {
          online: "95-99%",
          landBased: "88-92%",
          progressive: "85-90%",
          megaJackpot: "85-88%"
        }
      },
      dados: {
        names: ["dados", "craps", "die", "dice", "crap"],
        probability: 0.493,
        houseEdge: 1.41,
        rtp: 98.59,
        minBet: 5,
        maxBet: 5000,
        description: "Juego con dos dados de seis caras",
        detailedRules: "El tirador lanza dos dados. Apuestas en los resultados de la tirada.",
        bestOdds: "Don't Pass/Don't Come con odds (0.4% ventaja casa)",
        worstOdds: "Proposiciones (Any 7, Any Craps) - hasta 16.9% ventaja",
        strategies: [
          "Apuesta Pass Line (1.41% ventaja) o Don't Pass (1.36% ventaja)",
          "Usa odds bets - NO tienen ventaja de la casa (0%)",
          "Evita apuestas de centro/proposición - tienen ventajas del 10-16%",
          "Don't Pass es ligeramente mejor que Pass Line matemáticamente",
          "Maximiza las odds detrás de tu apuesta principal"
        ],
        facts: [
          "Pass Line tiene ventaja de casa de 1.41%",
          "Don't Pass tiene ventaja de casa de 1.36%",
          "La probabilidad de sacar 7 es la más alta (16.67% - 6 combinaciones)",
          "Las odds bets NO tienen ventaja de la casa - apuesta más inteligente",
          "Any 7 tiene ventaja de casa del 16.9% - EVITAR",
          "El 7 es el número más común, seguido por 6 y 8"
        ],
        probabilities: {
          seven: 0.1667,
          six: 0.1389,
          eight: 0.1389,
          five: 0.1111,
          nine: 0.1111,
          four: 0.0833,
          ten: 0.0833,
          three: 0.0556,
          eleven: 0.0556,
          two: 0.0278,
          twelve: 0.0278
        },
        specificBets: {
          "pass": { houseEdge: 1.41, rtp: 98.59, recommendation: "Excelente apuesta" },
          "dontpass": { houseEdge: 1.36, rtp: 98.64, recommendation: "La mejor apuesta matemáticamente" },
          "odds": { houseEdge: 0, rtp: 100, recommendation: "SIEMPRE tomar - sin ventaja casa" },
          "field": { houseEdge: 5.56, rtp: 94.44, recommendation: "Evitar" },
          "any7": { houseEdge: 16.9, rtp: 83.1, recommendation: "Nunca apostar" }
        }
      },
      baccarat: {
        names: ["baccarat", "bacará", "punto", "banca", "punto y banca"],
        probability: 0.4585,
        houseEdge: 1.06,
        rtp: 98.94,
        minBet: 10,
        maxBet: 100000,
        description: "Juego de cartas entre banca y jugador",
        detailedRules: "Se reparten cartas a banca y jugador. La mano más cercana a 9 gana.",
        bestOdds: "Apostar a la Banca (1.06% ventaja casa)",
        worstOdds: "Apostar al Empate (14.4% ventaja casa)",
        strategies: [
          "SIEMPRE apuesta a la Banca - menor ventaja de casa (1.06%)",
          "Nunca apuestes al Empate - ventaja de casa del 14.4%",
          "Ignora las tablas de tendencias - cada mano es independiente",
          "No uses sistemas de apuestas (Martingale, Fibonacci) - no funcionan",
          "Establece límites y respétalos",
          "La comisión del 5% en Banca ya está calculada en la ventaja"
        ],
        facts: [
          "Apostar a la Banca tiene ventaja de casa de 1.06%",
          "Apostar al Jugador tiene ventaja de casa de 1.24%",
          "El Empate tiene ventaja de casa del 14.4% - NUNCA apostar",
          "Es uno de los juegos con mejor probabilidad para el jugador",
          "No requiere habilidad - decisiones automáticas",
          "Popular entre high rollers por límites altos y bajo house edge",
          "La Banca gana ~50.68%, Jugador ~49.32%"
        ],
        probabilities: {
          banker: 0.4585,
          player: 0.4462,
          tie: 0.0953
        },
        payouts: {
          banker: 0.95,
          player: 1,
          tie: 8
        },
        specificBets: {
          "banca": { probability: 45.85, houseEdge: 1.06, rtp: 98.94, recommendation: "Mejor apuesta" },
          "jugador": { probability: 44.62, houseEdge: 1.24, rtp: 98.76, recommendation: "Buena apuesta" },
          "empate": { probability: 9.53, houseEdge: 14.4, rtp: 85.6, recommendation: "NUNCA apostar" }
        }
      }
    };

    // Patrones de queries EXTENDIDOS
    this.queryPatterns = {
      // PROBABILIDADES
      probability: [
        /probabilidad|chance|odds|posibilidad|chances|porcentaje|prob\b/i,
        /cuanto.*ganar|cuánto.*ganar|what.*chance|how likely/i,
        /que tan probable|qué tan probable|how probable/i,
        /cuales.*probabilidades|cuáles.*probabilidades|what.*odds/i
      ],

      // COLORES EN RULETA
      redBlackRoulette: [
        /probabilidad.*(rojo|negro|red|black).*ruleta/i,
        /ruleta.*(rojo|negro|red|black)/i,
        /(rojo|negro|red|black).*ruleta/i,
        /chances?.*(red|black|rojo|negro)/i
      ],

      // NÚMEROS EN RULETA
      numberRoulette: [
        /probabilidad.*numero.*ruleta/i,
        /acertar.*numero.*ruleta/i,
        /numero.*especifico.*ruleta/i,
        /single number.*roulette/i
      ],

      // PAR/IMPAR
      evenOdd: [
        /probabilidad.*(par|impar|even|odd)/i,
        /(par|impar|even|odd).*ruleta/i,
        /apostar.*(par|impar|even|odd)/i
      ],

      // PAGOS
      payout: [
        /pago|premio|retorno|rtp|ganancia|cuanto paga|cuánto paga|payout/i,
        /cuanto.*devuelve|cuánto.*devuelve|how much.*pay/i,
        /retorno.*jugador|return.*player/i
      ],

      // REGLAS
      rules: [
        /reglas|rules|como jugar|cómo jugar|how to play/i,
        /instrucciones|instructions|como funciona|cómo funciona|how.*work/i,
        /como se juega|cómo se juega|explicar|explain/i
      ],

      // ESTRATEGIA
      strategy: [
        /estrategia|strategy|táctica|tactic|consejo|tip|advice/i,
        /como ganar|cómo ganar|how to win|tecnica|técnica|technique/i,
        /mejor.*manera|best way|forma.*ganar|way to win/i
      ],

      // COMPARACIÓN
      comparison: [
        /mejor|best|peor|worst|comparar|compare/i,
        /diferencia|difference|versus|vs|cual es mejor|cuál es mejor/i,
        /que es mejor|qué es mejor|which is better/i
      ],

      // VENTAJA CASA
      houseEdge: [
        /ventaja casa|house edge|margen casa|ventaja.*casino/i,
        /casino.*ventaja|edge.*house/i
      ],

      // DEFINICIÓN
      definition: [
        /que es|qué es|what is|define|explicar|explain/i,
        /significado|meaning|definicion|definition/i
      ],

      // BLACKJACK ESPECÍFICAS
      blackjackNatural: [
        /probabilidad.*blackjack.*natural/i,
        /chances?.*21.*first/i,
        /recibir.*blackjack/i
      ],

      insurance: [
        /seguro.*blackjack|insurance.*blackjack/i,
        /tomar.*seguro|take.*insurance/i,
        /conviene.*seguro|should.*insurance/i
      ],

      // POKER ESPECÍFICAS
      pokerHands: [
        /probabilidad.*(escalera|color|full|poker|mano)/i,
        /chances?.*(flush|straight|full house|pair)/i,
        /probabilidad.*ases|probability.*aces/i
      ],

      // ESPECÍFICO POR JUEGO
      specificGame: [
        /blackjack|21|veintiuno/i,
        /ruleta|roulette/i,
        /poker|póker/i,
        /dados|craps/i,
        /baccarat|bacará/i,
        /tragamonedas|slot|slots/i
      ]
    };

    // Stop words
    this.stopWordsES = new Set([
      "el", "la", "los", "las", "un", "una", "unos", "unas",
      "de", "del", "al", "en", "para", "por", "con", "sin",
      "sobre", "entre", "desde", "hasta", "hacia",
      "y", "o", "u", "e", "ni", "pero", "sino",
      "que", "cual", "cuales", "como", "cuando", "donde",
      "es", "son", "está", "están", "ser", "estar",
      "a", "ante", "bajo", "cabe", "contra", "durante",
      "mediante", "según", "tras", "versus", "vía"
    ]);

    this.stopWordsEN = new Set([
      "the", "a", "an", "and", "or", "but", "in", "on", "at",
      "to", "for", "of", "with", "by", "from", "as", "is", "are",
      "was", "were", "be", "been", "being", "have", "has", "had",
      "do", "does", "did", "will", "would", "should", "could",
      "may", "might", "must", "can", "about", "into", "through",
      "during", "before", "after", "above", "below", "between"
    ]);
  }

  processQuery(query) {
    try {
      Logger.info(`[NLP] Procesando: "${query}"`);

      const language = this.detectLanguage(query);
      const normalized = this.normalizeText(query);
      const tokens = this.tokenize(normalized, language);
      const intent = this.detectIntent(normalized);
      const game = this.identifyGame(normalized);
      const specificQuery = this.identifySpecificQuery(normalized);

      // Generar respuesta contextual inteligente
      const contextualAnswer = this.generateSmartAnswer(
        normalized,
        game,
        intent,
        specificQuery,
        language
      );

      const searchTerms = this.extractSearchTerms(tokens, game, language);

      const result = {
        original: query,
        normalized,
        language,
        tokens,
        intent,
        game,
        specificQuery,
        searchTerms,
        contextualAnswer
      };

      if (contextualAnswer) {
        Logger.info(`[NLP] Respuesta generada: ${contextualAnswer.substring(0, 80)}...`);
      }

      return result;
    } catch (error) {
      Logger.error("[NLP] Error:", error);
      return {
        original: query,
        normalized: query.toLowerCase(),
        language: "es",
        tokens: [query],
        searchTerms: [query]
      };
    }
  }

  normalizeText(text) {
    return text
      .toLowerCase()
      .trim()
      .replace(/á/g, "a")
      .replace(/é/g, "e")
      .replace(/í/g, "i")
      .replace(/ó/g, "o")
      .replace(/ú/g, "u")
      .replace(/ñ/g, "n")
      .replace(/[¿?¡!]/g, "")
      .replace(/\s+/g, " ");
  }

  detectLanguage(text) {
    const lowerText = text.toLowerCase();
    const spanishWords = ["cuál", "cómo", "qué", "dónde", "probabilidad", "del", "para"];
    const englishWords = ["what", "how", "which", "probability", "the", "chance"];

    let spanishScore = 0;
    let englishScore = 0;

    spanishWords.forEach(word => {
      if (lowerText.includes(word)) spanishScore++;
    });

    englishWords.forEach(word => {
      if (lowerText.includes(word)) englishScore++;
    });

    return spanishScore >= englishScore ? "es" : "en";
  }

  tokenize(text, language) {
    const tokenizer = language === "es" ? this.tokenizerES : this.tokenizerEN;
    return tokenizer.tokenize(text) || [];
  }

  detectIntent(text) {
    for (const [intent, patterns] of Object.entries(this.queryPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          return intent;
        }
      }
    }
    return "search";
  }

  identifyGame(text) {
    for (const [game, data] of Object.entries(this.gameKnowledge)) {
      for (const name of data.names) {
        if (text.includes(name)) {
          return game;
        }
      }
    }
    return null;
  }

  identifySpecificQuery(text) {
    // Detectar queries específicas como "rojo en ruleta"
    if (/rojo|red/.test(text) && /ruleta|roulette/.test(text)) {
      return "redRoulette";
    }
    if (/negro|black/.test(text) && /ruleta|roulette/.test(text)) {
      return "blackRoulette";
    }
    if (/par|even/.test(text) && /ruleta|roulette/.test(text)) {
      return "evenRoulette";
    }
    if (/impar|odd/.test(text) && /ruleta|roulette/.test(text)) {
      return "oddRoulette";
    }
    if (/numero|number/.test(text) && /ruleta|roulette/.test(text)) {
      return "numberRoulette";
    }
    if (/seguro|insurance/.test(text) && /blackjack/.test(text)) {
      return "insuranceBlackjack";
    }
    if (/natural/.test(text) && /blackjack/.test(text)) {
      return "naturalBlackjack";
    }
    if (/banca|banker/.test(text) && /baccarat|bacará/.test(text)) {
      return "bankerBaccarat";
    }
    if (/empate|tie/.test(text) && /baccarat|bacará/.test(text)) {
      return "tieBaccarat";
    }

    return null;
  }

  generateSmartAnswer(text, game, intent, specificQuery, language) {
    const isSpanish = language === "es";

    // Respuestas específicas para queries comunes
    if (specificQuery === "redRoulette" || specificQuery === "blackRoulette") {
      return isSpanish
        ? `🎰 **Ruleta - Rojo/Negro**: La probabilidad de que salga rojo o negro es **48.65%** en ruleta europea. Hay 18 números rojos, 18 negros y 1 verde (cero). El cero verde da la ventaja a la casa del **2.7%**. El pago es 1:1 (duplicas tu apuesta). En ruleta americana (doble cero), la probabilidad baja a 47.37% y la ventaja de la casa sube a 5.26%.`
        : `🎰 **Roulette - Red/Black**: The probability of red or black is **48.65%** on European roulette. There are 18 red, 18 black, and 1 green (zero). The green zero gives the house edge of **2.7%**. Payout is 1:1 (double your bet). On American roulette (double zero), probability drops to 47.37% and house edge rises to 5.26%.`;
    }

    if (specificQuery === "evenRoulette" || specificQuery === "oddRoulette") {
      return isSpanish
        ? `🎰 **Ruleta - Par/Impar**: La probabilidad de par o impar es **48.65%** en ruleta europea (igual que rojo/negro). Hay 18 números pares y 18 impares. El cero no cuenta como par ni impar, dándole la ventaja del **2.7%** a la casa. Pago: 1:1.`
        : `🎰 **Roulette - Even/Odd**: The probability of even or odd is **48.65%** on European roulette (same as red/black). There are 18 even and 18 odd numbers. Zero doesn't count as even or odd, giving the house a **2.7%** edge. Payout: 1:1.`;
    }

    if (specificQuery === "numberRoulette") {
      return isSpanish
        ? `🎰 **Ruleta - Número Específico**: La probabilidad de acertar un número específico es **2.7%** (1 en 37) en ruleta europea. El pago es **35:1** (ganas 35 veces tu apuesta). Aunque el pago parece alto, la ventaja de la casa sigue siendo 2.7% debido a que solo hay 37 números. En ruleta americana (38 números), la probabilidad es 2.6% y la ventaja sube a 5.26%.`
        : `🎰 **Roulette - Specific Number**: The probability of hitting a specific number is **2.7%** (1 in 37) on European roulette. Payout is **35:1** (you win 35 times your bet). Although the payout seems high, the house edge remains 2.7% because there are only 37 numbers. On American roulette (38 numbers), probability is 2.6% and edge rises to 5.26%.`;
    }

    if (specificQuery === "insuranceBlackjack") {
      return isSpanish
        ? `🃏 **Blackjack - Seguro**: NUNCA tomes seguro. La ventaja de la casa en la apuesta de seguro es **7.4%**, mucho más alta que el 0.5% del juego base. El seguro paga 2:1 pero solo ganas si el dealer tiene blackjack (30.8% de probabilidad cuando muestra As). Matemáticamente, pierdes dinero a largo plazo tomando seguro.`
        : `🃏 **Blackjack - Insurance**: NEVER take insurance. The house edge on insurance is **7.4%**, much higher than the 0.5% base game. Insurance pays 2:1 but you only win if dealer has blackjack (30.8% probability when showing Ace). Mathematically, you lose money long-term by taking insurance.`;
    }

    if (specificQuery === "naturalBlackjack") {
      return isSpanish
        ? `🃏 **Blackjack - Natural**: La probabilidad de recibir blackjack natural (As + carta de 10) es **4.8%** (aproximadamente 1 de cada 21 manos). Un natural paga **3:2** (1.5x tu apuesta) en mesas buenas, o **6:5** (1.2x) en mesas malas - EVITA las mesas 6:5. La probabilidad de que tanto tú como el dealer reciban natural es 0.23%.`
        : `🃏 **Blackjack - Natural**: The probability of getting natural blackjack (Ace + 10-card) is **4.8%** (approximately 1 in 21 hands). A natural pays **3:2** (1.5x your bet) on good tables, or **6:5** (1.2x) on bad tables - AVOID 6:5 tables. Probability of both you and dealer getting natural is 0.23%.`;
    }

    if (specificQuery === "bankerBaccarat") {
      return isSpanish
        ? `🎴 **Baccarat - Banca**: Apostar a la Banca es la MEJOR apuesta en baccarat. La probabilidad de que gane la Banca es **45.85%** con una ventaja de casa de solo **1.06%**. Aunque hay una comisión del 5% en las ganancias, sigue siendo mejor que apostar al Jugador (1.24% ventaja). El pago es 0.95:1 (casi el doble menos comisión).`
        : `🎴 **Baccarat - Banker**: Betting on Banker is the BEST bet in baccarat. Probability of Banker winning is **45.85%** with house edge of only **1.06%**. Although there's a 5% commission on wins, it's still better than betting Player (1.24% edge). Payout is 0.95:1 (almost double minus commission).`;
    }

    if (specificQuery === "tieBaccarat") {
      return isSpanish
        ? `🎴 **Baccarat - Empate**: NUNCA apuestes al empate. Aunque paga 8:1, la probabilidad es solo **9.5%** y la ventaja de la casa es masiva: **14.4%**. Es una de las peores apuestas en el casino. Stick con la Banca (1.06%) o el Jugador (1.24%).`
        : `🎴 **Baccarat - Tie**: NEVER bet on Tie. Although it pays 8:1, probability is only **9.5%** and house edge is massive: **14.4%**. It's one of the worst bets in the casino. Stick with Banker (1.06%) or Player (1.24%).`;
    }

    // Si no hay query específica, generar respuesta general basada en juego e intención
    if (!game) return null;

    const knowledge = this.gameKnowledge[game];
    if (!knowledge) return null;

    const gameName = this.formatGameName(game, isSpanish);

    // Respuestas según intención
    if (intent === "probability" || intent.includes("probability")) {
      return this.generateProbabilityAnswer(game, gameName, knowledge, isSpanish);
    }

    if (intent === "strategy") {
      return this.generateStrategyAnswer(game, gameName, knowledge, isSpanish);
    }

    if (intent === "payout" || intent === "houseEdge") {
      return this.generatePayoutAnswer(game, gameName, knowledge, isSpanish);
    }

    if (intent === "rules") {
      return this.generateRulesAnswer(game, gameName, knowledge, isSpanish);
    }

    if (intent === "comparison") {
      return this.generateComparisonAnswer(game, gameName, knowledge, isSpanish);
    }

    // Respuesta general
    return this.generateGeneralAnswer(game, gameName, knowledge, isSpanish);
  }

  formatGameName(game, isSpanish) {
    const names = {
      blackjack: isSpanish ? "Blackjack" : "Blackjack",
      ruleta: isSpanish ? "Ruleta" : "Roulette",
      poker: isSpanish ? "Poker" : "Poker",
      tragamonedas: isSpanish ? "Tragamonedas" : "Slots",
      dados: isSpanish ? "Dados (Craps)" : "Craps",
      baccarat: isSpanish ? "Baccarat" : "Baccarat"
    };
    return names[game] || game;
  }

  generateProbabilityAnswer(game, gameName, knowledge, isSpanish) {
    if (typeof knowledge.probability === "number") {
      const percentage = (knowledge.probability * 100).toFixed(1);

      if (isSpanish) {
        return `🎲 **${gameName}**: La probabilidad de ganar es aproximadamente **${percentage}%**. La ventaja de la casa es **${knowledge.houseEdge}%** y el RTP es **${knowledge.rtp}%**. ${knowledge.facts[0]}`;
      } else {
        return `🎲 **${gameName}**: Winning probability is approximately **${percentage}%**. House edge is **${knowledge.houseEdge}%** and RTP is **${knowledge.rtp}%**. ${knowledge.facts[0]}`;
      }
    } else {
      if (isSpanish) {
        return `🎲 **${gameName}**: La probabilidad es variable y depende de tu habilidad y estrategia. ${knowledge.facts[0]}`;
      } else {
        return `🎲 **${gameName}**: Probability is variable and depends on your skill and strategy. ${knowledge.facts[0]}`;
      }
    }
  }

  generateStrategyAnswer(game, gameName, knowledge, isSpanish) {
    const strategies = knowledge.strategies.slice(0, 3).join(isSpanish ? ". " : ". ");

    if (isSpanish) {
      return `🎯 **Estrategia ${gameName}**: ${strategies}. La mejor apuesta es: ${knowledge.bestOdds}.`;
    } else {
      return `🎯 **${gameName} Strategy**: ${strategies}. Best bet is: ${knowledge.bestOdds}.`;
    }
  }

  generatePayoutAnswer(game, gameName, knowledge, isSpanish) {
    if (isSpanish) {
      return `💰 **${gameName}**: RTP promedio: **${knowledge.rtp}%**. Ventaja de la casa: **${knowledge.houseEdge}%**. ${knowledge.facts[1] || knowledge.facts[0]}`;
    } else {
      return `💰 **${gameName}**: Average RTP: **${knowledge.rtp}%**. House edge: **${knowledge.houseEdge}%**. ${knowledge.facts[1] || knowledge.facts[0]}`;
    }
  }

  generateRulesAnswer(game, gameName, knowledge, isSpanish) {
    if (isSpanish) {
      return `📖 **${gameName}**: ${knowledge.description}. ${knowledge.detailedRules}`;
    } else {
      return `📖 **${gameName}**: ${knowledge.description}. ${knowledge.detailedRules}`;
    }
  }

  generateComparisonAnswer(game, gameName, knowledge, isSpanish) {
    const allGames = Object.entries(this.gameKnowledge)
      .filter(([g, k]) => typeof k.houseEdge === "number")
      .sort((a, b) => a[1].houseEdge - b[1].houseEdge);

    const best = allGames.slice(0, 3).map(([g, k]) =>
      `${this.formatGameName(g, isSpanish)} (${k.houseEdge}%)`
    ).join(", ");

    if (isSpanish) {
      return `⚖️ **${gameName}** tiene ventaja de casa del **${knowledge.houseEdge}%**. Los mejores juegos por probabilidad son: ${best}. Menor ventaja = mejores odds.`;
    } else {
      return `⚖️ **${gameName}** has house edge of **${knowledge.houseEdge}%**. Best games by probability: ${best}. Lower edge = better odds.`;
    }
  }

  generateGeneralAnswer(game, gameName, knowledge, isSpanish) {
    if (isSpanish) {
      return `🎰 **${gameName}**: ${knowledge.description}. RTP: ${knowledge.rtp}%, Ventaja casa: ${knowledge.houseEdge}%. ${knowledge.facts[0]}`;
    } else {
      return `🎰 **${gameName}**: ${knowledge.description}. RTP: ${knowledge.rtp}%, House edge: ${knowledge.houseEdge}%. ${knowledge.facts[0]}`;
    }
  }

  extractSearchTerms(tokens, game, language) {
    const terms = new Set();

    if (game) {
      terms.add(game);
      const gameData = this.gameKnowledge[game];
      if (gameData) {
        gameData.names.forEach(name => terms.add(name));
      }
    }

    const stopWords = language === "es" ? this.stopWordsES : this.stopWordsEN;
    tokens.forEach(token => {
      if (token.length > 3 && !stopWords.has(token.toLowerCase())) {
        terms.add(token);
      }
    });

    return Array.from(terms);
  }
}

const nlpServiceExtended = new NLPServiceExtended();
module.exports = nlpServiceExtended;
