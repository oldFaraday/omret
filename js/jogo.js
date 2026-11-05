/* ==========================================================================
   omret — termo, dueto e quarteto
   Regras: 1 palavra em 6 tentativas, 2 em 7, 4 em 9.
   Diário/livre: sem repetição até a biblioteca dar a volta.
   Prática: cada palavra pode voltar depois de 90 dias.
   ========================================================================== */

(() => {
  'use strict';

  const TAMANHO = 5;
  const CHAVE_ARMAZEM = 'omret.v1';
  const DIAS_PRATICA = 90;
  const MS_DIA = 24 * 60 * 60 * 1000;
  const EMOJI = { certa: '🟩', presente: '🟨', ausente: '⬛' };
  const PESO = { ausente: 1, presente: 2, certa: 3 };
  const ROTULO_ESTADO = {
    certa: 'posição certa',
    presente: 'existe em outra posição',
    ausente: 'não faz parte da palavra',
  };

  const MODOS = {
    termo: { nome: 'termo', tabuleiros: 1, tentativas: 6 },
    dueto: { nome: 'dueto', tabuleiros: 2, tentativas: 7 },
    quarteto: { nome: 'quarteto', tabuleiros: 4, tentativas: 9 },
  };

  const BIBLIOTECA = (window.OMRET_PALAVRAS || []).map(([com, sem, significado]) => ({
    com,
    sem,
    significado,
  }));
  const POR_PALAVRA = new Map(BIBLIOTECA.map((p) => [p.sem, p]));
  const DICIONARIO = new Set(BIBLIOTECA.map((p) => p.sem));

  const reduzirMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DURACAO_VIRAR = 440;
  const ATRASO_CELULA = 55;
  const ATRASO_TABULEIRO = 30;

  /* ------------------------------------------------------------------------
     Elementos
     ------------------------------------------------------------------------ */

  const el = {
    tabuleiros: document.getElementById('tabuleiros'),
    teclado: document.getElementById('teclado'),
    selo: document.getElementById('seloRodada'),
    status: document.getElementById('statusTexto'),
    btnModoPratica: document.getElementById('btnModoPratica'),
    btnDiario: document.getElementById('btnDiario'),
    btnVerResultado: document.getElementById('btnVerResultado'),
    btnNovo: document.getElementById('btnNovo'),
    btnAjuda: document.getElementById('btnAjuda'),
    btnEstatisticas: document.getElementById('btnEstatisticas'),
    btnTema: document.getElementById('btnTema'),
    btnBiblioteca: document.getElementById('btnBiblioteca'),
    btnCompartilhar: document.getElementById('btnCompartilhar'),
    btnBaixarImagem: document.getElementById('btnBaixarImagem'),
    btnNovoResultado: document.getElementById('btnNovoResultado'),
    placarPratica: document.getElementById('placarPratica'),
    aviso: document.getElementById('aviso'),
    dlgAjuda: document.getElementById('dlgAjuda'),
    dlgEstatisticas: document.getElementById('dlgEstatisticas'),
    dlgResultado: document.getElementById('dlgResultado'),
    dlgBiblioteca: document.getElementById('dlgBiblioteca'),
    dlgConfirmar: document.getElementById('dlgConfirmar'),
    confirmacaoMensagem: document.getElementById('confirmacaoMensagem'),
    btnConfirmarOk: document.getElementById('btnConfirmarOk'),
    btnConfirmarCancelar: document.getElementById('btnConfirmarCancelar'),
    buscaPalavra: document.getElementById('buscaPalavra'),
    listaPalavras: document.getElementById('listaPalavras'),
    contagemBiblioteca: document.getElementById('contagemBiblioteca'),
    bibliotecaVazia: document.getElementById('bibliotecaVazia'),
    tituloResultado: document.getElementById('tituloResultado'),
    resultadoResumo: document.getElementById('resultadoResumo'),
    resultadoPalavras: document.getElementById('resultadoPalavras'),
  };

  /* ------------------------------------------------------------------------
     Estado persistido
     ------------------------------------------------------------------------ */

  function estadoInicial() {
    return {
      modo: 'termo',
      tema: null,
      jogos: {},
      ativos: {},
      usadas: {},
      estatisticas: {},
      pratica: {},
      modoPratica: false,
    };
  }

  function carregarDados() {
    const base = estadoInicial();
    try {
      const texto = localStorage.getItem(CHAVE_ARMAZEM);
      if (!texto) return base;
      const salvo = JSON.parse(texto);
      if (!salvo || typeof salvo !== 'object') return base;

      return {
        modo: MODOS[salvo.modo] ? salvo.modo : 'termo',
        tema: salvo.tema === 'claro' || salvo.tema === 'escuro' ? salvo.tema : null,
        jogos: salvo.jogos && typeof salvo.jogos === 'object' ? salvo.jogos : {},
        ativos: salvo.ativos && typeof salvo.ativos === 'object' ? salvo.ativos : {},
        usadas: salvo.usadas && typeof salvo.usadas === 'object' ? salvo.usadas : {},
        estatisticas: salvo.estatisticas && typeof salvo.estatisticas === 'object' ? salvo.estatisticas : {},
        pratica: salvo.pratica && typeof salvo.pratica === 'object' && !Array.isArray(salvo.pratica) ? salvo.pratica : {},
        modoPratica: salvo.modoPratica === true,
      };
    } catch {
      return base;
    }
  }

  let dados = carregarDados();

  // Sincroniza o modo ativo com a preferência de prática salva.
  if (dados.modoPratica && dados.ativos[dados.modo] !== 'pratica') {
    dados.ativos[dados.modo] = 'pratica';
  }

  let palpiteAtual = '';
  let letraSelecionada = '';
  let cursorPos = 0;
  let bloqueado = false;
  let geracao = 0;
  let diaAtual = hoje();
  let avisoTimer = 0;

  function salvar() {
    try {
      localStorage.setItem(CHAVE_ARMAZEM, JSON.stringify(dados));
    } catch {
      /* armazenamento indisponível: o jogo continua, sem salvar */
    }
  }

  /* ------------------------------------------------------------------------
     Utilidades
     ------------------------------------------------------------------------ */

  function hoje() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function dataCurta(iso) {
    const partes = String(iso).split('-');
    if (partes.length !== 3) return iso;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }

  function normalizar(texto) {
    return String(texto)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ç/g, 'c')
      .replace(/Ç/g, 'C')
      .toLowerCase()
      .replace(/[^a-z]/g, '');
  }

  function hashTexto(texto) {
    let h = 2166136261;
    for (let i = 0; i < texto.length; i++) {
      h ^= texto.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function criarRng(semente) {
    let a = semente >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function embaralhar(lista, rng) {
    const copia = lista.slice();
    for (let i = copia.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia;
  }

  function descreverQtd(n) {
    if (n === 1) return 'uma palavra';
    if (n === 2) return 'duas palavras';
    return `${n} palavras`;
  }

  function avaliar(palpite, alvo) {
    const resultado = Array(TAMANHO).fill('ausente');
    const restantes = {};

    for (let i = 0; i < TAMANHO; i++) {
      if (palpite[i] === alvo[i]) {
        resultado[i] = 'certa';
      } else {
        restantes[alvo[i]] = (restantes[alvo[i]] || 0) + 1;
      }
    }

    for (let i = 0; i < TAMANHO; i++) {
      if (resultado[i] === 'certa') continue;
      const letra = palpite[i];
      if (restantes[letra] > 0) {
        resultado[i] = 'presente';
        restantes[letra] -= 1;
      }
    }

    return resultado;
  }

  function avisar(mensagem, duracao = 2400) {
    el.aviso.textContent = mensagem;
    el.aviso.classList.add('visivel');
    window.clearTimeout(avisoTimer);
    avisoTimer = window.setTimeout(() => el.aviso.classList.remove('visivel'), duracao);
  }

  /* ------------------------------------------------------------------------
     Sorteio das palavras
     ------------------------------------------------------------------------ */

  function obterPratica(modo) {
    const atual = dados.pratica[modo];
    const usos = {};

    if (atual && atual.usos && typeof atual.usos === 'object') {
      Object.entries(atual.usos).forEach(([palavra, quando]) => {
        const instante = Number(quando);
        if (typeof palavra === 'string' && Number.isFinite(instante)) {
          usos[palavra] = instante;
        }
      });
    }

    const pratica = {
      acertos: Math.max(0, Number(atual && atual.acertos) || 0),
      erros: Math.max(0, Number(atual && atual.erros) || 0),
      jogos: Math.max(0, Number(atual && atual.jogos) || 0),
      usos,
    };

    dados.pratica[modo] = pratica;
    return pratica;
  }

  function sortearPratica(modo) {
    const cfg = MODOS[modo];
    const pratica = obterPratica(modo);
    const agora = Date.now();
    const limite = agora - DIAS_PRATICA * MS_DIA;

    const liberadas = BIBLIOTECA.filter((p) => {
      const usadoEm = pratica.usos[p.sem];
      return !usadoEm || usadoEm <= limite;
    });

    let escolhidas;

    if (liberadas.length >= cfg.tabuleiros) {
      escolhidas = embaralhar(liberadas, Math.random).slice(0, cfg.tabuleiros);
    } else {
      // Caso extremo: todas as palavras foram usadas há menos de 90 dias.
      // Completa com as mais antigas, sem repetir dentro da mesma rodada.
      const liberadasSem = new Set(liberadas.map((p) => p.sem));
      const restantes = BIBLIOTECA
        .filter((p) => !liberadasSem.has(p.sem))
        .sort((a, b) => (pratica.usos[a.sem] || 0) - (pratica.usos[b.sem] || 0));

      escolhidas = liberadas.concat(restantes.slice(0, cfg.tabuleiros - liberadas.length));
    }

    const alvos = escolhidas.map((p) => p.sem);
    alvos.forEach((palavra) => {
      pratica.usos[palavra] = agora;
    });
    dados.pratica[modo] = pratica;

    return alvos;
  }

  function sortearAlvos(modo, tipo) {
    if (tipo === 'pratica') return sortearPratica(modo);

    const cfg = MODOS[modo];
    const usadas = new Set(
      (Array.isArray(dados.usadas[modo]) ? dados.usadas[modo] : []).filter((p) => typeof p === 'string'),
    );

    let disponiveis = BIBLIOTECA.filter((p) => !usadas.has(p.sem));
    if (disponiveis.length < cfg.tabuleiros) {
      // A biblioteca deu a volta: começa um novo ciclo, preservando as
      // palavras das rodadas que ainda estão guardadas nesta modalidade.
      const reservadas = new Set();
      Object.values(dados.jogos).forEach((jogo) => {
        if (jogo && jogo.modo === modo && jogo.tipo !== 'pratica' && Array.isArray(jogo.alvos)) {
          jogo.alvos.forEach((palavra) => reservadas.add(palavra));
        }
      });
      usadas.clear();
      reservadas.forEach((palavra) => usadas.add(palavra));
      disponiveis = BIBLIOTECA.filter((p) => !usadas.has(p.sem));
      if (disponiveis.length < cfg.tabuleiros) {
        usadas.clear();
        disponiveis = BIBLIOTECA.slice();
      }
    }

    const rng = tipo === 'diario' ? criarRng(hashTexto(`${hoje()}|${modo}`)) : Math.random;
    const escolhidos = embaralhar(disponiveis, rng)
      .slice(0, cfg.tabuleiros)
      .map((p) => p.sem);

    escolhidos.forEach((palavra) => usadas.add(palavra));
    dados.usadas[modo] = [...usadas];
    return escolhidos;
  }

  function criarJogo(modo, tipo) {
    return {
      modo,
      tipo,
      data: hoje(),
      criadoEm: Date.now(),
      alvos: sortearAlvos(modo, tipo),
      palpites: [],
      contabilizado: false,
    };
  }

  function jogoValido(jogo) {
    if (!jogo || !MODOS[jogo.modo]) return false;
    const cfg = MODOS[jogo.modo];
    if (!Array.isArray(jogo.alvos) || jogo.alvos.length !== cfg.tabuleiros) return false;
    if (new Set(jogo.alvos).size !== jogo.alvos.length) return false;
    if (!jogo.alvos.every((a) => typeof a === 'string' && DICIONARIO.has(a))) return false;
    if (!Array.isArray(jogo.palpites)) return false;

    return jogo.palpites.every((jogada) => (
      jogada
      && typeof jogada.palavra === 'string'
      && jogada.palavra.length === TAMANHO
      && Array.isArray(jogada.resultados)
      && jogada.resultados.length === cfg.tabuleiros
      && jogada.resultados.every((r) => Array.isArray(r) && r.length === TAMANHO)
    ));
  }

  function jogoAtual() {
    const modo = dados.modo;
    const ativo = dados.ativos[modo];
    const tipo = ativo === 'pratica' || ativo === 'livre' ? ativo : 'diario';
    const chave = `${modo}:${tipo}`;
    let jogo = dados.jogos[chave];

    if (tipo === 'diario') {
      if (!jogoValido(jogo) || jogo.modo !== modo || jogo.data !== hoje()) {
        jogo = criarJogo(modo, 'diario');
        dados.jogos[chave] = jogo;
        dados.ativos[modo] = 'diario';
        salvar();
      }
    } else if (tipo === 'pratica') {
      if (!jogoValido(jogo) || jogo.modo !== modo || jogo.tipo !== 'pratica') {
        jogo = criarJogo(modo, 'pratica');
        dados.jogos[chave] = jogo;
        salvar();
      } else if (statusJogo(jogo) !== 'jogando' && !el.dlgResultado.open) {
        // A prática não muda com o dia: a próxima rodada só é sorteada
        // quando a anterior termina e o resultado deixa de estar na tela.
        // Se a página foi recarregada antes da contagem, ela é feita aqui.
        if (!jogo.contabilizado) contabilizar(jogo, statusJogo(jogo) === 'ganhou');
        jogo = criarJogo(modo, 'pratica');
        dados.jogos[chave] = jogo;
        salvar();
      }
    } else if (!jogoValido(jogo) || jogo.modo !== modo || jogo.tipo !== 'livre') {
      // Compatibilidade com rodadas livres salvas pela versão anterior.
      jogo = criarJogo(modo, 'livre');
      dados.jogos[chave] = jogo;
      salvar();
    }

    return jogo;
  }

  function indiceResolucao(jogo, indice) {
    return jogo.palpites.findIndex((jogada) => jogada.palavra === jogo.alvos[indice]);
  }

  function statusJogo(jogo) {
    const cfg = MODOS[jogo.modo];
    if (jogo.alvos.every((_, i) => indiceResolucao(jogo, i) >= 0)) return 'ganhou';
    if (jogo.palpites.length >= cfg.tentativas) return 'perdeu';
    return 'jogando';
  }

  /* ------------------------------------------------------------------------
     Estatísticas
     ------------------------------------------------------------------------ */

  function obterEstatisticas(modo) {
    const cfg = MODOS[modo];
    const atual = dados.estatisticas[modo];
    const stats = {
      jogos: Number(atual && atual.jogos) || 0,
      vitorias: Number(atual && atual.vitorias) || 0,
      sequencia: Number(atual && atual.sequencia) || 0,
      recorde: Number(atual && atual.recorde) || 0,
      distribuicao: Array.from({ length: cfg.tentativas }, (_, i) => Number(atual && atual.distribuicao && atual.distribuicao[i]) || 0),
    };
    dados.estatisticas[modo] = stats;
    return stats;
  }

  function contabilizarPratica(jogo) {
    const pratica = obterPratica(jogo.modo);
    pratica.jogos += 1;

    jogo.alvos.forEach((_, indice) => {
      if (indiceResolucao(jogo, indice) >= 0) pratica.acertos += 1;
      else pratica.erros += 1;
    });

    dados.pratica[jogo.modo] = pratica;
  }

  function contabilizar(jogo, ganhou) {
    if (jogo.contabilizado) return;
    jogo.contabilizado = true;

    const stats = obterEstatisticas(jogo.modo);
    stats.jogos += 1;

    if (ganhou) {
      stats.vitorias += 1;
      stats.sequencia += 1;
      stats.recorde = Math.max(stats.recorde, stats.sequencia);
      const indice = jogo.palpites.length - 1;
      if (indice >= 0 && indice < stats.distribuicao.length) stats.distribuicao[indice] += 1;
    } else {
      stats.sequencia = 0;
    }

    dados.estatisticas[jogo.modo] = stats;

    if (jogo.tipo === 'pratica') contabilizarPratica(jogo);

    salvar();
  }

  function renderizarEstatisticas(modo) {
    const stats = obterEstatisticas(modo);
    document.getElementById('statsModo').textContent = modo;
    document.getElementById('statJogos').textContent = String(stats.jogos);
    document.getElementById('statVitorias').textContent = stats.jogos
      ? `${Math.round((stats.vitorias / stats.jogos) * 100)}%`
      : '0%';
    document.getElementById('statSequencia').textContent = String(stats.sequencia);
    document.getElementById('statRecorde').textContent = String(stats.recorde);

    const pratica = obterPratica(modo);
    document.getElementById('statPraticaAcertos').textContent = String(pratica.acertos);
    document.getElementById('statPraticaErros').textContent = String(pratica.erros);
    document.getElementById('statPraticaJogos').textContent = String(pratica.jogos);

    const container = document.getElementById('distribuicao');
    container.innerHTML = '';
    const maximo = Math.max(1, ...stats.distribuicao);

    stats.distribuicao.forEach((quantidade, indice) => {
      const linha = document.createElement('div');
      linha.className = 'dist-linha';

      const numero = document.createElement('span');
      numero.className = 'dist-num';
      numero.textContent = String(indice + 1);

      const barra = document.createElement('div');
      barra.className = 'dist-barra';

      const preenchida = document.createElement('div');
      preenchida.className = 'dist-preenchida';
      preenchida.textContent = String(quantidade);
      if (quantidade > 0) {
        preenchida.style.width = `${Math.max((quantidade / maximo) * 100, 8)}%`;
      } else {
        preenchida.classList.add('vazia');
        preenchida.style.width = '22px';
      }

      barra.appendChild(preenchida);
      linha.append(numero, barra);
      container.appendChild(linha);
    });
  }

  /* ------------------------------------------------------------------------
     Desenho do jogo
     ------------------------------------------------------------------------ */

  function criarTabuleiro(jogo, indice) {
    const cfg = MODOS[jogo.modo];
    const bloco = document.createElement('section');
    bloco.className = 'tabuleiro';
    bloco.dataset.indice = String(indice);

    if (jogo.alvos.length > 1) {
      const rotulo = document.createElement('span');
      rotulo.className = 'rotulo-tabuleiro';
      rotulo.textContent = `palavra ${indice + 1}`;
      bloco.appendChild(rotulo);
    }

    const grade = document.createElement('div');
    grade.className = 'grade';
    grade.setAttribute('role', 'grid');
    grade.setAttribute('aria-label', `Tabuleiro ${indice + 1} de ${jogo.alvos.length}`);
    const resolvidoEm = indiceResolucao(jogo, indice);

    for (let linha = 0; linha < cfg.tentativas; linha++) {
      const elementosLinha = document.createElement('div');
      elementosLinha.className = 'linha-tabuleiro';
      elementosLinha.setAttribute('role', 'row');

      for (let coluna = 0; coluna < TAMANHO; coluna++) {
        const celula = document.createElement('div');
        celula.className = 'celula';
        celula.setAttribute('role', 'gridcell');

        if (linha < jogo.palpites.length && (resolvidoEm < 0 || linha <= resolvidoEm)) {
          const jogada = jogo.palpites[linha];
          const estado = jogada.resultados[indice][coluna];
          celula.textContent = jogada.palavra[coluna];
          celula.dataset.estado = estado;
          celula.setAttribute('aria-label', `${jogada.palavra[coluna].toUpperCase()}: ${ROTULO_ESTADO[estado]}`);
        }

        elementosLinha.appendChild(celula);
      }

      grade.appendChild(elementosLinha);
    }

    bloco.appendChild(grade);
    return bloco;
  }

  function renderizarTudo() {
    const jogo = jogoAtual();
    geracao += 1;
    bloqueado = false;
    letraSelecionada = '';
    atualizarSelecaoTeclado();

    document.body.dataset.modo = jogo.modo;
    document.body.dataset.tipo = jogo.tipo;

    document.querySelectorAll('.modo').forEach((botao) => {
      botao.setAttribute('aria-selected', String(botao.dataset.modo === jogo.modo));
    });

    el.tabuleiros.dataset.tabuleiros = String(MODOS[jogo.modo].tabuleiros);
    el.tabuleiros.innerHTML = '';
    jogo.alvos.forEach((_, indice) => {
      el.tabuleiros.appendChild(criarTabuleiro(jogo, indice));
    });

    palpiteAtual = '';
    cursorPos = 0;
    atualizarTeclado(jogo);
    atualizarStatus(jogo);
    renderizarPalpiteAtual();
  }

  function atualizarStatus(jogo) {
    const cfg = MODOS[jogo.modo];
    const status = statusJogo(jogo);
    const qtd = descreverQtd(jogo.alvos.length);

    const rotulos = { diario: 'diário', pratica: 'prática', livre: 'livre' };
    el.selo.textContent = rotulos[jogo.tipo] || 'diário';

    if (jogo.tipo === 'diario') {
      el.selo.title = `Diário de ${dataCurta(jogo.data)}`;
    } else if (jogo.tipo === 'pratica') {
      el.selo.title = 'Modo prática · nova rodada a cada jogo concluído';
    } else {
      el.selo.title = 'Rodada livre';
    }

    if (jogo.tipo === 'pratica') {
      const pratica = obterPratica(jogo.modo);
      const total = pratica.acertos + pratica.erros;
      const pctAcertos = total ? Math.round((pratica.acertos / total) * 100) : 0;
      const pctErros = total ? Math.round((pratica.erros / total) * 100) : 0;

      el.placarPratica.hidden = false;
      document.getElementById('placarAcertos').style.width = `${pctAcertos}%`;
      document.getElementById('placarErros').style.width = `${pctErros}%`;
      document.getElementById('placarTexto').textContent = `${pratica.acertos} ${pratica.acertos === 1 ? 'acerto' : 'acertos'} · ${pratica.erros} ${pratica.erros === 1 ? 'erro' : 'erros'}`;
    } else {
      el.placarPratica.hidden = true;
      el.placarPratica.textContent = '';
    }

    if (status === 'jogando') {
      el.status.textContent = `${qtd} · ${jogo.palpites.length} de ${cfg.tentativas} tentativas`;
    } else if (status === 'ganhou') {
      el.status.textContent = `${qtd} · resolvido em ${jogo.palpites.length} de ${cfg.tentativas}`;
    } else {
      el.status.textContent = `${qtd} · não resolvido`;
    }

    el.btnDiario.hidden = jogo.tipo === 'diario';
    el.btnVerResultado.hidden = status === 'jogando';
  }

  function atualizarTeclado(jogo) {
    const estados = {};

    jogo.alvos.forEach((_, indiceTabuleiro) => {
      const resolvidoEm = indiceResolucao(jogo, indiceTabuleiro);
      const limite = resolvidoEm >= 0 ? resolvidoEm : jogo.palpites.length - 1;

      for (let i = 0; i <= limite; i++) {
        const jogada = jogo.palpites[i];
        for (let c = 0; c < TAMANHO; c++) {
          const letra = jogada.palavra[c];
          const estado = jogada.resultados[indiceTabuleiro][c];
          if (!estados[letra] || PESO[estado] > PESO[estados[letra]]) {
            estados[letra] = estado;
          }
        }
      }
    });

    el.teclado.querySelectorAll('.tecla[data-letra]').forEach((botao) => {
      const estado = estados[botao.dataset.letra];
      if (estado) botao.dataset.estado = estado;
      else delete botao.dataset.estado;
    });
  }

  function renderizarPalpiteAtual() {
    const jogo = jogoAtual();
    if (statusJogo(jogo) !== 'jogando') return;

    const numeroLinha = jogo.palpites.length;

    el.tabuleiros.querySelectorAll('.tabuleiro').forEach((bloco) => {
      const indice = Number(bloco.dataset.indice);
      if (indiceResolucao(jogo, indice) >= 0) return;

      const linhas = bloco.querySelectorAll('.grade .linha-tabuleiro');
      const linha = linhas[numeroLinha];
      if (!linha) return;

      for (let c = 0; c < TAMANHO; c++) {
        const celula = linha.children[c];
        const letra = palpiteAtual[c] || '';
        const vazia = letra === ' ' || letra === '';
        if (celula.textContent !== letra) celula.textContent = vazia ? '' : letra;
        celula.classList.toggle('preenchida', !vazia);
        celula.removeAttribute('data-estado');
      }
    });

    if (!palpiteAtual.trim()) {
      atualizarCursorVisual();
      return;
    }
    const coluna = cursorPos;

    el.tabuleiros.querySelectorAll('.tabuleiro').forEach((bloco) => {
      const indice = Number(bloco.dataset.indice);
      if (indiceResolucao(jogo, indice) >= 0) return;
      const linha = bloco.querySelectorAll('.grade .linha-tabuleiro')[numeroLinha];
      const celula = linha && linha.children[coluna];
      if (!celula) return;
      celula.classList.remove('pulso');
      void celula.offsetWidth;
      celula.classList.add('pulso');
      window.setTimeout(() => celula.classList.remove('pulso'), 150);
    });

    atualizarCursorVisual();
  }

  function atualizarCursorVisual() {
    const jogo = jogoAtual();
    if (statusJogo(jogo) !== 'jogando') return;

    const numeroLinha = jogo.palpites.length;

    el.tabuleiros.querySelectorAll('.celula.cursor').forEach((celula) => {
      celula.classList.remove('cursor');
    });

    el.tabuleiros.querySelectorAll('.tabuleiro').forEach((bloco) => {
      const indice = Number(bloco.dataset.indice);
      if (indiceResolucao(jogo, indice) >= 0) return;

      const linhas = bloco.querySelectorAll('.grade .linha-tabuleiro');
      const linha = linhas[numeroLinha];
      if (!linha) return;

      const celula = linha.children[cursorPos];
      if (celula) celula.classList.add('cursor');
    });
  }

  function tremerLinha() {
    const jogo = jogoAtual();
    const numeroLinha = jogo.palpites.length;

    el.tabuleiros.querySelectorAll('.tabuleiro').forEach((bloco) => {
      const indice = Number(bloco.dataset.indice);
      if (indiceResolucao(jogo, indice) >= 0) return;
      const linha = bloco.querySelectorAll('.grade .linha-tabuleiro')[numeroLinha];
      if (!linha) return;
      [...linha.children].forEach((celula) => {
        celula.classList.remove('tremer');
        void celula.offsetWidth;
        celula.classList.add('tremer');
      });
    });

    window.setTimeout(() => {
      el.tabuleiros.querySelectorAll('.celula.tremer').forEach((celula) => celula.classList.remove('tremer'));
    }, 450);
  }

  function revelarJogada(jogo, indiceJogada, resolvidosAntes) {
    const jogada = jogo.palpites[indiceJogada];
    if (!jogada) return;

    el.tabuleiros.querySelectorAll('.tabuleiro').forEach((bloco) => {
      const indice = Number(bloco.dataset.indice);
      if (resolvidosAntes[indice]) return;

      const linha = bloco.querySelectorAll('.grade .linha-tabuleiro')[indiceJogada];
      if (!linha) return;

      [...linha.children].forEach((celula, coluna) => {
        const estado = jogada.resultados[indice][coluna];
        celula.textContent = jogada.palavra[coluna];
        celula.dataset.estado = estado;
        celula.classList.add('preenchida', 'virar');
        celula.style.setProperty('--atraso', `${coluna * ATRASO_CELULA + indice * ATRASO_TABULEIRO}ms`);
        celula.setAttribute('aria-label', `${jogada.palavra[coluna].toUpperCase()}: ${ROTULO_ESTADO[estado]}`);
      });
    });
  }

  function marcarVitorias(jogo) {
    jogo.alvos.forEach((_, indice) => {
      const resolvidoEm = indiceResolucao(jogo, indice);
      if (resolvidoEm < 0) return;

      const bloco = el.tabuleiros.querySelector(`.tabuleiro[data-indice="${indice}"]`);
      const linha = bloco && bloco.querySelectorAll('.grade .linha-tabuleiro')[resolvidoEm];
      if (!linha) return;

      [...linha.children].forEach((celula, coluna) => {
        celula.classList.remove('virar');
        celula.style.setProperty('--atraso', `${coluna * 45}ms`);
        celula.classList.add('vitoria');
      });
    });
  }

  function duracaoRevelacao(jogo, resolvidosAntes) {
    if (reduzirMovimento) return 0;
    let maiorTabuleiro = 0;
    jogo.alvos.forEach((_, indice) => {
      if (!resolvidosAntes[indice]) maiorTabuleiro = Math.max(maiorTabuleiro, indice);
    });
    return DURACAO_VIRAR + 4 * ATRASO_CELULA + maiorTabuleiro * ATRASO_TABULEIRO + 90;
  }

  /* ------------------------------------------------------------------------
     Jogadas
     ------------------------------------------------------------------------ */

  function teclar(tecla) {
    if (bloqueado) return;
    if (document.querySelector('dialog[open]')) return;

    const jogo = jogoAtual();
    if (statusJogo(jogo) !== 'jogando') return;

    if (tecla === 'enter') {
      letraSelecionada = '';
      atualizarSelecaoTeclado();
      enviarPalpite();
      piscarTecla('enter');
      return;
    }

    if (tecla === 'apagar') {
      piscarTecla('apagar');
      if (palpiteAtual) {
        if (cursorPos > 0) {
          palpiteAtual = palpiteAtual.slice(0, cursorPos - 1) + palpiteAtual.slice(cursorPos);
          cursorPos -= 1;
        } else {
          palpiteAtual = palpiteAtual.slice(0, -1);
        }
        renderizarPalpiteAtual();
        letraSelecionada = palpiteAtual.slice(-1) || '';
        atualizarSelecaoTeclado();
        atualizarCursorVisual();
      } else {
        letraSelecionada = '';
        atualizarSelecaoTeclado();
      }
      return;
    }

    if (tecla === 'ArrowLeft') {
      cursorPos = Math.max(0, cursorPos - 1);
      atualizarCursorVisual();
      return;
    }

    if (tecla === 'ArrowRight') {
      cursorPos = Math.min(TAMANHO, cursorPos + 1);
      atualizarCursorVisual();
      return;
    }

    if (/^[a-z]$/.test(tecla)) {
      if (cursorPos < palpiteAtual.length) {
        // Substitui letra existente na posição do cursor.
        palpiteAtual = palpiteAtual.slice(0, cursorPos) + tecla + palpiteAtual.slice(cursorPos + 1);
        cursorPos = Math.min(cursorPos + 1, TAMANHO);
      } else if (palpiteAtual.length < TAMANHO) {
        // Preenche com placeholders até a posição do cursor, se necessário.
        while (palpiteAtual.length < cursorPos) {
          palpiteAtual += ' ';
        }
        palpiteAtual += tecla;
        cursorPos = Math.min(cursorPos + 1, TAMANHO);
      } else {
        // Palavra completa e cursor no final: não há onde inserir.
        return;
      }
      letraSelecionada = tecla;
      renderizarPalpiteAtual();
      piscarTecla(tecla);
      atualizarSelecaoTeclado();
      atualizarCursorVisual();
    }
  }

  function enviarPalpite() {
    if (bloqueado) return;

    const jogo = jogoAtual();
    if (statusJogo(jogo) !== 'jogando') return;

    if (palpiteAtual.length !== TAMANHO) {
      avisar('Complete as cinco letras.');
      tremerLinha();
      return;
    }

    if (palpiteAtual.includes(' ')) {
      avisar('Preencha todas as cinco letras.');
      tremerLinha();
      return;
    }

    if (!DICIONARIO.has(palpiteAtual)) {
      avisar('Essa palavra não está na biblioteca.');
      tremerLinha();
      return;
    }

    const palavra = palpiteAtual;
    const resolvidosAntes = jogo.alvos.map((_, indice) => indiceResolucao(jogo, indice) >= 0);
    const resultados = jogo.alvos.map((alvo) => avaliar(palavra, alvo));

    jogo.palpites.push({ palavra, resultados });
    palpiteAtual = '';
    cursorPos = 0;
    bloqueado = true;
    salvar();

    atualizarStatus(jogo);
    revelarJogada(jogo, jogo.palpites.length - 1, resolvidosAntes);

    const minhaGeracao = geracao;
    const espera = duracaoRevelacao(jogo, resolvidosAntes);

    window.setTimeout(() => {
      if (minhaGeracao !== geracao) return;

      atualizarTeclado(jogo);
      marcarVitorias(jogo);

      const status = statusJogo(jogo);
      bloqueado = false;

      if (status !== 'jogando') {
        contabilizar(jogo, status === 'ganhou');
        atualizarStatus(jogo);
        window.setTimeout(() => {
          if (minhaGeracao !== geracao) return;
          abrirResultado(jogo);
        }, reduzirMovimento ? 0 : 360);
      } else {
        renderizarPalpiteAtual();
      }
    }, espera);
  }

  /* ------------------------------------------------------------------------
     Resultado e compartilhamento
     ------------------------------------------------------------------------ */

  function abrirResultado(jogo) {
    const status = statusJogo(jogo);
    const ganhou = status === 'ganhou';
    const cfg = MODOS[jogo.modo];
    const origem = jogo.tipo === 'diario'
      ? `diário de ${dataCurta(jogo.data)}`
      : jogo.tipo === 'pratica' ? 'prática' : 'rodada livre';

    el.tituloResultado.textContent = ganhou ? 'Mandou bem!' : 'Quase lá';
    el.btnNovoResultado.textContent = jogo.tipo === 'pratica' ? 'Nova prática' : 'Nova rodada';
    const fimDaFrase = jogo.alvos.length === 1 ? 'A palavra era:' : 'As palavras eram:';
    el.resultadoResumo.textContent = ganhou
      ? `${jogo.modo} · ${origem} · resolvido em ${jogo.palpites.length} de ${cfg.tentativas} tentativas.`
      : `${jogo.modo} · ${origem} · não foi dessa vez. ${fimDaFrase}`;

    el.resultadoPalavras.innerHTML = '';

    jogo.alvos.forEach((alvo, indice) => {
      const venceu = indiceResolucao(jogo, indice) >= 0;
      const grupo = document.createElement('div');
      grupo.className = 'resultado-grupo';

      if (jogo.alvos.length > 1) {
        const rotulo = document.createElement('span');
        rotulo.className = 'resultado-rotulo';
        rotulo.textContent = `palavra ${indice + 1}`;
        grupo.appendChild(rotulo);
      }

      const linha = document.createElement('div');
      linha.className = 'resultado-linha';
      const completa = (POR_PALAVRA.get(alvo) && POR_PALAVRA.get(alvo).com) || alvo;

      [...completa].forEach((letra) => {
        const celula = document.createElement('span');
        celula.className = 'celula';
        celula.dataset.estado = venceu ? 'certa' : 'ausente';
        celula.textContent = letra;
        linha.appendChild(celula);
      });

      grupo.appendChild(linha);

      const info = POR_PALAVRA.get(alvo);
      if (info?.significado) {
        const significado = document.createElement('p');
        significado.className = 'resultado-significado';
        significado.textContent = info.significado;
        grupo.appendChild(significado);
      }

      el.resultadoPalavras.appendChild(grupo);
    });

    if (typeof el.dlgResultado.showModal === 'function') {
      el.dlgResultado.showModal();
    }
  }

  function textoCompartilhar(jogo) {
    const cfg = MODOS[jogo.modo];
    const ganhou = statusJogo(jogo) === 'ganhou';
    const linhas = [
      `omret · ${jogo.modo}${jogo.tipo === 'diario' ? ` · ${dataCurta(jogo.data)}` : jogo.tipo === 'pratica' ? ' · prática' : ' · livre'}`,
      ganhou
        ? `resolvido em ${jogo.palpites.length} de ${cfg.tentativas} tentativas`
        : `não resolvido em ${cfg.tentativas} tentativas`,
    ];

    jogo.alvos.forEach((_, indice) => {
      const resolvidoEm = indiceResolucao(jogo, indice);
      const limite = resolvidoEm >= 0 ? resolvidoEm : jogo.palpites.length - 1;
      linhas.push('');
      for (let i = 0; i <= limite; i++) {
        linhas.push(jogo.palpites[i].resultados[indice].map((estado) => EMOJI[estado]).join(''));
      }
    });

    return linhas.join('\n');
  }

  /* ------------------------------------------------------------------------
     Geração de imagem compartilhável (Canvas)
     ------------------------------------------------------------------------ */

  function lerCor(variavel, fallback) {
    const valor = getComputedStyle(document.documentElement)
      .getPropertyValue(variavel)
      .trim();
    return valor || fallback;
  }

  function corTextoCelula(estado) {
    return { certa: '#ffffff', presente: '#241c0c', ausente: '#ffffff' }[estado];
  }

  async function gerarImagemResultado(jogo) {
    const cfg = MODOS[jogo.modo];
    const ganhou = statusJogo(jogo) === 'ganhou';
    const escala = 2;
    const celula = 56 * escala;
    const gap = 8 * escala;
    const padding = 32 * escala;
    const espacoTabuleiro = 24 * escala;

    const cores = {
      fundo: lerCor('--fundo', '#f6f2e8'),
      texto: lerCor('--texto', '#201d18'),
      textoFraco: lerCor('--texto-fraco', '#746c5c'),
      acento: lerCor('--acento', '#0f6b55'),
      certa: lerCor('--certa', '#166534'),
      presente: lerCor('--presente', '#c2912b'),
      ausente: lerCor('--ausente', '#6f6859'),
    };

    const qtdPalavras = jogo.alvos.length;
    const nLinhas = jogo.palpites.length;

    const larguraGrid = celula * 5 + gap * 4;
    const largura = padding * 2 + larguraGrid;

    let altura = padding;
    altura += 48 * escala; // título omret
    altura += 10 * escala;
    altura += 20 * escala; // modo/data
    altura += 14 * escala;
    altura += 22 * escala; // status
    altura += 24 * escala;

    jogo.alvos.forEach((_, indice) => {
      altura += 20 * escala; // label "palavra N" (só se > 1)
      if (qtdPalavras > 1) altura += 8 * escala;
      altura += nLinhas * (celula + gap) - gap; // grid de células
      altura += 12 * escala;
      altura += 30 * escala; // palavra completa
      altura += 8 * escala;
      // significado estimado: 2 linhas
      const info = POR_PALAVRA.get(jogo.alvos[indice]);
      if (info?.significado) {
        altura += 2 * (16 * escala) + 4 * escala;
      }
      altura += espacoTabuleiro;
    });

    altura -= espacoTabuleiro;
    altura += padding;

    const canvas = document.createElement('canvas');
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext('2d');

    ctx.scale(escala, escala);
    const W = largura / escala;
    const P = padding / escala;
    const C = celula / escala;
    const G = gap / escala;

    // Fundo
    ctx.fillStyle = cores.fundo;
    ctx.fillRect(0, 0, W, altura / escala);

    let y = P;

    // Título omret
    ctx.fillStyle = cores.texto;
    ctx.font = 'bold 24px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText('omret', P, y + 24);
    y += 48;

    // Modo / data
    ctx.fillStyle = cores.textoFraco;
    ctx.font = '12px ' + getComputedStyle(document.documentElement).getPropertyValue('--fonte');
    const modoTexto = `${jogo.modo}${jogo.tipo === 'diario' ? ` · ${dataCurta(jogo.data)}` : jogo.tipo === 'pratica' ? ' · prática' : ' · livre'}`;
    ctx.fillText(modoTexto, P, y + 12);
    y += 20;

    y += 14;

    // Status
    const ganhouTexto = ganhou
      ? `resolvido em ${jogo.palpites.length} de ${cfg.tentativas} tentativas`
      : `não resolvido em ${cfg.tentativas} tentativas`;
    ctx.fillStyle = cores.acento;
    ctx.font = 'bold 16px ' + getComputedStyle(document.documentElement).getPropertyValue('--fonte');
    ctx.fillText(ganhouTexto, P, y + 16);
    y += 24;

    jogo.alvos.forEach((alvo, indice) => {
      const info = POR_PALAVRA.get(alvo);
      const completa = (info && info.com) || alvo;
      const venceu = indiceResolucao(jogo, indice) >= 0;

      if (qtdPalavras > 1) {
        ctx.fillStyle = cores.textoFraco;
        ctx.font = 'bold 10px ' + getComputedStyle(document.documentElement).getPropertyValue('--fonte');
        ctx.textAlign = 'left';
        ctx.fillText(`palavra ${indice + 1}`, P, y + 10);
        y += 20;
      }

      // Grid de células
      const limite = venceu ? indiceResolucao(jogo, indice) : jogo.palpites.length - 1;
      for (let linha = 0; linha <= limite; linha++) {
        const jogada = jogo.palpites[linha];
        for (let coluna = 0; coluna < 5; coluna++) {
          const estado = jogada.resultados[indice][coluna];
          const letra = jogada.palavra[coluna];
          const x = P + coluna * (C + G);
          const yy = y + linha * (C + G);
          ctx.fillStyle = cores[estado];
          ctx.beginPath();
          ctx.roundRect(x, yy, C, C, Math.max(5, C * 0.13));
          ctx.fill();
          ctx.fillStyle = corTextoCelula(estado);
          ctx.font = 'bold 20px ' + getComputedStyle(document.documentElement).getPropertyValue('--fonte');
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(letra.toUpperCase(), x + C / 2, yy + C / 2 + 1);
        }
      }

      y += nLinhas * (C + G) - G;
      y += 12;

      // Palavra completa
      ctx.fillStyle = venceu ? cores.certa : cores.textoFraco;
      ctx.font = 'bold 20px ' + getComputedStyle(document.documentElement).getPropertyValue('--fonte');
      ctx.textAlign = 'center';
      ctx.fillText(completa.toUpperCase(), W / 2, y + 20);
      y += 30;

      y += 8;

      // Significado
      if (info?.significado) {
        ctx.fillStyle = cores.textoFraco;
        ctx.font = '14px ' + getComputedStyle(document.documentElement).getPropertyValue('--fonte');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        // Quebra simples de linha
        const maximo = W - P * 2;
        const palavras = info.significado.split(' ');
        let linhaTexto = '';
        let linhasTexto = [];
        for (const palavra of palavras) {
          const teste = (linhaTexto + ' ' + palavra).trim();
          if (ctx.measureText(teste).width > maximo && linhaTexto !== '') {
            linhasTexto.push(linhaTexto);
            linhaTexto = palavra;
          } else {
            linhaTexto = teste;
          }
        }
        if (linhaTexto !== '') linhasTexto.push(linhaTexto);
        for (const l of linhasTexto) {
          ctx.fillText(l, W / 2, y);
          y += 16;
        }
        y += 4;
      }

      y += espacoTabuleiro / escala;
    });

    y -= espacoTabuleiro / escala;
    y += P;

    // Rodapé
    ctx.fillStyle = cores.textoFraco;
    ctx.font = '11px ' + getComputedStyle(document.documentElement).getPropertyValue('--fonte');
    ctx.textAlign = 'center';
    ctx.fillText('omret — descubra palavras de cinco letras', W / 2, y + 11);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    return blob;
  }

  async function baixarImagem(blob, nome) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nome;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function compartilhar() {
    const jogo = jogoAtual();
    try {
      const blob = await gerarImagemResultado(jogo);
      const dataCurtaFormatada = jogo.data.replace(/-/g, '');
      const nome = `omret-${jogo.modo}-${dataCurtaFormatada}.png`;

      if (navigator.share) {
        try {
          const arquivo = new File([blob], nome, { type: 'image/png' });
          await navigator.share({ files: [arquivo], title: 'Resultado omret' });
          avisar('Imagem compartilhada.');
          return;
        } catch {
          // compartilhamento direto indisponível: cai para download
        }
      }

      await baixarImagem(blob, nome);
      avisar('Imagem salva.');
    } catch {
      avisar('Não foi possível gerar a imagem.');
    }
  }

  async function copiarTexto(texto) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(texto);
    }

    return new Promise((resolve, reject) => {
      const area = document.createElement('textarea');
      area.value = texto;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.left = '-9999px';
      document.body.appendChild(area);
      area.select();
      try {
        if (document.execCommand('copy')) resolve();
        else reject(new Error('cópia indisponível'));
      } catch (erro) {
        reject(erro);
      } finally {
        area.remove();
      }
    });
  }

  async function compartilhar() {
    const jogo = jogoAtual();
    try {
      await copiarTexto(textoCompartilhar(jogo));
      const original = el.btnCompartilhar.textContent;
      el.btnCompartilhar.textContent = 'Copiado!';
      avisar('Resultado copiado.');
      window.setTimeout(() => {
        el.btnCompartilhar.textContent = original;
      }, 1600);
    } catch {
      avisar('Não foi possível copiar o resultado.');
    }
  }

  /* ------------------------------------------------------------------------
     Nova rodada / diário / modalidades
     ------------------------------------------------------------------------ */

  function confirmar(mensagem) {
    let resolvido = false;
    return new Promise((resolve) => {
      el.confirmacaoMensagem.textContent = mensagem;
      const finalizar = (ok) => {
        if (resolvido) return;
        resolvido = true;
        el.dlgConfirmar.close();
        resolve(ok);
      };
      const okOk = () => finalizar(true);
      const okCancelar = () => finalizar(false);
      el.btnConfirmarOk.addEventListener('click', okOk, { once: true });
      el.btnConfirmarCancelar.addEventListener('click', okCancelar, { once: true });
      el.dlgConfirmar.addEventListener('close', () => {
        if (!resolvido) finalizar(false);
      }, { once: true });
      el.dlgConfirmar.showModal();
    });
  }

  function entrarPratica() {
    const modo = dados.modo;
    if (dados.ativos[modo] === 'pratica') return;

    dados.ativos[modo] = 'pratica';
    salvar();
    renderizarTudo();
  }

  async function novaRodada() {
    const modo = dados.modo;
    const atual = jogoAtual();

    if (atual.tipo === 'pratica') {
      // Uma prática recém-sorteada e ainda vazia é a rodada que já está
      // em jogo; não vale a pena descartá-la.
      if (statusJogo(atual) === 'jogando' && atual.palpites.length === 0) {
        dados.ativos[modo] = 'pratica';
        salvar();
        fecharDialogos();
        renderizarTudo();
        return;
      }

      if (
        statusJogo(atual) === 'jogando'
        && !(await confirmar('Começar uma nova prática? A rodada atual será substituída.'))
      ) {
        return;
      }

      dados.jogos[`${modo}:pratica`] = criarJogo(modo, 'pratica');
      dados.ativos[modo] = 'pratica';
      salvar();

      fecharDialogos();
      renderizarTudo();
      avisar('Nova prática.');
      return;
    }

    entrarPratica();
    avisar('Modo prática iniciado.');
  }

  function voltarAoDiario() {
    dados.modoPratica = false;
    // Retorna todos os modos ao diário, não apenas o atual.
    Object.keys(MODOS).forEach((m) => {
      if (dados.ativos[m]) dados.ativos[m] = 'diario';
    });
    salvar();
    renderizarTudo();
    el.btnModoPratica.setAttribute('aria-checked', String(dados.modoPratica));
  }

  function trocarModo(modo) {
    if (!MODOS[modo] || modo === dados.modo) return;
    dados.modo = modo;
    if (dados.modoPratica) {
      dados.ativos[modo] = 'pratica';
    }
    salvar();
    renderizarTudo();
  }

  /* ------------------------------------------------------------------------
     Teclado
     ------------------------------------------------------------------------ */

  function construirTeclado() {
    const linhas = ['qwertyuiop', 'asdfghjkl'];
    const ultima = 'zxcvbnm';
    const container = document.createElement('div');
    container.className = 'teclado-linhas';

    const criarLetra = (letra) => {
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'tecla';
      botao.dataset.letra = letra;
      botao.textContent = letra;
      botao.setAttribute('aria-label', letra.toUpperCase());
      return botao;
    };

    linhas.forEach((linha) => {
      const div = document.createElement('div');
      div.className = 'tecla-linha';
      [...linha].forEach((letra) => div.appendChild(criarLetra(letra)));
      container.appendChild(div);
    });

    const ultimaLinha = document.createElement('div');
    ultimaLinha.className = 'tecla-linha';

    const enter = document.createElement('button');
    enter.type = 'button';
    enter.className = 'tecla especial';
    enter.dataset.acao = 'enter';
    enter.textContent = 'enter';
    enter.setAttribute('aria-label', 'Enviar palpite');

    const apagar = document.createElement('button');
    apagar.type = 'button';
    apagar.className = 'tecla especial';
    apagar.dataset.acao = 'apagar';
    apagar.textContent = '⌫';
    apagar.setAttribute('aria-label', 'Apagar letra');

    ultimaLinha.appendChild(enter);
    [...ultima].forEach((letra) => ultimaLinha.appendChild(criarLetra(letra)));
    ultimaLinha.appendChild(apagar);
    container.appendChild(ultimaLinha);

    el.teclado.appendChild(container);
  }

  function atualizarSelecaoTeclado() {
    el.teclado.querySelectorAll('.tecla[data-letra]').forEach((botao) => {
      if (letraSelecionada && botao.dataset.letra === letraSelecionada) {
        botao.classList.add('selecionada');
      } else {
        botao.classList.remove('selecionada');
      }
    });
  }

  function piscarTecla(tecla) {
    const seletor = /^[a-z]$/.test(tecla)
      ? `.tecla[data-letra="${tecla}"]`
      : `.tecla[data-acao="${tecla}"]`;
    const botao = el.teclado.querySelector(seletor);
    if (!botao) return;
    botao.classList.add('ativa');
    window.setTimeout(() => botao.classList.remove('ativa'), 100);
  }

  /* ------------------------------------------------------------------------
     Biblioteca de palavras
     ------------------------------------------------------------------------ */

  function montarBiblioteca() {
    const fragmento = document.createDocumentFragment();

    BIBLIOTECA.forEach(({ com, sem }) => {
      const item = document.createElement('li');
      item.textContent = com;
      item.dataset.busca = sem;
      fragmento.appendChild(item);
    });

    el.listaPalavras.appendChild(fragmento);
    el.contagemBiblioteca.textContent = `${BIBLIOTECA.length} palavras de cinco letras.`;
    el.btnBiblioteca.textContent = `Ver as ${BIBLIOTECA.length} palavras aceitas`;
  }

  function filtrarBiblioteca() {
    const termo = normalizar(el.buscaPalavra.value);
    let visiveis = 0;

    [...el.listaPalavras.children].forEach((item) => {
      const combina = !termo || item.dataset.busca.includes(termo);
      item.hidden = !combina;
      if (combina) visiveis += 1;
    });

    el.contagemBiblioteca.textContent = termo
      ? `${visiveis} de ${BIBLIOTECA.length} palavras.`
      : `${BIBLIOTECA.length} palavras de cinco letras.`;

    el.bibliotecaVazia.hidden = visiveis !== 0 || !termo;
  }

  function abrirBiblioteca() {
    if (!el.listaPalavras.children.length) montarBiblioteca();
    el.buscaPalavra.value = '';
    filtrarBiblioteca();
    if (el.dlgAjuda.open) el.dlgAjuda.close();
    el.dlgBiblioteca.showModal();
    window.setTimeout(() => el.buscaPalavra.focus(), 40);
  }

  /* ------------------------------------------------------------------------
     Tema e diálogos
     ------------------------------------------------------------------------ */

  function aplicarTema(tema) {
    document.documentElement.dataset.tema = tema;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', tema === 'escuro' ? '#14120f' : '#f6f2e8');
  }

  function temaInicial() {
    if (dados.tema) return dados.tema;
    if (document.documentElement.dataset.tema) return document.documentElement.dataset.tema;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro';
  }

  function alternarTema() {
    const atual = document.documentElement.dataset.tema === 'escuro' ? 'escuro' : 'claro';
    const novo = atual === 'escuro' ? 'claro' : 'escuro';
    dados.tema = novo;
    aplicarTema(novo);
    salvar();
  }

  function fecharDialogos() {
    document.querySelectorAll('dialog[open]').forEach((dialogo) => dialogo.close());
  }

  function verificarDia() {
    const agora = hoje();
    if (agora === diaAtual) return;
    diaAtual = agora;

    if (dados.ativos[dados.modo] !== 'pratica' && dados.ativos[dados.modo] !== 'livre') {
      renderizarTudo();
    }
  }

  /* ------------------------------------------------------------------------
     Eventos
     ------------------------------------------------------------------------ */

  function ligarEventos() {
    document.querySelectorAll('.modo').forEach((botao) => {
      botao.addEventListener('click', () => trocarModo(botao.dataset.modo));
    });

    el.btnNovo.addEventListener('click', novaRodada);
    el.btnModoPratica.addEventListener('click', () => {
      const novoEstado = !dados.modoPratica;
      dados.modoPratica = novoEstado;
      el.btnModoPratica.setAttribute('aria-checked', String(novoEstado));
      salvar();

      if (novoEstado) {
        entrarPratica();
        avisar('Modo prática ativado.');
      } else {
        voltarAoDiario();
        avisar('Modo prática desativado.');
      }
    });
    el.btnDiario.addEventListener('click', voltarAoDiario);
    el.btnVerResultado.addEventListener('click', () => abrirResultado(jogoAtual()));
    el.btnAjuda.addEventListener('click', () => el.dlgAjuda.showModal());
    el.btnTema.addEventListener('click', alternarTema);
    el.btnBiblioteca.addEventListener('click', abrirBiblioteca);
    el.btnCompartilhar.addEventListener('click', compartilhar);
    el.btnBaixarImagem.addEventListener('click', () => compartilhar());

    el.btnNovoResultado.addEventListener('click', () => {
      const eraPratica = jogoAtual().tipo === 'pratica';
      fecharDialogos();

      if (eraPratica) {
        const jogo = dados.jogos[`${dados.modo}:pratica`];
        if (jogo && statusJogo(jogo) !== 'jogando') renderizarTudo();
      } else {
        novaRodada();
      }
    });

    el.btnEstatisticas.addEventListener('click', () => {
      renderizarEstatisticas(jogoAtual().modo);
      el.dlgEstatisticas.showModal();
    });

    el.teclado.addEventListener('click', (evento) => {
      const botao = evento.target.closest('.tecla');
      if (!botao) return;
      if (botao.dataset.acao === 'enter') teclar('enter');
      else if (botao.dataset.acao === 'apagar') teclar('apagar');
      else if (botao.dataset.letra) teclar(botao.dataset.letra);
    });

    el.buscaPalavra.addEventListener('input', filtrarBiblioteca);

    document.querySelectorAll('[data-fechar]').forEach((botao) => {
      botao.addEventListener('click', () => {
        const dialogo = botao.closest('dialog');
        if (dialogo) dialogo.close();
      });
    });

    document.querySelectorAll('dialog').forEach((dialogo) => {
      dialogo.addEventListener('click', (evento) => {
        if (evento.target === dialogo) dialogo.close();
      });

      dialogo.addEventListener('close', () => {
        // Devolve o foco ao jogo depois de fechar um modal, para que o
        // teclado físico continue funcionando sem ativar o botão de origem.
        window.setTimeout(() => {
          if (document.activeElement instanceof HTMLElement) document.activeElement.blur();

          // Ao fechar o resultado de uma prática concluída, a próxima
          // rodada é sorteada e o tabuleiro novo aparece.
          if (dialogo === el.dlgResultado && dados.ativos[dados.modo] === 'pratica') {
            const jogo = dados.jogos[`${dados.modo}:pratica`];
            if (jogo && statusJogo(jogo) !== 'jogando') renderizarTudo();
          }
        }, 0);
      });
    });

    el.tabuleiros.addEventListener('click', (evento) => {
      const celula = evento.target.closest('.celula');
      if (!celula) return;

      const linha = celula.parentElement;
      const tabuleiro = linha.closest('.tabuleiro');
      if (!linha || !tabuleiro) return;

      const indiceLinha = [...linha.parentElement.children].indexOf(linha);
      const indiceColuna = [...linha.children].indexOf(celula);
      const jogo = jogoAtual();
      if (statusJogo(jogo) !== 'jogando') return;
      if (indiceLinha !== jogo.palpites.length) return;

      cursorPos = indiceColuna;
      atualizarCursorVisual();
    });

    // Cliques com mouse/toque não devem deixar o foco preso em um botão:
    // senão o Enter seguinte ativaria o botão em vez de enviar o palpite.
    document.addEventListener('click', (evento) => {
      if (evento.detail <= 0) return;
      if (document.querySelector('dialog[open]')) return;
      const ativo = document.activeElement;
      if (ativo instanceof HTMLElement && ativo.tagName === 'BUTTON') ativo.blur();
    });

    document.addEventListener('keydown', (evento) => {
      if (evento.ctrlKey || evento.metaKey || evento.altKey) return;
      if (document.querySelector('dialog[open]')) return;

      const alvo = evento.target;
      if (alvo instanceof HTMLElement && alvo.closest('input, textarea, select, [contenteditable="true"]')) return;

      // Enter em um botão/link com foco deve ativar o próprio controle.
      if (evento.key === 'Enter' && alvo instanceof HTMLElement && alvo.closest('button, a')) return;

      if (evento.key === 'Enter') {
        evento.preventDefault();
        teclar('enter');
      } else if (evento.key === 'Backspace') {
        evento.preventDefault();
        teclar('apagar');
      } else if (evento.key === 'ArrowLeft' || evento.key === 'ArrowRight') {
        evento.preventDefault();
        teclar(evento.key);
      } else if (evento.key.length === 1) {
        const letra = normalizar(evento.key);
        if (letra.length === 1) {
          evento.preventDefault();
          teclar(letra);
        }
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) verificarDia();
    });

    window.setInterval(verificarDia, 60000);
  }

  /* ------------------------------------------------------------------------
     Início
     ------------------------------------------------------------------------ */

  function iniciar() {
    if (!BIBLIOTECA.length) {
      avisar('Não foi possível carregar a biblioteca de palavras.', 6000);
      return;
    }

    aplicarTema(temaInicial());
    construirTeclado();
    ligarEventos();
    el.btnModoPratica.setAttribute('aria-checked', String(dados.modoPratica === true));
    montarBiblioteca();
    renderizarTudo();
    diaAtual = hoje();
  }

  iniciar();
})();
