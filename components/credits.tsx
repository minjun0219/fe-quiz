const SITE_URL = "https://minjun.kim";
const REPO_URL = "https://github.com/minjun0219/fe-quiz";

function GithubMark({ className }: { className?: string }) {
  return (
    <svg
      role="img"
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M12 .5C5.73.5.75 5.48.75 11.75c0 4.97 3.22 9.18 7.69 10.67.56.1.77-.24.77-.54 0-.27-.01-.97-.02-1.91-3.13.68-3.79-1.51-3.79-1.51-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.63 1.22 3.27.93.1-.73.39-1.22.71-1.5-2.5-.29-5.13-1.25-5.13-5.55 0-1.23.44-2.23 1.16-3.02-.12-.29-.5-1.43.11-2.97 0 0 .94-.3 3.09 1.15.9-.25 1.86-.37 2.82-.38.96.01 1.92.13 2.82.38 2.15-1.45 3.09-1.15 3.09-1.15.61 1.54.23 2.68.11 2.97.72.79 1.16 1.79 1.16 3.02 0 4.31-2.64 5.26-5.15 5.54.4.34.76 1.02.76 2.06 0 1.49-.01 2.69-.01 3.05 0 .3.2.65.78.54 4.46-1.49 7.68-5.7 7.68-10.67C23.25 5.48 18.27.5 12 .5z" />
    </svg>
  );
}

export function SiteCredit() {
  return (
    <footer className="flex items-center justify-center gap-3 text-xs text-zinc-400">
      <a
        href={SITE_URL}
        target="_blank"
        rel="noreferrer noopener"
        className="transition hover:text-zinc-600"
      >
        by minjun.kim
      </a>
      <span aria-hidden="true" className="text-zinc-300">
        ·
      </span>
      <a
        href={REPO_URL}
        target="_blank"
        rel="noreferrer noopener"
        aria-label="GitHub 저장소"
        className="transition hover:text-zinc-600"
      >
        <GithubMark className="h-4 w-4" />
      </a>
    </footer>
  );
}

export function ContributeNote() {
  return (
    <p className="mt-6 text-center text-xs text-zinc-400">
      문제가 이상하거나 같이 만들고 싶으면{" "}
      <a
        href={REPO_URL}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex items-center gap-1 font-medium text-zinc-500 underline-offset-2 transition hover:text-zinc-700 hover:underline"
      >
        <GithubMark className="h-3.5 w-3.5" />
        GitHub
      </a>
      에서 함께 해요
    </p>
  );
}
