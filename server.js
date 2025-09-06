const express = require('express');
const cors = require('cors');
const axios = require('axios');
const NodeCache = require('node-cache');

const app = express();
const PORT = process.env.PORT || 3000;
const cache = new NodeCache({ stdTTL: 300 }); // Cache de 5 minutos

// Middlewares
app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Proxy PNCP funcionando!',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Rota principal de proxy para PNCP
app.get('/api/pncp/*', async (req, res) => {
  try {
    const path = req.path.replace('/api/pncp', '');
    const url = `https://pncp.gov.br/api/consulta${path}`;
    
    console.log('🔗 Proxy para:', url);
    console.log('📋 Query params:', req.query);

    // Verificar cache
    const cacheKey = `${path}-${JSON.stringify(req.query)}`;
    const cached = cache.get(cacheKey);
    
    if (cached) {
      console.log('⚡ Retornando do cache');
      return res.json(cached);
    }

    // Fazer requisição para PNCP
    const response = await axios.get(url, {
      params: req.query,
      timeout: 30000,
      headers: {
        'accept': 'application/json',
        'user-agent': 'PNCP-Proxy/1.0'
      }
    });

    // Cache da resposta
    cache.set(cacheKey, response.data);
    
    console.log('✅ Resposta recebida com sucesso');
    res.json(response.data);

  } catch (error) {
    console.error('❌ Erro no proxy:', error.message);
    
    if (error.response) {
      // Erro da API PNCP
      res.status(error.response.status).json({
        error: 'Erro na API PNCP',
        status: error.response.status,
        message: error.response.data
      });
    } else if (error.request) {
      // Timeout ou erro de rede
      res.status(504).json({
        error: 'Timeout na conexão com PNCP',
        message: 'A API do PNCP não respondeu em tempo hábil'
      });
    } else {
      // Erro interno
      res.status(500).json({
        error: 'Erro interno do proxy',
        message: error.message
      });
    }
  }
});

// Rota específica para licitações de veículos
app.get('/api/licitacoes-veiculos', async (req, res) => {
  try {
    const { dataInicial, dataFinal, pagina = 1, tamanhoPagina = 50 } = req.query;
    
    const params = new URLSearchParams({
      dataInicial: dataInicial || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0].replace(/-/g, ''),
      dataFinal: dataFinal || new Date().toISOString().split('T')[0].replace(/-/g, ''),
      pagina: pagina,
      tamanhoPagina: tamanhoPagina
    });

    const url = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?${params}`;
    console.log('🚗 Buscando licitações de veículos:', url);

    const response = await axios.get(url, {
      timeout: 30000,
      headers: {
        'accept': 'application/json',
        'user-agent': 'PNCP-Veiculos-Proxy/1.0'
      }
    });

    // Filtrar para veículos
    const palavrasChave = [
      'ônibus', 'micro-ônibus', 'van', 'ambulância', 'pick-up', 
      'veículo utilitário', 'frota', 'automóvel', 'caminhão', 
      'utilitário', 'transporte', 'locação de veículos'
    ];

    const licitacoesFiltradas = (response.data.data || []).filter(licitacao => {
      const objeto = licitacao.objetoCompra?.toLowerCase() || '';
      return palavrasChave.some(palavra => objeto.includes(palavra));
    });

    const resultado = {
      ...response.data,
      data: licitacoesFiltradas,
      totalFiltrado: licitacoesFiltradas.length,
      filtroAplicado: 'veículos'
    };

    res.json(resultado);

  } catch (error) {
    console.error('❌ Erro ao buscar licitações de veículos:', error.message);
    res.status(500).json({
      error: 'Erro ao buscar licitações',
      message: error.message
    });
  }
});

// Rota para buscar documentos específicos
app.get('/api/documentos/:idLicitacao', async (req, res) => {
  try {
    const { idLicitacao } = req.params;
    const url = `https://pncp.gov.br/api/consulta/v1/contratacoes/${idLicitacao}/documentos`;
    
    console.log('📄 Buscando documentos para:', idLicitacao);

    const response = await axios.get(url, {
      timeout: 30000,
      headers: {
        'accept': 'application/json'
      }
    });

    // Processar documentos
    const documentos = (response.data.data || []).map(doc => ({
      id: doc.id,
      nome: doc.nomeDocumento,
      tipo: doc.nomeDocumento?.toLowerCase().includes('edital') ? 'EDITAL' : 'ANEXO',
      urlDownload: `https://pncp.gov.br/api/consulta/v1/contratacoes/${idLicitacao}/documentos/${doc.id}/download`,
      dataPublicacao: doc.dataPublicacao,
      tamanho: doc.tamanhoArquivo
    }));

    res.json(documentos);

  } catch (error) {
    console.error('❌ Erro ao buscar documentos:', error.message);
    res.status(500).json({
      error: 'Erro ao buscar documentos',
      message: error.message
    });
  }
});

// Middleware de erro global
app.use((error, req, res, next) => {
  console.error('💥 Erro global:', error);
  res.status(500).json({
    error: 'Erro interno do servidor',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Contacte o administrador'
  });
});

// Rota 404
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint não encontrado',
    path: req.originalUrl,
    endpointsDisponiveis: [
      'GET /health',
      'GET /api/pncp/*',
      'GET /api/licitacoes-veiculos',
      'GET /api/documentos/:id'
    ]
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Proxy PNCP rodando na porta ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 PNCP Proxy: http://localhost:${PORT}/api/pncp/`);
  console.log(`🚗 Veículos: http://localhost:${PORT}/api/licitacoes-veiculos`);
});
