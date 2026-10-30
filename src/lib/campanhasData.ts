export interface CampanhaData {
  n: number
  mes: string
  camp: string
  cor: string
  stripGradient?: string
  tema: string
  desc: string
  frase: string
  imagem?: string
  arte: boolean
}

export const CAMPANHAS_ANUAIS: CampanhaData[] = [
  {
    n: 1,
    mes: 'Janeiro',
    camp: 'Janeiro Branco',
    cor: '#6b7280',
    stripGradient: '#d1d5db',
    tema: 'Saúde mental',
    desc: 'Mês dedicado a cuidar da saúde mental e emocional: prestar atenção aos próprios sentimentos, falar sobre o que está difícil, buscar apoio quando precisar e cuidar da mente com o mesmo cuidado que se cuida do corpo.',
    frase: 'Cuidar da mente também é cuidar da vida.',
    arte: false,
  },
  {
    n: 2,
    mes: 'Fevereiro',
    camp: 'Fevereiro Roxo & Laranja',
    cor: '#7c3aed',
    stripGradient: 'linear-gradient(90deg, #7c3aed 50%, #ea580c 50%)',
    tema: 'Alzheimer, Lúpus e Fibromialgia (roxo) e Leucemia (laranja)',
    desc: 'Duas campanhas no mesmo mês: o roxo conscientiza sobre Alzheimer, Lúpus e Fibromialgia, e o laranja sobre a Leucemia. Informar é o primeiro passo para reconhecer sinais, buscar diagnóstico e apoiar quem convive com essas doenças.',
    frase: 'Conscientizar é o primeiro passo para vencer a Leucemia, Alzheimer, Lúpus e Fibromialgia.',
    imagem: '/campanhas/fevereiro-roxo-laranja.png',
    arte: true,
  },
  {
    n: 3,
    mes: 'Março',
    camp: 'Março Lilás',
    cor: '#8b7cc8',
    stripGradient: '#8b7cc8',
    tema: 'Prevenção ao câncer de colo uterino',
    desc: 'Mês de prevenção ao câncer de colo uterino: reforça a importância de manter os exames preventivos em dia, porque descobrir cedo aumenta muito as chances de tratamento e cura.',
    frase: 'Agende seu exame. Previna-se!',
    imagem: '/campanhas/marco-lilas.png',
    arte: true,
  },
  {
    n: 4,
    mes: 'Abril',
    camp: 'Abril Verde',
    cor: '#16a34a',
    stripGradient: '#16a34a',
    tema: 'Prevenção de acidentes de trabalho',
    desc: 'Mês de prevenção aos acidentes de trabalho e às doenças ocupacionais: usar os EPIs, seguir os procedimentos de segurança e cuidar de si e dos colegas, todos os dias, em todas as frentes de obra.',
    frase: 'Acidentes de trabalho podem ser evitados. Previna-se!',
    imagem: '/campanhas/abril-verde.png',
    arte: true,
  },
  {
    n: 5,
    mes: 'Maio',
    camp: 'Maio Amarelo',
    cor: '#ca8a04',
    stripGradient: '#eab308',
    tema: 'Prevenção de acidentes de trânsito',
    desc: 'Mês de prevenção de acidentes de trânsito: parar de usar o celular ao volante, ter atenção com pedestres e ciclistas e seguir as leis de trânsito — no trajeto para a obra e em qualquer deslocamento.',
    frase: 'Mês de prevenção de acidentes de trânsito.',
    imagem: '/campanhas/maio-amarelo.png',
    arte: true,
  },
  {
    n: 6,
    mes: 'Junho',
    camp: 'Junho Vermelho',
    cor: '#dc2626',
    stripGradient: '#dc2626',
    tema: 'Incentivo à doação de sangue',
    desc: 'Mês de incentivo à doação de sangue: um gesto simples que ajuda a salvar vidas e mantém os estoques dos hemocentros abastecidos para quem mais precisa.',
    frase: 'Um mês para espalhar esperança através da doação de sangue. Junte-se a nós e faça a diferença!',
    imagem: '/campanhas/junho-vermelho.png',
    arte: true,
  },
  {
    n: 7,
    mes: 'Julho',
    camp: 'Julho Verde',
    cor: '#15803d',
    stripGradient: '#22c55e',
    tema: 'Conscientização ao câncer de cabeça e pescoço',
    desc: 'Mês de conscientização ao câncer de cabeça e pescoço: estar atento aos sinais do corpo e procurar atendimento ao perceber alterações que não passam, porque a prevenção e o diagnóstico cedo fazem diferença.',
    frase: 'A saúde começa com a prevenção. Esteja atento aos sinais, cuide-se!',
    imagem: '/campanhas/julho-verde.png',
    arte: true,
  },
  {
    n: 8,
    mes: 'Agosto',
    camp: 'Agosto Dourado',
    cor: '#b45309',
    stripGradient: '#d97706',
    tema: 'Incentivo à amamentação',
    desc: 'Mês de incentivo à amamentação (aleitamento materno): valoriza o leite materno como alimento completo para o bebê e apoia as mães nesse momento tão importante.',
    frase: 'Amamentar é cuidar com amor!',
    imagem: '/campanhas/agosto-dourado.png',
    arte: true,
  },
  {
    n: 9,
    mes: 'Setembro',
    camp: 'Setembro Amarelo',
    cor: '#ca8a04',
    stripGradient: '#facc15',
    tema: 'Prevenção ao suicídio e valorização da vida',
    desc: 'Mês de prevenção ao suicídio: falar sobre o assunto sem tabu, acolher quem está passando por um momento difícil e lembrar que pedir ajuda é um ato de coragem — ninguém precisa enfrentar isso sozinho.',
    frase: 'Sua vida importa! Estamos juntos em prol da vida!',
    imagem: '/campanhas/setembro-amarelo.png',
    arte: true,
  },
  {
    n: 10,
    mes: 'Outubro',
    camp: 'Outubro Rosa',
    cor: '#db2777',
    stripGradient: '#ec4899',
    tema: 'Prevenção ao câncer de mama',
    desc: 'Mês de prevenção ao câncer de mama: reforça o autocuidado e a importância de fazer os exames preventivos regularmente, porque o diagnóstico precoce salva vidas.',
    frase: 'Amor próprio também é se cuidar. Faça seus exames preventivos, você é importante!',
    imagem: '/campanhas/outubro-rosa.png',
    arte: true,
  },
  {
    n: 11,
    mes: 'Novembro',
    camp: 'Novembro Azul',
    cor: '#1d4ed8',
    stripGradient: '#2563eb',
    tema: 'Prevenção ao câncer de próstata',
    desc: 'Mês de prevenção ao câncer de próstata e de cuidado com a saúde do homem: vencer o preconceito, manter as consultas e os exames em dia e procurar atendimento sem esperar os sintomas aparecerem.',
    frase: 'Mês de prevenção ao câncer de próstata.',
    imagem: '/campanhas/novembro-azul.png',
    arte: true,
  },
  {
    n: 12,
    mes: 'Dezembro',
    camp: 'Dezembro Vermelho',
    cor: '#991b1b',
    stripGradient: '#991b1b',
    tema: 'Prevenção ao HIV/Aids e às ISTs',
    desc: 'Mês de prevenção ao HIV/Aids e às infecções sexualmente transmissíveis (ISTs), marcado pelo laço vermelho da arte: prevenir-se, fazer o teste e combater o preconceito contra quem vive com HIV.',
    frase: 'Prevenção é o melhor cuidado!',
    imagem: '/campanhas/dezembro-vermelho.png',
    arte: true,
  },
]

export function getCampanhaAtual(): CampanhaData {
  const mesAtual = new Date().getMonth() + 1 // 1 a 12
  return CAMPANHAS_ANUAIS.find((c) => c.n === mesAtual) || CAMPANHAS_ANUAIS[0]
}

export function getCampanhaDoMes(n: number): CampanhaData | undefined {
  return CAMPANHAS_ANUAIS.find((c) => c.n === n)
}

