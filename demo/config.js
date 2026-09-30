// URL pública do Cloudflare Worker do assistente (usado só pela demonstração estática — o Worker guarda a
// chave da IA, nunca o navegador). Vazio = o botão de chat mostra "precisa de servidor". Depois de publicar
// o Worker (veja docs/ASSISTANT.md), cole a URL aqui e rode `npm run publish:demo` de novo.
export const ASSISTANT_WORKER_URL = '';
