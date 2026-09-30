import { MatrixClient } from 'matrix-js-sdk';

export type CheckQuota = { limit: number; left: number; resets?: number };
export type LinkFinding = { level: 'warn' | 'bad'; text: string };
export type LinkReport = {
  verdict: 'ok' | 'warn' | 'bad';
  url: string;
  finalUrl: string;
  hops: string[];
  domain: string;
  registered?: number;
  title?: string;
  findings: LinkFinding[];
  malwareListChecked: boolean;
  quota?: CheckQuota;
};

export const quotaText = (q?: CheckQuota) =>
  q
    ? `${q.left} of ${q.limit} checks left${
        q.resets ? ` until ${new Date(q.resets).toLocaleDateString()}` : ''
      }.`
    : '';

export const checkLink = async (mx: MatrixClient, url: string): Promise<LinkReport> => {
  const res = await fetch(`${window.location.origin}/api/links/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ openid: await mx.getOpenIdToken(), url }),
  });
  const data = await res.json().catch(() => undefined);
  if (!res.ok || !data?.verdict) throw new Error(data?.error ?? "Couldn't check this link.");
  return data as LinkReport;
};
