export const hasExtension = (
  path: string | undefined | null,
  extension: string
): boolean => {
  if (!path) {
    return false;
  }
  const ext = extension.startsWith('.') ? extension : `.${extension}`;
  return path.toLowerCase().indexOf(ext.toLowerCase()) > -1;
};

// Videos a post can carry: mp4 and QuickTime (mov) files
export const isVideoPath = (path: string | undefined | null): boolean => {
  return hasExtension(path, 'mp4') || /\.mov(?:$|[?#])/i.test(path || '');
};
