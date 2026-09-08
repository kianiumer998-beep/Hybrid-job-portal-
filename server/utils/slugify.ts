export function generateJobSlug(title: string, city?: string, id?: string): string {
  const cleanTitle = (title || 'job')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
  const cleanCity = city
    ? city.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
    : '';
  const cleanId = id ? id.replace(/[^a-z0-9]+/gi, '').slice(-8) : Math.random().toString(36).substring(2, 8);
  
  if (cleanCity) {
    return `${cleanTitle}-${cleanCity}-${cleanId}`;
  }
  return `${cleanTitle}-${cleanId}`;
}
