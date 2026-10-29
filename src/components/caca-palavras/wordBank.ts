/**
 * Banco de palavras do Caça Palavras / Palavras Cruzadas.
 *
 * Cada entrada tem uma dica (clue) e uma categoria exibida ao jogador.
 * `d` é a dificuldade (1 = fácil, 5 = difícil) e controla a partir de qual
 * fase a palavra entra no sorteio — quanto maior a fase, mais difícil.
 *
 * As palavras são normalizadas em tempo de execução (sem acentos, sem
 * espaços e apenas letras A-Z), porque o tabuleiro só suporta esse conjunto.
 */

export type Categoria =
  | 'Mundo'
  | 'História'
  | 'Trabalho'
  | 'Entretenimento'
  | 'Ciência'
  | 'Natureza'
  | 'Culinária'
  | 'Esportes'

export interface WordEntry {
  /** Palavra normalizada (A-Z, sem espaços). */
  word: string
  /** Dica exibida na lista de palavras. */
  clue: string
  category: Categoria
  /** Dificuldade de 1 a 5. */
  d: number
}

export const CATEGORIAS: Categoria[] = [
  'Mundo',
  'História',
  'Trabalho',
  'Entretenimento',
  'Ciência',
  'Natureza',
  'Culinária',
  'Esportes',
]

export const CATEGORY_COLORS: Record<Categoria, string> = {
  Mundo: 'from-sky-500/25 to-sky-500/5 text-sky-200 border-sky-400/30',
  História: 'from-amber-500/25 to-amber-500/5 text-amber-200 border-amber-400/30',
  Trabalho: 'from-emerald-500/25 to-emerald-500/5 text-emerald-200 border-emerald-400/30',
  Entretenimento: 'from-fuchsia-500/25 to-fuchsia-500/5 text-fuchsia-200 border-fuchsia-400/30',
  Ciência: 'from-cyan-500/25 to-cyan-500/5 text-cyan-200 border-cyan-400/30',
  Natureza: 'from-lime-500/25 to-lime-500/5 text-lime-200 border-lime-400/30',
  Culinária: 'from-orange-500/25 to-orange-500/5 text-orange-200 border-orange-400/30',
  Esportes: 'from-rose-500/25 to-rose-500/5 text-rose-200 border-rose-400/30',
}

const RAW: WordEntry[] = [
  // ---------------------------------------------------------------- Mundo
  { word: 'BRASIL', clue: 'País do Carnaval e da Seleção', category: 'Mundo', d: 1 },
  { word: 'FRANCA', clue: 'País da Torre Eiffel', category: 'Mundo', d: 1 },
  { word: 'JAPAO', clue: 'País do Monte Fuji', category: 'Mundo', d: 1 },
  { word: 'ITALIA', clue: 'País do Coliseu e da pizza', category: 'Mundo', d: 1 },
  { word: 'EGITO', clue: 'País das pirâmides e do Nilo', category: 'Mundo', d: 1 },
  { word: 'CANADA', clue: 'País das folhas de bordo', category: 'Mundo', d: 1 },
  { word: 'CHINA', clue: 'País da Muralha', category: 'Mundo', d: 1 },
  { word: 'INDIA', clue: 'País do Taj Mahal', category: 'Mundo', d: 2 },
  { word: 'AUSTRALIA', clue: 'País do canguru', category: 'Mundo', d: 2 },
  { word: 'PORTUGAL', clue: 'País do pastel de nata', category: 'Mundo', d: 2 },
  { word: 'ESPANHA', clue: 'País da paella', category: 'Mundo', d: 2 },
  { word: 'ALEMANHA', clue: 'País da engenharia e da precisão', category: 'Mundo', d: 2 },
  { word: 'RUSSIA', clue: 'País do Kremlin', category: 'Mundo', d: 2 },
  { word: 'ARGENTINA', clue: 'País do tango', category: 'Mundo', d: 2 },
  { word: 'NORUEGA', clue: 'País dos fiordes', category: 'Mundo', d: 3 },
  { word: 'SUECIA', clue: 'País das florestas e do ABBA', category: 'Mundo', d: 3 },
  { word: 'ISLANDIA', clue: 'País das auroras boreais', category: 'Mundo', d: 4 },
  { word: 'AMSTERDAM', clue: 'Capital dos canais', category: 'Mundo', d: 3 },
  { word: 'LONDRES', clue: 'Capital britânica e do Big Ben', category: 'Mundo', d: 1 },
  { word: 'PARIS', clue: 'Cidade do amor e da Torre Eiffel', category: 'Mundo', d: 1 },
  { word: 'ROMA', clue: 'Cidade eterna', category: 'Mundo', d: 1 },
  { word: 'NOVA YORK', clue: 'Cidade que nunca dorme', category: 'Mundo', d: 1 },
  { word: 'TOQUIO', clue: 'Maior cidade do Japão', category: 'Mundo', d: 2 },
  { word: 'BUENOS AIRES', clue: 'Capital portenhia', category: 'Mundo', d: 3 },
  { word: 'SANTIAGO', clue: 'Capital do Chile', category: 'Mundo', d: 2 },
  { word: 'LISBOA', clue: 'Capital portuguesa', category: 'Mundo', d: 1 },
  { word: 'CAIRO', clue: 'Capital do Egito', category: 'Mundo', d: 2 },
  { word: 'MOSCOVO', clue: 'Capital da Rússia', category: 'Mundo', d: 2 },
  { word: 'PEQUIM', clue: 'Capital da China', category: 'Mundo', d: 2 },
  { word: 'EIFFEL', clue: 'Ícone de ferro em Paris', category: 'Mundo', d: 2 },
  { word: 'COLISEO', clue: 'Arena romana de Roma', category: 'Mundo', d: 2 },
  { word: 'MURALHA', clue: 'Grande defesa de Pequim', category: 'Mundo', d: 2 },
  { word: 'TANQUIL', clue: 'Cidade do Equador no Equador', category: 'Mundo', d: 3 },
  { word: 'AMAZONAS', clue: 'Rio de maior volume de água do mundo', category: 'Mundo', d: 2 },
  { word: 'CHUVA', clue: 'Água que cai das nuvens', category: 'Mundo', d: 1 },
  { word: 'PASSAPORTE', clue: 'Documento para viajar ao exterior', category: 'Mundo', d: 3 },

  // ------------------------------------------------------------- História
  { word: 'PEDRO', clue: 'Primeiro imperador do Brasil', category: 'História', d: 2 },
  { word: 'TIRADENTES', clue: 'Herói da Inconfidência Mineira', category: 'História', d: 3 },
  { word: 'VARGAS', clue: 'Presidente do Estado Novo', category: 'História', d: 3 },
  { word: 'ABRIL', clue: 'Mês da Revolução Armada', category: 'História', d: 2 },
  { word: 'INDEPENDENCIA', clue: 'Lei de 7 de setembro de 1822', category: 'História', d: 2 },
  { word: 'REPÚBLICA', clue: 'Forma de governo após 1889', category: 'História', d: 2 },
  { word: 'NAPOLEAO', clue: 'Imperador francês', category: 'História', d: 2 },
  { word: 'CESAR', clue: 'Imperador romano', category: 'História', d: 2 },
  { word: 'CLEOPATRA', clue: 'Rainha do Egito', category: 'História', d: 2 },
  { word: 'ALEXANDRE', clue: 'O Grande, conquistador macedônio', category: 'História', d: 3 },
  { word: 'MANDELA', clue: 'Lider sul-africano da paz', category: 'História', d: 3 },
  { word: 'GANDHI', clue: 'Líder da independência da Índia', category: 'História', d: 3 },
  { word: 'LINCOLN', clue: 'Presidente que aboliu a escravidão nos EUA', category: 'História', d: 3 },
  { word: 'NEWTON', clue: 'Cientista da gravidade', category: 'História', d: 2 },
  { word: 'DA VINCI', clue: 'Renascista pintor e inventor', category: 'História', d: 2 },
  { word: 'COLUMBUS', clue: 'Navegador que chegou às Américas', category: 'História', d: 3 },
  { word: 'ZUMBI', clue: 'Líder dos quilombos dos Palmares', category: 'História', d: 3 },
  { word: 'RONDON', clue: 'Marechal do SPI e dos índios', category: 'História', d: 4 },
  { word: 'DORMIRO', clue: 'Cantor paraibano do repente', category: 'História', d: 5 },
  { word: 'BANDIRANTES', clue: 'Exploradores do interior do Brasil', category: 'História', d: 3 },
  { word: 'GUARANIES', clue: 'Povos indígenas do Sul do Brasil', category: 'História', d: 4 },

  // -------------------------------------------------------------- Trabalho
  { word: 'ENGENHEIRO', clue: 'Profissional que projeta estruturas', category: 'Trabalho', d: 2 },
  { word: 'ELETRICISTA', clue: 'Profissional que trabalha com fios', category: 'Trabalho', d: 2 },
  { word: 'ENFERMEIRO', clue: 'Profissional do hospital', category: 'Trabalho', d: 1 },
  { word: 'ADVOGADO', clue: 'Profissional da advocacia', category: 'Trabalho', d: 1 },
  { word: 'CONTADOR', clue: 'Profissional dos números', category: 'Trabalho', d: 1 },
  { word: 'PROFESSOR', clue: 'Quem transmite conhecimento', category: 'Trabalho', d: 1 },
  { word: 'BOMBEIRO', clue: 'Profissional que apaga incêndios', category: 'Trabalho', d: 1 },
  { word: 'POLICIAL', clue: 'Agente da segurança pública', category: 'Trabalho', d: 1 },
  { word: 'PILOTO', clue: 'Comanda a aeronave', category: 'Trabalho', d: 1 },
  { word: 'MOTORISTA', clue: 'Dirige o caminhão da obra', category: 'Trabalho', d: 1 },
  { word: 'CARPINTERO', clue: 'Trabalha com madeira', category: 'Trabalho', d: 2 },
  { word: 'PEDREIRO', clue: 'Levanta muros e paredes', category: 'Trabalho', d: 1 },
  { word: 'SOLDADOR', clue: 'Une metais com fogo', category: 'Trabalho', d: 2 },
  { word: 'MARCENEIRO', clue: 'Faz moveis e peças de madeira', category: 'Trabalho', d: 3 },
  { word: 'JARDINEIRO', clue: 'Cuida das plantas e dos jardins', category: 'Trabalho', d: 1 },
  { word: 'COZINHEIRO', clue: 'Prepara as refeições', category: 'Trabalho', d: 1 },
  { word: 'GARCOM', clue: 'Atende mesas no restaurante', category: 'Trabalho', d: 1 },
  { word: 'RECEPCIONISTA', clue: 'Atende na recepção', category: 'Trabalho', d: 2 },
  { word: 'GERENTE', clue: 'Lidera uma equipe', category: 'Trabalho', d: 1 },
  { word: 'AUDITOR', clue: 'Revisa contas e processos', category: 'Trabalho', d: 3 },
  { word: 'OPERADOR', clue: 'Opera máquinas e equipamentos', category: 'Trabalho', d: 2 },
  { word: 'SEGURANÇA', clue: 'Protege o trabalho e o patrimônio', category: 'Trabalho', d: 1 },
  { word: 'CANETA', clue: 'Instrumento de escrita', category: 'Trabalho', d: 1 },
  { word: 'CADERNO', clue: 'Onde se registram as anotações', category: 'Trabalho', d: 1 },
  { word: 'ESTAGIO', clue: 'Período de aprendizado na empresa', category: 'Trabalho', d: 2 },
  { word: 'DEMISSAO', clue: 'Saída do emprego', category: 'Trabalho', d: 2 },
  { word: 'FERIAS', clue: 'Pausa no trabalho', category: 'Trabalho', d: 1 },
  { word: 'TRATOR', clue: 'Máquina agrícola', category: 'Trabalho', d: 2 },
  { word: 'PLANILHA', clue: 'Tabela de controle no computador', category: 'Trabalho', d: 2 },
  { word: 'PONTO', clue: 'Registro de entrada e saída', category: 'Trabalho', d: 2 },

  // --------------------------------------------------- Segurança & EPIs
  { word: 'CAPACETE', clue: 'Proteção fundamental para a cabeça na obra', category: 'Segurança & EPIs', d: 1 },
  { word: 'LUVAS', clue: 'Proteção essencial para as mãos contra abrasão e corte', category: 'Segurança & EPIs', d: 1 },
  { word: 'BOTINA', clue: 'Calçado de segurança com bico de aço ou composite', category: 'Segurança & EPIs', d: 1 },
  { word: 'OCULOS', clue: 'Proteção ocular contra poeira, faíscas e estilhaços', category: 'Segurança & EPIs', d: 1 },
  { word: 'PROTETOR AURICULAR', clue: 'Proteção contra ruídos excessivos de máquinas', category: 'Segurança & EPIs', d: 2 },
  { word: 'CINTO DE SEGURANCA', clue: 'EPI para trabalho em altura do tipo paraquedista', category: 'Segurança & EPIs', d: 2 },
  { word: 'TALABARTE', clue: 'Elemento de conexão entre o cinto e o ponto de ancoragem', category: 'Segurança & EPIs', d: 2 },
  { word: 'MASCARA', clue: 'Proteção respiratória contra particulados e poeira', category: 'Segurança & EPIs', d: 1 },
  { word: 'RESPIRADOR', clue: 'Filtro facial contra vapores orgânicos e químicos', category: 'Segurança & EPIs', d: 2 },
  { word: 'COLETE REFLETIVO', clue: 'Garante alta visibilidade diurna e noturna no canteiro', category: 'Segurança & EPIs', d: 1 },
  { word: 'PERNEIRA', clue: 'Proteção para as pernas contra picadas e impactos cortantes', category: 'Segurança & EPIs', d: 2 },
  { word: 'AVENTAL DE RASPA', clue: 'Protege o corpo de soldadores contra fagulhas e calor', category: 'Segurança & EPIs', d: 3 },
  { word: 'ABAFADOR', clue: 'Protetor auricular tipo concha para atenuação de som', category: 'Segurança & EPIs', d: 2 },
  { word: 'TRAVA QUEDAS', clue: 'Dispositivo mecânico que bloqueia queda em trilhos ou cabos', category: 'Segurança & EPIs', d: 3 },
  { word: 'LINHA DE VIDA', clue: 'Cabo ou fita de ancoragem contínua para operários em altura', category: 'Segurança & EPIs', d: 2 },
  { word: 'EXTINTOR', clue: 'Equipamento portátil para combate a princípio de incêndio', category: 'Segurança & EPIs', d: 1 },
  { word: 'HIDRANTE', clue: 'Ponto fixo de água sob pressão para combate a chamas', category: 'Segurança & EPIs', d: 2 },
  { word: 'PERMISSAO', clue: 'Autorização formal (PT) para executar tarefas de risco', category: 'Segurança & EPIs', d: 2 },
  { word: 'ANALISE PRELIMINAR', clue: 'Avaliação detalhada dos perigos de uma atividade (APR)', category: 'Segurança & EPIs', d: 3 },
  { word: 'DDS', clue: 'Diálogo Diário de Segurança antes do início das atividades', category: 'Segurança & EPIs', d: 1 },
  { word: 'CIPA', clue: 'Comissão de Prevenção de Acidentes e Assédio no trabalho', category: 'Segurança & EPIs', d: 2 },
  { word: 'SESMT', clue: 'Equipe especializada em segurança e medicina ocupacional', category: 'Segurança & EPIs', d: 3 },
  { word: 'INSPECAO', clue: 'Checagem técnica preventiva de ferramentas e canteiro', category: 'Segurança & EPIs', d: 2 },
  { word: 'BLOQUEIO', clue: 'Travamento físico com cadeado para manutenção segura (LOTO)', category: 'Segurança & EPIs', d: 3 },
  { word: 'ETIQUETAGEM', clue: 'Sinalização com identificação do responsável pelo bloqueio', category: 'Segurança & EPIs', d: 3 },
  { word: 'ESPACO CONFINADO', clue: 'Local sem ventilação contínua que exige vigia e permissão', category: 'Segurança & EPIs', d: 3 },
  { word: 'ISOLAMENTO', clue: 'Delimitação de área com fita zebrada ou cercas de segurança', category: 'Segurança & EPIs', d: 2 },
  { word: 'SINALIZACAO', clue: 'Placas, cones e faixas de aviso e alerta no canteiro', category: 'Segurança & EPIs', d: 1 },
  { word: 'PRIMEIROS SOCORROS', clue: 'Atendimento inicial prestado a vítimas de acidentes', category: 'Segurança & EPIs', d: 2 },
  { word: 'MACA RIGIDA', clue: 'Equipamento de imobilização para resgate de acidentados', category: 'Segurança & EPIs', d: 3 },
  { word: 'EVACUACAO', clue: 'Desocupação rápida e ordenada em casos de emergência', category: 'Segurança & EPIs', d: 2 },
  { word: 'BRIGADA DE INCENDIO', clue: 'Grupo de colaboradores treinados para combate a sinistros', category: 'Segurança & EPIs', d: 2 },
  { word: 'ERGONOMIA', clue: 'Postura adequada e conforto nas operações diárias', category: 'Segurança & EPIs', d: 3 },
  { word: 'QUASE ACIDENTE', clue: 'Desvio operacional sem danos físicos que serve de alerta', category: 'Segurança & EPIs', d: 3 },
  { word: 'PONTO DE ENCONTRO', clue: 'Local seguro predeterminado para reunião na evacuação', category: 'Segurança & EPIs', d: 2 },
  { word: 'LAVAGEM DE OLHOS', clue: 'Chuveiro e lava-olhos de emergência para descontaminação', category: 'Segurança & EPIs', d: 3 },
  { word: 'CHECKLIST', clue: 'Lista de verificação antes de operar veículos ou máquinas', category: 'Segurança & EPIs', d: 1 },
  { word: 'NR DOZE', clue: 'Norma regulamentadora para segurança de máquinas e peças', category: 'Segurança & EPIs', d: 3 },
  { word: 'NR TRINTA E CINCO', clue: 'Norma que estabelece requisitos para trabalho em altura', category: 'Segurança & EPIs', d: 3 },
  { word: 'NR TRINTA E TRES', clue: 'Norma de segurança em espaços confinados', category: 'Segurança & EPIs', d: 3 },

  // ------------------------------------------------------- Meio Ambiente
  { word: 'RECICLAGEM', clue: 'Transformação de materiais descartados em nova matéria-prima', category: 'Meio Ambiente', d: 1 },
  { word: 'COLETA SELETIVA', clue: 'Separação criteriosa dos resíduos gerados na obra', category: 'Meio Ambiente', d: 1 },
  { word: 'RESIDUOS SOLIDOS', clue: 'Materiais descartados que exigem triagem e destinação', category: 'Meio Ambiente', d: 2 },
  { word: 'COMPOSTAGEM', clue: 'Processo biológico de adubação de restos orgânicos', category: 'Meio Ambiente', d: 2 },
  { word: 'CACAMBA', clue: 'Caçamba metálica para transporte de entulhos e sobras', category: 'Meio Ambiente', d: 1 },
  { word: 'ENTULHO', clue: 'Resíduo mineral da construção civil reaproveitado em bases', category: 'Meio Ambiente', d: 1 },
  { word: 'BIODEGRADAVEL', clue: 'Material suscetível a rápida decomposição pela natureza', category: 'Meio Ambiente', d: 2 },
  { word: 'SUSTENTABILIDADE', clue: 'Prática de desenvolvimento respeitando os recursos futuros', category: 'Meio Ambiente', d: 2 },
  { word: 'DESCONTAMINACAO', clue: 'Remoção de poluentes químicos do solo ou lençol freático', category: 'Meio Ambiente', d: 3 },
  { word: 'EFLUENTE', clue: 'Resíduo líquido gerado que deve passar por tratamento', category: 'Meio Ambiente', d: 3 },
  { word: 'LOGISTICA REVERSA', clue: 'Cadeia de devolução de baterias e lâmpadas ao fabricante', category: 'Meio Ambiente', d: 3 },
  { word: 'DESCARTE CORRETO', clue: 'Encaminhamento ambientalmente certificado para aterros licenciados', category: 'Meio Ambiente', d: 2 },
  { word: 'LIXEIRA AZUL', clue: 'Recipiente padronizado do CONAMA para papel e papelão', category: 'Meio Ambiente', d: 2 },
  { word: 'LIXEIRA VERMELHA', clue: 'Recipiente padronizado do CONAMA para plásticos', category: 'Meio Ambiente', d: 2 },
  { word: 'LIXEIRA AMARELA', clue: 'Recipiente padronizado do CONAMA para metais e latas', category: 'Meio Ambiente', d: 2 },
  { word: 'LIXEIRA VERDE', clue: 'Recipiente padronizado do CONAMA para embalagens de vidro', category: 'Meio Ambiente', d: 2 },
  { word: 'LIXEIRA MARROM', clue: 'Recipiente padronizado do CONAMA para resíduos orgânicos', category: 'Meio Ambiente', d: 2 },
  { word: 'LIXEIRA LARANJA', clue: 'Recipiente padronizado para resíduos perigosos e contaminados', category: 'Meio Ambiente', d: 3 },
  { word: 'CONTAMINANTE', clue: 'Agente nocivo que altera a pureza do ar, da água ou do solo', category: 'Meio Ambiente', d: 2 },
  { word: 'OLEO USADO', clue: 'Óleo lubrificante queimado que deve ser recolhido para rerrefino', category: 'Meio Ambiente', d: 2 },
  { word: 'BACIA DE CONTENCAO', clue: 'Estrutura estanque para evitar derramamento de combustível', category: 'Meio Ambiente', d: 3 },
  { word: 'PLUVIOMETRIA', clue: 'Medição diária do índice de chuvas com pluviômetro', category: 'Meio Ambiente', d: 3 },
  { word: 'REFLORESTAMENTO', clue: 'Plantio de mudas nativas para recuperação de áreas degradadas', category: 'Meio Ambiente', d: 2 },
  { word: 'PRESERVACAO', clue: 'Ação contínua de proteção de mananciais, matas e fauna', category: 'Meio Ambiente', d: 2 },
  { word: 'MANANCIAL', clue: 'Fonte hídrica natural utilizada para abastecimento e consumo', category: 'Meio Ambiente', d: 3 },
  { word: 'EMISSAO DE GASES', clue: 'Liberação de fumaça preta e carbono controlada por opacímetro', category: 'Meio Ambiente', d: 3 },
  { word: 'LICENCA AMBIENTAL', clue: 'Autorização dos órgãos estaduais e federais para o projeto', category: 'Meio Ambiente', d: 3 },
  { word: 'EROSAO', clue: 'Desgaste da terra em taludes evitado por drenagem e grama', category: 'Meio Ambiente', d: 2 },
  { word: 'ASPERCAO DE AGUA', clue: 'Pulverização para umectação de vias e controle de material particulado', category: 'Meio Ambiente', d: 3 },
  { word: 'CAMINHAO PIPA', clue: 'Veículo com tanque de água para lavagem de pistas e umectação', category: 'Meio Ambiente', d: 2 },
  { word: 'SEPARADOR DE AGUA', clue: 'Caixa CSAO que separa água e óleo de lavagens mecânicas', category: 'Meio Ambiente', d: 3 },
  { word: 'CANTEIRO LIMPO', clue: 'Organização ambiental que impede o acúmulo de sujeira e vetores', category: 'Meio Ambiente', d: 1 },
  { word: 'COMPOSTO ORGANICO', clue: 'Adubo gerado pelo aproveitamento de sobras de refeitório', category: 'Meio Ambiente', d: 2 },
  { word: 'DESASSOREAMENTO', clue: 'Limpeza de canais e canaletas de drenagem pluvial', category: 'Meio Ambiente', d: 4 },
  { word: 'MTR', clue: 'Manifesto de Transporte de Resíduos exigido pela fiscalização', category: 'Meio Ambiente', d: 4 },

  // ------------------------------------------------------- Entretenimento
  { word: 'CINEMA', clue: 'Onde as histórias são projetadas', category: 'Entretenimento', d: 1 },
  { word: 'TEATRO', clue: 'Palco de representações', category: 'Entretenimento', d: 1 },
  { word: 'MUSICA', clue: 'Arte das notas e do ritmo', category: 'Entretenimento', d: 1 },
  { word: 'FILME', clue: 'Obra que passa na tela', category: 'Entretenimento', d: 1 },
  { word: 'SERIE', clue: 'História dividida em episódios', category: 'Entretenimento', d: 1 },
  { word: 'ROCK', clue: 'Gênero musical com guitarra', category: 'Entretenimento', d: 1 },
  { word: 'SERTANEJO', clue: 'Gênero musical do campo', category: 'Entretenimento', d: 2 },
  { word: 'SAMBA', clue: 'Ritmo do Carnaval', category: 'Entretenimento', d: 2 },
  { word: 'FUNK', clue: 'Batida pesada das periferias', category: 'Entretenimento', d: 2 },
  { word: 'VIDEOGAME', clue: 'Jogo eletrônico', category: 'Entretenimento', d: 1 },
  { word: 'XADREZ', clue: 'Jogo das casas pretas e brancas', category: 'Entretenimento', d: 2 },
  { word: 'DOMINO', clue: 'Jogo de peças numeradas', category: 'Entretenimento', d: 2 },
  { word: 'DAMA', clue: 'Jogo de tabuleiro com peças redondas', category: 'Entretenimento', d: 2 },
  { word: 'TATU', clue: 'Desenho animado com um personagem de pele azul', category: 'Entretenimento', d: 3 },
  { word: 'HEROIS', clue: 'Vingadores de super-heróis', category: 'Entretenimento', d: 2 },
  { word: 'STAR WARS', clue: 'Saga da Força e da Estrela', category: 'Entretenimento', d: 3 },
  { word: 'HARRY POTTER', clue: 'Escola de magia e varinha', category: 'Entretenimento', d: 3 },
  { word: 'SUPER MARIO', clue: 'Encanador bigodudo', category: 'Entretenimento', d: 2 },
  { word: 'SONIC', clue: 'Ouriço azul super veloz', category: 'Entretenimento', d: 2 },
  { word: 'ZELDA', clue: 'Princesa de Hyrule', category: 'Entretenimento', d: 2 },
  { word: 'MARVEL', clue: 'Universo de super-heróis', category: 'Entretenimento', d: 2 },
  { word: 'CARNAVAL', clue: 'Festa do carnaval brasileiro', category: 'Entretenimento', d: 1 },
  { word: 'HALLOWEEN', clue: 'Festa das abóboras', category: 'Entretenimento', d: 2 },
  { word: 'FESTA JUNINA', clue: 'Festa do quadrilho e da fogueira', category: 'Entretenimento', d: 2 },
  { word: 'CHURRASCO', clue: 'Festa de carne assada', category: 'Entretenimento', d: 1 },
  { word: 'ANIME', clue: 'Desenho japonês', category: 'Entretenimento', d: 2 },
  { word: 'PIANO', clue: 'Instrumento de teclas', category: 'Entretenimento', d: 1 },
  { word: 'VIOLINO', clue: 'Instrumento de cordas tocado com arco', category: 'Entretenimento', d: 2 },
  { word: 'TEATRO GREGO', clue: 'Berço do teatro ocidental', category: 'Entretenimento', d: 4 },

  // ------------------------------------------------------------- Ciência
  { word: 'ATOMO', clue: 'Menor unidade da matéria', category: 'Ciência', d: 1 },
  { word: 'CELULA', clue: 'Unidade viva dos seres', category: 'Ciência', d: 1 },
  { word: 'MOLECULA', clue: 'União de átomos', category: 'Ciência', d: 2 },
  { word: 'ENERGIA', clue: 'O que move as máquinas', category: 'Ciência', d: 1 },
  { word: 'GRAVIDADE', clue: 'Força que mantém tudo no chão', category: 'Ciência', d: 2 },
  { word: 'FOTOSSINTESE', clue: 'Plantas que usam a luz do sol', category: 'Ciência', d: 4 },
  { word: 'EVOLUCAO', clue: 'Mudança das espécies ao longo do tempo', category: 'Ciência', d: 3 },
  { word: 'PLANETA', clue: 'Corpo celeste que gira em torno do Sol', category: 'Ciência', d: 1 },
  { word: 'GALAXIA', clue: 'Conjunto de milhões de estrelas', category: 'Ciência', d: 3 },
  { word: 'VULCAO', clue: 'Montanha que expõe magma', category: 'Ciência', d: 2 },
  { word: 'TERREMOTO', clue: 'Tremor de terra', category: 'Ciência', d: 2 },
  { word: 'OXIGENIO', clue: 'Gás que respiramos', category: 'Ciência', d: 1 },
  { word: 'HIDROGENIO', clue: 'Elemento mais leve', category: 'Ciência', d: 2 },
  { word: 'VELOCIDADE', clue: 'Medida em metros por segundo', category: 'Ciência', d: 2 },
  { word: 'PRESSAO', clue: 'Força sobre uma superfície', category: 'Ciência', d: 2 },
  { word: 'MAGNETISMO', clue: 'Atração dos imãs', category: 'Ciência', d: 3 },
  { word: 'LASER', clue: 'Feixe de luz coerente', category: 'Ciência', d: 3 },
  { word: 'ROBOTICA', clue: 'Ciência dos robôs', category: 'Ciência', d: 3 },
  { word: 'ALGORITMO', clue: 'Receita passo a passo do computador', category: 'Ciência', d: 3 },
  { word: 'SATELITE', clue: 'Objeto que orbita a Terra', category: 'Ciência', d: 2 },
  { word: 'ECOSSISTEMA', clue: 'Comunidade viva e seu ambiente', category: 'Ciência', d: 4 },
  { word: 'DINAMICA', clue: 'Parte da física que estuda o movimento', category: 'Ciência', d: 3 },
  { word: 'TERMICA', clue: 'Relacionada ao calor', category: 'Ciência', d: 3 },
  { word: 'ELETRICIDADE', clue: 'Corrente que move os aparelhos', category: 'Ciência', d: 2 },
  { word: 'VACINA', clue: 'Imunização contra doenças', category: 'Ciência', d: 2 },
  { word: 'TELEMETRIA', clue: 'Medição remota de dados', category: 'Ciência', d: 4 },

  // ----------------------------------------------------------- Natureza
  { word: 'ELEFANTE', clue: 'Maior animal terrestre', category: 'Natureza', d: 1 },
  { word: 'GIRAFA', clue: 'Animal do pescoço comprido', category: 'Natureza', d: 1 },
  { word: 'TIGRE', clue: 'Felino listrado', category: 'Natureza', d: 1 },
  { word: 'LOBO', clue: 'Cão selvagem das matas', category: 'Natureza', d: 2 },
  { word: 'ARANHA', clue: 'Oito patas e teia', category: 'Natureza', d: 2 },
  { word: 'JACARE', clue: 'Réptil do Pantanal', category: 'Natureza', d: 2 },
  { word: 'SUCURI', clue: 'Cobra grande do Brasil', category: 'Natureza', d: 3 },
  { word: 'CAPIVARA', clue: 'Maior roedor do mundo', category: 'Natureza', d: 2 },
  { word: 'MANGUE', clue: 'Árvore dos vales e brejos', category: 'Natureza', d: 3 },
  { word: 'IPIRANGA', clue: 'Rio que corta São Paulo', category: 'Natureza', d: 3 },
  { word: 'PANTANAL', clue: 'Maior planície alagável do Brasil', category: 'Natureza', d: 3 },
  { word: 'AMAZONIA', clue: 'Floresta que corta o Norte do Brasil', category: 'Natureza', d: 2 },
  { word: 'CACHoeira', clue: 'Queda de água de rio', category: 'Natureza', d: 2 },
  { word: 'CORAL', clue: 'Recife marinho feito de organismos vivos', category: 'Natureza', d: 3 },
  { word: 'BALEIA', clue: 'Maior animal do oceano', category: 'Natureza', d: 1 },
  { word: 'GOLFINHO', clue: 'Mamífero saltitante do mar', category: 'Natureza', d: 2 },
  { word: 'FENIX', clue: 'Ave que renasce das cinzas', category: 'Natureza', d: 3 },
  { word: 'FLORESTA', clue: 'Grande área com muitas árvores', category: 'Natureza', d: 1 },
  { word: 'DESERTO', clue: 'Região muito seca', category: 'Natureza', d: 1 },
  { word: 'ILHA', clue: 'Terra rodeada de água', category: 'Natureza', d: 1 },
  { word: 'MONTANHA', clue: 'Elevação grande de rocha', category: 'Natureza', d: 1 },
  { word: 'PRAIA', clue: 'Areia à beira-mar', category: 'Natureza', d: 1 },

  // ----------------------------------------------------------- Culinária
  { word: 'FEIJAO', clue: 'Grão do dia a dia', category: 'Culinária', d: 1 },
  { word: 'ARROZ', clue: 'Grão branco que acompanha o feijão', category: 'Culinária', d: 1 },
  { word: 'FARINHA', clue: 'Pó de trigo usado no pão', category: 'Culinária', d: 2 },
  { word: 'MANTEIGA', clue: 'Gordura do leite usada no pão', category: 'Culinária', d: 2 },
  { word: 'QUEIJO', clue: 'Alimento que vem do leite', category: 'Culinária', d: 1 },
  { word: 'PAO', clue: 'Alimento feito de farinha no forno', category: 'Culinária', d: 1 },
  { word: 'BOLO', clue: 'Doce de festa assado no forno', category: 'Culinária', d: 1 },
  { word: 'BRIGADEIRO', clue: 'Doce de chocolate com granulado', category: 'Culinária', d: 2 },
  { word: 'PUDIM', clue: 'Sobremesa de leite e ovos', category: 'Culinária', d: 2 },
  { word: 'COXINHA', clue: 'Salgado de massa com frango', category: 'Culinária', d: 2 },
  { word: 'PASTEL', clue: 'Salgado de massa recheado', category: 'Culinária', d: 1 },
  { word: 'PIZZA', clue: 'Massa redonda com queijo e tomate', category: 'Culinária', d: 1 },
  { word: 'HAMBURGUER', clue: 'Lanche de pão com carne', category: 'Culinária', d: 1 },
  { word: 'CACHORRO QUENTE', clue: 'Lanche com salsicha no pão', category: 'Culinária', d: 2 },
  { word: 'ACAI', clue: 'Fruto roxo do Pará', category: 'Culinária', d: 3 },
  { word: 'TAPIOCA', clue: 'Goma de mandioca', category: 'Culinária', d: 2 },
  { word: 'MOQUECA', clue: 'Ensopado de peixe com coentro', category: 'Culinária', d: 3 },
  { word: 'CACHACA', clue: 'Bebida destilada de cana', category: 'Culinária', d: 2 },
  { word: 'CAFE', clue: 'Bebida que dá energia de manhã', category: 'Culinária', d: 1 },
  { word: 'LEITE', clue: 'Bebida branca do gado', category: 'Culinária', d: 1 },
  { word: 'SUCO', clue: 'Bebida feita de fruta', category: 'Culinária', d: 1 },
  { word: 'SORVETE', clue: 'Doce gelado', category: 'Culinária', d: 1 },
  { word: 'CANA DE ACOUCAR', clue: 'Matéria-prima do açúcar', category: 'Culinária', d: 4 },

  // ------------------------------------------------------------ Esportes
  { word: 'FUTEBOL', clue: 'Esporte com bola e traves', category: 'Esportes', d: 1 },
  { word: 'VOLEIBOL', clue: 'Esporte da rede', category: 'Esportes', d: 2 },
  { word: 'BASQUETE', clue: 'Esporte da cesta', category: 'Esportes', d: 2 },
  { word: 'ATLETISMO', clue: 'Esporte das pistas e dos saltos', category: 'Esportes', d: 2 },
  { word: 'NATACAO', clue: 'Esporte da piscina', category: 'Esportes', d: 1 },
  { word: 'TENIS', clue: 'Esporte com bola e raquete', category: 'Esportes', d: 2 },
  { word: 'CICLISMO', clue: 'Esporte das bicicletas', category: 'Esportes', d: 2 },
  { word: 'CAPOEIRA', clue: 'Luta brasileira com capoeira', category: 'Esportes', d: 3 },
  { word: 'JUDO', clue: 'Arte marcial japonesa', category: 'Esportes', d: 3 },
  { word: 'CARATE', clue: 'Arte marcial japonesa com kata', category: 'Esportes', d: 3 },
  { word: 'MMA', clue: 'Luta mista na jaula', category: 'Esportes', d: 3 },
  { word: 'MUSCULACAO', clue: 'Treino com pesos', category: 'Esportes', d: 3 },
  { word: 'YOGA', clue: 'Prática de alongamento e respiração', category: 'Esportes', d: 2 },
  { word: 'CORRIDA', clue: 'Esporte de rua e de pista', category: 'Esportes', d: 2 },
  { word: 'SKATE', clue: 'Desporte com skate', category: 'Esportes', d: 2 },
  { word: 'SURF', clue: 'Desporte das ondas', category: 'Esportes', d: 2 },
  { word: 'OLIMPIADAS', clue: 'Jogos esportivos globais', category: 'Esportes', d: 3 },
  { word: 'COPA', clue: 'Competição entre países', category: 'Esportes', d: 1 },
  { word: 'MARATONA', clue: 'Corrida de 42 quilômetros', category: 'Esportes', d: 3 },
  { word: 'ARENA', clue: 'Estádio fechado de grandes eventos', category: 'Esportes', d: 3 },
]

/** Remove acentos, mantém apenas A-Z e colapsa espaços. */
export function normalizarPalavra(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Banco normalizado e deduplicado, pronto para uso nos geradores. */
export const WORD_BANK: WordEntry[] = (() => {
  const vistos = new Set<string>()
  const resultado: WordEntry[] = []
  for (const entry of RAW) {
    const word = normalizarPalavra(entry.word).replace(/ /g, '')
    if (word.length < 3 || word.length > 18) continue
    if (vistos.has(word)) continue
    vistos.add(word)
    resultado.push({ ...entry, word })
  }
  return resultado
})()

/** Palavras de uma categoria específica. */
export function palavrasDaCategoria(categoria: Categoria): WordEntry[] {
  return WORD_BANK.filter((entry) => entry.category === categoria)
}

/**
 * Sorteia as palavras de uma fase.
 *
 * - A dificuldade liberada cresce com a fase (`nivel`).
 * - O resultado nunca repete a mesma palavra dentro da fase.
 */
export function sortearPalavras(
  fase: number,
  quantidade: number,
  random: () => number,
  categorias?: Categoria[],
): WordEntry[] {
  const nivel = Math.min(5, 1 + Math.floor((fase - 1) / 2))
  const base = categorias?.length
    ? WORD_BANK.filter((entry) => categorias.includes(entry.category))
    : WORD_BANK

  const elegiveis = base.filter(
    (entry) => entry.d <= Math.max(1, nivel) && (nivel >= 2 || entry.word.length <= 12),
  )
  const pool = elegiveis.length >= quantidade ? elegiveis : base

  const picked: WordEntry[] = []
  const usadas = new Set<string>()
  const candidatos = [...pool]

  // Embaralha
  for (let i = candidatos.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[candidatos[i], candidatos[j]] = [candidatos[j], candidatos[i]]
  }

  for (const entry of candidatos) {
    if (picked.length >= quantidade) break
    if (usadas.has(entry.word)) continue
    usadas.add(entry.word)
    picked.push(entry)
  }

  // Fases muito altas podem esvaziar o baralho elegível: completa com
  // qualquer palavra ainda não usada.
  if (picked.length < quantidade) {
    for (const entry of WORD_BANK) {
      if (picked.length >= quantidade) break
      if (usadas.has(entry.word)) continue
      usadas.add(entry.word)
      picked.push(entry)
    }
  }

  return picked
}

/** Métricas de dificuldade de uma fase, usadas pelo hub e pelo multiplayer. */
export interface FaseConfig {
  fase: number
  nivel: number
  /** Lado do tabuleiro (busca) ou do crossword. */
  tamanho: number
  /** Quantidade de palavras a encontrar. */
  palavras: number
  /** Tempo limite em segundos. */
  segundos: number
}

/** Define tamanho de tabuleiro, quantidade de palavras e tempo de cada fase. */
export function configDaFase(fase: number): FaseConfig {
  const nivel = Math.min(5, 1 + Math.floor((fase - 1) / 2))
  const tamanho = Math.min(16, 10 + Math.floor((fase - 1) / 2) * 2)
  const palavras = Math.min(20, 6 + Math.floor((fase - 1) * 1.5))
  const segundos = Math.max(45, 150 - (fase - 1) * 12)
  return { fase, nivel, tamanho, palavras, segundos }
}

/** Quantidade total de fases de uma partida completa. */
export const FASES_POR_PARTIDA = 5
/** Quantidade de fases de uma partida online (1x1). */
export const FASES_POR_PARTIDA_ONLINE = 3
