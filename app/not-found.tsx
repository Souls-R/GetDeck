import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="h-screen flex flex-col items-center justify-center bg-[var(--background)] px-4">
            <div className="text-center max-w-md">
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <span className="text-4xl font-bold text-white">?</span>
                </div>

                <h1 className="text-2xl font-bold text-[var(--foreground)] mb-2">
                    页面不存在
                </h1>

                <p className="text-[var(--foreground-muted)] mb-6">
                    该卡组可能未从 GetDeck 生成，或链接已失效。
                </p>

                <Link
                    href="/"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white font-medium hover:bg-[var(--primary-hover)] transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    返回首页
                </Link>
            </div>
        </div>
    );
}
