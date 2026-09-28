import React, { CSSProperties, useState } from 'react';
import { useRouteError } from 'react-router-dom';
import { sendReport } from './reports';

// Plain elements and inline colours, so this still renders when the theme is what broke.
const page: CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  background: '#0e0e10',
  color: '#f2f2f2',
  fontFamily: 'Inter, system-ui, sans-serif',
  zIndex: 9999,
};
const card: CSSProperties = {
  width: 'min(420px, 100%)',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: 24,
  borderRadius: 16,
  background: '#18181b',
  border: '1px solid #2a2a2e',
};
const button = (primary: boolean): CSSProperties => ({
  padding: '10px 14px',
  borderRadius: 10,
  border: 'none',
  font: 'inherit',
  fontWeight: 600,
  cursor: 'pointer',
  background: primary ? '#ff6b3d' : '#2a2a2e',
  color: primary ? '#1a0d07' : '#f2f2f2',
});

type Status = 'idle' | 'writing' | 'sending' | 'sent';

// A tab left open across a deploy asks for files the new version no longer has.
const OUTDATED =
  /dynamically imported module|importing a module script failed|unable to preload css|mime type|error loading dynamically imported/i;
const isOutdated = (error: unknown): boolean =>
  OUTDATED.test(error instanceof Error ? error.message : String(error ?? ''));

export function CrashScreen({ error }: { error: unknown }) {
  const [status, setStatus] = useState<Status>('idle');
  const [note, setNote] = useState('');
  const [failed, setFailed] = useState<string>();
  const outdated = isOutdated(error);

  const send = async () => {
    setStatus('sending');
    setFailed(undefined);
    try {
      await sendReport(error, note);
      setStatus('sent');
    } catch (e) {
      setFailed(e instanceof Error ? e.message : "Couldn't send the report.");
      setStatus('writing');
    }
  };

  return (
    <div style={page} data-crash-screen>
      <div style={card} role="alert">
        <div style={{ fontSize: 32 }} aria-hidden>
          🔥
        </div>
        <h1 style={{ margin: 0, fontSize: 20 }}>
          {outdated ? 'Angaara just got updated' : 'Uh oh, there seems to be a problem'}
        </h1>
        <p style={{ margin: 0, color: '#a1a1aa', lineHeight: 1.5 }}>
          {outdated
            ? 'This tab is still on the old version. Reload to get the new one.'
            : 'Something broke on our side. Reloading usually fixes it.'}
        </p>
        {status === 'writing' || status === 'sending' ? (
          <>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="What were you doing? (optional)"
              disabled={status === 'sending'}
              style={{
                padding: 10,
                borderRadius: 10,
                border: '1px solid #2a2a2e',
                background: '#0e0e10',
                color: 'inherit',
                font: 'inherit',
                resize: 'vertical',
              }}
            />
            <p style={{ margin: 0, fontSize: 12, color: '#a1a1aa' }}>
              Sends the error and this note to the Angaara developers. It doesn&apos;t include your
              messages, account or the rooms you were in.
            </p>
          </>
        ) : null}
        {failed && <p style={{ margin: 0, color: '#f87171', fontSize: 14 }}>{failed}</p>}
        {status === 'sent' && (
          <p style={{ margin: 0, color: '#4ade80' }}>Thanks, the developers got your report.</p>
        )}
        <button type="button" style={button(true)} onClick={() => window.location.reload()}>
          Reload the page
        </button>
        {status === 'idle' && !outdated && (
          <button type="button" style={button(false)} onClick={() => setStatus('writing')}>
            Report
          </button>
        )}
        {(status === 'writing' || status === 'sending') && (
          <button
            type="button"
            style={button(false)}
            onClick={send}
            disabled={status === 'sending'}
          >
            {status === 'sending' ? 'Sending…' : 'Send Report'}
          </button>
        )}
      </div>
    </div>
  );
}

// For the router, which hands over whatever a page threw.
export function RouteCrashScreen() {
  return <CrashScreen error={useRouteError()} />;
}
