const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Health check - ESSENCIAL para o Render
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'PNCP Proxy está funcionando!',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Rota principal do proxy
app.get('/api/pncp/*', async (req, res) => {
  try {
    // Extrai o path da URL original
    const originalPath = req.path.replace('/api/pncp', '');
    
    // Constrói a URL para o PNCP
    const url = new URL(`https://pncp.gov.br/api/consulta${originalPath}`);
    
    // Adiciona todos os query parameters
    Object.keys(req.query).forEach(key => {
      url.searchParams.append(key, req.query[key]);
    });

    console.log('🔗 Proxy para:', url.toString());

    // Faz a requisição para o PNCP
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'accept': '*/*',
        'user-agent': 'PNCP-Proxy/1.0',
        'cache-control': 'no-cache'
      },
      timeout: 30000
    });

    // Verifica o status da resposta
    if (!response.ok) {
      return res.status(200).json({
        success: false,
        error: `PNCP retornou erro ${response.status}`,
        status: response.status,
        url: url.toString()
      });
    }

    // Processa a resposta
    const data = await response.json();
    
    res.json({
      success: true,
      data: data,
      metadata: {
        timestamp: new Date().toISOString(),
        source: 'pncp.gov.br'
      }
    });

  } catch (error) {
    console.error('❌ Erro no proxy:', error);
    
    res.status(200).json({
      success: false,
      error: 'Erro no servidor proxy',
      message: error.message,
      suggestion: 'Tente novamente em alguns instantes'
    });
  }
});

// Rota de exemplo para testar
app.get('/api/exemplo', async (req, res) => {
  try {
    // Exemplo de consulta simples
    const response = await fetch('https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?dataInicial=20240101&dataFinal=20240101&pagina=1', {
      headers: { 'accept': '*/*' },
      timeout: 10000
    });

    const data = await response.json();
    
    res.json({
      success: true,
      message: 'Conexão com PNCP testada com sucesso!',
      data: data
    });

  } catch (error) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Rota padrão
app.get('/', (req, res) => {
  res.json({
    message: 'Bem-vindo ao Proxy PNCP!',
    endpoints: {
      health: '/health',
      proxy: '/api/pncp/*',
      exemplo: '/api/exemplo',
      documentation: 'https://pncp.gov.br/api/consulta/swagger-ui/index.html'
    },
    usage: 'Use /api/pncp/v1/contratacoes/publicacao?dataInicial=20240101&dataFinal=20241231&pagina=1'
  });
});

// Inicia o servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Proxy PNCP rodando na porta ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 PNCP Proxy: http://localhost:${PORT}/api/pncp/`);
});

// Manipulação de erros não capturados
process.on('unhandledRejection', (err) => {
  console.error('❌ Erro não tratado:', err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Exceção não capturada:', err);
  process.exit(1);
});
