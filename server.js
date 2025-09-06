const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware básico
app.use(express.json());

// Health Check - SIMPLES
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Proxy funcionando!' });
});

// Proxy DIRETO para PNCP
app.get('/api/pncp/*', async (req, res) => {
  try {
    const path = req.path.replace('/api/pncp', '');
    const url = `https://pncp.gov.br/api/consulta${path}`;
    
    console.log('🔗 Proxy para:', url);
    
    const response = await axios.get(url, {
      params: req.query,
      timeout: 10000
    });
    
    res.json({
      success: true,
      data: response.data
    });
    
  } catch (error) {
    console.error('Erro:', error.message);
    res.json({
      success: false,
      error: 'Falha na conexão'
    });
  }
});

// Rota ESPECÍFICA para contratações
app.get('/api/contratacoes', async (req, res) => {
  try {
    const response = await axios.get('https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao', {
      params: req.query,
      timeout: 15000
    });
    
    res.json({
      success: true,
      data: response.data
    });
    
  } catch (error) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
});