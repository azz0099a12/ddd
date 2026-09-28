const isAllowedPdfHost = hostname =>
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

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.status(405).json({error: 'Chỉ hỗ trợ GET.'});
    return;
  }

  try {
    const rawUrl = Array.isArray(request.query.url) ? request.query.url[0] : request.query.url;
    const target = new URL(rawUrl || '');

    if (target.protocol !== 'https:' || !isAllowedPdfHost(target.hostname)) {
      response.status(400).json({error: 'Chỉ hỗ trợ link PDF HTTPS từ TikTok hoặc Shopee.'});
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
      response
        .status(remoteResponse.status)
        .json({error: `Nguồn PDF trả về HTTP ${remoteResponse.status}.`});
      return;
    }

    const contentType = remoteResponse.headers.get('content-type') || 'application/pdf';
    const content = Buffer.from(await remoteResponse.arrayBuffer());

    response.setHeader('Content-Type', contentType);
    response.setHeader('Content-Length', String(content.length));
    response.setHeader('Cache-Control', 'no-store');
    response.status(200).send(content);
  } catch (error) {
    response.status(502).json({
      error: error instanceof Error ? error.message : 'Không tải được PDF.',
    });
  }
}