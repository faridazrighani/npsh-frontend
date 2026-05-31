const API_BINDING_NAME = 'NPSH_API';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer'
    }
  });
}

function withProxyHeaders(request) {
  const headers = new Headers(request.headers);
  headers.set('X-NPSH-Pages-Proxy', 'npsh-frontend');
  headers.set('X-Forwarded-Host', new URL(request.url).host);
  return headers;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      const api = env[API_BINDING_NAME];
      if (!api || typeof api.fetch !== 'function') {
        return jsonResponse({
          ok: false,
          error: 'missing_service_binding',
          message: 'Cloudflare Pages must bind NPSH_API to the npsh-api Worker before /api/* can be served.',
          requiredBinding: API_BINDING_NAME
        }, 503);
      }

      const proxiedRequest = new Request(request, {
        headers: withProxyHeaders(request)
      });
      return api.fetch(proxiedRequest);
    }

    return env.ASSETS.fetch(request);
  }
};
