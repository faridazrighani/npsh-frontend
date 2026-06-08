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

function withProxyHeaders(request, env) {
  const headers = new Headers(request.headers);
  headers.set('X-NPSH-Pages-Proxy', 'npsh-frontend');
  headers.set('X-Forwarded-Host', new URL(request.url).host);
  if (env.NPSH_API_PROXY_SECRET) {
    headers.set('X-NPSH-API-Proxy-Secret', env.NPSH_API_PROXY_SECRET);
  }
  return headers;
}

function staticContentType(pathname, currentType = '') {
  const cleanType = String(currentType || '').toLowerCase();
  if (cleanType.includes('charset=')) return currentType;
  if (cleanType.startsWith('text/')) return `${currentType}; charset=utf-8`;
  if (cleanType.includes('javascript') || cleanType.includes('json') || cleanType.includes('xml')) {
    return `${currentType}; charset=utf-8`;
  }
  if (/\.svg$/i.test(pathname)) return 'image/svg+xml; charset=utf-8';
  return currentType;
}

function withStaticHeaders(request, response) {
  const url = new URL(request.url);
  const headers = new Headers(response.headers);
  const contentType = staticContentType(url.pathname, headers.get('Content-Type') || '');
  if (contentType) headers.set('Content-Type', contentType);

  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.delete('Expires');
  headers.delete('X-Frame-Options');
  headers.delete('X-XSS-Protection');

  if (url.pathname === '/' || /\.html?$/i.test(url.pathname)) {
    headers.set('Content-Security-Policy', "frame-ancestors 'none'");
  }
  if (url.searchParams.has('v')) {
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (!headers.has('Cache-Control') || /must-revalidate/i.test(headers.get('Cache-Control') || '')) {
    headers.set('Cache-Control', 'no-cache');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
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
        headers: withProxyHeaders(request, env)
      });
      return api.fetch(proxiedRequest);
    }

    return withStaticHeaders(request, await env.ASSETS.fetch(request));
  }
};
