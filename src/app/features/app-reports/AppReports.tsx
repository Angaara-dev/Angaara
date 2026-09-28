import React, { useState } from 'react';
import { Box, Button, color, config, Spinner, Text } from 'folds';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useClientConfig } from '../../hooks/useClientConfig';
import { AppReport, listReports, resolveReport } from './reports';

// Only decides whether to show the page; the Worker checks the badge itself on every request.
export const useIsAppDeveloper = (): boolean => {
  const mx = useMatrixClient();
  const { badges } = useClientConfig();
  return !!badges?.[mx.getSafeUserId()]?.includes('developer');
};

function ReportItem({ report, onDone }: { report: AppReport; onDone: (id: number) => void }) {
  const mx = useMatrixClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const done = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await resolveReport(mx, report.id);
      onDone(report.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't mark it done.");
      setBusy(false);
    }
  };

  return (
    <Box
      direction="Column"
      gap="200"
      style={{
        padding: config.space.S400,
        borderRadius: config.radii.R400,
        background: color.SurfaceVariant.Container,
      }}
    >
      <Box alignItems="Start" gap="300">
        <Box direction="Column" gap="100" grow="Yes" style={{ minWidth: 0 }}>
          <Text size="T300" style={{ overflowWrap: 'anywhere' }}>
            <b>{report.message || 'Unknown error'}</b>
          </Text>
          <Text size="T200" priority="300" style={{ overflowWrap: 'anywhere' }}>
            {new Date(report.at).toLocaleString()} · {report.path ?? 'unknown page'} ·{' '}
            {report.build ?? 'unknown build'}
          </Text>
        </Box>
        <Button size="300" variant="Success" fill="Soft" radii="300" disabled={busy} onClick={done}>
          <Text size="B300">Done</Text>
        </Button>
      </Box>
      {report.note && (
        <Text size="T300" style={{ overflowWrap: 'anywhere' }}>
          “{report.note}”
        </Text>
      )}
      {error && (
        <Text size="T200" style={{ color: color.Critical.Main }}>
          {error}
        </Text>
      )}
      {(report.stack || report.ua) && (
        <Box direction="Column" gap="100">
          <Button
            size="300"
            variant="Secondary"
            fill="None"
            radii="300"
            onClick={() => setOpen(!open)}
            style={{ alignSelf: 'flex-start' }}
          >
            <Text size="B300">{open ? 'Hide details' : 'Show details'}</Text>
          </Button>
          {open && (
            <Text
              as="pre"
              size="T200"
              style={{
                margin: 0,
                padding: config.space.S300,
                borderRadius: config.radii.R300,
                background: color.Background.Container,
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
                fontFamily: 'monospace',
              }}
            >
              {[report.ua, report.stack].filter(Boolean).join('\n\n')}
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
}

// Crash reports sent from the error screen, newest first.
export function AppReports() {
  const mx = useMatrixClient();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['app-reports'],
    queryFn: () => listReports(mx),
  });

  const onDone = (id: number) =>
    queryClient.setQueryData<AppReport[] | undefined>(['app-reports'], (old) =>
      old?.filter((r) => r.id !== id)
    );

  if (isLoading) {
    return (
      <Box justifyContent="Center" style={{ padding: config.space.S700 }}>
        <Spinner variant="Secondary" />
      </Box>
    );
  }
  if (isError) {
    return <Text priority="300">Couldn&apos;t load reports. The Worker may be down.</Text>;
  }
  if (!data) {
    return <Text priority="300">Only accounts with the developer badge can read app reports.</Text>;
  }

  return (
    <Box direction="Column" gap="400">
      <Box alignItems="Center" gap="300">
        <Text size="T300" priority="300" style={{ flexGrow: 1 }}>
          {data.length === 0
            ? 'No reports. Nothing has crashed, or nobody has told us yet.'
            : `${data.length} report${data.length === 1 ? '' : 's'}`}
        </Text>
        <Button
          size="300"
          variant="Secondary"
          fill="Soft"
          radii="300"
          disabled={isFetching}
          onClick={() => refetch()}
        >
          <Text size="B300">Refresh</Text>
        </Button>
      </Box>
      {data.map((report) => (
        <ReportItem key={report.id} report={report} onDone={onDone} />
      ))}
    </Box>
  );
}
