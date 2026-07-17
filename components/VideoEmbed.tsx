// הטמעת סרטון — YouTube / Vimeo / קובץ ישיר (server component, ללא JS)
function parse(url: string): { type: 'youtube' | 'vimeo' | 'file'; src: string } | null {
  const u = url.trim();
  if (!u) return null;
  // YouTube
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  if (yt) return { type: 'youtube', src: `https://www.youtube.com/embed/${yt[1]}` };
  // Vimeo
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return { type: 'vimeo', src: `https://player.vimeo.com/video/${vm[1]}` };
  // Direct file
  if (/\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(u)) return { type: 'file', src: u };
  return null;
}

export default function VideoEmbed({ url }: { url: string }) {
  const v = parse(url);
  if (!v) return null;

  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden border border-border bg-black"
      style={{ aspectRatio: '16 / 9' }}
    >
      {v.type === 'file' ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video src={v.src} controls className="absolute inset-0 w-full h-full" />
      ) : (
        <iframe
          src={v.src}
          title="video"
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      )}
    </div>
  );
}
