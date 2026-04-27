import type { IEMBotRawMessage } from '../types/iembot';

const BASE_URL = '/iembot-json/room';

export async function fetchIEMBotMessages(
  room: string,
  seqnum: number
): Promise<IEMBotRawMessage[]> {
  const url = `${BASE_URL}/${encodeURIComponent(room)}?seqnum=${seqnum}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`IEMBot fetch failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return (data.messages ?? []) as IEMBotRawMessage[];
}

/** Strip XML namespace wrapper, keep inner HTML content */
export function cleanMessageHtml(rawHtml: string): string {
  // Remove <body xmlns='...'> wrapper
  let html = rawHtml.replace(/<body[^>]*>/gi, '').replace(/<\/body>/gi, '');
  // Strip any <script> tags for safety
  html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  // Make links open in new tab
  html = html.replace(/<a /gi, '<a target="_blank" rel="noopener noreferrer" ');
  return html.trim();
}
