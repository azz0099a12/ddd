import {Component, type ErrorInfo, type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import StickerWebApp from './StickerWebApp.tsx';
import './index.css';

class AppErrorBoundary extends Component<
  {children: ReactNode},
  {error: Error | null}
> {
  declare readonly props: Readonly<{children: ReactNode}>;
  state = {error: null as Error | null};

  static getDerivedStateFromError(error: Error) {
    return {error};
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Ứng dụng gặp lỗi:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-xl rounded-3xl border border-rose-100 bg-white p-8 shadow-xl">
          <h1 className="text-xl font-black text-rose-600">Ứng dụng gặp lỗi hiển thị</h1>
          <p className="mt-3 text-sm text-slate-600">
            Trang không còn bị trắng hoàn toàn. Hãy tải lại trang; nếu lỗi vẫn còn, gửi nội dung bên dưới để kiểm tra.
          </p>
          <pre className="mt-4 max-h-48 overflow-auto rounded-xl bg-slate-900 p-4 text-xs text-rose-100 whitespace-pre-wrap">
            {this.state.error.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="mt-5 rounded-xl bg-violet-600 px-5 py-3 text-sm font-black text-white"
          >
            Tải lại ứng dụng
          </button>
        </div>
      </div>
    );
  }
}

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <StickerWebApp />
  </AppErrorBoundary>,
);