import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import {PDFDocument, degrees} from 'pdf-lib';
import {
  Download,
  FileText,
  ImagePlus,
  Link as LinkIcon,
  Loader2,
  Move,
  RotateCcw,
  Save,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface StickerOverlay {
  id: string;
  name: string;
  dataUrl: string;
  mimeType: string;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  opacity: number;
  rotation: number;
}

type DragMode = 'move' | 'resize' | 'rotate';
type PrintMode = 'original' | 'a5-shopee';

interface DragState {
  id: string;
  mode: DragMode;
  startX: number;
  startY: number;
  original: StickerOverlay;
}

const STORAGE_KEY = 'WEB_STICKER_OVERLAYS';
const PRINT_MODE_STORAGE_KEY = 'WEB_PRINT_MODE';
const A5_PAGE = {
  width: 419.53,
  height: 595.28,
  margin: 18,
  stickerBandHeight: 154,
};

const dataUrlToUint8Array = (dataUrl: string) => {
  const base64 = dataUrl.split(',')[1] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const getPdfName = (fileName: string) =>
  fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`;

const extractPdfUrlFromInput = (input: string) => {
  const trimmed = input.trim();
  const urlMatches = trimmed.match(/https?:\/\/[^\s<>()\[\]]+/gi) || [];
  return (urlMatches.at(-1) || trimmed).replace(/[),.;]+$/g, '');
};

const isProxyPdfHost = (hostname: string) =>
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

const readImageAsSticker = (file: File, index: number, existingCount: number) =>
  new Promise<StickerOverlay>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const order = existingCount + index;
      resolve({
        id: `${Date.now()}_${index}_${file.name}`,
        name: file.name,
        dataUrl: String(reader.result),
        mimeType: file.type,
        xPercent: order % 2 === 0 ? 5 : 52,
        yPercent: 4 + Math.floor(order / 2) * 15,
        widthPercent: existingCount === 0 && index === 0 ? 88 : 40,
        opacity: 1,
        rotation: 0,
      });
    };
    reader.onerror = () => reject(new Error(`Không đọc được ảnh ${file.name}.`));
    reader.readAsDataURL(file);
  });

function StickerWebApp() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [stickers, setStickers] = useState<StickerOverlay[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  });
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [pdfLink, setPdfLink] = useState('');
  const [printMode, setPrintMode] = useState<PrintMode>(() => {
    const saved = localStorage.getItem(PRINT_MODE_STORAGE_KEY);
    return saved === 'a5-shopee' ? 'a5-shopee' : 'original';
  });
  const [status, setStatus] = useState('Sẵn sàng xử lý phiếu giao hàng.');
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const stickerInputRef = useRef<HTMLInputElement>(null);

  const selectedSticker = useMemo(
    () => stickers.find(sticker => sticker.id === selectedStickerId) || null,
    [selectedStickerId, stickers],
  );

  const updateSticker = useCallback((id: string, updates: Partial<StickerOverlay>) => {
    setStickers(current =>
      current.map(sticker => (sticker.id === id ? {...sticker, ...updates} : sticker)),
    );
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stickers));
  }, [stickers]);

  useEffect(() => {
    localStorage.setItem(PRINT_MODE_STORAGE_KEY, printMode);
  }, [printMode]);

  useEffect(() => {
    if (!dragState) return;

    const handleMove = (event: PointerEvent) => {
      const deltaX = event.clientX - dragState.startX;
      const deltaY = event.clientY - dragState.startY;
      const original = dragState.original;

      if (dragState.mode === 'move') {
        updateSticker(dragState.id, {
          xPercent: Math.min(100, Math.max(0, Number((original.xPercent + deltaX * 0.28).toFixed(1)))),
          yPercent: Math.min(100, Math.max(0, Number((original.yPercent - deltaY * 0.2).toFixed(1)))),
        });
        return;
      }

      if (dragState.mode === 'resize') {
        updateSticker(dragState.id, {
          widthPercent: Math.min(110, Math.max(6, Number((original.widthPercent + deltaX * 0.25).toFixed(1)))),
        });
        return;
      }

      updateSticker(dragState.id, {
        rotation: Math.max(-180, Math.min(180, Math.round((original.rotation || 0) + deltaX * 0.7))),
      });
    };

    const handleUp = () => setDragState(null);
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [dragState, updateSticker]);

  const renderFirstPdfPage = useCallback(async (bytes: ArrayBuffer) => {
    const task = pdfjsLib.getDocument({data: bytes.slice(0)});
    const pdf = await task.promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({scale: 1.8});
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Trình duyệt không tạo được khung xem trước PDF.');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({canvasContext: context, viewport}).promise;
    setPdfPageCount(pdf.numPages);
    setPreviewUrl(previous => {
      if (previous) URL.revokeObjectURL(previous);
      return canvas.toDataURL('image/png');
    });
  }, []);

  const loadPdfFile = useCallback(async (file: File) => {
    if (file.size > 120 * 1024 * 1024) {
      setError('File PDF không được vượt quá 120MB.');
      return;
    }

    setIsBusy(true);
    setError(null);
    setStatus('Đang nạp phiếu giao hàng...');
    try {
      const bytes = await file.arrayBuffer();
      await renderFirstPdfPage(bytes);
      setPdfFile(file);
      setPdfBytes(bytes);
      setStatus(`Đã nạp ${file.name}.`);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không đọc được file PDF.');
      setPdfFile(null);
      setPdfBytes(null);
      setPreviewUrl(null);
      setPdfPageCount(0);
    } finally {
      setIsBusy(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  }, [renderFirstPdfPage]);

  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) await loadPdfFile(file);
  };

  const loadPdfFromLink = async () => {
    const rawLink = extractPdfUrlFromInput(pdfLink);
    if (!rawLink) {
      setError('Vui lòng dán link PDF phiếu giao hàng.');
      return;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawLink);
    } catch {
      setError('Link PDF không hợp lệ.');
      return;
    }

    setIsBusy(true);
    setError(null);
    setStatus('Đang tải PDF từ link...');
    try {
      const shouldUseProxy = isProxyPdfHost(parsedUrl.hostname);
      const requestUrl = shouldUseProxy
        ? `/api/fetch-pdf?url=${encodeURIComponent(parsedUrl.toString())}`
        : parsedUrl.toString();
      const response = await fetch(requestUrl, shouldUseProxy ? undefined : {mode: 'cors'});
      if (!response.ok) throw new Error(`Máy chủ trả về HTTP ${response.status}.`);
      const blob = await response.blob();
      const nameFromUrl = decodeURIComponent(parsedUrl.pathname.split('/').pop() || 'phieu-giao-hang.pdf');
      await loadPdfFile(new File([blob], getPdfName(nameFromUrl), {type: 'application/pdf'}));
    } catch (linkError) {
      setError(
        linkError instanceof Error
          ? `Không tải được PDF: ${linkError.message}`
          : 'Không tải được PDF từ link.',
      );
      setStatus('Không tải được PDF từ link.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleStickerUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const supportedFiles = files.filter(file =>
      file.type === 'image/png' || file.type === 'image/jpeg' || file.type === 'image/jpg',
    );
    if (supportedFiles.length !== files.length) {
      setError('Chỉ hỗ trợ sticker PNG hoặc JPG.');
    }

    try {
      const nextStickers = await Promise.all(
        supportedFiles.map((file, index) => readImageAsSticker(file, index, stickers.length)),
      );
      setStickers(current => [...current, ...nextStickers]);
      setSelectedStickerId(nextStickers[0]?.id || selectedStickerId);
      setStatus(`Đã thêm ${nextStickers.length} sticker.`);
    } catch (stickerError) {
      setError(stickerError instanceof Error ? stickerError.message : 'Không đọc được sticker.');
    } finally {
      if (stickerInputRef.current) stickerInputRef.current.value = '';
    }
  };

  const applyA5ShopeePreset = () => {
    setPrintMode('a5-shopee');
    setStickers(current =>
      current.map((sticker, index) => ({
        ...sticker,
        xPercent: index % 2 === 0 ? 5 : 52,
        yPercent: index < 2 ? 3.2 : 17,
        widthPercent: index === 0 ? 90 : 40,
        rotation: 0,
        opacity: 1,
      })),
    );
    setStatus('Đã bật mẫu A5 Shopee: phiếu vận chuyển nằm phía trên, vùng dưới dành cho sticker.');
  };

  const exportPdf = async () => {
    if (!pdfBytes || !pdfFile) {
      setError('Hãy tải PDF phiếu giao hàng trước.');
      return;
    }
    if (stickers.length === 0) {
      setError('Hãy thêm ít nhất một sticker.');
      return;
    }

    setIsBusy(true);
    setError(null);
    setStatus('Đang dán sticker vào PDF...');
    try {
      const pdfDoc = printMode === 'a5-shopee'
        ? await PDFDocument.create()
        : await PDFDocument.load(pdfBytes.slice(0), {ignoreEncryption: true});
      const embeds = [];
      for (const sticker of stickers) {
        const imageBytes = dataUrlToUint8Array(sticker.dataUrl);
        const image = sticker.mimeType === 'image/png'
          ? await pdfDoc.embedPng(imageBytes)
          : await pdfDoc.embedJpg(imageBytes);
        embeds.push({sticker, image});
      }

      if (printMode === 'a5-shopee') {
        const sourcePdf = await PDFDocument.load(pdfBytes.slice(0), {ignoreEncryption: true});
        const pageCount = sourcePdf.getPageCount();
        const embeddedPages = await pdfDoc.embedPdf(pdfBytes.slice(0), Array.from({length: pageCount}, (_, index) => index));
        embeddedPages.forEach(embeddedPage => {
          const page = pdfDoc.addPage([A5_PAGE.width, A5_PAGE.height]);
          const labelBox = {
            x: A5_PAGE.margin,
            y: A5_PAGE.margin + A5_PAGE.stickerBandHeight,
            width: A5_PAGE.width - A5_PAGE.margin * 2,
            height: A5_PAGE.height - A5_PAGE.margin * 2 - A5_PAGE.stickerBandHeight,
          };
          const scale = Math.min(labelBox.width / embeddedPage.width, labelBox.height / embeddedPage.height);
          const drawWidth = embeddedPage.width * scale;
          const drawHeight = embeddedPage.height * scale;
          page.drawPage(embeddedPage, {
            x: labelBox.x + (labelBox.width - drawWidth) / 2,
            y: labelBox.y + (labelBox.height - drawHeight) / 2,
            width: drawWidth,
            height: drawHeight,
          });

          embeds.forEach(({sticker, image}) => {
            const imageWidth = Math.max(20, A5_PAGE.width * (sticker.widthPercent / 100));
            const imageHeight = imageWidth * (image.height / image.width);
            const x = Math.min(Math.max(0, A5_PAGE.width * (sticker.xPercent / 100)), Math.max(0, A5_PAGE.width - imageWidth));
            const y = Math.min(Math.max(0, A5_PAGE.height * (sticker.yPercent / 100)), Math.max(0, A5_PAGE.height - imageHeight));
            page.drawImage(image, {
              x,
              y,
              width: imageWidth,
              height: imageHeight,
              opacity: sticker.opacity,
              rotate: degrees(sticker.rotation || 0),
            });
          });
        });
      } else {
        pdfDoc.getPages().forEach(page => {
        const {width, height} = page.getSize();
        embeds.forEach(({sticker, image}) => {
          const imageWidth = Math.max(20, width * (sticker.widthPercent / 100));
          const imageHeight = imageWidth * (image.height / image.width);
          const x = Math.min(Math.max(0, width * (sticker.xPercent / 100)), Math.max(0, width - imageWidth));
          const y = Math.min(Math.max(0, height * (sticker.yPercent / 100)), Math.max(0, height - imageHeight));
          page.drawImage(image, {
            x,
            y,
            width: imageWidth,
            height: imageHeight,
            opacity: sticker.opacity,
            rotate: degrees(sticker.rotation || 0),
          });
        });
        });
      }

      const outputBytes = await pdfDoc.save();
      const blob = new Blob([outputBytes], {type: 'application/pdf'});
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${pdfFile.name.replace(/\.pdf$/i, '')}_${printMode === 'a5-shopee' ? 'A5_shopee' : 'dan_sticker'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setStatus(`Đã xuất PDF ${printMode === 'a5-shopee' ? 'A5 Shopee' : 'có sticker'} cho ${pdfDoc.getPageCount()} trang.`);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Không xuất được PDF.');
      setStatus('Xuất PDF chưa thành công.');
    } finally {
      setIsBusy(false);
    }
  };

  const removeSticker = (id: string) => {
    setStickers(current => current.filter(sticker => sticker.id !== id));
    if (selectedStickerId === id) setSelectedStickerId(null);
  };

  const clearStickers = () => {
    setStickers([]);
    setSelectedStickerId(null);
    setStatus('Đã xóa mẫu sticker.');
  };

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-slate-900">
      <div className="mx-auto grid min-h-screen w-full max-w-[1480px] grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)_360px]">
        <aside className="border-b border-slate-200 bg-white p-5 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3">
            <img src="/app-icon.png" alt="Thanh Duy" className="size-11 rounded-xl border border-slate-200" />
            <div>
              <h1 className="text-base font-black leading-tight">In sticker phiếu giao hàng</h1>
              <p className="text-xs font-semibold text-slate-500">Thanh Duy TikTok Tool</p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <input ref={pdfInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={handlePdfUpload} />
            <button
              type="button"
              onClick={() => pdfInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800"
            >
              <UploadCloud className="size-4" />
              Tải PDF
            </button>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <label className="text-xs font-bold text-slate-600">Link PDF TikTok/Shopee</label>
              <div className="mt-2 flex gap-2">
                <input
                  value={pdfLink}
                  onChange={event => setPdfLink(event.target.value)}
                  placeholder="https://..."
                  className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500"
                />
                <button
                  type="button"
                  onClick={loadPdfFromLink}
                  disabled={isBusy}
                  className="rounded-md bg-sky-600 px-3 text-white disabled:opacity-50"
                  title="Tải PDF từ link"
                >
                  <LinkIcon className="size-4" />
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-bold text-slate-600">Kiểu in</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPrintMode('original')}
                  className={`rounded-md px-3 py-2 text-xs font-black ${
                    printMode === 'original'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Giữ nguyên
                </button>
                <button
                  type="button"
                  onClick={applyA5ShopeePreset}
                  className={`rounded-md px-3 py-2 text-xs font-black ${
                    printMode === 'a5-shopee'
                      ? 'bg-orange-600 text-white'
                      : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100'
                  }`}
                >
                  A5 Shopee
                </button>
              </div>
              <p className="mt-2 text-[11px] font-semibold leading-relaxed text-slate-500">
                A5 Shopee phóng phiếu theo đúng tỉ lệ ở phần trên, chừa phần dưới để dán sticker.
              </p>
            </div>

            <input ref={stickerInputRef} type="file" accept="image/png,image/jpeg" multiple className="hidden" onChange={handleStickerUpload} />
            <button
              type="button"
              onClick={() => stickerInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50"
            >
              <ImagePlus className="size-4" />
              Thêm sticker
            </button>

            <button
              type="button"
              onClick={exportPdf}
              disabled={isBusy || !pdfBytes || stickers.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isBusy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              Xuất PDF
            </button>
          </div>

          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase text-slate-500">Trạng thái</p>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-800">{status}</p>
            {pdfFile && (
              <div className="mt-4 flex items-start gap-2 rounded-md bg-white p-3 text-xs text-slate-600">
                <FileText className="mt-0.5 size-4 shrink-0 text-sky-600" />
                <div className="min-w-0">
                  <p className="truncate font-bold text-slate-800">{pdfFile.name}</p>
                  <p>{pdfPageCount} trang</p>
                </div>
              </div>
            )}
          </div>
        </aside>

        <section className="min-w-0 p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Bản xem trước trang đầu</p>
              <p className="text-sm font-semibold text-slate-700">
                {printMode === 'a5-shopee'
                  ? 'Phiếu vận chuyển giữ nguyên tỉ lệ ở phần trên A5, sticker nằm ở vùng dưới.'
                  : 'Sticker sẽ được in cùng vị trí trên tất cả trang PDF.'}
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600">
              <Move className="size-3.5" />
              Kéo trực tiếp trên phiếu
            </div>
          </div>

          <div className="overflow-auto rounded-lg border border-slate-200 bg-slate-200 p-4 shadow-inner">
            <div
              className="relative mx-auto aspect-[210/297] w-full max-w-[720px] overflow-hidden bg-white shadow-xl"
              onPointerDown={() => setSelectedStickerId(null)}
            >
              {printMode === 'a5-shopee' && (
                <>
                  <div className="absolute inset-x-[4.3%] top-[3%] bottom-[28.9%] rounded-sm border border-slate-300" />
                  <div className="absolute inset-x-[4.3%] bottom-[3%] h-[23.5%] rounded-sm border border-dashed border-orange-400 bg-orange-50/25" />
                  <div className="absolute bottom-[4%] left-[6%] rounded bg-white/90 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-orange-700 shadow-sm">
                    Vùng sticker
                  </div>
                </>
              )}
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="PDF preview"
                  className={printMode === 'a5-shopee' ? 'absolute object-contain' : 'absolute inset-0 size-full object-contain'}
                  style={printMode === 'a5-shopee'
                    ? {
                        left: '4.3%',
                        top: '3%',
                        width: '91.4%',
                        height: '68.1%',
                      }
                    : undefined}
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center bg-white">
                  <div className="text-center">
                    <FileText className="mx-auto size-14 text-slate-300" />
                    <p className="mt-3 text-sm font-bold text-slate-500">Chưa có PDF</p>
                  </div>
                </div>
              )}

              {stickers.map(sticker => {
                const isSelected = selectedStickerId === sticker.id;
                return (
                  <div
                    key={sticker.id}
                    className={`absolute cursor-move touch-none ${isSelected ? 'outline outline-2 outline-rose-500' : ''}`}
                    style={{
                      left: `${sticker.xPercent}%`,
                      bottom: `${sticker.yPercent}%`,
                      width: `${sticker.widthPercent}%`,
                      opacity: sticker.opacity,
                      transform: `rotate(${sticker.rotation || 0}deg)`,
                      transformOrigin: 'center center',
                    }}
                    onPointerDown={event => {
                      event.stopPropagation();
                      setSelectedStickerId(sticker.id);
                      setDragState({
                        id: sticker.id,
                        mode: 'move',
                        startX: event.clientX,
                        startY: event.clientY,
                        original: sticker,
                      });
                    }}
                  >
                    <img src={sticker.dataUrl} alt={sticker.name} className="block w-full select-none" draggable={false} />
                    {isSelected && (
                      <>
                        <button
                          type="button"
                          title="Phóng to/thu nhỏ"
                          className="absolute -bottom-3 -right-3 size-7 rounded-full bg-sky-600 shadow-lg"
                          onPointerDown={event => {
                            event.stopPropagation();
                            setDragState({
                              id: sticker.id,
                              mode: 'resize',
                              startX: event.clientX,
                              startY: event.clientY,
                              original: sticker,
                            });
                          }}
                        />
                        <button
                          type="button"
                          title="Xoay"
                          className="absolute -top-9 left-1/2 grid size-7 -translate-x-1/2 place-items-center rounded-full bg-violet-600 text-white shadow-lg"
                          onPointerDown={event => {
                            event.stopPropagation();
                            setDragState({
                              id: sticker.id,
                              mode: 'rotate',
                              startX: event.clientX,
                              startY: event.clientY,
                              original: sticker,
                            });
                          }}
                        >
                          <RotateCcw className="size-4" />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="border-t border-slate-200 bg-white p-5 lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-black uppercase tracking-wide">Sticker</h2>
              <p className="text-xs font-semibold text-slate-500">{stickers.length} ảnh đã thêm</p>
            </div>
            {stickers.length > 0 && (
              <button type="button" onClick={clearStickers} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" title="Xóa hết sticker">
                <Trash2 className="size-4" />
              </button>
            )}
          </div>

          <div className="mt-5 space-y-3">
            {stickers.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
                <ImagePlus className="mx-auto size-9 text-slate-300" />
                <p className="mt-3 text-sm font-bold text-slate-500">Chưa có sticker</p>
              </div>
            ) : (
              stickers.map(sticker => (
                <button
                  type="button"
                  key={sticker.id}
                  onClick={() => setSelectedStickerId(sticker.id)}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left ${
                    selectedStickerId === sticker.id ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <img src={sticker.dataUrl} alt={sticker.name} className="size-14 rounded-md border border-slate-200 object-contain" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{sticker.name}</span>
                    <span className="mt-1 block text-xs font-semibold text-slate-500">
                      X {sticker.xPercent}% - Y {sticker.yPercent}% - Size {sticker.widthPercent}%
                    </span>
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={event => {
                      event.stopPropagation();
                      removeSticker(sticker.id);
                    }}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') removeSticker(sticker.id);
                    }}
                    className="rounded-md p-2 text-slate-400 hover:bg-white hover:text-rose-600"
                    title="Xóa sticker"
                  >
                    <X className="size-4" />
                  </span>
                </button>
              ))
            )}
          </div>

          {selectedSticker && (
            <div className="mt-5 space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <label className="block">
                <span className="text-xs font-bold text-slate-600">Kích thước</span>
                <input
                  type="range"
                  min={6}
                  max={110}
                  value={selectedSticker.widthPercent}
                  onChange={event => updateSticker(selectedSticker.id, {widthPercent: Number(event.target.value)})}
                  className="mt-2 w-full accent-sky-600"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-600">Xoay</span>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  value={selectedSticker.rotation}
                  onChange={event => updateSticker(selectedSticker.id, {rotation: Number(event.target.value)})}
                  className="mt-2 w-full accent-violet-600"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-600">Độ mờ</span>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={Math.round(selectedSticker.opacity * 100)}
                  onChange={event => updateSticker(selectedSticker.id, {opacity: Number(event.target.value) / 100})}
                  className="mt-2 w-full accent-emerald-600"
                />
              </label>
              <button
                type="button"
                onClick={() => setStatus('Đã lưu mẫu sticker trên trình duyệt này.')}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-slate-800 ring-1 ring-slate-200 hover:bg-slate-100"
              >
                <Save className="size-4" />
                Lưu mẫu
              </button>
            </div>
          )}

          {error && (
            <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
              {error}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

export default StickerWebApp;