// src/components/SlidesEmbed.jsx
function toSlidesEmbedUrl(value) {
  if (!value) return '';
  try {
    const match = value.match(/\/presentation\/d\/([^/]+)/);
    if (match?.[1]) {
      return `https://docs.google.com/presentation/d/${match[1]}/embed?start=false&loop=false&delayms=3000`;
    }
    return value;
  } catch {
    return value;
  }
}

export default function SlidesEmbed({ url, fileUrl, fileName, title }) {
  const isGoogleSlides = url && url.includes('docs.google.com/presentation');
  const _isPdf = (fileName && fileName.toLowerCase().endsWith('.pdf')) ||
    (fileUrl && fileUrl.toLowerCase().includes('.pdf'));

  if (url && !isGoogleSlides) {
    return (
      <iframe
        src={url}
        title={title || 'Presentation'}
        allowFullScreen
      />
    );
  }

  if (url && isGoogleSlides) {
    return (
      <iframe
        src={toSlidesEmbedUrl(url)}
        title={title || 'Slides'}
        allowFullScreen
      />
    );
  }

  return null;
}