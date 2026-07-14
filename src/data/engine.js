/**
 * Modelo canónico del Final Edge Engine.
 * Copy: Documento Estratégico Integral (sección "El contenido, página por página").
 * Geometría y colores: brand/INVENTORY.md §6–7.
 */

export const PHASES = [
  {
    id: 'evaluacion',
    num: '01',
    name: 'Evaluación',
    label: 'EVALUACIÓN',
    slug: '/engine/evaluacion/',
    color: '#F4920C',
    colorVar: 'var(--phase-eval)',
    tagline: 'Decidir dónde la IA mueve tu margen, antes de tocar una herramienta.',
    lead: 'Inteligencia de mercado, análisis competitivo y planeación estratégica, potenciados integralmente por inteligencia artificial.',
    next: { name: 'Capacidades', slug: '/engine/capacidades/' },
    /* statement del hub — copy entregado por el cliente 2026-07-14
       (párrafo único; se muestra al tamaño del texto del hero del
       home, sin negrita) */
    statement: 'Investigamos mercados, consumidores, competidores y datos internos con agentes y flujos propios de IA. Más de 30 años de experiencia de negocio convierten esa inteligencia en una estrategia clara, ejecutable y diseñada para convertirse en una verdadera ventaja competitiva.',
    edges: ['intelligence', 'strategy'],
    startAngle: 300, // banda: strategy 330° + intelligence 30°
  },
  {
    id: 'capacidades',
    num: '02',
    name: 'Capacidades',
    label: 'CAPACIDADES',
    slug: '/engine/capacidades/',
    color: '#15D9D9',
    colorVar: 'var(--phase-cap)',
    tagline: 'Preparar a tu gente y a tus procesos para que la IA aterrice.',
    lead: 'Diagnóstico organizacional, entrenamiento ejecutivo y mapeo de procesos realizados con inteligencia artificial para acelerar la automatización.',
    next: { name: 'Ejecución', slug: '/engine/ejecucion/' },
    statement: 'Preparamos a las personas y optimizamos los procesos para que la inteligencia artificial genere resultados reales. Combinamos diagnóstico, capacitación y rediseño operativo para acelerar la adopción, la productividad y el retorno.',
    edges: ['readiness', 'flow'],
    startAngle: 60,
  },
  {
    id: 'ejecucion',
    num: '03',
    name: 'Ejecución',
    label: 'EJECUCIÓN',
    slug: '/engine/ejecucion/',
    color: '#E15CDB',
    colorVar: 'var(--phase-exe)',
    tagline: 'Construir, desplegar y producir para que la IA empiece a trabajar.',
    lead: 'Despliegue de aplicaciones, agentes y soluciones a la medida mediante desarrollo acelerado con IA, junto con contenido de estándar de calidad global. Implementación ultrarrápida y eficiente, a escala empresarial.',
    next: { name: 'Evaluación', slug: '/engine/evaluacion/' },
    statement: 'Convertimos la estrategia en software, herramientas digitales personalizadas y contenido que generan resultados reales. Desarrollamos cada solución con agentes de programación de IA y dirección experta, y producimos contenido de calidad cinematográfica, antes reservado para grandes marcas multinacionales, en una fracción del tiempo y del costo tradicional.',
    edges: ['systems', 'creative'],
    startAngle: 180,
  },
];

export const EDGES = [
  {
    id: 'strategy',
    phase: 'evaluacion',
    angle: 330,
    service: 'Estrategia',
    slug: '/servicios/estrategia/',
    statement: 'Cuando necesitas concentrar tus recursos donde pueden generar mayor crecimiento, transformamos datos internos y externos en una estrategia clara, diferenciadora y lista para ejecutar. La IA acelera el análisis; la experiencia de negocio define la dirección y las prioridades.',
    icon: '/assets/edge-icons/strategy.png',
    hook: 'De datos dispersos a dirección estratégica.',
    summary:
      'Convierte el crecimiento detenido en una dirección clara: un framework de 7 documentos estratégicos interconectados, con el rigor de una consultoría de primer nivel, en 10 días.',
    stats: [
      ['38%', 'de las empresas declara usar IA — usarla no es saber en qué dirección ir'],
      ['1%', 'ha alcanzado madurez estratégica real con IA'],
      ['10 días', 'para tener dirección estratégica clara'],
    ],
    quote: '7 documentos estratégicos interconectados. Un sistema, no un reporte.',
    uses: [
      ['Impulsar crecimiento', 'El crecimiento se detuvo y la causa no es evidente. El sistema despliega análisis de mercado, segmentación, landscape competitivo y marco estratégico, y construye un plan claro desde múltiples ángulos.'],
      ['Reestructurar la comunicación', 'Redefinición de marca y mensaje.'],
      ['Estrategia de integración de IA', 'De uso disperso a ventaja competitiva.'],
      ['Entrada a nuevo mercado o categoría', 'Expansión con certeza.'],
      ['Levantar inversión', 'Tesis estratégica respaldada por datos.'],
      ['Due diligence estratégico', 'Activa el ciclo completo de 7 documentos.'],
    ],
    proof: [
      ['Marco estratégico — tienda de mascotas en Hong Kong', 'Mercado, segmentación, análisis competitivo, estrategia de comunicación y conceptos creativos, en 7 documentos interconectados.'],
      ['Due diligence para inversionistas — infraestructura espacial en los Emiratos', 'Inteligencia de mercado, estrategia de crecimiento, roadmap tecnológico y plan de implementación, respaldado por fuentes verificables.'],
    ],
    closing: 'Una consultoría tradicional te da un PDF en 3 meses. Nosotros, un sistema estratégico en 10 días.',
  },
  {
    id: 'intelligence',
    phase: 'evaluacion',
    angle: 30,
    service: 'Business Intelligence',
    slug: '/servicios/business-intelligence/',
    statement: 'Cuando no tienes semanas para investigar, nuestros agentes y flujos propietarios de IA analizan mercados, consumidores, competidores, precios y tendencias en días. Más de 30 años de experiencia de negocio convierten esa información en insights relevantes, accionables y orientados a la toma de decisiones.',
    icon: '/assets/edge-icons/intelligence.png',
    hook: 'La respuesta correcta empieza con la pregunta correcta.',
    summary:
      'Un agente de investigación profunda impulsado por IA. Cualquier pregunta, industria o mercado, entregado como reporte estructurado y listo para usar en 48 horas.',
    stats: [
      ['100+', 'fuentes públicas, bases de datos y reportes especializados integrados en segundos'],
      ['48 horas', 'para tener inteligencia accionable, no días ni semanas'],
      ['Deep research', 'exhaustivo sobre cualquier tema, mercado o industria'],
    ],
    quote: 'La inteligencia que tu equipo necesita, cuando la necesita.',
    uses: [
      ['Benchmarking de precios y competencia', 'Estructuras de precios, paquetes y propuestas de valor de competidores directos e indirectos, verificado con fuentes reales.'],
      ['Snapshot de tendencias e industria', 'La evolución del mercado en contexto.'],
      ['Análisis de players y landscape competitivo', 'Quién es quién en tu categoría.'],
      ['Reporte de reputación de marca', 'Percepción digital y narrativa pública.'],
      ['Barreras de entrada a un mercado', 'Lo que no te dicen en el pitch deck.'],
      ['Marco regulatorio y compliance', 'Por mercado e industria.'],
    ],
    proof: [
      ['Auditoría SEO — Sports World México', 'Diagnóstico completo de posicionamiento orgánico: keywords, competencia directa, oportunidades de contenido y plan de acción priorizado.'],
      ['Benchmarking de precios — Hoteles VLU', 'Análisis comparativo de tarifas, paquetes y estacionalidad frente a competidores directos, con recomendaciones de pricing.'],
    ],
    closing: '48 horas. No semanas. Con fuentes verificadas y conclusiones listas para presentar.',
  },
  {
    id: 'readiness',
    phase: 'capacidades',
    angle: 90,
    service: 'Team Readiness',
    slug: '/servicios/team-readiness/',
    statement: 'La IA no genera valor si la organización no sabe cómo aplicarla. Evaluamos el nivel de preparación y desarrollamos las capacidades de líderes y equipos mediante programas adaptados a cada función, industria y nivel de responsabilidad.',
    icon: '/assets/edge-icons/readiness.png',
    hook: 'Mide. Entrena. Transforma.',
    summary:
      'El diagnóstico que revela la verdadera preparación de tu organización para adoptar IA — 3 niveles, 6 dimensiones, puntuación científica — más entrenamiento ejecutivo adaptado a cada rol.',
    stats: [
      ['360°', 'visibilidad total: alinea la realidad de cada nivel con la visión del liderazgo'],
      ['6D', 'puntuación científica con métricas ponderadas por dimensión'],
      ['50%', 'los líderes sobreestiman hasta en esa medida las capacidades reales de IA de sus equipos'],
    ],
    quote: 'No necesitas más herramientas. Necesitas saber por dónde empezar.',
    uses: [
      ['Diagnóstico de Team Readiness', 'Evaluación agregada por colaboradores, directores de área y alta dirección, con gap analysis y roadmap accionable.'],
      ['Executive Training & Public Speaking', 'Programas ejecutivos por perfil de liderazgo, área funcional e industria — 3 tracks, más de 8 áreas, 14 industrias — más conferencias y keynotes.'],
      ['4 niveles de preparación', 'Fundación · Emergente · Competente · IA como palanca de ventaja competitiva.'],
      ['6 dimensiones medidas', 'Conocimiento técnico · Mentalidad y cultura · Contexto externo · Integración de procesos · Colaboración entre áreas · Impacto medible.'],
    ],
    proof: [
      ['El recorrido completo', 'Evaluar, analizar, definir estrategia, implementar y re-evaluar: de la fotografía a la transformación.'],
      ['La puerta de entrada más sencilla', 'Subir la productividad del equipo con las plataformas de IA que ya existen, sin construir nada a la medida.'],
    ],
    closing: 'La dirección cree que va adelante; los equipos saben que no. El diagnóstico hace visible esa brecha con datos.',
  },
  {
    id: 'flow',
    phase: 'capacidades',
    angle: 150,
    service: 'Optimización de Procesos',
    slug: '/servicios/optimizacion-de-procesos/',
    statement: 'Antes de invertir en automatización, identificamos dónde se pierde tiempo, dinero y capacidad operativa. Nuestros flujos de IA aceleran el análisis, mientras la experiencia de negocio prioriza las iniciativas con mayor impacto, retorno y viabilidad.',
    icon: '/assets/edge-icons/flow.png',
    hook: 'Antes de automatizar, tienes que mapear.',
    summary:
      'Mapeamos cómo trabaja tu organización hoy y diseñamos cómo debería trabajar mañana. Sin mapeo no hay automatización real: solo caos digitalizado.',
    stats: [
      ['+50%', 'de incremento de productividad'],
      ['ROI', 'identificación y priorización de oportunidades de automatización por área funcional'],
      ['5 fases', 'de talleres a hoja de ruta, desarrollo y adopción'],
    ],
    quote: 'La claridad precede a la inversión.',
    uses: [
      ['Identificar cuellos de botella operativos', 'Sabes que algo no fluye, pero no exactamente dónde se pierde el tiempo o se duplica el trabajo. Lo hacemos visible.'],
      ['Evaluar la cadena de valor para integrar IA', 'Diagnóstico de impacto.'],
      ['Priorizar automatización con análisis de ROI', 'Inversión inteligente en tecnología.'],
      ['Diseñar la arquitectura antes de construir', 'Blueprint antes del desarrollo.'],
      ['Gestión del cambio y adopción', 'Adopción real, no solo implementación.'],
    ],
    proof: [
      ['El proceso — 5 fases', 'Talleres por área (1 semana) · Selección de proyectos (2 semanas) · Hoja de ruta (6 semanas) · Desarrollo con Sistemas · Gestión del cambio con Team Readiness.'],
      ['Reporte interactivo', 'Mapeo completo de procesos, análisis de cuellos de botella, evaluación de ROI y hoja de ruta ejecutable.'],
    ],
    closing: 'Cada peso invertido va al proyecto con mayor retorno, no al que suena más innovador.',
  },
  {
    id: 'systems',
    phase: 'ejecucion',
    angle: 210,
    service: 'Sistemas',
    slug: '/servicios/sistemas/',
    statement: 'Desarrollamos software y herramientas digitales personalizadas con el apoyo de agentes de programación de IA y dirección experta. Cada solución parte de una necesidad concreta del negocio y se entrega en una fracción del tiempo y del costo del desarrollo tradicional.',
    icon: '/assets/edge-icons/systems.png',
    hook: 'De la idea al sistema desplegado.',
    summary:
      'Agentes de programación de IA supervisados por ingenieros expertos: dashboards, CRM, ERP, pronóstico, inventarios y automatización de procesos, en una fracción del tiempo y del costo.',
    stats: [
      ['10x', 'más rápido y más económico que el desarrollo tradicional'],
      ['24/7', 'capacidad las 24 horas sin contratar las 24 horas — la respuesta directa a la jornada de 40 horas'],
      ['Semanas', 'no meses, sin presupuestos desbordados'],
    ],
    quote: 'Desarrollo de software a la medida, en una fracción del tiempo y del costo.',
    uses: [
      ['Automatización de procesos de trabajo', 'Reportes, actualizaciones, validaciones y notificaciones que corren solos, sin errores y sin intervención humana.'],
      ['Sistemas de toma de decisiones con IA', 'Reglas, datos y lógica de negocio integrados.'],
      ['Control de inventarios inteligente', 'Visibilidad en tiempo real y alertas automáticas.'],
      ['CRM y ERP personalizados', 'Construidos para tu negocio, no templates genéricos.'],
      ['Proyección de ventas multivariable', 'Forecasting con múltiples variables de negocio.'],
      ['Dashboards ejecutivos en tiempo real', 'KPIs, métricas y alertas en un solo lugar.'],
    ],
    proof: [
      ['Tablero financiero — Kanguru Beverages', 'P&L completo, unit economics, cashflow y análisis de financiamiento con analista financiero de IA integrado.'],
      ['Inteligencia de inventarios — Tiendas Chedraui', 'Monitoreo de ventas y salud de inventario en tiempo real, con 12 meses de reales más pronóstico.'],
      ['CRM comercial — Growth Hub', 'Pipeline visual, seguimientos automatizados, lead scoring con IA y reportería ejecutiva integrada.'],
    ],
    closing: 'Multiplica la productividad de tu equipo con soluciones de IA a la medida.',
  },
  {
    id: 'creative',
    phase: 'ejecucion',
    angle: 270,
    service: 'Producción Creativa',
    slug: '/servicios/produccion-creativa/',
    statement: 'Cuando necesitas producir más contenido sin multiplicar el presupuesto, combinamos IA, dirección estratégica y talento creativo internacional. Creamos campañas y producciones de calidad cinematográfica, antes reservadas para las grandes multinacionales, en días y no en meses.',
    icon: '/assets/edge-icons/creative.png',
    hook: 'Producción con IA de clase mundial. Dirigida por humanos.',
    summary:
      'Del brief a la entrega final en días, con toda la calidad, riqueza e impacto de la producción tradicional a una fracción del costo.',
    stats: [
      ['8', 'técnicas dominadas: animación, motion control, characters, VFX, cinematic, música, tomas acuáticas y comida'],
      ['5 fases', 'del brief al corte final: la IA acelera, el equipo humano dirige'],
      ['Días', 'no meses, a una fracción del costo de la producción tradicional'],
    ],
    quote: 'Mira lo que podemos hacer.',
    uses: [
      ['Strategic Foundation', 'Brief, análisis estratégico y concepto creativo antes de tocar cualquier herramienta.'],
      ['Pre-Production', 'Storyboard, investigación de física y mecánica, y scene cards con rigor de producción tradicional.'],
      ['AI Production', 'Generación de imagen y video: lo que toma semanas ocurre en horas.'],
      ['Human Direction', 'Edición, dirección de arte, sonido y música. Un director creativo humano revisa cada frame.'],
      ['Final Delivery', 'Supervisión humana del corte final. Nada sale sin aprobación humana.'],
    ],
    proof: [
      ['Campañas audiovisuales — Sports World México', 'Producción de clase mundial con continuidad de personajes y branding fotorrealista, entregada en días.'],
      ['Flexibilidad total', 'Sin depender del clima, de actores o de modelos: cualquier escena, cualquier locación, a demanda.'],
    ],
    closing: 'Las producciones de clase mundial ya no están restringidas a las marcas multinacionales.',
  },
];

export const edgeById = (id) => EDGES.find((e) => e.id === id);
export const phaseById = (id) => PHASES.find((p) => p.id === id);
export const phaseOfEdge = (edge) => phaseById(edge.phase);
