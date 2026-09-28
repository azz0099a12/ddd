import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

const isAllowedPdfHost = (hostname: string) =>
  hostname === 'seller-vn.tiktok.com' ||
  hostname.endsWith('.tiktok.com') ||
  hostname.endsWith('.tiktokcdn.com') ||
  hostname === 'seller.shopee.vn' ||
  hostname === 'banhang.shopee.vn' ||
  hostname.endsWith('.shopee.vn') ||
  hostname.endsWith('.shopee.com') ||
  hostname.endsWith('.shopeemobile.com') ||
  hostname === 'spx.vn' ||
  hostname.endsWith('.spx.vn') ||
  hostname.endsWith('.susercontent.com');

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'local-pdf-proxy',
      configureServer(server) {
        server.middlewares.use('/api/fetch-pdf', async (request, response) => {
          try {
            const requestUrl = new URL(request.url || '', 'http://localhost');
            const target = new URL(requestUrl.searchParams.get('url') || '');
            if (target.protocol !== 'https:' || !isAllowedPdfHost(target.hostname)) {
              response.writeHead(400, {'Content-Type': 'application/json; charset=utf-8'});
              response.end(JSON.stringify({error: 'Chỉ hỗ trợ link PDF HTTPS từ TikTok hoặc Shopee.'}));
              return;
            }
            const remoteResponse = await fetch(target, {
              headers: {
                'User-Agent': 'Mozilla/5.0',
                Referer: `${target.protocol}//${target.hostname}/`,
                Accept: 'application/pdf,*/*',
              },
              redirect: 'follow',
            });
            if (!remoteResponse.ok) {
              response.writeHead(remoteResponse.status, {'Content-Type': 'application/json; charset=utf-8'});
              response.end(JSON.stringify({error: `Nguồn PDF trả về HTTP ${remoteResponse.status}.`}));
              return;
            }
            const content = Buffer.from(await remoteResponse.arrayBuffer());
            response.writeHead(200, {
              'Content-Type': remoteResponse.headers.get('content-type') || 'application/pdf',
              'Content-Length': String(content.length),
              'Cache-Control': 'no-store',
            });
            response.end(content);
          } catch (error) {
            response.writeHead(502, {'Content-Type': 'application/json; charset=utf-8'});
            response.end(JSON.stringify({
              error: error instanceof Error ? error.message : 'Không tải được PDF.',
            }));
          }
        });
      },
    },
  ],
});