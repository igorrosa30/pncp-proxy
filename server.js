const http = require('http');
const https = require('https');
const url = require('url');

const PORT = process.env.PORT || 3000;

// Servidor HTTP simples
const server = http.createServer(async (req, res) => {
  // Configura CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      message: 'Servidor funcionando!',
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // Rota de proxy para PNCP
  if (req.url.startsWith('/api/')) {
    try {
      const parsedUrl = url.parse(req.url, true);
      const path = parsedUrl.pathname.replace('/api', '');
      
      // Constrói a URL do PNCP
      const pncpUrl = `https://pncp.gov.br/api/consulta${path}`;
      const queryParams = new URLSearchParams(parsedUrl.query).toString();
      const fullUrl = queryParams ? `${pncpUrl}?${queryParams}` : pncpUrl;

      console.log('🌐 Proxy para:', fullUrl);

      // Faz a requisição para o PNCP usando HTTPS nativo
      const proxyReq = https.get(fullUrl, (proxyRes) => {
        let data = '';

        proxyRes.on('data', (chunk) => {
          data += chunk;
        });

        proxyRes.on('end', () => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            data: JSON.parse(data),
            metadata: {
              timestamp: new Date().toISOString(),
              source: 'pncp.gov.br'
            }
          }));
        });
      });

      proxyReq.on('error', (error) => {
        console.error('❌ Erro no proxy:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Erro de conexão com PNCP',
          message: error.message
        }));
      });

      proxyReq.setTimeout(10000, () => {
        proxyReq.destroy();
        res.writeHead(504, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Timeout na conexão com PNCP'
        }));
      });

    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Erro interno do servidor',
        message: error.message
      }));
    }
    return;
  }

  // Rota padrão
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    message: '🚀 Proxy PNCP HTTP Nativo',
    endpoints: {
      health: '/health',
      proxy: '/api/*',
      example: '/api/v1/contratacoes/publicacao?dataInicial=20240101&dataFinal=20240131'
    }
  }));
});

// Inicia o servidor
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor HTTP rodando na porta ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 PNCP Proxy: http://localhost:${PORT}/api/`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔄 Encerrando servidor...');
  server.close(() => {
    process.exit(0);
  });
});
