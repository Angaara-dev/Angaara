import React, { CSSProperties, useState } from 'react';
import { useRouteError } from 'react-router-dom';
import { crashReport, sendReport } from './reports';

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
  maxHeight: '100%',
  overflowY: 'auto',
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

const box: CSSProperties = {
  margin: 0,
  padding: 10,
  borderRadius: 10,
  border: '1px solid #2a2a2e',
  background: '#0e0e10',
  fontSize: 12,
  lineHeight: 1.5,
};
const muted: CSSProperties = { margin: 0, fontSize: 12, color: '#a1a1aa' };

// A tab left open across a deploy asks for files the new version no longer has.
const OUTDATED =
  /dynamically imported module|importing a module script failed|unable to preload css|mime type|error loading dynamically imported/i;
const isOutdated = (error: unknown): boolean =>
  OUTDATED.test(error instanceof Error ? error.message : String(error ?? ''));

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div style={{ overflowWrap: 'anywhere' }}>
      <span style={{ color: '#a1a1aa' }}>{label}: </span>
      {value}
    </div>
  );
}

export function CrashScreen({ error }: { error: unknown }) {
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<string>();
  const outdated = isOutdated(error);
  const report = crashReport(error, note);

  // The report goes out from here, while the error is still known; a reload would lose it.
  const sendAndReload = async () => {
    setSending(true);
    setFailed(undefined);
    try {
      await sendReport(report);
      window.location.reload();
    } catch (e) {
      setFailed(e instanceof Error ? e.message : "Couldn't send the report.");
      setSending(false);
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
            : 'Something broke on our side. Reloading usually fixes it. You can send us a crash report first so we can fix it for good.'}
        </p>
        {!outdated && (
          <>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              rows={2}
              placeholder="What were you doing? (optional)"
              disabled={sending}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p style={{ ...muted, fontWeight: 600, color: '#f2f2f2' }}>
                What the crash report sends
              </p>
              <div style={box}>
                <Field label="Error" value={report.message} />
                <Field label="Page" value={report.path} />
                <Field label="Build" value={report.build} />
                <Field label="Browser" value={navigator.userAgent} />
                <Field label="Your note" value={report.note} />
              </div>
              {report.stack && (
                <pre
                  style={{
                    ...box,
                    maxHeight: 120,
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                    fontFamily: 'monospace',
                    fontSize: 11,
                  }}
                >
                  {report.stack}
                </pre>
              )}
              <p style={muted}>
                Nothing else. No messages, account or room names, and user and room IDs are removed
                from the page address.
              </p>
            </div>
          </>
        )}
        {failed && <p style={{ margin: 0, color: '#f87171', fontSize: 14 }}>{failed}</p>}
        {!outdated && (
          <button type="button" style={button(true)} onClick={sendAndReload} disabled={sending}>
            {sending ? 'Sending…' : 'Send Report and Reload'}
          </button>
        )}
        <button
          type="button"
          style={button(outdated)}
          onClick={() => window.location.reload()}
          disabled={sending}
        >
          {outdated ? 'Reload the page' : 'Reload Without Sending'}
        </button>
      </div>
    </div>
  );
}

export function RouteCrashScreen() {
  return <CrashScreen error={useRouteError()} />;
}
