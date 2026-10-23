// Os textos em portugues, espanhol e ingles; usa a lingua do Chrome (ingles se for outra).
(() => {
  const L = {
    pt: {
      ligar: 'Ligar', pausar: 'Pausar', pausado: 'Pausado', comecando: 'Começando…', assistindo: 'Assistindo',
      procurando: 'Procurando uma live com drops…', trocando: 'Trocando de live…', reconectando: 'Reconectando…',
      login: 'Abra a Twitch e entre na sua conta', fim: 'Tudo pronto: todos os drops resgatados',
      resgatado: 'Resgatado', resgatando: 'Resgatando', de: 'de', nenhum: 'Nenhum drop ativo agora', jogos: 'Jogos', discord: 'Avisos no Discord', discordDica: 'Cole o webhook de um canal seu', salvo: 'Salvo', patrocinado: 'patrocinado',
      anterior: 'Resgate o drop anterior no inventário', steam: 'Conecte a Twitch à Steam pra receber:',
      discordPassos: 'No Discord: Editar canal → Integrações → Webhooks → Novo webhook → Copiar URL. Cole aqui:',
      repouso: 'Sem drops ativos: confiro de hora em hora', ativo: 'Drops ativos: confiro a cada 2 minutos',
      menuAjuda: 'Como funciona e privacidade', menuRegisto: 'Ver histórico', registoTit: 'Histórico',
      registoDesc: 'O que a extensão fez, guardado só neste Chrome (últimas 100 entradas).', limpar: 'Limpar', semEntradas: 'Ainda sem entradas.',
    },
    es: {
      ligar: 'Activar', pausar: 'Pausar', pausado: 'En pausa', comecando: 'Iniciando…', assistindo: 'Viendo',
      procurando: 'Buscando un directo con drops…', trocando: 'Cambiando de directo…', reconectando: 'Reconectando…',
      login: 'Abre Twitch e inicia sesión en tu cuenta', fim: 'Listo: todos los drops reclamados',
      resgatado: 'Reclamado', resgatando: 'Reclamando', de: 'de', nenhum: 'No hay drops activos ahora', jogos: 'Juegos', discord: 'Avisos en Discord', discordDica: 'Pega el webhook de un canal tuyo', salvo: 'Guardado', patrocinado: 'patrocinado',
      anterior: 'Reclama el drop anterior en el inventario', steam: 'Conecta Twitch con Steam para recibir:',
      discordPassos: 'En Discord: Editar canal → Integraciones → Webhooks → Nuevo webhook → Copiar URL. Pégala aquí:',
      repouso: 'Sin drops activos: reviso cada hora', ativo: 'Drops activos: reviso cada 2 minutos',
      menuAjuda: 'Cómo funciona y privacidad', menuRegisto: 'Ver historial', registoTit: 'Historial',
      registoDesc: 'Lo que hizo la extensión, guardado solo en este Chrome (últimas 100 entradas).', limpar: 'Borrar', semEntradas: 'Todavía no hay entradas.',
    },
    en: {
      ligar: 'Start', pausar: 'Pause', pausado: 'Paused', comecando: 'Starting…', assistindo: 'Watching',
      procurando: 'Looking for a live stream with drops…', trocando: 'Switching stream…', reconectando: 'Reconnecting…',
      login: 'Open Twitch and sign in to your account', fim: 'All done: every drop claimed',
      resgatado: 'Claimed', resgatando: 'Claiming', de: 'of', nenhum: 'No drops active right now', jogos: 'Games', discord: 'Discord alerts', discordDica: 'Paste a webhook from your own channel', salvo: 'Saved', patrocinado: 'sponsored',
      anterior: 'Claim the previous drop in your inventory', steam: 'Link Twitch to Steam to receive:',
      discordPassos: 'In Discord: Edit channel → Integrations → Webhooks → New webhook → Copy URL. Paste it here:',
      repouso: 'No active drops: checking every hour', ativo: 'Active drops: checking every 2 minutes',
      menuAjuda: 'How it works and privacy', menuRegisto: 'View history', registoTit: 'History',
      registoDesc: 'What the extension did, stored only in this Chrome (last 100 entries).', limpar: 'Clear', semEntradas: 'No entries yet.',
    },
  };
  const lingua = String((chrome.i18n && chrome.i18n.getUILanguage()) || 'en').slice(0, 2).toLowerCase();
  globalThis.T = L[lingua] || L.en;
  globalThis.NOME = chrome.i18n.getMessage('appName') || 'DropGo';
  // tempo em minutos -> "45m", "2h", "3h 20m"
  globalThis.tempo = m => { m = Math.max(0, Math.round(m)); const h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${h}h ${r}m` : `${h}h`) : `${r}m`; };
})();
